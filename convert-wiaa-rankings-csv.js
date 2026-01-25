import fs from "fs";
import csv from "csv-parser";

const INPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-rankings/WIAArankings.csv";
const OUTPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-rankings/WIAArankings.json";

const results = [];

fs.createReadStream(INPUT)
  .pipe(csv())
  .on("data", (row) => {
    results.push({
      division: Number(row["division"]) || null,
      team: row["team"]?.trim() || "",
      record: row["record"]?.trim() || "",
      bbmi_rank: Number(row["ranking"]) || null
    });
  })
  .on("end", () => {
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    console.log(`WIAA Rankings JSON written → ${OUTPUT}`);
  });