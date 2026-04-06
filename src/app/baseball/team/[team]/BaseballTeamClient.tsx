"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import NCAALogo from "@/components/NCAALogo";
import ratingsRaw from "@/data/rankings/baseball-rankings.json";
import gamesRaw from "@/data/betting-lines/baseball-games.json";

// ── Types ────────────────────────────────────────────────────────

type TeamRating = {
  conference: string;
  rpi_rank: number;
  sos_rank: number;
  adj_runs_per_game: number;
  runs_allowed_per_game: number;
  scoring_margin: number;
  era: number;
  woba: number;
  record: string;
  wins: number;
  losses: number;
  home_record: string;
  road_record: string;
};

type Game = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  bbmiLine: number | null;
  bbmiTotal: number | null;
  vegasLine: number | null;
  vegasTotal: number | null;
  homeWinPct: number | null;
  edge: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homePitcher: string;
  awayPitcher: string;
  seriesGame: number;
};

type ScheduleRow = {
  date: string;
  opponent: string;
  location: "Home" | "Away";
  result: "W" | "L" | "";
  teamScore: number | null;
  oppScore: number | null;
  bbmiLine: number | null;
  vegasLine: number | null;
  edge: number | null;
  bbmiWinPct: number | null;
  pitcher: string;
  oppPitcher: string;
};

// ── Styles ───────────────────────────────────────────────────────

