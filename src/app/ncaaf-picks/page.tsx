"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import { AuthProvider, useAuth } from "../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";
import gamesData from "@/data/betting-lines/football-games.json";

// ------------------------------------------------------------
// CONSTANTS
// ------------------------------------------------------------

const FREE_EDGE_LIMIT = 6;

// Walk-forward analysis shows 2+ pt edges are profitable (60%+ ATS).
// Below 2 pts is within normal book-to-book line variation.
const MIN_EDGE_FOR_RECORD = 2;

// Blowout games (spread > 14 pts) produce near-coin-flip ATS results.
const MAX_SPREAD_FOR_RECORD = 14;

// ------------------------------------------------------------
// WILSON CI
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type FootballGame = {
  gameDate: string | null;
  gameTime?: string | null;
  homeTeam: string;
  awayTeam: string;
  homeRank?: number | null;
  awayRank?: number | null;
  homeBbmif?: number | null;
  awayBbmif?: number | null;
  bbmifLine?: number | null;
  vegasLine?: number | null;
  // Also support the model-accuracy field names for backwards compat
  vegasHomeLine?: number | null;
  bbmiHomeLine?: number | null;
  vegasWinProb?: number | null;
  homeWinPct?: number | null;
  awayWinPct?: number | null;
  bbmifWinPct?: number | null;
  homeSpreadOdds?: number | null;
  awaySpreadOdds?: number | null;
  edge?: number | null;
  highEdge?: boolean;
  bbmifPick?: string | null;
  homeFieldAdv?: number;
  byeWeekHome?: boolean;
  byeWeekAway?: boolean;
  altitudeAdj?: number;
  neutralSite?: boolean;
  week?: number | null;
  cautionWeek?: boolean;
  largeSpread?: boolean;
  recommendedBet?: boolean;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  fakeBet?: string | number | null;
  fakeWin?: number | null;
  vegasTotal?: number | null;
  bbmiTotal?: number | null;
  totalEdge?: number | null;
  totalPick?: string | null;
  actualTotal?: number | null;
  totalResult?: string | null;
};

type SortableKey =
  | "bbmifPick" | "gameDate" | "awayTeam" | "homeTeam"
  | "vegasLine" | "bbmifLine" | "bbmifWinPct" | "edge"
  | "vegasTotal" | "bbmiTotal" | "totalEdge" | "totalPick";

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  awayTeam:    "The visiting team. Bye week indicator (💤) shown if coming off a rest week.",
  homeTeam:    "The home team. Neutral site games marked with (N). Altitude adjustment shown with 🏔️.",
  vegasLine:   "The Vegas spread (home perspective). Negative = home favored, Positive = away favored.",
  bbmifLine:   "BBMI's projected spread based on SP+ efficiency, YPP differential, turnover margin, and home field advantage.",
  edge:        "The difference between BBMI's line and Vegas. Larger edge = stronger disagreement with the market.",
  bbmifPick:   "The team BBMI projects to cover the Vegas spread.",
  bbmifWinPct: "BBMI's estimated win probability for the picked team.",
  vegasTotal:  "The Vegas over/under total for the game.",
  bbmiTotal:   "BBMI's projected total points scored by both teams.",
  totalEdge:   "The difference between BBMI's total and Vegas. Larger edge = stronger disagreement with the market.",
  totalPick:   "BBMI's over/under pick based on the projected total vs Vegas total.",
  actual:      "The actual combined score of both teams.",
  result:      "Whether the O/U pick was correct (check) or incorrect (X).",
};

// ------------------------------------------------------------
// TOOLTIP PORTAL
// ------------------------------------------------------------

