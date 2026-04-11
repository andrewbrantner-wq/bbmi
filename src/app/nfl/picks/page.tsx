"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import NFLLogo from "@/components/NFLLogo";
import { AuthProvider, useAuth } from "../../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase-config";
import gamesData from "@/data/betting-lines/nfl-games.json";
import {
  OU_MIN_EDGE, OU_STRONG_EDGE, OU_PREMIUM_EDGE, OU_MAX_EDGE, OU_JUICE,
  SPORT_ACCENT,
} from "@/config/nfl-thresholds";

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
const accent = SPORT_ACCENT;

function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96; const p = wins / n; const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, ((c - m) / d) * 100), high: Math.min(100, ((c + m) / d) * 100) };
}

function calcROI(w: number, l: number): string {
  const n = w + l; if (n === 0) return "0.0";
  const payout = 100 / (Math.abs(OU_JUICE) / 100);
  return ((w * payout - l * 100) / (n * 100) * 100).toFixed(1);
}

function edgeColor(edge: number): string {
  if (edge >= OU_PREMIUM_EDGE) return accent;
  if (edge >= OU_STRONG_EDGE) return "#3a6090";
  return "#57534e";
}

// ────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────
type NFLGame = {
  gameId?: string; date: string; week?: number; commence_time?: string;
  homeTeam: string; awayTeam: string;
  bbmiTotal?: number | null; bbmiHomeProj?: number | null; bbmiAwayProj?: number | null;
  bbmiSpread?: number | null; vegasTotal?: number | null; vegasSpread?: number | null;
  ouEdge?: number | null; ouPick?: string | null; ouConfidenceTier?: number | null;
  spreadEdge?: number | null; spreadPick?: string | null;
  actualHomeScore?: number | null; actualAwayScore?: number | null;
  scheduleAdj?: number | null; homeRestDays?: number | null; awayRestDays?: number | null;
};

type SortableKey = "awayTeam" | "homeTeam" | "vegasTotal" | "bbmiTotal" | "edge" | "totalPick";

// ────────────────────────────────────────────────────────────────
// TOOLTIP CONTENT
// ────────────────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  awayTeam:   "The visiting team.",
  homeTeam:   "The home team.",
  vegasTotal: "The posted over/under total from sportsbooks.",
  bbmiTotal:  "BBMI\u2019s projected game total based on opponent-adjusted ratings.",
  edge:       `Edge = |BBMI total \u2212 Vegas total|. Minimum ${OU_MIN_EDGE} pts for a pick. Above ${OU_MAX_EDGE} pts excluded.`,
  totalPick:  "BBMI\u2019s call: OVER (model projects more scoring than Vegas) or UNDER (less scoring).",
  actual:     "Actual combined points scored in the game.",
  result:     "Whether BBMI\u2019s over/under call was correct (\u2713) or wrong (\u2717).",
};

// ────────────────────────────────────────────────────────────────
// PORTAL TOOLTIP
// ────────────────────────────────────────────────────────────────
function ColDescPortal({ tooltipId, anchorRect, onClose }: { tooltipId: string; anchorRect: DOMRect; onClose: () => void }) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (el.current && !el.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;
  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#0a1e3d", border: `1px solid ${accent}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>x</button>
    </div>,
    document.body
  );
}

// ────────────────────────────────────────────────────────────────
// SORTABLE HEADER
// ────────────────────────────────────────────────────────────────
function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc, align = "right" }: {
  label: React.ReactNode; columnKey: SortableKey; tooltipId?: string; align?: string;
  sortConfig: { key: SortableKey; direction: "asc" | "desc" };
  handleSort: (k: SortableKey) => void;
  activeDescId?: string; openDesc: (id: string, rect: DOMRect) => void; closeDesc: () => void;
}) {
  const isSorted = sortConfig.key === columnKey;
  const arrow = isSorted ? (sortConfig.direction === "asc" ? " \u25B2" : " \u25BC") : "";
  const TH: React.CSSProperties = {
    backgroundColor: accent, color: "#ffffff", padding: "8px 10px",
    textAlign: align as React.CSSProperties["textAlign"], whiteSpace: "nowrap", position: "sticky", top: 0,
    zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)",
    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
    textTransform: "uppercase", verticalAlign: "middle", userSelect: "none", cursor: "pointer",
  };
  return (
    <th style={TH} onClick={(e) => {
      if (tooltipId && activeDescId !== tooltipId) { openDesc(tooltipId, (e.target as HTMLElement).getBoundingClientRect()); }
      else { closeDesc(); handleSort(columnKey); }
    }}>
      {label}{arrow}
    </th>
  );
}