const TH: React.CSSProperties = { backgroundColor: "#1a7a6e", color: "#ffffff", padding: "8px 10px", textAlign: "left", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" };
const TH_C: React.CSSProperties = { ...TH, textAlign: "center" };
const TH_R: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
const TD_C: React.CSSProperties = { ...TD, textAlign: "center" };
const TD_R: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };
const CARD: React.CSSProperties = { border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" };

// ── Helpers ──────────────────────────────────────────────────────

const ratings = ratingsRaw as Record<string, Record<string, unknown>>;
const rpiMap = new Map(Object.entries(ratings).map(([name, d]) => [name.toLowerCase(), Number(d.rpi_rank ?? 999)]));
const getRPI = (team: string): number | null => {
  const r = rpiMap.get(team.toLowerCase());
  return r != null && r < 999 ? r : null;
};

function OpponentCell({ opponent }: { opponent: string }) {
  const rpi = getRPI(opponent);
  return (
    <td style={TD}>
      <Link href={`/baseball/team/${encodeURIComponent(opponent)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a" }} className="hover:underline">
        <NCAALogo teamName={opponent} size={24} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {opponent}
          {rpi !== null && (
            <span style={{ marginLeft: 4, fontSize: "0.65rem", fontStyle: "italic", fontWeight: rpi <= 25 ? 700 : 400, color: rpi <= 25 ? "#dc2626" : "#78716c" }}>
              (#{rpi})
            </span>
          )}
        </span>
      </Link>
    </td>
  );
}

function formatDate(d: string) {
  if (!d) return "";
  try {
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) return d;
    const cleaned = d.split("T")[0].split(" ")[0];
    const parts = cleaned.split(/[-\/]/);
    if (parts.length !== 3) return d;
    if (parts[0].length === 4) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return `${parts[0]}/${parts[1]}/${parts[2]}`;
  } catch { return d; }
}

// ── Main Component ───────────────────────────────────────────────

export default function BaseballTeamClient({ params }: { params: { team: string } }) {
  const teamName = decodeURIComponent(params.team);

  // Find team in ratings
  const teamInfo = useMemo(() => {
    const d = (ratings as Record<string, Record<string, unknown>>)[teamName];
    if (!d) return null;
    return {
      team: teamName,
      conference: String(d.conference ?? ""),
      model_rank: Number(d.model_rank ?? 999),
      bbmi_score: Number(d.bbmi_score ?? 0),
      rpi_rank: Number(d.rpi_rank ?? 999),
      sos_rank: Number(d.sos_rank ?? 999),
      adj_runs_per_game: Number(d.adj_runs_per_game ?? 0),
      runs_allowed_per_game: Number(d.runs_allowed_per_game ?? 0),
      scoring_margin: Number(d.scoring_margin ?? 0),
      era: Number(d.era ?? 0),
      woba: Number(d.woba ?? 0),
      record: String(d.record ?? ""),
      home_record: String(d.home_record ?? ""),
      road_record: String(d.road_record ?? ""),
    };
  }, [teamName]);

  // Build schedule from games.json
  const schedule = useMemo<ScheduleRow[]>(() => {
    const rows: ScheduleRow[] = [];
    (gamesRaw as Game[]).forEach(g => {
      const isHome = g.homeTeam === teamName;
      const isAway = g.awayTeam === teamName;
      if (!isHome && !isAway) return;

      const opponent = isHome ? g.awayTeam : g.homeTeam;
      const teamScore = isHome ? g.actualHomeScore : g.actualAwayScore;
      const oppScore = isHome ? g.actualAwayScore : g.actualHomeScore;
      let result: "W" | "L" | "" = "";
      if (teamScore != null && oppScore != null) result = teamScore > oppScore ? "W" : "L";

      // Win% from team's perspective
      const bbmiWinPct = isHome ? g.homeWinPct : (g.homeWinPct != null ? 1 - g.homeWinPct : null);

      rows.push({
        date: g.date,
        opponent,
        location: isHome ? "Home" : "Away",
        result,
        teamScore,
        oppScore,
        bbmiLine: g.bbmiLine,
        vegasLine: g.vegasLine,
        edge: g.edge,
        bbmiWinPct,
        pitcher: isHome ? g.homePitcher : g.awayPitcher,
        oppPitcher: isHome ? g.awayPitcher : g.homePitcher,
      });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [teamName]);

  const today = new Date().toLocaleDateString("en-CA");
  const playedGames = schedule.filter(g => g.teamScore != null && g.oppScore != null);
  const upcomingGames = schedule.filter(g => g.teamScore == null && g.date >= today);

  if (!teamInfo) return notFound();

  const resultStyle = (r: string): React.CSSProperties => ({
    fontWeight: 600,
    color: r === "W" ? "#16a34a" : r === "L" ? "#dc2626" : "#44403c",
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "SportsTeam", name: teamInfo.team, sport: "Baseball",
        url: `https://bbmisports.com/baseball/team/${params.team}`, memberOf: { "@type": "SportsOrganization", name: "NCAA D1 Baseball" },
        additionalProperty: [
          { "@type": "PropertyValue", name: "Conference", value: teamInfo.conference },
          { "@type": "PropertyValue", name: "RPI Rank", value: teamInfo.rpi_rank },
          { "@type": "PropertyValue", name: "Record", value: teamInfo.record },
        ],
      }) }} />

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
            <NCAALogo teamName={teamInfo.team} size={120} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <div style={{
                background: "#1a7a6e",
                borderRadius: 8, padding: "6px 14px",
                display: "flex", alignItems: "baseline", gap: 6,
              }}>
                <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#ffffff" }}>#{teamInfo.model_rank}</span>
                <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>({teamInfo.bbmi_score > 0 ? "+" : ""}{teamInfo.bbmi_score.toFixed(1)})</span>
              </div>
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#57534e", letterSpacing: "-0.01em", textAlign: "center", marginTop: 8 }}>
              {teamInfo.conference} | RPI #{teamInfo.rpi_rank} | {teamInfo.record}
              {teamInfo.home_record && ` | Home ${teamInfo.home_record}`}
              {teamInfo.road_record && ` | Road ${teamInfo.road_record}`}
            </h1>
          </div>

          {/* BACK LINK */}
          <div style={{ marginBottom: 24 }}>
            <Link href="/baseball/rankings" style={{ fontSize: 14, color: "#2563eb" }} className="hover:underline">
              ← Back to Rankings
            </Link>
          </div>

          {/* TEAM STATS CARD */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Team Statistics</h2>
            <div style={CARD}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                  <thead>
                    <tr>
                      {["R/G", "RA/G", "Margin", "SOS", "ERA", "wOBA"].map(h => (
                        <th key={h} style={TH_C}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: teamInfo.adj_runs_per_game >= 7 ? "#16a34a" : teamInfo.adj_runs_per_game >= 5.5 ? "#1a1a1a" : "#dc2626" }}>{teamInfo.adj_runs_per_game.toFixed(1)}</td>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: teamInfo.runs_allowed_per_game <= 4 ? "#16a34a" : teamInfo.runs_allowed_per_game <= 6 ? "#1a1a1a" : "#dc2626" }}>{teamInfo.runs_allowed_per_game.toFixed(1)}</td>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: teamInfo.scoring_margin > 0 ? "#16a34a" : "#dc2626" }}>{teamInfo.scoring_margin > 0 ? "+" : ""}{teamInfo.scoring_margin.toFixed(1)}</td>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>{teamInfo.sos_rank}</td>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: teamInfo.era <= 3.5 ? "#16a34a" : teamInfo.era <= 5.0 ? "#1a1a1a" : "#dc2626" }}>{teamInfo.era.toFixed(2)}</td>
                      <td style={{ ...TD_C, fontSize: 18, fontWeight: 800, color: teamInfo.woba >= 0.370 ? "#16a34a" : teamInfo.woba >= 0.300 ? "#1a1a1a" : "#dc2626" }}>{teamInfo.woba.toFixed(3)}</td>
                    </tr>
                    <tr>
                      {["Runs/game", "Runs allowed", "Run differential", "Strength of Sched.", "Earned Run Avg", "Weighted OBA"].map(label => (
                        <td key={label} style={{ ...TD_C, fontSize: "0.65rem", color: "#78716c", paddingTop: 2, paddingBottom: 12 }}>{label}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* UPCOMING GAMES */}
          {upcomingGames.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Upcoming Games</h2>
              <div style={CARD}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th style={TH}>Date</th>
                        <th style={TH}>Opponent</th>
                        <th style={TH_C}>Loc</th>
                        <th style={TH_C}>BBMI Win%</th>
                        <th style={TH_C}>Vegas</th>
                        <th style={TH_C}>BBMI</th>
                        <th style={TH_C}>Edge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingGames.map((g, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                          <td style={TD}>{formatDate(g.date)}</td>
                          <OpponentCell opponent={g.opponent} />
                          <td style={TD_C}>{g.location}</td>
                          <td style={{ ...TD_C, fontWeight: 700, color: g.bbmiWinPct != null && g.bbmiWinPct >= 0.5 ? "#16a34a" : "#dc2626" }}>
                            {g.bbmiWinPct != null ? `${(g.bbmiWinPct * 100).toFixed(0)}%` : "—"}
                          </td>
                          <td style={{ ...TD_R, fontSize: 12 }}>{g.vegasLine ?? "—"}</td>
                          <td style={{ ...TD_R, fontSize: 12 }}>{g.bbmiLine ?? "—"}</td>
                          <td style={{ ...TD_R, fontSize: 12, fontWeight: g.edge != null && Math.abs(g.edge) >= 3 ? 700 : 400, color: g.edge != null && Math.abs(g.edge) >= 3 ? "#16a34a" : "#57534e" }}>
                            {g.edge != null && g.vegasLine != null ? Math.abs(g.edge).toFixed(1) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PLAYED GAMES */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Played Games</h2>
            <div style={CARD}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={TH}>Date</th>
                      <th style={TH}>Opponent</th>
                      <th style={TH_C}>Loc</th>
                      <th style={TH_C}>Result</th>
                      <th style={TH_R}>Team</th>
                      <th style={TH_R}>Opp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playedGames.map((g, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                        <td style={TD}>{formatDate(g.date)}</td>
                        <OpponentCell opponent={g.opponent} />
                        <td style={TD_C}>{g.location}</td>
                        <td style={{ ...TD_C, ...resultStyle(g.result) }}>{g.result}</td>
                        <td style={TD_R}>{g.teamScore}</td>
                        <td style={TD_R}>{g.oppScore}</td>
                      </tr>
                    ))}
                    {playedGames.length === 0 && (
                      <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "#78716c", fontStyle: "italic", padding: "32px 0" }}>No completed games yet.</td></tr>
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
