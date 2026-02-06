const fs = require('fs');
const path = require('path');

// Read the CSV file
const csvPath = 'C:\\Users\\andre\\BoundScraper\\team-stats.csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Parse CSV
const lines = csvContent.trim().split('\n');
const headers = lines[0].split(',').map(h => h.trim());

console.log('Headers:', headers);

// Build team stats object
const teamStatsMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split(',').map(v => v.trim());
  const division = values[0];
  const team = values[1];
  const stat = values[2];
  const value = values[3];
  
  if (!team || !stat) continue;
  
  const key = team.toLowerCase();
  if (!teamStatsMap.has(key)) {
    teamStatsMap.set(key, { division, team });
  }
  
  const teamStats = teamStatsMap.get(key);
  
  // Map stat names to our field names
  switch(stat) {
    case 'Points Scored':
      teamStats.pointsScored = parseFloat(value) || 0;
      break;
    case 'Points Against':
      teamStats.pointsGivenUp = parseFloat(value) || 0;
      break;
    case 'Point Difference':
      teamStats.pointDifferential = parseFloat(value) || 0;
      break;
    case 'Field Goal Percentage':
      teamStats.fieldGoalPct = parseFloat(value.replace('%', '')) / 100 || 0;
      break;
    case 'Three Point Percentage':
      teamStats.threePointPct = parseFloat(value.replace('%', '')) / 100 || 0;
      break;
    case 'Rebounds Per Game':
      teamStats.rebounds = parseFloat(value) || 0;
      break;
    case 'Assists Per Game':
      teamStats.assists = parseFloat(value) || 0;
      break;
    case 'Steals Per Game':
      teamStats.steals = parseFloat(value) || 0;
      break;
    case 'Blocks Per Game':
      teamStats.blocks = parseFloat(value) || 0;
      break;
    case 'Turnovers Per Game':
      teamStats.turnovers = parseFloat(value) || 0;
      break;
  }
}

console.log(`Parsed ${teamStatsMap.size} teams from CSV`);

// Read existing rankings
const rankingsPath = path.join(__dirname, 'src/data/wiaa-rankings/WIAArankings-with-slugs.json');
const rankings = JSON.parse(fs.readFileSync(rankingsPath, 'utf-8'));

console.log(`Found ${rankings.length} teams in rankings JSON`);

// Merge stats into rankings
let matchCount = 0;
const mergedRankings = rankings.map(team => {
  const stats = teamStatsMap.get(team.team.toLowerCase());
  
  if (stats) {
    matchCount++;
    return {
      ...team,
      pointsScored: stats.pointsScored || 0,
      pointsGivenUp: stats.pointsGivenUp || 0,
      pointDifferential: stats.pointDifferential || 0,
      fieldGoalPct: stats.fieldGoalPct || 0,
      threePointPct: stats.threePointPct || 0,
      rebounds: stats.rebounds || 0,
      assists: stats.assists || 0,
      steals: stats.steals || 0,
      blocks: stats.blocks || 0,
      turnovers: stats.turnovers || 0,
      qualityWins: 0  // We'll calculate this later or add from another source
    };
  }
  
  return team;
});

// Write merged data back
fs.writeFileSync(rankingsPath, JSON.stringify(mergedRankings, null, 2));

console.log('✓ Team stats merged into rankings JSON');
console.log(`Matched ${matchCount} of ${rankings.length} teams`);
console.log(`Sample team:`, mergedRankings[0]);