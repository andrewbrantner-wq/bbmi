"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/mlb-games.json";
import rankingsRaw from "@/data/rankings/mlb-rankings.json";
import MLBLogo from "@/components/MLBLogo";

const _accRanks = rankingsRaw as Record<string, Record<string, unknown>>;
function accRank(team: string): number | null {
  const r = _accRanks[team]?.model_rank;
  return r != null ? Number(r) : null;
}

// ────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────
// Shared thresholds — single source of truth
import {
  OU_MIN_EDGE, OVER_MIN_EDGE, OU_STRONG_EDGE, OU_PREMIUM_EDGE, OU_JUICE,
  OVER_HIGH_TOTAL_CUTOFF,
  RL_STRONG_MARGIN, RL_PREMIUM_MARGIN, RL_BASE_RATE, RL_JUICE_AWAY_DOG,
} from "@/config/mlb-thresholds";

type MLBGame = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  homePitcher: string;
  awayPitcher: string;
  bbmiTotal: number | null;
  bbmiMargin: number | null;
  vegasTotal: number | null;
  homeWinPct: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  ouEdge: number | null;
  ouPick: string | null;
  rlPick: string | null;
  rlMarginEdge: number | null;
  ouConfidenceTier: number;
  rlConfidenceTier: number;
  homeML: number | null;
  awayML: number | null;
};

type SortKey = "date" | "away" | "home" | "edge" | "result" | "score" | "total" | "tier";
type SortDir = "asc" | "desc";

const allGames = (() => {
  const raw = games as unknown as MLBGame[];
  const seen = new Set<string>();
  return raw.filter(g => { if (seen.has(g.gameId)) return false; seen.add(g.gameId); return true; });
})();

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, ((c - m) / d) * 100), high: Math.min(100, ((c + m) / d) * 100) };
}

function computeROI(wins: number, total: number, juice: number): number {
  if (total === 0) return 0;
  const winPayout = 100 / (Math.abs(juice) / 100);
  const profit = wins * winPayout - (total - wins) * 100;
  return (profit / (total * 100)) * 100;
}

// RL ROI on the Release 3 single-cell product. All picks are standard-line
// away-underdog +1.5 bets with juice tightly clustered around RL_JUICE_AWAY_DOG
// (-175). A single constant is more honest than a regime-keyed lookup here —
// the cell is narrow enough that per-regime variance is within noise.
function computeRLROI(wins: number, total: number): number {
  if (total === 0) return 0;
  const winPayout = 100 / (Math.abs(RL_JUICE_AWAY_DOG) / 100);
  const profit = wins * winPayout - (total - wins) * 100;
  return (profit / (total * 100)) * 100;
}

function confidenceDots(tier: number): string {
  return "\u25CF".repeat(Math.max(tier, 0));
}

// ────────────────────────────────────────────────────────────────
// SHARED STYLES
// ────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  backgroundColor: "#1a6640", color: "#ffffff", padding: "8px 10px",
  textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0,
  zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)",
  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", verticalAlign: "middle", userSelect: "none",
};

const TD: React.CSSProperties = {
  padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 13,
  whiteSpace: "nowrap", verticalAlign: "middle",
};

const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };
const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

// ────────────────────────────────────────────────────────────────
// TOOLTIP DESCRIPTIONS
// ────────────────────────────────────────────────────────────────

const TOOLTIPS_RL: Record<string, string> = {
  date: "The date the game was played.",
  away: "The visiting team (BBMI pick for run line).",
  home: "The home team.",
  edge: "BBMI projected margin edge. Larger = more confident the away team covers +1.5.",
  tier: "Confidence tier: \u25CF = standard, \u25CF\u25CF = strong (margin \u2265 0.15), \u25CF\u25CF\u25CF = premium (margin \u2265 0.25).",
  score: "Final score (Away \u2013 Home).",
  result: "Whether the away team covered +1.5 (home won by 0\u20131 or away won).",
};

const TOOLTIPS_OU: Record<string, string> = {
  date: "The date the game was played.",
  away: "The visiting team.",
  home: "The home team.",
  vegasTotal: "The posted over/under total from sportsbooks.",
  bbmiTotal: "BBMI\u2019s projected game total.",
  edge: "The gap between posted total and BBMI total. Minimum 1.0 runs for a pick.",
  tier: "Confidence tier: \u25CF = standard (\u2265 1.00), \u25CF\u25CF = strong (\u2265 1.25), \u25CF\u25CF\u25CF = premium (\u2265 1.50).",
  score: "Actual combined runs scored.",
  result: "Whether the under/over call was correct.",
};

// ────────────────────────────────────────────────────────────────
// PORTAL TOOLTIP
// ────────────────────────────────────────────────────────────────

