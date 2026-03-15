import { env } from "../../src/config/env.mjs";
import { runDockerSandboxCommand } from "./dockerSandboxService.mjs";

const labs = {
  "nmap-basics": {
    title: "All Tools Practice Hub",
    description: "Practice the core security toolkit in one safe, guided sandbox flow.",
    objective: "Run a multi-tool recon sequence, capture evidence, and produce a concise findings summary.",
    practiceEnvironment: "Isolated training targets: target.local (host), target-app (web), mail-sim (email artifacts).",
    steps: [
      "Start with host discovery and basic service fingerprinting.",
      "Validate DNS + WHOIS context to understand scope ownership.",
      "Check HTTPS posture with headers and TLS handshake checks.",
      "Summarize risks, evidence, and next steps in one report.",
    ],
    recommendedTools: ["Nmap", "curl", "dig", "whois", "traceroute", "OpenSSL", "netcat"],
    challengeModeHint: "Combine two tools to validate one finding and propose a concrete remediation.",
    allowedCommands: [
      "help",
      "status",
      "next",
      "nmap -sn target.local",
      "nmap -sV target.local",
      "dig target.local",
      "whois target.local",
      "curl -I https://target.local",
      "traceroute target.local",
      "openssl s_client -connect target.local:443",
      "nc -zv target.local 22",
      "report summary",
      "complete",
    ],
    outputs: {
      help:
        "Allowed commands:\n- status\n- next\n- nmap -sn target.local\n- nmap -sV target.local\n- dig target.local\n- whois target.local\n- curl -I https://target.local\n- traceroute target.local\n- openssl s_client -connect target.local:443\n- nc -zv target.local 22\n- report summary\n- complete",
      status:
        "Lab status: ready.\nTargets: target.local (host), target-app (web), mail-sim (email artifacts).\nGoal: practice multi-tool recon and produce a short findings report.",
      next:
        "Next step: start with discovery. Try `nmap -sn target.local` to confirm reachability.",
      "nmap -sn target.local":
        "Starting Nmap scan against target.local\nHost is up (0.021s latency)\nMAC Address: 02:42:ac:11:00:02 (Sandbox)\nNmap done: 1 IP address (1 host up)",
      "nmap -sV target.local":
        "PORT   STATE SERVICE VERSION\n22/tcp open  ssh     OpenSSH 8.9\n80/tcp open  http    nginx 1.22\n443/tcp open https   nginx 1.22\n\nNotes:\n- SSH is exposed; confirm key-based auth only.\n- HTTP should redirect to HTTPS if public.",
      "dig target.local":
        ";; ANSWER SECTION:\ntarget.local. 300 IN A 10.0.12.45\n\nNotes:\n- Internal DNS record resolved.\n- Confirm scope authorization before deeper testing.",
      "whois target.local":
        "WHOIS lookup:\n- Domain: target.local\n- Status: internal/lab reserved\n- Registrant: Zero Day Guardian Lab\n\nNotes:\n- Treat as lab-only asset.\n- Document owner for reporting.",
      "curl -I https://target.local":
        "HTTP/2 200\nserver: nginx/1.22\ncontent-type: text/html; charset=utf-8\nstrict-transport-security: missing\nx-frame-options: missing\n\nRecommendation: add HSTS and clickjacking protection.",
      "traceroute target.local":
        "traceroute to target.local (10.0.12.45), 30 hops max\n 1  10.0.0.1  1.2 ms\n 2  10.0.12.45  3.6 ms\n\nNotes:\n- Direct internal path, minimal hops.",
      "openssl s_client -connect target.local:443":
        "CONNECTED(00000003)\nProtocol: TLSv1.2\nCipher: ECDHE-RSA-AES256-GCM-SHA384\nVerify return code: 0 (ok)\n\nNotes:\n- TLS is active.\n- Consider upgrading to TLSv1.3 if supported.",
      "nc -zv target.local 22":
        "Connection to target.local 22 port [tcp/ssh] succeeded!\n\nNotes:\n- SSH reachable.\n- Confirm MFA or key-only access.",
      "report summary":
        "Summary Report:\n- target.local reachable; SSH/HTTP/HTTPS exposed\n- DNS resolves to internal lab host\n- TLS active but missing HSTS + clickjacking headers\n- SSH reachable; confirm key-only access\nNext: harden headers, validate SSH auth policy, document ownership.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    tips: [
      "Start with discovery, then validate DNS/WHOIS context, then confirm TLS posture.",
      "Never scan assets without authorization.",
    ],
  },
  "phishing-triage": {
    title: "Phishing Triage Sandbox",
    description: "Analyze suspicious email indicators in a realistic but safe lab model.",
    objective: "Classify suspicious email samples and apply containment actions based on risk.",
    practiceEnvironment: "Mail triage simulator with sample-1 and sample-2 artifacts.",
    steps: [
      "Inspect sender identity and domain alignment.",
      "Review language urgency and social engineering cues.",
      "Assess link and attachment risk.",
      "Write a triage summary with response action.",
    ],
    recommendedTools: ["MXToolbox", "VirusTotal", "DMARC Analyzer"],
    challengeModeHint: "Detect one hidden phishing pattern and add one prevention control.",
    allowedCommands: ["help", "status", "next", "analyze sample-1", "analyze sample-2", "extract urls sample-1", "extract urls sample-2", "report summary", "complete"],
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- analyze sample-1\n- analyze sample-2\n- extract urls sample-1\n- extract urls sample-2\n- report summary\n- complete",
      status:
        "Lab status: ready.\nSamples: sample-1 (high risk), sample-2 (low risk)\nGoal: classify risk and choose containment.",
      next:
        "Next step: inspect sender + urgency cues. Try `analyze sample-1` to start.",
      "analyze sample-1":
        "Sample 1:\n- Sender mismatch (from: support@paypa1.com)\n- Urgent language + invoice lure\n- Domain age: 3 days\nRisk score: HIGH\nAction: quarantine, block sender, notify users.",
      "analyze sample-2":
        "Sample 2:\n- Internal sender\n- DKIM aligned\n- Link points to known intranet host\nRisk score: LOW\nAction: mark safe after validation.",
      "extract urls sample-1":
        "Extracted URLs:\n- http://paypa1-secure-billing.com/login\n- http://img-cdn-paypa1.com/track.png\nRecommendation: block domains and add to URL denylist.",
      "extract urls sample-2":
        "Extracted URLs:\n- https://intranet.company.local/policy\nNo external redirect detected.",
      "report summary":
        "Summary:\n- 1 high-risk message\n- 1 low-risk message\nSuggested control: SPF/DKIM/DMARC enforcement + awareness drill.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    tips: [
      "Check sender alignment before opening links.",
      "Pair user awareness with technical controls for best outcomes.",
    ],
  },
  "web-exploit-basics": {
    title: "Web Exploitation Fundamentals",
    description: "Practice ethical web exploitation flow with recon, validation, and remediation.",
    objective: "Detect common web weaknesses and map each finding to a defensive fix.",
    practiceEnvironment: "Simulated web app target-app with controlled vulnerable endpoints.",
    steps: [
      "Enumerate endpoints and attack surface.",
      "Test for reflected XSS in search flow.",
      "Validate SQLi resistance with baseline checks.",
      "Produce remediation checklist with verification steps.",
    ],
    recommendedTools: ["Burp Suite Community", "OWASP ZAP", "SQLMap"],
    challengeModeHint: "Demonstrate one exploit chain and one detection rule.",
    allowedCommands: ["help", "status", "next", "recon target-app", "recon target-app --headers", "test xss", "test sqli", "report findings", "complete"],
    outputs: {
      help: "Allowed commands:\n- status\n- next\n- recon target-app\n- recon target-app --headers\n- test xss\n- test sqli\n- report findings\n- complete",
      status:
        "Lab status: ready.\nTarget: target-app\nGoal: find weak headers and validate common web risks.",
      next:
        "Next step: enumerate endpoints. Try `recon target-app` to list surface areas.",
      "recon target-app":
        "Discovered endpoints: /login /search /profile\nObserved: missing CSP header and permissive input reflection on /search.",
      "recon target-app --headers":
        "Headers:\n- Server: nginx/1.22\n- X-Frame-Options: missing\n- Content-Security-Policy: missing\nRecommendation: add CSP + clickjacking protection.",
      "test xss":
        "Reflected payload observed in /search response.\nRisk: MEDIUM\nFix: output encoding + CSP + input validation.",
      "test sqli":
        "No injection confirmed with baseline payloads.\nRecommendation: parameterized queries + prepared statements verification.",
      "report findings":
        "Report:\n- Reflected XSS candidate in /search\n- Missing CSP header\nNext step: create patch test cases and verify remediation.",
      complete: "Practice objective complete. Save lab progress and move to challenge mode.",
    },
    tips: [
      "Exploit only in authorized environments.",
      "Always pair every finding with clear remediation guidance.",
    ],
  },
};

