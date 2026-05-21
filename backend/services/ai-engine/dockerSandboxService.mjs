import { spawn } from "node:child_process";
import { env } from "../../src/config/env.mjs";

const DEFAULT_ALLOWED_BINS = [
  "nmap",
  "curl",
  "dig",
  "nslookup",
  "whois",
  "traceroute",
  "ping",
  "openssl",
  "nc",
  "host",
  "wget",
];

const parseArgs = (input = "") => {
  const args = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match;
  while ((match = regex.exec(input))) {
    args.push(match[1] || match[2] || match[3]);
  }
  return args;
};

const normalizeHost = (value = "") => String(value || "").trim().toLowerCase();

const isIp = (value = "") => /^\d{1,3}(\.\d{1,3}){3}$/.test(value);

const ipToInt = (ip = "") =>
  ip
    .split(".")
    .map((part) => Number(part))
    .reduce((acc, part) => (acc << 8) + (Number.isFinite(part) ? part : 0), 0);

const inCidr = (ip, cidr) => {
  const [range, bitsRaw] = String(cidr || "").split("/");
  const bits = Number(bitsRaw);
  if (!isIp(ip) || !isIp(range) || !Number.isFinite(bits)) return false;
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1);
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
};

const matchesHostAllowlist = (host, allowlist) => {
  if (!host) return false;
  for (const entry of allowlist) {
    if (entry.startsWith("*.")) {
      const root = entry.slice(2);
      if (host === root || host.endsWith(`.${root}`)) return true;
    } else if (entry.startsWith(".")) {
      const root = entry.slice(1);
      if (host === root || host.endsWith(`.${root}`)) return true;
    } else if (host === entry) {
      return true;
    }
  }
  return false;
};

const extractTargets = (args = []) =>
  args.filter((arg) => {
    if (!arg) return false;
    if (arg.startsWith("-")) return false;
    if (arg.startsWith("@")) return false;
    if (/^[a-z]+:\/\//i.test(arg)) return true;
    if (isIp(arg)) return true;
    return /[a-z]/i.test(arg);
  });

const normalizeTargetHost = (value = "") => {
  if (/^[a-z]+:\/\//i.test(value)) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  return normalizeHost(value);
};

export const runDockerSandboxCommand = async (command) => {
  const raw = String(command || "").trim();
  if (!raw) {
    return { ok: false, code: "empty_command", output: "Command was empty." };
  }
  if (/[;&|`$<>]/.test(raw) || /(\r|\n)/.test(raw)) {
    return { ok: false, code: "unsafe_command", output: "Blocked: unsafe shell operator detected." };
  }

  const args = parseArgs(raw);
  const binary = args[0];
  const allowedBins = (env.labAllowedBins?.length ? env.labAllowedBins : DEFAULT_ALLOWED_BINS).map((b) => b.toLowerCase());
  if (!binary || !allowedBins.includes(binary.toLowerCase())) {
    return {
      ok: false,
      code: "binary_not_allowed",
      output: `Command blocked. Allowed tools: ${allowedBins.join(", ")}.`,
    };
  }

  const targets = extractTargets(args.slice(1)).map(normalizeTargetHost).filter(Boolean);
  const allowHosts = env.labAllowlistHosts || [];
  const allowCidrs = env.labAllowlistCidrs || [];
  if (!allowHosts.length && !allowCidrs.length) {
    return {
      ok: false,
      code: "allowlist_missing",
      output: "No allowlist configured. Set LAB_ALLOWLIST_HOSTS or LAB_ALLOWLIST_CIDRS in the backend env.",
    };
  }
  for (const target of targets) {
    const allowed =
      (isIp(target) && (allowHosts.includes(target) || allowCidrs.some((cidr) => inCidr(target, cidr)))) ||
      (!isIp(target) && matchesHostAllowlist(target, allowHosts));
    if (!allowed) {
      return {
        ok: false,
        code: "target_not_allowed",
        output: `Target ${target} is not allowlisted for sandbox scans.`,
      };
    }
  }

  const dockerArgs = [
    "run",
    "--rm",
    "--network",
    env.labDockerNetwork || "bridge",
    "--cpus",
    String(env.labDockerCpus || 0.5),
    "--memory",
    String(env.labDockerMemory || "256m"),
    "--pids-limit",
    String(env.labDockerPidsLimit || 128),
    "--security-opt",
    "no-new-privileges",
    "--cap-drop",
    "ALL",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,size=64m",
    "--tmpfs",
    "/run:rw,noexec,nosuid,size=16m",
    env.labDockerImage || "zeroday-lab-sandbox:latest",
    ...args,
  ];

  return await new Promise((resolve) => {
    const child = spawn("docker", dockerArgs, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const killTimer = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        code: "timeout",
        output: "Sandbox command timed out.",
      });
    }, env.labDockerTimeoutMs || 20000);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 8000) stdout = stdout.slice(-8000);
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({
        ok: false,
        code: "docker_unavailable",
        output: `Docker execution failed: ${String(error?.message || error)}`,
      });
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      const output = (stdout || stderr || "").trim();
      if (code === 0) {
        resolve({ ok: true, code: "ok", output: output || "Command completed." });
      } else {
        resolve({
          ok: false,
          code: "execution_failed",
          output: output || `Sandbox command failed with exit code ${code}.`,
        });
      }
    });
  });
};

export const getDockerSandboxStatus = async () => {
  if (!env.labDockerEnabled) {
    return {
      enabled: false,
      ready: false,
      message: "Docker sandbox is disabled.",
      allowlistHosts: env.labAllowlistHosts || [],
      allowlistCidrs: env.labAllowlistCidrs || [],
      allowedBins: env.labAllowedBins?.length ? env.labAllowedBins : DEFAULT_ALLOWED_BINS,
      image: env.labDockerImage || "zeroday-lab-sandbox:latest",
    };
  }

  const image = env.labDockerImage || "zeroday-lab-sandbox:latest";
  return await new Promise((resolve) => {
    const child = spawn("docker", ["image", "inspect", image], { windowsHide: true });
    let stderr = "";
    const killTimer = setTimeout(() => {
      child.kill();
      resolve({
        enabled: true,
        ready: false,
        message: "Docker image inspect timed out.",
        allowlistHosts: env.labAllowlistHosts || [],
        allowlistCidrs: env.labAllowlistCidrs || [],
        allowedBins: env.labAllowedBins?.length ? env.labAllowedBins : DEFAULT_ALLOWED_BINS,
        image,
      });
    }, 5000);

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      clearTimeout(killTimer);
      resolve({
        enabled: true,
        ready: false,
        message: `Docker not available: ${String(error?.message || error)}`,
        allowlistHosts: env.labAllowlistHosts || [],
        allowlistCidrs: env.labAllowlistCidrs || [],
        allowedBins: env.labAllowedBins?.length ? env.labAllowedBins : DEFAULT_ALLOWED_BINS,
        image,
      });
    });
    child.on("close", (code) => {
      clearTimeout(killTimer);
      resolve({
        enabled: true,
        ready: code === 0,
        message: code === 0 ? "Docker sandbox ready." : `Docker image not found: ${image}`,
        allowlistHosts: env.labAllowlistHosts || [],
        allowlistCidrs: env.labAllowlistCidrs || [],
        allowedBins: env.labAllowedBins?.length ? env.labAllowedBins : DEFAULT_ALLOWED_BINS,
        image,
      });
    });
  });
};
