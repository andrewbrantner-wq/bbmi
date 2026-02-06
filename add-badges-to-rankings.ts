// add-badges-to-rankings.ts

import * as fs from 'fs';

export enum Badge {
  FORTRESS = "Fortress",
  LOCKDOWN = "Lockdown",
  ARC_DEFENDERS = "Arc Defenders",
  SHARPSHOOTERS = "Sharpshooters",
  MARKSMEN = "Marksmen",
  SCORCHERS = "Scorchers",
  DISTRIBUTORS = "Distributors",
  BALANCED = "Balanced",
  GLASS_CLEANERS = "Glass Cleaners",
  PICKPOCKETS = "Pickpockets",
  GIANT_SLAYERS = "Giant Slayers",
  BATTLE_TESTED = "Battle-Tested"
}

interface Team {
  team: string;
  conference: string;
  model_rank: number | string;
  record: string;
  kenpom_rank?: number | string;
  net_ranking?: number | string;
  last_ten?: string;
  pointMargin: number;
  turnoversForced: number;
  reboundsPerGame: number;
  pointsPerGame: number;
  fieldGoalPct: number;
  threePointPct: number;
  assistsPerGame: number;
  strengthOfSchedule: number | string;
  qualityWins: number | string;
  opponentFieldGoalPct: number;
  opponentThreePointPct: number;
  primaryBadge?: Badge;
  secondaryBadges?: Badge[];
}

// Fixed statistical thresholds
class BadgeThresholds {
  // Primary thresholds (strict - for earning badges)
  static readonly POINT_MARGIN_PRIMARY = 12.0;
  static readonly TURNOVERS_FORCED_PRIMARY = 15.0;
  static readonly REBOUNDS_PER_GAME_PRIMARY = 42.0;
  static readonly POINTS_PER_GAME_PRIMARY = 82.0;
  static readonly FIELD_GOAL_PCT_PRIMARY = 0.48;  // 48% as decimal
  static readonly THREE_POINT_PCT_PRIMARY = 0.38;  // 38% as decimal
  static readonly ASSISTS_PER_GAME_PRIMARY = 17.0;
  static readonly STRENGTH_OF_SCHEDULE_PRIMARY = 15;  // Top 15 ranking
  static readonly QUALITY_WINS_PRIMARY = 15;  // Top 15 ranking
  static readonly OPP_FIELD_GOAL_PCT_PRIMARY = 0.40;  // 40% as decimal
  static readonly OPP_THREE_POINT_PCT_PRIMARY = 0.32;  // 32% as decimal

  // Secondary thresholds (more lenient - for secondary badges)
  static readonly POINT_MARGIN_SECONDARY = 10.0;
  static readonly TURNOVERS_FORCED_SECONDARY = 13.5;
  static readonly REBOUNDS_PER_GAME_SECONDARY = 40.0;
  static readonly POINTS_PER_GAME_SECONDARY = 78.0;
  static readonly FIELD_GOAL_PCT_SECONDARY = 0.46;  // 46% as decimal
  static readonly THREE_POINT_PCT_SECONDARY = 0.36;  // 36% as decimal
  static readonly ASSISTS_PER_GAME_SECONDARY = 15.5;
  static readonly STRENGTH_OF_SCHEDULE_SECONDARY = 25;  // Top 25 ranking
  static readonly QUALITY_WINS_SECONDARY = 25;  // Top 25 ranking
  static readonly OPP_FIELD_GOAL_PCT_SECONDARY = 0.42;  // 42% as decimal
  static readonly OPP_THREE_POINT_PCT_SECONDARY = 0.335;  // 33.5% as decimal

