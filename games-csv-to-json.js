/**
 * games-csv-to-json.js
 *
 * Reads:  src/data/betting-lines/games.csv
 * Writes: src/data/betting-lines/games.json
 *
 * - Uses process.cwd() so .bat working directory is respected
 * - Robust CSV parsing (quoted fields, commas, escaped quotes)
 * - Logs all paths for pipeline visibility
 * - Exits non-zero on error so CI/batch halts correctly
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import fs from 'fs';
import path from 'path';


const ROOT = process.cwd();   // <-- critical fix
const CSV_PATH = path.join(ROOT, 'src', 'data', 'betting-lines', 'games.csv');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'betting-lines');
const OUT_PATH = path.join(OUT_DIR, 'games.json');

console.log("games-csv-to-json.js running from:", ROOT);
console.log("CSV_PATH:", CSV_PATH);
console.log("OUT_PATH:", OUT_PATH);

function parseCSV(text) {
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    if (i >= len) return null;
    let field = '';

    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        if (text[i] === ' ' || text[i] === '\t') { i++; continue; }
        break;
      }
      if (i < len && text[i] === ',') i++;
      return field;
    }

    while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      field += text[i++];
    }
    if (i < len && text[i] === ',') i++;
    return field.trim();
  }

  function readLine() {
    const fields = [];
    if (i >= len) return null;

    if (text[i] === '\r') {
      i++;
      if (i < len && text[i] === '\n') i++;
      return [];
    }
    if (text[i] === '\n') {
      i++;
      return [];
    }

    while (i < len) {
      if (text[i] === '\r') {
        i++;
        if (i < len && text[i] === '\n') i++;
        break;
      }
      if (text[i] === '\n') {
        i++;
        break;
      }
      const f = readField();
      if (f === null) break;
      fields.push(f);
      if (i >= len) break;
    }
    return fields;
  }

  const headerFields = readLine();
  if (!headerFields || headerFields.length === 0) return [];
  const headers = headerFields.map(h => h.trim());

  while (i < len) {
    const fields = readLine();
    if (!fields || fields.length === 0) continue;

    while (fields.length < headers.length) fields.push('');

    const obj = {};
    for (let j = 0; j < fields.length; j++) {
      const key = headers[j] || `col_${j}`;
      obj[key] = fields[j];
    }
    rows.push(obj);
  }

  return rows;
}

function coerceTypes(rows) {
  return rows.map(row => {
    const out = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v === '') {
        out[k] = null;
        continue;
      }
      if (/^-?\d+$/.test(v)) {
        out[k] = parseInt(v, 10);
        continue;
      }
      if (/^-?\d+\.\d+$/.test(v)) {
        out[k] = parseFloat(v);
        continue;
      }
      out[k] = v;
    }
    return out;
  });
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

function main() {
  try {
    if (!fs.existsSync(CSV_PATH)) {
      console.error("ERROR: CSV not found:", CSV_PATH);
      process.exit(2);
    }

    const raw = fs.readFileSync(CSV_PATH, 'utf8');
    console.log("Read CSV OK");

    const rows = parseCSV(raw);
    console.log("Parsed rows:", rows.length);

    const typed = coerceTypes(rows);

    ensureOutDir();

    fs.writeFileSync(OUT_PATH, JSON.stringify(typed, null, 2), 'utf8');
    console.log("Wrote JSON:", OUT_PATH);

    try {
      const stamp = path.join(OUT_DIR, '.games.json.timestamp');
      fs.writeFileSync(stamp, new Date().toISOString() + '\n', 'utf8');
    } catch {}

    process.exit(0);
  } catch (err) {
    console.error("ERROR in games-csv-to-json.js:", err);
    process.exit(1);
  }
}

main();