/**
 * Vercel Serverless Function — serves index.html with a per‑request CSP nonce.
 *
 * How it works:
 *   1. Reads the pre‑built dist/index.html (Vite output)
 *   2. Generates a cryptographic nonce per request
 *   3. Injects `nonce="..."` into inline <style> and <script> tags
 *   4. Returns the HTML with a Content‑Security‑Policy header using 'nonce-...'
 *
 * This replaces 'unsafe-inline' in the CSP with a per‑request nonce,
 * eliminating a major XSS attack vector while keeping the app functional.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// ── CSP template — {nonce} is replaced per request ──
const CSP_DIRECTIVES = [
  ["default-src", ["'self'"]],
  // 'unsafe-eval' required by Sentry & Firebase for dynamic code evaluation
  ["script-src", ["'self'", "'unsafe-eval'", "'nonce-{nonce}'", "https://*.firebaseio.com", "https://apis.google.com", "https://accounts.google.com"]],
  ["style-src", ["'self'", "'nonce-{nonce}'"]],
  ["img-src", ["'self'", "data:", "blob:", "https:"]],
  ["font-src", ["'self'", "data:", "https://fonts.gstatic.com"]],
  // connect-src: explicit allowlist for Firebase, Sentry, Google APIs, backend, and Vercel preview domains
  ["connect-src", ["'self'", "https://*.firebaseio.com", "https://identitytoolkit.googleapis.com", "https://*.googleapis.com", "https://*.ingest.sentry.io", "https://*.vercel.app", "https://*.onrender.com", "https://accounts.google.com", "wss:", "ws:"]],
  ["worker-src", ["'self'", "blob:"]],
  ["frame-src", ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'self'"]],
  ["form-action", ["'self'"]],
];

/**
 * Build a CSP string with the given nonce substituted in.
 */
const buildCsp = (nonce) =>
  CSP_DIRECTIVES.map(([key, values]) => {
    const resolved = values.map((v) => v.replace("{nonce}", nonce));
    return `${key} ${resolved.join(" ")}`;
  }).join("; ");

// ── Path to the production index.html ──
// In Vercel's Node.js runtime the working directory is the project root,
// so `./dist/index.html` resolves to the Vite build output.
const HTML_PATH = path.resolve(process.cwd(), "dist", "index.html");

/**
 * Vercel serverless function handler (Node.js runtime).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  try {
    // Guard: only serve requests without a file extension (SPA routes).
    // Requests with file extensions (e.g. /assets/*.js, /favicon.ico) are
    // served directly by Vercel's static file handler via explicit rewrite rules.
    const urlPath = new URL(req.url || "/", "http://localhost").pathname;
    const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(urlPath);
    if (hasFileExtension && urlPath !== "/index.html") {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    // ── Read the pre‑built static HTML ──
    let html;
    try {
      html = fs.readFileSync(HTML_PATH, "utf-8");
    } catch {
      console.error("[csp-nonce] dist/index.html not found at:", HTML_PATH);
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.end("Internal Server Error — static HTML not found");
      return;
    }

    // ── Generate a per‑request nonce ──
    const nonce = crypto.randomBytes(16).toString("base64url");

    // ── Inject nonce into inline <style> and inline <script> tags ──
    // The Vite build produces only these two inline blocks in index.html:
    //   1. <style> (CSS variables for theme)
    //   2. <script type="application/ld+json"> (structured data)
    // External module scripts (<script type="module" src="...">) do NOT need nonces.
    // Note: simple string.replace() is safe here — these exact strings appear only once each.
    let modifiedHtml = html
      .replace("<style>", `<style nonce="${nonce}">`)
      .replace(
        '<script type="application/ld+json">',
        `<script type="application/ld+json" nonce="${nonce}">`
      );

    // ── Fix preload crossorigin mismatch ──
    // Sentry Vite plugin generates <link rel="modulepreload" href="data:..."> links that
    // are missing the crossorigin attribute. The browser rejects them because the credentials
    // mode doesn't match the main module script. Add crossorigin="anonymous" to all
    // modulepreload links that lack it.
    modifiedHtml = modifiedHtml.replace(
      /(<link\s+[^>]*?rel=["']modulepreload["'][^>]*?)>/gi,
      (match, pre) => {
        if (/crossorigin/i.test(pre)) return match;
        return `${pre} crossorigin="anonymous">`;
      }
    );

    // ── Ensure <script type="module"> has crossorigin to match preloads ──
    modifiedHtml = modifiedHtml.replace(
      /(<script\s+type=["']module["'][^>]*?)>/gi,
      (match, pre) => {
        if (/crossorigin/i.test(pre)) return match;
        return `${pre} crossorigin="anonymous">`;
      }
    );

    // ── Strip the old CSP <meta> fallback (if present) ──
    // The header‑level CSP is authoritative; the meta tag would just be redundant.
    modifiedHtml = modifiedHtml.replace(
      /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      ""
    );

    // ── Build the CSP header ──
    const csp = buildCsp(nonce);

    // ── Respond ──
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy", csp);
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.end(modifiedHtml);
  } catch (err) {
    console.error("[csp-nonce] Unexpected error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain");
    res.end("Internal Server Error");
  }
}
