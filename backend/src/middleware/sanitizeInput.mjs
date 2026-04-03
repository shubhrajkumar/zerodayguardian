import { sanitizeText } from "../utils/security.mjs";

const cleanValue = (value) => {
  if (typeof value === "string") return sanitizeText(value);
  if (Array.isArray(value)) return value.map((entry) => cleanValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cleanValue(entry)]));
  }
  return value;
};

export const sanitizeInput = (req, _res, next) => {
  if (req.body && typeof req.body === "object") req.body = cleanValue(req.body);
  if (req.query && typeof req.query === "object") req.query = cleanValue(req.query);
  next();
};

