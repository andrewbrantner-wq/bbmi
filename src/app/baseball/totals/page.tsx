"use client";

import { useState, useMemo } from "react";
import React from "react";
import Link from "next/link";
import games from "@/data/betting-lines/baseball-games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  bbmiLine: number | null;
  vegasLine: number | null;
  bbmiTotal: number | null;
  vegasTotal: number | null;
  bbmiHomeProj: number | null;
  bbmiAwayProj: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homeWinPct: number | null;
  homePitcher: string;
  awayPitcher: string;
  pitcherConfirmed: boolean;
  homePitcherSource?: string;
  awayPitcherSource?: string;
  homePitcherERA?: number | null;
  awayPitcherERA?: number | null;
  confidenceFlag?: string;
  modelMaturity?: string;
};

type SortableKey =
  | "awayTeam" | "homeTeam" | "vegasTotal" | "bbmiTotal"
  | "edge" | "pick";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function wilsonCI(wins: number, n: number) {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96, p = wins / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { low: Math.max(0, (c - m) / d * 100), high: Math.min(100, (c + m) / d * 100) };
}

/** True if this pitcher source represents a real starter (not team baseline). */
function hasPitcher(source?: string): boolean {
  return !!source && source !== "team_baseline";
}

/** True if the pitcher source is rotation-inferred (projected, not confirmed). */
function isProjectedPitcher(source?: string): boolean {
  return !!source && source.startsWith("rotation");
}

