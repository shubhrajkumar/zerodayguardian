import { Router } from "express";
import rateLimit from "express-rate-limit";

const router = Router();

const CRT_SH_URL = "https://crt.sh";

const subdomainRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      code: "subdomain_rate_limited",
      error: "Too many subdomain lookups. Please wait and retry.",
    });
  },
});

router.get("/", subdomainRateLimit, async (req, res) => {
  try {
    let domain = String(req.query.domain || "").trim().toLowerCase();

    if (!domain) {
      return res.status(400).json({
        status: "error",
        code: "missing_domain",
        error: "Domain is required.",
      });
    }

    // Normalize: strip protocol, www., trailing paths
    domain = domain
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "")
      .replace(/\s/g, "");

    if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return res.status(400).json({
        status: "error",
        code: "invalid_domain",
        error: "Domain must be a valid hostname (e.g., example.com).",
      });
    }

    const apiUrl = `${CRT_SH_URL}/?q=%25.${encodeURIComponent(domain)}&output=json`;

    const apiRes = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ZeroDayGuardian/1.0 (security research tool)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!apiRes.ok) {
      return res.status(502).json({
        status: "error",
        code: "upstream_failed",
        error: "Certificate Transparency log lookup failed. Try again later.",
      });
    }

    const text = await apiRes.text();

    // crt.sh sometimes returns an empty body or non-JSON for rate limiting
    if (!text || text.trim().length === 0) {
      return res.json({
        status: "ok",
        domain,
        subdomains: [],
        total: 0,
        message: "No certificate entries found for this domain.",
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.json({
        status: "ok",
        domain,
        subdomains: [],
        total: 0,
        message: "Certificate Transparency log returned unexpected data.",
      });
    }

    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        status: "ok",
        domain,
        subdomains: [],
        total: 0,
        message: "No certificate entries found for this domain.",
      });
    }

    // Extract unique subdomains from name_value and common_name fields
    const subdomainSet = new Set();

    for (const entry of data) {
      const raw = entry.name_value || entry.common_name || "";
      // name_value can contain multiple values separated by newlines
      const names = raw.split(/\n/);
      for (const name of names) {
        const clean = name.trim().toLowerCase();
        if (clean && clean.endsWith(`.${domain}`) || clean === domain) {
          subdomainSet.add(clean);
        }
      }
    }

    const subdomains = Array.from(subdomainSet).sort();

    res.json({
      status: "ok",
      domain,
      total: subdomains.length,
      subdomains,
    });
  } catch (error) {
    if (error.name === "AbortError" || error.code === "UND_ERR_ABORTED") {
      return res.status(504).json({
        status: "error",
        code: "upstream_timeout",
        error: "Certificate Transparency log timed out. Try again later.",
      });
    }
    res.status(500).json({
      status: "error",
      code: "subdomain_failed",
      error: "Subdomain lookup failed. Check the domain and try again.",
    });
  }
});

export default router;