// ────────────────────────────────────────────────────────────────
// PAYWALL MODAL
// ────────────────────────────────────────────────────────────────
function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct }: { onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: "2rem", maxWidth: 420, width: "90%", boxShadow: "0 24px 48px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917", margin: "0 0 0.5rem" }}>Unlock Premium NFL Picks</h2>
        <p style={{ fontSize: "0.85rem", color: "#78716c", lineHeight: 1.6, margin: "0 0 1rem" }}>
          High-edge picks (edge {"\u2265"} {OU_PREMIUM_EDGE} pts) hit at <strong style={{ color: accent }}>{highEdgeWinPct}%</strong> across {highEdgeTotal} documented picks vs {overallWinPct}% overall.
        </p>
        <Link href="/subscribe" style={{ display: "block", textAlign: "center", backgroundColor: accent, color: "#fff", borderRadius: 8, padding: "0.75rem", fontSize: "0.95rem", fontWeight: 700, textDecoration: "none" }}>
          Subscribe for $10/week {"\u2192"}
        </Link>
        <button onClick={onClose} style={{ display: "block", width: "100%", marginTop: "0.75rem", background: "none", border: "none", color: "#78716c", fontSize: "0.8rem", cursor: "pointer" }}>Maybe later</button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// LOCKED ROW OVERLAY
