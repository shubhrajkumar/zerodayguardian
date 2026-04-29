import fs from "node:fs";
import path from "node:path";

const inputArg = process.argv[2] || "";
const cwd = process.cwd();
const inputPath = inputArg ? path.resolve(cwd, inputArg) : "";

const readInput = () => {
  if (inputPath && fs.existsSync(inputPath)) {
    return fs.readFileSync(inputPath, "utf8");
  }
  if (inputArg) return inputArg;
  return "";
};

const normalizePrivateKeyForRender = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\\n");

const raw = readInput();
if (!raw.trim()) {
  console.error("Usage: node scripts/render-key-format.mjs <path-to-key.pem | raw-key>");
  process.exit(1);
}

const formatted = normalizePrivateKeyForRender(raw);
console.log(formatted);
