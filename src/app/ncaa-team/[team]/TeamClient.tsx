"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import rankings from "@/data/rankings/rankings.json";
import scoresRaw from "@/data/ncaa-team/ncaa-scores.json";
import seedingData from "@/data/seeding/seeding.json";

type RankingRow = {
  team: string;
  conference: string;
  model_rank: number | string;
  record: string;
  kenpom_rank?: number | string;
  net_ranking?: number | string;
};

type SeedingRow = {
  Team?: string;
  team?: string;
  CurrentSeed?: number | string;
  currentSeed?: number | string;
  Seed?: number | string;
  Region?: string;
  region?: string;
  RoundOf32Pct?: number | string;
  roundOf32Pct?: number | string;
  Sweet16Pct?: number | string;
  sweet16Pct?: number | string;
  R16?: number | string;
  Elite8Pct?: number | string;
  elite8Pct?: number | string;
  R8?: number | string;
  FinalFourPct?: number | string;
  finalFourPct?: number | string;
  R4?: number | string;
  ChampionshipPct?: number | string;
  championshipPct?: number | string;
  Final?: number | string;
  WinTitlePct?: number | string;
  winTitlePct?: number | string;
  WinPct?: number | string;
};

type RawScoreRow = {
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
};

type GameRow = {
  date: string;
  opponent: string;
  location: "Home" | "Away";
  result: "W" | "L" | "";
  team_score: number | null;
  opp_score: number | null;
};

const normalizeTeamName = (name: string): string => {
  const nameMap: Record<string, string> = {
    "BYU": "Brigham Young",
    "UConn": "Uconn",
    "SMU": "Southern Methodist",
    "Mississippi St.": "Mississippi State",
  };
  return nameMap[name] || name;
};

const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.model_rank)])
);
const getRank = (team: string): number | null => rankMap.get(team.toLowerCase()) ?? null;

// ------------------------------------------------------------
// SHARED TABLE STYLES
// ------------------------------------------------------------

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "left",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 20,
  borderBottom: "2px solid rgba(255,255,255,0.1)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const TH_CENTER: React.CSSProperties = { ...TH, textAlign: "center" };
const TH_RIGHT: React.CSSProperties = { ...TH, textAlign: "right" };

const TD: React.CSSProperties = {
  padding: "8px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };
const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };

const CARD: React.CSSProperties = {
  border: "1px solid #e7e5e4",
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
};

// ------------------------------------------------------------
// OPPONENT CELL
// ------------------------------------------------------------

function OpponentCell({ opponent }: { opponent: string }) {
  const rank = getRank(opponent);
  return (
    <td style={TD}>
      <Link
        href={`/ncaa-team/${encodeURIComponent(opponent)}`}
        style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }}
        className="hover:underline"
      >
        <NCAALogo teamName={opponent} size={24} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {opponent}
          {rank !== null && (
            <span style={{
              marginLeft: 4,
              fontSize: "0.65rem",
              fontStyle: "italic",
              fontWeight: rank <= 25 ? 700 : 400,
              color: rank <= 25 ? "#dc2626" : "#78716c",
            }}>
              (#{rank})
            </span>
          )}
        </span>
      </Link>
    </td>
  );
}

// ------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------

