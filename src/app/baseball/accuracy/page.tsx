"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/baseball-games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

const FREE_EDGE_LIMIT = 3; // runs — premium tier threshold
const MIN_EDGE_FOR_RECORD = 1.0; // runs — minimum for record counting
const MAX_EDGE_FOR_RECORD = 5.0; // runs — cap for record counting
const JUICE = -110; // standard juice for ROI calculation

type Game = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  bbmiLine: number | null;
  vegasLine: number | null;
  bbmiTotal: number | null;
  vegasTotal: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homeWinPct: number | null;
  edge: number | null;
  conference: string;
  homePitcher: string;
  awayPitcher: string;
  pitcherConfirmed: boolean;
  bbmiMoneylineHome: number | null;
  bbmiMoneylineAway: number | null;
};

type SortKey =
  | "date" | "away" | "home" | "vegasLine" | "bbmiLine"
  | "edge" | "margin" | "result" | "vegasTotal" | "bbmiTotal"
  | "ouEdge" | "ouResult" | "score";

type SortDirection = "asc" | "desc";

/* ── Wilson confidence interval ─────────────────────────────────────────── */
function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, ((centre - margin) / denom) * 100),
    high: Math.min(100, ((centre + margin) / denom) * 100),
  };
}

/* ── ATS result: did BBMI pick cover? ───────────────────────────────────── */
function didCover(g: Game): boolean | null {
  if (g.actualHomeScore == null || g.actualAwayScore == null || g.vegasLine == null || g.bbmiLine == null) return null;
  const margin = g.actualHomeScore - g.actualAwayScore;
  const pickIsHome = g.bbmiLine < g.vegasLine;
  const homeCovers = margin > -g.vegasLine;
  if (margin === -g.vegasLine) return null; // push
  return pickIsHome ? homeCovers : !homeCovers;
}

/* ── O/U result ─────────────────────────────────────────────────────────── */
function ouResult(g: Game): { call: "under" | "over" | null; hit: boolean | null } {
  if (g.bbmiTotal == null || g.vegasTotal == null) return { call: null, hit: null };
  if (g.bbmiTotal === g.vegasTotal) return { call: null, hit: null };
  const call: "under" | "over" = g.bbmiTotal < g.vegasTotal ? "under" : "over";
  if (g.actualHomeScore == null || g.actualAwayScore == null) return { call, hit: null };
  const actualTotal = g.actualHomeScore + g.actualAwayScore;
  if (actualTotal === g.vegasTotal) return { call, hit: null }; // push
  const wentOver = actualTotal > g.vegasTotal;
  const hit = call === "over" ? wentOver : !wentOver;
  return { call, hit };
}

/* ── ROI at -110 juice ──────────────────────────────────────────────────── */
function computeROI(wins: number, total: number): number {
  if (total === 0) return 0;
  const winPayout = 100 / (Math.abs(JUICE) / 100); // = ~90.91
  const profit = wins * winPayout - (total - wins) * 100;
  return (profit / (total * 100)) * 100;
}

/* ── Shared styles ──────────────────────────────────────────────────────── */
const TH: React.CSSProperties = {
  backgroundColor: "#1a7a6e",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "center",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 20,
  borderBottom: "1px solid rgba(255,255,255,0.2)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  verticalAlign: "middle",
  userSelect: "none",
};

const TD: React.CSSProperties = {
  padding: "8px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };
const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };

/* ── Tooltip descriptions ───────────────────────────────────────────────── */
const TOOLTIPS: Record<string, string> = {
  date: "The date the game was played.",
  away: "The visiting team.",
  home: "The home team.",
  pitchers: "Starting pitchers (Away @ Home).",
  vegasLine: "The run line set by sportsbooks. Negative = home team is favored.",
  bbmiLine: "What BBMI's model predicted the run line should be. Compare to Vegas to understand the edge.",
  edge: "The absolute gap between BBMI's predicted line and the Vegas line in runs. Rows highlighted in gold have Edge >= 3 runs. Rows marked ~ have Edge < 1 run and are excluded from headline stats.",
  pick: "Which team BBMI's model sides with against the spread.",
  score: "Final score (Away - Home).",
  margin: "The actual run margin from the home team's perspective.",
  result: "Whether BBMI's pick covered the Vegas spread. Check = correct, X = incorrect.",
  vegasTotal: "The Over/Under total set by sportsbooks.",
  bbmiTotal: "What BBMI's model predicted the total should be.",
  ouEdge: "The gap between BBMI total and Vegas total. Negative = BBMI says under.",
  ouResult: "Whether the O/U call was correct.",
};

/* ── Portal tooltip ─────────────────────────────────────────────────────── */
function ColDescPortal({ tooltipId, anchorRect, onClose }: { tooltipId: string; anchorRect: DOMRect; onClose: () => void }) {
  const text = TOOLTIPS[tooltipId];
  const el = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (el.current && !el.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;
  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#eae8e1", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>x</button>
    </div>,
    document.body
  );
}

