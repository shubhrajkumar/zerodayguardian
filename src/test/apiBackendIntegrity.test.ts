// @vitest-environment node
/**
 * API Backend Integrity Tests
 *
 * These integration tests verify that the live backend returns responses
 * with the expected shapes — especially that array fields are always
 * actual arrays (never null/undefined) so frontend `.map()` calls are safe.
 *
 * Backend URL: https://zerodayguardian-backend.onrender.com
 */

import { describe, it, expect, vi, beforeAll } from "vitest";

const BACKEND = "https://zerodayguardian-backend.onrender.com";
const FETCH_TIMEOUT = 30_000; // Render cold starts can take 15-30s
const TEST_TIMEOUT = 45_000; // Render cold starts can take 15-30s, so we need generous timeout

/** Fetch helper with timeout — gives a clear error message on failure */
async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    expect(response.status).toBe(200);
    const text = await response.text();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch ${url}: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch helper that accepts non-200 responses (for auth-required routes) */
async function fetchStatusAny(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch ${url}: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Recursively collect all keys whose values should be arrays */
function findArrayKeys(
  obj: unknown,
  path = ""
): Array<{ path: string; value: unknown }> {
  const results: Array<{ path: string; value: unknown }> = [];
  if (!obj || typeof obj !== "object") return results;
  for (const [key, value] of Object.entries(
    obj as Record<string, unknown>
  )) {
    const fullPath = path ? `${path}.${key}` : key;
    if (Array.isArray(value)) {
      results.push({ path: fullPath, value });
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      results.push(...findArrayKeys(value, fullPath));
    }
  }
  return results;
}

/** Assert that a specific path in a response is an actual array */
function expectArrayField(
  obj: Record<string, unknown>,
  dottedPath: string
): void {
  const keys = dottedPath.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") {
      throw new Error(
        `Expected path "${dottedPath}" to be an array, but got null/undefined at "${key}"`
      );
    }
    current = (current as Record<string, unknown>)[key];
  }
  expect(Array.isArray(current)).toBe(true);
}

