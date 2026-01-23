import fs from "fs";
import path from "path";
import csv from "csv-parser";

const INPUT_PATH = path.join(process.cwd(), "src/data/betting-lines/games.csv");
const OUTPUT_PATH = path.join(process.cwd(), "src/data/betting-lines/games.json");

// Columns expected in games.csv
// date,away,home,vegasHomeLine,bbmiHomeLine,bbmiWinProb,actualAwayScore,actualHomeScore,fakeBet,fakeWin

const numericFields = [
  "vegasHomeLine",
  "bbmiHomeLine",
  "bbmiWinProb",
  "actualAwayScore",
  "actualHomeScore",
  "fakeWin"
];

const results = [];
let rowNumber = 1;

fs.createReadStream(INPUT_PATH)
  .pipe(csv())
  .on("data", (row) => {
    rowNumber++;

    // Convert numeric fields
    for (const field of numericFields) {
      if (row[field] === undefined || row[field] === "") {
        row[field] = null;
      } else {
        const num = Number(row[field]);
        if (isNaN(num)) {
          console.warn(`⚠️  Row ${rowNumber}: Invalid number in field "${field}" → "${row[field]}"`);
          row[field] = null;
        } else {
          row[field] = num;
        }
      }
    }

    // Normalize fakeBet
    if (row.fakeBet) {
      row.fakeBet = row.fakeBet.trim();
    }

    results.push(row);
  })
  .on("end", () => {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

    console.log(`✅ games.json written successfully with ${results.length} rows`);
  })
  .on("error", (err) => {
    console.error("❌ Error reading CSV:", err);
  });
