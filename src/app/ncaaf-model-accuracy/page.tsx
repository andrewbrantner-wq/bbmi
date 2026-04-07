"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/football-games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

const FREE_EDGE_LIMIT = 6;

// Minimum edge to count in the performance record.
// Walk-forward analysis shows the 1-2 pt bucket at 60.0% ATS and
// the 2-3 pt bucket at 62.9% ATS — both profitable and above breakeven.
// A 2-pt threshold captures these while still filtering out sub-1-pt
// noise from line movement between books.
const MIN_EDGE_FOR_RECORD = 2;


type HistoricalGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string | number | null;
  fakeWin: number | null;
  vegasTotal: number | null;
  bbmiTotal: number | null;
  totalPick: string | null;
  totalResult: string | null;
  actualTotal: number | null;
};

type SortKey =
  | "date" | "away" | "home" | "vegasHomeLine" | "bbmiHomeLine"
  | "actualAwayScore" | "actualHomeScore" | "actualHomeLine"
  | "fakeBet" | "fakeWin" | "result" | "edge"
  | "vegasTotal" | "bbmiTotal" | "totalEdge" | "actualTotal" | "totalResult";

type SortDirection = "asc" | "desc";

type SummaryData = {
  sampleSize: number;
  bbmiWinPct: string;
  fakeWagered: number;
  fakeWon: number;
  roi: string;
};

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

// ── Score-based ATS result helpers ────────────────────────────────
// Compute win/loss/push from actual scores instead of fakeWin field,
// so results are consistent regardless of when the rolling backtest
// last ran. This matches the picks page calculation exactly.
type ATSResult = "win" | "loss" | "push" | "skip";

function computeATS(g: HistoricalGame): ATSResult {
  if (g.bbmiHomeLine == null || g.vegasHomeLine == null
      || g.actualHomeScore == null || g.actualAwayScore == null) return "skip";
  const bl = g.bbmiHomeLine;
  const vl = g.vegasHomeLine;
  if (bl === vl) return "skip"; // lines agree, no pick
  // ATS pick direction: if BBMI line < Vegas → pick home, else away
  const pickHome = bl < vl;
  const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
  const coverMargin = margin + vl; // positive = home covered
  if (coverMargin === 0) return "push";
  const homeCovered = coverMargin > 0;
  return (pickHome ? homeCovered : !homeCovered) ? "win" : "loss";
}

function isWin(g: HistoricalGame): boolean { return computeATS(g) === "win"; }
function isPush(g: HistoricalGame): boolean { return computeATS(g) === "push"; }
function isDecided(g: HistoricalGame): boolean { const r = computeATS(g); return r === "win" || r === "loss"; }
function betResult(g: HistoricalGame): "win" | "loss" | "push" | "" {
  const r = computeATS(g);
  return r === "skip" ? "" : r;
}

const TH: React.CSSProperties = {
  backgroundColor: "#6b7280",
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
  borderTop: "1px solid #ece9e2",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };
const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };

const TOOLTIPS: Record<string, string> = {
  date: "The date the game was played.",
  away: "The visiting team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  home: "The home team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  vegasHomeLine: "The point spread set by sportsbooks. Negative = home team is favored.",
  bbmiHomeLine: "What BBMI's model predicted the spread should be. Compare to Vegas to understand the edge.",
  edge: `The absolute gap between BBMI's predicted line and the Vegas line. A larger value means BBMI disagrees more strongly with the market. Rows highlighted in gold have Edge ≥ 5 — historically the highest-accuracy tier. Rows marked ~ have Edge < ${MIN_EDGE_FOR_RECORD} pts — within normal football line movement and book-to-book variation — and are excluded from headline stats.`,
  actualHomeLine: "The actual final margin from the home team's perspective.",
  actualAwayScore: "Final score for the away team.",
  actualHomeScore: "Final score for the home team.",
  fakeBet: "A simulated flat $100 wager placed on every game where BBMI's line differs from Vegas by at least the selected edge threshold.",
  fakeWin: "The simulated amount returned on the $100 bet. A winning bet typically returns ~$191-$195. $0 = loss.",
  result: "Whether BBMI's pick covered the Vegas spread. ✓ = correct pick, ✗ = incorrect pick.",
  teamPicked: "Number of games where BBMI's model picked this team to beat the Vegas spread.",
  teamWinPct: "How often BBMI's pick on this team was correct against the spread.",
  teamWagered: "Total simulated amount bet on this team at $100 flat per game.",
  teamWon: "Total simulated amount returned across all bets on this team.",
  teamRoi: "Return on investment for bets on this team. 0% = break even.",
  vegasTotal: "The over/under total set by sportsbooks for combined points scored.",
  bbmiTotal: "What BBMI's model predicted the total combined score should be. Compare to Vegas O/U to understand the edge.",
  totalEdge: "The absolute gap between BBMI's predicted total and the Vegas over/under. A larger value means BBMI disagrees more strongly with the market.",
  totalPick: "BBMI's over/under pick — 'over' if the model total exceeds Vegas, 'under' if below.",
  actual: "The actual combined score of both teams.",
  ouResult: "Whether BBMI's over/under pick was correct. ✓ = correct, ✗ = incorrect.",
};

function HighEdgeCallout({ overallWinPct, overallTotal, highEdgeWinPct, highEdgeTotal, eliteEdgeWinPct, eliteEdgeTotal, highEdgeThreshold = FREE_EDGE_LIMIT, eliteEdgeThreshold = 10 }: {
  overallWinPct: string; overallTotal: number;
  highEdgeWinPct: string; highEdgeTotal: number;
  eliteEdgeWinPct: string; eliteEdgeTotal: number;
  highEdgeThreshold?: number;
  eliteEdgeThreshold?: number;
}) {
  const improvement = (Number(highEdgeWinPct) - Number(overallWinPct)).toFixed(1);
  const eliteImprovement = (Number(eliteEdgeWinPct) - Number(overallWinPct)).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#6b7280", borderRadius: 0, border: "2px solid #6b7280", overflow: "hidden" }}>
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
        🎯 Where the model performs best
      </div>

      <div className="hec-grid">
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Overall†</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.3rem" }}>{overallWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{overallTotal.toLocaleString()} picks (edge ≥ {MIN_EDGE_FOR_RECORD})</div>
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Edge ≥ {highEdgeThreshold} pts</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#ffffff", lineHeight: 1, marginBottom: "0.3rem" }}>{highEdgeWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{highEdgeTotal.toLocaleString()} picks</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(250,204,21,0.15)", color: "#ffffff", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>+{improvement}pts</div>
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Edge ≥ {eliteEdgeThreshold} pts</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f97316", lineHeight: 1, marginBottom: "0.3rem" }}>{eliteEdgeWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{eliteEdgeTotal.toLocaleString()} picks</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(249,115,22,0.15)", color: "#f97316", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>+{eliteImprovement}pts</div>
        </div>

        <div className="hec-cta">
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", lineHeight: 1.5 }}>High-edge picks are <strong style={{ color: "#ffffff" }}>premium-only</strong> on Today&apos;s Picks</div>
          <a href="/ncaaf-picks" style={{ display: "inline-block", backgroundColor: "#ffffff", color: "#1a1a1a", padding: "0.5rem 1.1rem", borderRadius: 7, fontWeight: 800, fontSize: "0.8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
            Unlock — $10 trial →
          </a>
          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginTop: "0.4rem" }}>or $35/mo — cancel anytime</div>
        </div>
      </div>

      {/* Overall stat footnote */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.5rem 1.25rem", fontSize: "0.58rem", color: "rgba(255,255,255,0.3)", lineHeight: 1.5 }}>
        † Overall record includes only picks where edge ≥ {MIN_EDGE_FOR_RECORD} pts. Football lines are captured at a specific point in time — lines routinely move 1–3 points between open and kickoff, and can vary across different books. A difference smaller than {MIN_EDGE_FOR_RECORD} pts is within normal market noise and does not represent a meaningful BBMI disagreement with Vegas. These games are shown in the table below but marked ~ and excluded from stats.
      </div>
    </div>
  );
}

function HowToReadAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, backgroundColor: "#eae8e1", color: "#333333", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>📖 How do I use this page?</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>This page tracks every game BBMI has picked against the Vegas spread — with full results logged publicly, unedited, from the first pick of the season.</p>
          <p style={{ marginBottom: 12 }}><strong>The Edge Filter is the most important control on this page.</strong> &ldquo;Edge&rdquo; is the gap between BBMI&apos;s predicted line and the Vegas line. The <strong>Edge column</strong> in the table shows this value for every game — rows highlighted in gold have |Edge| ≥ 5, the tier with historically the strongest accuracy.</p>
          <p style={{ marginBottom: 12 }}><strong>Each row is one game.</strong> The Vegas Line is what sportsbooks set. The BBMI Line is what the model predicted. When those two numbers differ, BBMI places a simulated flat $100 bet on its pick. The Bet, Win, and Result columns track whether that pick covered the spread.</p>
          <p style={{ marginBottom: 12 }}><strong>Rows marked ~ in the Edge column</strong> have an edge below {MIN_EDGE_FOR_RECORD} pts. Football lines are particularly susceptible to early movement — a difference that small is within normal line movement and book-to-book variation, not a genuine model disagreement with the market. These games are shown for full transparency but excluded from headline stats.</p>
          <p style={{ marginBottom: 12 }}><strong>The Weekly Summary</strong> lets you check whether model performance is consistent over time — not just a lucky stretch. Use the week selector to browse any period in the season.</p>
          <p style={{ marginBottom: 12 }}><strong>The Weekly Breakdown Table</strong> shows all weeks side-by-side with 95% confidence intervals, so you can see the full range of outcomes rather than just the season average.</p>
          <p style={{ marginBottom: 12 }}><strong>Team Performance Analysis</strong> shows which teams the model has read best (and worst) this season. Click any team name to see its full schedule and detailed pick history.</p>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "#166534", margin: 0, fontWeight: 600 }}>
              💡 Pro tip: Filter to edge ≥ {FREE_EDGE_LIMIT} pts to see the exact picks subscribers get on Today&apos;s Picks — historically the highest accuracy and ROI tier.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>All figures use simulated flat $100 wagers for illustration. This is not financial or gambling advice.</p>
        </div>
      )}
    </div>
  );
}

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
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#6b7280", border: "1px solid #9ca3af", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort ↕</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc, stickyTop = 0 }: {
  label: React.ReactNode; columnKey: SortKey; tooltipId?: string;
  sortConfig: { key: SortKey; direction: SortDirection }; handleSort: (key: SortKey) => void;
  rowSpan?: number; activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
  stickyTop?: number;
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
    <th ref={thRef} rowSpan={rowSpan} style={{ ...TH, cursor: "default", top: stickyTop }}>
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

function SummaryCard({ title, data, colors, wins }: {
  title: string; data: SummaryData;
  colors: { winPct: string; won: string; roi: string }; wins: number;
}) {
  const { low, high } = wilsonCI(wins, data.sampleSize);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 2rem", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
          <thead>
            <tr>
              {["Sample Size", "% Beats Vegas", "Wagered", "Won", "ROI"].map((h) => (
                <th key={h} style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, color: "#1a1a1a", padding: "20px 16px 4px", whiteSpace: "nowrap" }}>{data.sampleSize.toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "20px 16px 4px", color: colors.winPct, whiteSpace: "nowrap" }}>{data.bbmiWinPct}%</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "20px 16px 4px", color: "#dc2626", whiteSpace: "nowrap" }}>${data.fakeWagered.toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "20px 16px 4px", color: colors.won, whiteSpace: "nowrap" }}>${Math.round(data.fakeWon).toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "20px 16px 4px", color: colors.roi, whiteSpace: "nowrap" }}>{data.roi}%</td>
            </tr>
            <tr>
              <td style={{ ...TD_CENTER, fontSize: "0.68rem", color: "#a8a29e", paddingTop: 2, paddingBottom: 16 }}>—</td>
              <td style={{ ...TD_CENTER, fontSize: "0.68rem", color: "#78716c", paddingTop: 2, paddingBottom: 16, fontStyle: "italic" }}>95% CI: {low.toFixed(1)}%–{high.toFixed(1)}%</td>
              <td style={{ ...TD_CENTER, fontSize: "0.68rem", color: "#a8a29e", paddingTop: 2, paddingBottom: 16 }}>—</td>
              <td style={{ ...TD_CENTER, fontSize: "0.68rem", color: "#a8a29e", paddingTop: 2, paddingBottom: 16 }}>—</td>
              <td style={{ ...TD_CENTER, fontSize: "0.68rem", color: "#a8a29e", paddingTop: 2, paddingBottom: 16 }}>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EdgeThresholdDisclosure() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p style={{ fontSize: "0.8rem", color: "#78350f", fontWeight: 700, marginBottom: 4 }}>About the Edge Filter &amp; Performance Stats</p>
        <p style={{ fontSize: "0.76rem", color: "#92400e", lineHeight: 1.55, margin: 0 }}>
          Headline stats count only picks where edge ≥ {MIN_EDGE_FOR_RECORD} pts. Football lines are captured at a specific point in time — lines routinely move 1–3 points between open and kickoff, and can vary across different books. A difference smaller than {MIN_EDGE_FOR_RECORD} pts is within normal market noise and does not represent a meaningful BBMI disagreement with Vegas. Those games are shown in the table but marked ~ and excluded from the record. All win percentages include 95% confidence intervals.
        </p>
      </div>
    </div>
  );
}

