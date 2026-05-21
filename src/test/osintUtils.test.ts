import { describe, expect, it } from "vitest";
import * as osintUtils from "../../backend/src/services/osintUtils.mjs";

const {
  calculateEmailRisk,
  computeDomainAgeDays,
  detectIpRegion,
  extractDomainFromEmail,
  normalizeDomain,
  parseWhoisText,
  validateEmailFormat,
} = osintUtils as {
  calculateEmailRisk: (...args: unknown[]) => unknown;
  computeDomainAgeDays: (...args: unknown[]) => unknown;
  detectIpRegion: (...args: unknown[]) => unknown;
  extractDomainFromEmail: (...args: unknown[]) => unknown;
  normalizeDomain: (...args: unknown[]) => unknown;
  parseWhoisText: (...args: unknown[]) => unknown;
  validateEmailFormat: (...args: unknown[]) => unknown;
};

describe("osintUtils", () => {
  it("validates RFC-style email formats conservatively", () => {
    expect(validateEmailFormat("analyst@example.com")).toBe(true);
    expect(validateEmailFormat("bad..dots@example.com")).toBe(false);
    expect(validateEmailFormat("missing-at.example.com")).toBe(false);
  });

  it("normalizes domains and extracts domains from email", () => {
    expect(normalizeDomain("https://Example.COM/path")).toBe("example.com");
    expect(extractDomainFromEmail("analyst@Example.COM")).toBe("example.com");
    expect(normalizeDomain("not a domain")).toBe("");
  });

  it("calculates email risk from verified signals only", () => {
    expect(calculateEmailRisk({ formatValid: false, domainExists: false, hasMx: false, commonProvider: false })).toBe("high");
    expect(calculateEmailRisk({ formatValid: true, domainExists: true, hasMx: false, commonProvider: false })).toBe("medium");
    expect(calculateEmailRisk({ formatValid: true, domainExists: true, hasMx: true, commonProvider: false })).toBe("low");
  });

  it("classifies local and reserved IP ranges without guessing public geo", () => {
    expect(detectIpRegion("192.168.1.10", 4)).toBe("Private network");
    expect(detectIpRegion("127.0.0.1", 4)).toBe("Loopback");
    expect(detectIpRegion("8.8.8.8", 4)).toBe("No data found");
  });

  it("parses whois text and computes domain age when creation date is available", () => {
    const parsed = parseWhoisText(`
      Registrar: Example Registrar
      Creation Date: 2020-01-02T00:00:00Z
      Updated Date: 2024-01-02T00:00:00Z
      Registry Expiry Date: 2030-01-02T00:00:00Z
      Whois Server: whois.example.test
    `) as any;

    expect(parsed.registrar).toBe("Example Registrar");
    expect(parsed.creationDate).toBe("2020-01-02T00:00:00.000Z");
    expect(parsed.referralServer).toBe("whois.example.test");
    expect(typeof computeDomainAgeDays(parsed.creationDate)).toBe("number");
  });
});