/* ── Sortable header with tooltip ───────────────────────────────────────── */
function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc }: {
  label: React.ReactNode;
  columnKey: SortKey;
  tooltipId?: string;
  sortConfig: { key: SortKey; direction: SortDirection };
  handleSort: (key: SortKey) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
}) {
  const isActive = sortConfig.key === columnKey;
  const thRef = React.useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ?? null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && TOOLTIPS[tooltipId] && openDesc && uid) {
      if (descShowing) { closeDesc?.(); }
      else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); }
    }
  };

  return (
    <th ref={thRef} style={{ ...TH, cursor: "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecorationLine: tooltipId ? "underline" : "none", textDecorationStyle: tooltipId ? "dotted" : undefined, textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

/* ── High-edge callout banner ───────────────────────────────────────────── */
function HighEdgeCallout({ overallWinPct, overallTotal, highEdgeWinPct, highEdgeTotal, underWinPct, underTotal }: {
  overallWinPct: string; overallTotal: number;
  highEdgeWinPct: string; highEdgeTotal: number;
  underWinPct: string; underTotal: number;
}) {
  const improvement = (Number(highEdgeWinPct) - Number(overallWinPct)).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#1a7a6e", borderRadius: 10, border: "none", overflow: "hidden" }}>
      <style>{`
        .hec-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 1.25rem 1rem; gap: 0; }
        .hec-divider-v { width: 1px; background: rgba(255,255,255,0.1); align-self: stretch; margin: 0.25rem 0; }
        .hec-cta { grid-column: 1 / -1; border-top: 1px solid rgba(255,255,255,0.08); padding: 0.9rem 1rem 0.25rem; display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; text-align: center; }
        @media (min-width: 640px) {
          .hec-grid { grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; padding: 1.25rem 1.5rem; }
          .hec-divider-v { height: 56px; align-self: center; margin: 0; }
          .hec-cta { grid-column: auto; border-top: none; padding: 0 0.75rem; display: block; text-align: center; }
        }
      `}</style>

      <div style={{ backgroundColor: "rgba(250,204,21,0.1)", borderBottom: "1px solid rgba(250,204,21,0.2)", padding: "0.5rem 1.25rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>
        Where the model performs best
      </div>

      <div className="hec-grid">
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>ATS Overall</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: Number(overallWinPct) >= 52.4 ? "#4ade80" : "#f87171", lineHeight: 1, marginBottom: "0.3rem" }}>{overallWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{overallTotal.toLocaleString()} picks (edge {"\u2265"} {MIN_EDGE_FOR_RECORD} run)</div>
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Edge {"\u2265"} {FREE_EDGE_LIMIT} runs</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#ffffff", lineHeight: 1, marginBottom: "0.3rem" }}>{highEdgeWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{highEdgeTotal.toLocaleString()} picks</div>
          {Number(improvement) !== 0 && (
            <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(250,204,21,0.15)", color: "#ffffff", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>+{improvement} runs</div>
          )}
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Under Record</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#38bdf8", lineHeight: 1, marginBottom: "0.3rem" }}>{underWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{underTotal.toLocaleString()} under calls</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(56,189,248,0.15)", color: "#38bdf8", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>Primary product</div>
        </div>

        <div className="hec-cta">
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", lineHeight: 1.5 }}>High-edge picks are <strong style={{ color: "#ffffff" }}>premium-only</strong> on Today&apos;s Picks</div>
          <a href="/baseball/picks" style={{ display: "inline-block", backgroundColor: "#ffffff", color: "#1a7a6e", padding: "0.5rem 1.1rem", borderRadius: 7, fontWeight: 800, fontSize: "0.8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
            View Today&apos;s Picks
          </a>
        </div>
      </div>

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.5rem 1.25rem", fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
        Overall record includes only picks where edge {"\u2265"} {MIN_EDGE_FOR_RECORD} run and {"\u2264"} {MAX_EDGE_FOR_RECORD} runs. Edges above {MAX_EDGE_FOR_RECORD} are capped — extreme disagreements are more likely data issues than genuine edges. The Vegas line is captured at a specific point in time — a difference smaller than {MIN_EDGE_FOR_RECORD} run is within normal market noise and excluded from stats.
      </div>
    </div>
  );
}

/* ── How-to accordion ───────────────────────────────────────────────────── */
function HowToReadAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, backgroundColor: open ? "#eae8e1" : "#1a7a6e", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>How do I use this page?</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>This page tracks every game BBMI has picked for college baseball — with full results logged publicly, unedited, from the first pick of the season.</p>
          <p style={{ marginBottom: 12 }}><strong>The Edge Filter is the most important control on this page.</strong> &ldquo;Edge&rdquo; is the gap between BBMI&apos;s predicted run line and the Vegas line. Rows highlighted in gold have edge {"\u2265"} {FREE_EDGE_LIMIT} runs — the highest-conviction tier.</p>
          <p style={{ marginBottom: 12 }}><strong>Spread (ATS):</strong> When BBMI&apos;s line differs from Vegas, we side with the team BBMI favors more. The Result column shows whether that pick covered.</p>
          <p style={{ marginBottom: 12 }}><strong>Over/Under:</strong> When BBMI&apos;s total differs from Vegas, we take the under if BBMI&apos;s total is lower (our primary product) or the over if higher. The O/U Result column tracks accuracy.</p>
          <p style={{ marginBottom: 12 }}><strong>Rows marked ~ in the Edge column</strong> have an edge below {MIN_EDGE_FOR_RECORD} run — within normal line movement — and are excluded from headline stats.</p>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "#166534", margin: 0, fontWeight: 600 }}>
              Pro tip: Filter to edge {"\u2265"} {FREE_EDGE_LIMIT} runs to see the exact picks subscribers get on Today&apos;s Picks — historically the highest accuracy and ROI tier.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>All ROI figures use simulated flat $100 wagers at {JUICE} juice for illustration. This is not financial or gambling advice.</p>
        </div>
      )}
    </div>
  );
}

