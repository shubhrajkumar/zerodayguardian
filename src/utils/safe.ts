import { safeArray, safeFilter, safeForEach, safeMap, safeReduce } from "@/utils/safeData";

/**
 * Safe data and property helpers for runtime stability.
 *
 * Use these when values may come from API payloads, local storage, or any
 * optional object path that could be null/undefined.
 */

export { safeArray, safeMap, safeFilter, safeForEach, safeReduce };

// ── Safe array (alias) ──────────────────────────────────────────────
/** Safe array - never crashes. Returns `[]` for null/undefined/non-array. */
export const safeArr = <T>(v: unknown): T[] =>
  Array.isArray(v) ? (v as T[]) : [];

// ── Safe string ─────────────────────────────────────────────────────
/** Safe string coercion with optional fallback (default ''). */
export const safeStr = (v: unknown, fallback = ""): string => {
  if (v === null || v === undefined) return fallback;
  return String(v);
};

// ── Safe number ─────────────────────────────────────────────────────
/** Safe number coercion with optional fallback (default 0). */
export const safeNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
};

// ── Safe property access ────────────────────────────────────────────
/** Safe object property access - never crashes. */
export const safeGet = (
  obj: unknown,
  key: string,
  fallback: unknown = "",
): unknown => {
  if (obj === null || obj === undefined) return fallback;
  if (typeof obj !== "object") return fallback;
  return (obj as Record<string, unknown>)[key] ?? fallback;
};

// ── Safe nested access ──────────────────────────────────────────────
/** Safe nested property access using dot-path. */
export const safeDeep = (
  obj: unknown,
  path: string,
  fallback: unknown = "",
): unknown => {
  try {
    const keys = path.split(".");
    let current: unknown = obj;
    for (const key of keys) {
      if (current === null || current === undefined) {
        return fallback;
      }
      current = (current as Record<string, unknown>)[key];
    }
    return current ?? fallback;
  } catch {
    return fallback;
  }
};

// ── Safe event detail ───────────────────────────────────────────────
/** Safely extract `.detail` from any event-like object. Returns `{}` if missing. */
export const safeEvent = (
  event: unknown,
): Record<string, unknown> => {
  if (!event || typeof event !== "object") return {};
  const e = event as Record<string, unknown>;
  return (e.detail as Record<string, unknown>) ?? {};
};

// ── Existing helpers ────────────────────────────────────────────────

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
