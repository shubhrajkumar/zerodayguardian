import { Router } from "express";
import net from "node:net";
import dns from "node:dns";
import rateLimit from "express-rate-limit";

const router = Router();

// Block private/internal hosts (SSRF protection)
const isBlockedHost = (hostname) => {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '[::1]' ||
    h === '::1'
  )
    return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(h))
    return true;
  return false;
};

// Check if a resolved IP address is in a private range
const isPrivateIp = (ip) => {
  if (/^(127\.|10\.|0\.0\.0\.0$)/.test(ip)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  // Check if it's a valid IPv4 before returning false
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
};

// Per-IP rate limit: max 5 port scans per IP per minute
const portScanRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      code: "portscan_rate_limited",
      error: "Too many port scans. Please wait and retry.",
    });
  },
});

const DEFAULT_PORTS = [
  { port: 21, service: "FTP" },
  { port: 22, service: "SSH" },
  { port: 23, service: "Telnet" },
  { port: 25, service: "SMTP" },
  { port: 53, service: "DNS" },
  { port: 80, service: "HTTP" },
  { port: 110, service: "POP3" },
  { port: 143, service: "IMAP" },
  { port: 443, service: "HTTPS" },
  { port: 445, service: "SMB" },
  { port: 993, service: "IMAPS" },
  { port: 995, service: "POP3S" },
  { port: 1433, service: "MSSQL" },
  { port: 1521, service: "Oracle" },
  { port: 2049, service: "NFS" },
  { port: 3306, service: "MySQL" },
  { port: 3389, service: "RDP" },
  { port: 5432, service: "PostgreSQL" },
  { port: 5900, service: "VNC" },
  { port: 6379, service: "Redis" },
  { port: 8080, service: "HTTP-Alt" },
  { port: 8443, service: "HTTPS-Alt" },
  { port: 27017, service: "MongoDB" },
];

const PORT_GROUPS = {
  web: [80, 443, 8080, 8443],
  mail: [25, 110, 143, 993, 995],
  database: [1433, 1521, 3306, 5432, 6379, 27017],
  infra: [22, 23, 445, 3389, 5900, 2049],
  all: DEFAULT_PORTS.map((p) => p.port),
};

const scanPort = (target, port, timeoutMs = 1500) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const startMs = Date.now();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve({ port, state: "open", latencyMs: Date.now() - startMs });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ port, state: "filtered", latencyMs: null });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ port, state: "closed", latencyMs: null });
    });

    socket.connect(port, target);
  });

const scanWithConcurrency = async (target, ports, concurrency = 5) => {
  const results = [];
  const queue = [...ports];

  const worker = async () => {
    while (queue.length > 0) {
      const port = queue.shift();
      if (port === undefined) break;
      const result = await scanPort(target, port);
      results.push(result);
    }
  };

  const workers = Array.from(
    { length: Math.min(concurrency, ports.length) },
    () => worker()
  );
  await Promise.all(workers);

  return results.sort((a, b) => a.port - b.port);
};

const resolveHost = (hostname) =>
  new Promise((resolve, reject) => {
    // Try IPv4 first, fall back to IPv6 on ENOTFOUND
    dns.lookup(hostname, { family: 4, hints: dns.ADDRCONFIG }, (err4, address4) => {
      if (!err4) return resolve(address4);
      if (err4.code === "ENOTFOUND") {
        // No A record — try AAAA
        dns.lookup(hostname, { family: 6, hints: dns.ADDRCONFIG }, (err6, address6) => {
          if (!err6) return resolve(address6);
          reject(err6);
        });
      } else {
        reject(err4);
      }
    });
  });

router.post("/", portScanRateLimit, async (req, res) => {
  try {
    const { target, ports, group } = req.body;

    if (!target || typeof target !== "string") {
      return res.status(400).json({
        status: "error",
        code: "missing_target",
        error: "Target is required.",
      });
    }

    const cleanTarget = target
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/\s/g, "");

    if (!cleanTarget) {
      return res.status(400).json({
        status: "error",
        code: "invalid_target",
        error: "Target must be a valid hostname or IP address.",
      });
    }

    let portList = [];
    if (group && PORT_GROUPS[group]) {
      portList = PORT_GROUPS[group];
    } else if (Array.isArray(ports) && ports.length > 0) {
      portList = ports
        .map(Number)
        .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
    } else {
      portList = DEFAULT_PORTS.map((p) => p.port);
    }

    // Limit max ports to prevent abuse
    if (portList.length > 25) {
      portList = portList.slice(0, 25);
    }

    // SSRF protection: block private/internal hosts
    if (isBlockedHost(cleanTarget)) {
      return res.status(400).json({
        status: "error",
        code: "blocked_host",
        error: "Internal and private hosts are not allowed.",
      });
    }

    // Verify hostname resolves before scanning
    let resolvedIp;
    try {
      resolvedIp = await resolveHost(cleanTarget);
    } catch {
      return res.status(400).json({
        status: "error",
        code: "dns_resolution_failed",
        error: "Hostname could not be resolved. Check the target and try again.",
      });
    }

    // SSRF protection: verify resolved IP is not in a private range
    if (resolvedIp && isPrivateIp(resolvedIp)) {
      return res.status(400).json({
        status: "error",
        code: "blocked_resolved_ip",
        error: "Target resolved to an internal/private IP address.",
      });
    }

    const scanStart = Date.now();
    const scanResults = await scanWithConcurrency(cleanTarget, portList, 5);
    const scanDurationMs = Date.now() - scanStart;

    const serviceMap = new Map(DEFAULT_PORTS.map((p) => [p.port, p.service]));
    const enrichedResults = scanResults.map((r) => ({
      ...r,
      service: serviceMap.get(r.port) || `PORT${r.port}`,
    }));

    res.json({
      status: "ok",
      target: cleanTarget,
      scanned: enrichedResults.length,
      open: enrichedResults.filter((r) => r.state === "open").length,
      filtered: enrichedResults.filter((r) => r.state === "filtered").length,
      closed: enrichedResults.filter((r) => r.state === "closed").length,
      results: enrichedResults,
      scanDurationMs,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      code: "scan_failed",
      error: "Port scan failed. Check the target and try again.",
    });
  }
});

export default router;