function ColDescPortal({ tooltipId, anchorRect, onClose }: {
  tooltipId: string; anchorRect: DOMRect; onClose: () => void;
}) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (el.current && !el.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, textAlign: "left", whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortableKey; tooltipId?: string;
  sortConfig: { key: SortableKey; direction: "asc" | "desc" };
  handleSort: (key: SortableKey) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = sortConfig.key === columnKey;
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ?? null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && TOOLTIPS[tooltipId] && openDesc && uid) {
      if (descShowing) { closeDesc?.(); }
      else {
        const rect = thRef.current?.getBoundingClientRect();
        if (rect) openDesc(uid, rect);
      }
    }
  };

  return (
    <th ref={thRef} style={{
      backgroundColor: "#0a1a2f", color: "#ffffff",
      padding: "6px 7px", textAlign: align,
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
      borderBottom: "2px solid rgba(255,255,255,0.1)",
      fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      verticalAlign: "middle", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecorationLine: tooltipId ? "underline" : "none", textDecorationStyle: tooltipId ? "dotted" : undefined, textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// LOCKED ROW OVERLAY
// ------------------------------------------------------------

function LockedRowOverlay({ colSpan, onSubscribe, winPct, edgeLimit = FREE_EDGE_LIMIT }: { colSpan: number; onSubscribe: () => void; winPct: string; edgeLimit?: number }) {
  return (
    <tr style={{ backgroundColor: "#0a1a2f" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>🔒</span>
            <span style={{ fontSize: "0.78rem", color: "#facc15", fontWeight: 700 }}>High-edge pick — Edge ≥ {edgeLimit} pts</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
              These picks are <strong style={{ color: "#facc15" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button onClick={onSubscribe} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            Unlock →
          </button>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------
// PAYWALL MODAL
// ------------------------------------------------------------

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct, edgeLimit = FREE_EDGE_LIMIT }: {
  onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string; edgeLimit?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "2rem 1.75rem", maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem" }}>
            🔒 Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.4rem" }}>Unlock High-Edge Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge ≥ {edgeLimit} pts — where the model is most accurate</p>
        </div>
        <div style={{ backgroundColor: "#0a1a2f", borderRadius: 0, padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks · edge ≥ {edgeLimit}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>picks with statistically significant edge (≥ {MIN_EDGE_FOR_RECORD} pts)</div>
          </div>
        </div>
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.68rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>ℹ️ Methodology:</strong> The overall rate excludes games where BBMI and Vegas lines differ by less than {MIN_EDGE_FOR_RECORD} points. A difference smaller than {MIN_EDGE_FOR_RECORD} pts is within normal book-to-book line variation and does not represent a meaningful BBMI disagreement with Vegas.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$15</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>One-time · No auto-renewal</div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02" style={{ display: "block", backgroundColor: "#16a34a", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Try 7 Days →</a>
          </div>
          <div style={{ border: "2px solid #2563eb", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#eff6ff", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "0.15rem 0.6rem", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>MOST POPULAR</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$49</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e40af", margin: "0.3rem 0 0.2rem" }}>Per Month</div>
            <div style={{ fontSize: "0.65rem", color: "#3b82f6", backgroundColor: "#dbeafe", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>Cancel anytime</div>
            <a href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01" style={{ display: "block", background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Subscribe →</a>
          </div>
        </div>
        <button onClick={onClose} style={{ fontSize: "0.75rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          No thanks, keep browsing free picks
        </button>
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Already subscribed? </span>
          <Link href="/auth?returnTo=/ncaaf-picks" onClick={onClose} style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>Sign in →</Link>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// EDGE HELPERS
// ------------------------------------------------------------

function edgeColor(edge: number | null): string {
  if (edge == null) return "#a8a29e";
  if (edge >= 7) return "#16a34a";
  if (edge >= 5) return "#65a30d";
  if (edge >= 3) return "#ca8a04";
  return "#78716c";
}

function fmtLine(v: number | null | undefined): string {
  if (v == null) return "—";
  return v > 0 ? `+${v}` : String(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

// ------------------------------------------------------------
// MAIN PAGE CONTENT
// ------------------------------------------------------------

function NCAAFPicksPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [mode, setMode] = useState<"ats" | "ou">(() => searchParams.get("mode") === "ou" ? "ou" : "ats");

  useEffect(() => {
    async function checkPremium() {
      if (!user) { setIsPremium(false); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
      } catch { setIsPremium(false); }
    }
    checkPremium();
  }, [user]);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // Normalize games — support both field naming conventions
  const allGames = useMemo(() => {
    return (gamesData as unknown as FootballGame[])
      .filter((g) => g.homeTeam && g.awayTeam)
      .map((g) => ({
        ...g,
        // Normalize line field names: bbmifLine / vegasLine are primary; fall back to bbmiHomeLine / vegasHomeLine
        _vegasLine: g.vegasLine ?? g.vegasHomeLine ?? null,
        _bbmifLine: g.bbmifLine ?? g.bbmiHomeLine ?? null,
      }));
  }, []);

  const atsUpcomingGames = useMemo(() =>
    allGames.filter((g) => (g.actualHomeScore == null || g.actualAwayScore == null) && g._bbmifLine != null && g._vegasLine != null),
  [allGames]);

  const ouUpcomingGames = useMemo(() =>
    allGames.filter((g) => (g.actualHomeScore == null || g.actualAwayScore == null) && g.vegasTotal != null && g.bbmiTotal != null),
  [allGames]);

  const upcomingGames = mode === "ats" ? atsUpcomingGames : ouUpcomingGames;

  const historicalGames = useMemo(() =>
    allGames.filter((g) => g.actualHomeScore != null && g.actualAwayScore != null),
  [allGames]);

  const currentWeek = upcomingGames[0]?.week ?? null;

  // ── Edge stats from historical games ──────────────────────
  const edgeStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => {
      const edge = Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0));
      return (
        g._bbmifLine != null && g._vegasLine != null &&
        g._bbmifLine !== g._vegasLine &&
        edge >= MIN_EDGE_FOR_RECORD &&
        Math.abs(g._vegasLine ?? 0) <= MAX_SPREAD_FOR_RECORD
      );
    });
    const allWins = allBets.filter((g) => {
      const bl = g._bbmifLine!; const vl = g._vegasLine!;
      const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
      const coverMargin = margin + vl;
      if (coverMargin === 0) return false;
      const pickHome = bl < vl;
      return pickHome ? coverMargin > 0 : coverMargin < 0;
    });
    const overallWinPct = allBets.length > 0 ? ((allWins.length / allBets.length) * 100).toFixed(1) : "0.0";
    const highEdge = allBets.filter((g) => Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => {
      const bl = g._bbmifLine!; const vl = g._vegasLine!;
      const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
      const coverMargin = margin + vl;
      if (coverMargin === 0) return false;
      const pickHome = bl < vl;
      return pickHome ? coverMargin > 0 : coverMargin < 0;
    });
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins.length / highEdge.length) * 100).toFixed(1) : "0.0";
    const freeEdge = allBets.filter((g) => Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0)) < FREE_EDGE_LIMIT);
    const freeEdgeWins = freeEdge.filter((g) => {
      const bl = g._bbmifLine!; const vl = g._vegasLine!;
      const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
      const coverMargin = margin + vl;
      if (coverMargin === 0) return false;
      const pickHome = bl < vl;
      return pickHome ? coverMargin > 0 : coverMargin < 0;
    });
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins.length / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length, freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  // ── Historical stats (headline cards) ─────────────────────
  const historicalStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => {
      const edge = Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0));
      return (
        g._bbmifLine != null && g._vegasLine != null &&
        g._bbmifLine !== g._vegasLine &&
        edge >= MIN_EDGE_FOR_RECORD &&
        Math.abs(g._vegasLine ?? 0) <= MAX_SPREAD_FOR_RECORD
      );
    });
    const wins = allBets.filter((g) => {
      const bl = g._bbmifLine!; const vl = g._vegasLine!;
      const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
      const coverMargin = margin + vl;
      if (coverMargin === 0) return false;
      return bl < vl ? coverMargin > 0 : coverMargin < 0;
    });
    // ROI: flat $100/game at -110 juice.
    // Winning bet profits $90.91; losing bet loses $100.
    const losses = allBets.length - wins.length;
    const profit = wins.length * 90.91 - losses * 100;
    const wagered = allBets.length * 100;
    const roi = wagered > 0 ? (profit / wagered * 100).toFixed(1) : "0.0";
    return { total: allBets.length, winPct: allBets.length > 0 ? ((wins.length / allBets.length) * 100).toFixed(1) : "0.0", roi };
  }, [historicalGames]);

  // ── Edge performance breakdown ─────────────────────────────
  const edgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "0–3 pts",  min: 0,  max: 3 },
      { name: "3–6 pts",  min: 3,  max: 6 },
      { name: "6–9 pts",  min: 6,  max: 9 },
      { name: "9–12 pts", min: 9,  max: 12 },
      { name: "12+ pts",  min: 12, max: Infinity },
    ];
    return cats.map((cat) => {
      const catGames = historicalGames.filter((g) => {
        const edge = Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0));
        return (
          g._bbmifLine != null && g._vegasLine != null &&
          g._bbmifLine !== g._vegasLine &&
          edge >= cat.min && edge < cat.max &&
          Math.abs(g._vegasLine ?? 0) <= MAX_SPREAD_FOR_RECORD
        );
      });
      const wins = catGames.filter((g) => {
        const bl = g._bbmifLine!; const vl = g._vegasLine!;
        const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
        const coverMargin = margin + vl;
        if (coverMargin === 0) return false;
        return bl < vl ? coverMargin > 0 : coverMargin < 0;
      });
      const lossCount = catGames.length - wins.length;
      const profit = wins.length * 90.91 - lossCount * 100;
      const wagered = catGames.length * 100;
      const roi = wagered > 0 ? profit / wagered * 100 : 0;
      const { low, high } = wilsonCI(wins.length, catGames.length);
      return {
        name: cat.name, games: catGames.length, wins: wins.length,
        winPct: catGames.length > 0 ? ((wins.length / catGames.length) * 100).toFixed(1) : "0.0",
        roi: roi.toFixed(1), roiPositive: roi > 0, ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── O/U parallel stats ────────────────────────────────────
  const ouEdgeStats = useMemo(() => {
    const OU_FREE = 3;
    const allBets = historicalGames.filter(
      (g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null &&
        Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const allWins = allBets.filter((g) => g.totalPick === g.totalResult).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";
    const highEdge = allBets.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= OU_FREE);
    const highEdgeWins = highEdge.filter((g) => g.totalPick === g.totalResult).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const freeEdge = allBets.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) < OU_FREE);
    const freeEdgeWins = freeEdge.filter((g) => g.totalPick === g.totalResult).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length, freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  const ouHistoricalStats = useMemo(() => {
    const allBets = historicalGames.filter(
      (g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null &&
        Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const wins = allBets.filter((g) => g.totalPick === g.totalResult).length;
    const losses = allBets.length - wins;
    const profit = wins * 90.91 - losses * 100;
    const wagered = allBets.length * 100;
    const roi = wagered > 0 ? (profit / wagered * 100).toFixed(1) : "0.0";
    return { total: allBets.length, winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0", roi };
  }, [historicalGames]);

  const ouEdgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "0\u20131 pts",  min: 0,  max: 1 },
      { name: "1\u20132 pts",  min: 1,  max: 2 },
      { name: "2\u20133 pts",  min: 2,  max: 3 },
      { name: "3+ pts",        min: 3,  max: Infinity },
    ];
    return cats.map((cat) => {
      const catGames = historicalGames.filter((g) => {
        if (g.vegasTotal == null || g.bbmiTotal == null || g.totalPick == null || g.totalResult == null) return false;
        const edge = Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0));
        return edge >= cat.min && edge < cat.max;
      });
      const wins = catGames.filter((g) => g.totalPick === g.totalResult).length;
      const total = catGames.length;
      const roi = total > 0 ? ((wins * 90.91 - (total - wins) * 100) / (total * 100) * 100) : 0;
      const { low, high } = wilsonCI(wins, total);
      return {
        name: cat.name, games: total, wins,
        winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0",
        roi: roi.toFixed(1), roiPositive: roi > 0, ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── Active aliases (must be after all stat useMemos) ──────
  const activeEdgeStats = mode === "ats" ? edgeStats : ouEdgeStats;
  const activeHistoricalStats = mode === "ats" ? historicalStats : ouHistoricalStats;
  const activeEdgePerformanceStats = mode === "ats" ? edgePerformanceStats : ouEdgePerformanceStats;
  const activeEdgeLimit = mode === "ats" ? FREE_EDGE_LIMIT : 3;

  // ── Sort / Filter ──────────────────────────────────────────
  const atsEdgeOptions = [
    { label: "All Games", min: 0,  max: Infinity },
    { label: "0\u20133 pts",   min: 0,  max: 3 },
    { label: "3\u20136 pts",   min: 3,  max: 6 },
    { label: "6\u20139 pts",   min: 6,  max: 9 },
    { label: "9\u201312 pts",  min: 9,  max: 12 },
    { label: "12+ pts",   min: 12, max: Infinity },
  ];
  const ouEdgeOptions = [
    { label: "All Games", min: 0,  max: Infinity },
    { label: "0\u20131 pts",   min: 0,  max: 1 },
    { label: "1\u20132 pts",   min: 1,  max: 2 },
    { label: "2\u20133 pts",   min: 2,  max: 3 },
    { label: "3+ pts",    min: 3,  max: Infinity },
  ];
  const edgeOptions = mode === "ats" ? atsEdgeOptions : ouEdgeOptions;
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKey) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const edgeFilteredGames = useMemo(() => {
    return upcomingGames.filter((g) => {
      const edge = mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0));
      if (edgeOption.label === "All Games") return true;
      return edge >= edgeOption.min && edge < edgeOption.max;
    });
  }, [upcomingGames, edgeOption, mode]);

  const sortedUpcoming = useMemo(() => {
    const withComputed = edgeFilteredGames.map((g) => ({
      ...g,
      _edge: mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0)),
      _bbmifPick: mode === "ou"
        ? (g.totalPick ?? "")
        : (g._bbmifLine == null || g._vegasLine == null ? ""
          : g._bbmifLine === g._vegasLine ? ""
          : g._bbmifLine > g._vegasLine ? g.awayTeam : g.homeTeam),
    }));
    return [...withComputed].sort((a, b) => {
      let aVal: string | number | null | undefined;
      let bVal: string | number | null | undefined;
      if (sortConfig.key === "edge" || sortConfig.key === "totalEdge") { aVal = a._edge; bVal = b._edge; }
      else if (sortConfig.key === "bbmifPick" || sortConfig.key === "totalPick") { aVal = a._bbmifPick; bVal = b._bbmifPick; }
      else if (sortConfig.key === "vegasLine") { aVal = a._vegasLine; bVal = b._vegasLine; }
      else if (sortConfig.key === "bbmifLine") { aVal = a._bbmifLine; bVal = b._bbmifLine; }
      else if (sortConfig.key === "bbmifWinPct") { aVal = a.bbmifWinPct; bVal = b.bbmifWinPct; }
      else if (sortConfig.key === "gameDate") { aVal = a.gameDate; bVal = b.gameDate; }
      else if (sortConfig.key === "awayTeam") { aVal = a.awayTeam; bVal = b.awayTeam; }
      else if (sortConfig.key === "homeTeam") { aVal = a.homeTeam; bVal = b.homeTeam; }
      else if (sortConfig.key === "vegasTotal") { aVal = a.vegasTotal; bVal = b.vegasTotal; }
      else if (sortConfig.key === "bbmiTotal") { aVal = a.bbmiTotal; bVal = b.bbmiTotal; }
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [edgeFilteredGames, sortConfig]);

  // Split into recommended and below-threshold
  const isFbRecommended = (g: typeof sortedUpcoming[0]) => {
    return g._edge >= MIN_EDGE_FOR_RECORD && g._bbmifPick !== "";
  };
  const recommendedGames = sortedUpcoming.filter(g => isFbRecommended(g));
  const belowThresholdGames = sortedUpcoming.filter(g => !isFbRecommended(g));
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);

  const recLabel = mode === "ou"
    ? `${recommendedGames.filter(g => (g.bbmiTotal ?? 0) < (g.vegasTotal ?? 0)).length} under, ${recommendedGames.filter(g => (g.bbmiTotal ?? 0) > (g.vegasTotal ?? 0)).length} over`
    : `${recommendedGames.length} spread picks`;

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const lockedCount = sortedUpcoming.filter((g) => g._edge >= activeEdgeLimit).length;

  // ── Table cell styles ──────────────────────────────────────
  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={activeEdgeStats.highEdgeWinPct} highEdgeTotal={activeEdgeStats.highEdgeTotal} overallWinPct={activeEdgeStats.overallWinPct} edgeLimit={activeEdgeLimit} />}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ background: "#0a1628", borderRadius: 0, padding: "32px 24px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff", margin: 0 }}>
              <LogoBadge league="ncaa-football" size={120} />
              <span style={{ marginLeft: 12 }}>Today&apos;s Game Lines</span>
            </h1>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0" }}>NCAA Football {"\u00B7"} Powered by the BBMI Model</p>
            <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
              {(["ats", "ou"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setEdgeOption(m === "ou" ? ouEdgeOptions[0] : atsEdgeOptions[0]); }}
                  style={{
                    padding: "6px 20px", borderRadius: 999, fontSize: 14, fontWeight: mode === m ? 700 : 500,
                    border: mode === m ? "none" : "1px solid #475569",
                    backgroundColor: mode === m ? "#ffffff" : "transparent",
                    color: mode === m ? "#0a1628" : "#94a3b8", cursor: "pointer",
                  }}>
                  {m === "ats" ? "Against the Spread" : "Over/Under"}
                </button>
              ))}
            </div>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 600, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { value: `${activeEdgeStats.freeEdgeWinPct}%`, label: "Free Picks", sub: `edge ${MIN_EDGE_FOR_RECORD}\u2013${activeEdgeLimit} pts`, color: "#94a3b8" },
              { value: `${activeEdgeStats.highEdgeWinPct}%`, label: "Premium Picks", sub: `edge \u2265 ${activeEdgeLimit} pts`, color: "#facc15", bg: "#0a1a2f" },
              { value: `${activeHistoricalStats.winPct}%`, label: mode === "ats" ? "Overall ATS" : "Overall O/U", sub: `${activeHistoricalStats.total.toLocaleString()} games`, color: Number(activeHistoricalStats.winPct) >= 50 ? "#16a34a" : "#dc2626" },
            ].map((card) => (
              <div key={card.label} style={{ backgroundColor: (card as { bg?: string }).bg ?? "#ffffff", border: (card as { bg?: string }).bg ? "2px solid #facc15" : "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: (card as { bg?: string }).bg ? "#ffffff" : "#0a1a2f", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.68rem", color: (card as { bg?: string }).bg ? "rgba(255,255,255,0.5)" : "#78716c" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* STATS METHODOLOGY NOTE */}
          <div style={{ maxWidth: 600, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              † Record includes only games where BBMI and Vegas lines differ by ≥ {MIN_EDGE_FOR_RECORD} points{mode === "ats" ? ` and Vegas spread ≤ ${MAX_SPREAD_FOR_RECORD} pts` : ""} ({activeHistoricalStats.total.toLocaleString()} games).
              Football lines routinely move 1–3 points between open and kickoff. Differences smaller than {MIN_EDGE_FOR_RECORD} pts are within normal market noise.{" "}
              Blowout games (&gt;{MAX_SPREAD_FOR_RECORD} pts) historically produce near-coin-flip ATS results and are excluded.{" "}
              <Link href="/ncaaf-model-accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View full public log →</Link>
            </p>
          </div>

          {/* HIGH EDGE CALLOUT */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#0a1a2f", borderRadius: 0, border: "2px solid #facc15", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{activeEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>win rate on picks with edge ≥ {activeEdgeLimit} pts</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "rgba(255,255,255,0.6)" }}>{activeEdgeStats.overallWinPct}%</strong> overall · documented across <strong style={{ color: "rgba(255,255,255,0.6)" }}>{activeEdgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 700 }}>🔒 {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked today</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $15 →
                </button>
              </div>
            </div>
          )}

          {/* EDGE PERFORMANCE GRAPH */}
          {/* EdgePerformanceGraph expects bbmiHomeLine/vegasHomeLine/fakeBet/fakeWin.
              Remap football-games.json field names accordingly. */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#0a1a2f", borderRadius: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", padding: "1.5rem" }}>
            <EdgePerformanceGraph
              games={historicalGames.map((g) => ({
                ...g,
                date: g.gameDate,
                away: g.awayTeam,
                home: g.homeTeam,
                bbmiHomeLine: g._bbmifLine,
                vegasHomeLine: g._vegasLine,
                actualHomeScore: g.actualHomeScore ?? null,
                actualAwayScore: g.actualAwayScore ?? null,
                vegasTotal: g.vegasTotal ?? null,
                bbmiTotal: g.bbmiTotal ?? null,
                totalPick: g.totalPick ?? null,
                totalResult: g.totalResult ?? null,
                actualTotal: g.actualTotal ?? null,
                fakeBet: (() => {
                  if (mode === "ou") {
                    if (g.vegasTotal == null || g.bbmiTotal == null) return null;
                    return 100;
                  }
                  if (g._bbmifLine == null || g._vegasLine == null) return null;
                  const edge = Math.abs(g._bbmifLine - g._vegasLine);
                  if (edge < MIN_EDGE_FOR_RECORD) return null;
                  if (Math.abs(g._vegasLine) > MAX_SPREAD_FOR_RECORD) return null;
                  return 100;
                })(),
                fakeWin: (() => {
                  if (mode === "ou") {
                    if (g.totalPick == null || g.totalResult == null) return 0;
                    return g.totalPick === g.totalResult ? 190.91 : 0;
                  }
                  if (g._bbmifLine == null || g._vegasLine == null) return null;
                  if (g.actualHomeScore == null || g.actualAwayScore == null) return null;
                  const edge = Math.abs(g._bbmifLine - g._vegasLine);
                  if (edge < MIN_EDGE_FOR_RECORD) return null;
                  if (Math.abs(g._vegasLine) > MAX_SPREAD_FOR_RECORD) return null;
                  const pickHome = g._bbmifLine < g._vegasLine;
                  const margin = Number(g.actualHomeScore) - Number(g.actualAwayScore);
                  const coverMargin = margin + g._vegasLine;
                  if (coverMargin === 0) return 0;
                  const covered = pickHome ? coverMargin > 0 : coverMargin < 0;
                  return covered ? 190.91 : 0;
                })(),
              }))}
              groupBy="month"
              showTitle={true}
              edgeCategories={mode === "ou" ? [
                { name: "0\u20131 pts",  min: 0,  max: 1,        color: "#475569", width: 1.0  },
                { name: "1\u20132 pts",  min: 1,  max: 2,        color: "#64748b", width: 1.25 },
                { name: "2\u20133 pts",  min: 2,  max: 3,        color: "#3b82f6", width: 1.75 },
                { name: "3+ pts",        min: 3,  max: Infinity,  color: "#22c55e", width: 2.5  },
              ] : undefined}
              mode={mode}
            />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Historical Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "Win %", "95% CI", "ROI"].map((h) => (
                      <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeEdgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.games.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: Number(stat.winPct) > 50 ? "#16a34a" : "#dc2626" }}>{stat.winPct}%</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "center", color: "#78716c", fontStyle: "italic", whiteSpace: "nowrap" }}>
                        {stat.ciLow.toFixed(1)}%–{stat.ciHigh.toFixed(1)}%
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.roiPositive ? "#16a34a" : "#dc2626" }}>{stat.roi}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                      Includes only picks where edge ≥ {MIN_EDGE_FOR_RECORD} pts and Vegas spread ≤ {MAX_SPREAD_FOR_RECORD} pts · 95% CI uses Wilson score method.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#166534", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {activeEdgeLimit} pts) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks ≥ {activeEdgeLimit} pts</strong> — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access — use the edge filter to focus on the model&apos;s strongest picks.</span>}
            </p>
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
            Upcoming Games{currentWeek ? ` — Week ${currentWeek}` : ""}
          </h2>
          {upcomingGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              This week&apos;s picks are typically published once Vegas opening lines are available.
            </p>
          )}

          {/* EDGE FILTER */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Minimum Edge</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {edgeOptions.map((o) => {
                const isActive = edgeOption.label === o.label;
                return (
                  <button
                    key={o.label}
                    onClick={() => setEdgeOption(o)}
                    style={{
                      height: 38,
                      padding: "0 16px",
                      borderRadius: 999,
                      border: isActive ? "2px solid #0a1a2f" : "2px solid #d6d3d1",
                      backgroundColor: isActive ? "#0a1a2f" : "#ffffff",
                      color: isActive ? "#ffffff" : "#44403c",
                      fontSize: "0.85rem",
                      fontWeight: isActive ? 700 : 500,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 2px 8px rgba(10,26,47,0.18)" : "0 1px 3px rgba(0,0,0,0.07)",
                      transition: "all 0.12s ease",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#44403c", margin: 0 }}>
              Showing <strong>{sortedUpcoming.length}</strong> of <strong>{upcomingGames.length}</strong> games
              {!isPremium && lockedCount > 0 && <span style={{ color: "#dc2626", marginLeft: 8 }}>· {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked 🔒</span>}
            </p>
            {!isPremium && (
              <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic", margin: 0 }}>
                Free picks shown for edge &lt; {activeEdgeLimit} pts.{" "}
                <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                  Subscribe to unlock high-edge picks →
                </button>
              </p>
            )}
          </div>

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Away"       columnKey="awayTeam"  tooltipId="awayTeam"  align="left"   {...headerProps} />
                      <SortableHeader label="Home"       columnKey="homeTeam"  tooltipId="homeTeam"  align="left"   {...headerProps} />
                      {mode === "ats" ? (
                        <>
                          <SortableHeader label="Vegas Line" columnKey="vegasLine" tooltipId="vegasLine"                {...headerProps} />
                          <SortableHeader label="BBMI Line" columnKey="bbmifLine" tooltipId="bbmifLine"                {...headerProps} />
                          <SortableHeader label="Edge"       columnKey="edge"      tooltipId="edge"                     {...headerProps} />
                          <SortableHeader label="BBMI Pick" columnKey="bbmifPick" tooltipId="bbmifPick" align="left"   {...headerProps} />
                          <SortableHeader label="Win %"      columnKey="bbmifWinPct" tooltipId="bbmifWinPct"           {...headerProps} />
                        </>
                      ) : (
                        <>
                          <SortableHeader label="Vegas O/U"  columnKey="vegasTotal" tooltipId="vegasTotal"              {...headerProps} />
                          <SortableHeader label="BBMI Total" columnKey="bbmiTotal"  tooltipId="bbmiTotal"               {...headerProps} />
                          <SortableHeader label="Edge"       columnKey="totalEdge"  tooltipId="totalEdge"               {...headerProps} />
                          <SortableHeader label="O/U Pick"   columnKey="totalPick"  tooltipId="totalPick"  align="left" {...headerProps} />
                          <SortableHeader label="Actual"     columnKey="bbmifWinPct" tooltipId="actual"                 {...headerProps} />
                          <SortableHeader label="Result"     columnKey="bbmifWinPct" tooltipId="result"                 {...headerProps} />
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedUpcoming.length === 0 && (
                      <tr><td colSpan={mode === "ats" ? 7 : 8} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {/* ── RECOMMENDED PICKS DIVIDER ── */}
                    {recommendedGames.length > 0 && (
                      <tr>
                        <td colSpan={mode === "ats" ? 7 : 8} style={{ padding: "10px 16px", background: "#f0fdf4", borderTop: "3px solid #16a34a", borderBottom: "1px solid #bbf7d0" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                            {"\u2705"} Recommended picks {"\u00B7"} {recLabel}
                          </span>
                        </td>
                      </tr>
                    )}

                    {recommendedGames.map((g, i) => {
                      const edge = g._edge;
                      const bbmifPick = g._bbmifPick;
                      const isBelowMinEdge = edge < MIN_EDGE_FOR_RECORD;
                      const isLocked = !isPremium && edge >= activeEdgeLimit;

                      if (isLocked) {
                        return <LockedRowOverlay key={i} colSpan={mode === "ats" ? 7 : 8} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} edgeLimit={activeEdgeLimit} />;
                      }

                      const rowBg = isBelowMinEdge
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const rowOpacity = isBelowMinEdge ? 0.55 : 1;
                      const rowColor = isBelowMinEdge ? "#9ca3af" : undefined;

                      const winPct = g.bbmifWinPct;
                      const isLargeSpread = g.largeSpread || (Math.abs(g._vegasLine ?? 0) > MAX_SPREAD_FOR_RECORD);

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg, opacity: rowOpacity, color: rowColor }}>

                          {/* AWAY */}
                          <td style={{ ...TD, minWidth: 180, paddingLeft: 16 }}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={g.awayTeam} size={22} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>
                                  {g.awayRank && g.awayRank <= 25 && (
                                    <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 3 }}>#{g.awayRank}</span>
                                  )}
                                  {g.awayTeam}
                                </span>
                                {g.byeWeekAway && (
                                  <span style={{ fontSize: 9, color: "#ca8a04" }}>💤 Bye week</span>
                                )}
                              </div>
                            </Link>
                          </td>

                          {/* HOME */}
                          <td style={{ ...TD, minWidth: 180 }}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={g.homeTeam} size={22} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>
                                  {g.homeRank && g.homeRank <= 25 && (
                                    <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 3 }}>#{g.homeRank}</span>
                                  )}
                                  {g.homeTeam}
                                </span>
                                <div style={{ fontSize: 9, color: "#94a3b8" }}>
                                  {g.neutralSite ? "(N) " : ""}
                                  {g.byeWeekHome ? "💤 Bye week " : ""}
                                  {(g.altitudeAdj ?? 0) > 0 ? "🏔️" : ""}
                                </div>
                              </div>
                            </Link>
                          </td>

                          {mode === "ats" ? (
                            <>
                              {/* VEGAS LINE */}
                              <td style={TD_RIGHT}>{fmtLine(g._vegasLine)}</td>

                              {/* BBMI LINE */}
                              <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#0a1a2f" }}>{fmtLine(g._bbmifLine)}</td>

                              {/* EDGE */}
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= activeEdgeLimit ? "#16a34a" : edgeColor(edge), fontWeight: edge >= activeEdgeLimit ? 800 : 600, fontSize: 14 }}>
                                {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                              </td>

                              {/* BBMI PICK */}
                              <td style={{ ...TD, minWidth: 160 }}>
                                {bbmifPick ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <Link href={`/ncaaf-team/${encodeURIComponent(bbmifPick)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                                      <NCAALogo teamName={bbmifPick} size={18} />
                                      <span style={{ fontWeight: 700, fontSize: 13 }}>{bbmifPick}</span>
                                    </Link>
                                    {isLargeSpread && (
                                      <span title="Large spread (>14 pts) — model historically ~50% ATS on blowouts" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 4px", cursor: "help" }}>BLOWOUT</span>
                                    )}
                                    {g.cautionWeek && (
                                      <span title="Weeks 4-7 — limited data, model less reliable" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 4, padding: "1px 4px", cursor: "help" }}>EARLY SZN</span>
                                    )}
                                  </div>
                                ) : <span style={{ color: "#a8a29e" }}>—</span>}
                              </td>

                              {/* WIN % */}
                              <td style={{ ...TD_RIGHT, fontWeight: 600, color: winPct && winPct >= 60 ? "#16a34a" : "#57534e" }}>
                                {fmtPct(winPct)}
                              </td>
                            </>
                          ) : (
                            <>
                              {/* VEGAS O/U */}
                              <td style={TD_RIGHT}>{g.vegasTotal != null ? g.vegasTotal.toFixed(1) : "—"}</td>

                              {/* BBMI TOTAL */}
                              <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#0a1a2f" }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "—"}</td>

                              {/* EDGE */}
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= activeEdgeLimit ? "#16a34a" : edgeColor(edge), fontWeight: edge >= activeEdgeLimit ? 800 : 600, fontSize: 14 }}>
                                {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                              </td>

                              {/* O/U PICK */}
                              <td style={{ ...TD, minWidth: 100, fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: g.totalPick === "over" ? "#16a34a" : g.totalPick === "under" ? "#dc2626" : "#a8a29e" }}>
                                {g.totalPick ?? "—"}
                              </td>

                              {/* ACTUAL TOTAL */}
                              <td style={{ ...TD_RIGHT, color: "#57534e" }}>
                                {g.actualTotal != null ? g.actualTotal : "—"}
                              </td>

                              {/* RESULT */}
                              <td style={{ ...TD_RIGHT, fontSize: 16, fontWeight: 700 }}>
                                {g.totalResult == null ? "—"
                                  : g.totalPick === g.totalResult
                                    ? <span style={{ color: "#16a34a" }}>&#10003;</span>
                                    : <span style={{ color: "#dc2626" }}>&#10007;</span>}
                              </td>
                            </>
                          )}

                        </tr>
                      );
                    })}

                    {/* ── BELOW THRESHOLD ── */}
                    {belowThresholdGames.length > 0 && (
                      <tr>
                        <td colSpan={mode === "ats" ? 7 : 8} style={{ padding: 0 }}>
                          <button
                            onClick={() => setShowBelowThreshold(p => !p)}
                            style={{ width: "100%", padding: "10px 16px", border: "none", borderTop: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#64748b" }}
                          >
                            {showBelowThreshold ? "\u25B4" : "\u25BE"} All games {"\u00B7"} below model threshold ({belowThresholdGames.length})
                          </button>
                        </td>
                      </tr>
                    )}

                    {showBelowThreshold && belowThresholdGames.map((g, i) => (
                      <tr key={i + "_bt"} style={{ backgroundColor: i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)", opacity: 0.55, color: "#9ca3af" }}>
                        <td style={{ ...TD, paddingLeft: 10 }}>
                          <Link href={`/ncaaf-team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                            <NCAALogo teamName={g.awayTeam} size={20} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                          </Link>
                        </td>
                        <td style={TD}>
                          <Link href={`/ncaaf-team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                            <NCAALogo teamName={g.homeTeam} size={20} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                          </Link>
                        </td>
                        {mode === "ats" ? (
                          <>
                            <td style={TD_RIGHT}>{g._vegasLine ?? "\u2014"}</td>
                            <td style={TD_RIGHT}>{g._bbmifLine ?? "\u2014"}</td>
                            <td style={TD_RIGHT}>{g._edge > 0 ? g._edge.toFixed(1) : "\u2014"}</td>
                            <td style={{ ...TD, color: "#b0b0b0" }}>{g._bbmifPick || "\u2014"}</td>
                            <td style={TD_RIGHT}>{g.bbmifWinPct != null ? `${(g.bbmifWinPct * 100).toFixed(0)}%` : "\u2014"}</td>
                          </>
                        ) : (
                          <>
                            <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                            <td style={TD_RIGHT}>{g.bbmiTotal ?? "\u2014"}</td>
                            <td style={TD_RIGHT}>{g._edge > 0 ? g._edge.toFixed(1) : "\u2014"}</td>
                            <td style={{ ...TD, textAlign: "center", color: "#b0b0b0", textTransform: "uppercase" }}>
                              {g.totalPick === "over" ? "\u2191 Over" : g.totalPick === "under" ? "\u2193 Under" : "\u2014"}
                            </td>
                            <td style={TD_RIGHT}>{"\u2014"}</td>
                            <td style={TD_RIGHT}>{"\u2014"}</td>
                          </>
                        )}
                      </tr>
                    ))}

                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#f0f9ff" }}>
                        <td colSpan={mode === "ats" ? 7 : 8} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate vs {activeEdgeStats.overallWinPct}% overall
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#0a1a2f", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                            Unlock all picks — $15 for 7 days →
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* METHODOLOGY NOTE */}
          <div style={{ maxWidth: 720, margin: "16px auto 40px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.7 }}>
              <strong>How BBMI lines are generated:</strong> SP+ efficiency ratings, yards per play differential,
              turnover margin, home field advantage, bye week adjustments, and altitude factors.
              Lines are frozen at pipeline run time and do not change during the week.
            </p>
            <p style={{ fontSize: 12, color: "#92400e", margin: "8px 0 0 0", lineHeight: 1.7 }}>
              <strong>Betting strategy notes:</strong> The model performs best on competitive games (Vegas spread ≤ {MAX_SPREAD_FOR_RECORD} pts)
              with meaningful edge (≥ {activeEdgeLimit} pts). Blowout games and early-season weeks (4–7, limited per-team data)
              historically produce near-coin-flip results. Games flagged with{" "}
              <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 3, padding: "0px 3px" }}>BLOWOUT</span>{" "}
              or{" "}
              <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 3, padding: "0px 3px" }}>EARLY SZN</span>{" "}
              badges should be treated with extra caution.{" "}
              <Link href="/ncaaf-rankings" style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>
                View full rankings →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

export default function NCAAFPicksPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}>
        <NCAAFPicksPageContent />
      </Suspense>
    </AuthProvider>
  );
}
