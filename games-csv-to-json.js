/**
 * convert-csv.js
 *
 * Reads:  src/data/betting-lines/games.csv
 * Writes: src/data/betting-lines/games.json
 *
 * - Robust, dependency-free CSV parsing (handles quoted fields and commas)
 * - Normalizes output to UTF-8
 * - Logs the output path and exits non-zero on error so CI/pipeline fails visibly
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const CSV_PATH = path.join(ROOT, 'src', 'data', 'betting-lines', 'games.csv');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'betting-lines'); // canonical folder
const OUT_PATH = path.join(OUT_DIR, 'games.json');

function parseCSV(text) {
  // Returns array of rows as objects (first line = headers)
  // Handles quoted fields with commas and double-quote escaping ("")
  const rows = [];
  let i = 0;
  const len = text.length;

  function readField() {
    if (i >= len) return null;
    let field = '';
    if (text[i] === '"') {
      // quoted field
      i++; // skip opening quote
      while (i < len) {
        if (text[i] === '"') {
          if (i + 1 < len && text[i + 1] === '"') {
            // escaped quote
            field += '"';
            i += 2;
            continue;
          } else {
            // closing quote
            i++;
            break;
          }
        } else {
          field += text[i++];
        }
      }
      // after closing quote, skip optional whitespace until comma or newline
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        // allow spaces/tabs
        if (text[i] === ' ' || text[i] === '\t') { i++; continue; }
        break;
      }
      if (i < len && text[i] === ',') { i++; } // skip comma
      return field;
    } else {
      // unquoted field
      while (i < len && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        field += text[i++];
      }
      if (i < len && text[i] === ',') i++;
      return field.trim();
    }
  }

  function readLine() {
    const fields = [];
    // If at end, return null
    if (i >= len) return null;
    // Handle empty-line-only CR/LF sequences
    // If next chars are \r\n or \n, consume and return empty array
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
      // If we hit newline, consume and break
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
      // readField may return null at EOF
      if (f === null) break;
      fields.push(f);
      // If at EOF, break
      if (i >= len) break;
      // If next char is newline, loop will handle it
    }
    return fields;
  }

  // Read header
  const headerFields = readLine();
  if (!headerFields || headerFields.length === 0) return [];
  const headers = headerFields.map(h => h.trim());

  // Read remaining lines
  while (i < len) {
    const fields = readLine();
    // skip blank lines
    if (!fields || fields.length === 0) continue;
    // If row has fewer fields than headers, pad with empty strings
    while (fields.length < headers.length) fields.push('');
    // If row has more fields than headers, keep extras with numeric keys
    const obj = {};
    for (let j = 0; j < fields.length; j++) {
      const key = headers[j] !== undefined && headers[j] !== '' ? headers[j] : `col_${j}`;
      obj[key] = fields[j];
    }
    rows.push(obj);
  }

  return rows;
}

function coerceTypes(rows) {
  // Convert numeric-looking strings to numbers, preserve others
  return rows.map(row => {
    const out = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v === '') {
        out[k] = null;
        continue;
      }
      // Try integer
      if (/^-?\d+$/.test(v)) {
        out[k] = parseInt(v, 10);
        continue;
      }
      // Try float
      if (/^-?\d+\.\d+$/.test(v)) {
        out[k] = parseFloat(v);
        continue;
      }
      // Keep as string
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
      console.error('ERROR: CSV not found at', CSV_PATH);
      process.exit(2);
    }

    const raw = fs.readFileSync(CSV_PATH, { encoding: 'utf8' });
    console.log('Read CSV:', CSV_PATH);

    const rows = parseCSV(raw);
    console.log('Parsed rows:', rows.length);

    const typed = coerceTypes(rows);

    ensureOutDir();

    fs.writeFileSync(OUT_PATH, JSON.stringify(typed, null, 2), { encoding: 'utf8' });
    console.log('Wrote JSON to', OUT_PATH);

    // Also write a small timestamp file for debugging (optional)
    try {
      const stampPath = path.join(OUT_DIR, '.games.json.timestamp');
      fs.writeFileSync(stampPath, new Date().toISOString() + '\n', { encoding: 'utf8' });
    } catch (e) {
      // non-fatal
    }

    process.exit(0);
  } catch (err) {
    console.error('ERROR during convert-csv.js:', err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

main();