  static printThresholds(): void {
    console.log('\n' + '='.repeat(80));
    console.log('BADGE ASSIGNMENT THRESHOLDS');
    console.log('='.repeat(80));
    console.log('\nPRIMARY BADGE THRESHOLDS:');
    console.log('-'.repeat(80));
    console.log(`Point Margin                  >= ${this.POINT_MARGIN_PRIMARY}`);
    console.log(`Turnovers Forced              >= ${this.TURNOVERS_FORCED_PRIMARY}`);
    console.log(`Rebounds Per Game             >= ${this.REBOUNDS_PER_GAME_PRIMARY}`);
    console.log(`Points Per Game               >= ${this.POINTS_PER_GAME_PRIMARY}`);
    console.log(`Field Goal %                  >= ${(this.FIELD_GOAL_PCT_PRIMARY * 100).toFixed(1)}%`);
    console.log(`Three Point %                 >= ${(this.THREE_POINT_PCT_PRIMARY * 100).toFixed(1)}%`);
    console.log(`Assists Per Game              >= ${this.ASSISTS_PER_GAME_PRIMARY}`);
    console.log(`Strength of Schedule Rank     <= ${this.STRENGTH_OF_SCHEDULE_PRIMARY} (Top 15)`);
    console.log(`Quality Wins Rank             <= ${this.QUALITY_WINS_PRIMARY} (Top 15)`);
    console.log(`Opponent FG% (lower is better) <= ${(this.OPP_FIELD_GOAL_PCT_PRIMARY * 100).toFixed(1)}%`);
    console.log(`Opponent 3PT% (lower is better) <= ${(this.OPP_THREE_POINT_PCT_PRIMARY * 100).toFixed(1)}%`);
    
    console.log('\nSECONDARY BADGE THRESHOLDS:');
    console.log('-'.repeat(80));
    console.log(`Point Margin                  >= ${this.POINT_MARGIN_SECONDARY}`);
    console.log(`Turnovers Forced              >= ${this.TURNOVERS_FORCED_SECONDARY}`);
    console.log(`Rebounds Per Game             >= ${this.REBOUNDS_PER_GAME_SECONDARY}`);
    console.log(`Points Per Game               >= ${this.POINTS_PER_GAME_SECONDARY}`);
    console.log(`Field Goal %                  >= ${(this.FIELD_GOAL_PCT_SECONDARY * 100).toFixed(1)}%`);
    console.log(`Three Point %                 >= ${(this.THREE_POINT_PCT_SECONDARY * 100).toFixed(1)}%`);
    console.log(`Assists Per Game              >= ${this.ASSISTS_PER_GAME_SECONDARY}`);
    console.log(`Strength of Schedule Rank     <= ${this.STRENGTH_OF_SCHEDULE_SECONDARY} (Top 25)`);
    console.log(`Quality Wins Rank             <= ${this.QUALITY_WINS_SECONDARY} (Top 25)`);
    console.log(`Opponent FG% (lower is better) <= ${(this.OPP_FIELD_GOAL_PCT_SECONDARY * 100).toFixed(1)}%`);
    console.log(`Opponent 3PT% (lower is better) <= ${(this.OPP_THREE_POINT_PCT_SECONDARY * 100).toFixed(1)}%`);
    console.log('='.repeat(80) + '\n');
  }
}

