"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import teamRatingsRaw from "@/data/rankings/mlb-rankings.json";
import playoffProbsRaw from "@/data/mlb-playoff-probs.json";
import gamesRaw from "@/data/betting-lines/mlb-games.json";

type PageProps = {
  params: Promise<{ teamName: string }>;
};

export default function MLBTeamPage({ params }: PageProps) {
  const { teamName } = use(params);
  const decoded = decodeURIComponent(teamName);
  const raw = teamRatingsRaw as Record<string, Record<string, unknown>>;
  const team = raw[decoded];

  if (!team) {
    return (
      <div className="section-wrapper">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-12 text-center">
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Team Not Found</h1>
          <p style={{ color: "#78716c", marginBottom: 24 }}>{decoded} is not in the BBMI MLB rankings.</p>
          <Link href="/mlb/rankings" style={{ color: "#2563eb", textDecoration: "underline" }}>{"\u2190"} Back to Rankings</Link>
        </div>
      </div>
    );
  }

  const bbmi = Number(team.bbmi_score ?? 100);
  const off = Number(team.off_rating ?? 100);
  const pit = Number(team.pit_rating ?? 100);
  const rank = Number(team.model_rank ?? 0);
  const record = String(team.record ?? "");
  const fip = Number(team.fip ?? 0);
  const era = Number(team.era ?? 0);
  const whip = Number(team.whip ?? 0);
  const k9 = Number(team.k_per_9 ?? 0);
  const wobaRaw = Number(team.woba_raw ?? 0);
  const wobaNeutral = Number(team.woba_neutral ?? 0);
  const ops = Number(team.ops ?? 0);
  const rpg = Number(team.runs_per_game ?? 0);
  const rapg = Number(team.runs_allowed_per_game ?? 0);
  const margin = Number(team.scoring_margin ?? 0);
  const pf = Number(team.park_factor ?? 1.0);

  const cardStyle: React.CSSProperties = {
    flex: "1 1 140px", padding: "16px 12px", textAlign: "center",
    borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff",
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* Dark hero header */}
        <div style={{ background: "#0a1628", borderRadius: 0, padding: 24, marginBottom: 24 }}>
          <Link href="/mlb/rankings" style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 16 }}>
            {"\u2190"} Back to Rankings
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <MLBLogo teamName={decoded} size={64} />
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#ffffff" }}>{decoded}</h1>
              <p style={{ fontSize: 14, color: "#94a3b8", margin: "4px 0 0" }}>
                BBMI Rank #{rank} {"\u00B7"} {record}
                {(() => {
                  const probs = (playoffProbsRaw as { results: Record<string, { projected_wins: number }> }).results?.[decoded];
                  if (!probs) return null;
                  const w = Math.round(probs.projected_wins);
                  const l = 162 - w;
                  return <> {"\u00B7"} Proj: {w}-{l}</>;
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Team Statistics Table */}
        {(() => {
          const allTeams = Object.entries(raw).map(([name, t]) => ({
            name,
            bbmi_score: Number(t.bbmi_score ?? 100),
            off_rating: Number(t.off_rating ?? 100),
            pit_rating: Number(t.pit_rating ?? 100),
            runs_per_game: Number(t.runs_per_game ?? 0),
            runs_allowed_per_game: Number(t.runs_allowed_per_game ?? 0),
            scoring_margin: Number(t.scoring_margin ?? 0),
            fip: Number(t.fip ?? 0),
            era: Number(t.era ?? 0),
            whip: Number(t.whip ?? 0),
            k_per_9: Number(t.k_per_9 ?? 0),
            woba_raw: Number(t.woba_raw ?? 0),
            woba_neutral: Number(t.woba_neutral ?? 0),
            ops: Number(t.ops ?? 0),
            park_factor: Number(t.park_factor ?? 1.0),
          }));

          const getRank = (key: string, higher_is_better: boolean) => {
            const sorted = [...allTeams].sort((a, b) => {
              const av = (a as unknown as Record<string, number>)[key] ?? 0;
              const bv = (b as unknown as Record<string, number>)[key] ?? 0;
              return higher_is_better ? bv - av : av - bv;
            });
            const idx = sorted.findIndex(t => t.name === decoded);
            return idx >= 0 ? idx + 1 : null;
          };

          const offenseStats = [
            { label: "Rating", value: off.toFixed(1), good: off >= 105, bad: off < 97, rank: getRank("off_rating", true) },
            { label: "R/G", value: rpg.toFixed(2), good: rpg >= 4.5, bad: rpg < 3.5, rank: getRank("runs_per_game", true) },
            { label: "wOBA", value: wobaNeutral.toFixed(3), good: wobaNeutral >= 0.330, bad: wobaNeutral < 0.300, rank: getRank("woba_neutral", true) },
            { label: "OPS", value: ops.toFixed(3), good: ops >= 0.750, bad: ops < 0.680, rank: getRank("ops", true) },
            { label: "Margin", value: (margin > 0 ? "+" : "") + margin.toFixed(2), good: margin > 0, bad: margin < 0, rank: getRank("scoring_margin", true) },
          ];

          const pitchingStats = [
            { label: "Rating", value: pit.toFixed(1), good: pit >= 105, bad: pit < 97, rank: getRank("pit_rating", true) },
            { label: "RA/G", value: rapg.toFixed(2), good: rapg <= 4.0, bad: rapg > 5.0, rank: getRank("runs_allowed_per_game", false) },
            { label: "FIP", value: fip.toFixed(2), good: fip <= 3.8, bad: fip > 4.5, rank: getRank("fip", false) },
            { label: "ERA", value: era.toFixed(2), good: era <= 3.8, bad: era > 4.5, rank: getRank("era", false) },
            { label: "WHIP", value: whip.toFixed(2), good: whip <= 1.20, bad: whip > 1.40, rank: getRank("whip", false) },
            { label: "K/9", value: k9.toFixed(1), good: k9 >= 9.0, bad: k9 < 7.0, rank: getRank("k_per_9", true) },
          ];

          const thStyle: React.CSSProperties = {
            backgroundColor: "#1e3a5f", color: "#ffffff", padding: "8px 12px",
            fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", textAlign: "center", whiteSpace: "nowrap",
          };
          const tdStyle = (s: { good: boolean; bad: boolean; rank: number | null }): React.CSSProperties => ({
            padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #f1f5f9",
            fontSize: 15, fontWeight: 700, color: s.good ? "#16a34a" : s.bad ? "#dc2626" : "#0a1628",
          });

          const renderTable = (title: string, stats: typeof offenseStats) => (
            <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ backgroundColor: "#0a1628", padding: "8px 16px", fontSize: "0.75rem", fontWeight: 700, color: "#f0c040", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {title}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {stats.map(s => <th key={s.label} style={thStyle}>{s.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {stats.map(s => (
                        <td key={s.label} style={tdStyle(s)}>
                          {s.value}
                          {s.rank != null && (
                            <div style={{ fontSize: 10, fontWeight: 600, color: s.rank <= 5 ? "#16a34a" : s.rank >= 26 ? "#dc2626" : "#94a3b8", marginTop: 2 }}>
                              #{s.rank}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );

          return (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {renderTable("Offense", offenseStats)}
                {renderTable("Pitching / Defense", pitchingStats)}
              </div>
              <div style={{ padding: "6px 12px", fontSize: 10, color: "#94a3b8", textAlign: "center", marginTop: 8 }}>
                BBMI Score: {bbmi.toFixed(1)} {"\u00B7"} Park Factor: {pf.toFixed(2)} {"\u00B7"} Rankings out of 30 MLB teams
              </div>
            </div>
          );
        })()}

        {/* Schedule */}
        <ScheduleSection teamName={decoded} />

        {/* Methodology note */}
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 32, backgroundColor: "#eff6ff", borderLeft: "4px solid #2563eb", borderRadius: 6, padding: "14px 18px" }}>
          <p style={{ margin: 0 }}>BBMI MLB rankings use a Negative Binomial model with FIP-based pitching, park-neutral wOBA offense, and Bayesian blending with prior-year data.</p>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            <Link href="/mlb/picks" style={{ color: "#2563eb", textDecoration: "underline" }}>View today&apos;s picks {"\u2192"}</Link>
          </p>
        </div>

      </div>
    </div>
  );
}


// ── Schedule Section ─────────────────────────────────────────────

type MLBGame = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  bbmiTotal: number | null;
  bbmiMargin: number | null;
  vegasTotal: number | null;
  vegasRunLine: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  ouEdge: number | null;
  ouPick: string | null;
  rlPick: string | null;
  rlConfidenceTier: number;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homePitcher: string;
  awayPitcher: string;
  homePitcherFIP: number | null;
  awayPitcherFIP: number | null;
};

type ScheduleRow = {
  date: string;
  opponent: string;
  location: "Home" | "Away";
  result: "W" | "L" | "";
  teamScore: number | null;
  oppScore: number | null;
  bbmiWinPct: number | null;
  vegasLine: string;
  bbmiPick: string;
  pitcher: string;
  oppPitcher: string;
};

const SCH_TH: React.CSSProperties = {
  backgroundColor: "#1e3a5f", color: "#ffffff", padding: "8px 12px",
  fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)",
  textAlign: "left", whiteSpace: "nowrap",
};
const SCH_TH_C: React.CSSProperties = { ...SCH_TH, textAlign: "center" };
const SCH_TH_R: React.CSSProperties = { ...SCH_TH, textAlign: "right" };
const SCH_TD: React.CSSProperties = { padding: "8px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" };
const SCH_TD_C: React.CSSProperties = { ...SCH_TD, textAlign: "center" };
const SCH_TD_R: React.CSSProperties = { ...SCH_TD, textAlign: "right" };

function formatScheduleDate(d: string) {
  try {
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  } catch { return d; }
}

function ScheduleSection({ teamName }: { teamName: string }) {
  const schedule = useMemo<ScheduleRow[]>(() => {
    const rows: ScheduleRow[] = [];
    (gamesRaw as MLBGame[]).forEach(g => {
      const isHome = g.homeTeam === teamName;
      const isAway = g.awayTeam === teamName;
      if (!isHome && !isAway) return;

      const opponent = isHome ? g.awayTeam : g.homeTeam;
      const teamScore = isHome ? g.actualHomeScore : g.actualAwayScore;
      const oppScore = isHome ? g.actualAwayScore : g.actualHomeScore;
      let result: "W" | "L" | "" = "";
      if (teamScore != null && oppScore != null) result = teamScore > oppScore ? "W" : "L";

      const bbmiWinPct = isHome ? g.homeWinPct : g.awayWinPct;

      // Build a readable Vegas line from this team's perspective
      let vegasLine = "";
      if (g.vegasTotal != null) vegasLine = `O/U ${g.vegasTotal}`;

      // BBMI pick relevant to this team
      let bbmiPick = "";
      if (g.ouPick) bbmiPick = g.ouPick;
      else if (g.rlPick) bbmiPick = g.rlPick;

      rows.push({
        date: g.date,
        opponent,
        location: isHome ? "Home" : "Away",
        result,
        teamScore,
        oppScore,
        bbmiWinPct,
        vegasLine,
        bbmiPick,
        pitcher: isHome ? g.homePitcher : g.awayPitcher,
        oppPitcher: isHome ? g.awayPitcher : g.homePitcher,
      });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [teamName]);

  const today = new Date().toLocaleDateString("en-CA");
  const playedGames = schedule.filter(g => g.teamScore != null && g.oppScore != null);
  const upcomingGames = schedule.filter(g => g.teamScore == null).sort((a, b) => a.date.localeCompare(b.date));

  const resultColor = (r: string) => r === "W" ? "#16a34a" : r === "L" ? "#dc2626" : "#44403c";
  const INITIAL_ROWS = 20;
  const [showAllPlayed, setShowAllPlayed] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const displayedPlayed = showAllPlayed ? playedGames : playedGames.slice(0, INITIAL_ROWS);
  const displayedUpcoming = showAllUpcoming ? upcomingGames : upcomingGames.slice(0, INITIAL_ROWS);
  const getRank = (name: string) => { const rk = (teamRatingsRaw as Record<string, Record<string, unknown>>)[name]?.model_rank; return rk != null ? Number(rk) : null; };

  return (
    <>
      {/* Played Games */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Played Games</h2>
        <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={SCH_TH}>Date</th>
                  <th style={SCH_TH}>Opponent</th>
                  <th style={SCH_TH_C}>Loc</th>
                  <th style={SCH_TH_C}>Result</th>
                  <th style={SCH_TH_R}>Team</th>
                  <th style={SCH_TH_R}>Opp</th>
                </tr>
              </thead>
              <tbody>
                {displayedPlayed.map((g, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                    <td style={SCH_TD}>{formatScheduleDate(g.date)}</td>
                    <td style={SCH_TD}>
                      <Link href={`/mlb/team/${encodeURIComponent(g.opponent)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                        <MLBLogo teamName={g.opponent} size={20} />
                        <span style={{ fontWeight: 500 }}>{g.opponent}</span>
                        {(() => { const rk = getRank(g.opponent); return rk ? <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                      </Link>
                    </td>
                    <td style={SCH_TD_C}>{g.location}</td>
                    <td style={{ ...SCH_TD_C, fontWeight: 600, color: resultColor(g.result) }}>{g.result}</td>
                    <td style={{ ...SCH_TD_R, fontWeight: 600 }}>{g.teamScore}</td>
                    <td style={SCH_TD_R}>{g.oppScore}</td>
                  </tr>
                ))}
                {playedGames.length === 0 && (
                  <tr><td colSpan={6} style={{ ...SCH_TD, textAlign: "center", color: "#78716c", fontStyle: "italic", padding: "32px 0" }}>No completed games yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {!showAllPlayed && playedGames.length > INITIAL_ROWS && (
            <button onClick={() => setShowAllPlayed(true)} style={{ display: "block", width: "100%", padding: "10px 0", border: "none", background: "#f8fafc", borderTop: "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
              Show all {playedGames.length} played games {"\u25BE"}
            </button>
          )}
          {showAllPlayed && playedGames.length > INITIAL_ROWS && (
            <button onClick={() => setShowAllPlayed(false)} style={{ display: "block", width: "100%", padding: "10px 0", border: "none", background: "#f8fafc", borderTop: "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
              Show less {"\u25B4"}
            </button>
          )}
        </div>
      </div>

      {/* Upcoming Games */}
      {upcomingGames.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>Upcoming Games</h2>
          <div style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={SCH_TH}>Date</th>
                    <th style={SCH_TH}>Opponent</th>
                    <th style={SCH_TH_C}>Loc</th>
                    <th style={SCH_TH_C}>BBMI Win%</th>
                    <th style={SCH_TH_C}>Vegas O/U</th>
                    <th style={SCH_TH_C}>BBMI Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUpcoming.map((g, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={SCH_TD}>{formatScheduleDate(g.date)}</td>
                      <td style={SCH_TD}>
                        <Link href={`/mlb/team/${encodeURIComponent(g.opponent)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                          <MLBLogo teamName={g.opponent} size={20} />
                          <span style={{ fontWeight: 500 }}>{g.opponent}</span>
                          {(() => { const rk = getRank(g.opponent); return rk ? <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                        </Link>
                      </td>
                      <td style={SCH_TD_C}>{g.location}</td>
                      <td style={{ ...SCH_TD_C, fontWeight: 700, color: g.bbmiWinPct != null && g.bbmiWinPct >= 0.5 ? "#16a34a" : "#dc2626" }}>
                        {g.bbmiWinPct != null ? `${(g.bbmiWinPct * 100).toFixed(0)}%` : "\u2014"}
                      </td>
                      <td style={SCH_TD_C}>{g.vegasLine || "\u2014"}</td>
                      <td style={{ ...SCH_TD_C, fontWeight: 600 }}>{g.bbmiPick || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAllUpcoming && upcomingGames.length > INITIAL_ROWS && (
              <button onClick={() => setShowAllUpcoming(true)} style={{ display: "block", width: "100%", padding: "10px 0", border: "none", background: "#f8fafc", borderTop: "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
                Show all {upcomingGames.length} upcoming games {"\u25BE"}
              </button>
            )}
            {showAllUpcoming && upcomingGames.length > INITIAL_ROWS && (
              <button onClick={() => setShowAllUpcoming(false)} style={{ display: "block", width: "100%", padding: "10px 0", border: "none", background: "#f8fafc", borderTop: "1px solid #e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#64748b" }}>
                Show less {"\u25B4"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
