"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";
import rankings from "@/data/rankings/rankings.json";
import scoresRaw from "@/data/ncaa-team/ncaa-scores.json";

// Ranking JSON type
type RankingRow = {
  team: string;
  conference: string;
  model_rank: number;
  record: string;
  kenpom_rank?: number;
  net_ranking?: number;
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
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), r.model_rank])
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
                                    fontSize: '0.85rem',
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
                                fontSize: '0.85rem',
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
