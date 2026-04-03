import { env } from "../config/env.mjs";

const matchesSecret = (candidate, expected) =>
  typeof candidate === "string" &&
  typeof expected === "string" &&
  candidate.length > 0 &&
  expected.length > 0 &&
  candidate === expected;

export const allowOpsAccess = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin") {
    next();
    return;
  }

  const provided = req.headers["x-ops-secret"];
  if (matchesSecret(provided, env.llmOpsSecret) || matchesSecret(provided, env.healthcheckSecret)) {
    next();
    return;
  }

  res.status(403).json({ error: "Forbidden" });
};

