import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const inputPath = path.join(process.cwd(), "src/data/rankings/rankings.csv");
const outputPath = path.join(process.cwd(), "src/data/rankings/rankings.json");

const csvData = fs.readFileSync(inputPath, "utf8");

const records = parse(csvData, {
  columns: true,
  skip_empty_lines: true,
});

fs.writeFileSync(outputPath, JSON.stringify(records, null, 2));

console.log("Rankings JSON generated successfully.");