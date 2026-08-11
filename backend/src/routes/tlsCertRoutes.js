/**
 * tlsCertRoutes.js — GET /api/tools/tlscert
 *
 * Connects to target host:port via TLS, retrieves the server's
 * X.509 certificate chain, and returns parsed details.
 *
 * Uses Node.js built-in `tls` module — no external dependencies.
 */
import { Router } from "express";
import tls from "node:tls";
import rateLimit from "express-rate-limit";

const router = Router();

const tlsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "unknown",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      status: "error",
      code: "tls_rate_limited",
      error: "Too many TLS certificate requests. Please wait and retry.",
    });
  },
});

// Block private/internal hosts (SSRF protection)
const isBlockedHost = (hostname) => {
  const h = hostname.toLowerCase();
  if (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h === "::1"
  )
    return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(h))
    return true;
  return false;
};

// Format a certificate object into a clean plain object (no recursion issues)
const formatCert = (cert) => {
  if (!cert || !cert.subject) return null;
  return {
    subject: cert.subject || {},
    subjectAltName: cert.subjectaltname || null,
    issuer: cert.issuer || {},
    validity: {
      from: cert.valid_from || null,
      to: cert.valid_to || null,
    },
    serialNumber: cert.serialNumber || null,
    fingerprint: cert.fingerprint || null,
    fingerprint256: cert.fingerprint256 || null,
    modulus: cert.modulus || null,
    bits: cert.bits || null,
    keyAlgorithm: cert.pubkeyAlgorithm || null,
    signatureAlgorithm: cert.signatureAlgorithm || null,
    issuerCertificate: null, // will be populated recursively
  };
};

// Build the certificate chain recursively (up to 10 levels deep)
const buildChain = (cert, depth = 0, maxDepth = 10) => {
  if (!cert || !cert.subject || depth >= maxDepth) return [];
  const formatted = formatCert(cert);
  if (!formatted) return [];
  if (cert.issuerCertificate && cert.issuerCertificate !== cert) {
    const rest = buildChain(cert.issuerCertificate, depth + 1, maxDepth);
    return [formatted, ...rest];
  }
  return [formatted];
};

// Extract SANs from subjectaltname string into an array
const parseSans = (subjectaltname) => {
  if (!subjectaltname) return [];
  const entries = subjectaltname.split(", ");
  const dns = [];
  const ips = [];
  const emails = [];
  for (const entry of entries) {
    if (entry.startsWith("DNS:")) dns.push(entry.slice(4));
    else if (entry.startsWith("IP Address:")) ips.push(entry.slice(11));
    else if (entry.startsWith("email:")) emails.push(entry.slice(6));
  }
  return { dns, ips, emails, raw: entries };
};

// Determine key usage from the certificate object
const getKeyUsage = (cert) => {
  if (!cert) return [];
  const usage = [];
  if (cert.ext_key_usage) {
    usage.push(...cert.ext_key_usage.split(", "));
  }
  return usage;
};

router.get("/", tlsRateLimit, async (req, res) => {
  try {
    let host = String(req.query.host || "").trim();
    const port = Math.max(1, Math.min(65535, Number(req.query.port) || 443));

    if (!host) {
      return res.status(400).json({
        status: "error",
        code: "missing_host",
        error: "Host is required.",
      });
    }

    // Strip protocol and paths
    host = host
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/\\s/g, "");

    // Basic hostname validation
    if (!host || host.length < 1 || host.length > 253) {
      return res.status(400).json({
        status: "error",
        code: "invalid_host",
        error: "Host must be a valid domain name or IP address.",
      });
    }

    // SSRF protection
    if (isBlockedHost(host)) {
      return res.status(400).json({
        status: "error",
        code: "blocked_host",
        error: "Internal and private hosts are not allowed.",
      });
    }

    const certInfo = await new Promise((resolve, reject) => {
      const socket = tls.connect(
        port,
        host,
        {
          servername: host,
          rejectUnauthorized: false,
          timeout: 10000,
        },
        () => {
          // Get full certificate chain
          const cert = socket.getPeerCertificate(true);

          if (!cert || !cert.subject) {
            socket.destroy();
            reject(new Error("No certificate presented by server"));
            return;
          }

          const chain = buildChain(cert);
          const leaf = chain[0];

          const subjectAltNames = parseSans(cert.subjectaltname);
          const keyUsage = getKeyUsage(cert);

          // Check if authorized
          const authorized = socket.authorized;

          // Calculate days until expiry
          let daysRemaining = null;
          let expired = false;
          if (leaf?.validity?.to) {
            const expiryDate = new Date(leaf.validity.to);
            const now = new Date();
            expired = expiryDate < now;
            if (!expired) {
              daysRemaining = Math.ceil(
                (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              );
            }
          }

          socket.end();

          resolve({
            host,
            port,
            authorized,
            authorizationError: socket.authorizationError || null,
            protocol: cert.subject?.CN ? "TLS" : null,
            leaf: {
              subject: leaf?.subject || {},
              issuer: leaf?.issuer || {},
              validity: leaf?.validity || {},
              serialNumber: leaf?.serialNumber || null,
              fingerprint: leaf?.fingerprint || null,
              fingerprint256: leaf?.fingerprint256 || null,
              subjectAltNames,
              keyAlgorithm: leaf?.keyAlgorithm || null,
              signatureAlgorithm: leaf?.signatureAlgorithm || null,
              keyUsage,
              modulusBits: leaf?.bits || null,
              expired,
              daysRemaining,
            },
            chain: chain.map((c) => ({
              subject: c.subject,
              issuer: c.issuer,
              validity: c.validity,
              serialNumber: c.serialNumber,
              fingerprint: c.fingerprint,
              subjectAltName: c.subjectAltName,
            })),
            chainLength: chain.length,
          });
        }
      );

      socket.on("error", (err) => {
        socket.destroy();
        reject(err);
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("connection_timeout"));
      });
    });

    res.json({
      status: "ok",
      ...certInfo,
    });
  } catch (error) {
    const err = error || {};
    if (err.message === "connection_timeout") {
      return res.status(504).json({
        status: "error",
        code: "tls_timeout",
        error: "Connection to host timed out. The host may not be responding or the port may be filtered.",
      });
    }
    if (err.message === "No certificate presented by server") {
      return res.status(502).json({
        status: "error",
        code: "no_certificate",
        error: "The server did not present a TLS certificate. The host may not be running HTTPS.",
      });
    }
    if (
      err.code === "ENOTFOUND" ||
      err.code === "EAI_AGAIN"
    ) {
      return res.status(502).json({
        status: "error",
        code: "dns_failed",
        error: "Could not resolve the hostname. Check the spelling and try again.",
      });
    }
    if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
      return res.status(502).json({
        status: "error",
        code: "connection_failed",
        error: `Connection refused on port ${req.query.port || 443}. The host may not have this port open.`,
      });
    }
    if (err.code === "CERT_HAS_EXPIRED") {
      // Still try to return the certificate even if expired
      return res.status(200).json({
        status: "ok",
        host: req.query.host || "",
        port: Number(req.query.port) || 443,
        authorized: false,
        authorizationError: "Certificate has expired",
        note: "Certificate has expired but data is returned for analysis.",
        leaf: {
          validity: {
            from: null,
            to: null,
          },
          expired: true,
        },
      });
    }
    return res.status(500).json({
      status: "error",
      code: "tls_failed",
      error: "Certificate analysis failed. Check the host and try again.",
    });
  }
});

export default router;
