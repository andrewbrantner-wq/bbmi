import fs from "fs";
import csv from "csv-parser";

const INPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-rankings/WIAArankings.csv";
const OUTPUT = "C:/Users/andre/dev/my-app/src/data/wiaa-rankings/WIAArankings.json";
const TIMESTAMP = OUTPUT + ".timestamp";   // ⭐ NEW

const results = [];

fs.createReadStream(INPUT)
  .pipe(csv())
  .on("data", (row) => {
    results.push({
      division: Number(row["division"]) || null,
      team: row["team"]?.trim() || "",
      record: row["record"]?.trim() || "",
      conf_record: row["conf_record"]?.trim() || "",  // ⭐ Conference record
      bbmi_rank: Number(row["ranking"]) || null
    });
  })
  .on("end", () => {
    // Write JSON
    fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
    console.log(`WIAA Rankings JSON written → ${OUTPUT}`);

    fs.writeFileSync(
      "C:/Users/andre/dev/my-app/public/data/wiaa-rankings/last_updated.txt",
      new Date().toISOString()
    );
  });