function ColDescPortal({ tooltipId, anchorRect, onClose, tooltips }: {
  tooltipId: string; anchorRect: DOMRect; onClose: () => void; tooltips: Record<string, string>;
}) {
  const text = tooltips[tooltipId];
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
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
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

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc, tooltips }: {
  label: React.ReactNode; columnKey: SortKey; tooltipId?: string;
  sortConfig: { key: SortKey; direction: SortDir };
  handleSort: (key: SortKey) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  tooltips: Record<string, string>;
}) {
  const isActive = sortConfig.key === columnKey;
  const thRef = React.useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ?? null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && tooltips[tooltipId] && openDesc && uid) {
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
          {isActive ? (sortConfig.direction === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
        </span>
      </div>
    </th>
  );
}

// ────────────────────────────────────────────────────────────────
// DISCLOSURE ACCORDION
// ────────────────────────────────────────────────────────────────

function DisclosureAccordion({ mode }: { mode: "rl" | "ou" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e8f0ec", borderTop: "1px solid #c6dece", borderRight: "1px solid #c6dece", borderBottom: "1px solid #c6dece", borderLeft: "4px solid #1a6640", borderRadius: 6, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(p => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, backgroundColor: "transparent", color: "#1a6640", border: "none", cursor: "pointer" }}>
        <span>{"\u25B8"} How do I use this page?</span>
        <span style={{ fontSize: 12 }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#f9fafb", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          {mode === "rl" ? (
            <>
              <p style={{ marginBottom: 12 }}>This page tracks every MLB away +1.5 run line pick BBMI has made — with full results logged publicly, unedited, from the first pick of the 2026 season.</p>
              <p style={{ marginBottom: 12 }}><strong>Away +1.5 Run Line:</strong> When the model projects an away team advantage, the home team is less likely to win by 2+ runs than normal. The away +1.5 line covers whenever the home team wins by 0&ndash;1 runs, or the away team wins outright.</p>
              <p style={{ marginBottom: 12 }}><strong>Confidence tiers:</strong> {"\u25CF"} Standard picks use model margin. {"\u25CF\u25CF"} ACE picks qualify via pitching matchup (FIP differential or individual starter FIP).</p>
              <p style={{ fontSize: 12, color: "#92400e", marginTop: 10, marginBottom: 0, fontWeight: 600 }}>Walk-forward validation under revision (2026-04-18): cell-definition audit in progress. Prior number (69.9% on 103) was computed using a moneyline-sign proxy that misclassifies tight-spread games; correct identification of Vegas favorite/underdog requires devigged Vegas probabilities, not available from current WF records. Honest numbers pending re-derivation. Live picks and grading in the table below remain accurate.</p>
            </>
          ) : (
            <>
              <p style={{ marginBottom: 12 }}>This page tracks every MLB total (over/under) pick BBMI has made — with full results logged publicly, unedited, from the first pick of the 2026 season.</p>
              <p style={{ marginBottom: 12 }}><strong>O/U picks</strong> are generated when the model identifies games where the projected total differs significantly from the posted total (edge {"\u2265"} 1.0 runs).</p>
              <p style={{ marginBottom: 12 }}><strong>Over picks (CCS-gated, June+)</strong> are generated when the model projects the total 1.25+ runs above the posted line and passes the CCS seasonal gate.</p>
              <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>Walk-forward validation (2024-2025): Under 57.5% ATS on 548 filtered games. Over Premium+: 53.7% on 311 games (Jun+). Filters: no openers, both teams {"\u2265"} 20 GP. Past performance does not guarantee future results.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// METHODOLOGY ACCORDION
// ────────────────────────────────────────────────────────────────

function MethodologyNote() {
  const [open, setOpen] = useState(false);
  const itemStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 14 };
  const numStyle: React.CSSProperties = { width: 26, height: 26, borderRadius: "50%", backgroundColor: "#1a6640", color: "white", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const labelStyle: React.CSSProperties = { fontSize: "0.82rem", fontWeight: 700, color: "#1c1917", marginBottom: 3 };
  const descStyle: React.CSSProperties = { fontSize: "0.76rem", color: "#78716c", lineHeight: 1.6, margin: 0 };
  return (
    <div style={{ maxWidth: 1100, margin: "2.5rem auto 0", backgroundColor: "#e8f0ec", borderTop: "1px solid #c6dece", borderRight: "1px solid #c6dece", borderBottom: "1px solid #c6dece", borderLeft: "4px solid #1a6640", borderRadius: 6, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(p => !p)}
        style={{ width: "100%", padding: "10px 14px", backgroundColor: "transparent", color: "#1a6640", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Understanding the Numbers</span>
        <span>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <div style={itemStyle}>
            <div style={numStyle}>1</div>
            <div>
              <div style={labelStyle}>Negative Binomial Model</div>
              <p style={descStyle}>BBMI uses a Negative Binomial scoring engine — not Poisson — with conditional dispersion. The model incorporates FIP-based pitcher quality, park-neutral wOBA for offense, asymmetric park factors, and a trailing 30-day scoring environment adjustment.</p>
            </div>
          </div>
          <div style={itemStyle}>
            <div style={numStyle}>2</div>
            <div>
              <div style={labelStyle}>Run Line Cover Rate</div>
              <p style={descStyle}>Walk-forward cover rate is under revision as of 2026-04-18. The product targets away +1.5 picks where the away team is the Vegas underdog; the cell definition used in prior analyses relied on a moneyline-sign proxy that misclassifies tight-spread games, and honest re-derivation is pending. The pipeline filter has been hotfixed to compare both moneylines directly; no picks are being generated in the interim while the cell is re-audited.</p>
            </div>
          </div>
          <div style={itemStyle}>
            <div style={numStyle}>3</div>
            <div>
              <div style={labelStyle}>Under Picks</div>
              <p style={descStyle}>Games where the model total differs by {"\u2265"} {OU_MIN_EDGE} runs from the posted line generate recommendations. Walk-forward: 57.5% ATS on 548 filtered games (2024-2025). Filters: no openers, both teams {"\u2265"} 20 GP.</p>
            </div>
          </div>
          <div style={{ ...itemStyle, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
            <div style={numStyle}>4</div>
            <div>
              <div style={labelStyle}>ROI Calculation</div>
              <p style={descStyle}>ROI is calculated using flat $100 simulated wagers. Run line ROI uses {RL_JUICE_AWAY_DOG} juice (empirical median of away +1.5 underdog lines in 2026 live data). Over/under ROI uses {OU_JUICE} juice (standard). Past simulated performance does not guarantee future results.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

export default function MLBAccuracyPage() {
  const [mode, setMode] = useState<"rl" | "ou">("rl");

  // ── Completed games ──
  const completed = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null),
  []);

  // ── Run Line results ──
  // Dual grading: wonDisplayed is what subscribers saw at settlement (always +1.5).
  // wonCorrected is the 2026-04-18 PM methodology — grade at +1.5 when away is
  // Vegas underdog, -1.5 when away is Vegas favorite. Determined by comparing
  // BOTH moneylines (away is favorite iff awayML < homeML). Earlier homeML-sign
  // proxy failed on tight-spread games and was replaced.
  // inNewCell flags picks that belong to the (still-under-revision) viable cell.
  const rlResults = useMemo(() => {
    return completed
      .filter(g => g.rlPick != null && g.bbmiMargin != null && (g.rlPick ?? "").includes("+1.5"))
      .map(g => {
        const actualMargin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const wonDisplayed = actualMargin <= 1; // historical +1.5 grading (what subscribers saw)
        // Correct-side grading requires knowing which team was the Vegas favorite.
        // The favorite is the team with the MORE NEGATIVE moneyline (away fav iff awayML < homeML).
        let wonCorrected: boolean | null;
        let inNewCell = false;
        if (g.homeML == null || g.awayML == null) {
          wonCorrected = null;   // can't determine Vegas side
        } else if (g.awayML > g.homeML) {
          // away ML strictly greater than home ML → away is Vegas underdog → +1.5 correct
          wonCorrected = actualMargin <= 1;
          inNewCell = true;
        } else if (g.awayML < g.homeML) {
          // away ML strictly less → away is Vegas favorite → -1.5 correct
          wonCorrected = actualMargin <= -2;
          inNewCell = false;
        } else {
          // awayML == homeML → pick'em, no clear underdog, excluded from product
          wonCorrected = null;
          inNewCell = false;
        }
        const edge = Math.abs(g.bbmiMargin ?? 0);
        // Release 3 is single-tier — tier field retained for table layout compatibility
        const tier = 1;
        // `won` drives stats cards, tier breakdowns, ROI — set to corrected grade
        // ONLY for picks in the new cell. Out-of-cell picks (pre-correction
        // historical records) contribute null so they don't pollute headline stats.
        // The game-by-game table displays wonDisplayed and wonCorrected separately.
        const won = inNewCell ? wonCorrected : null;
        return { ...g, actualMargin, won, wonDisplayed, wonCorrected, inNewCell, edge, tier };
      });
  }, [completed]);

  // ── O/U results — under picks (only games where ouPick was actually set) ──
  const ouUnderResults = useMemo(() => {
    return completed
      .filter(g => g.ouPick === "UNDER")
      .map(g => {
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        const won = actual < (g.vegasTotal ?? 0);
        const push = actual === (g.vegasTotal ?? 0);
        const edge = g.vegasTotal != null && g.bbmiTotal != null ? Math.abs(g.vegasTotal - g.bbmiTotal) : 0;
        const tier = g.ouConfidenceTier ?? (edge >= OU_PREMIUM_EDGE ? 3 : edge >= OU_STRONG_EDGE ? 2 : 1);
        return { ...g, actualTotal: actual, won: push ? null : won, edge, tier, call: "UNDER" as const };
      });
  }, [completed]);

  // ── O/U results — over picks (Jun+ display gate) ──
  const ouOverResults = useMemo(() => {
    return completed
      .filter(g => {
        if (g.ouPick !== "OVER") return false;
        // Over-seasonal display gate: Jun+ only on accuracy page
        const month = g.date ? parseInt(g.date.split("-")[1]) : 0;
        if (month < 6) return false;
        return true;
      })
      .map(g => {
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        const won = actual > (g.vegasTotal ?? 0);
        const push = actual === (g.vegasTotal ?? 0);
        const edge = g.vegasTotal != null && g.bbmiTotal != null ? Math.abs(g.bbmiTotal - g.vegasTotal) : 0;
        const tier = edge >= OU_PREMIUM_EDGE ? 2 : 1;
        return { ...g, actualTotal: actual, won: push ? null : won, edge, tier, call: "OVER" as const };
      });
  }, [completed]);

  const ouAllResults = useMemo(() => [...ouUnderResults, ...ouOverResults], [ouUnderResults, ouOverResults]);

  // ── Active results based on mode ──
  const activeResults = mode === "rl" ? rlResults : ouAllResults;

  // ── Summary stats ──
  const stats = useMemo(() => {
    if (mode === "rl") {
      const decided = rlResults.filter(r => r.won !== null);
      const wins = decided.filter(r => r.won).length;
      const total = decided.length;
      const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "---";
      const ci = wilsonCI(wins, total);
      const roi = computeRLROI(wins, total);
      const edgeAboveBase = total > 0 ? (Number(pct) - RL_BASE_RATE).toFixed(1) : "---";
      // Tier breakdown
      const premiumGames = decided.filter(r => r.edge >= RL_PREMIUM_MARGIN);
      const premiumW = premiumGames.filter(r => r.won).length;
      const premiumPct = premiumGames.length > 0 ? ((premiumW / premiumGames.length) * 100).toFixed(1) : "---";
      return { wins, total, pct, ci, roi, edgeAboveBase, premiumPct, premiumTotal: premiumGames.length };
    } else {
      // Under stats
      const underDecided = ouUnderResults.filter(r => r.won !== null);
      const underW = underDecided.filter(r => r.won).length;
      const underT = underDecided.length;
      const underPct = underT > 0 ? ((underW / underT) * 100).toFixed(1) : "---";
      const underCI = wilsonCI(underW, underT);
      const underROI = computeROI(underW, underT, OU_JUICE);
      // Over watch stats
      const overDecided = ouOverResults.filter(r => r.won !== null);
      const overW = overDecided.filter(r => r.won).length;
      const overT = overDecided.length;
      const overPct = overT > 0 ? ((overW / overT) * 100).toFixed(1) : "---";
      const overROI = computeROI(overW, overT, OU_JUICE);
      return { underW, underT, underPct, underCI, underROI, overW, overT, overPct, overROI };
    }
  }, [mode, rlResults, ouUnderResults, ouOverResults]);

  // ── Rolling 30 ──
  const rolling30 = useMemo(() => {
    const sorted = [...activeResults]
      .filter(r => ("won" in r) && r.won !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 10) return null;
    const last30 = sorted.slice(-30);
    const w = last30.filter(r => r.won).length;
    return { wins: w, total: last30.length, pct: ((w / last30.length) * 100).toFixed(1) };
  }, [activeResults]);

  // ── Streak ──
  const streak = useMemo(() => {
    const decided = [...activeResults]
      .filter(r => ("won" in r) && r.won !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (decided.length === 0) return "";
    let count = 1;
    const dir = decided[0].won ? "W" : "L";
    for (let i = 1; i < decided.length; i++) {
      if ((decided[i].won ? "W" : "L") === dir) count++;
      else break;
    }
    return `${dir}${count}`;
  }, [activeResults]);

  // ── Sort state ──
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDir }>({ key: "date", direction: "desc" });
  const handleSort = (key: SortKey) => setSortConfig(p => ({ key, direction: p.key === key && p.direction === "desc" ? "asc" : "desc" }));

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = React.useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = React.useCallback(() => setDescPortal(null), []);

  const tooltips = mode === "rl" ? TOOLTIPS_RL : TOOLTIPS_OU;
  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc, tooltips };

  // ── Sorted rows ──
  const sortedRows = useMemo(() => {
    const rows = [...activeResults];
    return rows.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortConfig.key === "date") { av = a.date; bv = b.date; }
      else if (sortConfig.key === "away") { av = a.awayTeam; bv = b.awayTeam; }
      else if (sortConfig.key === "home") { av = a.homeTeam; bv = b.homeTeam; }
      else if (sortConfig.key === "edge") { av = a.edge; bv = b.edge; }
      else if (sortConfig.key === "tier") { av = a.tier; bv = b.tier; }
      else if (sortConfig.key === "result") {
        av = a.won === true ? 1 : a.won === false ? 0 : -1;
        bv = b.won === true ? 1 : b.won === false ? 0 : -1;
      }
      else if (sortConfig.key === "score") {
        if (mode === "rl") {
          av = (a as typeof rlResults[0]).actualMargin ?? 0;
          bv = (b as typeof rlResults[0]).actualMargin ?? 0;
        } else {
          av = (a as typeof ouAllResults[0]).actualTotal ?? 0;
          bv = (b as typeof ouAllResults[0]).actualTotal ?? 0;
        }
      }
      else if (sortConfig.key === "total") {
        if (mode === "ou") {
          av = a.vegasTotal ?? 0; bv = b.vegasTotal ?? 0;
        }
      }
      if (typeof av === "number" && typeof bv === "number") return sortConfig.direction === "asc" ? av - bv : bv - av;
      return sortConfig.direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [activeResults, sortConfig, mode]);

  // ── Weekly breakdown ──
  const weeklyBreakdown = useMemo(() => {
    if (activeResults.length < 3) return null;
    const decided = activeResults.filter(r => r.won !== null);
    const allDates = Array.from(new Set(decided.map(r => r.date.split("T")[0]))).sort();
    if (allDates.length === 0) return null;

    const addDays = (dateStr: string, n: number): string => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    const fmt = (d: string) => { const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };

    const ranges: { start: string; end: string }[] = [];
    let cur = allDates[0];
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDays(cur, 6);
      if (decided.some(r => { const d = r.date.split("T")[0]; return d >= cur && d <= end; }))
        ranges.push({ start: cur, end });
      cur = addDays(cur, 7);
    }

    // O/U uses OU_JUICE; RL uses the single RL_JUICE_AWAY_DOG via computeRLROI.
    const profitPerWinOU = 100 / (Math.abs(OU_JUICE) / 100);
    const calcOuRoi = (w: number, l: number) => { const t = w + l; return t > 0 ? ((w * profitPerWinOU - l * 100) / (t * 100) * 100) : 0; };

    const rows = ranges.map(({ start, end }) => {
      const weekGames = decided.filter(r => { const d = r.date.split("T")[0]; return d >= start && d <= end; });
      const w = weekGames.filter(r => r.won).length;
      const l = weekGames.length - w;
      const t = weekGames.length;
      const pct = t > 0 ? (w / t) * 100 : 0;
      const roi = mode === "rl" ? computeRLROI(w, t) : calcOuRoi(w, l);
      return { label: `${fmt(start)} \u2013 ${fmt(end)}`, w, l, t, pct, roi };
    });

    const totalW = rows.reduce((s, r) => s + r.w, 0);
    const totalL = rows.reduce((s, r) => s + r.l, 0);
    const totalT = totalW + totalL;
    const totalPct = totalT > 0 ? (totalW / totalT) * 100 : 0;
    const totalRoi = mode === "rl" ? computeRLROI(totalW, totalT) : calcOuRoi(totalW, totalL);

    return { rows: rows.reverse(), totalW, totalL, totalT, totalPct, totalRoi };
  }, [activeResults, mode]);

  // ── Confidence tier breakdown ──
  const tierBreakdown = useMemo(() => {
    const decided = activeResults.filter(r => r.won !== null);
    if (mode === "rl") {
      const tiers = [
        { name: "\u25CF", dots: 1, filter: (r: typeof decided[0]) => r.tier === 1 },
        { name: "\u25CF\u25CF ACE", dots: 2, filter: (r: typeof decided[0]) => r.tier === 2 },
      ];
      return tiers.map(t => {
        const games = decided.filter(t.filter);
        const w = games.filter(r => r.won).length;
        const total = games.length;
        const pct = total > 0 ? ((w / total) * 100).toFixed(1) : "---";
        const ci = wilsonCI(w, total);
        const roi = computeRLROI(w, total);
        return { ...t, w, total, pct, ci, roi };
      });
    } else {
      const underDecided = ouUnderResults.filter(r => r.won !== null);
      const overDecided = ouOverResults.filter(r => r.won !== null);
      const ouTiers = [
        // Under tiers
        { name: "\u2193 Under \u25CF", dots: 1, src: underDecided.filter(r => r.edge >= OU_MIN_EDGE && r.edge < OU_STRONG_EDGE) },
        { name: "\u2193 Under \u25CF\u25CF", dots: 2, src: underDecided.filter(r => r.edge >= OU_STRONG_EDGE && r.edge < OU_PREMIUM_EDGE) },
        { name: "\u2193 Under \u25CF\u25CF\u25CF", dots: 3, src: underDecided.filter(r => r.edge >= OU_PREMIUM_EDGE) },
        // Over tiers
        { name: "\u2191 Over \u25CF", dots: 1, src: overDecided.filter(r => r.edge >= OU_STRONG_EDGE && r.edge < OU_PREMIUM_EDGE) },
        { name: "\u2191 Over \u25CF\u25CF", dots: 2, src: overDecided.filter(r => r.edge >= OU_PREMIUM_EDGE) },
      ];
      return ouTiers.map(t => {
        const w = t.src.filter(r => r.won).length;
        const total = t.src.length;
        const pct = total > 0 ? ((w / total) * 100).toFixed(1) : "---";
        const ci = wilsonCI(w, total);
        const roi = computeROI(w, total, OU_JUICE);
        return { name: t.name, dots: t.dots, w, total, pct, ci, roi };
      });
    }
  }, [activeResults, mode, ouUnderResults, ouOverResults]);

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  const pctColor = (pct: number, breakEven: number) => pct >= breakEven ? "#1a6640" : "#dc2626";
  const roiColor = (roi: number) => roi >= 0 ? "#1a6640" : "#dc2626";

  // Small-sample guard: mute all stat card colors when < 100 picks
  const smallSampleRL = mode === "rl" && (stats as { total: number }).total < 100;
  const smallSampleOU = mode === "ou" && (stats as { underT: number }).underT < 100;

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} tooltips={tooltips} />}

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9", minHeight: "100vh" }}>
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

          {/* ── HEADER ──────────────────────────────────────── */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a6640", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              MLB &middot; Model Accuracy
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 14px" }}>
              Model Accuracy
            </h1>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {(["rl", "ou"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "6px 20px", borderRadius: 999, fontSize: 13,
                  border: mode === m ? "none" : "1px solid #c0bdb5",
                  backgroundColor: mode === m ? "#1a6640" : "transparent",
                  color: mode === m ? "#ffffff" : "#555",
                  fontWeight: mode === m ? 500 : 400, cursor: "pointer",
                }}>
                  {m === "rl" ? "Run Line" : "Over/Under"}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "#888", marginTop: 10, marginBottom: 0 }}>
              Full public log of every BBMI MLB pick vs actual results
            </p>
          </div>

          {/* ── HOW-TO ACCORDION ──────────────────────────── */}
          <DisclosureAccordion mode={mode} />

          {/* ── CALIBRATION NOTICE ────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#fffbeb", borderLeft: "4px solid #d97706", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 700, marginBottom: 4 }}>Live Since March 30, 2026</p>
              <p style={{ fontSize: "0.76rem", color: "#92400e", lineHeight: 1.55, margin: 0 }}>
                Results are tracked transparently from day one. Walk-forward validation (2024-2025) is the primary performance reference.
                Statistical confidence in live results requires 200+ picks. All win percentages include 95% confidence intervals.
              </p>
            </div>
          </div>

          {/* ── HEADLINE STATS CARDS ──────────────────────── */}
          {mode === "rl" ? (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
              {[
                {
                  value: (stats as { pct: string }).pct !== "---" ? `${(stats as { pct: string }).pct}%` : "---",
                  label: "Cover Rate",
                  sub: `${(stats as { wins: number }).wins}W \u2013 ${(stats as { total: number; wins: number }).total - (stats as { wins: number }).wins}L \u00B7 ${(stats as { total: number }).total} picks`,
                  color: smallSampleRL ? "#94a3b8" : ((stats as { total: number }).total > 0 ? pctColor(Number((stats as { pct: string }).pct), RL_BASE_RATE) : "#94a3b8"),
                  gradient: smallSampleRL ? false : ((stats as { total: number }).total > 0 && Number((stats as { pct: string }).pct) >= RL_BASE_RATE),
                },
                {
                  value: (stats as { total: number }).total > 0 ? `${(stats as { roi: number }).roi.toFixed(1)}%` : "---",
                  label: "ROI",
                  sub: `at ${RL_JUICE_AWAY_DOG} juice \u00B7 flat $100`,
                  color: smallSampleRL ? "#94a3b8" : ((stats as { roi: number }).roi >= 0 ? "#1a6640" : "#dc2626"),
                  gradient: false,
                },
                {
                  value: (stats as { total: number }).total > 0
                    ? `${(stats as { ci: { low: number; high: number } }).ci.low.toFixed(1)}\u2013${(stats as { ci: { low: number; high: number } }).ci.high.toFixed(1)}%`
                    : "---",
                  label: "95% CI",
                  sub: "Wilson score interval",
                  color: smallSampleRL ? "#94a3b8" : "#0a1a2f",
                  gradient: false,
                },
              ].map(c => (
                <div key={c.label} style={{
                  background: "#ffffff", border: "1px solid #d4d2cc",
                  borderTop: "4px solid #1a6640", borderRadius: 10,
                  padding: "1rem 0.75rem", textAlign: "center",
                }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 500, color: c.color === "#0a1a2f" ? "#1a1a1a" : c.color, lineHeight: 1 }}>{c.value}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#777", margin: "4px 0 3px" }}>{c.label}</div>
                  <div style={{ fontSize: "0.63rem", color: "#666" }}>{c.sub}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 8, padding: "2rem 1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "#92400e", marginBottom: 8 }}>O/U Model Under Review</div>
              <p style={{ fontSize: "0.82rem", color: "#92400e", lineHeight: 1.6, margin: 0 }}>
                Under picks paused pending re-validation. Walk-forward claims did not reproduce under audit (2026-04-16).
                Over picks gated to June+. This product will resume when validated against independently verified data.
              </p>
            </div>
          )}

          {/* ── WALK-FORWARD REFERENCE (RL only) ────────────────────── */}
          {mode === "rl" && (
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", background: "#e8f0ec", borderLeft: "4px solid #1a6640", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#1a6640", textAlign: "center" }}>
            <strong>Walk-Forward Validation — Under Revision (2026-04-18):</strong>{" "}
            Cell-definition audit in progress. Prior numbers computed on a moneyline-sign proxy that misclassifies tight-spread games; honest re-derivation pending.
          </div>
          )}

          {/* ── CONFIDENCE TIER TABLE (O/U only — RL is single-tier as of Release 3) ─────────────────────── */}
          {mode !== "rl" && activeResults.length >= 3 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Performance by Confidence Tier
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: "left", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>
                          Confidence
                        </th>
                        <th style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>Games</th>
                        <th style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>Win %</th>
                        <th style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>95% CI</th>
                        <th style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierBreakdown.map((t, i) => {
                        const cellStyle: React.CSSProperties = { padding: "9px 10px", fontSize: "0.78rem", borderBottom: "1px solid #ece9e2", fontFamily: "ui-monospace, monospace", color: "#292524" };
                        return (
                          <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                            <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 600, color: "#44403c" }}>{t.name}</td>
                            <td style={{ ...cellStyle, textAlign: "right" }}>{t.total}</td>
                            <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700, color: t.total > 0 ? pctColor(Number(t.pct), mode === "rl" ? RL_BASE_RATE : 52.4) : "#94a3b8" }}>
                              {t.pct}{t.total > 0 ? "%" : ""}
                            </td>
                            <td style={{ ...cellStyle, textAlign: "right", fontSize: 11, color: "#78716c", fontStyle: "italic" }}>
                              {t.total > 0 ? `${t.ci.low.toFixed(1)}\u2013${t.ci.high.toFixed(1)}%` : "---"}
                            </td>
                            <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700, color: roiColor(t.roi) }}>
                              {t.total > 0 ? `${t.roi >= 0 ? "+" : ""}${t.roi.toFixed(1)}%` : "---"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "6px 14px", fontSize: "0.68rem", color: "#666666", borderTop: "1px solid #d4d2cc", backgroundColor: "#f5f3ef" }}>
                  ROI at {mode === "rl" ? RL_JUICE_AWAY_DOG : OU_JUICE} juice
                </div>
              </div>
            </div>
          )}

          {/* ── WEEKLY BREAKDOWN (RL only) ──────────────────────────── */}
          {mode === "rl" && weeklyBreakdown && weeklyBreakdown.rows.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Weekly Performance Breakdown
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                    <thead>
                      <tr>
                        {["Week", "Picks", "Record", "Win %", "ROI"].map(h => (
                          <th key={h} style={{ padding: "8px 10px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#444444", textAlign: h === "Week" ? "left" : "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyBreakdown.rows.map((row, idx) => {
                        const cellStyle: React.CSSProperties = { padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", borderBottom: "1px solid #ece9e2", color: "#292524", fontFamily: "ui-monospace, monospace" };
                        return (
                          <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                            <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 500, color: "#44403c" }}>{row.label}</td>
                            <td style={cellStyle}>{row.t}</td>
                            <td style={cellStyle}>{row.w}-{row.l}</td>
                            <td style={{ ...cellStyle, fontWeight: 700, color: pctColor(row.pct, mode === "rl" ? RL_BASE_RATE : 52.4) }}>{row.t > 0 ? `${row.pct.toFixed(1)}%` : "\u2014"}</td>
                            <td style={{ ...cellStyle, fontWeight: 700, color: roiColor(row.roi) }}>{row.t > 0 ? `${row.roi >= 0 ? "+" : ""}${row.roi.toFixed(1)}%` : "\u2014"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", textAlign: "left", fontWeight: 700, color: "#0a1a2f", borderBottom: "none" }}>Season Total</td>
                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", fontWeight: 700, color: "#0a1a2f", borderBottom: "none", fontFamily: "ui-monospace, monospace" }}>{weeklyBreakdown.totalT}</td>
                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", fontWeight: 700, color: "#0a1a2f", borderBottom: "none", fontFamily: "ui-monospace, monospace" }}>{weeklyBreakdown.totalW}-{weeklyBreakdown.totalL}</td>
                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", fontWeight: 700, color: pctColor(weeklyBreakdown.totalPct, mode === "rl" ? RL_BASE_RATE : 52.4), borderBottom: "none", fontFamily: "ui-monospace, monospace" }}>{weeklyBreakdown.totalPct.toFixed(1)}%</td>
                        <td style={{ padding: "9px 10px", fontSize: "0.78rem", textAlign: "right", fontWeight: 700, color: roiColor(weeklyBreakdown.totalRoi), borderBottom: "none", fontFamily: "ui-monospace, monospace" }}>{weeklyBreakdown.totalRoi >= 0 ? "+" : ""}{weeklyBreakdown.totalRoi.toFixed(1)}%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ padding: "6px 14px", fontSize: "0.68rem", color: "#666666", borderTop: "1px solid #d4d2cc", backgroundColor: "#f5f3ef" }}>
                  ROI at {mode === "rl" ? RL_JUICE_AWAY_DOG : OU_JUICE} juice
                </div>
              </div>
            </div>
          )}

          {/* ── GAME-BY-GAME TABLE (RL only when O/U is paused) ────────────────────────── */}
          {mode === "rl" && (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", maxWidth: 1100, margin: "0 auto 1rem" }}>
              Run Line Pick History
            </h2>
            <div style={{ maxWidth: 1100, margin: "0 auto 1rem", backgroundColor: "#fef9e7", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 6, padding: "10px 14px" }}>
              <p style={{ fontSize: 12, color: "#78350f", margin: 0, lineHeight: 1.55 }}>
                <strong>Methodology correction, 2026-04-18:</strong>{" "}
                Picks prior to this date were graded only at +1.5 — correct when the away team was the Vegas underdog, but wrong when the away team was the Vegas favorite (alt-line regime). The Vegas favorite is the team with the more-negative moneyline (not simply the home team when homeML is negative). The two grade columns below show both: <strong>Displayed</strong> = what subscribers saw at settlement; <strong>Corrected</strong> = grade on the correct side. Greyed rows are picks where the away team was actually the Vegas favorite (or a true pick'em); they remain visible for transparency. Walk-forward aggregate numbers are under revision.
              </p>
            </div>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 650, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: mode === "rl" ? 900 : 1000 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Date" columnKey="date" tooltipId="date" {...headerProps} />
                      <SortableHeader label="Away" columnKey="away" tooltipId="away" {...headerProps} />
                      <SortableHeader label="Home" columnKey="home" tooltipId="home" {...headerProps} />
                      <th style={TH}>BBMI Pick</th>
                      <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" {...headerProps} />
                      <SortableHeader label="Score" columnKey="score" tooltipId="score" {...headerProps} />
                      <th style={TH}>Displayed</th>
                      <th style={TH}>Corrected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No completed picks yet. Check back after today&apos;s games.</td></tr>
                    )}
                    {sortedRows.map((r, i) => {
                      // In-cell picks render normally; out-of-cell (legacy) picks are greyed.
                      const inCell = (r as typeof rlResults[0]).inNewCell;
                      const bg = inCell
                        ? (i % 2 === 0 ? "#ffffff" : "#f8fafc")
                        : (i % 2 === 0 ? "#f5f5f4" : "#eae7e2");
                      const rowOpacity = inCell ? 1 : 0.7;
                      const borderLeft = !inCell
                        ? "3px solid #a8a29e"   // grey stripe: legacy / out-of-cell
                        : r.won === true ? "3px solid #16a34a"
                        : r.won === false ? "3px solid #dc2626"
                        : "3px solid transparent";

                      const gradeIcon = (won: boolean | null) => {
                        if (won === true) return <span style={{ color: "#1a6640", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2713"}</span>;
                        if (won === false) return <span style={{ color: "#dc2626", fontWeight: 900, fontSize: "1.1rem" }}>{"\u2717"}</span>;
                        return <span style={{ color: "#94a3b8" }}>—</span>;
                      };

                      return (
                        <tr key={r.gameId + mode + i} style={{ background: bg, borderLeft, opacity: rowOpacity }}>
                          {/* Date */}
                          <td style={{ ...TD_MONO, fontSize: 12 }}>{r.date}</td>

                          {/* Away */}
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(r.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                              <MLBLogo teamName={r.awayTeam} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{r.awayTeam}</span>
                              {(() => { const rk = accRank(r.awayTeam); return rk ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                            </Link>
                          </td>

                          {/* Home */}
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(r.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                              <MLBLogo teamName={r.homeTeam} size={18} />
                              <span style={{ fontSize: 12 }}>{r.homeTeam}</span>
                              {(() => { const rk = accRank(r.homeTeam); return rk ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                            </Link>
                          </td>

                          {/* BBMI Pick */}
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <MLBLogo teamName={r.awayTeam} size={16} />
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{r.awayTeam} +1.5</span>
                            </div>
                          </td>

                          {/* Edge */}
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#57534e" }}>
                            {r.edge.toFixed(3)}
                          </td>

                          {/* Score */}
                          <td style={{ ...TD_MONO, fontSize: 12 }}>
                            {`${r.actualAwayScore}\u2013${r.actualHomeScore}`}
                          </td>

                          {/* Displayed (historical +1.5 grade, what subscribers saw) */}
                          <td style={TD_MONO} title="Graded as displayed at settlement: away +1.5 (home wins by 0 or 1, or away wins).">
                            {gradeIcon((r as typeof rlResults[0]).wonDisplayed ?? null)}
                          </td>

                          {/* Corrected (post-audit side-aware grade) */}
                          <td style={TD_MONO} title="Graded at the correct side per 2026-04-18 methodology: +1.5 when away is Vegas underdog, -1.5 when away is Vegas favorite.">
                            {gradeIcon((r as typeof rlResults[0]).wonCorrected ?? null)}
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

          {/* ── METHODOLOGY NOTE ──────────────────────────── */}
          <MethodologyNote />

          {/* ── FOOTER LINKS ─────────────────────────────── */}
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 24 }}>
            <p>
              Walk-forward results represent historical simulation using data available before each game.
              Past performance does not guarantee future results.
            </p>
            <p style={{ marginTop: 8 }}>
              <Link href="/mlb/picks" style={{ color: "#3b82f6", textDecoration: "underline" }}>
                View today&apos;s picks {"\u2192"}
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
