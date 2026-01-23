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

const numericFields = [
  "CurrentSeed",
  "RoundOf32Pct",
  "Sweet16Pct",
  "Elite8Pct",
  "FinalFourPct",
  "ChampionshipPct",
  "WinTitlePct"
];

const json = records.map(row => {
  const obj = { ...row };

  numericFields.forEach(field => {
    if (obj[field] !== undefined && obj[field] !== "") {
      obj[field] = Number(parseFloat(obj[field]).toFixed(3));
    }
  });

  return obj;
});

fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), "utf8");

console.log("Seeding JSON generated successfully.");
