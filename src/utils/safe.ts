import { safeArray, safeFilter, safeForEach, safeMap, safeReduce } from "@/utils/safeData";

/**
 * Safe data and property helpers for runtime stability.
 *
 * Use these when values may come from API payloads, local storage, or any
 * optional object path that could be null/undefined.
 */

export { safeArray, safeMap, safeFilter, safeForEach, safeReduce };

export const safeString = (value: unknown, fallback = ""): string => {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
};

export const safeTitle = (value: unknown, fallback = "Untitled"): string => {
  const title = safeString(value).trim();
  return title || fallback;
};

export const safeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

export const safeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
};

export const safeObject = <T extends object>(value: unknown, fallback: T): T => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
  return fallback;
};

export const safeLower = (value: unknown): string => safeString(value).toLowerCase();
