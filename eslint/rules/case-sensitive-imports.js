/**
 * ESLint rule: case-sensitive-imports
 *
 * Validates that import and require paths match the exact casing of files on
 * disk. Catches mismatches on case-insensitive filesystems (Windows, macOS
 * default) before they fail on case-sensitive CI/Linux.
 *
 * Works by reading the real directory listing with `fs.readdirSync` and
 * comparing each path segment against the actual filename on disk.
 */

import fs from "fs";
import path from "path";

function findActualCasing(dirPath, segment) {
  if (!fs.existsSync(dirPath)) return null;
  try {
    const entries = fs.readdirSync(dirPath);
    const lower = segment.toLowerCase();
    return entries.find((e) => e.toLowerCase() === lower) || null;
  } catch {
    return null;
  }
}

function resolveAndCheck(importPath, context) {
  // Skip bare specifiers (package imports) and non-relative imports
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) return;

  const filename = context.filename;
  const dir = path.dirname(filename);

  // Resolve the target directory and walk each segment
  const resolved = path.resolve(dir, importPath);
  const ext = path.extname(resolved);

  // If the import has no extension, Vite/bundler resolves .ts/.tsx/.js/.jsx
  const extensions = ext
    ? [""]
    : ["", ".ts", ".tsx", ".js", ".jsx", ".css", ".json"];

  const segments = path.relative(dir, resolved).split(path.sep).filter(Boolean);

  let currentDir = dir;
  let mismatch = null;

  for (const segment of segments) {
    if (!fs.existsSync(currentDir)) break;

    const actual = findActualCasing(currentDir, segment);
    if (actual === null) {
      // Segment doesn't exist — let the bundler handle resolution errors
      break;
    }
    if (actual !== segment) {
      mismatch = { expected: actual, found: segment, relativeFrom: currentDir };
      break;
    }
    currentDir = path.join(currentDir, actual);
  }

  // If path without extension didn't match, try with extensions
  if (!mismatch && !ext) {
    for (const candidate of extensions.slice(1)) {
      const withExt = resolved + candidate;
      if (fs.existsSync(withExt)) {
        const baseNameWithExt = path.basename(withExt);
        const dirOfResolved = path.dirname(withExt);
        const actualBase = findActualCasing(dirOfResolved, baseNameWithExt);
        if (actualBase && actualBase !== baseNameWithExt) {
          mismatch = {
            expected: actualBase,
            found: baseNameWithExt,
            relativeFrom: dirOfResolved,
          };
        }
        break;
      }
    }
  }

  if (!mismatch) return;

  context.report({
    node: null,
    message: `Import path casing mismatch: "{{ found }}" does not match "{{ expected }}" on disk. This will fail on case-sensitive filesystems (Linux/CI).`,
    data: {
      found: mismatch.found,
      expected: mismatch.expected,
    },
  });
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that import paths match exact filesystem casing to prevent cross-platform build failures.",
      category: "Possible Errors",
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source && typeof node.source.value === "string") {
          resolveAndCheck(node.source.value, context);
        }
      },
      CallExpression(node) {
        if (
          node.callee &&
          (node.callee.name === "require" || node.callee.type === "Import") &&
          node.arguments.length > 0 &&
          node.arguments[0].type === "Literal" &&
          typeof node.arguments[0].value === "string"
        ) {
          resolveAndCheck(node.arguments[0].value, context);
        }
      },
    };
  },
};
