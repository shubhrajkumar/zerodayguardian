const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SUSPICIOUS_PATTERN =
  /(<script\b|javascript:|onerror\s*=|onload\s*=|\bunion\s+select\b|\bdrop\s+table\b|\binsert\s+into\b|\bdelete\s+from\b|\$\{jndi:)/i;
const PROTOTYPE_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_URL_LENGTH = 2048;
const MAX_QUERY_KEYS = 40;
const MAX_TOTAL_KEYS = 250;
const MAX_DEPTH = 8;
const MAX_STRING_LENGTH = 4000;
const ALLOWED_MUTATION_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
];

const createSecurityError = (status, code, error) => ({
  status,
  body: {
    status: "error",
    code,
    error,
  },
});

const walk = (value, state, path = "body", depth = 0) => {
  if (depth > MAX_DEPTH) {
    return createSecurityError(400, "payload_too_deep", "Payload nesting is too deep.");
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      return createSecurityError(400, "field_too_large", `Field '${path}' is too large.`);
    }
    if (SUSPICIOUS_PATTERN.test(value)) {
      return createSecurityError(400, "payload_blocked", "Request blocked by security policy.");
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const issue = walk(value[index], state, `${path}[${index}]`, depth + 1);
      if (issue) return issue;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  for (const [key, nested] of Object.entries(value)) {
    state.keyCount += 1;
    if (state.keyCount > MAX_TOTAL_KEYS) {
      return createSecurityError(400, "payload_too_large", "Payload contains too many fields.");
    }
    if (PROTOTYPE_KEYS.has(String(key))) {
      return createSecurityError(400, "payload_blocked", "Request blocked by security policy.");
    }
    const issue = walk(nested, state, path === "body" ? key : `${path}.${key}`, depth + 1);
    if (issue) return issue;
  }

  return null;
};

export const requestGuard = (req, res, next) => {
  if (String(req.originalUrl || req.url || "").length > MAX_URL_LENGTH) {
    res.status(414).json({
      status: "error",
      code: "url_too_long",
      error: "Request URL is too long.",
      requestId: req.requestId || "",
    });
    return;
  }

  if (req.query && typeof req.query === "object" && Object.keys(req.query).length > MAX_QUERY_KEYS) {
    res.status(400).json({
      status: "error",
      code: "too_many_query_params",
      error: "Too many query parameters.",
      requestId: req.requestId || "",
    });
    return;
  }

  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType && !ALLOWED_MUTATION_CONTENT_TYPES.some((allowed) => contentType.includes(allowed))) {
    res.status(415).json({
      status: "error",
      code: "unsupported_content_type",
      error: "Request content type is not allowed.",
      requestId: req.requestId || "",
    });
    return;
  }

  const issue = walk(req.body, { keyCount: 0 });
  if (issue) {
    res.status(issue.status).json({
      ...issue.body,
      requestId: req.requestId || "",
    });
    return;
  }

  next();
};
