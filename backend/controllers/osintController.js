import { OsintQuery } from "../src/models/OsintQuery.mjs";
import { scanDomainOsint, scanEmailOsint, scanIpOsint } from "../src/services/osintService.mjs";
import { logError, logInfo } from "../src/utils/logger.mjs";

const runScan = async ({ req, res, query, modules, scanner }) => {
  try {
    logInfo("OSINT scan requested", {
      requestId: req.requestId || "",
      userId: req.user?.sub || "",
      query: String(query || ""),
      modules,
    });
    const result = await scanner(query);
    if (req.user?.sub) {
      await OsintQuery.create({
        userId: req.user.sub,
        query,
        modules,
        result,
      });
    }
    res.json(result);
  } catch (error) {
    logError("OSINT scan failed", error, {
      requestId: req.requestId || "",
      userId: req.user?.sub || "",
      query: String(query || ""),
      modules,
    });
    res.status(500).json({
      status: "error",
      code: error.code || "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
      requestId: req.requestId || "",
    });
  }
};

export const runEmailScan = async (req, res) =>
  runScan({ req, res, query: req.validatedBody.email, modules: ["email", "dns"], scanner: scanEmailOsint });

export const runDomainScan = async (req, res) =>
  runScan({ req, res, query: req.validatedBody.domain, modules: ["domain", "whois", "dns"], scanner: scanDomainOsint });

export const runIpScan = async (req, res) =>
  runScan({ req, res, query: req.validatedBody.ip, modules: ["ip", "rdns", "geoip"], scanner: scanIpOsint });