function WeeklyBreakdownTable({ games, mode = "ats" }: { games: HistoricalGame[]; mode?: "ats" | "ou" }) {
  const addDays = (dateStr: string, n: number): string => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  const fmt = (d: string) => { const [, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}`; };
  const allDates = Array.from(new Set(games.filter((g) => g.date).map((g) => g.date!.split("T")[0].split(" ")[0]))).sort();
  if (allDates.length === 0) return null;
  const ranges: Array<{ start: string; end: string }> = [];
  let cur = allDates[0];
  while (cur <= allDates[allDates.length - 1]) {
    const end = addDays(cur, 6);
    if (games.some((g) => { if (!g.date) return false; const d = g.date.split("T")[0].split(" ")[0]; return d >= cur && d <= end; })) ranges.push({ start: cur, end });
    cur = addDays(cur, 7);
  }
  const rows = ranges.map(({ start, end }) => {
    const atsGames = games.filter((g) => {
      if (!g.date) return false;
      const d = g.date.split("T")[0].split(" ")[0];
      return d >= start && d <= end && isDecided(g);
    });
    const atsPicks = atsGames.length;
    const atsWins = atsGames.filter((g) => isWin(g)).length;
    const atsWagered = atsPicks * 100;
    const atsWon = atsWins * 191;
    const atsWinPct = atsPicks > 0 ? (atsWins / atsPicks) * 100 : 0;
    const atsRoi = atsWagered > 0 ? (atsWon / atsWagered) * 100 - 100 : 0;
    const { low: atsLow, high: atsHigh } = wilsonCI(atsWins, atsPicks);

    const ouGames = games.filter((g) => {
      if (!g.date || g.vegasTotal == null || g.bbmiTotal == null || g.totalPick == null || g.actualTotal == null || g.totalResult == null) return false;
      const d = g.date.split("T")[0].split(" ")[0];
      return d >= start && d <= end;
    });
    const ouPicks = ouGames.length;
    const ouWins = ouGames.filter((g) => g.totalPick === g.totalResult).length;
    const ouWagered = ouPicks * 100;
    const ouWon = ouWins * 191;
    const ouWinPct = ouPicks > 0 ? (ouWins / ouPicks) * 100 : 0;
    const ouRoi = ouWagered > 0 ? (ouWon / ouWagered) * 100 - 100 : 0;

    // Use the active mode for the primary picks/wins/winPct/roi
    const picks = mode === "ou" ? ouPicks : atsPicks;
    const wins = mode === "ou" ? ouWins : atsWins;
    const winPct = mode === "ou" ? ouWinPct : atsWinPct;
    const roi = mode === "ou" ? ouRoi : atsRoi;
    const low = mode === "ou" ? wilsonCI(ouWins, ouPicks).low : atsLow;
    const high = mode === "ou" ? wilsonCI(ouWins, ouPicks).high : atsHigh;
    return { label: `${fmt(start)} – ${fmt(end)}`, picks, wins, winPct, roi, low, high, atsPicks, atsWins, atsWinPct, atsRoi, ouPicks, ouWins, ouWinPct, ouRoi };
  });
  const totalPicks = rows.reduce((s, r) => s + r.picks, 0);
  const totalWins = rows.reduce((s, r) => s + r.wins, 0);
  const totalWagered = rows.reduce((s, r) => s + r.picks * 100, 0);
  const totalWon = rows.reduce((s, r) => s + r.wins * 191, 0);
  const totalWinPct = totalPicks > 0 ? (totalWins / totalPicks) * 100 : 0;
  const totalRoi = totalWagered > 0 ? (totalWon / totalWagered) * 100 - 100 : 0;
  const { low: tLow, high: tHigh } = wilsonCI(totalWins, totalPicks);
  const cellStyle: React.CSSProperties = { padding: "9px 14px", fontSize: "0.81rem", textAlign: "right", borderBottom: "1px solid #f1f5f9", color: "#292524", fontFamily: "ui-monospace, monospace" };
  const hStyle: React.CSSProperties = { padding: "9px 14px", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#444", textAlign: "right", borderBottom: "1px solid #d4d2cc", backgroundColor: "#eae8e1" };
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "white", borderRadius: 10, border: "1px solid #d4d2cc", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <div style={{ padding: "10px 14px", backgroundColor: "#eae8e1", color: "#333333", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Weekly Performance Breakdown — All Weeks</span>
        <span style={{ fontSize: "0.65rem", fontWeight: 400, opacity: 0.65, fontStyle: "italic" }}>95% confidence intervals shown</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ ...hStyle, textAlign: "left" }}>Week</th>
              <th style={hStyle}>ATS Picks</th>
              <th style={hStyle}>ATS Win%</th>
              <th style={hStyle}>ATS ROI</th>
              <th style={hStyle}>O/U Picks</th>
              <th style={hStyle}>O/U Win%</th>
              <th style={hStyle}>O/U ROI</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((row, idx) => {
              const atsWinColor = row.atsWinPct >= 55 ? "#6b7280" : row.atsWinPct >= 50 ? "#78716c" : "#dc2626";
              const atsRoiColor = row.atsRoi >= 0 ? "#6b7280" : "#dc2626";
              const ouWinColor = row.ouWinPct >= 55 ? "#6b7280" : row.ouWinPct >= 50 ? "#78716c" : "#dc2626";
              const ouRoiColor = row.ouRoi >= 0 ? "#6b7280" : "#dc2626";
              return (
                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "white" : "#f5f3ef" }}>
                  <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 500, color: "#44403c" }}>{row.label}</td>
                  <td style={cellStyle}>{row.atsPicks.toLocaleString()}</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: atsWinColor }}>{row.atsWinPct.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: atsRoiColor }}>{row.atsRoi >= 0 ? "+" : ""}{row.atsRoi.toFixed(1)}%</td>
                  <td style={cellStyle}>{row.ouPicks.toLocaleString()}</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: ouWinColor }}>{row.ouWinPct.toFixed(1)}%</td>
                  <td style={{ ...cellStyle, fontWeight: 700, color: ouRoiColor }}>{row.ouRoi >= 0 ? "+" : ""}{row.ouRoi.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: "#f1f5f9", borderTop: "2px solid #cbd5e1" }}>
              <td style={{ ...cellStyle, textAlign: "left", fontFamily: "inherit", fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>Season Total</td>
              <td style={{ ...cellStyle, fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>{totalPicks.toLocaleString()}</td>
              <td style={{ ...cellStyle, fontWeight: 700, color: totalWinPct >= 50 ? "#6b7280" : "#dc2626", borderBottom: "none" }}>{totalWinPct.toFixed(1)}%</td>
              <td style={{ ...cellStyle, fontWeight: 700, color: totalRoi >= 0 ? "#6b7280" : "#dc2626", borderBottom: "none" }}>{totalRoi >= 0 ? "+" : ""}{totalRoi.toFixed(1)}%</td>
              {(() => {
                const ouTotalPicks = rows.reduce((s, r) => s + r.ouPicks, 0);
                const ouTotalWins = rows.reduce((s, r) => s + r.ouWins, 0);
                const ouTotalWinPct = ouTotalPicks > 0 ? (ouTotalWins / ouTotalPicks) * 100 : 0;
                const ouTotalWagered = ouTotalPicks * 100;
                const ouTotalWon = ouTotalWins * 191;
                const ouTotalRoi = ouTotalWagered > 0 ? (ouTotalWon / ouTotalWagered) * 100 - 100 : 0;
                return (
                  <>
                    <td style={{ ...cellStyle, fontWeight: 700, color: "#1a1a1a", borderBottom: "none" }}>{ouTotalPicks.toLocaleString()}</td>
                    <td style={{ ...cellStyle, fontWeight: 700, color: ouTotalWinPct >= 50 ? "#6b7280" : "#dc2626", borderBottom: "none" }}>{ouTotalWinPct.toFixed(1)}%</td>
                    <td style={{ ...cellStyle, fontWeight: 700, color: ouTotalRoi >= 0 ? "#6b7280" : "#dc2626", borderBottom: "none" }}>{ouTotalRoi >= 0 ? "+" : ""}{ouTotalRoi.toFixed(1)}%</td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>
      <div style={{ padding: "6px 14px", fontSize: "0.68rem", color: "#a8a29e", borderTop: "1px solid #d4d2cc", backgroundColor: "#f5f3ef" }}>
        A wider 95% CI range indicates a smaller sample where week-level results are less conclusive. Season ROI is approximate.
      </div>
    </div>
  );
}

function PageExplainer() {
  const itemStyle: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 14, borderBottom: "1px solid #f1f5f9", marginBottom: 14 };
  const numStyle: React.CSSProperties = { width: 26, height: 26, borderRadius: "50%", backgroundColor: "#6b7280", color: "white", fontSize: "0.7rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const labelStyle: React.CSSProperties = { fontSize: "0.82rem", fontWeight: 700, color: "#1c1917", marginBottom: 3 };
  const descStyle: React.CSSProperties = { fontSize: "0.76rem", color: "#78716c", lineHeight: 1.6, margin: 0 };
  return (
    <div style={{ maxWidth: 1100, margin: "2.5rem auto 0", backgroundColor: "white", borderRadius: 10, border: "1px solid #d4d2cc", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <div style={{ padding: "10px 14px", backgroundColor: "#eae8e1", color: "#333333", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        Understanding the Numbers — A Guide for New Visitors
      </div>
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <div style={itemStyle}>
          <div style={numStyle}>1</div>
          <div>
            <div style={labelStyle}>Win % (% Beats Vegas)</div>
            <p style={descStyle}>The share of picks where BBMI correctly predicted which side of the spread would cover. The break-even point at standard −110 juice is ~52.4%. The <em>95% confidence interval</em> beneath this number shows the plausible range for the true underlying rate — a wider interval means a smaller sample with less certainty. Only picks with edge ≥ {MIN_EDGE_FOR_RECORD} pts are included — differences smaller than {MIN_EDGE_FOR_RECORD} pts are within normal football line movement and book-to-book variation, not a genuine model disagreement with the market.</p>
          </div>
        </div>
        <div style={itemStyle}>
          <div style={numStyle}>2</div>
          <div>
            <div style={labelStyle}>ROI (Return on Investment)</div>
            <p style={descStyle}>Simulated return assuming a flat $100 wager per pick at −110 odds. Positive ROI means the model has generated paper profit over the tracked period. Past simulated performance does not guarantee future results, and real-world factors like line movement and juice vary.</p>
          </div>
        </div>
        <div style={itemStyle}>
          <div style={numStyle}>3</div>
          <div>
            <div style={labelStyle}>Edge Column — including the ~ marker</div>
            <p style={descStyle}>Shown for every row — always a non-negative number representing how far apart BBMI and Vegas are on a given game. Rows with Edge ≥ 5 are highlighted in gold — this is the tier with historically the strongest accuracy. Rows marked ~ have edge &lt; {MIN_EDGE_FOR_RECORD} pts — within normal football line movement and book-to-book variation — and are shown for full transparency but excluded from stats. The Edge Filter above the table controls which games appear.</p>
          </div>
        </div>
        <div style={itemStyle}>
          <div style={numStyle}>4</div>
          <div>
            <div style={labelStyle}>Weekly Breakdown Table</div>
            <p style={descStyle}>Shows week-by-week results so you can assess consistency rather than just the season headline. Football has fewer games per week than basketball — a single bad week can look dramatic on a small sample. Look for the cluster of weekly results around the season mean, and use the 95% CI column to judge how much weight to put on any single week.</p>
          </div>
        </div>
        <div style={{ ...itemStyle, borderBottom: "none", marginBottom: 0, paddingBottom: 0 }}>
          <div style={numStyle}>5</div>
          <div>
            <div style={labelStyle}>Sample Size &amp; Track Record</div>
            <p style={descStyle}>One season of data is a starting point, not a verdict. Football&apos;s limited game count — roughly 12–15 games per team — means the full-season sample is inherently smaller than basketball. Forecasting research generally indicates that multiple seasons of prospective (pre-specified, out-of-sample) picks are needed to distinguish genuine skill from a good variance run with statistical confidence. BBMI&apos;s results will be tracked transparently each year to build an honest long-term record.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NCAAFBettingResultsPage() {
  // Remap football-games.json field names to the shared HistoricalGame schema
  const remappedGames: HistoricalGame[] = (games as Record<string, unknown>[]).map((g) => ({
    date: (g.gameDate ?? g.date ?? null) as string | null,
    home: (g.homeTeam ?? g.home ?? null) as string | null,
    away: (g.awayTeam ?? g.away ?? null) as string | null,
    vegasHomeLine: (g.vegasHomeLine ?? g.vegasLine ?? null) as number | null,
    bbmiHomeLine: (g.bbmifLine ?? null) as number | null,
    actualHomeScore: (g.actualHomeScore ?? g.homeScore ?? null) as number | null,
    actualAwayScore: (g.actualAwayScore ?? g.awayScore ?? null) as number | null,
    fakeBet: (g.fakeBet ?? null) as number | null,
    fakeWin: (g.fakeWin ?? null) as number | null,
    vegasTotal: (g.vegasTotal ?? null) as number | null,
    bbmiTotal: (g.bbmiTotal ?? null) as number | null,
    totalPick: (g.totalPick ?? null) as string | null,
    totalResult: (g.totalResult ?? null) as string | null,
    actualTotal: (g.actualTotal ?? null) as number | null,
  }));

  const cleanedGames = remappedGames.filter((g) => g.date && g.away && g.home);
  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null
  );

  const bettableGames = historicalGames;

  const edgeStats = useMemo(() => {
    const decided = bettableGames.filter(
      (g) =>
        isDecided(g) &&
        Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const allWins = decided.filter((g) => isWin(g)).length;
    const overallWinPct = decided.length > 0 ? ((allWins / decided.length) * 100).toFixed(1) : "0.0";
    const highEdge = decided.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => isWin(g)).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const eliteEdge = decided.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= 10);
    const eliteEdgeWins = eliteEdge.filter((g) => isWin(g)).length;
    const eliteEdgeWinPct = eliteEdge.length > 0 ? ((eliteEdgeWins / eliteEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, overallTotal: decided.length, highEdgeWinPct, highEdgeTotal: highEdge.length, eliteEdgeWinPct, eliteEdgeTotal: eliteEdge.length };
  }, [bettableGames]);

  const ouEdgeStats = useMemo(() => {
    const decided = bettableGames.filter(
      (g) =>
        g.vegasTotal != null && g.bbmiTotal != null &&
        g.totalPick != null && g.totalResult != null && g.actualTotal != null &&
        Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const allWins = decided.filter((g) => g.totalPick === g.totalResult).length;
    const overallWinPct = decided.length > 0 ? ((allWins / decided.length) * 100).toFixed(1) : "0.0";
    const highEdge = decided.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= 3);
    const highEdgeWins = highEdge.filter((g) => g.totalPick === g.totalResult).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const eliteEdge = decided.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= 5);
    const eliteEdgeWins = eliteEdge.filter((g) => g.totalPick === g.totalResult).length;
    const eliteEdgeWinPct = eliteEdge.length > 0 ? ((eliteEdgeWins / eliteEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, overallTotal: decided.length, highEdgeWinPct, highEdgeTotal: highEdge.length, eliteEdgeWinPct, eliteEdgeTotal: eliteEdge.length };
  }, [bettableGames]);

  const ouHistoricalStats = useMemo(() => {
    const decided = bettableGames.filter(
      (g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.totalResult != null && g.actualTotal != null
    );
    const total = decided.length;
    const wins = decided.filter((g) => g.totalPick === g.totalResult).length;
    const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
    const wagered = total * 100;
    const won = wins * 191;
    const roi = wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0";
    return { total, wins, winPct, wagered, won, roi };
  }, [bettableGames]);

  const [mode, setMode] = useState<"ats" | "ou">("ou");
  const [minEdge, setMinEdge] = useState<number>(0);
  const [teamSearch, setTeamSearch] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const edgeOptions = useMemo(() => mode === "ou" ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14], [mode]);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    bettableGames.forEach((g) => { if (g.away) teams.add(String(g.away)); if (g.home) teams.add(String(g.home)); });
    return Array.from(teams).sort();
  }, [bettableGames]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return [];
    return allTeams.filter((t) => t.toLowerCase().includes(teamSearch.toLowerCase())).slice(0, 10);
  }, [teamSearch, allTeams]);

  const edgeFilteredGames = useMemo(() => {
    if (mode === "ou") {
      const ouGames = bettableGames.filter((g) => g.vegasTotal != null && g.bbmiTotal != null);
      if (minEdge === 0) return ouGames;
      return ouGames.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= minEdge);
    }
    if (minEdge === 0) return bettableGames;
    return bettableGames.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= minEdge);
  }, [bettableGames, minEdge, mode]);

  const teamAndEdgeFilteredGames = useMemo(() => {
    if (!selectedTeam) return edgeFilteredGames;
    return edgeFilteredGames.filter((g) => String(g.away) === selectedTeam || String(g.home) === selectedTeam);
  }, [edgeFilteredGames, selectedTeam]);

  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    teamAndEdgeFilteredGames.forEach((g) => {
      if (!isDecided(g)) return;
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const pickedTeam = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      if (!records[pickedTeam]) records[pickedTeam] = { wins: 0, picks: 0 };
      records[pickedTeam].picks++;
      if (isWin(g)) records[pickedTeam].wins++;
    });
    return records;
  }, [teamAndEdgeFilteredGames]);

  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    return { wins: record.wins, picks: record.picks, display: `${record.wins}-${record.picks - record.wins}`, color: record.wins / record.picks >= 0.5 ? "#6b7280" : "#dc2626" };
  };

  const betHistorical = useMemo(() => {
    if (mode === "ou") {
      const ouBets = teamAndEdgeFilteredGames.filter((g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null);
      if (!selectedTeam) return ouBets;
      return ouBets.filter((g) => String(g.away) === selectedTeam || String(g.home) === selectedTeam);
    }
    const decided = teamAndEdgeFilteredGames.filter((g) => isDecided(g));
    if (!selectedTeam) return decided;
    return decided.filter((g) => {
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return false;
      return (bbmiLine < vegasLine ? String(g.home) : String(g.away)) === selectedTeam;
    });
  }, [teamAndEdgeFilteredGames, selectedTeam, mode]);

  const sampleSize = betHistorical.length;
  const wins = mode === "ou"
    ? betHistorical.filter((g) => g.totalPick === g.totalResult).length
    : betHistorical.filter((g) => isWin(g)).length;
  const fakeWagered = sampleSize * 100;
  const fakeWon = wins * 191;
  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 - 100 : 0;
  const summary: SummaryData = { sampleSize, bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0", fakeWagered, fakeWon, roi: roi.toFixed(1) };

  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const g of teamAndEdgeFilteredGames) { if (g.date) dates.add(g.date.split("T")[0].split(" ")[0]); }
    return Array.from(dates).sort();
  }, [teamAndEdgeFilteredGames]);

  const weekRanges = useMemo(() => {
    if (allDates.length === 0) return [];
    const ranges: Array<{ start: string; end: string }> = [];
    const addDays = (d: string, n: number) => {
      const [y, m, day] = d.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, day));
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    let cur = allDates[0];
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDays(cur, 6);
      if (teamAndEdgeFilteredGames.some((g) => { if (!g.date) return false; const d = g.date.split("T")[0].split(" ")[0]; return d >= cur && d <= end; })) ranges.push({ start: cur, end });
      cur = addDays(cur, 7);
    }
    return ranges.reverse();
  }, [allDates, teamAndEdgeFilteredGames]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  const filteredHistorical = useMemo(() => {
    const range = weekRanges[selectedWeekIndex];
    if (!range) return [];
    return teamAndEdgeFilteredGames.filter((g) => { if (!g.date) return false; const d = g.date.split("T")[0].split(" ")[0]; return d >= range.start && d <= range.end; });
  }, [teamAndEdgeFilteredGames, weekRanges, selectedWeekIndex]);

  const betWeekly = mode === "ou"
    ? filteredHistorical.filter((g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null)
    : filteredHistorical.filter((g) => isDecided(g));
  const weeklyWins = mode === "ou"
    ? betWeekly.filter((g) => g.totalPick === g.totalResult).length
    : betWeekly.filter((g) => isWin(g)).length;
  const weeklyFakeWagered = betWeekly.length * 100;
  const weeklyFakeWon = weeklyWins * 191;
  const weeklyRoi = weeklyFakeWagered > 0 ? (weeklyFakeWon / weeklyFakeWagered) * 100 - 100 : 0;
  const weeklySummary: SummaryData = { sampleSize: betWeekly.length, bbmiWinPct: betWeekly.length > 0 ? ((weeklyWins / betWeekly.length) * 100).toFixed(1) : "0", fakeWagered: weeklyFakeWagered, fakeWon: weeklyFakeWon, roi: weeklyRoi.toFixed(1) };

  const teamPerformance = useMemo(() => {
    const stats: Record<string, { games: number; wins: number; wagered: number; won: number }> = {};
    betHistorical.forEach((g) => {
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const team = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      if (!stats[team]) stats[team] = { games: 0, wins: 0, wagered: 0, won: 0 };
      stats[team].games++;
      if (isWin(g)) stats[team].wins++;
      stats[team].wagered += 100;
      stats[team].won += isWin(g) ? 191 : 0;
    });
    // Football has fewer games per team, so lower the minimum to 2
    return Object.entries(stats).filter(([, s]) => s.games >= 2)
      .map(([team, s]) => ({ team, games: s.games, winPct: (s.wins / s.games) * 100, roi: s.wagered > 0 ? (s.won / s.wagered) * 100 - 100 : 0, wagered: s.wagered, won: s.won }))
      .sort((a, b) => b.winPct - a.winPct || b.games - a.games);
  }, [betHistorical]);

  const [showTopTeams, setShowTopTeams] = useState(true);
  const [walkForwardOpen, setWalkForwardOpen] = useState(false);
  const [teamReportSize, setTeamReportSize] = useState(5);
  const displayedTeams = useMemo(() => {
    if (showTopTeams) return teamPerformance.slice(0, teamReportSize);
    return [...teamPerformance].sort((a, b) => a.winPct - b.winPct || b.games - a.games).slice(0, teamReportSize);
  }, [teamPerformance, showTopTeams, teamReportSize]);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: "edge", direction: "desc" });
  const handleSort = (key: SortKey) => setSortConfig((p) => ({ key, direction: p.key === key && p.direction === "desc" ? "asc" : "desc" }));

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = React.useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = React.useCallback(() => setDescPortal(null), []);

  const historicalWithComputed = filteredHistorical
    .filter((g) => mode === "ou" ? (g.vegasTotal != null && g.bbmiTotal != null) : g.vegasHomeLine != null)
    .map((g) => ({
      ...g,
      actualHomeLine: (g.actualAwayScore ?? 0) - (g.actualHomeScore ?? 0),
      edge: mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)),
      result: mode === "ou"
        ? (g.totalPick != null && g.totalResult != null ? (g.totalPick === g.totalResult ? "win" : "loss") : "")
        : betResult(g),
    }));

  const sortedHistorical = useMemo(() => {
    const sorted = [...historicalWithComputed];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a];
      const bVal = b[sortConfig.key as keyof typeof b];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1; if (bVal == null) return -1;
      let primary: number;
      if (typeof aVal === "number" && typeof bVal === "number") primary = sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      else primary = sortConfig.direction === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      if (primary !== 0) return primary;
      return String(b.date ?? "").localeCompare(String(a.date ?? ""));
    });
    return sorted;
  }, [historicalWithComputed, sortConfig]);

  const handleTeamSelect = (team: string) => { setSelectedTeam(team); setTeamSearch(team); setShowSuggestions(false); setSelectedWeekIndex(0); };
  const handleClearTeam = () => { setSelectedTeam(""); setTeamSearch(""); setSelectedWeekIndex(0); };

  // ── Active aliases — always after all useMemos ─────────────────────
  const activeEdgeStats = mode === "ats" ? edgeStats : ouEdgeStats;
  const activeEdgeLimit = mode === "ats" ? FREE_EDGE_LIMIT : 3;

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  const getRowStyle = (edge: number, index: number): React.CSSProperties => {
    const isHighEdge = edge >= 5;
    const isBelowMin = edge < MIN_EDGE_FOR_RECORD;
    if (isHighEdge) return { backgroundColor: "rgba(254,252,232,0.7)" };
    if (isBelowMin) return { backgroundColor: index % 2 === 0 ? "rgba(249,250,251,0.5)" : "#ffffff", opacity: 0.65 };
    return { backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb" };
  };

  const edgeCellStyle = (edge: number): React.CSSProperties => {
    const isHighEdge = edge >= 5;
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

  const formatEdge = (edge: number) => edge.toFixed(1);

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#6b7280", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NCAA Football {"\u00B7"} Model Accuracy
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
              Picks Model Accuracy
            </h1>
            <p style={{ fontSize: 13, color: "#666", margin: "0 auto 14px", lineHeight: 1.6 }}>Weekly comparison of BBMI model vs Vegas {"\u2014"} spreads and over/under totals</p>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {(["ou", "ats"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); if (m === "ou" && minEdge > 3) setMinEdge(0); }} style={{
                  padding: "6px 20px", borderRadius: 999, fontSize: 13,
                  border: mode === m ? "none" : "1px solid #c0bdb5",
                  backgroundColor: mode === m ? "#6b7280" : "transparent",
                  color: mode === m ? "#ffffff" : "#555",
                  fontWeight: mode === m ? 500 : 400, cursor: "pointer",
                }}>
                  {m === "ats" ? "Against The Spread" : "Over/Under"}
                </button>
              ))}
            </div>
          </div>

          <HowToReadAccordion />
          {/* HEADLINE STAT CARDS */}
          {(() => {
            const s = activeEdgeStats;
            const hThresh = mode === "ou" ? 3 : FREE_EDGE_LIMIT;
            const eThresh = mode === "ou" ? 5 : 10;
            return (
              <div style={{ maxWidth: 1100, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
                {[
                  { value: `${s.overallWinPct}%`, label: mode === "ats" ? "Overall ATS" : "Overall O/U", sub: `${s.overallTotal.toLocaleString()} picks (edge \u2265 ${MIN_EDGE_FOR_RECORD})`, premium: false },
                  { value: `${s.highEdgeWinPct}%`, label: `Edge \u2265 ${hThresh} pts`, sub: `${s.highEdgeTotal.toLocaleString()} picks`, premium: true },
                  { value: `${s.eliteEdgeWinPct}%`, label: `Edge \u2265 ${eThresh} pts`, sub: `${s.eliteEdgeTotal.toLocaleString()} picks`, premium: false },
                ].map(card => (
                  <div key={card.label} style={{
                    background: card.premium ? "#f0f1f3" : "#ffffff",
                    border: card.premium ? "2px solid #6b7280" : "1px solid #d4d2cc",
                    borderTop: "4px solid #6b7280", borderRadius: 10,
                    padding: "14px 14px 12px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: card.premium ? 28 : 24, fontWeight: card.premium ? 700 : 500, color: "#6b7280", lineHeight: 1.1 }}>{card.value}</div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: card.premium ? "#6b7280" : "#777", margin: "4px 0 3px" }}>{card.label}</div>
                    <div style={{ fontSize: "0.63rem", color: "#666" }}>{card.sub}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Walk-Forward — collapsible directly under HighEdgeCallout */}
          <div style={{ maxWidth: 1100, margin: "-1.5rem auto 2rem" }}>
            <button
              onClick={() => setWalkForwardOpen(v => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                width: "100%", padding: "10px 20px",
                backgroundColor: "#6b7280", color: "#94a3b8",
                border: "1px solid #6b7280",
                borderRadius: walkForwardOpen ? "0 0 0 0" : "0 0 10px 10px",
                cursor: "pointer", fontSize: "0.78rem", fontWeight: 600,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#6b7280", fontSize: 14 }}>&#10003;</span>
                How did the model perform on prior seasons it never trained on?
              </span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{walkForwardOpen ? "▲ Collapse" : "▼ Expand"}</span>
            </button>
            {walkForwardOpen && (
              <div style={{ backgroundColor: "#6b7280", borderRadius: "0 0 10px 10px", border: "1px solid #6b7280", borderTop: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ padding: "0.5rem 1.25rem", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)" }}>
                  Walk-Forward Validated Performance (out-of-sample)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", padding: "0.75rem 1.5rem 1.25rem", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.3rem" }}>2024 Season (unseen)</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.25rem" }}>56.4%</div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>760 games &middot; trained on 2023</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.3rem" }}>2025 Season (unseen)</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.25rem" }}>58.0%</div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>781 games &middot; trained on 2023+2024</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.3rem" }}>Edge &ge; 6 pts (&lt;14 spread)</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff", lineHeight: 1, marginBottom: "0.25rem" }}>61.2%</div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>667 picks across both seasons</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.55rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.3rem" }}>Combined (2 seasons)</div>
                    <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.25rem" }}>57.2%</div>
                    <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)" }}>1,541 games &middot; breakeven: 52.4%</div>
                  </div>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "0.6rem 1.25rem" }}>
                  <p style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.5 }}>
                    <strong style={{ color: "rgba(255,255,255,0.5)" }}>Walk-forward validation:</strong> the model is calibrated on past seasons and tested on a future season it has never seen. Parameters are never fit on the test data. This is the industry standard for honest model evaluation.
                  </p>
                  <p style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                    Why are the current-season numbers above slightly higher? During the live season, the model updates weekly with fresh SP+ ratings, new box scores, and recency-weighted stats &mdash; the same experience subscribers get in real time. The walk-forward numbers below reflect a stricter test where the model is frozen at the start of the season with no in-season updates. Both are honest; the current-season number better represents the real user experience.
                  </p>
                </div>
              </div>
            )}
          </div>

          <EdgeThresholdDisclosure />

          <div style={{ maxWidth: 1100, margin: "0 auto 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>

            {/* EDGE FILTER — pill buttons */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>{mode === "ats" ? "Minimum Edge (|BBMI Line \u2212 Vegas Line|):" : "Minimum Edge (|BBMI Total \u2212 Vegas O/U|):"}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                {edgeOptions.map((edge) => {
                  const isActive = minEdge === edge;
                  return (
                    <button
                      key={edge}
                      onClick={() => setMinEdge(edge)}
                      style={{
                        height: 34, padding: "0 14px", borderRadius: 999,
                        border: isActive ? "2px solid #6b7280" : "2px solid #d6d3d1",
                        backgroundColor: isActive ? "#6b7280" : "#ffffff",
                        color: isActive ? "#ffffff" : "#44403c",
                        fontSize: 13, fontWeight: isActive ? 700 : 500,
                        cursor: "pointer",
                        boxShadow: isActive ? "0 2px 8px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {edge === 0 ? "All" : `≥ ${edge}`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TEAM FILTER */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Filter by Team:</span>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="text" placeholder="Search team name..." value={teamSearch} autoComplete="off"
                    onChange={(e) => { setTeamSearch(e.target.value); setShowSuggestions(true); if (!e.target.value) setSelectedTeam(""); }}
                    onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    style={{
                      height: 38, width: 240, fontSize: 13, backgroundColor: "#ffffff", color: "#1c1917",
                      border: selectedTeam ? "1.5px solid #6b7280" : "1.5px solid #d6d3d1",
                      borderRadius: 8, padding: "0 12px", outline: "none",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }} />
                  {selectedTeam && (
                    <button onClick={handleClearTeam} style={{
                      height: 38, padding: "0 14px", borderRadius: 8,
                      border: "1.5px solid #e7e5e4", backgroundColor: "#ffffff",
                      color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Clear
                    </button>
                  )}
                </div>
                {showSuggestions && filteredTeams.length > 0 && (
                  <div style={{ position: "absolute", width: "100%", marginTop: 4, backgroundColor: "#ffffff", border: "2px solid #d6d3d1", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto", zIndex: 999999 }}>
                    {filteredTeams.map((team) => (
                      <div key={team} onMouseDown={(e) => { e.preventDefault(); handleTeamSelect(team); }}
                        style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}
                        className="hover:bg-[#f3f4f6]">
                        <NCAALogo teamName={team} size={20} /><span>{team}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic" }}>
              Tip: The model performs best when edge is highest. Try <strong>≥ {activeEdgeLimit} points</strong> to see picks where BBMI most strongly disagrees with Vegas.
              {minEdge >= activeEdgeLimit && <span style={{ color: "#6b7280", fontWeight: 700 }}> ✓ You&apos;re viewing high-edge picks — {activeEdgeStats.highEdgeWinPct}% accuracy at this threshold.</span>}
            </p>
          </div>

          {selectedTeam && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "8px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <NCAALogo teamName={selectedTeam} size={24} />
                <span style={{ fontWeight: 600 }}>Showing results for: {selectedTeam}</span>
              </div>
            </div>
          )}

          <SummaryCard
            title={selectedTeam ? `${mode === "ou" ? "O/U " : ""}Summary Metrics — ${selectedTeam}` : `${mode === "ou" ? "Overall O/U " : ""}Summary Metrics`}
            data={summary}
            wins={wins}
            colors={{ winPct: Number(summary.bbmiWinPct) > 50 ? "#6b7280" : "#dc2626", won: summary.fakeWon > summary.fakeWagered ? "#6b7280" : "#dc2626", roi: Number(summary.roi) > 0 ? "#6b7280" : "#dc2626" }}
          />

          {mode === "ats" && !selectedTeam && teamPerformance.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Team Performance Analysis</div>
                <div style={{ backgroundColor: "#f5f3ef", padding: 16, borderBottom: "1px solid #d4d2cc", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#44403c" }}>Show:</label>
                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                      <select value={showTopTeams ? "top" : "bottom"} onChange={(e) => setShowTopTeams(e.target.value === "top")}
                        style={{ height: 34, fontSize: 13, borderRadius: 8, border: "1.5px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 28px 0 10px", appearance: "none", cursor: "pointer", outline: "none", fontWeight: 500 }}>
                        <option value="top">Best Performing Teams</option>
                        <option value="bottom">Worst Performing Teams</option>
                      </select>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 8, pointerEvents: "none" }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#44403c" }}>Number of Teams:</label>
                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                      <select value={teamReportSize} onChange={(e) => setTeamReportSize(Number(e.target.value))}
                        style={{ height: 34, fontSize: 13, borderRadius: 8, border: "1.5px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 28px 0 10px", appearance: "none", cursor: "pointer", outline: "none", fontWeight: 500 }}>
                        {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
                      </select>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 8, pointerEvents: "none" }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>{["Rank", "Team", "Picked", "Win %", "Wagered", "Won", "ROI"].map((h) => (<th key={h} style={{ ...TH, position: "sticky", top: 0 }}>{h}</th>))}</tr>
                    </thead>
                    <tbody>
                      {displayedTeams.map((td, idx) => (
                        <tr key={td.team} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
                          <td style={TD_CENTER}>{idx + 1}</td>
                          <td style={TD}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(td.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a", fontWeight: 600, fontSize: 13 }} className="hover:underline">
                              <NCAALogo teamName={td.team} size={22} />{td.team}
                            </Link>
                          </td>
                          <td style={TD_CENTER}>{td.games.toLocaleString()}</td>
                          <td style={{ ...TD_CENTER, fontWeight: 700, color: td.winPct >= 50 ? "#6b7280" : "#dc2626" }}>{td.winPct.toFixed(1)}%</td>
                          <td style={{ ...TD_CENTER, color: "#dc2626", fontFamily: "ui-monospace, monospace" }}>${td.wagered.toLocaleString()}</td>
                          <td style={{ ...TD_CENTER, fontFamily: "ui-monospace, monospace", color: td.won >= td.wagered ? "#6b7280" : "#dc2626" }}>${td.won.toLocaleString()}</td>
                          <td style={{ ...TD_CENTER, fontWeight: 700, color: td.roi >= 0 ? "#6b7280" : "#dc2626" }}>{td.roi.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={7} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#f5f3ef", borderTop: "1px solid #ece9e2" }}>
                          Minimum 2 games required. Based on current edge filter (≥{minEdge.toFixed(1)} points).
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Historical Results By Week</h2>
            <p style={{ fontSize: 11, color: "#78716c", fontStyle: "italic", textAlign: "center" }}>Team records indicate Win-Loss when BBMI picks that team to beat Vegas.</p>
            <select value={selectedWeekIndex} onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              style={{ height: 38, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 12px", backgroundColor: "#ffffff", fontSize: 14, fontWeight: 500 }}>
              {weekRanges.map((range, idx) => {
                const fmt = (d: string) => { const [y, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}/${y}`; };
                return <option key={idx} value={idx}>{fmt(range.start)} – {fmt(range.end)}</option>;
              })}
            </select>
          </div>

          <SummaryCard
            title={selectedTeam ? `${mode === "ou" ? "O/U " : ""}Weekly Summary — ${selectedTeam}` : `${mode === "ou" ? "O/U " : ""}Weekly Summary`}
            data={weeklySummary}
            wins={weeklyWins}
            colors={{ winPct: Number(weeklySummary.bbmiWinPct) > 50 ? "#6b7280" : "#dc2626", won: weeklySummary.fakeWon > weeklySummary.fakeWagered ? "#6b7280" : "#dc2626", roi: Number(weeklySummary.roi) > 0 ? "#6b7280" : "#dc2626" }}
          />

          <WeeklyBreakdownTable games={teamAndEdgeFilteredGames} mode={mode} />

          {/* ── GAME TABLE ── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 8px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.72rem", color: "#78716c", fontStyle: "italic" }}>
              🟡 Gold rows = Edge ≥ 5 pts — historically highest accuracy tier
            </span>
            <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontStyle: "italic" }}>
              ~ Faded rows = Edge &lt; {MIN_EDGE_FOR_RECORD} pts — within normal line movement, excluded from stats
            </span>
          </div>

          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 980 }}>
                  <thead>
                    {mode === "ats" ? (
                      <>
                        <tr>
                          <SortableHeader label="Date"        columnKey="date"            tooltipId="date"            rowSpan={2} {...headerProps} />
                          <SortableHeader label="Away"        columnKey="away"            tooltipId="away"            rowSpan={2} {...headerProps} />
                          <SortableHeader label="Home"        columnKey="home"            tooltipId="home"            rowSpan={2} {...headerProps} />
                          <th colSpan={2} style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "8px 10px", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.25)" }}>
                            Home Line
                          </th>
                          <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" rowSpan={2} {...headerProps} />
                          <SortableHeader label="Actual Line" columnKey="actualHomeLine"  tooltipId="actualHomeLine"  rowSpan={2} {...headerProps} />
                          <SortableHeader label="Away Sc."    columnKey="actualAwayScore" tooltipId="actualAwayScore" rowSpan={2} {...headerProps} />
                          <SortableHeader label="Home Sc."    columnKey="actualHomeScore" tooltipId="actualHomeScore" rowSpan={2} {...headerProps} />
                          <SortableHeader label="Bet"         columnKey="fakeBet"         tooltipId="fakeBet"         rowSpan={2} {...headerProps} />
                          <SortableHeader label="Win"         columnKey="fakeWin"         tooltipId="fakeWin"         rowSpan={2} {...headerProps} />
                          <SortableHeader label="Result"      columnKey="result"          tooltipId="result"          rowSpan={2} {...headerProps} />
                        </tr>
                        <tr>
                          <SortableHeader label="Vegas" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" stickyTop={33} {...headerProps} />
                          <SortableHeader label="BBMI"  columnKey="bbmiHomeLine"  tooltipId="bbmiHomeLine"  stickyTop={33} {...headerProps} />
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr>
                          <SortableHeader label="Date"         columnKey="date"         tooltipId="date"         rowSpan={2} {...headerProps} />
                          <SortableHeader label="Away"         columnKey="away"         tooltipId="away"         rowSpan={2} {...headerProps} />
                          <SortableHeader label="Home"         columnKey="home"         tooltipId="home"         rowSpan={2} {...headerProps} />
                          <th colSpan={2} style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "8px 10px", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.25)" }}>
                            Totals
                          </th>
                          <SortableHeader label="Edge"         columnKey="edge"         tooltipId="totalEdge"    rowSpan={2} {...headerProps} />
                          <SortableHeader label="Pick"         columnKey="totalResult"  tooltipId="totalPick"    rowSpan={2} {...headerProps} />
                          <SortableHeader label="Actual Total" columnKey="actualTotal"  tooltipId="actual"       rowSpan={2} {...headerProps} />
                          <SortableHeader label="Result"       columnKey="result"       tooltipId="ouResult"     rowSpan={2} {...headerProps} />
                        </tr>
                        <tr>
                          <SortableHeader label="Vegas O/U" columnKey="vegasTotal" tooltipId="vegasTotal" stickyTop={33} {...headerProps} />
                          <SortableHeader label="BBMI Total" columnKey="bbmiTotal" tooltipId="bbmiTotal" stickyTop={33} {...headerProps} />
                        </tr>
                      </>
                    )}
                  </thead>
                  <tbody>
                    {sortedHistorical.map((g, i) => {
                      const isBelowMin = g.edge < MIN_EDGE_FOR_RECORD;
                      const isHighEdge = g.edge >= 5;

                      const rowTD = isBelowMin ? { ...TD, color: "#9ca3af" } : TD;
                      const rowTDR = isBelowMin ? { ...TD_RIGHT, color: "#9ca3af" } : TD_RIGHT;
                      const rowTDC = isBelowMin ? { ...TD_CENTER, color: "#9ca3af" } : TD_CENTER;

                      return (
                        <tr key={i} style={getRowStyle(g.edge, i)}>
                          <td style={{ ...rowTD, fontSize: 12 }}>{g.date}</td>
                          <td style={rowTD}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(String(g.away))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: isBelowMin ? "#9ca3af" : "#1a1a1a" }} className="hover:underline">
                              <NCAALogo teamName={String(g.away)} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                                {mode === "ats" && (() => { const r = getTeamRecord(String(g.away)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>
                          <td style={rowTD}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(String(g.home))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: isBelowMin ? "#9ca3af" : "#1a1a1a" }} className="hover:underline">
                              <NCAALogo teamName={String(g.home)} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                                {mode === "ats" && (() => { const r = getTeamRecord(String(g.home)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>
                          {mode === "ats" ? (
                            <>
                              <td style={rowTDR}>{g.vegasHomeLine}</td>
                              <td style={rowTDR}>{g.bbmiHomeLine}</td>
                            </>
                          ) : (
                            <>
                              <td style={rowTDR}>{g.vegasTotal}</td>
                              <td style={rowTDR}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : ""}</td>
                            </>
                          )}

                          {/* ── EDGE CELL ── */}
                          <td style={edgeCellStyle(g.edge)}>
                            {isHighEdge && <span style={{ marginRight: 3, fontSize: "0.7rem" }}>🟡</span>}
                            {isBelowMin && <span style={{ marginRight: 2, fontSize: "0.7rem", color: "#b0b8c1" }}>~</span>}
                            {formatEdge(g.edge)}
                          </td>

                          {mode === "ats" ? (
                            <>
                              <td style={{ ...rowTDR, fontWeight: 600 }}>{g.actualHomeLine}</td>
                              <td style={rowTDR}>{g.actualAwayScore}</td>
                              <td style={rowTDR}>{g.actualHomeScore}</td>
                              <td style={rowTDR}>${g.fakeBet}</td>
                              <td style={{ ...rowTDR, fontWeight: 600, color: isBelowMin ? "#9ca3af" : (isWin(g) ? "#6b7280" : isPush(g) ? "#a8a29e" : "#dc2626") }}>${g.fakeWin}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ ...rowTDC, fontWeight: 600, textTransform: "capitalize" }}>{g.totalPick ?? "\u2014"}</td>
                              <td style={{ ...rowTDR, fontWeight: 600 }}>{g.actualTotal ?? "\u2014"}</td>
                            </>
                          )}
                          <td style={rowTDC}>
                            {g.result === "win" ? <span style={{ color: isBelowMin ? "#9ca3af" : "#6b7280", fontWeight: 900, fontSize: "1.1rem" }}>✓</span>
                              : g.result === "loss" ? <span style={{ color: isBelowMin ? "#9ca3af" : "#dc2626", fontWeight: 900, fontSize: "1.1rem" }}>✗</span>
                              : g.result === "push" ? <span style={{ color: "#a8a29e", fontWeight: 700, fontSize: "0.8rem" }}>PUSH</span>
                              : ""}
                          </td>
                        </tr>
                      );
                    })}
                    {sortedHistorical.length === 0 && (
                      <tr>
                        <td colSpan={mode === "ats" ? 12 : 9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games for the selected week and filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <PageExplainer />

        </div>
      </div>
    </>
  );
}
