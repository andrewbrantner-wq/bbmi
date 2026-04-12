"use client";

import { useState, useMemo, useCallback } from "react";
import React from "react";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import rawData from "@/data/rankings/nfl-rankings.json";

const ACCENT = "#013369";

// ── Types ────────────────────────────────────────────────────────
type TeamRating = {
  team: string; teamName: string; conference: string; division: string;
  record: string; bbmiRating: number; rank: number; prevRank: number;
  elo: number; eloDelta: number;
  offEpa: number; defEpa: number;
  passOffEpa: number; rushOffEpa: number; passDefEpa: number; rushDefEpa: number;
  trend: string; playoffPct: number; divisionWinPct: number; projectedWins: number;
  ppg: number; oppPpg: number; last4: string; sosRank: number;
  vsVegas: number; preseasonWinTotal: number; topInsight: string | null;
  positionGrades: Record<string, {
    grade: string; rank: number; primary: number; label: string;
    metrics?: Record<string, number>; keyPlayer?: string;
  }>;
};

type RankingsData = { narrative: string; teams: TeamRating[] };
type SortKey = keyof TeamRating;
type SortDir = "asc" | "desc";

const data = rawData as RankingsData;
const allRankings = data.teams;

// ── Helpers ──────────────────────────────────────────────────────

function trendArrow(trend: string) {
  if (trend === "improving") return <span style={{ color: "#15803d", fontSize: 14 }}>{"\u2191"}</span>;
  if (trend === "declining") return <span style={{ color: "#dc2626", fontSize: 14 }}>{"\u2193"}</span>;
  return <span style={{ color: "#9ca3af", fontSize: 14 }}>{"\u2192"}</span>;
}

function rankDelta(rank: number, prev: number) {
  const d = prev - rank;
  if (d > 0) return <span style={{ color: "#15803d", fontSize: 10 }}>{"\u25B2"}{d}</span>;
  if (d < 0) return <span style={{ color: "#dc2626", fontSize: 10 }}>{"\u25BC"}{Math.abs(d)}</span>;
  return <span style={{ color: "#9ca3af", fontSize: 10 }}>{"\u2013"}</span>;
}

function projRecord(wins: number): string {
  const w = Math.round(wins);
  const l = 17 - w;
  return `${w}-${l}`;
}

function epaColor(val: number, isDefense = false) {
  const good = isDefense ? val < 0 : val > 0;
  if (Math.abs(val) < 0.01) return "#78716c";
  return good ? "#15803d" : "#dc2626";
}

// ── Tier Descriptions ────────────────────────────────────────────