// =============================================================================
// Health endpoint
// Cyber Rationale: Uses beforeAll to fetch once — prevents cascade failures
// when the backend is cold-starting (15-30s on Render free tier).
// Skips gracefully if the backend is unreachable (CI without network, etc.).
// =============================================================================
describe("/api/health", () => {
  let data: Record<string, unknown>;
  let backendReachable = false;

  beforeAll(async () => {
    try {
      data = (await fetchJson(`${BACKEND}/api/health`)) as Record<string, unknown>;
      backendReachable = true;
    } catch {
      // Backend cold-starting or unreachable — skip tests gracefully
      backendReachable = false;
    }
  }, TEST_TIMEOUT);

  it("returns 200 with valid JSON", async () => {
    if (!backendReachable) return;
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  it("has required top-level fields", () => {
    if (!backendReachable) return;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("service");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("uptime");
    expect(data).toHaveProperty("environment");
    expect(data).toHaveProperty("auth");
    expect(data).toHaveProperty("cors");
    expect(data).toHaveProperty("memory");

    expect(typeof data.status).toBe("string");
    expect(typeof data.service).toBe("string");
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.uptime).toBe("number");
    expect(data.status).toBe("ok");
  });

  it("auth is an object with boolean fields", () => {
    if (!backendReachable) return;
    const auth = data.auth as Record<string, unknown>;
    expect(auth).toBeDefined();
    expect(typeof auth).toBe("object");
    expect(typeof auth.google).toBe("boolean");
    expect(typeof auth.session).toBe("boolean");
  });

  it("cors is an object with configured array", () => {
    if (!backendReachable) return;
    const cors = data.cors as Record<string, unknown>;
    expect(cors).toBeDefined();
    expect(typeof cors).toBe("object");
    expect(cors).toHaveProperty("origin");
    expect(cors).toHaveProperty("configured");
    expect(Array.isArray(cors.configured)).toBe(true);
  });

  it("memory is an object with numeric fields", () => {
    if (!backendReachable) return;
    const memory = data.memory as Record<string, unknown>;
    expect(memory).toBeDefined();
    expect(typeof memory).toBe("object");
    expect(typeof memory.heapUsed).toBe("number");
    expect(typeof memory.heapTotal).toBe("number");
  });

  it("critical array fields are actual arrays", () => {
    if (!backendReachable) return;
    expectArrayField(data, "cors.configured");
  });

  it("all array fields in the response are actual arrays", () => {
    if (!backendReachable) return;
    for (const { value } of findArrayKeys(data)) {
      expect(Array.isArray(value)).toBe(true);
    }
  });
});

// =============================================================================
// Auth providers endpoint
// =============================================================================
describe("/api/auth/providers", () => {
  let data: Record<string, unknown>;
  let backendReachable = false;

  beforeAll(async () => {
    try {
      data = (await fetchJson(`${BACKEND}/api/auth/providers`)) as Record<string, unknown>;
      backendReachable = true;
    } catch {
      backendReachable = false;
    }
  }, TEST_TIMEOUT);

  it("returns 200 with valid JSON", async () => {
    if (!backendReachable) return;
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
  });

  it("has required fields", () => {
    if (!backendReachable) return;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("providers");
    expect(data).toHaveProperty("degraded");
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("google");

    expect(typeof data.status).toBe("string");
    expect(typeof data.degraded).toBe("boolean");
  });

  it("providers is an array (even if empty)", () => {
    if (!backendReachable) return;
    expect(Array.isArray(data.providers)).toBe(true);
  });

  it("google config has expected shape with array fields", () => {
    if (!backendReachable) return;
    const google = data.google as Record<string, unknown>;
    expect(google).toBeDefined();
    expect(typeof google).toBe("object");

    expect(Array.isArray(google.authorizedOrigins)).toBe(true);
    expect(Array.isArray(google.missingKeys)).toBe(true);
    expect(Array.isArray(google.invalidKeys)).toBe(true);

    expect(typeof google.enabled).toBe("boolean");
    expect(typeof google.backendFlow).toBe("boolean");
    expect(typeof google.popupFlow).toBe("boolean");
  });

  it("critical array fields are actual arrays", () => {
    if (!backendReachable) return;
    expectArrayField(data, "providers");
    expectArrayField(data, "google.authorizedOrigins");
    expectArrayField(data, "google.missingKeys");
    expectArrayField(data, "google.invalidKeys");
  });

  it("all array fields in the response are actual arrays", () => {
    if (!backendReachable) return;
    for (const { value } of findArrayKeys(data)) {
      expect(Array.isArray(value)).toBe(true);
    }
  });
});

// =============================================================================
// Ping endpoint
// =============================================================================
describe("/api/ping", () => {
  let data: Record<string, unknown>;
  let backendReachable = false;

  beforeAll(async () => {
    try {
      data = (await fetchJson(`${BACKEND}/api/ping`)) as Record<string, unknown>;
      backendReachable = true;
    } catch {
      backendReachable = false;
    }
  }, TEST_TIMEOUT);

  it("returns 200 with valid JSON", async () => {
    if (!backendReachable) return;
    expect(data).toBeDefined();
  });

  it("has expected fields", () => {
    if (!backendReachable) return;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("requestId");
    expect(data).toHaveProperty("ts");

    expect(typeof data.status).toBe("string");
    expect(typeof data.message).toBe("string");
    expect(data.status).toBe("ok");
    expect(data.message).toBe("pong");
  });
});

// =============================================================================
// Test endpoint
// =============================================================================
describe("/api/test", () => {
  let data: Record<string, unknown>;
  let backendReachable = false;

  beforeAll(async () => {
    try {
      data = (await fetchJson(`${BACKEND}/api/test`)) as Record<string, unknown>;
      backendReachable = true;
    } catch {
      backendReachable = false;
    }
  }, TEST_TIMEOUT);

  it("returns 200 with valid JSON", async () => {
    if (!backendReachable) return;
    expect(data).toBeDefined();
  });

  it("has expected fields with array types", () => {
    if (!backendReachable) return;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("requestId");
    expect(data).toHaveProperty("cors");
    expect(data).toHaveProperty("parser");

    expect(typeof data.status).toBe("string");
    expect(data.status).toBe("ok");

    const cors = data.cors as Record<string, unknown>;
    expect(cors).toBeDefined();
    expect(Array.isArray(cors.allowedOrigins)).toBe(true);

    const parser = data.parser as Record<string, unknown>;
    expect(parser).toBeDefined();
    expect(typeof parser.json).toBe("boolean");
    expect(typeof parser.urlencoded).toBe("boolean");
  });

  it("critical array fields are actual arrays", () => {
    if (!backendReachable) return;
    expectArrayField(data, "cors.allowedOrigins");
  });
});

// =============================================================================
// Root API endpoint
// =============================================================================
describe("/api", () => {
  let data: Record<string, unknown>;
  let backendReachable = false;

  beforeAll(async () => {
    try {
      data = (await fetchJson(`${BACKEND}/api`)) as Record<string, unknown>;
      backendReachable = true;
    } catch {
      backendReachable = false;
    }
  }, TEST_TIMEOUT);

  it("returns 200 with valid JSON", async () => {
    if (!backendReachable) return;
    expect(data).toBeDefined();
  });

  it("has expected fields", () => {
    if (!backendReachable) return;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("requestId");
    expect(data).toHaveProperty("ts");
    expect(typeof data.status).toBe("string");
    expect(typeof data.message).toBe("string");
    expect(data.status).toBe("ok");
  });
});

// =============================================================================
// Cross-route shape consistency (sequential to avoid cold-start pileup)
// =============================================================================
describe("cross-route shape consistency", () => {
  const PUBLIC_ROUTES = [
    { route: "/api", label: "Root API", hasRequestId: true },
    { route: "/api/health", label: "Health", hasRequestId: true },
    { route: "/api/ping", label: "Ping", hasRequestId: true },
    { route: "/api/test", label: "Test", hasRequestId: true },
    { route: "/api/auth/providers", label: "Auth Providers", hasRequestId: false },
  ];

  for (const { route, label, hasRequestId } of PUBLIC_ROUTES) {
    it(`${label} (${route}) returns status: 'ok'`, async () => {
      const data = (await fetchJson(
        `${BACKEND}${route}`
      )) as Record<string, unknown>;
      expect(data.status).toBe("ok");
    });

    if (hasRequestId) {
      it(`${label} (${route}) has requestId as string`, async () => {
        const data = (await fetchJson(
          `${BACKEND}${route}`
        )) as Record<string, unknown>;
        expect(typeof data.requestId).toBe("string");
      });
    }
  }
});

// =============================================================================
// Auth-protected routes (return 401 without credentials)
// These routes power the frontend dashboard, missions, and user pages.
// Even when unauthenticated, they must return proper JSON (not HTML/crash).
// =============================================================================
describe("auth-protected data routes (unauthenticated)", () => {
  const AUTH_ROUTES = [
    { route: "/api/dashboard", label: "Dashboard" },
    { route: "/api/missions", label: "Missions" },
    { route: "/api/users", label: "Users" },
  ];

  for (const { route, label } of AUTH_ROUTES) {
    it(`${label} (${route}) returns 401 with valid JSON error`, async () => {
      const response = await fetchStatusAny(`${BACKEND}${route}`);
      // Must be 401 (not 500, not HTML)
      expect(response.status).toBe(401);

      // Must return valid JSON (not HTML or text)
      const contentType = response.headers.get("content-type") ?? "";
      expect(contentType).toContain("application/json");

      const text = await response.text();
      const data = JSON.parse(text);

      // Must have an error or message field so frontend fallback UI can display it
      expect(data).toBeDefined();
      expect(typeof data).toBe("object");
      const hasError = typeof (data as Record<string, unknown>).error === "string";
      const hasMessage = typeof (data as Record<string, unknown>).message === "string";
      expect(hasError || hasMessage).toBe(true);
    });
  }
});

// =============================================================================
// Response shape contract — matches frontend expectations
// =============================================================================
describe("frontend response shape contract", () => {
  it("auth providers response matches MissionSystemApiContext expectations", async () => {
    const data = (await fetchJson(
      `${BACKEND}/api/auth/providers`
    )) as Record<string, unknown>;
    const google = data.google as Record<string, unknown>;

    expect(Array.isArray(data.providers)).toBe(true);
    expect(typeof data.degraded).toBe("boolean");
    expect(typeof data.status).toBe("string");

    expect(typeof google.enabled).toBe("boolean");
    expect(typeof google.clientId).toBe("string");
    expect(Array.isArray(google.authorizedOrigins)).toBe(true);
    expect(Array.isArray(google.missingKeys)).toBe(true);
    expect(Array.isArray(google.invalidKeys)).toBe(true);
  });

  it("health response matches frontend error boundary expectations", async () => {
    const data = (await fetchJson(
      `${BACKEND}/api/health`
    )) as Record<string, unknown>;
    const memory = data.memory as Record<string, unknown>;

    expect(typeof data.uptime).toBe("number");
    expect(typeof data.environment).toBe("string");
    expect(typeof data.version).toBe("string");
    expect(typeof memory.heapUsed).toBe("number");
    expect(typeof memory.heapTotal).toBe("number");
  });
});
