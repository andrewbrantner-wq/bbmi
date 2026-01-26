"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import BBMILogo from "@/components/BBMILogo";
import rankings from "@/data/wiaa-rankings/WIAArankings.json";
import scheduleRaw from "@/data/wiaa-team/WIAA-team.json";

// Ranking JSON type
type RankingRow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
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

export default function TeamClient({ params }: { params: { team: string } }) {
  const teamName = decodeURIComponent(params.team);

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
            url: `https://bbmihoops.com/wiaa-team/${params.team}`,
            memberOf: {
              "@type": "SportsOrganization",
              name: "WIAA Boys Varsity Basketball",
            },
            additionalProperty: [
              { "@type": "PropertyValue", name: "Division", value: teamInfo.division },
              { "@type": "PropertyValue", name: "BBMI Rank", value: teamInfo.bbmi_rank },
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
            <h1 className="text-3xl font-bold tracking-tightest leading-tight text-center">
              {teamInfo.team}
              <span className="text-stone-500 font-medium">
                {" "}
                | D{teamInfo.division} | BBMI Rank {teamInfo.bbmi_rank} |{" "}
                {teamInfo.record}
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

          {/* Remaining Games */}
          <h2 className="text-2xl font-bold tracking-tightest mb-4">
            Remaining Games
          </h2>

          <div className="rankings-table mb-12">
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

                      <td>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(g.opponent)}`}
                          className="hover:underline cursor-pointer"
                        >
                          {g.opponent}
                        </Link>
                      </td>

                      <td>{g.opp_div}</td>
                      <td>{g.location}</td>

                      <td className="text-right font-mono">{g.teamline}</td>

                      <td className="text-right font-mono">
                        {isBlankLine(g.teamline) ? "" : formatPct(g.teamwinpct)}
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

          <div className="rankings-table">
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

                      <td>
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(g.opponent)}`}
                          className="hover:underline cursor-pointer"
                        >
                          {g.opponent}
                        </Link>
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
    </>
  );
}