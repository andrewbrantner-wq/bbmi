"use client";

import { use, useMemo, useState, useEffect } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

const ACCENT = "#013369";

// ── Types ────────────────────────────────────────────────────
type TeamData = {
  team: string;
  teamName: string;
  season: number;
  record: string;
  bbmiRating: number;
  rank: number;
  epaProfile: {
    offEpa: number; defEpa: number;
    passOffEpa: number; rushOffEpa: number;
    passDefEpa: number; rushDefEpa: number;
  };
  weeklyEpa: { week: number; offEpa: number; defEpa: number }[];
  eloHistory: { week: number; elo: number }[];
  gameLog: {
    week: number; opponent: string; home: boolean; result: string;
    score: string; tmPts: number; oppPts: number;
    offEpa: number | null; defEpa: number | null;
  }[];
  projectedWins: number;
  playoffPct: number;
  divisionWinPct: number;
  insights: string[];
  playoffTimeline: { week: number; playoffPct: number; projectedWins: number }[];
  positionGroups: Record<string, {
    grade: string; rank: number; primary: number; label: string;
    keyPlayer?: string;
    metrics: Record<string, number>;
  }>;
};

// ── EPA Stat Card ────────────────────────────────────────────
function EPACard({ label, value, rank, isDefense = false }: {
  label: string; value: number; rank?: number; isDefense?: boolean;
}) {
  const good = isDefense ? value < 0 : value > 0;
  const color = Math.abs(value) < 0.005 ? "#78716c" : good ? "#15803d" : "#dc2626";
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
      padding: "1rem", textAlign: "center", flex: "1 1 140px", minWidth: 140,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.02em" }}>
        {value > 0 ? "+" : ""}{value.toFixed(3)}
      </div>
      {rank != null && (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Rank: {rank}/32</div>
      )}
    </div>
  );
}