/** ROI at standard -110 juice */
function roiAtStandardJuice(wins: number, losses: number): string {
  if (wins + losses === 0) return "—";
  const profit = wins * (100 / 110) - losses;
  return `${profit >= 0 ? "+" : ""}${((profit / (wins + losses)) * 100).toFixed(1)}%`;
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({ label, columnKey, sortConfig, handleSort, align = "center" }: {
  label: string;
  columnKey: SortableKey;
  sortConfig: { key: SortableKey; direction: "asc" | "desc" };
  handleSort: (key: SortableKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = sortConfig.key === columnKey;
  return (
    <th style={{
      backgroundColor: "#0a1a2f", color: "#ffffff",
      padding: "6px 7px", textAlign: align,
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
      borderBottom: "2px solid rgba(255,255,255,0.1)",
      fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      verticalAlign: "middle", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span>{label}</span>
        <span onClick={(e) => { e.stopPropagation(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export default function BaseballTotalsPage() {
  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);

  const today = new Date().toLocaleDateString("en-CA");

  // Today's games: split into "actionable" (both pitchers known + vegas total) and "awaiting"
  const todaysAllGames = useMemo(() =>
    allGames.filter(g => g.date?.split("T")[0] === today && g.bbmiTotal != null),
  [allGames, today]);

  const todaysActionable = useMemo(() =>
    todaysAllGames.filter(g =>
      hasPitcher(g.homePitcherSource) &&
      hasPitcher(g.awayPitcherSource) &&
      g.vegasTotal != null
    ),
  [todaysAllGames]);

  const todaysAwaiting = useMemo(() =>
    todaysAllGames.filter(g =>
      !hasPitcher(g.homePitcherSource) ||
      !hasPitcher(g.awayPitcherSource) ||
      g.vegasTotal == null
    ),
  [todaysAllGames]);

  // Completed games with results — no pitcher gate on historical data
  const completed = useMemo(() =>
    allGames.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.bbmiTotal != null && g.vegasTotal != null
    ),
  [allGames]);

  // O/U record — all picks
  const ouRecordAll = useMemo(() => {
    let wins = 0, losses = 0, pushes = 0;
    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      const bbmiSays = g.bbmiTotal! > g.vegasTotal! ? "over" : g.bbmiTotal! < g.vegasTotal! ? "under" : "push";
      if (bbmiSays === "push") { pushes++; return; }
      if (actual === g.vegasTotal!) { pushes++; return; }
      const actualResult = actual > g.vegasTotal! ? "over" : "under";
      if (bbmiSays === actualResult) wins++; else losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "—";
    return { wins, losses, pushes, total, pct };
  }, [completed]);

  // Under-only record
  const underRecord = useMemo(() => {
    let wins = 0, losses = 0, pushes = 0;
    completed.forEach(g => {
      const bbmiSays = g.bbmiTotal! > g.vegasTotal! ? "over" : g.bbmiTotal! < g.vegasTotal! ? "under" : "push";
      if (bbmiSays !== "under") return;
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      if (actual === g.vegasTotal!) { pushes++; return; }
      const actualResult = actual > g.vegasTotal! ? "over" : "under";
      if (actualResult === "under") wins++; else losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "—";
    const roi = roiAtStandardJuice(wins, losses);
    return { wins, losses, pushes, total, pct, roi };
  }, [completed]);

  // MAE for totals
  const totalMAE = useMemo(() => {
    if (completed.length === 0) return { bbmi: "—", vegas: "—" };
    let bbmiErr = 0, vegasErr = 0;
    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      bbmiErr += Math.abs(actual - g.bbmiTotal!);
      vegasErr += Math.abs(actual - g.vegasTotal!);
    });
    return { bbmi: (bbmiErr / completed.length).toFixed(2), vegas: (vegasErr / completed.length).toFixed(2) };
  }, [completed]);

  // Edge bucket performance (O/U)
  const edgeBucketStats = useMemo(() => {
    const buckets = [
      { name: "0.5–1 run", min: 0.5, max: 1 },
      { name: "1–2 runs", min: 1, max: 2 },
      { name: "2–3 runs", min: 2, max: 3 },
      { name: "≥ 3 runs", min: 3, max: Infinity },
    ];
    return buckets.map(b => {
      let wins = 0, total = 0;
      completed.forEach(g => {
        const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
        if (edge < b.min || edge >= b.max) return;
        const bbmiSays = g.bbmiTotal! < g.vegasTotal! ? "under" : g.bbmiTotal! > g.vegasTotal! ? "over" : "push";
        if (bbmiSays === "push") return;
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        if (actual === g.vegasTotal!) return;
        total++;
        if ((bbmiSays === "under" && actual < g.vegasTotal!) || (bbmiSays === "over" && actual > g.vegasTotal!)) wins++;
      });
      return {
        name: b.name, total, wins,
        winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "—",
        roi: total > 0 ? roiAtStandardJuice(wins, total - wins) : "—",
      };
    });
  }, [completed]);

  // ESPN live scores for baseball
  const [liveScores, setLiveScores] = useState<Map<string, { awayScore: number; homeScore: number; status: string; inning: string }>>(new Map());
  const [liveLoading, setLiveLoading] = useState(false);
  const hasLiveGames = liveScores.size > 0;

  React.useEffect(() => {
    async function fetchLive() {
      setLiveLoading(true);
      try {
        const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date()).replace(/-/g, "");
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${ctDate}&limit=200`, { cache: "no-store" });
        if (!res.ok) throw new Error(`ESPN ${res.status}`);
        const data = await res.json();
        const map = new Map<string, { awayScore: number; homeScore: number; status: string; inning: string }>();
        for (const event of data.events ?? []) {
          const comp = event.competitions?.[0];
          if (!comp) continue;
          const awayC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "away");
          const homeC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "home");
          if (!awayC || !homeC) continue;
          const st = comp.status ?? event.status;
          const statusType = st?.type?.name ?? "";
          if (statusType === "STATUS_SCHEDULED") continue;
          const awayName = awayC.team?.shortDisplayName ?? awayC.team?.displayName ?? "";
          const homeName = homeC.team?.shortDisplayName ?? homeC.team?.displayName ?? "";
          const key = `${awayName}|${homeName}`.toLowerCase();
          const inning = statusType === "STATUS_FINAL" ? "F" : st?.displayClock ?? st?.period?.toString() ?? "";
          map.set(key, {
            awayScore: Number(awayC.score ?? 0),
            homeScore: Number(homeC.score ?? 0),
            status: statusType === "STATUS_FINAL" ? "final" : statusType === "STATUS_IN_PROGRESS" ? "live" : "pre",
            inning,
          });
        }
        setLiveScores(map);
      } catch { /* silent */ }
      setLiveLoading(false);
    }
    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, []);

  function getLive(away: string, home: string) {
    const key = `${away}|${home}`.toLowerCase();
    for (const [k, v] of liveScores) {
      if (key.includes(k.split("|")[0].split(" ")[0].toLowerCase()) && key.includes(k.split("|")[1].split(" ")[0].toLowerCase())) return v;
    }
    return null;
  }

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKey) =>
    setSortConfig(prev => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedToday = useMemo(() => {
    const withEdge = todaysActionable.map(g => {
      const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
      const pick = g.bbmiTotal! < g.vegasTotal! ? "under" : g.bbmiTotal! > g.vegasTotal! ? "over" : "push";
      return { ...g, edge, pick };
    });
    return [...withEdge].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      switch (sortConfig.key) {
        case "awayTeam": aVal = a.awayTeam; bVal = b.awayTeam; break;
        case "homeTeam": aVal = a.homeTeam; bVal = b.homeTeam; break;
        case "vegasTotal": aVal = a.vegasTotal; bVal = b.vegasTotal; break;
        case "bbmiTotal": aVal = a.bbmiTotal; bVal = b.bbmiTotal; break;
        case "edge": aVal = a.edge; bVal = b.edge; break;
        case "pick": aVal = a.pick; bVal = b.pick; break;
      }
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [todaysActionable, sortConfig]);

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };
  const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* HEADER */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            <LogoBadge league="ncaa-baseball" />
            <span style={{ marginLeft: 12 }}>Over/Under Totals</span>
          </h1>
          <p style={{ fontSize: "0.78rem", color: "#78716c", marginTop: 6, textAlign: "center", maxWidth: 560 }}>
            BBMI projected game totals vs Vegas over/under lines for NCAA D1 baseball.
            <br />
            <span style={{ fontSize: "0.68rem", color: "#a8a29e" }}>
              This is an <strong>under-focused</strong> product — under picks hit at a significantly higher rate than overs.
            </span>
          </p>
        </div>

        {/* HEADLINE STATS CARDS — 3-column grid */}
        {(ouRecordAll.total > 0 || underRecord.total > 0) && (
          <div style={{ maxWidth: 500, margin: "0 auto 1.75rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {/* Under-Only Record — the flagship stat */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: underRecord.total > 0 && Number(underRecord.pct) >= 52.4 ? "#16a34a" : underRecord.total > 0 ? "#dc2626" : "#94a3b8", lineHeight: 1 }}>
                {underRecord.total > 0 ? `${underRecord.pct}%` : "—"}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Under Record</div>
              <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{underRecord.wins}W-{underRecord.losses}L{underRecord.pushes > 0 ? ` · ${underRecord.pushes}P` : ""}</div>
            </div>

            {/* Under ROI */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: underRecord.roi.startsWith("+") ? "#16a34a" : underRecord.roi === "—" ? "#94a3b8" : "#dc2626", lineHeight: 1 }}>
                {underRecord.roi}
              </div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Under ROI</div>
              <div style={{ fontSize: "0.68rem", color: "#78716c" }}>at -110 juice</div>
            </div>

            {/* Games tracked */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0a1a2f", lineHeight: 1 }}>{completed.length}</div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Games</div>
              <div style={{ fontSize: "0.68rem", color: "#78716c" }}>tracked with results</div>
            </div>
          </div>
        )}

        {/* MAE + Overall O/U row */}
        {ouRecordAll.total > 0 && (
          <div style={{ maxWidth: 500, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.75rem 0.5rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0a1628", lineHeight: 1 }}>{totalMAE.bbmi}</div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1628", marginTop: 4 }}>BBMI MAE</div>
              <div style={{ fontSize: "0.6rem", color: "#78716c" }}>runs from actual</div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.75rem 0.5rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0a1628", lineHeight: 1 }}>{totalMAE.vegas}</div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1628", marginTop: 4 }}>Vegas MAE</div>
              <div style={{ fontSize: "0.6rem", color: "#78716c" }}>runs from actual</div>
            </div>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.75rem 0.5rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: ouRecordAll.total > 0 && Number(ouRecordAll.pct) >= 52.4 ? "#16a34a" : ouRecordAll.total > 0 ? "#dc2626" : "#94a3b8", lineHeight: 1 }}>
                {ouRecordAll.total > 0 ? `${ouRecordAll.pct}%` : "—"}
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1628", marginTop: 4 }}>Overall O/U</div>
              <div style={{ fontSize: "0.6rem", color: "#78716c" }}>{ouRecordAll.wins}W-{ouRecordAll.losses}L</div>
            </div>
          </div>
        )}

        {/* EDGE BUCKET TABLE */}
        {ouRecordAll.total > 0 && (
          <div style={{ maxWidth: 520, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                O/U Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "W\u2013L", "Win %", "ROI"].map(h => (
                      <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edgeBucketStats.map((stat, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.total}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.wins}{"\u2013"}{stat.total - stat.wins}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.winPct !== "\u2014" && Number(stat.winPct) >= 52.4 ? "#16a34a" : stat.winPct !== "\u2014" ? "#dc2626" : "#94a3b8" }}>
                        {stat.winPct === "\u2014" ? "\u2014" : `${stat.winPct}%`}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", fontWeight: 700, color: stat.roi !== "\u2014" && stat.roi.startsWith("+") ? "#16a34a" : stat.roi !== "\u2014" ? "#dc2626" : "#94a3b8" }}>
                        {stat.roi}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                      ROI at standard {"\u2212"}110 juice {"\u00B7"} Under picks are the primary product (61.7% walk-forward ATS)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* TODAY'S O/U PICKS */}
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s O/U Picks</h2>

        {/* LIVE SCORES STATUS */}
        <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: hasLiveGames ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasLiveGames ? "#86efac" : "#e2e8f0"}`, borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem", color: hasLiveGames ? "#15803d" : "#64748b", fontWeight: 600 }}>
            {liveLoading ? "Loading live scores\u2026" : hasLiveGames
              ? <><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e", display: "inline-block" }} /> Scores via ESPN &middot; Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
              : <><span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} /> Scores via ESPN</>
            }
          </div>
        </div>

        <p style={{ fontSize: "0.68rem", color: "#a8a29e", textAlign: "center", marginBottom: 16 }}>
          BBMI lines are not published until lineups are released. Under picks are the primary product.
        </p>

        {sortedToday.length === 0 ? (
          <p style={{ textAlign: "center", color: "#78716c", fontSize: 14, marginBottom: 32 }}>
            No actionable O/U picks today. Picks appear once both pitchers are confirmed and Vegas totals are posted.
          </p>
        ) : (
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 950 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Away"       columnKey="awayTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" />
                      <SortableHeader label="Home"       columnKey="homeTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" />
                      <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        Pitchers
                      </th>
                      <SortableHeader label="BBMI Total" columnKey="bbmiTotal"  sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Vegas O/U"  columnKey="vegasTotal" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Edge"       columnKey="edge"       sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="O/U Pick"   columnKey="pick"       sortConfig={sortConfig} handleSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedToday.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No actionable totals picks for today.</td></tr>
                    )}
                    {sortedToday.map((g, i) => {
                      const isUnder = g.pick === "under";
                      const isOver = g.pick === "over";
                      // Under picks are the product; over picks are informational only
                      const rowBg = isUnder
                        ? (i % 2 === 0 ? "rgba(239,246,255,0.5)" : "rgba(239,246,255,0.3)")
                        : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const pickColor = isUnder ? "#2563eb" : isOver ? "#9ca3af" : "#94a3b8";
                      const rowOpacity = isOver ? 0.6 : 1;

                      const awayProjected = isProjectedPitcher(g.awayPitcherSource);
                      const homeProjected = isProjectedPitcher(g.homePitcherSource);

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: rowBg, opacity: rowOpacity }}>
                          {(() => {
                            const live = getLive(g.awayTeam, g.homeTeam);
                            const liveTotal = live ? live.awayScore + live.homeScore : null;
                            return live && live.status !== "pre" ? (
                              <td style={{ ...TD, paddingLeft: 16 }}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                  <NCAALogo teamName={g.awayTeam} size={22} />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                                      {g.awayTeam} <span style={{ color: "#2563eb", fontWeight: 800 }}>{live.awayScore}</span>
                                    </span>
                                    <span style={{ fontSize: 10, color: live.status === "final" ? "#16a34a" : "#f59e0b", fontWeight: 600 }}>
                                      {live.status === "final" ? "Final" : `${live.inning}`}
                                      {liveTotal != null && ` · Total: ${liveTotal}`}
                                    </span>
                                  </div>
                                </Link>
                              </td>
                            ) : (
                              <td style={{ ...TD, paddingLeft: 16 }}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                  <NCAALogo teamName={g.awayTeam} size={22} />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{g.awayTeam}</span>
                                  </div>
                                </Link>
                              </td>
                            );
                          })()}

                          {(() => {
                            const live = getLive(g.awayTeam, g.homeTeam);
                            return live && live.status !== "pre" ? (
                              <td style={TD}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                  <NCAALogo teamName={g.homeTeam} size={22} />
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                                    {g.homeTeam} <span style={{ color: "#2563eb", fontWeight: 800 }}>{live.homeScore}</span>
                                  </span>
                                </Link>
                              </td>
                            ) : (
                              <td style={TD}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                  <NCAALogo teamName={g.homeTeam} size={22} />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{g.homeTeam}</span>
                                  </div>
                                </Link>
                              </td>
                            );
                          })()}

                          <td style={{ ...TD_CENTER, fontSize: 11, lineHeight: 1.4 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                              <span style={{ color: "#374151" }}>
                                {g.awayPitcher}{awayProjected && <span style={{ fontSize: 9, color: "#d97706", marginLeft: 3 }} title="Projected from rotation">PROJ</span>}
                              </span>
                              <span style={{ color: "#d1d5db", fontSize: 9 }}>vs</span>
                              <span style={{ color: "#374151" }}>
                                {g.homePitcher}{homeProjected && <span style={{ fontSize: 9, color: "#d97706", marginLeft: 3 }} title="Projected from rotation">PROJ</span>}
                              </span>
                            </div>
                          </td>

                          <td style={{ ...TD_CENTER, fontWeight: 700, fontSize: 15 }}>{g.bbmiTotal}</td>
                          <td style={TD_CENTER}>{g.vegasTotal ?? "—"}</td>

                          <td style={{
                            ...TD_CENTER,
                            fontWeight: g.edge >= 2 ? 800 : 600,
                            color: isUnder && g.edge >= 2 ? "#16a34a" : isUnder ? "#374151" : "#9ca3af",
                          }}>
                            {g.edge.toFixed(1)}
                          </td>

                          <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
                            {isUnder ? (
                              <span style={{ color: "#2563eb" }}>UNDER</span>
                            ) : isOver ? (
                              <span style={{ color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>
                                over <span style={{ fontSize: 9, display: "block", color: "#c4b5a0" }}>info only</span>
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>PUSH</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* AWAITING STARTERS SECTION */}
        {todaysAwaiting.length > 0 && (
          <div style={{ maxWidth: 800, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Awaiting Starters / Vegas Lines ({todaysAwaiting.length} game{todaysAwaiting.length !== 1 ? "s" : ""})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                  <thead>
                    <tr>
                      {["Away", "Home", "Away SP", "Home SP", "BBMI Total", "Status"].map(h => (
                        <th key={h} style={{
                          backgroundColor: "#0a1a2f", color: "#ffffff",
                          padding: "6px 7px", textAlign: h === "Away" || h === "Home" ? "left" : "center",
                          whiteSpace: "nowrap", fontSize: "0.68rem", fontWeight: 700,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                          borderBottom: "2px solid rgba(255,255,255,0.1)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todaysAwaiting.map((g, i) => {
                      const awayMissing = !hasPitcher(g.awayPitcherSource);
                      const homeMissing = !hasPitcher(g.homePitcherSource);
                      const vegasMissing = g.vegasTotal == null;
                      const reasons: string[] = [];
                      if (awayMissing) reasons.push("Away SP");
                      if (homeMissing) reasons.push("Home SP");
                      if (vegasMissing) reasons.push("Vegas total");

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff", opacity: 0.7 }}>
                          <td style={{ ...TD, paddingLeft: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <NCAALogo teamName={g.awayTeam} size={16} />
                              <span style={{ fontSize: 12 }}>{g.awayTeam}</span>
                            </div>
                          </td>
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <NCAALogo teamName={g.homeTeam} size={16} />
                              <span style={{ fontSize: 12 }}>{g.homeTeam}</span>
                            </div>
                          </td>
                          <td style={{ ...TD_CENTER, fontSize: 11, color: awayMissing ? "#d1d5db" : "#374151" }}>
                            {awayMissing ? "TBD" : g.awayPitcher}
                          </td>
                          <td style={{ ...TD_CENTER, fontSize: 11, color: homeMissing ? "#d1d5db" : "#374151" }}>
                            {homeMissing ? "TBD" : g.homePitcher}
                          </td>
                          <td style={{ ...TD_CENTER, fontSize: 12, color: "#57534e" }}>{g.bbmiTotal}</td>
                          <td style={{ ...TD_CENTER, fontSize: 10, color: "#d97706" }}>
                            Needs: {reasons.join(", ")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETED GAMES — O/U RESULTS */}
        {completed.length > 0 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Completed Games — Over/Under Results
              </div>
              <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 850 }}>
                  <thead>
                    <tr>
                      {["Date", "Away", "Home", "BBMI", "Vegas", "Call", "Actual", "O/U", "Result"].map(h => (
                        <th key={h} style={{
                          backgroundColor: "#0a1a2f", color: "#ffffff",
                          padding: "6px 7px", textAlign: h === "Away" || h === "Home" ? "left" : "center",
                          whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
                          borderBottom: "2px solid rgba(255,255,255,0.1)",
                          fontSize: "0.72rem", fontWeight: 700,
                          letterSpacing: "0.06em", textTransform: "uppercase",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...completed].sort((a, b) => b.date.localeCompare(a.date)).map((g, i) => {
                      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
                      const bbmiCall = g.bbmiTotal! > g.vegasTotal! ? "OVER" : g.bbmiTotal! < g.vegasTotal! ? "UNDER" : "PUSH";
                      const actualOU = actual > g.vegasTotal! ? "OVER" : actual < g.vegasTotal! ? "UNDER" : "PUSH";
                      const correct = bbmiCall === "PUSH" || actualOU === "PUSH" ? null : bbmiCall === actualOU;
                      const isUnderCall = bbmiCall === "UNDER";

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                          <td style={{ ...TD_CENTER, fontSize: 11 }}>{g.date}</td>
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.awayTeam} size={16} />
                              <span style={{ fontSize: 12 }}>{g.awayTeam}</span>
                            </Link>
                          </td>
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.homeTeam} size={16} />
                              <span style={{ fontSize: 12 }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          <td style={TD_CENTER}>{g.bbmiTotal}</td>
                          <td style={TD_CENTER}>{g.vegasTotal}</td>
                          <td style={{
                            ...TD_CENTER, fontWeight: 700,
                            color: isUnderCall ? "#2563eb" : bbmiCall === "OVER" ? "#9ca3af" : "#94a3b8",
                          }}>
                            {bbmiCall}
                          </td>
                          <td style={{ ...TD_CENTER, fontWeight: 700 }}>{actual}</td>
                          <td style={{ ...TD_CENTER, fontSize: 11, color: actualOU === "OVER" ? "#dc2626" : actualOU === "UNDER" ? "#2563eb" : "#94a3b8" }}>
                            {actualOU}
                          </td>
                          <td style={{ ...TD_CENTER, fontWeight: 700, color: correct === true ? "#16a34a" : correct === false ? "#dc2626" : "#94a3b8" }}>
                            {correct === true ? "W" : correct === false ? "L" : "P"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ maxWidth: 600, margin: "0 auto 2rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.68rem", color: "#78716c", lineHeight: 1.6, marginBottom: 8 }}>
            Totals predictions are derived from the BBMI model&apos;s pitcher-adjusted team scoring projections.
            Under picks are the primary product — over picks are shown for informational purposes only.
            Lines are not published until confirmed or rotation-inferred starting pitchers are available.
          </p>
          <Link href="/baseball/accuracy" style={{ fontSize: "0.72rem", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
            View full model accuracy history &rarr;
          </Link>
        </div>

      </div>
    </div>
  );
}
