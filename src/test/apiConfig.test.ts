import { describe, it, expect, vi } from "vitest";

/** All env-var keys that apiConfig.ts reads from process.env / import.meta.env */
const API_ENV_KEYS = [
  "VITE_API_URL",
  "VITE_API_BASE_URL",
  "BACKEND_PUBLIC_URL",
  "PY_API_PUBLIC_URL",
  "VITE_PYAPI_URL",
] as const;

/**
 * Force each test to start with a clean slate — delete every known API env
 * var from process.env so only the module's built-in fallback remains.
 * Must run *before* vi.resetModules() to ensure the IIFE re-evaluates with
 * a clean environment.
 */
function clearApiEnvVars() {
  for (const key of API_ENV_KEYS) {
    delete process.env[key];
  }
}

/**
 * Helper: delete all API env vars, reset the module registry, then
 * dynamically import the module so its IIFE re-evaluates.
 */
async function importModule() {
  clearApiEnvVars();
  vi.resetModules();
  return await import("../lib/apiConfig");
}

/**
 * Helper: clear env, set one specific env var, then import the module.
 */
async function importModuleWithEnv(key: string, value: string) {
  clearApiEnvVars();
  vi.stubEnv(key, value);
  vi.resetModules();
  return await import("../lib/apiConfig");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe("constants", () => {
  it("DEFAULT_RENDER_BACKEND_URL points to the live Render backend", async () => {
    const mod = await importModule();
    expect(mod.DEFAULT_RENDER_BACKEND_URL).toBe(
      "https://zerodayguardian-backend.onrender.com",
    );
  });

  it("API_BASE_URL falls back to DEFAULT_RENDER_BACKEND_URL when no env vars are set", async () => {
    const mod = await importModule();
    expect(mod.API_BASE_URL).toBe(
      "https://zerodayguardian-backend.onrender.com",
    );
  });

  it("API_BASE is an alias for API_BASE_URL", async () => {
    const mod = await importModule();
    expect(mod.API_BASE).toBe(mod.API_BASE_URL);
  });

  it("hasConfiguredApiBase is true thanks to the DEFAULT_RENDER_BACKEND_URL fallback", async () => {
    const mod = await importModule();
    expect(mod.hasConfiguredApiBase).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveBackendUrl
// ---------------------------------------------------------------------------
describe("resolveBackendUrl", () => {
  it("resolves /api/ paths against the base URL", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("/api/labs")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/labs",
    );
    expect(mod.resolveBackendUrl("/api/health")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/health",
    );
    expect(mod.resolveBackendUrl("/api/v1/tools")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/v1/tools",
    );
  });

  it("resolves /auth/ paths against the base URL", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("/auth/login")).toBe(
      "https://zerodayguardian-backend.onrender.com/auth/login",
    );
    expect(mod.resolveBackendUrl("/auth/refresh")).toBe(
      "https://zerodayguardian-backend.onrender.com/auth/refresh",
    );
  });

  it("passes through absolute HTTP URLs unchanged", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("https://external-api.example.com/data")).toBe(
      "https://external-api.example.com/data",
    );
  });

  it("does not join paths that start with / but are not /api/ or /auth/", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("/other/page")).toBe("/other/page");
    expect(mod.resolveBackendUrl("/public/robots.txt")).toBe(
      "/public/robots.txt",
    );
  });

  it("joins relative paths (no leading slash) with the base URL", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("relative-path")).toBe(
      "https://zerodayguardian-backend.onrender.com/relative-path",
    );
  });

  it("returns empty string for empty / whitespace-only input", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("")).toBe("");
    expect(mod.resolveBackendUrl("   ")).toBe("");
  });

  it("handles null / undefined gracefully", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl(null as unknown as string)).toBe("");
    expect(mod.resolveBackendUrl(undefined as unknown as string)).toBe("");
  });

  it("resolves exact /api path (no trailing content)", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("/api")).toBe(
      "https://zerodayguardian-backend.onrender.com/api",
    );
  });

  it("resolves exact /auth path (no trailing content)", async () => {
    const mod = await importModule();
    expect(mod.resolveBackendUrl("/auth")).toBe(
      "https://zerodayguardian-backend.onrender.com/auth",
    );
  });
});

// ---------------------------------------------------------------------------
// resolveApiUrl
// ---------------------------------------------------------------------------
describe("resolveApiUrl", () => {
  it("resolves /api/ paths against the base URL", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("/api/tools")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/tools",
    );
    expect(mod.resolveApiUrl("/api/auth/refresh")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/auth/refresh",
    );
  });

  it("passes through absolute HTTP URLs unchanged", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("https://other.api.com/api/data")).toBe(
      "https://other.api.com/api/data",
    );
  });

  it("does NOT resolve /auth/ paths (only /api/ matcher)", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("/auth/login")).toBe("/auth/login");
  });

  it("does NOT resolve paths that start with / but are not /api/", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("/other/route")).toBe("/other/route");
  });

  it("returns empty string for empty input", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("")).toBe("");
  });

  it("resolves exact /api path (no trailing content)", async () => {
    const mod = await importModule();
    expect(mod.resolveApiUrl("/api")).toBe(
      "https://zerodayguardian-backend.onrender.com/api",
    );
  });
});

