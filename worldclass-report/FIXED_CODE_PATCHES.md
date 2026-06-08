# Fixed Code Patches — ZeroDay Guardian

## Patch 1: Self-Hosted Font Files

**File:** `public/fonts/` (directory — 4 files)

### Problem
The `src/index.css` file contains `@font-face` declarations referencing self-hosted font files at `/fonts/*.woff2`, but the `public/fonts/` directory was never created or committed. This caused:
- `Failed to decode downloaded font: /fonts/jetbrains-mono-latin.woff2`
- `OTS parsing error: invalid sfntVersion: 1986359923`

The corrupted file (1.7K) contained HTML/text data instead of valid WOFF2 binary data.

### Fix
Downloaded 4 valid WOFF2 font files from jsDelivr Fontsource CDN:

```
public/fonts/
├── inter-latin.woff2          (48K) — Inter regular, Latin subset
├── inter-latin-ext.woff2      (84K) — Inter regular, Latin Extended subset
├── jetbrains-mono-latin.woff2 (21K) — JetBrains Mono regular, Latin subset
└── jetbrains-mono-latin-ext.woff2 (7.2K) — JetBrains Mono regular, Latin Extended subset
```

### CSS References (Already Exist in `src/index.css`)
```css
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/inter-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, ...;
}

@font-face {
  font-family: 'JetBrains Mono';
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('/fonts/jetbrains-mono-latin.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, ...;
}
```

### Verification
- All 4 files confirmed as valid WOFF2 via `file` command
- TypeScript typecheck: 0 errors
- Test suite: 557/557 passing
- Production build: Clean (1m 26s)
- Vite copies `public/` directory to `dist/` during build

### Font Licensing
Both Inter and JetBrains Mono use the **SIL Open Font License 1.1**, permitting free commercial use and self-hosting.