export const listLabs = () =>
  Object.entries(labs).map(([id, lab]) => ({
    id,
    title: lab.title,
    description: lab.description,
    objective: lab.objective,
    practiceEnvironment: lab.practiceEnvironment,
    steps: lab.steps,
    recommendedTools: lab.recommendedTools,
    challengeModeHint: lab.challengeModeHint,
    allowedCommands: lab.allowedCommands,
    tips: lab.tips,
  }));

export const runLabCommand = async ({ labId, command }) => {
  const lab = labs[labId];
  if (!lab) {
    return {
      ok: false,
      code: "lab_not_found",
      output: "This lab is not available right now.",
      mentorHint: "Requested lab definition was not found in sandbox registry.",
      fixSteps: [
        "Reload the lab page to refresh available modules.",
        "Select an available module from Practice Modules.",
        "Restart with the suggested `help` command.",
      ],
    };
  }
  const normalized = String(command || "").trim().replace(/\s+/g, " ");

  if (normalized === "help" && env.labDockerEnabled) {
    const allowedBins = env.labAllowedBins?.length ? env.labAllowedBins : ["nmap", "curl", "dig", "nslookup", "whois", "traceroute", "ping", "openssl", "nc", "host", "wget"];
    const allowlist = [
      ...(env.labAllowlistHosts || []).map((host) => `host:${host}`),
      ...(env.labAllowlistCidrs || []).map((cidr) => `cidr:${cidr}`),
    ];
    return {
      ok: true,
      code: "ok",
      output: `${lab.outputs.help}\n\nLive sandbox enabled.\nAllowed tools: ${allowedBins.join(", ")}\nAllowlist: ${allowlist.length ? allowlist.join(", ") : "not configured"}`,
      tips: lab.tips,
    };
  }

  if (lab.outputs[normalized]) {
    return {
      ok: true,
      code: normalized === "complete" ? "completed" : "ok",
      output: lab.outputs[normalized] || "Command executed.",
      tips: lab.tips,
    };
  }

  if (env.labDockerEnabled) {
    const live = await runDockerSandboxCommand(normalized);
    if (live.ok) {
      return {
        ok: true,
        code: "ok",
        output: live.output,
        tips: lab.tips,
      };
    }
    return {
      ok: false,
      code: live.code || "execution_failed",
      output: live.output || "Live sandbox command failed.",
      mentorHint: "Live sandbox blocked the request or target is not allowlisted.",
      fixSteps: [
        "Confirm the command uses an allowed tool (run `help`).",
        "Confirm the target is in LAB_ALLOWLIST_HOSTS or LAB_ALLOWLIST_CIDRS.",
        "Retry with a single command and explicit target.",
      ],
      tips: lab.tips,
    };
  }

  if (!lab.allowedCommands.includes(normalized)) {
    const preview = lab.allowedCommands.slice(0, 6);
    const suggestion =
      lab.allowedCommands.find((item) => item.startsWith(normalized)) ||
      lab.allowedCommands.find((item) => item.includes(normalized)) ||
      "help";
    return {
      ok: false,
      code: "command_not_allowed",
      output: `That command isn't in this lab's allowlist. Try: ${preview.join(", ")}${lab.allowedCommands.length > preview.length ? " ..." : ""}`,
      mentorHint: `Allowed commands: ${lab.allowedCommands.join(", ")}. Try: ${suggestion}`,
      fixSteps: [
        "Use `help` to list valid commands for this module.",
        "Pick the next command from the Objective -> Task flow.",
        "Re-run command sequence in order until completion.",
      ],
      tips: lab.tips,
    };
  }

  return {
    ok: true,
    code: normalized === "complete" ? "completed" : "ok",
    output: lab.outputs[normalized] || "Command executed.",
    tips: lab.tips,
  };
};
