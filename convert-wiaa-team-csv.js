import fs from "fs";
import path from "path";
import csv from "csv-parser";

const INPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-team/WIAA-team.csv";
const OUTPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-team/WIAA-team.json";

const results = [];

fs.createReadStream(INPUT)
  .pipe(csv())
  .on("data", (row) => {
    results.push({
      team: row["team"]?.trim() || "",
      teamDiv: row["team-div"]?.trim() || "",
      date: row["date"]?.trim() || "",
      opp: row["opp"]?.trim() || "",
      oppDiv: row["opp-div"]?.trim() || "",
      location: row["location"]?.trim() || "",
      result: row["result"]?.trim() || "",
      teamScore: Number(row["team-score"]) || null,
      oppScore: Number(row["opp-score"]) || null,
      teamLine: Number(row["teamline"]) || null,
      teamWinPct: Number(row["teamwin%"]) || null,
    });
  })
  .on("end", () => {
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    console.log(`WIAA Team JSON written → ${OUTPUT}`);
  });