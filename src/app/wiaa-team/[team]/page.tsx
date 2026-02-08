"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import { WIAATeamBadges } from "@/components/WIAATeamBadge";
import rankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import scheduleRaw from "@/data/wiaa-team/WIAA-team.json";

// Ranking JSON type
type RankingRow = {
  division: number;
  team: string;
  record: string;
  conf_record: string;
  bbmi_rank: number | string;
  slug: string;
  primaryBadge?: string;
  secondaryBadges?: string[];
};

// Raw schedule JSON type
type RawGameRow = {
  team: string;
  teamDiv: string;
  date: string;
  opp: string;
  oppDiv: string;
  location: string;
  result: string;
  teamScore: number | string;
  oppScore: number | string;
  teamLine: number | string;
  teamWinPct: number | string;
};

// Normalized schedule type
type GameRow = {
  team: string;
  date: string;
  opponent: string;
  opp_div: number;
  location: string;
  result: string;
  team_score: number | string;
  opp_score: number | string;
  teamline: number | string;
  teamwinpct: number | string;
};

// Build a map: team → slug
const slugMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), r.slug])
);

const getSlug = (team: string) =>
  slugMap.get(team.toLowerCase()) ?? "";

// Build a map: team → rank for quick lookups
const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.bbmi_rank)])
);

const getRank = (team: string): number | null => {
  return rankMap.get(team.toLowerCase()) ?? null;
};

export default function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = use(params);
  const teamName = decodeURIComponent(team);

  const teamInfo = useMemo(() => {
    return (rankings as RankingRow[]).find(
      (t) => t.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName]);

  if (!teamInfo) return notFound();

  const normalizedGames = useMemo<GameRow[]>(() => {
    return (scheduleRaw as RawGameRow[]).map((g) => ({
      team: g.team,
      date: g.date,
      opponent: g.opp,
      opp_div: Number(g.oppDiv),
      location: g.location,
      result: g.result,
      team_score: g.teamScore,
      opp_score: g.oppScore,
      teamline: g.teamLine,
      teamwinpct: g.teamWinPct,
    }));
  }, []);

  const games = useMemo(() => {
    return normalizedGames.filter(
      (g) => g.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName, normalizedGames]);

  const playedGames = games.filter((g) => g.result && g.result.trim() !== "");
  const remainingGames = games.filter(
    (g) => !g.result || g.result.trim() === ""
  );

  const resultColor = (r: string) => {
    if (r === "W") return "text-green-600 font-semibold";
    if (r === "L") return "text-red-600 font-semibold";
    return "text-stone-700";
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const isoPart = d.split(" ")[0];
    const [year, month, day] = isoPart.split("-");
    return `${month}/${day}/${year}`;
  };

  const formatPct = (v: number | string) => {
    const num = Number(v);
    if (isNaN(num)) return v;
    return Math.round(num * 100) + "%";
  };

  const isBlankLine = (v: number | string) =>
    v === "" || v === null || v === undefined || isNaN(Number(v));

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-2">
          

          <h1 className="flex items-center justify-center gap-4 text-3xl font-bold tracking-tightest leading-tight mt-2">
            <TeamLogo slug={teamInfo.slug} size={100} />
            <span>
              {teamInfo.team}
              <span className="text-stone-500 font-medium">
                {" "}
                | D{teamInfo.division} | BBMI Rank {teamInfo.bbmi_rank} | {teamInfo.record}
                {teamInfo.conf_record && ` (${teamInfo.conf_record})`}
              </span>
            </span>
          </h1>
        </div>
        
        {/* Back Button */}
        <div className="w-full mb-6">
          <Link
            href="/wiaa-rankings"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Rankings
          </Link>
        </div>

        {/* Team Classification Badges */}
        {teamInfo.primaryBadge && (
          <WIAATeamBadges 
            primaryBadge={teamInfo.primaryBadge}
            secondaryBadges={teamInfo.secondaryBadges}
          />
        )}

        {/* Remaining Games */}
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
                  <th>Opp Div</th>
                  <th>Location</th>
                  <th className="text-right">BBMI Line</th>
                  <th className="text-right">BBMI WinProb</th>
                </tr>
              </thead>

              <tbody>
                {remainingGames.map((g, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                  >
                    <td>{formatDate(g.date)}</td>

                    {/* Opponent with logo */}
                    <td>
                      <div className="flex items-center">
                        <div className="min-w-[40px] flex justify-center mr-2">
                          <TeamLogo slug={getSlug(g.opponent)} size={26} />
                        </div>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(g.opponent)}`}
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
                      </div>
                    </td>

                    <td>{g.opp_div}</td>
                    <td>{g.location}</td>

                    <td className="text-right font-mono">{g.teamline}</td>

                    <td className="text-right font-mono">
                      {isBlankLine(g.teamline)
                        ? ""
                        : formatPct(g.teamwinpct)}
                    </td>
                  </tr>
                ))}

                {remainingGames.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-stone-500">
                      No remaining games.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

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
                  <th>Opp Div</th>
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

                    {/* Opponent with logo */}
                    <td>
                      <div className="flex items-center">
                        <div className="min-w-[40px] flex justify-center mr-2">
                          <TeamLogo slug={getSlug(g.opponent)} size={26} />
                        </div>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(g.opponent)}`}
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
                      </div>
                    </td>

                    <td>{g.opp_div}</td>
                    <td>{g.location}</td>

                    <td className={resultColor(g.result)}>{g.result}</td>

                    <td className="text-right font-mono">{g.team_score}</td>
                    <td className="text-right font-mono">{g.opp_score}</td>
                  </tr>
                ))}

                {playedGames.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-stone-500">
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
  );
}