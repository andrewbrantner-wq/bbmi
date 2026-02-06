import * as fs from 'fs';

export enum WIAABadge {
  SCORCHERS = "Scorchers",
  SHARPSHOOTERS = "Sharpshooters",
  MARKSMEN = "Marksmen",
  PLAYMAKERS = "Playmakers",
  FORTRESS = "Fortress",
  LOCKDOWN = "Lockdown",
  PICKPOCKETS = "Pickpockets",
  RIM_PROTECTORS = "Rim Protectors",
  GLASS_CLEANERS = "Glass Cleaners",
  GIANT_SLAYERS = "Giant Slayers",
  BALANCED = "Balanced"
}

interface Team {
  division: number;
  team: string;
  record: string;
  conf_record: string;
  bbmi_rank: number;
  slug: string;
  pointsScored: number;
  pointsGivenUp: number;
  pointDifferential: number;
  fieldGoalPct: number;
  threePointPct: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  qualityWins: number;
  primaryBadge?: WIAABadge;
  secondaryBadges?: WIAABadge[];
}

class BadgeThresholds {
  // Primary thresholds (strict)
  static readonly POINTS_SCORED_PRIMARY = 75.0;
  static readonly THREE_POINT_PCT_PRIMARY = 0.33;
  static readonly FIELD_GOAL_PCT_PRIMARY = 0.44;
  static readonly ASSISTS_PRIMARY = 14.0;
  static readonly POINTS_GIVEN_UP_PRIMARY = 55.0;
  static readonly POINT_DIFFERENTIAL_PRIMARY = 10.0;
  static readonly STEALS_PRIMARY = 6.5;
  static readonly BLOCKS_PRIMARY = 3.5;
  static readonly REBOUNDS_PRIMARY = 34.0;
  static readonly QUALITY_WINS_PRIMARY = 5;

  // Secondary thresholds (lenient)
  static readonly POINTS_SCORED_SECONDARY = 67.0;
  static readonly THREE_POINT_PCT_SECONDARY = 0.31;
  static readonly FIELD_GOAL_PCT_SECONDARY = 0.42;
  static readonly ASSISTS_SECONDARY = 12.0;
  static readonly POINTS_GIVEN_UP_SECONDARY = 60.0;
  static readonly POINT_DIFFERENTIAL_SECONDARY = 8.0;
  static readonly STEALS_SECONDARY = 5.5;
  static readonly BLOCKS_SECONDARY = 3.0;
  static readonly REBOUNDS_SECONDARY = 31.0;
  static readonly QUALITY_WINS_SECONDARY = 3;

  static printThresholds(): void {
    console.log('\n' + '='.repeat(80));
    console.log('WIAA BADGE ASSIGNMENT THRESHOLDS');
    console.log('='.repeat(80));
    console.log('\nPRIMARY BADGE THRESHOLDS:');
    console.log('-'.repeat(80));
    console.log(`Points Scored               >= ${this.POINTS_SCORED_PRIMARY}`);
    console.log(`3PT%                        >= ${(this.THREE_POINT_PCT_PRIMARY * 100).toFixed(1)}%`);
    console.log(`FG%                         >= ${(this.FIELD_GOAL_PCT_PRIMARY * 100).toFixed(1)}%`);
    console.log(`Assists                     >= ${this.ASSISTS_PRIMARY}`);
    console.log(`Points Given Up (lower)     <= ${this.POINTS_GIVEN_UP_PRIMARY}`);
    console.log(`Point Differential          >= ${this.POINT_DIFFERENTIAL_PRIMARY}`);
    console.log(`Steals                      >= ${this.STEALS_PRIMARY}`);
    console.log(`Blocks                      >= ${this.BLOCKS_PRIMARY}`);
    console.log(`Rebounds                    >= ${this.REBOUNDS_PRIMARY}`);
    console.log(`Quality Wins                >= ${this.QUALITY_WINS_PRIMARY}`);
    console.log('='.repeat(80) + '\n');
  }
}

