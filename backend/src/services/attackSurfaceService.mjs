const DEFAULT_TIMEOUT_MS = 9000;

const fetchJson = async (url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(`upstream_${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeDomain = (value = "") => String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];

const extractSubdomainsFromCrt = (rows = [], root = "") => {
  const set = new Set();
  for (const row of rows) {
    const name = String(row?.name_value || row?.common_name || "");
    if (!name) continue;
    name
      .split(/\s+/)
      .flatMap((part) => part.split(/\n+/))
      .forEach((host) => {
        const cleaned = host.replace(/^\*\./, "").trim().toLowerCase();
        if (cleaned && cleaned.endsWith(root)) set.add(cleaned);
      });
  }
  return [...set].slice(0, 50);
};

const resolveARecord = async (hostname) => {
  const payload = await fetchJson(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  return answers.map((row) => row?.data).filter(Boolean);
};

export const buildAttackSurface = async (target) => {
  const root = normalizeDomain(target);
  if (!root) {
    const error = new Error("Target domain required");
    error.status = 400;
    throw error;
  }
  const crtPayload = await fetchJson(`https://crt.sh/?q=${encodeURIComponent(root)}&output=json`, {}, 12000);
  const subdomains = extractSubdomainsFromCrt(Array.isArray(crtPayload) ? crtPayload : [], root);
  const nodes = [{ id: root, type: "domain" }];
  const links = [];

  const resolved = await Promise.all(
    subdomains.map(async (host) => {
      try {
        const ips = await resolveARecord(host);
        return { host, ips };
      } catch {
        return { host, ips: [] };
      }
    })
  );

  for (const entry of resolved) {
    nodes.push({ id: entry.host, type: "subdomain" });
    links.push({ source: root, target: entry.host });
    for (const ip of entry.ips) {
      const ipId = `ip:${ip}`;
      if (!nodes.find((n) => n.id === ipId)) nodes.push({ id: ipId, type: "ip", value: ip });
      links.push({ source: entry.host, target: ipId });
    }
  }

  return { root, nodes, links, subdomains };
};
