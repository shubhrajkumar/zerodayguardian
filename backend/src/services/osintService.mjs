import dns from "node:dns/promises";
import net from "node:net";
import { parseWhoisText, normalizeDomain, extractDomainFromEmail, validateEmailFormat, noDataFound } from "./osintUtils.mjs";
import { computeOsintInsight } from "./osintInsights.mjs";
import { TtlCache } from "../utils/ttlCache.mjs";

const DNS_TIMEOUT_MS = 650;
const WHOIS_TIMEOUT_MS = 950;
const RDAP_TIMEOUT_MS = 900;
const RETRY_ATTEMPTS = 1;
const NO_VERIFIED_DATA = "No verified data.";
const DNS_PROVIDER = "node:dns";
const WHOIS_PROVIDER = "whois+rdap";
const LOCAL_PROVIDER = "local";
const dnsCache = new TtlCache({ ttlMs: 5 * 60_000, maxEntries: 400 });
const whoisCache = new TtlCache({ ttlMs: 15 * 60_000, maxEntries: 300 });
const reverseDnsCache = new TtlCache({ ttlMs: 5 * 60_000, maxEntries: 300 });

const unsupportedModule = (module) => ({
  status: "unavailable",
  provider: LOCAL_PROVIDER,
  data: null,
  message: module ? `${module} is not available from verified local sources.` : NO_VERIFIED_DATA,
});

const buildModule = ({ status, provider, data = null, message = "" }) => ({
  status,
  provider,
  data,
  ...(message ? { message } : {}),
});

const withTimeout = (promise, timeoutMs, code = "timeout") =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(code);
        error.code = code;
        reject(error);
      }, timeoutMs);
      promise.finally(() => clearTimeout(timer)).catch(() => clearTimeout(timer));
    }),
  ]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (operation, { retries = RETRY_ATTEMPTS, delayMs = 80 } = {}) => {
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
      await sleep(delayMs * (attempt + 1));
      attempt += 1;
    }
  }
  throw lastError;
};

const getCached = async (cache, key, factory) => {
  return cache.getOrCreate(key, factory);
};

const resolveSafely = async (resolver) => {
  try {
    const value = await withRetry(() => withTimeout(resolver(), DNS_TIMEOUT_MS, "dns_timeout"));
    if (Array.isArray(value)) return value;
    return value ? [value] : [];
  } catch {
    return [];
  }
};

const normalizeMxRecords = (records = []) =>
  records
    .map((record) => ({
      exchange: String(record?.exchange || "").replace(/\.$/, ""),
      priority: Number(record?.priority ?? 0),
    }))
    .filter((record) => record.exchange);

const resolveDomainDns = async (domain) =>
  getCached(dnsCache, `dns:${domain}`, async () => {
    const [aRecords, mxRecords, nsRecords] = await Promise.all([
      resolveSafely(() => dns.resolve4(domain)),
      resolveSafely(() => dns.resolveMx(domain)),
      resolveSafely(() => dns.resolveNs(domain)),
    ]);

    const normalizedMx = normalizeMxRecords(mxRecords);
    const exists = Boolean(aRecords.length || normalizedMx.length || nsRecords.length);

    return {
      exists,
      aRecords: aRecords.map((value) => String(value)),
      mxRecords: normalizedMx,
      nsRecords: nsRecords.map((value) => String(value).replace(/\.$/, "")),
    };
  });

const queryWhoisServer = (server, query, timeoutMs = WHOIS_TIMEOUT_MS) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let response = "";
    const socket = net.createConnection({ host: server, port: 43 });

    const finish = (error, value = "") => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    socket.setEncoding("utf8");
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.write(`${query}\r\n`);
    });
    socket.on("data", (chunk) => {
      response += String(chunk || "");
    });
    socket.on("end", () => finish(null, response));
    socket.on("close", () => finish(null, response));
    socket.on("timeout", () => {
      const error = new Error("whois_timeout");
      error.code = "whois_timeout";
      finish(error);
    });
    socket.on("error", (error) => finish(error));
  });

