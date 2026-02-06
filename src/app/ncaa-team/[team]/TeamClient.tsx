"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";
import rankings from "@/data/rankings/rankings.json";
import scoresRaw from "@/data/ncaa-team/ncaa-scores.json";
import seedingData from "@/data/seeding/seeding.json";

// Ranking JSON type
type RankingRow = {
  team: string;
  conference: string;
  model_rank: number | string;  // Can be either
  record: string;
  kenpom_rank?: number | string;
  net_ranking?: number | string;
};

// Seeding data type
type SeedingRow = {
  Team?: string;
  team?: string;
  CurrentSeed?: number | string;
  currentSeed?: number | string;
  Seed?: number | string;
  Region?: string;
  region?: string;
  RoundOf32Pct?: number;
  roundOf32Pct?: number;
  Sweet16Pct?: number;
  sweet16Pct?: number;
  R16?: number;
  Elite8Pct?: number;
  elite8Pct?: number;
  R8?: number;
  FinalFourPct?: number;
  finalFourPct?: number;
  R4?: number;
  ChampionshipPct?: number;
  championshipPct?: number;
  Final?: number;
  WinTitlePct?: number;
  winTitlePct?: number;
  WinPct?: number;
};

// Raw scores JSON type
type RawScoreRow = {
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

// Normalized game type
type GameRow = {
  date: string;
  opponent: string;
  location: "Home" | "Away";
  result: "W" | "L" | "";
  team_score: number | null;
  opp_score: number | null;
};

// Build a map: team → rank for quick lookups
const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.model_rank)])
);

const getRank = (team: string): number | null => {
  return rankMap.get(team.toLowerCase()) ?? null;
};