function assignBadges(teams: Team[]): void {
  for (const team of teams) {
    const primaryBadgeScores = new Map<Badge, number>();
    const secondaryBadgeScores = new Map<Badge, number>();

    // Check PRIMARY thresholds
    if (team.pointMargin >= BadgeThresholds.POINT_MARGIN_PRIMARY) {
      primaryBadgeScores.set(Badge.FORTRESS, team.pointMargin);
    } else if (team.pointMargin >= BadgeThresholds.POINT_MARGIN_SECONDARY) {
      secondaryBadgeScores.set(Badge.FORTRESS, team.pointMargin);
    }
    
    if (team.opponentFieldGoalPct <= BadgeThresholds.OPP_FIELD_GOAL_PCT_PRIMARY) {
      primaryBadgeScores.set(Badge.LOCKDOWN, 1 - team.opponentFieldGoalPct);
    } else if (team.opponentFieldGoalPct <= BadgeThresholds.OPP_FIELD_GOAL_PCT_SECONDARY) {
      secondaryBadgeScores.set(Badge.LOCKDOWN, 1 - team.opponentFieldGoalPct);
    }
    
    if (team.opponentThreePointPct <= BadgeThresholds.OPP_THREE_POINT_PCT_PRIMARY) {
      primaryBadgeScores.set(Badge.ARC_DEFENDERS, 1 - team.opponentThreePointPct);
    } else if (team.opponentThreePointPct <= BadgeThresholds.OPP_THREE_POINT_PCT_SECONDARY) {
      secondaryBadgeScores.set(Badge.ARC_DEFENDERS, 1 - team.opponentThreePointPct);
    }
    
    if (team.threePointPct >= BadgeThresholds.THREE_POINT_PCT_PRIMARY) {
      primaryBadgeScores.set(Badge.SHARPSHOOTERS, team.threePointPct);
    } else if (team.threePointPct >= BadgeThresholds.THREE_POINT_PCT_SECONDARY) {
      secondaryBadgeScores.set(Badge.SHARPSHOOTERS, team.threePointPct);
    }
    
    if (team.fieldGoalPct >= BadgeThresholds.FIELD_GOAL_PCT_PRIMARY) {
      primaryBadgeScores.set(Badge.MARKSMEN, team.fieldGoalPct);
    } else if (team.fieldGoalPct >= BadgeThresholds.FIELD_GOAL_PCT_SECONDARY) {
      secondaryBadgeScores.set(Badge.MARKSMEN, team.fieldGoalPct);
    }
    
    if (team.pointsPerGame >= BadgeThresholds.POINTS_PER_GAME_PRIMARY) {
      primaryBadgeScores.set(Badge.SCORCHERS, team.pointsPerGame);
    } else if (team.pointsPerGame >= BadgeThresholds.POINTS_PER_GAME_SECONDARY) {
      secondaryBadgeScores.set(Badge.SCORCHERS, team.pointsPerGame);
    }
    
    if (team.assistsPerGame >= BadgeThresholds.ASSISTS_PER_GAME_PRIMARY) {
      primaryBadgeScores.set(Badge.DISTRIBUTORS, team.assistsPerGame);
    } else if (team.assistsPerGame >= BadgeThresholds.ASSISTS_PER_GAME_SECONDARY) {
      secondaryBadgeScores.set(Badge.DISTRIBUTORS, team.assistsPerGame);
    }
    
    if (team.reboundsPerGame >= BadgeThresholds.REBOUNDS_PER_GAME_PRIMARY) {
      primaryBadgeScores.set(Badge.GLASS_CLEANERS, team.reboundsPerGame);
    } else if (team.reboundsPerGame >= BadgeThresholds.REBOUNDS_PER_GAME_SECONDARY) {
      secondaryBadgeScores.set(Badge.GLASS_CLEANERS, team.reboundsPerGame);
    }
    
    if (team.turnoversForced >= BadgeThresholds.TURNOVERS_FORCED_PRIMARY) {
      primaryBadgeScores.set(Badge.PICKPOCKETS, team.turnoversForced);
    } else if (team.turnoversForced >= BadgeThresholds.TURNOVERS_FORCED_SECONDARY) {
      secondaryBadgeScores.set(Badge.PICKPOCKETS, team.turnoversForced);
    }
    
    // Quality Wins - RANK (lower is better)
    const qwRank = Number(team.qualityWins);
    if (qwRank > 0 && qwRank <= BadgeThresholds.QUALITY_WINS_PRIMARY) {
      primaryBadgeScores.set(Badge.GIANT_SLAYERS, 100 - qwRank);
    } else if (qwRank > 0 && qwRank <= BadgeThresholds.QUALITY_WINS_SECONDARY) {
      secondaryBadgeScores.set(Badge.GIANT_SLAYERS, 100 - qwRank);
    }
    
    // Strength of Schedule - RANK (lower is better)
    const sosRank = Number(team.strengthOfSchedule);
    if (sosRank > 0 && sosRank <= BadgeThresholds.STRENGTH_OF_SCHEDULE_PRIMARY) {
      primaryBadgeScores.set(Badge.BATTLE_TESTED, 100 - sosRank);
    } else if (sosRank > 0 && sosRank <= BadgeThresholds.STRENGTH_OF_SCHEDULE_SECONDARY) {
      secondaryBadgeScores.set(Badge.BATTLE_TESTED, 100 - sosRank);
    }

    // Assign primary badge
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
      team.primaryBadge = Badge.BALANCED;
      team.secondaryBadges = [];
    }
  }
}

function generateReport(teams: Team[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BADGE DISTRIBUTION SUMMARY');
  console.log('='.repeat(80) + '\n');

  const badgeCount = new Map<Badge, number>();
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

  const teamsWithSpecialty = teams.filter(t => t.primaryBadge !== Badge.BALANCED).length;
  console.log('\n' + '-'.repeat(80));
  console.log(`Total teams: ${teams.length}`);
  console.log(`Teams with specialty badge: ${teamsWithSpecialty} (${((teamsWithSpecialty / teams.length) * 100).toFixed(1)}%)`);
  console.log(`Teams with Balanced badge: ${teams.length - teamsWithSpecialty} (${(((teams.length - teamsWithSpecialty) / teams.length) * 100).toFixed(1)}%)`);
  
  const teamsWithSecondary = teams.filter(t => t.secondaryBadges && t.secondaryBadges.length > 0).length;
  console.log(`Teams with secondary badges: ${teamsWithSecondary} (${((teamsWithSecondary / teams.length) * 100).toFixed(1)}%)`);
  console.log('='.repeat(80) + '\n');
}

function main(): void {
  try {
    const inputFile = 'src/data/rankings/rankings.json';
    const outputFile = 'src/data/rankings/rankings.json';

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

// Just call main directly
main();