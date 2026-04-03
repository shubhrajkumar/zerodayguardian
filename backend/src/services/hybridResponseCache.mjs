const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const CACHE = new Map();
const IN_FLIGHT = new Map();

const normalize = (value = "", max = 400) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, max);

const cacheKey = ({ messages = [], topic = null } = {}) => {
  const lastUser = [...messages].reverse().find((message) => message?.role === "user")?.content || "";
  return [normalize(topic?.title || "", 80), normalize(lastUser, 320)].filter(Boolean).join("::");
};

const prune = () => {
  while (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (!oldest) return;
    CACHE.delete(oldest);
  }
};

export const getHybridCachedResponse = ({ payload = {} } = {}) => {
  const key = cacheKey(payload);
  if (!key) return "";
  const hit = CACHE.get(key);
  if (!hit) return "";
  if (Date.now() - Number(hit.createdAt || 0) > CACHE_TTL_MS) {
    CACHE.delete(key);
    return "";
  }
  return String(hit.text || "").trim();
};

export const setHybridCachedResponse = ({ payload = {}, text = "" } = {}) => {
  const key = cacheKey(payload);
  const value = String(text || "").trim();
  if (!key || !value) return;
  CACHE.set(key, { text: value, createdAt: Date.now() });
  prune();
};

export const withHybridInFlightResponse = async ({ payload = {}, factory } = {}) => {
  const key = cacheKey(payload);
  if (!key || typeof factory !== "function") {
    return typeof factory === "function" ? factory() : "";
  }
  const existing = IN_FLIGHT.get(key);
  if (existing) return existing;
  const pending = Promise.resolve()
    .then(() => factory())
    .finally(() => {
      if (IN_FLIGHT.get(key) === pending) {
        IN_FLIGHT.delete(key);
      }
    });
  IN_FLIGHT.set(key, pending);
  return pending;
};