function assignBadges(teams: Team[]): void {
  for (const team of teams) {
    const primaryBadgeScores = new Map<WIAABadge, number>();
    const secondaryBadgeScores = new Map<WIAABadge, number>();

    // SCORCHERS - High points scored
    if (team.pointsScored >= BadgeThresholds.POINTS_SCORED_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.SCORCHERS, team.pointsScored);
    } else if (team.pointsScored >= BadgeThresholds.POINTS_SCORED_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.SCORCHERS, team.pointsScored);
    }

    // SHARPSHOOTERS - Elite 3PT%
    if (team.threePointPct >= BadgeThresholds.THREE_POINT_PCT_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.SHARPSHOOTERS, team.threePointPct);
    } else if (team.threePointPct >= BadgeThresholds.THREE_POINT_PCT_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.SHARPSHOOTERS, team.threePointPct);
    }

    // MARKSMEN - Elite FG%
    if (team.fieldGoalPct >= BadgeThresholds.FIELD_GOAL_PCT_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.MARKSMEN, team.fieldGoalPct);
    } else if (team.fieldGoalPct >= BadgeThresholds.FIELD_GOAL_PCT_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.MARKSMEN, team.fieldGoalPct);
    }

    // PLAYMAKERS - High assists
    if (team.assists >= BadgeThresholds.ASSISTS_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.PLAYMAKERS, team.assists);
    } else if (team.assists >= BadgeThresholds.ASSISTS_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.PLAYMAKERS, team.assists);
    }

    // FORTRESS - Low points given up (lower is better)
    if (team.pointsGivenUp <= BadgeThresholds.POINTS_GIVEN_UP_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.FORTRESS, 100 - team.pointsGivenUp);
    } else if (team.pointsGivenUp <= BadgeThresholds.POINTS_GIVEN_UP_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.FORTRESS, 100 - team.pointsGivenUp);
    }

    // LOCKDOWN - Elite point differential
    if (team.pointDifferential >= BadgeThresholds.POINT_DIFFERENTIAL_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.LOCKDOWN, team.pointDifferential);
    } else if (team.pointDifferential >= BadgeThresholds.POINT_DIFFERENTIAL_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.LOCKDOWN, team.pointDifferential);
    }

    // PICKPOCKETS - High steals
    if (team.steals >= BadgeThresholds.STEALS_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.PICKPOCKETS, team.steals);
    } else if (team.steals >= BadgeThresholds.STEALS_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.PICKPOCKETS, team.steals);
    }

    // RIM PROTECTORS - High blocks
    if (team.blocks >= BadgeThresholds.BLOCKS_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.RIM_PROTECTORS, team.blocks);
    } else if (team.blocks >= BadgeThresholds.BLOCKS_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.RIM_PROTECTORS, team.blocks);
    }

    // GLASS CLEANERS - High rebounds
    if (team.rebounds >= BadgeThresholds.REBOUNDS_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.GLASS_CLEANERS, team.rebounds);
    } else if (team.rebounds >= BadgeThresholds.REBOUNDS_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.GLASS_CLEANERS, team.rebounds);
    }

    // GIANT SLAYERS - Quality wins
    if (team.qualityWins >= BadgeThresholds.QUALITY_WINS_PRIMARY) {
      primaryBadgeScores.set(WIAABadge.GIANT_SLAYERS, team.qualityWins);
    } else if (team.qualityWins >= BadgeThresholds.QUALITY_WINS_SECONDARY) {
      secondaryBadgeScores.set(WIAABadge.GIANT_SLAYERS, team.qualityWins);
    }

    // Assign primary badge (highest score)
    if (primaryBadgeScores.size > 0) {
      const primaryBadge = Array.from(primaryBadgeScores.entries())
        .reduce((a, b) => a[1] > b[1] ? a : b)[0];
      team.primaryBadge = primaryBadge;

      team.secondaryBadges = [];
      primaryBadgeScores.delete(primaryBadge);
      team.secondaryBadges.push(...Array.from(primaryBadgeScores.keys()));
      team.secondaryBadges.push(...Array.from(secondaryBadgeScores.keys()));
    } else if (secondaryBadgeScores.size > 0) {
      const primaryBadge = Array.from(secondaryBadgeScores.entries())
        .reduce((a, b) => a[1] > b[1] ? a : b)[0];
      team.primaryBadge = primaryBadge;
      
      team.secondaryBadges = [];
      secondaryBadgeScores.delete(primaryBadge);
      team.secondaryBadges.push(...Array.from(secondaryBadgeScores.keys()));
    } else {
      team.primaryBadge = WIAABadge.BALANCED;
      team.secondaryBadges = [];
    }
  }
}

function generateReport(teams: Team[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BADGE DISTRIBUTION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const badgeCount = new Map<WIAABadge, number>();
  for (const team of teams) {
    if (team.primaryBadge) {
      badgeCount.set(team.primaryBadge, (badgeCount.get(team.primaryBadge) || 0) + 1);
    }
  }

  const sortedBadges = Array.from(badgeCount.entries())
    .sort((a, b) => b[1] - a[1]);

  for (const [badge, count] of sortedBadges) {
    const percentage = ((count / teams.length) * 100).toFixed(1);
    console.log(`${badge.padEnd(20)}: ${count.toString().padStart(3)} teams (${percentage}%)`);
  }

  console.log('\n' + '-'.repeat(80));
  console.log(`Total teams: ${teams.length}`);
  const teamsWithSpecialty = teams.filter(t => t.primaryBadge !== WIAABadge.BALANCED).length;
  console.log(`Teams with specialty badge: ${teamsWithSpecialty} (${((teamsWithSpecialty / teams.length) * 100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');
}

function main(): void {
  try {
    const inputFile = 'src/data/wiaa-rankings/WIAArankings-with-slugs.json';
    const outputFile = 'src/data/wiaa-rankings/WIAArankings-with-slugs.json';

    BadgeThresholds.printThresholds();

    console.log(`Reading ${inputFile}...`);
    const data = fs.readFileSync(inputFile, 'utf-8');
    const teams: Team[] = JSON.parse(data);
    console.log(`Loaded ${teams.length} teams.\n`);

    console.log('Assigning badges...');
    assignBadges(teams);

    console.log(`Writing to ${outputFile}...`);
    fs.writeFileSync(outputFile, JSON.stringify(teams, null, 2), 'utf-8');

    generateReport(teams);

    console.log('✓ Badge assignment complete!');
    console.log(`Updated file: ${outputFile}\n`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();