export default function TeamClient({ params }: { params: { team: string } }) {
  const teamName = decodeURIComponent(params.team);

  const teamInfo = useMemo(() => {
    return (rankings as RankingRow[]).find(
      (t) => t.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName]);

  if (!teamInfo) return notFound();

  // Process games for this team
  const games = useMemo<GameRow[]>(() => {
    const teamGames: GameRow[] = [];
    
    (scoresRaw as RawScoreRow[]).forEach((game) => {
      const isHome = game.homeTeam.toLowerCase() === teamName.toLowerCase();
      const isAway = game.awayTeam.toLowerCase() === teamName.toLowerCase();
      
      if (!isHome && !isAway) return;
      
      const opponent = isHome ? game.awayTeam : game.homeTeam;
      const teamScore = isHome ? game.homeScore : game.awayScore;
      const oppScore = isHome ? game.awayScore : game.homeScore;
      
      let result: "W" | "L" | "" = "";
      if (teamScore !== null && oppScore !== null) {
        result = teamScore > oppScore ? "W" : "L";
      }
      
      teamGames.push({
        date: game.gameDate,
        opponent,
        location: isHome ? "Home" : "Away",
        result,
        team_score: teamScore,
        opp_score: oppScore,
      });
    });
    
    // Sort by date (most recent first)
    return teamGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teamName]);

  const playedGames = games.filter(
    (g) => g.team_score !== null && g.opp_score !== null
  );
  const remainingGames = games.filter(
    (g) => g.team_score === null || g.opp_score === null
  );

  // Find seeding/tournament data for this team
  const seedingInfo = useMemo(() => {
    const rawSeeding = seedingData as SeedingRow[];
    const teamSeeding = rawSeeding.find(
      (s) => {
        const sTeam = String(s.Team || s.team || "").toLowerCase();
        return sTeam === teamName.toLowerCase();
      }
    );

    if (!teamSeeding) return null;

    // Helper to parse probability values
    const parseProb = (val: any): number => {
      if (val == null) return 0;
      const num = Number(val);
      if (isNaN(num)) return 0;
      // If value is > 1, assume it's already a percentage, otherwise convert
      return num > 1 ? num : num * 100;
    };

    return {
      seed: Number(teamSeeding.CurrentSeed || teamSeeding.currentSeed || teamSeeding.Seed || 0),
      region: String(teamSeeding.Region || teamSeeding.region || ""),
      roundOf32: parseProb(teamSeeding.RoundOf32Pct || teamSeeding.roundOf32Pct || 0),
      sweet16: parseProb(teamSeeding.Sweet16Pct || teamSeeding.sweet16Pct || teamSeeding.R16 || 0),
      elite8: parseProb(teamSeeding.Elite8Pct || teamSeeding.elite8Pct || teamSeeding.R8 || 0),
      final4: parseProb(teamSeeding.FinalFourPct || teamSeeding.finalFourPct || teamSeeding.R4 || 0),
      championship: parseProb(teamSeeding.ChampionshipPct || teamSeeding.championshipPct || teamSeeding.Final || 0),
      winTitle: parseProb(teamSeeding.WinTitlePct || teamSeeding.winTitlePct || teamSeeding.WinPct || 0),
    };
  }, [teamName]);

  const resultColor = (r: string) => {
    if (r === "W") return "text-green-600 font-semibold";
    if (r === "L") return "text-red-600 font-semibold";
    return "text-stone-700";
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      const date = new Date(d);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return d;
    }
  };

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsTeam",
            name: teamInfo.team,
            sport: "Basketball",
            url: `https://bbmihoops.com/ncaa-team/${params.team}`,
            memberOf: {
              "@type": "SportsOrganization",
              name: "NCAA Men's Basketball",
            },
            additionalProperty: [
              { "@type": "PropertyValue", name: "Conference", value: teamInfo.conference },
              { "@type": "PropertyValue", name: "BBMI Rank", value: teamInfo.model_rank },
              { "@type": "PropertyValue", name: "Record", value: teamInfo.record },
            ],
          }),
        }}
      />

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">
          {/* Header */}
          <div className="mt-10 flex flex-col items-center mb-2">
            <BBMILogo />
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight text-center gap-3">
              <LogoBadge league="ncaa" className="h-10" />
              <div>
                {teamInfo.team}
                <div className="text-lg text-stone-500 font-medium mt-1">
                  {teamInfo.conference} | BBMI Rank {teamInfo.model_rank} | {teamInfo.record}
                  {teamInfo.kenpom_rank && ` | KenPom ${teamInfo.kenpom_rank}`}
                  {teamInfo.net_ranking && ` | NET ${teamInfo.net_ranking}`}
                </div>
              </div>
            </h1>
          </div>

          {/* Back Button */}
          <div className="w-full mb-6">
            <Link
              href="/ncaa-rankings"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Rankings
            </Link>
          </div>

          {/* Bracket Pulse - Tournament Projections */}
          {seedingInfo && seedingInfo.seed > 0 && (
            <>
              <h2 className="text-2xl font-bold tracking-tightest mb-4">
                NCAA Tournament Projection
              </h2>

              <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
                <div className="rankings-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Projected Seed</th>
                        <th>Region</th>
                        <th>Round of 32</th>
                        <th>Sweet 16</th>
                        <th>Elite 8</th>
                        <th>Final Four</th>
                        <th>Championship</th>
                        <th>Win Title</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr className="bg-white">
                        <td className="text-center font-bold text-lg">
                          {seedingInfo.seed}
                        </td>
                        <td className="text-center font-semibold">
                          {seedingInfo.region || "—"}
                        </td>
                        <td className="text-center">
                          {seedingInfo.roundOf32 > 0 ? `${seedingInfo.roundOf32.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center">
                          {seedingInfo.sweet16 > 0 ? `${seedingInfo.sweet16.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center">
                          {seedingInfo.elite8 > 0 ? `${seedingInfo.elite8.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center">
                          {seedingInfo.final4 > 0 ? `${seedingInfo.final4.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center">
                          {seedingInfo.championship > 0 ? `${seedingInfo.championship.toFixed(1)}%` : "—"}
                        </td>
                        <td className="text-center font-semibold text-blue-600">
                          {seedingInfo.winTitle > 0 ? `${seedingInfo.winTitle.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-stone-600 mb-10 text-center italic">
                Probabilities based on Monte Carlo simulation. Visit Bracket Pulse for full tournament projections.
              </p>
            </>
          )}

          {/* Remaining Games */}
          {remainingGames.length > 0 && (
            <>
              <h2 className="text-2xl font-bold tracking-tightest mb-4">
                Remaining Games
              </h2>

              <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
                <div className="rankings-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Opponent</th>
                        <th>Location</th>
                      </tr>
                    </thead>

                    <tbody>
                      {remainingGames.map((g, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                        >
                          <td>{formatDate(g.date)}</td>
                          <td>
                            <Link
                              href={`/ncaa-team/${encodeURIComponent(g.opponent)}`}
                              className="hover:underline cursor-pointer"
                            >
                              {g.opponent}
                              {getRank(g.opponent) !== null && (
                                <span 
                                  className="ml-1"
                                  style={{ 
                                    fontSize: '0.65rem',
                                    fontStyle: 'italic',
                                    fontWeight: getRank(g.opponent)! <= 25 ? 'bold' : 'normal',
                                    color: getRank(g.opponent)! <= 25 ? '#dc2626' : '#78716c'
                                  }}
                                >
                                  (#{getRank(g.opponent)})
                                </span>
                              )}
                            </Link>
                          </td>
                          <td>{g.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Played Games */}
          <h2 className="text-2xl font-bold tracking-tightest mb-4">
            Played Games
          </h2>

          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Location</th>
                    <th>Result</th>
                    <th className="text-right">Team Score</th>
                    <th className="text-right">Opp Score</th>
                  </tr>
                </thead>

                <tbody>
                  {playedGames.map((g, i) => (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                    >
                      <td>{formatDate(g.date)}</td>
                      <td>
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(g.opponent)}`}
                          className="hover:underline cursor-pointer"
                        >
                          {g.opponent}
                          {getRank(g.opponent) !== null && (
                            <span 
                              className="ml-1"
                              style={{ 
                                fontSize: '0.65rem',
                                fontStyle: 'italic',
                                fontWeight: getRank(g.opponent)! <= 25 ? 'bold' : 'normal',
                                color: getRank(g.opponent)! <= 25 ? '#dc2626' : '#78716c'
                              }}
                            >
                              (#{getRank(g.opponent)})
                            </span>
                          )}
                        </Link>
                      </td>
                      <td>{g.location}</td>
                      <td className={resultColor(g.result)}>{g.result}</td>
                      <td className="text-right font-mono">{g.team_score}</td>
                      <td className="text-right font-mono">{g.opp_score}</td>
                    </tr>
                  ))}

                  {playedGames.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-stone-500">
                        No completed games.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