// ---------------------------------------------------------------------------
// resolvePyApiUrl
// ---------------------------------------------------------------------------
describe("resolvePyApiUrl", () => {
  it("resolves /pyapi/ paths using PY_API_BASE_URL", async () => {
    const mod = await importModule();
    expect(mod.resolvePyApiUrl("/pyapi/analyze")).toBe(
      "https://zerodayguardian-backend.onrender.com/pyapi/analyze",
    );
    expect(mod.resolvePyApiUrl("/pyapi/scan/result")).toBe(
      "https://zerodayguardian-backend.onrender.com/pyapi/scan/result",
    );
  });

  it("passes through absolute HTTP URLs unchanged", async () => {
    const mod = await importModule();
    expect(mod.resolvePyApiUrl("https://py-api.example.com/analyze")).toBe(
      "https://py-api.example.com/analyze",
    );
  });

  it("joins relative paths with PY_API_BASE_URL", async () => {
    const mod = await importModule();
    expect(mod.resolvePyApiUrl("health")).toBe(
      "https://zerodayguardian-backend.onrender.com/pyapi/health",
    );
  });

  it("returns empty string for empty input", async () => {
    const mod = await importModule();
    expect(mod.resolvePyApiUrl("")).toBe("");
  });

  it("preserves trailing slash on the path when provided", async () => {
    const mod = await importModule();
    // joinUrl preserves the path as-is; only the base URL is trimmed
    expect(mod.resolvePyApiUrl("/pyapi/analyze/")).toBe(
      "https://zerodayguardian-backend.onrender.com/pyapi/analyze/",
    );
  });
});

// ---------------------------------------------------------------------------
// PY_API_BASE_URL
// ---------------------------------------------------------------------------
describe("PY_API_BASE_URL", () => {
  it("defaults to API_BASE_URL/pyapi when no py-api env vars are present", async () => {
    const mod = await importModule();
    expect(mod.PY_API_BASE_URL).toBe(
      "https://zerodayguardian-backend.onrender.com/pyapi",
    );
  });
});

// ---------------------------------------------------------------------------
// Env-var resolution chain
// ---------------------------------------------------------------------------
describe("env var resolution chain", () => {
  it("VITE_API_URL from process.env takes priority", async () => {
    const mod = await importModuleWithEnv(
      "VITE_API_URL",
      "https://custom-backend.example.com",
    );
    expect(mod.API_BASE_URL).toBe("https://custom-backend.example.com");
  });

  it("VITE_API_BASE_URL is used when VITE_API_URL is not set", async () => {
    const mod = await importModuleWithEnv(
      "VITE_API_BASE_URL",
      "https://via-base.example.com",
    );
    expect(mod.API_BASE_URL).toBe("https://via-base.example.com");
  });

  it("BACKEND_PUBLIC_URL is used when VITE_* vars are not set", async () => {
    const mod = await importModuleWithEnv(
      "BACKEND_PUBLIC_URL",
      "https://via-public.example.com",
    );
    expect(mod.API_BASE_URL).toBe("https://via-public.example.com");
  });

  it("DEFAULT_RENDER_BACKEND_URL is the final fallback when nothing is set", async () => {
    const mod = await importModule();
    expect(mod.API_BASE_URL).toBe(
      "https://zerodayguardian-backend.onrender.com",
    );
  });

  it("PY_API_PUBLIC_URL from process.env sets PY_API_BASE_URL", async () => {
    const mod = await importModuleWithEnv(
      "PY_API_PUBLIC_URL",
      "https://py-api.example.com",
    );
    expect(mod.PY_API_BASE_URL).toBe("https://py-api.example.com");
  });

  it("VITE_PYAPI_URL from process.env is used when PY_API_PUBLIC_URL is absent", async () => {
    const mod = await importModuleWithEnv(
      "VITE_PYAPI_URL",
      "https://vite-py.example.com",
    );
    expect(mod.PY_API_BASE_URL).toBe("https://vite-py.example.com");
  });
});

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------
describe("URL normalization", () => {
  it("strips trailing slashes from env var values", async () => {
    const mod = await importModuleWithEnv(
      "VITE_API_URL",
      "https://custom-backend.example.com/trailing/",
    );
    expect(mod.API_BASE_URL).toBe(
      "https://custom-backend.example.com/trailing",
    );
  });

  it("preserves trailing slashes from the path in resolved URLs", async () => {
    const mod = await importModule();
    // joinUrl preserves the path as-is; only the base URL is trimmed
    expect(mod.resolveBackendUrl("/api/tools/")).toBe(
      "https://zerodayguardian-backend.onrender.com/api/tools/",
    );
  });

  it("rejects non-http:// or https:// scheme URLs and falls through", async () => {
    const mod = await importModuleWithEnv(
      "VITE_API_URL",
      "ftp://files.example.com",
    );
    // ftp:// is not http/https, so normalizeBaseUrl returns "" and we fall
    // through to DEFAULT_RENDER_BACKEND_URL
    expect(mod.API_BASE_URL).toBe(
      "https://zerodayguardian-backend.onrender.com",
    );
  });

  it("rejects plain strings without a scheme and falls through", async () => {
    const mod = await importModuleWithEnv("VITE_API_URL", "not-a-url");
    expect(mod.API_BASE_URL).toBe(
      "https://zerodayguardian-backend.onrender.com",
    );
  });

  it("handles env var with extra whitespace gracefully", async () => {
    const mod = await importModuleWithEnv(
      "VITE_API_URL",
      "  https://spaces.example.com  ",
    );
    expect(mod.API_BASE_URL).toBe("https://spaces.example.com");
  });
});
