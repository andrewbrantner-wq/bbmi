import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputCsv = path.join(__dirname, 'src', 'data', 'ncaa-team', 'ncaa-scores.csv');
const outputJson = path.join(__dirname, 'src', 'data', 'ncaa-team', 'ncaa-scores.json');

console.log('Converting NCAA scores CSV to JSON...');
console.log('Input:', inputCsv);
console.log('Output:', outputJson);

const rows = [];

fs.createReadStream(inputCsv)
  .pipe(csv())
  .on('data', (row) => {
    // Clean up the data
    const cleaned = {
      gameDate: row.GameDate || '',
      homeTeam: row.HomeTeam || '',
      awayTeam: row.AwayTeam || '',
      homeScore: row.HomeScore !== '' ? Number(row.HomeScore) : null,
      awayScore: row.AwayScore !== '' ? Number(row.AwayScore) : null,
    };
    
    rows.push(cleaned);
  })
  .on('end', () => {
    // Ensure output directory exists
    const dir = path.dirname(outputJson);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write JSON
    fs.writeFileSync(outputJson, JSON.stringify(rows, null, 2));
    
    console.log(`✓ Converted ${rows.length} games to JSON`);
    console.log(`✓ Output: ${outputJson}`);
  })
  .on('error', (err) => {
    console.error('ERROR:', err);
    process.exit(1);
  });

