import fs from "fs";
import path from "path";

const filePath = process.argv[2];

if (!filePath) {
  console.error("Usage: node clean-bom.js <path-to-json>");
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);

try {
  let raw = fs.readFileSync(resolvedPath, "utf8");

  // 1) Remove BOM at the very start of the file, if present
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }

  // 2) Remove BOM characters that might be embedded before keys
  //    e.g. "\uFEFFteam" → "team"
  raw = raw.replace(/\uFEFF/g, "");

  // 3) Try to parse to ensure it's still valid JSON
  const parsed = JSON.parse(raw);

  // 4) Re-stringify cleanly
  const cleaned = JSON.stringify(parsed, null, 2);

  fs.writeFileSync(resolvedPath, cleaned, "utf8");

  console.log(`Cleaned BOM characters from: ${resolvedPath}`);
} catch (err) {
  console.error("Error cleaning file:", err);
  process.exit(1);
}