const findWhoisServer = async (domain) => {
  const tld = domain.split(".").pop();
  if (!tld) return "";
  try {
    const ianaResponse = await withRetry(
      () => withTimeout(queryWhoisServer("whois.iana.org", tld), WHOIS_TIMEOUT_MS, "whois_server_timeout")
    );
    const lines = String(ianaResponse || "").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^(?:refer|whois):\s*(\S+)/i);
      if (match?.[1]) return match[1].trim();
    }
  } catch {
    // ignore and fall back below
  }
  const fallback = {
    com: "whois.verisign-grs.com",
    net: "whois.verisign-grs.com",
    org: "whois.pir.org",
    io: "whois.nic.io",
    info: "whois.afilias.net",
  };
  return fallback[tld] || "";
};

const lookupRdap = async (domain) => {
  try {
    const response = await withRetry(
      () => withTimeout(fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`), RDAP_TIMEOUT_MS, "rdap_timeout")
    );
    if (!response.ok) return null;
    const payload = await response.json();
    let registrar = "";
    const entities = Array.isArray(payload?.entities) ? payload.entities : [];
    for (const entity of entities) {
      const roles = Array.isArray(entity?.roles) ? entity.roles : [];
      if (roles.includes("registrar")) {
        registrar = String(entity?.handle || "").trim();
        break;
      }
    }
    let creationDate = "";
    let updatedDate = "";
    let expiryDate = "";
    const events = Array.isArray(payload?.events) ? payload.events : [];
    for (const event of events) {
      const action = String(event?.eventAction || "").toLowerCase();
      const eventDate = String(event?.eventDate || "").trim();
      if (action === "registration" && !creationDate) creationDate = eventDate;
      if (action.includes("last") && !updatedDate) updatedDate = eventDate;
      if (action === "expiration" && !expiryDate) expiryDate = eventDate;
    }
    if (!registrar && !creationDate && !updatedDate && !expiryDate) return null;
    return {
      available: true,
      source: "rdap",
      registrar: registrar || noDataFound(),
      creationDate: creationDate || noDataFound(),
      updatedDate: updatedDate || noDataFound(),
      expiryDate: expiryDate || noDataFound(),
      referralServer: noDataFound(),
    };
  } catch {
    return null;
  }
};

const lookupWhois = async (domain) => {
  return getCached(whoisCache, `whois:${domain}`, async () => {
    const rdap = await lookupRdap(domain);
    if (rdap) return buildModule({ status: "ok", provider: WHOIS_PROVIDER, data: rdap });

    try {
      const server = await findWhoisServer(domain);
      if (!server) {
        return buildModule({ status: "unavailable", provider: WHOIS_PROVIDER, data: null, message: NO_VERIFIED_DATA });
      }
      const raw = await withRetry(
        () => withTimeout(queryWhoisServer(server, domain), WHOIS_TIMEOUT_MS, "whois_lookup_timeout")
      );
      if (!String(raw || "").trim()) {
        return buildModule({ status: "unavailable", provider: WHOIS_PROVIDER, data: null, message: NO_VERIFIED_DATA });
      }
      const parsed = parseWhoisText(raw);
      const hasVerifiedData =
        parsed.registrar !== noDataFound() ||
        parsed.creationDate !== noDataFound() ||
        parsed.updatedDate !== noDataFound() ||
        parsed.expiryDate !== noDataFound();
      return buildModule({
        status: hasVerifiedData ? "ok" : "unavailable",
        provider: WHOIS_PROVIDER,
        data: hasVerifiedData
          ? {
            available: true,
            source: "whois",
            registrar: parsed.registrar,
            creationDate: parsed.creationDate,
            updatedDate: parsed.updatedDate,
            expiryDate: parsed.expiryDate,
            referralServer: parsed.referralServer === noDataFound() ? server : parsed.referralServer,
          }
          : null,
        message: hasVerifiedData ? "" : NO_VERIFIED_DATA,
      });
    } catch {
      return buildModule({ status: "unavailable", provider: WHOIS_PROVIDER, data: null, message: NO_VERIFIED_DATA });
    }
  });
};

const lookupReverseDns = async (ip) =>
  getCached(reverseDnsCache, `rdns:${ip}`, async () => {
    try {
      const hostnames = await withRetry(() => withTimeout(dns.reverse(ip), DNS_TIMEOUT_MS, "rdns_timeout"));
      return buildModule({
        status: hostnames.length ? "ok" : "unavailable",
        provider: DNS_PROVIDER,
        data: hostnames.length ? hostnames : null,
        message: hostnames.length ? "" : NO_VERIFIED_DATA,
      });
    } catch {
      return buildModule({
        status: "unavailable",
        provider: DNS_PROVIDER,
        data: null,
        message: NO_VERIFIED_DATA,
      });
    }
  });

const buildDnsModule = (dnsData) =>
  buildModule({
    status: dnsData.exists ? "ok" : "unavailable",
    provider: DNS_PROVIDER,
    data: dnsData.exists
      ? {
        exists: true,
        aRecords: dnsData.aRecords,
        mxRecords: dnsData.mxRecords,
        nsRecords: dnsData.nsRecords,
      }
      : null,
    message: dnsData.exists ? "" : NO_VERIFIED_DATA,
  });

const bandRisk = (score) => {
  const safeScore = Math.max(0, Math.min(100, Number(score || 0)));
  if (safeScore >= 70) return "HIGH";
  if (safeScore >= 35) return "MEDIUM";
  return "LOW";
};

const uniqueLines = (lines = [], limit = 5) => {
  const values = [];
  for (const line of lines) {
    const value = String(line || "").trim();
    if (!value || values.includes(value)) continue;
    values.push(value);
    if (values.length >= limit) break;
  }
  return values;
};

const buildRisk = ({ score = 0, reasons = [], advice = [] }) => ({
  riskScore: Math.max(0, Math.min(100, Number(score || 0))),
  riskLevel: bandRisk(score),
  riskReasons: uniqueLines(reasons, 5),
  advice: uniqueLines(advice, 4),
});

const scoreEmailRisk = ({ formatValid, domain, dnsData }) => {
  let score = 10;
  const reasons = [];
  const advice = [];

  if (!formatValid) {
    score += 55;
    reasons.push("Email format failed validation.");
    advice.push("Fix the email format before enrichment.");
  } else {
    reasons.push("Email format passed validation.");
  }

  if (!domain) {
    score += 25;
    reasons.push("Email domain could not be extracted.");
    advice.push("Use a complete mailbox address with a valid domain.");
  }

  if (!dnsData.exists) {
    score += 28;
    reasons.push("No verified DNS records were found for the email domain.");
    advice.push("Check whether the domain is active and delegated in DNS.");
  } else {
    reasons.push("DNS records were verified for the email domain.");
  }

  if (!dnsData.mxRecords.length) {
    score += 25;
    reasons.push("No MX records were verified for the email domain.");
    advice.push("Publish valid MX records for the mail domain.");
  } else {
    reasons.push("MX records were verified for the email domain.");
    score -= 12;
  }

  if (!dnsData.nsRecords.length) {
    score += 10;
    reasons.push("No NS records were verified for the email domain.");
    advice.push("Verify authoritative name servers are configured correctly.");
  } else {
    score -= 4;
  }

  if (!dnsData.aRecords.length) {
    score += 8;
    reasons.push("No A records were verified for the email domain.");
  }

  if (!advice.length) advice.push("Continue monitoring and keep MX and DNS records current.");
  return buildRisk({ score, reasons, advice });
};

const scoreDomainRisk = ({ valid, dnsData, whoisData }) => {
  let score = 12;
  const reasons = [];
  const advice = [];

  if (!valid) {
    score += 55;
    reasons.push("Domain format failed validation.");
    advice.push("Fix the domain format before running DNS checks.");
  } else {
    reasons.push("Domain format passed validation.");
  }

  if (!dnsData.exists) {
    score += 28;
    reasons.push("No verified DNS records were found for the domain.");
    advice.push("Check DNS delegation and zone publication.");
  } else {
    reasons.push("DNS records were verified for the domain.");
  }

  if (!dnsData.aRecords.length) {
    score += 12;
    reasons.push("No A records were verified.");
    advice.push("Add or verify at least one authoritative A record.");
  }
  if (!dnsData.nsRecords.length) {
    score += 18;
    reasons.push("No NS records were verified.");
    advice.push("Verify the domain has working authoritative NS records.");
  }
  if (!dnsData.mxRecords.length) {
    score += 8;
    reasons.push("No MX records were verified.");
  }

  const registrar = String(whoisData?.registrar || "").trim();
  if (!registrar || registrar === noDataFound()) {
    score += 12;
    reasons.push("WHOIS or RDAP registration data could not be verified.");
    advice.push("Confirm registration data through RDAP or registrar records.");
  } else {
    score -= 10;
    reasons.push("WHOIS or RDAP registration data was verified.");
  }

  if (!advice.length) advice.push("Continue monitoring DNS and registration records.");
  return buildRisk({ score, reasons, advice });
};

const scoreIpRisk = ({ validIp, hostname }) => {
  let score = 14;
  const reasons = [];
  const advice = [];

  if (!validIp) {
    score += 60;
    reasons.push("IP address failed validation.");
    advice.push("Use a valid IPv4 or IPv6 address.");
  } else {
    reasons.push("IP address passed validation.");
  }

  if (!hostname || hostname === noDataFound()) {
    score += 20;
    reasons.push("Reverse DNS did not return a hostname.");
    advice.push("Check whether PTR records are configured for this IP.");
  } else {
    score -= 10;
    reasons.push("Reverse DNS was verified.");
  }

  if (!advice.length) advice.push("Continue monitoring PTR and ownership records.");
  return buildRisk({ score, reasons, advice });
};

const scanDomainCore = async (input) => {
  const domain = normalizeDomain(input);
  if (!domain) {
    const risk = buildRisk({
      score: 95,
      reasons: ["Domain format failed validation.", NO_VERIFIED_DATA],
      advice: ["Fix the domain format before running OSINT checks."],
    });
    return {
      success: false,
      message: "Invalid domain input",
      data: { target: String(input || ""), valid: "invalid", dnsValidity: "invalid", ...risk },
    };
  }

  const [dnsData, whoisModule] = await Promise.all([resolveDomainDns(domain), lookupWhois(domain)]);
  const whoisData =
    whoisModule.status === "ok"
      ? whoisModule.data
      : {
        available: false,
        registrar: noDataFound(),
        creationDate: noDataFound(),
        updatedDate: noDataFound(),
        expiryDate: noDataFound(),
        referralServer: noDataFound(),
      };

  const risk = scoreDomainRisk({ valid: true, dnsData, whoisData });
  const data = {
    target: domain,
    valid: "valid",
    dnsValidity: dnsData.exists ? "valid" : "invalid",
    dnsRecords: {
      a: dnsData.aRecords,
      mx: dnsData.mxRecords,
      ns: dnsData.nsRecords,
    },
    whois: whoisData,
    domainAgeDays:
      typeof whoisData.creationDate === "string" && whoisData.creationDate !== noDataFound()
        ? Math.max(0, Math.floor((Date.now() - new Date(whoisData.creationDate).getTime()) / 86_400_000))
        : noDataFound(),
    ...risk,
  };

  if (!dnsData.exists && whoisModule.status !== "ok") {
    return { success: false, message: NO_VERIFIED_DATA, data };
  }
  return { success: true, data };
};

const scanEmailCore = async (input) => {
  const email = String(input || "").trim().toLowerCase();
  const formatValid = validateEmailFormat(email);
  const domain = formatValid ? extractDomainFromEmail(email) : "";

  if (!formatValid || !domain) {
    const risk = buildRisk({
      score: 95,
      reasons: ["Email format failed validation.", NO_VERIFIED_DATA],
      advice: ["Fix the email format before running OSINT checks."],
    });
    return {
      success: false,
      message: NO_VERIFIED_DATA,
      data: {
        target: email,
        valid: "invalid",
        domain: domain || noDataFound(),
        domainStatus: "invalid",
        mxRecords: [],
        ...risk,
      },
    };
  }

  const dnsData = await resolveDomainDns(domain);
  const domainStatus = dnsData.mxRecords.length ? "exists" : dnsData.exists ? "exists_no_mx" : "not_found";
  const risk = scoreEmailRisk({ formatValid, domain, dnsData });
  const data = {
    target: email,
    valid: "valid",
    domain,
    domainStatus,
    mxRecords: dnsData.mxRecords,
    dnsRecords: {
      a: dnsData.aRecords,
      mx: dnsData.mxRecords,
      ns: dnsData.nsRecords,
    },
    ...risk,
  };

  if (!dnsData.mxRecords.length) {
    return { success: false, message: NO_VERIFIED_DATA, data };
  }
  return { success: true, data };
};

const scanIpCore = async (input) => {
  const ip = String(input || "").trim();
  const ipVersion = net.isIP(ip);
  if (!ipVersion) {
    const risk = buildRisk({
      score: 95,
      reasons: ["IP address failed validation.", NO_VERIFIED_DATA],
      advice: ["Use a valid IP address before running OSINT checks."],
    });
    return {
      success: false,
      message: "Invalid IP input",
      data: { target: ip, validIp: false, hostname: noDataFound(), basicRegion: noDataFound(), ...risk },
    };
  }

  const reverseDns = await lookupReverseDns(ip);
  const hostnames = Array.isArray(reverseDns.data) ? reverseDns.data : [];
  const risk = scoreIpRisk({ validIp: true, hostname: hostnames[0] || noDataFound() });
  const data = {
    target: ip,
    validIp: true,
    hostname: hostnames[0] || noDataFound(),
    basicRegion: noDataFound(),
    ...risk,
  };

  if (!hostnames.length) {
    return { success: false, message: NO_VERIFIED_DATA, data };
  }
  return { success: true, data };
};

export const scanEmailOsint = async (email) => scanEmailCore(email);
export const scanDomainOsint = async (domain) => scanDomainCore(domain);
export const scanIpOsint = async (ip) => scanIpCore(ip);

const inferQueryType = (query = "") => {
  const value = String(query || "").trim();
  if (validateEmailFormat(value)) return "email";
  if (net.isIP(value)) return "ip";
  if (normalizeDomain(value)) return "domain";
  return "unknown";
};

export const resolveOsint = async ({ query, modules = [] }) => {
  const requestedModules = modules.length ? modules : ["whois", "dns", "rdns"];
  const startedAt = Date.now();
  const targetType = inferQueryType(query);
  const results = {};

  if (targetType === "email") {
    const emailScan = await scanEmailCore(query);
    const domain = emailScan.data?.domain && emailScan.data.domain !== noDataFound() ? emailScan.data.domain : "";
    const [dnsData, whoisModule] = await Promise.all([
      domain ? resolveDomainDns(domain) : { exists: false, aRecords: [], mxRecords: [], nsRecords: [] },
      domain ? lookupWhois(domain) : Promise.resolve(unsupportedModule("whois")),
    ]);

    results.email = buildModule({
      status: emailScan.success ? "ok" : "unavailable",
      provider: `${LOCAL_PROVIDER}+${DNS_PROVIDER}`,
      data: emailScan.data,
      message: emailScan.success ? "" : emailScan.message,
    });
    results.dns = buildDnsModule(dnsData);
    results.whois = whoisModule;
    results.rdns = unsupportedModule("rdns");
    results.asn = unsupportedModule("asn");
    results.tls = unsupportedModule("tls");
    results.geoip = unsupportedModule("geoip");
    results.breach = unsupportedModule("breach");
    results.social = unsupportedModule("social");
    results.news = unsupportedModule("news");
  } else if (targetType === "domain") {
    const domainScan = await scanDomainCore(query);
    const domain = normalizeDomain(query);
    const [dnsData, whoisModule] = await Promise.all([
      domain ? resolveDomainDns(domain) : { exists: false, aRecords: [], mxRecords: [], nsRecords: [] },
      domain ? lookupWhois(domain) : Promise.resolve(unsupportedModule("whois")),
    ]);

    results.domain = buildModule({
      status: domainScan.success ? "ok" : "unavailable",
      provider: `${DNS_PROVIDER}+${WHOIS_PROVIDER}`,
      data: domainScan.data,
      message: domainScan.success ? "" : domainScan.message,
    });
    results.dns = buildDnsModule(dnsData);
    results.whois = whoisModule;
    results.rdns = unsupportedModule("rdns");
    results.asn = unsupportedModule("asn");
    results.tls = unsupportedModule("tls");
    results.geoip = unsupportedModule("geoip");
    results.breach = unsupportedModule("breach");
    results.social = unsupportedModule("social");
    results.news = unsupportedModule("news");
  } else if (targetType === "ip") {
    const ipScan = await scanIpCore(query);
    const rdnsModule = ipScan.data?.validIp ? await lookupReverseDns(ipScan.data.target) : unsupportedModule("rdns");

    results.ip = buildModule({
      status: ipScan.success ? "ok" : "unavailable",
      provider: `${LOCAL_PROVIDER}+${DNS_PROVIDER}`,
      data: ipScan.data,
      message: ipScan.success ? "" : ipScan.message,
    });
    results.rdns = rdnsModule;
    results.dns = unsupportedModule("dns");
    results.whois = unsupportedModule("whois");
    results.asn = unsupportedModule("asn");
    results.tls = unsupportedModule("tls");
    results.geoip = unsupportedModule("geoip");
    results.breach = unsupportedModule("breach");
    results.social = unsupportedModule("social");
    results.news = unsupportedModule("news");
  } else {
    for (const module of requestedModules) results[module] = unsupportedModule(module);
  }

  const filteredResults = Object.fromEntries(
    Object.entries(results).filter(([key]) => !modules.length || requestedModules.includes(key) || ["email", "domain", "ip"].includes(key))
  );
  const availableModuleCount = Object.values(filteredResults).filter((entry) => entry?.status === "ok").length;

  return {
    status: availableModuleCount > 0 ? "ok" : "unavailable",
    query,
    targetType,
    requestedModules,
    results: filteredResults,
    meta: {
      durationMs: Math.max(1, Date.now() - startedAt),
    },
    insight: computeOsintInsight({ query, targetType, results: filteredResults }),
    errors: [],
  };
};

export const getOsintProviders = () => ({
  email: {
    provider: `${LOCAL_PROVIDER}+${DNS_PROVIDER}`,
    configured: true,
    signals: ["regex", "mx"],
  },
  domain: {
    provider: `${DNS_PROVIDER}+${WHOIS_PROVIDER}`,
    configured: true,
    signals: ["dns", "whois"],
  },
  ip: {
    provider: `${LOCAL_PROVIDER}+${DNS_PROVIDER}`,
    configured: true,
    signals: ["ip_validation", "reverse_dns"],
  },
  breach: {
    provider: LOCAL_PROVIDER,
    configured: false,
  },
  social: {
    provider: LOCAL_PROVIDER,
    configured: false,
  },
  news: {
    provider: LOCAL_PROVIDER,
    configured: false,
  },
});
