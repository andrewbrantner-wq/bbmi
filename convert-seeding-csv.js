import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const inputPath = path.join(process.cwd(), "src/data/seeding/seeding.csv");
const outputPath = path.join(process.cwd(), "src/data/seeding/seeding.json");

const csvData = fs.readFileSync(inputPath, "utf8");

const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
});

// Updated numeric fields — RoundOf32Pct removed
const numericFields = [
  "CurrentSeed",
  "Sweet16Pct",
  "Elite8Pct",
  "FinalFourPct",
  "ChampionshipPct",
  "WinTitlePct",
];

const json = records.map((row) => {
  const obj = { ...row };

  // Convert numeric fields
  numericFields.forEach((field) => {
    if (obj[field] !== undefined && obj[field] !== "") {
      obj[field] = Number(parseFloat(obj[field]).toFixed(3));
    }
  });

  // Region stays as a string — no conversion needed
  if (obj.Region !== undefined) {
    obj.Region = String(obj.Region).trim();
  }

  return obj;
});

fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), "utf8");

console.log("Seeding JSON generated successfully.");