// ── Main Content ─────────────────────────────────────────────
function TeamContent({ teamAbbr }: { teamAbbr: string }) {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeam() {
      try {
        const res = await import(`@/data/nfl-teams/${teamAbbr}.json`);
        setTeamData(res.default as TeamData);
      } catch {
        setTeamData(null);
      }
      setLoading(false);
    }
    loadTeam();
  }, [teamAbbr]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: "4rem", color: "#78716c" }}>Loading...</div>;
  }

  if (!teamData) return notFound();

  const t = teamData;
  const ep = t.epaProfile;

  // Compute simple ordinal suffix
  const ordinal = (n: number) => {
    if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
    switch (n % 10) {
      case 1: return n + "st";
      case 2: return n + "nd";
      case 3: return n + "rd";
      default: return n + "th";
    }
  };

  // Auto-summary
  const offQuality = ep.offEpa > 0.05 ? "elite" : ep.offEpa > 0 ? "above average" : ep.offEpa > -0.05 ? "below average" : "poor";
  const defQuality = ep.defEpa < -0.05 ? "elite" : ep.defEpa < 0 ? "above average" : ep.defEpa < 0.05 ? "below average" : "poor";
  const summary = `Ranked ${ordinal(t.rank)} overall \u00B7 Offense ${offQuality} \u00B7 Defense ${defQuality}`;

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1000px] mx-auto px-6 py-8">

        {/* Back link */}
        <Link href="/nfl/rankings" style={{ fontSize: 12, color: ACCENT, marginBottom: 16, display: "inline-block" }}>
          {"\u2190"} Back to Rankings
        </Link>

        {/* ── SECTION A: Header ── */}
        <div style={{
          background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12,
          borderLeft: `5px solid ${ACCENT}`, padding: "1.5rem 2rem", marginBottom: "1.5rem",
          display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        }}>
          <NFLLogo team={t.team} size={64} />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>
              {t.teamName}
            </h1>
            <div style={{ fontSize: 14, color: "#57534e", marginBottom: 4 }}>{t.record} {"\u00B7"} {t.season} Season</div>
            <div style={{ fontSize: 12, color: "#78716c" }}>{summary}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 32, fontWeight: 900, color: t.bbmiRating > 0 ? "#15803d" : t.bbmiRating < 0 ? "#dc2626" : "#78716c",
              lineHeight: 1,
            }}>
              {t.bbmiRating > 0 ? "+" : ""}{t.bbmiRating.toFixed(1)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
              {ordinal(t.rank)} overall
            </div>
          </div>
        </div>

        {/* ── SECTION B: EPA Dashboard (premium) ── */}
        {(
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              EPA Efficiency Profile
            </h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
              <EPACard label="Pass Offense" value={ep.passOffEpa} />
              <EPACard label="Rush Offense" value={ep.rushOffEpa} />
              <EPACard label="Pass Defense" value={ep.passDefEpa} isDefense />
              <EPACard label="Rush Defense" value={ep.rushDefEpa} isDefense />
            </div>

            {/* EPA Trend Chart */}
            {t.weeklyEpa.length > 1 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>EPA Trend (by week)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={t.weeklyEpa}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <ReTooltip contentStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="#d4d2cc" />
                    <Line type="monotone" dataKey="offEpa" stroke="#15803d" name="Offense" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="defEpa" stroke="#dc2626" name="Defense" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                  Green = offensive EPA/play (higher = better). Red = defensive EPA/play (lower = better).
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Position Group Grades ── */}
        {t.positionGroups && Object.keys(t.positionGroups).length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              Position Group Grades
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {([
                ["qb", "Quarterback"], ["receivers", "Receivers"], ["rushing", "Running Game"], ["oline", "O-Line"],
                ["passRush", "Pass Rush"], ["coverage", "Coverage"], ["runDef", "Run Defense"], ["specialTms", "Special Teams"],
              ] as const).map(([key, label]) => {
                const pg = t.positionGroups[key];
                if (!pg) return null;
                const barColor = pg.grade.startsWith("A") ? "#15803d" : pg.grade.startsWith("B") ? "#2563eb" : pg.grade.startsWith("C") ? "#d97706" : "#dc2626";
                const barW = Math.max(4, ((33 - pg.rank) / 32) * 100);
                const isDefense = ["passRush", "coverage", "runDef", "specialTms"].includes(key);
                return (
                  <div key={key} style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                    padding: "10px 12px", borderLeft: `4px solid ${barColor}`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{label}</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: barColor }}>{pg.grade}</span>
                    </div>
                    <div style={{ height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                      <div style={{ width: `${barW}%`, height: "100%", backgroundColor: barColor, borderRadius: 3 }} />
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280" }}>
                      {pg.label}: <strong style={{ color: "#374151" }}>{typeof pg.primary === "number" ? (pg.primary > 0 && !isDefense ? "+" : "") + (Number.isInteger(pg.primary) ? pg.primary : pg.primary.toFixed(3)) : pg.primary}</strong>
                      <span style={{ color: "#9ca3af" }}> (#{pg.rank})</span>
                    </div>
                    {pg.keyPlayer && (
                      <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 2 }}>{pg.keyPlayer}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SECTION C: Game Log (free) ── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
            Game Log
          </h2>
          <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  {["Wk", "Opponent", "Result", "Score", "Off EPA", "Def EPA"].filter(Boolean).map(h => (
                    <th key={h as string} style={{
                      backgroundColor: ACCENT, color: "#fff", padding: "8px 10px",
                      fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.08em", textAlign: h === "Opponent" ? "left" : "center",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.gameLog.map((g, i) => {
                  const resultColor = g.result === "W" ? "#15803d" : g.result === "L" ? "#dc2626" : "#78716c";
                  return (
                    <tr key={g.week} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, color: "#78716c" }}>{g.week}</td>
                      <td style={{ padding: "8px 10px", fontSize: 13 }}>
                        <Link href={`/nfl/teams/${g.opponent}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1c1917", textDecoration: "none" }} className="hover:underline">
                          <NFLLogo team={g.opponent} size={18} />
                          <span>{g.home ? "vs" : "@"} {g.opponent}</span>
                        </Link>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: resultColor, fontSize: 13 }}>{g.result}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 13, fontFamily: "ui-monospace, monospace" }}>{g.score}</td>
                      {(
                        <>
                          <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, color: g.offEpa != null ? (g.offEpa > 0 ? "#15803d" : "#dc2626") : "#9ca3af", fontFamily: "ui-monospace, monospace" }}>
                            {g.offEpa != null ? (g.offEpa > 0 ? "+" : "") + g.offEpa.toFixed(3) : "\u2014"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "center", fontSize: 12, color: g.defEpa != null ? (g.defEpa < 0 ? "#15803d" : "#dc2626") : "#9ca3af", fontFamily: "ui-monospace, monospace" }}>
                            {g.defEpa != null ? (g.defEpa > 0 ? "+" : "") + g.defEpa.toFixed(3) : "\u2014"}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION D: Projections (premium) ── */}
        {(
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              Season Projections
            </h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", flex: "1 1 140px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Projected Record</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a" }}>{Math.round(t.projectedWins)}-{17 - Math.round(t.projectedWins)}</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", flex: "1 1 140px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Playoff Probability</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: t.playoffPct > 50 ? "#15803d" : "#dc2626" }}>{t.playoffPct.toFixed(0)}%</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", flex: "1 1 140px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>Division Win</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#1a1a1a" }}>{t.divisionWinPct.toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Playoff Probability & Projected Wins Timeline ── */}
        {t.playoffTimeline && t.playoffTimeline.length > 1 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              Season Trajectory
            </h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {/* Playoff Probability */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", flex: "1 1 400px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>Playoff Probability by Week</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={t.playoffTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <ReTooltip contentStyle={{ fontSize: 11 }} formatter={(value: number | undefined) => [`${value ?? 0}%`, "Playoff %"]} />
                    <ReferenceLine y={50} stroke="#d4d2cc" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="playoffPct" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }} name="Playoff %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Projected Wins */}
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem", flex: "1 1 400px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>Projected Record by Week</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={t.playoffTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 17]} />
                    <ReTooltip contentStyle={{ fontSize: 11 }} formatter={(value: number | undefined) => { const w = Math.round(value ?? 0); return [`${w}-${17-w}`, "Proj Record"]; }} />
                    <ReferenceLine y={8.5} stroke="#d4d2cc" strokeDasharray="4 4" label={{ value: ".500", fontSize: 9, fill: "#9ca3af" }} />
                    <Line type="monotone" dataKey="projectedWins" stroke="#15803d" strokeWidth={2.5} dot={{ r: 3, fill: "#15803d" }} name="Proj Record" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
              Monte Carlo simulation (2,000 iterations per week). Each point reflects the projected season outcome based on data available at that week.
            </div>
          </div>
        )}

        {/* ── SECTION E: Insights ── */}
        {t.insights.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              Insights
            </h2>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem 1.5rem" }}>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", listStyle: "disc" }}>
                {t.insights.map((insight, i) => (
                  <li key={i} style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 4 }}>{insight}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Elo History Chart (premium) ── */}
        {t.eloHistory.length > 1 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: ACCENT, marginBottom: 12 }}>
              Elo Rating History
            </h2>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem" }}>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={t.eloHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 20", "dataMax + 20"]} />
                  <ReTooltip contentStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={1500} stroke="#d4d2cc" label={{ value: "Average", fontSize: 9, fill: "#9ca3af" }} />
                  <Line type="monotone" dataKey="elo" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Methodology link */}
        <div style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6, marginTop: "2rem" }}>
          Ratings are analytics content, not betting picks.{" "}
          <Link href="/nfl/methodology" style={{ color: ACCENT }}>Learn about our methodology</Link>
        </div>
      </div>
    </div>
  );
}

export default function NFLTeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = use(params);
  const teamAbbr = decodeURIComponent(team).toUpperCase();

  return <TeamContent teamAbbr={teamAbbr} />;
}
