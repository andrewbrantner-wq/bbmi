"use client";

import { use, useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import rankingsData from "@/data/rankings/football-rankings.json";
import scoresData from "@/data/ncaaf-team/football-scores.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type RankingRow = {
  team: string;
  model_rank: number | string;
  prev_rank: number | string;
  bbmif: number | string;
  sp_offense: number | string;
  sp_defense: number | string;
  ypp_diff: number | string;
  turnover_margin: number | string;
  quality_wins: number | string;
  last5: number | string;
  record: string;
  conference: string;
};

type GameRow = {
  team: string;
  teamConf: string;
  date: string;
  week: number | null;
  opp: string;
  oppConf: string;
  location: string;
  result: string;
  teamScore: number | null;
  oppScore: number | null;
  teamLine: number | null;
  teamWinPct: number | null;
  teamRank: number | null;
  oppRank: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-");
  return `${month}/${day}/${year}`;
}

function formatPct(v: number | null) {
  if (v == null || isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function resultColor(r: string) {
  if (r === "W") return "#16a34a";
  if (r === "L") return "#dc2626";
  if (r === "T") return "#d97706";
  return "#78716c";
}

// ── Stat badge component ──────────────────────────────────────────────────────

function StatBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
      borderRadius: 10,
      padding: "14px 18px",
      minWidth: 120,
      flex: "1 1 120px",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NCAAFTeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = use(params);
  const teamName = decodeURIComponent(team);

  const teamInfo = useMemo(() => {
    return (rankingsData as RankingRow[]).find(
      (t) => t.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName]);

  if (!teamInfo) return notFound();

  const games = useMemo(() => {
    return (scoresData as GameRow[]).filter(
      (g) => g.team.toLowerCase() === teamName.toLowerCase()
    );
  }, [teamName]);

  const playedGames = games.filter((g) => g.result && g.result.trim() !== "");
  const upcomingGames = games.filter((g) => !g.result || g.result.trim() === "");

  const wins = playedGames.filter((g) => g.result === "W").length;
  const losses = playedGames.filter((g) => g.result === "L").length;

  // ATS record
  const atsRecord = useMemo(() => {
    let covers = 0, total = 0;
    playedGames.forEach((g) => {
      if (g.teamLine == null || g.teamScore == null || g.oppScore == null) return;
      const margin = g.teamScore - g.oppScore;
      const covered = margin + g.teamLine > 0;
      if (covered) covers++;
      total++;
    });
    return { covers, total };
  }, [playedGames]);

  const bbmif = Number(teamInfo.bbmif);
  const rank = Number(teamInfo.model_rank);

  // ── Table styles ────────────────────────────────────────────
  const TH: React.CSSProperties = {
    backgroundColor: "#0a1a2f", color: "#ffffff",
    padding: "8px 12px", fontSize: 10.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em",
    textAlign: "center", whiteSpace: "nowrap",
    position: "sticky", top: 0, zIndex: 10,
  };
  const TD: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, borderTop: "1px solid #f0f0ef",
    whiteSpace: "nowrap", verticalAlign: "middle",
  };
  const MONO: React.CSSProperties = {
    ...TD, fontFamily: "ui-monospace, monospace", textAlign: "center", color: "#57534e",
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8">

        {/* Back link */}
        <Link
          href="/ncaaf-rankings"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 13, color: "#64748b", textDecoration: "none",
            marginBottom: 16, marginTop: 24,
          }}
        >
          ← Back to BBMI Rankings
        </Link>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          marginBottom: 24, flexWrap: "wrap",
        }}>
          <NCAALogo teamName={teamInfo.team} size={80} />
          <div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#0a1a2f", letterSpacing: "-0.02em", margin: 0 }}>
              {teamInfo.team}
            </h1>
            <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
              {teamInfo.conference || "Independent"} · {teamInfo.record || `${wins}-${losses}`} · BBMI Rank #{rank}
            </div>
          </div>
        </div>

        {/* Stat badges */}
        <div style={{
          display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap",
        }}>
          <StatBadge label="BBMI Score" value={isNaN(bbmif) ? "—" : bbmif.toFixed(1)} />
          <StatBadge label="BBMI Rank" value={`#${rank}`} />
          <StatBadge label="SP+ Off" value={teamInfo.sp_offense ? String(Number(teamInfo.sp_offense).toFixed(1)) : "—"} />
          <StatBadge label="SP+ Def" value={teamInfo.sp_defense ? String(Number(teamInfo.sp_defense).toFixed(1)) : "—"} />
          <StatBadge label="YPP Diff" value={teamInfo.ypp_diff ? (Number(teamInfo.ypp_diff) > 0 ? "+" : "") + Number(teamInfo.ypp_diff).toFixed(2) : "—"} />
          <StatBadge label="TO Margin" value={teamInfo.turnover_margin ? (Number(teamInfo.turnover_margin) > 0 ? "+" : "") + Number(teamInfo.turnover_margin).toFixed(2) : "—"} />
          <StatBadge label="ATS" value={atsRecord.total > 0 ? `${atsRecord.covers}-${atsRecord.total - atsRecord.covers}` : "—"}
            sub={atsRecord.total > 0 ? `${Math.round((atsRecord.covers / atsRecord.total) * 100)}% cover rate` : undefined} />
        </div>

        {/* Completed games */}
        {playedGames.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0a1a2f", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>📋</span> Completed Games
            </h2>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Date</th>
                      <th style={TH}>Wk</th>
                      <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                      <th style={TH}>Loc</th>
                      <th style={TH}>Result</th>
                      <th style={TH}>Score</th>
                      <th style={TH}>BBMI Line</th>
                      <th style={TH}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...playedGames].sort((a, b) => b.date.localeCompare(a.date)).map((g, i) => {
                      const margin = g.teamScore != null && g.oppScore != null ? g.teamScore - g.oppScore : null;
                      const covered = g.teamLine != null && margin != null ? margin + g.teamLine > 0 : null;
                      return (
                        <tr key={`${g.date}-${g.opp}-${i}`} style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "#ffffff" }}>
                          <td style={{ ...TD, fontSize: 12, color: "#78716c" }}>{formatDate(g.date)}</td>
                          <td style={MONO}>{g.week ?? "—"}</td>
                          <td style={TD}>
                            <Link
                              href={`/ncaaf-team/${encodeURIComponent(g.opp)}`}
                              style={{ textDecoration: "none", color: "#0a1a2f", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                            >
                              <NCAALogo teamName={g.opp} size={20} />
                              {g.oppRank && g.oppRank <= 25 ? <span style={{ fontSize: 10, color: "#94a3b8" }}>#{g.oppRank}</span> : null}
                              <span>{g.opp}</span>
                            </Link>
                          </td>
                          <td style={{ ...MONO, fontSize: 11 }}>{g.location === "Home" ? "vs" : g.location === "Away" ? "@" : "N"}</td>
                          <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: resultColor(g.result) }}>{g.result}</td>
                          <td style={MONO}>
                            {g.teamScore != null ? `${g.teamScore}-${g.oppScore}` : "—"}
                          </td>
                          <td style={{
                            ...MONO,
                            fontWeight: 600,
                            color: covered === true ? "#16a34a" : covered === false ? "#dc2626" : "#57534e",
                          }}>
                            {g.teamLine != null ? (g.teamLine > 0 ? `+${g.teamLine}` : g.teamLine) : "—"}
                          </td>
                          <td style={MONO}>{formatPct(g.teamWinPct)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming games */}
        {upcomingGames.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0a1a2f", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🗓️</span> Upcoming Games
            </h2>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Date</th>
                      <th style={TH}>Wk</th>
                      <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                      <th style={TH}>Loc</th>
                      <th style={TH}>BBMI Line</th>
                      <th style={TH}>Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...upcomingGames].sort((a, b) => a.date.localeCompare(b.date)).map((g, i) => (
                      <tr key={`${g.date}-${g.opp}-${i}`} style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "#ffffff" }}>
                        <td style={{ ...TD, fontSize: 12, color: "#78716c" }}>{formatDate(g.date)}</td>
                        <td style={MONO}>{g.week ?? "—"}</td>
                        <td style={TD}>
                          <Link
                            href={`/ncaaf-team/${encodeURIComponent(g.opp)}`}
                            style={{ textDecoration: "none", color: "#0a1a2f", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <NCAALogo teamName={g.opp} size={20} />
                            {g.oppRank && g.oppRank <= 25 ? <span style={{ fontSize: 10, color: "#94a3b8" }}>#{g.oppRank}</span> : null}
                            <span>{g.opp}</span>
                          </Link>
                        </td>
                        <td style={{ ...MONO, fontSize: 11 }}>{g.location === "Home" ? "vs" : g.location === "Away" ? "@" : "N"}</td>
                        <td style={MONO}>
                          {g.teamLine != null ? (g.teamLine > 0 ? `+${g.teamLine}` : g.teamLine) : "—"}
                        </td>
                        <td style={MONO}>{formatPct(g.teamWinPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No games fallback */}
        {games.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
            No schedule data available for {teamInfo.team}.
          </div>
        )}

      </div>
    </div>
  );
}
