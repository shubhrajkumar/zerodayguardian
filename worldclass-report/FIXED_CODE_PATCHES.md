# Fixed Code Patches — June 3, 2026

## Patch: CSP frame-ancestors Meta Tag Warning Resolution

### Problem
The browser console showed:
```
The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.
```

Per the CSP specification (https://w3c.github.io/webappsec-csp/#frame-ancestors-and-frame-options), `frame-ancestors` is only enforceable via HTTP headers, never via `<meta http-equiv="Content-Security-Policy">`. The meta tag contained `frame-ancestors 'self'` which browsers silently ignore.

### Root Cause
The `index.html` had a full CSP string in a `<meta>` tag that included `frame-ancestors 'self'`. While the HTTP-level CSP (from `vercel.json` and `api/index.mjs`) correctly enforces `frame-ancestors` via headers, the meta tag was triggering a console warning because browsers reject `frame-ancestors` in meta elements.

### Fix Applied

**File:** `index.html`

**Before:**
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' ...; frame-ancestors 'self';" />
```

**After:**
```html
<!-- CSP is enforced via HTTP header (vercel.json + api/index.mjs nonce). frame-ancestors is ignored in meta tags per spec; handled by HTTP header only. -->
```

### Why This Is Correct

1. **HTTP headers are authoritative.** Both `vercel.json` and `api/index.mjs` already enforce CSP via HTTP headers, which is the only way `frame-ancestors` can be enforced.

2. **The meta tag was redundant.** The `api/index.mjs` serverless function already strips the CSP `<meta>` tag from the HTML response and replaces it with a nonce-based CSP HTTP header.

3. **No security regression.** The `frame-ancestors 'self'` directive remains enforced via:
   - `vercel.json` → `"frame-ancestors 'self'"` in the `Content-Security-Policy` header
   - `api/index.mjs` → `["frame-ancestors", ["'self'"]]` in the `CSP_DIRECTIVES` array
   - `helmet` → `frameguard: { action: "deny" }` (backend, sends `X-Frame-Options: DENY`)

4. **Browser warning eliminated.** The console will no longer show the `frame-ancestors` ignored warning.

### Files Changed
- `index.html` — Replaced full CSP meta tag with a comment explaining the HTTP header enforcement
