/**
 * End-to-end test for auth refresh flow.
 *
 * Spins up a mock Express server that mimics the real /api/auth/refresh and
 * /api/auth/logout endpoints (same token resolution logic as authController),
 * then exercises every token-source combination to verify the fallback chain:
 *
 *   body → zdg_refresh cookie → neurobot_rt cookie → Authorization Bearer header
 *
 * Usage:
 *   node scripts/test-auth-refresh-flow.mjs
 *
 * Exit code: 0 if all tests pass, 1 if any fail.
 */

import http from "node:http";
import { once } from "node:events";

// ── Helpers ──────────────────────────────────────────────────────────────

const serverPort = 0; // OS picks a random free port
let serverBaseUrl = "";
let server = null;

const encodeCookie = (name, value) =>
  `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

const makeBody = (data) => JSON.stringify(data);

// ── Mock Backend Server ──────────────────────────────────────────────────

const parseBearerToken = (authorization = "") => {
  const raw = String(authorization || "");
  const match = raw.match(/^\s*Bearer\s+(.+)\s*$/i);
  if (!match) return null;
  const token = String(match[1] || "").trim();
  return token || null;
};

/**
 * Build a mock Express-like request object from raw HTTP request parts.
 */
const buildMockReq = (method, url, headers, body = "") => ({
  method,
  url,
  headers,
  validatedBody: body ? { refreshToken: body } : {},
  cookies: Object.fromEntries(
    (headers.cookie || "")
      .split("; ")
      .filter(Boolean)
      .map((entry) => {
        const idx = entry.indexOf("=");
        if (idx === -1) return [entry, ""];
        return [decodeURIComponent(entry.slice(0, idx)), decodeURIComponent(entry.slice(idx + 1))];
      })
  ),
  originalUrl: url,
  path: url.split("?")[0],
});

function createMockServer() {
  return http.createServer((req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-csrf-token");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Collect body
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        let parsedBody = {};
        let rawBody = "";
        if (body) {
          rawBody = body;
          parsedBody = JSON.parse(body);
        }

        const mockReq = buildMockReq(req.method, req.url, req.headers, parsedBody.refreshToken);
        const requestId = `test-${Date.now()}`;
        mockReq.requestId = requestId;

        // Route: /api/auth/refresh
        if (req.url === "/api/auth/refresh" && req.method === "POST") {
          const tokenFromHeader = parseBearerToken(req.headers.authorization);
          const resolvedToken =
            mockReq.validatedBody?.refreshToken ||
            mockReq.cookies?.zdg_refresh ||
            mockReq.cookies?.neurobot_rt ||
            tokenFromHeader;

          const logEntry = {
            requestId,
            hasRefreshCookie: Boolean(mockReq.cookies?.zdg_refresh || mockReq.cookies?.neurobot_rt),
            hasRefreshBody: Boolean(mockReq.validatedBody?.refreshToken),
            hasRefreshHeader: Boolean(tokenFromHeader),
            resolvedToken: resolvedToken ? resolvedToken.substring(0, 16) + "..." : null,
            source: resolvedToken === mockReq.validatedBody?.refreshToken
              ? "body"
              : resolvedToken === mockReq.cookies?.zdg_refresh || resolvedToken === mockReq.cookies?.neurobot_rt
              ? "cookie"
              : "header",
          };

          if (!resolvedToken) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "error",
              code: "refresh_token_required",
              message: "Refresh token required",
              requestId,
              _debug: logEntry,
            }));
            return;
          }

          // Validate token structure (simple regex for test tokens)
          if (!/^test_refresh_token(_body|_cookie_zdg|_cookie_neurobot|_header)?(_remember)?(_expired)?(_invalid)?$/.test(resolvedToken)) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "error",
              code: "invalid_refresh_token",
              message: "Invalid refresh token",
              requestId,
              _debug: logEntry,
            }));
            return;
          }

          if (resolvedToken.includes("_expired")) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "error",
              code: "refresh_session_expired",
              message: "Refresh session expired",
              requestId,
              _debug: logEntry,
            }));
            return;
          }

          if (resolvedToken.includes("_invalid")) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              status: "error",
              code: "invalid_refresh_token",
              message: "Invalid refresh token",
              requestId,
              _debug: logEntry,
            }));
            return;
          }

          const rememberMe = resolvedToken.includes("_remember");
          const newAccessToken = `test_access_token_${Date.now()}`;
          const newRefreshToken = `test_refresh_token_${Date.now()}_${rememberMe ? "remember" : "session"}`;

          res.writeHead(200, {
            "Content-Type": "application/json",
            "Set-Cookie": [
              `neurobot_at=${newAccessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
              `zdg_token=${newAccessToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
              `neurobot_rt=${newRefreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
              `zdg_refresh=${newRefreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
            ],
          });
          res.end(JSON.stringify({
            status: "ok",
            user: {
              id: "test-user-1",
              name: "Test Guardian",
              email: "test@zerodayguardian.com",
              role: "user",
            },
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            _debug: logEntry,
          }));
          return;
        }

        // Route: /api/auth/logout (same token resolution as refresh)
        if (req.url === "/api/auth/logout" && req.method === "POST") {
          const tokenFromHeader = parseBearerToken(req.headers.authorization);
          const resolvedToken =
            mockReq.validatedBody?.refreshToken ||
            mockReq.cookies?.zdg_refresh ||
            mockReq.cookies?.neurobot_rt ||
            tokenFromHeader;

          const logEntry = {
            requestId,
            hasRefreshCookie: Boolean(mockReq.cookies?.zdg_refresh || mockReq.cookies?.neurobot_rt),
            hasRefreshBody: Boolean(mockReq.validatedBody?.refreshToken),
            hasRefreshHeader: Boolean(tokenFromHeader),
            resolvedToken: resolvedToken ? resolvedToken.substring(0, 12) + "..." : null,
          };

          // Revoke the refresh token if present
          if (resolvedToken) {
            console.log(`  [mock] Revoked refresh token: ${resolvedToken.substring(0, 12)}...`);
          }

          res.writeHead(204, {
            "Set-Cookie": [
              "neurobot_at=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
              "zdg_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
              "neurobot_rt=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
              "zdg_refresh=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
            ],
          });
          res.end();
          return;
        }

        // Fallback
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", code: "not_found", message: "Route not found" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error", code: "internal_error", message: err.message }));
      }
    });
  });
}

// ── HTTP Request Helper ──────────────────────────────────────────────────

const request = async (method, path, options = {}) => {
  const { headers = {}, body, cookies } = options;
  const reqHeaders = { ...headers, "Content-Type": "application/json" };

  if (cookies && Object.keys(cookies).length > 0) {
    reqHeaders.cookie = Object.entries(cookies)
      .map(([k, v]) => encodeCookie(k, v))
      .join("; ");
  }

  return new Promise((resolve, reject) => {
    const url = new URL(path, serverBaseUrl);
    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
};

// ── Test Runner ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

const run = async () => {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  Auth Refresh Flow — End-to-End Test Suite");
  console.log("══════════════════════════════════════════════════\n");

  for (const { name, fn } of tests) {
    process.stdout.write(`  ${name} ... `);
    try {
      await fn();
      console.log("✅ PASS");
      passed++;
    } catch (err) {
      console.log(`❌ FAIL\n    ${err.message}`);
      failed++;
    }
  }

  console.log("\n──────────────────────────────────────────────────");
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("──────────────────────────────────────────────────\n");

  return failed === 0 ? 0 : 1;
};

// ── Tests ────────────────────────────────────────────────────────────────

test("Refresh with zdg_refresh cookie only", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    cookies: { zdg_refresh: "test_refresh_token_cookie_zdg" },
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (!res.body.accessToken) throw new Error("No accessToken in response");
  if (!res.body._debug.hasRefreshCookie) throw new Error("hasRefreshCookie should be true");
  if (res.body._debug.hasRefreshHeader) throw new Error("hasRefreshHeader should be false when only cookie is sent");
});

test("Refresh with neurobot_rt cookie only", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    cookies: { neurobot_rt: "test_refresh_token_cookie_neurobot" },
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (!res.body.accessToken) throw new Error("No accessToken in response");
  if (!res.body._debug.hasRefreshCookie) throw new Error("hasRefreshCookie should be true");
});

test("Refresh with Authorization Bearer header only (no cookies)", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    headers: { Authorization: "Bearer test_refresh_token_header" },
    // no cookies
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (!res.body.accessToken) throw new Error("No accessToken in response");
  if (!res.body._debug.hasRefreshHeader) throw new Error("hasRefreshHeader should be true");
  if (res.body._debug.hasRefreshCookie) throw new Error("hasRefreshCookie should be false when no cookies sent");
  if (res.body._debug.hasRefreshBody) throw new Error("hasRefreshBody should be false when no body sent");
});

test("Refresh with token in request body", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    body: makeBody({ refreshToken: "test_refresh_token_body" }),
    // no cookies, no header
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (!res.body.accessToken) throw new Error("No accessToken in response");
  if (!res.body._debug.hasRefreshBody) throw new Error("hasRefreshBody should be true");
});

test("Refresh fallback chain: cookie takes priority over header", async () => {
  // Send both cookie AND Authorization header — cookie should win
  const res = await request("POST", "/api/auth/refresh", {
    cookies: { zdg_refresh: "test_refresh_token_cookie_zdg" },
    headers: { Authorization: "Bearer test_refresh_token_header" },
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  // The resolved source should be "cookie", not "header"
  if (res.body._debug.source !== "cookie") {
    throw new Error(`Expected cookie token to be used, got source: ${res.body._debug.source}, resolvedToken: ${res.body._debug.resolvedToken}`);
  }
});

test("Refresh fallback chain: body takes priority over cookie and header", async () => {
  // Send body + cookie + header — body should win
  const res = await request("POST", "/api/auth/refresh", {
    body: makeBody({ refreshToken: "test_refresh_token_body" }),
    cookies: { zdg_refresh: "test_refresh_token_cookie_zdg" },
    headers: { Authorization: "Bearer test_refresh_token_header" },
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body._debug.source !== "body") {
    throw new Error(`Expected body token to be used, got source: ${res.body._debug.source}, resolvedToken: ${res.body._debug.resolvedToken}`);
  }
});

test("Refresh with no token from any source returns 401", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    // no cookies, no header, no body
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== "refresh_token_required") {
    throw new Error(`Expected code "refresh_token_required", got "${res.body?.code}"`);
  }
});

test("Refresh with expired cookie returns 401", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    cookies: { zdg_refresh: "test_refresh_token_expired" },
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== "refresh_session_expired") {
    throw new Error(`Expected code "refresh_session_expired", got "${res.body?.code}"`);
  }
});

test("Refresh with invalid Bearer token returns 401", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    headers: { Authorization: "Bearer test_refresh_token_invalid" },
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== "invalid_refresh_token") {
    throw new Error(`Expected code "invalid_refresh_token", got "${res.body?.code}"`);
  }
});

test("Refresh with malformed Authorization header (no Bearer prefix) returns 401 (no token)", async () => {
  // parseBearerToken will return null because there's no "Bearer " prefix
  const res = await request("POST", "/api/auth/refresh", {
    headers: { Authorization: "test_refresh_token_no_bearer" },
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (res.body?.code !== "refresh_token_required") {
    throw new Error(`Expected code "refresh_token_required" for missing Bearer prefix, got "${res.body?.code}"`);
  }
});

test("Refresh with rememberMe cookie preserves preference", async () => {
  const res = await request("POST", "/api/auth/refresh", {
    cookies: { zdg_refresh: "test_refresh_token_cookie_zdg_remember" },
  });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  if (!res.body.refreshToken?.includes("remember")) {
    throw new Error(`Expected rememberMe refresh token, got: ${res.body.refreshToken?.substring(0, 40)}`);
  }
});

// ── Logout endpoint tests ────────────────────────────────────────────────

test("Logout with zdg_refresh cookie clears session", async () => {
  const res = await request("POST", "/api/auth/logout", {
    cookies: { zdg_refresh: "test_refresh_token_cookie_zdg" },
  });
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
  // Should have clear-cookie headers
  const setCookie = Array.isArray(res.headers["set-cookie"]) ? res.headers["set-cookie"] : [res.headers["set-cookie"] || ""];
  const hasClearCookie = setCookie.some((c) => c.includes("Max-Age=0"));
  if (!hasClearCookie) throw new Error("Expected clear-cookie headers (Max-Age=0)");
});

test("Logout with Authorization Bearer header only", async () => {
  const res = await request("POST", "/api/auth/logout", {
    headers: { Authorization: "Bearer test_refresh_token_header" },
  });
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
});

test("Logout with body token only", async () => {
  const res = await request("POST", "/api/auth/logout", {
    body: makeBody({ refreshToken: "test_refresh_token_body" }),
  });
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
});

test("Logout with no token (anonymous) still clears cookies (204)", async () => {
  // The controller's revokeRefreshSession is guarded with `if (refreshToken)`
  // so calling logout without a token should still succeed
  const res = await request("POST", "/api/auth/logout");
  if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
});

// ── Main ─────────────────────────────────────────────────────────────────

const main = async () => {
  try {
    server = createMockServer();
    server.listen(serverPort);
    await once(server, "listening");
    const addr = server.address();
    serverBaseUrl = `http://127.0.0.1:${addr.port}`;
    console.log(`  Mock backend listening on ${serverBaseUrl}\n`);

    const exitCode = await run();
    process.exit(exitCode);
  } catch (err) {
    console.error("Fatal:", err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
};

main();
