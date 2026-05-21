import { domainToASCII } from "node:url";

const NO_DATA_FOUND = "No data found";
const RFC_EMAIL_PATTERN =
  /^(?:"(?:[\x20-\x21\x23-\x5b\x5d-\x7e]|\\[\x20-\x7e])*"|[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

const COMMON_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "fastmail.com",
]);

const IPV4_PRIVATE_RANGES = [
  ["10.0.0.0", "10.255.255.255", "Private network"],
  ["172.16.0.0", "172.31.255.255", "Private network"],
  ["192.168.0.0", "192.168.255.255", "Private network"],
  ["127.0.0.0", "127.255.255.255", "Loopback"],
  ["169.254.0.0", "169.254.255.255", "Link-local"],
  ["100.64.0.0", "100.127.255.255", "Carrier-grade NAT"],
  ["192.0.2.0", "192.0.2.255", "Documentation range"],
  ["198.51.100.0", "198.51.100.255", "Documentation range"],
  ["203.0.113.0", "203.0.113.255", "Documentation range"],
  ["224.0.0.0", "239.255.255.255", "Multicast"],
  ["240.0.0.0", "255.255.255.255", "Reserved"],
];

const safeString = (value = "") => String(value || "").trim();

const isValidDomainLabel = (label = "") =>
  Boolean(label) &&
  label.length <= 63 &&
  /^[a-z0-9-]+$/i.test(label) &&
  !label.startsWith("-") &&
  !label.endsWith("-");

export const noDataFound = () => NO_DATA_FOUND;

export const normalizeDomain = (input = "") => {
  const raw = safeString(input)
    .replace(/^[a-z]+:\/\//i, "")
    .split(/[/?#]/, 1)[0]
    .replace(/\.+$/, "");

  if (!raw) return "";

  const ascii = domainToASCII(raw.toLowerCase());
  if (!ascii || ascii.length > 253) return "";

  const labels = ascii.split(".");
  if (labels.length < 2 || labels.some((label) => !isValidDomainLabel(label))) return "";

  return ascii;
};

export const extractDomainFromEmail = (email = "") => {
  const value = safeString(email);
  const atIndex = value.lastIndexOf("@");
  if (atIndex <= 0) return "";
  return normalizeDomain(value.slice(atIndex + 1));
};

export const validateEmailFormat = (input = "") => {
  const email = safeString(input);
  if (!email || email.length > 254) return false;
  const [localPart = ""] = email.split("@");
  if (!localPart || localPart.length > 64 || email.includes("..")) return false;
  return RFC_EMAIL_PATTERN.test(email);
};

export const isCommonEmailProvider = (domain = "") => COMMON_EMAIL_PROVIDERS.has(normalizeDomain(domain));

export const calculateEmailRisk = ({
  formatValid = false,
  domainExists = false,
  hasMx = false,
  commonProvider = false,
} = {}) => {
  if (!formatValid) return "high";
  if (commonProvider || hasMx) return "low";
  if (domainExists) return "medium";
  return "high";
};

const ipv4ToInt = (ip = "") =>
  ip.split(".").reduce((acc, part) => {
    const octet = Number(part);
    return Number.isInteger(octet) ? acc * 256 + octet : NaN;
  }, 0);

const inIpv4Range = (ip, start, end) => {
  const value = ipv4ToInt(ip);
  return value >= ipv4ToInt(start) && value <= ipv4ToInt(end);
};

export const detectIpRegion = (ip = "", ipVersion = 0) => {
  if (ipVersion === 4) {
    for (const [start, end, label] of IPV4_PRIVATE_RANGES) {
      if (inIpv4Range(ip, start, end)) return label;
    }
    return NO_DATA_FOUND;
  }

  const normalized = safeString(ip).toLowerCase();
  if (ipVersion === 6) {
    if (normalized === "::1") return "Loopback";
    if (normalized.startsWith("fe80:")) return "Link-local";
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return "Private network";
    if (normalized.startsWith("ff")) return "Multicast";
    if (normalized.startsWith("2001:db8:")) return "Documentation range";
  }

  return NO_DATA_FOUND;
};

const matchWhoisField = (raw = "", patterns = []) => {
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return safeString(match[1]);
  }
  return "";
};

const parseDate = (value = "") => {
  const candidate = safeString(value);
  if (!candidate) return "";
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

export const parseWhoisText = (raw = "") => {
  const text = String(raw || "");
  const registrar = matchWhoisField(text, [/^\s*Registrar:\s*(.+)$/im, /^\s*Sponsoring Registrar:\s*(.+)$/im]);
  const referralServer = matchWhoisField(text, [/^\s*(?:Whois Server|ReferralServer|refer):\s*(.+)$/im]);
  const creationDate = parseDate(
    matchWhoisField(text, [
      /^\s*Creation Date:\s*(.+)$/im,
      /^\s*Created On:\s*(.+)$/im,
      /^\s*Registered On:\s*(.+)$/im,
      /^\s*Registration Time:\s*(.+)$/im,
    ])
  );
  const updatedDate = parseDate(
    matchWhoisField(text, [
      /^\s*Updated Date:\s*(.+)$/im,
      /^\s*Last Updated On:\s*(.+)$/im,
      /^\s*Changed:\s*(.+)$/im,
      /^\s*Last Modified:\s*(.+)$/im,
    ])
  );
  const expiryDate = parseDate(
    matchWhoisField(text, [
      /^\s*Registry Expiry Date:\s*(.+)$/im,
      /^\s*Registrar Registration Expiration Date:\s*(.+)$/im,
      /^\s*Expiration Date:\s*(.+)$/im,
      /^\s*Expiry Date:\s*(.+)$/im,
      /^\s*Paid-till:\s*(.+)$/im,
    ])
  );

  return {
    registrar: registrar || NO_DATA_FOUND,
    creationDate: creationDate || NO_DATA_FOUND,
    updatedDate: updatedDate || NO_DATA_FOUND,
    expiryDate: expiryDate || NO_DATA_FOUND,
    referralServer: referralServer || NO_DATA_FOUND,
  };
};

export const computeDomainAgeDays = (creationDate = "") => {
  if (!creationDate || creationDate === NO_DATA_FOUND) return NO_DATA_FOUND;
  const parsed = new Date(creationDate);
  if (Number.isNaN(parsed.getTime())) return NO_DATA_FOUND;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
};