function TierSection({ tier, label, color, teams }: {
  tier: number; label: string; color: string; teams: TeamRating[];
}) {
  if (teams.length === 0) return null;

  // Auto-generate tier narrative
  const bestOff = teams.reduce((a, b) => a.offEpa > b.offEpa ? a : b);
  const bestDef = teams.reduce((a, b) => a.defEpa < b.defEpa ? a : b);
  const names = teams.map(t => t.teamName).join(", ");

  let narrative = `${names}.`;
  if (teams.length >= 2) {
    const parts = [];
    if (bestOff.offEpa > 0.05) parts.push(`${bestOff.teamName} leads the tier in offensive EPA (${bestOff.offEpa > 0 ? "+" : ""}${bestOff.offEpa.toFixed(3)}/play)`);
    if (bestDef.defEpa < -0.05) parts.push(`${bestDef.teamName} anchors the tier with ${bestDef.defEpa.toFixed(3)} defensive EPA`);
    if (parts.length > 0) narrative += " " + parts.join(". ") + ".";
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: color }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1c1917" }}>Tier {tier}: {label}</span>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>({teams.length} teams)</span>
      </div>
      <p style={{ fontSize: 12, color: "#57534e", lineHeight: 1.6, margin: "0 0 0 12px" }}>{narrative}</p>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function NFLRankingsPage() {
  const [search, setSearch] = useState("");
  const [confFilter, setConfFilter] = useState<"ALL" | "AFC" | "NFC">("ALL");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [view, setView] = useState<"stats" | "grades" | "position">("stats");
  const [posGroup, setPosGroup] = useState<string>("qb");
  const [posSortKey, setPosSortKey] = useState<string>("rank");
  const [posSortDir, setPosSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => prev.key === key
      ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { key, dir: key === "rank" || key === "team" || key === "defEpa" || key === "passDefEpa" || key === "rushDefEpa" || key === "oppPpg" || key === "sosRank" ? "asc" : "desc" });
  }, []);

  const hasData = allRankings.length > 0;

  const ranked = useMemo(() => {
    let d = [...allRankings];
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(t => t.teamName.toLowerCase().includes(q) || t.team.toLowerCase().includes(q));
    }
    if (confFilter !== "ALL") d = d.filter(t => t.conference === confFilter);
    const dir = sortConfig.dir === "asc" ? 1 : -1;
    const k = sortConfig.key;
    d.sort((a, b) => {
      // Parse wins from "W-L" strings for record and last4
      if (k === "record" || k === "last4") {
        const wa = parseInt(String(a[k]).split("-")[0]) || 0;
        const wb = parseInt(String(b[k]).split("-")[0]) || 0;
        return dir * (wa - wb);
      }
      const av = a[k]; const bv = b[k];
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * ((av as number) - (bv as number));
    });
    return d;
  }, [search, confFilter, sortConfig]);

  // Tier groupings
  const tiers = useMemo(() => ({
    contenders: allRankings.filter(t => t.bbmiRating >= 5.0),
    playoff: allRankings.filter(t => t.bbmiRating >= 2.5 && t.bbmiRating < 5.0),
    competitive: allRankings.filter(t => t.bbmiRating >= 0 && t.bbmiRating < 2.5),
    rebuilding: allRankings.filter(t => t.bbmiRating < 0),
  }), []);

  const TH: React.CSSProperties = {
    backgroundColor: ACCENT, color: "#fff", padding: "7px 8px",
    textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0,
    zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)",
    fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", cursor: "pointer", userSelect: "none",
  };
  const TD: React.CSSProperties = { padding: "7px 8px", borderTop: "1px solid #ece9e2", fontSize: 12, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_N: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

  function SortTH({ label, k, align, title }: { label: string; k: SortKey; align?: string; title?: string }) {
    const sorted = sortConfig.key === k;
    const arrow = sorted ? (sortConfig.dir === "asc" ? " \u25B2" : " \u25BC") : "";
    return (
      <th style={{ ...TH, textAlign: (align || "center") as React.CSSProperties["textAlign"] }}
          onClick={() => handleSort(k)} title={title}>
        {label}{arrow}
        {title && (
          <span style={{ marginLeft: 2, fontSize: "0.5rem", opacity: 0.5, verticalAlign: "super" }}
                title={title}>?</span>
        )}
      </th>
    );
  }

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 20 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: ACCENT, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NFL Analytics {"\u00B7"} Power Rankings
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
            NFL Power Rankings
          </h1>

          {/* Auto-generated narrative */}
          {data.narrative && (
            <p style={{ fontSize: "0.82rem", color: "#57534e", maxWidth: 700, margin: "0 auto", lineHeight: 1.65 }}>
              {data.narrative}
            </p>
          )}
        </div>

        {!hasData ? (
          <div style={{ background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12, padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\uD83C\uDFC8"}</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>Rankings Available Week 3</h2>
            <p style={{ color: "#78716c", fontSize: "0.85rem" }}>Rankings update weekly once the 2026 NFL season begins.</p>
          </div>
        ) : (
          <>
            {/* Search + filter + view toggle */}
            <div style={{ display: "flex", gap: 12, maxWidth: 600, margin: "0 auto 1.5rem", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
              <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 180, padding: "10px 16px", borderRadius: 8, border: "1px solid #d4d2cc", backgroundColor: "#fff", fontSize: 14, color: "#1c1917", outline: "none" }} />
              <div style={{ display: "flex", gap: 4 }}>
                {(["ALL", "AFC", "NFC"] as const).map(c => (
                  <button key={c} onClick={() => setConfFilter(c)}
                    style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #d4d2cc", backgroundColor: confFilter === c ? ACCENT : "#fff", color: confFilter === c ? "#fff" : "#57534e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {c}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 2, backgroundColor: "#e5e7eb", borderRadius: 6, padding: 2 }}>
                {(["stats", "grades", "position"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ padding: "6px 12px", borderRadius: 4, border: "none", backgroundColor: view === v ? "#fff" : "transparent", color: view === v ? ACCENT : "#78716c", fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", boxShadow: view === v ? "0 1px 2px rgba(0,0,0,0.1)" : "none" }}>
                    {v === "position" ? "by position" : v}
                  </button>
                ))}
              </div>
            </div>

            {/* Position group selector (only in position view) */}
            {view === "position" && (
              <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 16, flexWrap: "wrap" }}>
                {([
                  ["qb", "QB"], ["receivers", "WR/TE"], ["rushing", "RB"], ["oline", "O-Line"],
                  ["passRush", "Pass Rush"], ["coverage", "Coverage"], ["runDef", "Run Def"], ["specialTms", "Spec Teams"],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => { setPosGroup(key); setPosSortKey("rank"); setPosSortDir("asc"); }}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "1px solid #d4d2cc",
                      backgroundColor: posGroup === key ? ACCENT : "#fff",
                      color: posGroup === key ? "#fff" : "#57534e",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Position Rankings Table */}
            {view === "position" && (() => {
              const POS_LABELS: Record<string, string> = {
                qb: "Quarterback", receivers: "Receivers (WR/TE)", rushing: "Running Game",
                oline: "Offensive Line", passRush: "Pass Rush", coverage: "Coverage / Secondary",
                runDef: "Run Defense", specialTms: "Special Teams",
              };
              const POS_METRICS: Record<string, { key: string; label: string; title: string; lower?: boolean }[]> = {
                qb: [
                  { key: "epaPerDropback", label: "EPA/DB", title: "EPA per dropback — overall passing quality (higher = better)" },
                  { key: "passYpg", label: "Yds/G", title: "Passing yards per game" },
                  { key: "tds", label: "TD", title: "Passing touchdowns" },
                  { key: "ints", label: "INT", title: "Interceptions thrown", lower: true },
                  { key: "compPct", label: "Cmp%", title: "Completion percentage" },
                  { key: "cpoe", label: "CPOE", title: "Completion % over expected — accuracy vs throw difficulty (higher = better)" },
                  { key: "tdIntRatio", label: "TD:INT", title: "Touchdown to interception ratio" },
                  { key: "sackRate", label: "Sack%", title: "Sack rate — % of dropbacks resulting in sack (lower = better)", lower: true },
                ],
                receivers: [
                  { key: "yacEpa", label: "YAC EPA", title: "Yards after catch EPA — pure receiver value, excludes QB impact (higher = better)" },
                  { key: "yacPerRec", label: "YAC/Rec", title: "Yards after catch per reception — receiver skill after the catch" },
                  { key: "recYpg", label: "Yds/G", title: "Team receiving yards per game" },
                  { key: "recPg", label: "Rec/G", title: "Team receptions per game" },
                  { key: "explosiveRate", label: "Expl%", title: "Explosive play rate — % of passes gaining 20+ yards" },
                ],
                rushing: [
                  { key: "epaPerRush", label: "EPA/Rush", title: "EPA per rush attempt (higher = better)" },
                  { key: "rushYpg", label: "Yds/G", title: "Rushing yards per game" },
                  { key: "ypc", label: "YPC", title: "Yards per carry" },
                  { key: "rushTds", label: "TD", title: "Rushing touchdowns" },
                  { key: "attPg", label: "Att/G", title: "Rush attempts per game" },
                  { key: "successRate", label: "Succ%", title: "Success rate — % of rushes with positive EPA" },
                  { key: "explosiveRate", label: "Expl%", title: "% of rushes gaining 10+ yards" },
                ],
                oline: [
                  { key: "rushEpa", label: "Rush EPA", title: "Team rushing EPA/play — reflects run blocking quality" },
                  { key: "stuffRate", label: "Stuff%", title: "% of runs gaining 0 or fewer yards (lower = better)", lower: true },
                  { key: "sackRate", label: "Sack%", title: "Sack rate allowed (lower = better)", lower: true },
                  { key: "shortYardageSuccess", label: "Short Yd%", title: "3rd/4th & short conversion rate" },
                ],
                passRush: [
                  { key: "sackRate", label: "Sack%", title: "Defensive sack rate per opponent dropback" },
                  { key: "sacksPg", label: "Sacks/G", title: "Sacks per game" },
                  { key: "sacksTotal", label: "Sacks", title: "Total sacks" },
                  { key: "tflRate", label: "TFL%", title: "% of opponent rushes stuffed at/behind line" },
                  { key: "oppPassEpa", label: "Opp EPA", title: "Opponent passing EPA/play (lower = better)", lower: true },
                  { key: "oppRushEpa", label: "Opp rEPA", title: "Opponent rushing EPA/play (lower = better)", lower: true },
                ],
                coverage: [
                  { key: "oppPassEpa", label: "Opp EPA", title: "Opponent passing EPA/play (lower = better)", lower: true },
                  { key: "oppPassYpg", label: "Opp Yds/G", title: "Opponent passing yards per game (lower = better)", lower: true },
                  { key: "oppCompPct", label: "Opp Cmp%", title: "Opponent completion % (lower = better)", lower: true },
                  { key: "intsTotal", label: "INTs", title: "Total interceptions" },
                  { key: "intRate", label: "INT%", title: "Interception rate per opponent pass" },
                  { key: "explosiveAllowed", label: "Expl%", title: "% of opponent passes gaining 20+ yards (lower = better)", lower: true },
                ],
                runDef: [
                  { key: "oppRushEpa", label: "Opp EPA", title: "Opponent rushing EPA/play (lower = better)", lower: true },
                  { key: "oppRushYpg", label: "Opp Yds/G", title: "Opponent rushing yards per game (lower = better)", lower: true },
                  { key: "oppYpc", label: "Opp YPC", title: "Opponent yards per carry (lower = better)", lower: true },
                  { key: "stuffRate", label: "Stuff%", title: "% of opponent rushes gaining 0 or fewer yards" },
                  { key: "oppRushTds", label: "Opp TD", title: "Opponent rushing touchdowns allowed (lower = better)", lower: true },
                  { key: "explosiveAllowed", label: "Expl%", title: "% of opponent rushes gaining 10+ yards (lower = better)", lower: true },
                ],
                specialTms: [
                  { key: "netStEpa", label: "Net EPA", title: "Net special teams EPA" },
                  { key: "fgPct", label: "FG%", title: "Field goal percentage" },
                ],
              };

              const metrics = POS_METRICS[posGroup] || [];
              const metricKeys = metrics.map(m => m.key);

              // Sort
              const posRanked = [...ranked].sort((a, b) => {
                const dir = posSortDir === "asc" ? 1 : -1;
                if (posSortKey === "rank") {
                  return dir * ((a.positionGrades?.[posGroup]?.rank ?? 32) - (b.positionGrades?.[posGroup]?.rank ?? 32));
                }
                if (posSortKey === "record") {
                  return dir * ((parseInt(a.record) || 0) - (parseInt(b.record) || 0));
                }
                // Metric sort
                const av = a.positionGrades?.[posGroup]?.metrics?.[posSortKey] ?? 0;
                const bv = b.positionGrades?.[posGroup]?.metrics?.[posSortKey] ?? 0;
                return dir * (av - bv);
              });

              function handlePosSort(key: string, defaultDesc = true) {
                if (posSortKey === key) {
                  setPosSortDir(prev => prev === "asc" ? "desc" : "asc");
                } else {
                  setPosSortKey(key);
                  setPosSortDir(defaultDesc ? "desc" : "asc");
                }
              }

              function PosTH({ label, sortKey, title, defaultAsc }: { label: string; sortKey: string; title?: string; defaultAsc?: boolean }) {
                const active = posSortKey === sortKey;
                const arrow = active ? (posSortDir === "asc" ? " \u25B2" : " \u25BC") : "";
                return (
                  <th style={{ ...TH, cursor: "pointer" }} onClick={() => handlePosSort(sortKey, !defaultAsc)} title={title}>
                    {label}{arrow}
                    {title && <span style={{ marginLeft: 2, fontSize: "0.5rem", opacity: 0.5, verticalAlign: "super" }}>?</span>}
                  </th>
                );
              }

              return (
                <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: "1.5rem" }}>
                  <div style={{ backgroundColor: ACCENT, color: "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 700 }}>
                    {POS_LABELS[posGroup] || posGroup} Rankings
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead>
                        <tr>
                          <PosTH label="#" sortKey="rank" title="Position group rank (1-32)" defaultAsc />
                          <th style={{ ...TH, textAlign: "left", minWidth: 170 }}>Team</th>
                          {(posGroup === "qb" || posGroup === "receivers" || posGroup === "rushing") && (
                            <th style={{ ...TH, textAlign: "left" }}>
                              {posGroup === "qb" ? "Player" : posGroup === "receivers" ? "Top WR" : "Top RB"}
                            </th>
                          )}
                          <th style={TH}>Grade</th>
                          <PosTH label="Record" sortKey="record" title="Season win-loss record" />
                          {metrics.map(m => (
                            <PosTH key={m.key} label={m.label} sortKey={m.key} title={m.title} defaultAsc={m.lower} />
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {posRanked.map((t, i) => {
                          const pg = t.positionGrades?.[posGroup];
                          if (!pg) return null;
                          const gradeColor = pg.grade.startsWith("A") ? "#15803d" : pg.grade.startsWith("B") ? "#2563eb" : pg.grade.startsWith("C") ? "#d97706" : "#dc2626";

                          // Get full metrics from team JSON (we have them in rankings)
                          // For now use the team page data — but we need the metrics in rankings too
                          // The rankings JSON has positionGrades with grade/rank/primary/label
                          // We need the full metrics. Let me check what we have...

                          return (
                            <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                              <td style={{ ...TD_N, fontWeight: 700, color: "#78716c" }}>{pg.rank}</td>
                              <td style={TD}>
                                <Link href={`/nfl/teams/${t.team}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#1c1917" }} className="hover:underline">
                                  <NFLLogo team={t.team} size={22} />
                                  <span style={{ fontWeight: 700, fontSize: 12 }}>{t.teamName}</span>
                                </Link>
                              </td>
                              {(posGroup === "qb" || posGroup === "receivers" || posGroup === "rushing") && (
                                <td style={{ ...TD, fontSize: 11, color: "#57534e" }}>
                                  {pg.keyPlayer || "\u2014"}
                                </td>
                              )}
                              <td style={{ ...TD_N, fontWeight: 900, color: gradeColor, fontSize: 14 }}>{pg.grade}</td>
                              <td style={{ ...TD_N, fontSize: 12 }}>{t.record}</td>
                              {metricKeys.map(k => {
                                const val = pg.metrics?.[k] ?? null;
                                // Format based on metric type
                                const isEpa = k.toLowerCase().includes("epa");
                                const isCount = ["tds", "ints", "rushTds", "sacksTotal", "intsTotal", "oppRushTds"].includes(k);
                                const isPct = k.toLowerCase().includes("pct") || k.toLowerCase().includes("rate") || k === "cpoe";
                                let display = "\u2014";
                                if (val !== null && typeof val === "number") {
                                  if (isEpa) display = (val > 0 ? "+" : "") + val.toFixed(3);
                                  else if (isCount) display = Math.round(val).toString();
                                  else if (isPct) display = val.toFixed(1);
                                  else display = val.toFixed(1);
                                }
                                return (
                                  <td key={k} style={{ ...TD_N, fontSize: 11 }}>
                                    {display}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Main Table (stats/grades views) */}
            {view !== "position" && (
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: "1.5rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <SortTH label="#" k="rank" title="BBMI Composite Rank" />
                      <th style={{ ...TH, width: 30 }}>{"\u0394"}</th>
                      <th style={{ ...TH, textAlign: "left", minWidth: 170 }}>Team</th>
                      <SortTH label="Record" k="record" title="Season win-loss record (sorts by wins)" />
                      <SortTH label="Rating" k="bbmiRating" title="BBMI Composite: Elo 40% + EPA 40% + PFR 20%" />
                      {view === "stats" ? (
                        <>
                          <SortTH label="PPG" k="ppg" title="Points per game" />
                          <SortTH label="Opp" k="oppPpg" title="Opponent points per game (lower = better)" />
                          <SortTH label="Last 4" k="last4" title="Record over last 4 games" />
                          <SortTH label="Off EPA" k="offEpa" title="Offensive EPA/play (higher = better)" />
                          <SortTH label="Def EPA" k="defEpa" title="Defensive EPA/play (lower = better)" />
                          <SortTH label="Elo" k="elo" title="nfelo Elo rating" />
                          <SortTH label="Proj Rec" k="projectedWins" title="Monte Carlo projected record" />
                          <SortTH label="vs Vegas" k="vsVegas" title="Wins vs preseason win total pace" />
                          <SortTH label="SOS" k="sosRank" title="Strength of schedule rank (1=hardest)" />
                        </>
                      ) : (
                        <>
                          <th style={{ ...TH }} title="Quarterback grade">QB</th>
                          <th style={{ ...TH }} title="Receivers grade">WR</th>
                          <th style={{ ...TH }} title="Running game grade">RB</th>
                          <th style={{ ...TH }} title="Offensive line grade">OL</th>
                          <th style={{ ...TH }} title="Pass rush grade">P.Rush</th>
                          <th style={{ ...TH }} title="Coverage/secondary grade">Cov</th>
                          <th style={{ ...TH }} title="Run defense grade">R.Def</th>
                          <th style={{ ...TH }} title="Special teams grade">ST</th>
                        </>
                      )}
                      <th style={{ ...TH, width: 30 }} title="4-week trend">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((t, i) => {
                      const ratingColor = t.bbmiRating >= 5 ? "#15803d" : t.bbmiRating > 0 ? "#65a30d" : t.bbmiRating > -3 ? "#d97706" : "#dc2626";
                      const isExpanded = expanded === t.team;
                      return (
                        <React.Fragment key={t.team}>
                          <tr style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8", cursor: "pointer" }}
                              onClick={() => setExpanded(isExpanded ? null : t.team)}>
                            <td style={{ ...TD_N, fontWeight: 700, color: "#78716c", width: 36 }}>{t.rank}</td>
                            <td style={{ ...TD, width: 30, textAlign: "center" }}>{rankDelta(t.rank, t.prevRank)}</td>
                            <td style={TD}>
                              <Link href={`/nfl/teams/${t.team}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#1c1917" }} className="hover:underline"
                                    onClick={e => e.stopPropagation()}>
                                <NFLLogo team={t.team} size={22} />
                                <div>
                                  <span style={{ fontWeight: 700, fontSize: 12 }}>{t.teamName}</span>
                                  <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: 4 }}>{t.conference} {t.division}</span>
                                </div>
                              </Link>
                            </td>
                            <td style={{ ...TD_N, fontWeight: 600, fontSize: 12 }}>{t.record}</td>
                            <td style={{ ...TD_N, fontWeight: 800, color: ratingColor, fontSize: 13 }}>
                              {t.bbmiRating > 0 ? "+" : ""}{t.bbmiRating.toFixed(1)}
                            </td>
                            {view === "stats" ? (
                              <>
                                <td style={{ ...TD_N, fontWeight: 600 }}>{t.ppg.toFixed(1)}</td>
                                <td style={{ ...TD_N, color: t.oppPpg < 20 ? "#15803d" : t.oppPpg > 25 ? "#dc2626" : "#57534e" }}>{t.oppPpg.toFixed(1)}</td>
                                <td style={{ ...TD_N, fontSize: 11 }}>{t.last4}</td>
                                <td style={{ ...TD_N, color: epaColor(t.offEpa), fontSize: 11 }}>{t.offEpa > 0 ? "+" : ""}{t.offEpa.toFixed(3)}</td>
                                <td style={{ ...TD_N, color: epaColor(t.defEpa, true), fontSize: 11 }}>{t.defEpa > 0 ? "+" : ""}{t.defEpa.toFixed(3)}</td>
                                <td style={{ ...TD_N, fontSize: 11 }}>{Math.round(t.elo)}</td>
                                <td style={{ ...TD_N, fontWeight: 600 }} title={`${t.projectedWins.toFixed(1)} projected wins`}>{projRecord(t.projectedWins)}</td>
                                <td style={{ ...TD_N, color: t.vsVegas > 0 ? "#15803d" : t.vsVegas < 0 ? "#dc2626" : "#78716c", fontWeight: 600 }}>
                                  {t.vsVegas > 0 ? "+" : ""}{t.vsVegas.toFixed(1)}
                                </td>
                                <td style={{ ...TD_N, fontSize: 11, color: t.sosRank <= 10 ? "#dc2626" : t.sosRank >= 23 ? "#15803d" : "#78716c" }}>{t.sosRank}</td>
                              </>
                            ) : (
                              <>
                                {(["qb", "receivers", "rushing", "oline", "passRush", "coverage", "runDef", "specialTms"] as const).map(grp => {
                                  const g = t.positionGrades?.[grp];
                                  if (!g) return <td key={grp} style={TD_N}>-</td>;
                                  const color = g.grade.startsWith("A") ? "#15803d" : g.grade.startsWith("B") ? "#2563eb" : g.grade.startsWith("C") ? "#d97706" : "#dc2626";
                                  return (
                                    <td key={grp} style={{ ...TD_N, fontWeight: 800, color, fontSize: 12 }} title={`${g.label}: ${g.primary} (#${g.rank})`}>
                                      {g.grade}
                                    </td>
                                  );
                                })}
                              </>
                            )}
                            <td style={{ ...TD, textAlign: "center" }}>{trendArrow(t.trend)}</td>
                          </tr>
                          {/* Expandable detail row */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: "#f8f7f4" }}>
                              <td colSpan={view === "stats" ? 15 : 14} style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb" }}>
                                {/* Position Grades */}
                                {t.positionGrades && Object.keys(t.positionGrades).length > 0 && (
                                  <div style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
                                    <div style={{ flex: "1 1 280px" }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Offense</div>
                                      {(["qb", "receivers", "rushing", "oline"] as const).map(grp => {
                                        const g = t.positionGrades[grp];
                                        if (!g) return null;
                                        const labels: Record<string, string> = { qb: "QB", receivers: "WR/TE", rushing: "RB", oline: "O-Line" };
                                        const barW = Math.max(4, ((33 - g.rank) / 32) * 100);
                                        const barColor = g.grade.startsWith("A") ? "#15803d" : g.grade.startsWith("B") ? "#2563eb" : g.grade.startsWith("C") ? "#d97706" : "#dc2626";
                                        return (
                                          <div key={grp} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                            <span style={{ fontSize: 10, width: 42, color: "#57534e", fontWeight: 600 }}>{labels[grp]}</span>
                                            <span style={{ fontSize: 10, width: 20, fontWeight: 800, color: barColor }}>{g.grade}</span>
                                            <div style={{ flex: 1, height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                                              <div style={{ width: `${barW}%`, height: "100%", backgroundColor: barColor, borderRadius: 4 }} />
                                            </div>
                                            <span style={{ fontSize: 9, color: "#9ca3af", width: 28 }}>#{g.rank}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div style={{ flex: "1 1 280px" }}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Defense</div>
                                      {(["passRush", "coverage", "runDef", "specialTms"] as const).map(grp => {
                                        const g = t.positionGrades[grp];
                                        if (!g) return null;
                                        const labels: Record<string, string> = { passRush: "Pass Rush", coverage: "Coverage", runDef: "Run Def", specialTms: "Spec Teams" };
                                        const barW = Math.max(4, ((33 - g.rank) / 32) * 100);
                                        const barColor = g.grade.startsWith("A") ? "#15803d" : g.grade.startsWith("B") ? "#2563eb" : g.grade.startsWith("C") ? "#d97706" : "#dc2626";
                                        return (
                                          <div key={grp} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                                            <span style={{ fontSize: 10, width: 64, color: "#57534e", fontWeight: 600 }}>{labels[grp]}</span>
                                            <span style={{ fontSize: 10, width: 20, fontWeight: 800, color: barColor }}>{g.grade}</span>
                                            <div style={{ flex: 1, height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                                              <div style={{ width: `${barW}%`, height: "100%", backgroundColor: barColor, borderRadius: 4 }} />
                                            </div>
                                            <span style={{ fontSize: 9, color: "#9ca3af", width: 28 }}>#{g.rank}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                                  <div style={{ flex: "1 1 200px" }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>Projections</div>
                                    <div style={{ fontSize: 11, color: "#57534e", lineHeight: 1.8 }}>
                                      Playoff: <strong>{t.playoffPct.toFixed(0)}%</strong>{" \u00B7 "}
                                      Division: <strong>{t.divisionWinPct.toFixed(0)}%</strong><br />
                                      Preseason O/U: <strong>{t.preseasonWinTotal}</strong> wins
                                    </div>
                                  </div>
                                  {t.topInsight && (
                                    <div style={{ flex: "1 1 250px" }}>
                                      <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT, marginBottom: 4 }}>Insight</div>
                                      <div style={{ fontSize: 11, color: "#57534e", lineHeight: 1.6 }}>{t.topInsight}</div>
                                    </div>
                                  )}
                                  <div>
                                    <Link href={`/nfl/teams/${t.team}`} style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>
                                      Full profile {"\u2192"}
                                    </Link>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Column descriptions */}
            <div style={{
              background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10,
              padding: "1rem 1.5rem", marginBottom: "1.5rem", fontSize: 11, color: "#78716c", lineHeight: 1.7,
            }}>
              <strong style={{ color: "#1c1917" }}>Column guide:</strong>{" "}
              <strong>Rating</strong> = BBMI Composite (Elo 40% + EPA 40% + PFR 20%), points above/below average.{" "}
              <strong>PPG/Opp</strong> = points scored and allowed per game.{" "}
              <strong>Off/Def EPA</strong> = expected points added per play (higher offense and lower defense = better).{" "}
              <strong>Proj Rec</strong> = Monte Carlo projected final record.{" "}
              <strong>vs Vegas</strong> = current wins minus preseason win total pace.{" "}
              <strong>SOS</strong> = strength of schedule (1 = hardest).{" "}
              Click any row to expand. Click column headers to sort.
            </div>

            {/* Tier Descriptions */}
            <div style={{
              background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10,
              padding: "1.5rem", marginBottom: "1.5rem",
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1c1917", marginBottom: 16 }}>Team Tiers</h2>
              <TierSection tier={1} label="Championship Contenders" color="#15803d" teams={tiers.contenders} />
              <TierSection tier={2} label="Playoff Caliber" color="#2563eb" teams={tiers.playoff} />
              <TierSection tier={3} label="Competitive" color="#d97706" teams={tiers.competitive} />
              <TierSection tier={4} label="Rebuilding" color="#dc2626" teams={tiers.rebuilding} />
            </div>

            {/* Metric Definitions Glossary */}
            <details style={{
              background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10,
              marginBottom: "1.5rem", overflow: "hidden",
            }}>
              <summary style={{
                padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 700,
                color: "#1c1917", listStyle: "none",
              }}>
                Understanding These Metrics {"\u25BE"}
              </summary>
              <div style={{ padding: "0 16px 16px", fontSize: 12, color: "#374151", lineHeight: 1.8 }}>
                <p><strong>EPA (Expected Points Added):</strong> Every play starts from a situation worth a certain number of expected points (based on down, distance, and field position). EPA measures how much a play changed that expectation. Positive EPA = good play, negative = bad. It is the most predictive single metric in football analytics because it accounts for context.</p>
                <p><strong>EPA/dropback:</strong> Average EPA on all pass plays (including sacks). Measures overall passing game quality. League average is approximately 0.00.</p>
                <p><strong>EPA/rush:</strong> Average EPA on all rushing plays. Because NFL rushing is generally less efficient than passing, even a slightly positive number indicates an above-average rushing attack.</p>
                <p><strong>CPOE:</strong> Completion Percentage Over Expected. How much better or worse a QB completes passes than expected, given throw difficulty. Positive = better than expected.</p>
                <p><strong>Sack Rate:</strong> Percentage of dropbacks resulting in a sack. League average is approximately 6-7%. Below 5% is elite.</p>
                <p><strong>Stuff Rate:</strong> Percentage of rushing attempts gaining zero or negative yards. Measures offensive line run blocking quality. Lower is better.</p>
                <p><strong>Success Rate:</strong> Percentage of plays producing positive EPA. More consistent than EPA/play because it is not skewed by a few explosive plays.</p>
                <p><strong>Explosive Play Rate:</strong> Percentage of plays gaining 20+ yards (passing) or 10+ yards (rushing). Captures big-play ability.</p>
                <p><strong>YAC EPA:</strong> EPA generated after the catch. Isolates receiver skill from quarterback accuracy.</p>
                <p><strong>Elo Rating:</strong> Team strength rating where 1500 = average. Updated after every game based on margin of victory relative to expectation.</p>
                <p><strong>BBMI Composite Rating:</strong> Blends Elo (40%), EPA (40%), and opponent-adjusted box scores (20%). Expressed as points above or below average.</p>
                <p><strong>Position Group Grades:</strong> A through D grades based on rank 1-32. Top 4 = A, 5-8 = A-, 9-12 = B+, 13-16 = B, 17-20 = B-, 21-24 = C+, 25-28 = C, 29-32 = D.</p>
              </div>
            </details>

            {/* Methodology */}
            <div style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
              BBMI Composite Rating blends nfelo Elo ratings (40%), weighted EPA/play from nflverse (40%),
              and PFR opponent-adjusted efficiency (20%). Updated weekly.
              This is an analytics product {"\u2014"} not betting picks.{" "}
              <Link href="/nfl/methodology" style={{ color: ACCENT }}>Learn more</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