// ────────────────────────────────────────────────────────────────
function LockedRowOverlay({ colSpan, onSubscribe, winPct }: { colSpan: number; onSubscribe: () => void; winPct: string }) {
  return (
    <tr style={{ backgroundColor: "#f0f1f3" }}>
      <td colSpan={colSpan} style={{ padding: "8px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 12, color: "#78716c" }}>{"\uD83D\uDD12"} Premium pick — </span>
        <button onClick={onSubscribe} style={{ fontSize: 12, fontWeight: 700, color: accent, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Unlock ({winPct}% win rate) →
        </button>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────
// MAIN CONTENT
// ────────────────────────────────────────────────────────────────
function NFLPicksContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    async function check() {
      if (!user) { setIsPremium(false); return; }
      try { const d = await getDoc(doc(db, "users", user.uid)); setIsPremium(d.exists() && d.data()?.premium === true); }
      catch { setIsPremium(false); }
    }
    check();
  }, [user]);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // ── Data ────────────────────────────────────────────────────
  const allGames = useMemo(() => (gamesData as unknown as NFLGame[]).filter(g => g.homeTeam && g.awayTeam), []);
  const today = new Date().toLocaleDateString("en-CA");

  const historicalGames = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null).map(g => ({
      ...g,
      _edge: Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)),
      _call: (g.bbmiTotal ?? 0) < (g.vegasTotal ?? 0) ? "UNDER" : (g.bbmiTotal ?? 0) > (g.vegasTotal ?? 0) ? "OVER" : null,
      _actual: (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0),
      _won: (() => {
        if (g.bbmiTotal == null || g.vegasTotal == null || g.actualHomeScore == null || g.actualAwayScore == null) return null;
        const actual = g.actualHomeScore + g.actualAwayScore;
        if (actual === g.vegasTotal) return null;
        const call = g.bbmiTotal < g.vegasTotal ? "under" : "over";
        return call === (actual > g.vegasTotal ? "over" : "under");
      })(),
    })),
  [allGames]);

  const upcomingGames = useMemo(() =>
    allGames.filter(g => g.actualHomeScore == null).map(g => ({
      ...g,
      _edge: Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)),
      _call: (g.bbmiTotal ?? 0) < (g.vegasTotal ?? 0) ? "UNDER" : (g.bbmiTotal ?? 0) > (g.vegasTotal ?? 0) ? "OVER" : null,
    })),
  [allGames]);

  const currentWeek = upcomingGames.length > 0 ? upcomingGames[0].week : null;

  // ── Stats ───────────────────────────────────────────────────
  const ouEdgeStats = useMemo(() => {
    const q = historicalGames.filter(g => g._edge >= OU_MIN_EDGE && g._edge <= OU_MAX_EDGE);
    const w = q.filter(g => g._won === true).length;
    const overallWinPct = q.length > 0 ? ((w / q.length) * 100).toFixed(1) : "---";
    const overallROI = calcROI(w, q.length - w);
    const hi = q.filter(g => g._edge >= OU_PREMIUM_EDGE);
    const hiW = hi.filter(g => g._won === true).length;
    const highEdgeWinPct = hi.length > 0 ? ((hiW / hi.length) * 100).toFixed(1) : "---";
    const highEdgeROI = calcROI(hiW, hi.length - hiW);
    const fr = q.filter(g => g._edge < OU_PREMIUM_EDGE);
    const frW = fr.filter(g => g._won === true).length;
    const freeEdgeWinPct = fr.length > 0 ? ((frW / fr.length) * 100).toFixed(1) : "---";
    return { overallWinPct, total: q.length, overallROI, highEdgeWinPct, highEdgeTotal: hi.length, highEdgeROI, freeEdgeWinPct, freeEdgeTotal: fr.length };
  }, [historicalGames]);

  const ouHistoricalStats = useMemo(() => {
    const q = historicalGames.filter(g => g._edge >= OU_MIN_EDGE && g._edge <= OU_MAX_EDGE);
    const w = q.filter(g => g._won === true).length;
    return { total: q.length, winPct: q.length > 0 ? ((w / q.length) * 100).toFixed(1) : "---" };
  }, [historicalGames]);

  // ── Edge performance table ──────────────────────────────────
  const edgePerformanceStats = useMemo(() => {
    const cats = [
      { name: `${OU_MIN_EDGE}\u2013${OU_STRONG_EDGE} pts`, min: OU_MIN_EDGE, max: OU_STRONG_EDGE },
      { name: `${OU_STRONG_EDGE}\u2013${OU_PREMIUM_EDGE} pts`, min: OU_STRONG_EDGE, max: OU_PREMIUM_EDGE },
      { name: `${OU_PREMIUM_EDGE}\u2013${OU_MAX_EDGE} pts`, min: OU_PREMIUM_EDGE, max: OU_MAX_EDGE + 0.01 },
    ];
    return cats.map(cat => {
      const cg = historicalGames.filter(g => g._edge >= cat.min && g._edge < cat.max);
      const w = cg.filter(g => g._won === true).length;
      const ci = wilsonCI(w, cg.length);
      const roi = calcROI(w, cg.length - w);
      return {
        name: cat.name, games: cg.length, wins: w,
        winPct: cg.length > 0 ? ((w / cg.length) * 100).toFixed(1) : "---",
        roi, roiPositive: Number(roi) >= 0,
        ciLow: ci.low, ciHigh: ci.high,
      };
    });
  }, [historicalGames]);

  // ── Graph data ──────────────────────────────────────────────
  const graphGames = useMemo(() =>
    historicalGames.filter(g => g._edge >= OU_MIN_EDGE && g._edge <= OU_MAX_EDGE).map(g => ({
      date: g.date, away: g.awayTeam, home: g.homeTeam,
      vegasHomeLine: g.vegasSpread ?? null, bbmiHomeLine: g.bbmiSpread ?? null,
      actualHomeScore: g.actualHomeScore ?? null, actualAwayScore: g.actualAwayScore ?? null,
      vegasTotal: g.vegasTotal ?? null, bbmiTotal: g.bbmiTotal ?? null,
      totalPick: g._call?.toLowerCase() ?? null,
      totalResult: (() => {
        if (g.actualHomeScore == null || g.actualAwayScore == null || g.vegasTotal == null) return null;
        const a = g.actualHomeScore + g.actualAwayScore;
        return a > g.vegasTotal ? "over" : a < g.vegasTotal ? "under" : "push";
      })(),
      actualTotal: g._actual,
      fakeBet: 100,
      fakeWin: g._won === true ? 190.91 : 0,
    })),
  [historicalGames]);

  // ── Sort + filter ───────────────────────────────────────────
  const edgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: `${OU_MIN_EDGE}\u2013${OU_STRONG_EDGE} pts`, min: OU_MIN_EDGE, max: OU_STRONG_EDGE },
    { label: `${OU_STRONG_EDGE}\u2013${OU_PREMIUM_EDGE} pts`, min: OU_STRONG_EDGE, max: OU_PREMIUM_EDGE },
    { label: `${OU_PREMIUM_EDGE}+ pts`, min: OU_PREMIUM_EDGE, max: Infinity },
  ];
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = useCallback((key: SortableKey) => {
    setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" });
  }, []);

  const filteredGames = useMemo(() => {
    let g = upcomingGames.filter(game => game.bbmiTotal != null && game.vegasTotal != null);
    if (edgeOption.label !== "All Games") {
      g = g.filter(game => game._edge >= edgeOption.min && game._edge < edgeOption.max);
    }
    return [...g].sort((a, b) => {
      let cmp = 0;
      if (sortConfig.key === "edge") cmp = a._edge - b._edge;
      else if (sortConfig.key === "awayTeam") cmp = a.awayTeam.localeCompare(b.awayTeam);
      else if (sortConfig.key === "homeTeam") cmp = a.homeTeam.localeCompare(b.homeTeam);
      else if (sortConfig.key === "vegasTotal") cmp = (a.vegasTotal ?? 0) - (b.vegasTotal ?? 0);
      else if (sortConfig.key === "bbmiTotal") cmp = (a.bbmiTotal ?? 0) - (b.bbmiTotal ?? 0);
      return sortConfig.direction === "desc" ? -cmp : cmp;
    });
  }, [upcomingGames, historicalGames, edgeOption, sortConfig]);

  const recommendedGames = filteredGames.filter(g => g._edge >= OU_MIN_EDGE && g._edge <= OU_MAX_EDGE && g._call);
  const belowThresholdGames = filteredGames.filter(g => g._edge < OU_MIN_EDGE || g._edge > OU_MAX_EDGE || !g._call);
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);
  const recLabel = `${recommendedGames.filter(g => g._call === "UNDER").length} under, ${recommendedGames.filter(g => g._call === "OVER").length} over`;

  const lockedCount = filteredGames.filter(g => g._edge >= OU_PREMIUM_EDGE && g._edge <= OU_MAX_EDGE).length;
  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={ouEdgeStats.highEdgeWinPct} highEdgeTotal={ouEdgeStats.highEdgeTotal} overallWinPct={ouEdgeStats.overallWinPct} />}

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: accent, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NFL {"\u00B7"} Updated Weekly (Wednesday)
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 14px" }}>
              {upcomingGames.length > 0 ? "This Week\u2019s" : "Today\u2019s"} Game Lines
            </h1>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 1100, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            {[
              { value: `${ouEdgeStats.freeEdgeWinPct}%`, label: "Free Picks", sub: `edge ${OU_MIN_EDGE}\u2013${OU_PREMIUM_EDGE} pts`, premium: false },
              { value: `${ouEdgeStats.highEdgeWinPct}%`, label: "Premium Picks", sub: `edge \u2265 ${OU_PREMIUM_EDGE} pts`, premium: true },
              { value: `${ouHistoricalStats.winPct}%`, label: "Overall O/U", sub: `${ouHistoricalStats.total.toLocaleString()} games`, premium: false },
            ].map(card => (
              <div key={card.label} style={{ background: card.premium ? "#e1e6ef" : "#ffffff", border: card.premium ? `2px solid ${accent}` : "1px solid #d4d2cc", borderTop: `4px solid ${accent}`, borderRadius: 10, padding: "14px 14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: card.premium ? 28 : 24, fontWeight: card.premium ? 700 : 500, color: accent, lineHeight: 1.1 }}>{card.value}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: card.premium ? accent : "#777", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.63rem", color: "#666" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* STATS METHODOLOGY NOTE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              {"\u2020"} Record includes only games where BBMI and Vegas totals differ by {"\u2265"} {OU_MIN_EDGE} pts and {"\u2264"} {OU_MAX_EDGE} pts ({ouHistoricalStats.total.toLocaleString()} games).
              Edges above {OU_MAX_EDGE} pts correlate with model error, not market error. Spreads are display-only.
              Validated at 56.0% ATS across 4 independent NFL seasons (2022{"\u2013"}2025).{" "}
              <Link href="/nfl/accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View full public log {"\u2192"}</Link>
            </p>
          </div>

          {/* HIGH EDGE CALLOUT */}
          {isPremium === false && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e1e6ef", borderRadius: 6, borderLeft: `4px solid ${accent}`, border: "1px solid #e7e5e4", borderLeftWidth: 4, borderLeftColor: accent, padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 900, color: accent, lineHeight: 1 }}>{ouEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "#78716c" }}>win rate on picks with edge {"\u2265"} {OU_PREMIUM_EDGE} pts</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#888", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "#78716c" }}>{ouEdgeStats.overallWinPct}%</strong> overall {"\u00B7"} documented across <strong style={{ color: "#78716c" }}>{ouEdgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: accent, fontWeight: 700 }}>{"\uD83D\uDD12"} {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: accent, color: "#ffffff", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $10 {"\u2192"}
                </button>
              </div>
            </div>
          )}

          {/* EDGE PERFORMANCE GRAPH */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #d4d2cc", padding: "1.5rem" }}>
            <EdgePerformanceGraph
              games={graphGames}
              groupBy="week"
              periodsToShow={18}
              showTitle={true}
              edgeCategories={[
                { name: `${OU_MIN_EDGE}\u2013${OU_STRONG_EDGE} pts`, min: OU_MIN_EDGE, max: OU_STRONG_EDGE, color: "#8fa8c8", width: 1.25 },
                { name: `${OU_STRONG_EDGE}\u2013${OU_PREMIUM_EDGE} pts`, min: OU_STRONG_EDGE, max: OU_PREMIUM_EDGE, color: "#3a6090", width: 2.0 },
                { name: `${OU_PREMIUM_EDGE}\u2013${OU_MAX_EDGE} pts`, min: OU_PREMIUM_EDGE, max: OU_MAX_EDGE, color: accent, width: 2.5 },
              ]}
              mode="ou"
            />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: accent, color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Historical Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "Win %", "95% CI", "ROI"].map(h => (
                      <th key={h} style={{ backgroundColor: accent, color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.games.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: Number(stat.winPct) > 50 ? accent : "#dc2626" }}>{stat.winPct}%</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "center", color: "#78716c", fontStyle: "italic", whiteSpace: "nowrap" }}>{stat.ciLow.toFixed(1)}%{"\u2013"}{stat.ciHigh.toFixed(1)}%</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.roiPositive ? accent : "#dc2626" }}>{stat.roi}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#f5f3ef", borderTop: "1px solid #f5f5f4" }}>
                      Includes only picks where edge {"\u2265"} {OU_MIN_EDGE} pts and {"\u2264"} {OU_MAX_EDGE} pts {"\u00B7"} 95% CI uses Wilson score method.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e1e6ef", borderLeft: `4px solid ${accent}`, border: "1px solid #d4d2cc", borderLeftWidth: 4, borderLeftColor: accent, borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#4b5563", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {OU_PREMIUM_EDGE} pts) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks {"\u2265"} {OU_PREMIUM_EDGE} pts</strong> {"\u2014"} historically <strong>{ouEdgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access {"\u2014"} use the edge filter to focus on the model&apos;s strongest picks.</span>}
            </p>
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
            Upcoming Games{currentWeek ? ` \u2014 Week ${currentWeek}` : ""}
          </h2>

          {/* EDGE FILTER */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Minimum Edge</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {edgeOptions.map(o => {
                const isActive = edgeOption.label === o.label;
                return (
                  <button key={o.label} onClick={() => setEdgeOption(o)} style={{
                    height: 38, padding: "0 16px", borderRadius: 999,
                    border: isActive ? `2px solid ${accent}` : "1px solid #c0bdb5",
                    backgroundColor: isActive ? accent : "#ffffff",
                    color: isActive ? "#ffffff" : "#44403c",
                    fontSize: "0.85rem", fontWeight: isActive ? 700 : 500, cursor: "pointer",
                    boxShadow: isActive ? "0 2px 8px rgba(10,26,47,0.18)" : "0 1px 3px rgba(0,0,0,0.07)",
                    transition: "all 0.12s ease",
                  }}>{o.label}</button>
                );
              })}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#44403c", margin: 0 }}>
              Showing <strong>{filteredGames.length}</strong> of <strong>{upcomingGames.length}</strong> games
              {!isPremium && lockedCount > 0 && <span style={{ color: "#dc2626", marginLeft: 8 }}>{"\u00B7"} {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked {"\uD83D\uDD12"}</span>}
            </p>
            {!isPremium && (
              <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic", margin: 0 }}>
                Free picks shown for edge &lt; {OU_PREMIUM_EDGE} pts.{" "}
                <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                  Subscribe to unlock high-edge picks {"\u2192"}
                </button>
              </p>
            )}
          </div>

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 800 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Away" columnKey="awayTeam" tooltipId="awayTeam" align="left" {...headerProps} />
                      <SortableHeader label="Home" columnKey="homeTeam" tooltipId="homeTeam" align="left" {...headerProps} />
                      <SortableHeader label="Vegas O/U" columnKey="vegasTotal" tooltipId="vegasTotal" {...headerProps} />
                      <SortableHeader label="BBMI Total" columnKey="bbmiTotal" tooltipId="bbmiTotal" {...headerProps} />
                      <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" {...headerProps} />
                      <SortableHeader label="O/U Pick" columnKey="totalPick" tooltipId="totalPick" align="left" {...headerProps} />
                      <th style={{ backgroundColor: accent, color: "#fff", padding: "8px 10px", textAlign: "right", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Actual</th>
                      <th style={{ backgroundColor: accent, color: "#fff", padding: "8px 10px", textAlign: "right", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGames.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {recommendedGames.length > 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: "10px 16px", background: "#e1e6ef", borderTop: `3px solid ${accent}`, borderBottom: "1px solid #d4d2cc" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{"\u2714"} Recommended picks {"\u00B7"} {recLabel}</span>
                        </td>
                      </tr>
                    )}

                    {recommendedGames.map((g, i) => {
                      const isLocked = !isPremium && g._edge >= OU_PREMIUM_EDGE;
                      if (isLocked) return <LockedRowOverlay key={i} colSpan={8} onSubscribe={() => setShowPaywall(true)} winPct={ouEdgeStats.highEdgeWinPct} />;
                      const isBelowMin = g._edge < OU_MIN_EDGE;
                      const rowBg = i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb";
                      const actual = g.actualHomeScore != null && g.actualAwayScore != null ? g.actualHomeScore + g.actualAwayScore : null;
                      const won = actual != null && g.vegasTotal != null && actual !== g.vegasTotal
                        ? (g._call === "UNDER" ? actual < g.vegasTotal : actual > g.vegasTotal)
                        : null;

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD, minWidth: 140, paddingLeft: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <NFLLogo team={g.awayTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.awayTeam}</span>
                            </div>
                          </td>
                          <td style={{ ...TD, minWidth: 140 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <NFLLogo team={g.homeTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.homeTeam}</span>
                            </div>
                          </td>
                          <td style={TD_RIGHT}>{g.vegasTotal != null ? g.vegasTotal.toFixed(1) : "\u2014"}</td>
                          <td style={{ ...TD_RIGHT, fontWeight: 700, color: accent }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                          <td style={{ ...TD_RIGHT, color: edgeColor(g._edge), fontWeight: g._edge >= OU_PREMIUM_EDGE ? 800 : 600, fontSize: 14 }}>{g._edge.toFixed(1)}</td>
                          <td style={{ ...TD, minWidth: 100, fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: g._call === "OVER" ? accent : g._call === "UNDER" ? "#dc2626" : "#a8a29e" }}>{g._call ?? "\u2014"}</td>
                          <td style={{ ...TD_RIGHT, color: "#57534e" }}>{actual ?? "\u2014"}</td>
                          <td style={{ ...TD_RIGHT, fontSize: 16, fontWeight: 700 }}>
                            {won === null ? "\u2014" : won ? <span style={{ color: accent }}>{"\u2713"}</span> : <span style={{ color: "#dc2626" }}>{"\u2717"}</span>}
                          </td>
                        </tr>
                      );
                    })}

                    {belowThresholdGames.length > 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0 }}>
                          <button onClick={() => setShowBelowThreshold(p => !p)} style={{ width: "100%", padding: "10px 16px", border: "none", borderTop: "2px solid #d4d2cc", background: "#e1e6ef", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#555555" }}>
                            {showBelowThreshold ? "\u25B4" : "\u25BE"} All games {"\u00B7"} below model threshold ({belowThresholdGames.length})
                          </button>
                        </td>
                      </tr>
                    )}

                    {showBelowThreshold && belowThresholdGames.map((g, i) => (
                      <tr key={`bt_${i}`} style={{ backgroundColor: i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)", opacity: 0.55, color: "#9ca3af" }}>
                        <td style={{ ...TD, paddingLeft: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <NFLLogo team={g.awayTeam} size={18} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                          </div>
                        </td>
                        <td style={TD}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <NFLLogo team={g.homeTeam} size={18} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                          </div>
                        </td>
                        <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                        <td style={TD_RIGHT}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                        <td style={TD_RIGHT}>{g._edge > 0 ? g._edge.toFixed(1) : "\u2014"}</td>
                        <td style={{ ...TD, textAlign: "center", color: "#b0b0b0", textTransform: "uppercase" }}>{g._call === "OVER" ? "\u2191 Over" : g._call === "UNDER" ? "\u2193 Under" : "\u2014"}</td>
                        <td style={TD_RIGHT}>{"\u2014"}</td>
                        <td style={TD_RIGHT}>{"\u2014"}</td>
                      </tr>
                    ))}

                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#e1e6ef" }}>
                        <td colSpan={8} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#4b5563", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above {"\u2014"} historically <strong>{ouEdgeStats.highEdgeWinPct}%</strong> accurate vs {ouEdgeStats.overallWinPct}% overall
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: accent, color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                            Unlock all picks {"\u2014"} $10 for 7 days {"\u2192"}
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* METHODOLOGY */}
          <div style={{ maxWidth: 720, margin: "16px auto 40px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.7 }}>
              <strong>How BBMI lines are generated:</strong> Opponent-adjusted offensive and defensive efficiency ratings,
              Bayesian preseason priors (Vegas win totals, decaying over 10 weeks), schedule adjustments for bye weeks
              and short-week games, and turnover regression. Lines are frozen at pipeline run time (Wednesday) and do not change during the week.
            </p>
            <p style={{ fontSize: 12, color: "#92400e", margin: "8px 0 0 0", lineHeight: 1.7 }}>
              <strong>Betting strategy notes:</strong> The model performs best on games with edge between {OU_MIN_EDGE} and {OU_MAX_EDGE} points.
              Edges above {OU_MAX_EDGE} pts correlate with model error, not market inefficiency.
              Spreads are displayed for context but are not a wagering product {"\u2014"} the model{"\u2019"}s validated edge is in totals only (56.0% ATS across 4 seasons).{" "}
              <Link href="/nfl/rankings" style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>
                View full rankings {"\u2192"}
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

export default function NFLPicksPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}>
        <NFLPicksContent />
      </Suspense>
    </AuthProvider>
  );
}