/* ── Methodology accordion ──────────────────────────────────────────────── */
function MethodologyNote() {
  const [open, setOpen] = useState(false);
  const itemStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 14 };
  const numStyle: React.CSSProperties = { width: 26, height: 26, borderRadius: "50%", backgroundColor: "#1a7a6e", color: "white", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const labelStyle: React.CSSProperties = { fontSize: "0.82rem", fontWeight: 700, color: "#1c1917", marginBottom: 3 };
  const descStyle: React.CSSProperties = { fontSize: "0.76rem", color: "#78716c", lineHeight: 1.6, margin: 0 };
  return (
    <div style={{ maxWidth: 1100, margin: "2.5rem auto 0", backgroundColor: "white", borderRadius: 10, border: "1px solid #d4d2cc", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", padding: "10px 14px", backgroundColor: "#1a7a6e", color: "white", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Understanding the Numbers</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={itemStyle}>
            <div style={numStyle}>1</div>
            <div>
              <div style={labelStyle}>Win % (ATS &amp; O/U)</div>
              <p style={descStyle}>The share of picks where BBMI correctly predicted which side of the spread or total would cover. The break-even point at standard {JUICE} juice is ~52.4%. The 95% confidence interval shows the plausible range for the true underlying rate. Only picks with edge {"\u2265"} {MIN_EDGE_FOR_RECORD} run and {"\u2264"} {MAX_EDGE_FOR_RECORD} runs are included.</p>
            </div>
          </div>
          <div style={itemStyle}>
            <div style={numStyle}>2</div>
            <div>
              <div style={labelStyle}>ROI (Return on Investment)</div>
              <p style={descStyle}>Simulated return assuming a flat $100 wager per pick at {JUICE} odds. Positive ROI means the model has generated paper profit over the tracked period. Past simulated performance does not guarantee future results.</p>
            </div>
          </div>
          <div style={itemStyle}>
            <div style={numStyle}>3</div>
            <div>
              <div style={labelStyle}>Edge Column &mdash; including the ~ marker</div>
              <p style={descStyle}>The absolute gap in runs between BBMI and Vegas. Rows with Edge {"\u2265"} {FREE_EDGE_LIMIT} are highlighted in gold. Rows marked ~ have edge &lt; {MIN_EDGE_FOR_RECORD} run &mdash; within normal line movement &mdash; and are excluded from stats. Edges &gt; {MAX_EDGE_FOR_RECORD} runs are capped.</p>
            </div>
          </div>
          <div style={{ ...itemStyle, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
            <div style={numStyle}>4</div>
            <div>
              <div style={labelStyle}>Under Record</div>
              <p style={descStyle}>College baseball unders are the model&apos;s primary product based on walk-forward validation (61.7% historical). This is tracked prominently because it represents the strongest systematic edge.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════════════════════ */
export default function BaseballAccuracyPage() {
  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);

  // Completed games with Vegas lines
  const completed = useMemo(() =>
    allGames.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.vegasLine != null && g.bbmiLine != null
    ),
  [allGames]);

  /* ── Headline edge stats ────────────────────────────────────────────────── */
  const edgeStats = useMemo(() => {
    // ATS — overall (edge >= MIN, <= MAX)
    const atsQual = completed.filter(g => {
      const e = Math.abs(g.bbmiLine! - g.vegasLine!);
      return e >= MIN_EDGE_FOR_RECORD && e <= MAX_EDGE_FOR_RECORD;
    });
    let atsW = 0, atsL = 0;
    atsQual.forEach(g => { const r = didCover(g); if (r === true) atsW++; else if (r === false) atsL++; });
    const atsTotal = atsW + atsL;
    const overallWinPct = atsTotal > 0 ? ((atsW / atsTotal) * 100).toFixed(1) : "0.0";

    // ATS — high edge (>= FREE_EDGE_LIMIT)
    const highEdge = atsQual.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= FREE_EDGE_LIMIT);
    let heW = 0, heL = 0;
    highEdge.forEach(g => { const r = didCover(g); if (r === true) heW++; else if (r === false) heL++; });
    const heTotal = heW + heL;
    const highEdgeWinPct = heTotal > 0 ? ((heW / heTotal) * 100).toFixed(1) : "0.0";

    // O/U — under record
    const ouQual = completed.filter(g => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal !== g.vegasTotal);
    let underW = 0, underL = 0;
    ouQual.forEach(g => {
      const r = ouResult(g);
      if (r.call === "under" && r.hit === true) underW++;
      else if (r.call === "under" && r.hit === false) underL++;
    });
    const underTotal = underW + underL;
    const underWinPct = underTotal > 0 ? ((underW / underTotal) * 100).toFixed(1) : "0.0";

    return { overallWinPct, overallTotal: atsTotal, highEdgeWinPct, highEdgeTotal: heTotal, underWinPct, underTotal };
  }, [completed]);

  /* ── Edge filter state ──────────────────────────────────────────────────── */
  const [minEdge, setMinEdge] = useState<number>(0);
  const edgeOptions = [0, 1, 2, 3, 4, 5];

  const filtered = useMemo(() => {
    if (minEdge === 0) return completed;
    return completed.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= minEdge);
  }, [completed, minEdge]);

  /* ── ATS record for headline cards ──────────────────────────────────────── */
  const record = useMemo(() => {
    const qual = filtered.filter(g => {
      const e = Math.abs(g.bbmiLine! - g.vegasLine!);
      return e >= MIN_EDGE_FOR_RECORD && e <= MAX_EDGE_FOR_RECORD;
    });
    let wins = 0, losses = 0, pushes = 0;
    qual.forEach(g => {
      const r = didCover(g);
      if (r === true) wins++;
      else if (r === false) losses++;
      else pushes++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "---";
    const { low, high } = wilsonCI(wins, total);
    const roi = computeROI(wins, total);
    return { wins, losses, pushes, total, pct, ciLow: low, ciHigh: high, roi };
  }, [filtered]);

  /* ── O/U record for headline cards ──────────────────────────────────────── */
  const ouRecord = useMemo(() => {
    const qual = filtered.filter(g => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal !== g.vegasTotal);
    let wins = 0, losses = 0;
    qual.forEach(g => {
      const r = ouResult(g);
      if (r.hit === true) wins++;
      else if (r.hit === false) losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "---";
    const { low, high } = wilsonCI(wins, total);
    const roi = computeROI(wins, total);
    return { wins, losses, total, pct, ciLow: low, ciHigh: high, roi };
  }, [filtered]);

  /* ── Edge performance by bucket (ATS + O/U + ROI) ───────────────────────── */
  const edgePerf = useMemo(() => {
    const cats = [
      { name: "1\u20132", min: 1, max: 2 },
      { name: "2\u20133", min: 2, max: 3 },
      { name: "3\u20134", min: 3, max: 4 },
      { name: "\u2265 4", min: 4, max: MAX_EDGE_FOR_RECORD },
    ];
    return cats.map(cat => {
      const bucket = completed.filter(g => {
        const edge = Math.abs(g.bbmiLine! - g.vegasLine!);
        return edge >= cat.min && (cat.max === MAX_EDGE_FOR_RECORD ? edge <= cat.max : edge < cat.max);
      });
      // ATS
      let atsW = 0, atsL = 0;
      bucket.forEach(g => { const r = didCover(g); if (r === true) atsW++; else if (r === false) atsL++; });
      const atsTotal = atsW + atsL;
      const atsCI = wilsonCI(atsW, atsTotal);
      const atsROI = computeROI(atsW, atsTotal);
      // O/U — filter by O/U edge (not ATS edge) for the same bucket range
      const ouBucket = completed.filter(g => {
        if (g.bbmiTotal == null || g.vegasTotal == null || g.bbmiTotal === g.vegasTotal) return false;
        const ouEdge = Math.abs(g.bbmiTotal - g.vegasTotal);
        return ouEdge >= cat.min && (cat.max === MAX_EDGE_FOR_RECORD ? ouEdge <= cat.max : ouEdge < cat.max);
      });
      let ouW = 0, ouL = 0;
      ouBucket.forEach(g => { const r = ouResult(g); if (r.hit === true) ouW++; else if (r.hit === false) ouL++; });
      const ouTotal = ouW + ouL;
      const ouCI = wilsonCI(ouW, ouTotal);
      const ouROI = computeROI(ouW, ouTotal);
      return {
        name: cat.name,
        atsGames: atsTotal, atsWins: atsW, atsPct: atsTotal > 0 ? ((atsW / atsTotal) * 100).toFixed(1) : "---", atsCI, atsROI,
        ouGames: ouTotal, ouWins: ouW, ouPct: ouTotal > 0 ? ((ouW / ouTotal) * 100).toFixed(1) : "---", ouCI, ouROI,
      };
    });
  }, [completed]);

  /* ── Sort state ─────────────────────────────────────────────────────────── */
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: "edge", direction: "desc" });
  const handleSort = (key: SortKey) => setSortConfig((p) => ({ key, direction: p.key === key && p.direction === "desc" ? "asc" : "desc" }));

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = React.useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = React.useCallback(() => setDescPortal(null), []);

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  /* ── Week ranges for dropdown filter ─────────────────────────────────── */
  const addDaysUtil = (dateStr: string, n: number): string => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };

  const weekRanges = useMemo(() => {
    const allDates = Array.from(new Set(completed.map(g => g.date.split("T")[0]))).sort();
    if (allDates.length === 0) return [];
    const ranges: { start: string; end: string }[] = [];
    let cur = allDates[0];
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDaysUtil(cur, 6);
      if (completed.some(g => { const d = g.date.split("T")[0]; return d >= cur && d <= end; })) ranges.push({ start: cur, end });
      cur = addDaysUtil(cur, 7);
    }
    return ranges.reverse(); // most recent first
  }, [completed]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  /* ── Computed rows for game table (filtered by week) ──────────────────── */
  const weekFiltered = useMemo(() => {
    const range = weekRanges[selectedWeekIndex];
    if (!range) return filtered;
    return filtered.filter(g => { const d = g.date.split("T")[0]; return d >= range.start && d <= range.end; });
  }, [filtered, weekRanges, selectedWeekIndex]);

  const sortedGames = useMemo(() => {
    const withComputed = weekFiltered.map(g => {
      const _edge = Math.abs(g.bbmiLine! - g.vegasLine!);
      const _margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const _result = didCover(g);
      const _pick = g.bbmiLine! < g.vegasLine! ? g.homeTeam : g.awayTeam;
      const _ou = ouResult(g);
      const _ouEdge = (g.bbmiTotal != null && g.vegasTotal != null) ? g.bbmiTotal - g.vegasTotal : null;
      const _actualTotal = (g.actualHomeScore != null && g.actualAwayScore != null) ? g.actualHomeScore + g.actualAwayScore : null;
      return { ...g, _edge, _margin, _result, _pick, _ou, _ouEdge, _actualTotal };
    });
    return [...withComputed].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortConfig.key === "edge") { av = a._edge; bv = b._edge; }
      else if (sortConfig.key === "date") { av = a.date; bv = b.date; }
      else if (sortConfig.key === "margin") { av = a._margin; bv = b._margin; }
      else if (sortConfig.key === "result") { av = a._result === true ? 1 : a._result === false ? 0 : -1; bv = b._result === true ? 1 : b._result === false ? 0 : -1; }
      else if (sortConfig.key === "vegasLine") { av = a.vegasLine ?? 0; bv = b.vegasLine ?? 0; }
      else if (sortConfig.key === "bbmiLine") { av = a.bbmiLine ?? 0; bv = b.bbmiLine ?? 0; }
      else if (sortConfig.key === "vegasTotal") { av = a.vegasTotal ?? 0; bv = b.vegasTotal ?? 0; }
      else if (sortConfig.key === "bbmiTotal") { av = a.bbmiTotal ?? 0; bv = b.bbmiTotal ?? 0; }
      else if (sortConfig.key === "ouEdge") { av = a._ouEdge ?? 0; bv = b._ouEdge ?? 0; }
      else if (sortConfig.key === "ouResult") { av = a._ou.hit === true ? 1 : a._ou.hit === false ? 0 : -1; bv = b._ou.hit === true ? 1 : b._ou.hit === false ? 0 : -1; }
      else if (sortConfig.key === "score") { av = a._actualTotal ?? 0; bv = b._actualTotal ?? 0; }
      if (typeof av === "number" && typeof bv === "number") return sortConfig.direction === "asc" ? av - bv : bv - av;
      return sortConfig.direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortConfig]);

  /* ── Row + edge cell styling ────────────────────────────────────────────── */
  const getRowStyle = (edge: number, index: number): React.CSSProperties => {
    const isHighEdge = edge >= FREE_EDGE_LIMIT;
    const isBelowMin = edge < MIN_EDGE_FOR_RECORD;
    if (isHighEdge) return { backgroundColor: "rgba(254,252,232,0.7)" };
    if (isBelowMin) return { backgroundColor: index % 2 === 0 ? "rgba(249,250,251,0.5)" : "#ffffff", opacity: 0.65 };
    return { backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8f7f4" };
  };

  const edgeCellStyle = (edge: number): React.CSSProperties => {
    const isHighEdge = edge >= FREE_EDGE_LIMIT;
    const isBelowMin = edge < MIN_EDGE_FOR_RECORD;
    return {
      ...TD_CENTER,
      fontFamily: "ui-monospace, monospace",
      fontWeight: isHighEdge ? 800 : 500,
      fontSize: isHighEdge ? "0.85rem" : "0.8rem",
      color: isHighEdge ? "#92400e" : isBelowMin ? "#b0b8c1" : "#6b7280",
      backgroundColor: isHighEdge ? "rgba(250,204,21,0.15)" : "transparent",
      borderLeft: isHighEdge ? "2px solid #fbbf24" : "2px solid transparent",
      borderRight: isHighEdge ? "2px solid #fbbf24" : "2px solid transparent",
    };
  };

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9", minHeight: "100vh" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* ── HEADER ─────────────────────────────────────────────────────── */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a7a6e", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NCAA Baseball {"\u00B7"} Model Accuracy
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
              Model Accuracy
            </h1>
            <p style={{ fontSize: 13, color: "#666", margin: "0 auto", lineHeight: 1.6 }}>Full public log of every BBMI baseball pick vs actual results</p>
          </div>

          {/* ── HOW-TO ACCORDION ────────────────────────────────────────────── */}
          <HowToReadAccordion />

          {/* ── HIGH-EDGE CALLOUT ───────────────────────────────────────────── */}
          {/* HighEdgeCallout removed — stats shown in cards above */}

          {/* ── CALIBRATION NOTICE ──────────────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p style={{ fontSize: "0.8rem", color: "#78350f", fontWeight: 700, marginBottom: 4 }}>Calibration Phase</p>
              <p style={{ fontSize: "0.76rem", color: "#92400e", lineHeight: 1.55, margin: 0 }}>
                The baseball model launched in March 2026. Results are tracked transparently from day one. Statistical confidence requires 200+ games with Vegas lines. Headline stats count only picks where edge {"\u2265"} {MIN_EDGE_FOR_RECORD} run and {"\u2264"} {MAX_EDGE_FOR_RECORD} runs. All win percentages include 95% confidence intervals.
              </p>
            </div>
          </div>

          {/* ── HEADLINE STATS CARDS ────────────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
            {[
              {
                value: record.total > 0 ? `${record.pct}%` : "---",
                label: `ATS Record`,
                sub: `${record.wins}\u2013${record.losses}${record.pushes > 0 ? ` \u00b7 ${record.pushes} push` : ""} \u00b7 ${record.total} games`,
                color: record.total > 0 ? (Number(record.pct) >= 52.4 ? "#1a7a6e" : "#dc2626") : "#94a3b8",
              },
              {
                value: record.total > 0 ? `${record.roi.toFixed(1)}%` : "---",
                label: "ATS ROI",
                sub: `at ${JUICE} juice \u00b7 flat $100`,
                color: record.roi >= 0 ? "#1a7a6e" : "#dc2626",
              },
              {
                value: ouRecord.total > 0 ? `${ouRecord.pct}%` : "---",
                label: "O/U Record",
                sub: `${ouRecord.wins}\u2013${ouRecord.losses} \u00b7 ${ouRecord.total} calls`,
                color: ouRecord.total > 0 ? (Number(ouRecord.pct) >= 52.4 ? "#1a7a6e" : "#dc2626") : "#94a3b8",
              },
              {
                value: record.total > 0 ? `${record.ciLow.toFixed(1)}\u2013${record.ciHigh.toFixed(1)}%` : "---",
                label: "95% CI (ATS)",
                sub: "Wilson score interval",
                color: "#1a7a6e",
              },
            ].map(c => (
              <div key={c.label} style={{
                background: "#ffffff", border: "1px solid #d4d2cc",
                borderTop: "4px solid #1a7a6e", borderRadius: 10,
                padding: "1rem 0.75rem", textAlign: "center",
              }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 500, color: c.color, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#777", margin: "4px 0 3px" }}>{c.label}</div>
                <div style={{ fontSize: "0.63rem", color: "#666" }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* ── EDGE PERFORMANCE TABLE ──────────────────────────────────────── */}
          {completed.length >= 5 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#1a7a6e", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Performance by Edge Size (Runs)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ backgroundColor: "#eae8e1", color: "#444", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #d4d2cc" }}>Edge</th>
                        <th colSpan={4} style={{ backgroundColor: "#eae8e1", color: "#444", padding: "5px 10px", textAlign: "center", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #d4d2cc" }}>Spread (ATS)</th>
                        <th colSpan={4} style={{ backgroundColor: "#eae8e1", color: "#444", padding: "5px 10px", textAlign: "center", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #d4d2cc" }}>Over/Under</th>
                      </tr>
                      <tr>
                        {["Games", "Win %", "95% CI", "ROI", "Games", "Win %", "95% CI", "ROI"].map((h, i) => (
                          <th key={`${h}-${i}`} style={{ backgroundColor: "#eae8e1", color: "#444", padding: "5px 8px", textAlign: "center", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #d4d2cc" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {edgePerf.map((s, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                          <td style={{ ...TD_MONO, fontWeight: 600 }}>{s.name}</td>
                          <td style={TD_MONO}>{s.atsGames}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: s.atsGames > 0 && Number(s.atsPct) >= 52.4 ? "#1a7a6e" : s.atsGames > 0 ? "#dc2626" : "#94a3b8" }}>{s.atsPct}{s.atsGames > 0 ? "%" : ""}</td>
                          <td style={{ ...TD_MONO, fontSize: 11, color: "#78716c", fontStyle: "italic" }}>{s.atsGames > 0 ? `${s.atsCI.low.toFixed(1)}\u2013${s.atsCI.high.toFixed(1)}%` : "---"}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: s.atsROI >= 0 ? "#1a7a6e" : "#dc2626" }}>{s.atsGames > 0 ? `${s.atsROI >= 0 ? "+" : ""}${s.atsROI.toFixed(1)}%` : "---"}</td>
                          <td style={TD_MONO}>{s.ouGames}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: s.ouGames > 0 && Number(s.ouPct) >= 52.4 ? "#1a7a6e" : s.ouGames > 0 ? "#dc2626" : "#94a3b8" }}>{s.ouPct}{s.ouGames > 0 ? "%" : ""}</td>
                          <td style={{ ...TD_MONO, fontSize: 11, color: "#78716c", fontStyle: "italic" }}>{s.ouGames > 0 ? `${s.ouCI.low.toFixed(1)}\u2013${s.ouCI.high.toFixed(1)}%` : "---"}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: s.ouROI >= 0 ? "#1a7a6e" : "#dc2626" }}>{s.ouGames > 0 ? `${s.ouROI >= 0 ? "+" : ""}${s.ouROI.toFixed(1)}%` : "---"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── EDGE FILTER PILLS ──────────────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Minimum Edge (|BBMI Line - Vegas Line|):</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {edgeOptions.map((edge) => {
                  const isActive = minEdge === edge;
                  return (
                    <button
                      key={edge}
                      onClick={() => setMinEdge(edge)}
                      style={{
                        height: 34, padding: "0 14px", borderRadius: 999,
                        border: isActive ? "2px solid #1a7a6e" : "1px solid #c0bdb5",
                        backgroundColor: isActive ? "#1a7a6e" : "transparent",
                        color: isActive ? "#ffffff" : "#555",
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {edge === 0 ? "All" : `\u2265 ${edge}`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic" }}>
                Showing <strong>{sortedGames.length}</strong> games.
                {minEdge >= FREE_EDGE_LIMIT && edgeStats.highEdgeTotal > 0 && (
                  <span style={{ color: "#1a7a6e", fontWeight: 700 }}> You&apos;re viewing high-edge picks — {edgeStats.highEdgeWinPct}% ATS accuracy at this threshold.</span>
                )}
              </p>
            </div>
          </div>

          {/* ── ROW LEGEND ─────────────────────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 8px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", color: "#78716c", fontStyle: "italic" }}>
              Gold rows = Edge {"\u2265"} {FREE_EDGE_LIMIT} runs — highest conviction tier
            </span>
            <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontStyle: "italic" }}>
              ~ Faded rows = Edge &lt; {MIN_EDGE_FOR_RECORD} run — within normal line movement, excluded from stats
            </span>
          </div>

          {/* ── WEEKLY BREAKDOWN TABLE — ATS + O/U combined ────────────── */}
          {completed.length > 10 && (() => {
            const addDays = (dateStr: string, n: number): string => {
              const [y, m, d] = dateStr.split("-").map(Number);
              const dt = new Date(Date.UTC(y, m - 1, d));
              dt.setUTCDate(dt.getUTCDate() + n);
              return dt.toISOString().slice(0, 10);
            };
            const fmt = (d: string) => { const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };
            const allDates = Array.from(new Set(completed.map(g => g.date.split("T")[0]))).sort();
            const ranges: { start: string; end: string }[] = [];
            let cur = allDates[0];
            while (cur <= allDates[allDates.length - 1]) {
              const end = addDays(cur, 6);
              if (completed.some(g => { const d = g.date.split("T")[0]; return d >= cur && d <= end; })) ranges.push({ start: cur, end });
              cur = addDays(cur, 7);
            }
            const ouResult = (g: Game): boolean | null => {
              if (g.bbmiTotal == null || g.vegasTotal == null || g.bbmiTotal === g.vegasTotal) return null;
              const call = g.bbmiTotal < g.vegasTotal ? "under" : "over";
              const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
              if (actual === g.vegasTotal) return null;
              return call === (actual > g.vegasTotal ? "over" : "under");
            };
            const profitPerWin = 100 / (110 / 100);
            const calcRoi = (w: number, l: number) => { const t = w + l; return t > 0 ? ((w * profitPerWin - l * 100) / (t * 100) * 100) : 0; };
            const rows = ranges.map(({ start, end }) => {
              const weekGames = completed.filter(g => { const d = g.date.split("T")[0]; return d >= start && d <= end; });
              // ATS
              const atsMinEdge = minEdge > 0 ? minEdge : MIN_EDGE_FOR_RECORD;
              const atsQual = weekGames.filter(g => g.vegasLine != null && g.bbmiLine != null && Math.abs(g.bbmiLine! - g.vegasLine!) >= atsMinEdge && Math.abs(g.bbmiLine! - g.vegasLine!) <= MAX_EDGE_FOR_RECORD);
              let atsW = 0, atsL = 0;
              atsQual.forEach(g => {
                const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
                const pickHome = g.bbmiLine! < g.vegasLine!;
                const cover = margin + g.vegasLine!;
                if (cover === 0) return;
                if ((pickHome && cover > 0) || (!pickHome && cover < 0)) atsW++; else atsL++;
              });
              const atsT = atsW + atsL;
              const atsPct = atsT > 0 ? (atsW / atsT) * 100 : 0;
              const atsRoi = calcRoi(atsW, atsL);
              // O/U
              const ouMinEdge = minEdge > 0 ? minEdge : MIN_EDGE_FOR_RECORD;
              const ouQual = weekGames.filter(g => g.bbmiTotal != null && g.vegasTotal != null && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= ouMinEdge && Math.abs(g.bbmiTotal! - g.vegasTotal!) <= MAX_EDGE_FOR_RECORD);
              let ouW = 0, ouL = 0;
              ouQual.forEach(g => { const hit = ouResult(g); if (hit === true) ouW++; else if (hit === false) ouL++; });
              const ouT = ouW + ouL;
              const ouPct = ouT > 0 ? (ouW / ouT) * 100 : 0;
              const ouRoi = calcRoi(ouW, ouL);
              return { label: `${fmt(start)} \u2013 ${fmt(end)}`, atsT, atsPct, atsRoi, ouT, ouPct, ouRoi };
            });
            const sAtsW = rows.reduce((s, r) => s + Math.round(r.atsPct / 100 * r.atsT), 0);
            const sAtsT = rows.reduce((s, r) => s + r.atsT, 0);
            const sAtsPct = sAtsT > 0 ? (sAtsW / sAtsT) * 100 : 0;
            const sAtsRoi = calcRoi(sAtsW, sAtsT - sAtsW);
            const sOuW = rows.reduce((s, r) => s + Math.round(r.ouPct / 100 * r.ouT), 0);
            const sOuT = rows.reduce((s, r) => s + r.ouT, 0);
            const sOuPct = sOuT > 0 ? (sOuW / sOuT) * 100 : 0;
            const sOuRoi = calcRoi(sOuW, sOuT - sOuW);
            const cellStyle: React.CSSProperties = { padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", borderBottom: "1px solid #f1f5f9", color: "#292524", fontFamily: "ui-monospace, monospace" };
            const hStyle: React.CSSProperties = { padding: "8px 10px", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" };
            const pctColor = (pct: number) => pct >= 55 ? "#1a7a6e" : pct >= 50 ? "#78716c" : "#dc2626";
            const roiColor = (roi: number) => roi >= 0 ? "#1a7a6e" : "#dc2626";
            return (
              <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "white", borderRadius: 10, border: "1px solid #d4d2cc", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ padding: "10px 14px", backgroundColor: "#1a7a6e", color: "white", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Weekly Performance Breakdown
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
                    <thead>
                      <tr>
                        <th rowSpan={2} style={{ ...hStyle, textAlign: "left", verticalAlign: "bottom" }}>Week</th>
                        <th colSpan={3} style={{ ...hStyle, textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Against the Spread</th>
                        <th colSpan={3} style={{ ...hStyle, textAlign: "center", borderBottom: "1px solid #cbd5e1" }}>Over / Under</th>
                      </tr>
                      <tr>
                        <th style={hStyle}>Picks</th>
                        <th style={hStyle}>Win %</th>
                        <th style={hStyle}>ROI</th>
                        <th style={hStyle}>Picks</th>
                        <th style={hStyle}>Win %</th>
                        <th style={hStyle}>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rows].reverse().map((row, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f5f3ef" }}>
                          <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 500, color: "#44403c" }}>{row.label}</td>
                          <td style={cellStyle}>{row.atsT}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(row.atsPct) }}>{row.atsT > 0 ? `${row.atsPct.toFixed(1)}%` : "\u2014"}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: roiColor(row.atsRoi) }}>{row.atsT > 0 ? `${row.atsRoi >= 0 ? "+" : ""}${row.atsRoi.toFixed(1)}%` : "\u2014"}</td>
                          <td style={cellStyle}>{row.ouT}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(row.ouPct) }}>{row.ouT > 0 ? `${row.ouPct.toFixed(1)}%` : "\u2014"}</td>
                          <td style={{ ...cellStyle, fontWeight: 700, color: roiColor(row.ouRoi) }}>{row.ouT > 0 ? `${row.ouRoi >= 0 ? "+" : ""}${row.ouRoi.toFixed(1)}%` : "\u2014"}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
                        <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>Season Total</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>{sAtsT}</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(sAtsPct), borderBottom: "none" }}>{sAtsPct.toFixed(1)}%</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: roiColor(sAtsRoi), borderBottom: "none" }}>{sAtsRoi >= 0 ? "+" : ""}{sAtsRoi.toFixed(1)}%</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>{sOuT}</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(sOuPct), borderBottom: "none" }}>{sOuPct.toFixed(1)}%</td>
                        <td style={{ ...cellStyle, fontWeight: 700, color: roiColor(sOuRoi), borderBottom: "none" }}>{sOuRoi >= 0 ? "+" : ""}{sOuRoi.toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ padding: "6px 14px", fontSize: "0.68rem", color: "#666666", borderTop: "1px solid #d4d2cc", backgroundColor: "#f5f3ef" }}>
                  ROI at standard {"\u2212"}110 juice
                </div>
              </div>
            );
          })()}

          {/* ── WEEK SELECTOR ────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Historical Results By Week</h2>
            {weekRanges.length > 0 && (
              <select value={selectedWeekIndex} onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
                style={{ height: 38, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 12px", backgroundColor: "#ffffff", fontSize: 14, fontWeight: 500 }}>
                {weekRanges.map((range, idx) => (
                  <option key={idx} value={idx}>{fmtDate(range.start)} – {fmtDate(range.end)}</option>
                ))}
              </select>
            )}
          </div>

          {/* ── GAME-BY-GAME TABLE ─────────────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 650, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1300 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Date" columnKey="date" tooltipId="date" {...headerProps} />
                      <th style={{ ...TH, textAlign: "left" }}>Away</th>
                      <th style={{ ...TH, textAlign: "left" }}>Home</th>
                      <th style={{ ...TH, fontSize: "0.65rem" }}>Pitchers</th>
                      <SortableHeader label="Vegas" columnKey="vegasLine" tooltipId="vegasLine" {...headerProps} />
                      <SortableHeader label="BBMI" columnKey="bbmiLine" tooltipId="bbmiLine" {...headerProps} />
                      <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" {...headerProps} />
                      <th style={TH}>Pick</th>
                      <SortableHeader label="Score" columnKey="score" tooltipId="score" {...headerProps} />
                      <SortableHeader label="Margin" columnKey="margin" tooltipId="margin" {...headerProps} />
                      <SortableHeader label="Result" columnKey="result" tooltipId="result" {...headerProps} />
                      <SortableHeader label="V O/U" columnKey="vegasTotal" tooltipId="vegasTotal" {...headerProps} />
                      <SortableHeader label="B O/U" columnKey="bbmiTotal" tooltipId="bbmiTotal" {...headerProps} />
                      <th style={TH}>O/U Call</th>
                      <SortableHeader label="O/U Res" columnKey="ouResult" tooltipId="ouResult" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.length === 0 && (
                      <tr><td colSpan={15} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No completed games with Vegas lines yet.</td></tr>
                    )}
                    {sortedGames.map((g, i) => {
                      const isBelowMin = g._edge < MIN_EDGE_FOR_RECORD;
                      const isHighEdge = g._edge >= FREE_EDGE_LIMIT;

                      const rowTD = isBelowMin ? { ...TD, color: "#9ca3af" } : TD;
                      const rowTDM = isBelowMin ? { ...TD_MONO, color: "#9ca3af" } : TD_MONO;

                      return (
                        <tr key={g.gameId} style={getRowStyle(g._edge, i)}>
                          {/* Date */}
                          <td style={{ ...rowTDM, fontSize: 12 }}>{g.date}</td>

                          {/* Away */}
                          <td style={rowTD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: isBelowMin ? "#9ca3af" : "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.awayTeam} size={18} />
                              <span style={{ fontSize: 12 }}>{g.awayTeam}</span>
                            </Link>
                          </td>

                          {/* Home */}
                          <td style={rowTD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: isBelowMin ? "#9ca3af" : "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.homeTeam} size={18} />
                              <span style={{ fontSize: 12 }}>{g.homeTeam}</span>
                            </Link>
                          </td>

                          {/* Pitchers */}
                          <td style={{ ...rowTDM, fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {g.awayPitcher && g.homePitcher
                              ? <span title={`${g.awayPitcher} @ ${g.homePitcher}`}>{g.awayPitcher} @ {g.homePitcher}</span>
                              : <span style={{ color: "#b0b8c1" }}>---</span>
                            }
                          </td>

                          {/* Vegas Line */}
                          <td style={rowTDM}>{g.vegasLine}</td>

                          {/* BBMI Line */}
                          <td style={rowTDM}>{g.bbmiLine}</td>

                          {/* Edge */}
                          <td style={edgeCellStyle(g._edge)}>
                            {isHighEdge && <span style={{ marginRight: 3, fontSize: "0.7rem" }}>*</span>}
                            {isBelowMin && <span style={{ marginRight: 2, fontSize: "0.7rem", color: "#b0b8c1" }}>~</span>}
                            {g._edge.toFixed(1)}
                          </td>

                          {/* Pick */}
                          <td style={rowTD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g._pick)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: isBelowMin ? "#9ca3af" : "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g._pick} size={16} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{g._pick}</span>
                            </Link>
                          </td>

                          {/* Score */}
                          <td style={{ ...rowTDM, fontSize: 12 }}>{g.actualAwayScore}{"\u2013"}{g.actualHomeScore}</td>

                          {/* Margin */}
                          <td style={rowTDM}>{g._margin > 0 ? "+" : ""}{g._margin}</td>

                          {/* ATS Result */}
                          <td style={rowTDM}>
                            {g._result === true
                              ? <span style={{ color: isBelowMin ? "#9ca3af" : "#1a7a6e", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2713"}</span>
                              : g._result === false
                              ? <span style={{ color: isBelowMin ? "#9ca3af" : "#dc2626", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2717"}</span>
                              : <span style={{ color: "#94a3b8" }}>---</span>
                            }
                          </td>

                          {/* Vegas O/U */}
                          <td style={rowTDM}>{g.vegasTotal ?? "---"}</td>

                          {/* BBMI O/U */}
                          <td style={rowTDM}>{g.bbmiTotal ?? "---"}</td>

                          {/* O/U Call */}
                          <td style={{ ...rowTDM, fontWeight: 600, color: isBelowMin ? "#9ca3af" : g._ou.call === "under" ? "#2563eb" : g._ou.call === "over" ? "#ea580c" : "#94a3b8" }}>
                            {g._ou.call ? g._ou.call.charAt(0).toUpperCase() + g._ou.call.slice(1) : "---"}
                          </td>

                          {/* O/U Result */}
                          <td style={rowTDM}>
                            {g._ou.hit === true
                              ? <span style={{ color: isBelowMin ? "#9ca3af" : "#1a7a6e", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2713"}</span>
                              : g._ou.hit === false
                              ? <span style={{ color: isBelowMin ? "#9ca3af" : "#dc2626", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2717"}</span>
                              : <span style={{ color: "#94a3b8" }}>---</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── METHODOLOGY NOTE ────────────────────────────────────────────── */}
          <MethodologyNote />

        </div>
      </div>
    </>
  );
}