export default function TeamClient({ params }: { params: { team: string } }) {
  const teamName = decodeURIComponent(params.team);

  const teamInfo = useMemo(() => {
    const normalizedName = normalizeTeamName(teamName);
    return (rankings as RankingRow[]).find(
      (t) => t.team.toLowerCase() === normalizedName.toLowerCase()
    );
  }, [teamName]);

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
    return teamGames.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [teamName]);

  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

  const playedGames = games.filter((g) => g.team_score !== null && g.opp_score !== null);
  const remainingGames = games.filter((g) => {
    if (g.team_score !== null && g.opp_score !== null) return false;
    const gameDate = g.date ? g.date.split("T")[0].split(" ")[0] : "";
    return gameDate >= today;
  });

  const seedingInfo = useMemo(() => {
    const rawSeeding = seedingData as SeedingRow[];
    const teamSeeding = rawSeeding.find(
      (s) => String(s.Team || s.team || "").toLowerCase() === teamName.toLowerCase()
    );
    if (!teamSeeding) return null;

    const parseProb = (val: number | string | undefined): number => {
      if (val == null) return 0;
      const num = Number(val);
      if (isNaN(num)) return 0;
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

  if (!teamInfo) return notFound();

  const resultStyle = (r: string): React.CSSProperties => ({
    fontWeight: 600,
    color: r === "W" ? "#16a34a" : r === "L" ? "#dc2626" : "#44403c",
  });

  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      // If already MM/DD/YYYY, return as-is
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) return d;
      // Strip time portion
      const cleaned = d.split("T")[0].split(" ")[0];
      const parts = cleaned.split(/[-\/]/);
      if (parts.length !== 3) return d;
      // YYYY-MM-DD -> MM/DD/YYYY
      if (parts[0].length === 4) {
        const [year, month, day] = parts;
        return `${month}/${day}/${year}`;
      }
      // Already M/D/Y order
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    } catch {
      return d;
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsTeam",
            name: teamInfo.team,
            sport: "Basketball",
            url: `https://bbmihoops.com/ncaa-team/${params.team}`,
            memberOf: { "@type": "SportsOrganization", name: "NCAA Men's Basketball" },
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

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
            <NCAALogo teamName={teamInfo.team} size={120} />
            <h1 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#57534e", letterSpacing: "-0.01em", textAlign: "center", marginTop: 12 }}>
              {teamInfo.conference} | BBMI Rank {teamInfo.model_rank} | {teamInfo.record}
              {teamInfo.kenpom_rank && ` | KenPom ${teamInfo.kenpom_rank}`}
              {teamInfo.net_ranking && ` | NET ${teamInfo.net_ranking}`}
            </h1>
          </div>

          {/* BACK LINK */}
          <div style={{ marginBottom: 24 }}>
            <Link href="/ncaa-rankings" style={{ fontSize: 14, color: "#2563eb" }} className="hover:underline">
              ← Back to Rankings
            </Link>
          </div>

          {/* TOURNAMENT PROJECTION */}
          {seedingInfo && seedingInfo.seed > 0 && (
            <div style={{ maxWidth: 800, margin: "0 auto 40px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>NCAA Tournament Projection</h2>
              <div style={CARD}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: 90 }} />
                      <col style={{ width: 90 }} />
                      <col />
                      <col />
                      <col />
                      <col />
                      <col />
                      <col />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={TH_CENTER}>Seed</th>
                        <th style={TH_CENTER}>Region</th>
                        <th style={TH_CENTER}>Rd of 32</th>
                        <th style={TH_CENTER}>Sweet 16</th>
                        <th style={TH_CENTER}>Elite 8</th>
                        <th style={TH_CENTER}>Final Four</th>
                        <th style={TH_CENTER}>Champ Game</th>
                        <th style={TH_CENTER}>Win Title</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ ...TD_CENTER, fontWeight: 700, fontSize: 16 }}>{seedingInfo.seed}</td>
                        <td style={{ ...TD_CENTER, fontWeight: 600 }}>{seedingInfo.region || "—"}</td>
                        <td style={TD_CENTER}>{seedingInfo.roundOf32 > 0 ? `${seedingInfo.roundOf32.toFixed(1)}%` : "—"}</td>
                        <td style={TD_CENTER}>{seedingInfo.sweet16 > 0 ? `${seedingInfo.sweet16.toFixed(1)}%` : "—"}</td>
                        <td style={TD_CENTER}>{seedingInfo.elite8 > 0 ? `${seedingInfo.elite8.toFixed(1)}%` : "—"}</td>
                        <td style={TD_CENTER}>{seedingInfo.final4 > 0 ? `${seedingInfo.final4.toFixed(1)}%` : "—"}</td>
                        <td style={TD_CENTER}>{seedingInfo.championship > 0 ? `${seedingInfo.championship.toFixed(1)}%` : "—"}</td>
                        <td style={{ ...TD_CENTER, fontWeight: 700, color: "#2563eb" }}>{seedingInfo.winTitle > 0 ? `${seedingInfo.winTitle.toFixed(1)}%` : "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#78716c", textAlign: "center", fontStyle: "italic", marginTop: 8 }}>
                Probabilities based on Monte Carlo simulation. Visit{" "}
                <Link href="/ncaa-bracket-pulse" style={{ color: "#2563eb" }} className="hover:underline">
                  Bracket Pulse
                </Link>{" "}
                for full tournament projections.
              </p>
            </div>
          )}

          {/* REMAINING GAMES */}
          {remainingGames.length > 0 && (
            <div style={{ maxWidth: 600, margin: "0 auto 40px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Remaining Games</h2>
              <div style={CARD}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <colgroup>
                      <col style={{ width: 100 }} />
                      <col style={{ minWidth: 180 }} />
                      <col style={{ width: 80 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={TH}>Date</th>
                        <th style={TH}>Opponent</th>
                        <th style={TH_CENTER}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remainingGames.map((g, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                          <td style={TD}>{formatDate(g.date)}</td>
                          <OpponentCell opponent={g.opponent} />
                          <td style={TD_CENTER}>{g.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PLAYED GAMES */}
          <div style={{ maxWidth: 760, margin: "0 auto 40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Played Games</h2>
            <div style={CARD}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <colgroup>
                    <col style={{ width: 100 }} />
                    <col style={{ minWidth: 180 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 60 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 70 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={TH}>Date</th>
                      <th style={TH}>Opponent</th>
                      <th style={TH_CENTER}>Location</th>
                      <th style={TH_CENTER}>Result</th>
                      <th style={TH_RIGHT}>Team</th>
                      <th style={TH_RIGHT}>Opp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playedGames.map((g, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={TD}>{formatDate(g.date)}</td>
                        <OpponentCell opponent={g.opponent} />
                        <td style={TD_CENTER}>{g.location}</td>
                        <td style={{ ...TD_CENTER, ...resultStyle(g.result) }}>{g.result}</td>
                        <td style={TD_RIGHT}>{g.team_score}</td>
                        <td style={TD_RIGHT}>{g.opp_score}</td>
                      </tr>
                    ))}
                    {playedGames.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ ...TD, textAlign: "center", color: "#78716c", fontStyle: "italic", padding: "32px 0" }}>
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
      </div>
    </>
  );
}
