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
import { MIN_EDGE as MIN_EDGE_FOR_RECORD, FREE_EDGE_LIMIT, MAX_SPREAD as MAX_SPREAD_FOR_RECORD, MAX_SPREAD_PREMIUM, OU_MIN_EDGE, OU_FREE_EDGE_LIMIT } from "@/config/ncaa-football-thresholds";

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
  // Weather data
  gameTemp?: number | null;
  gameWind?: number | null;
  gameIndoor?: boolean;
  gameConditions?: string | null;
  tempTotalAdj?: number | null;
  earlySpreadAdj?: number | null;
  // Prediction confidence
  confidenceScore?: number | null;
  confidenceTier?: string | null;
  confidenceFlags?: string[] | null;
  betMultiplier?: number | null;
  homeLetdown?: boolean;
  awayLetdown?: boolean;
  homeLookAhead?: boolean;
  awayLookAhead?: boolean;
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
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#6b7280", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
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
      backgroundColor: "#6b7280", color: "#ffffff",
      padding: "6px 7px", textAlign: align,
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
      borderBottom: "1px solid rgba(255,255,255,0.2)",
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
    <tr style={{ backgroundColor: "#f0f1f3" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>{"\uD83D\uDD12"}</span>
            <span style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 700 }}>High-edge pick {"\u2014"} Edge {"\u2265"} {edgeLimit} pts</span>
            <span style={{ fontSize: "0.72rem", color: "#555" }}>
              These picks are <strong style={{ color: "#6b7280" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button onClick={onSubscribe} style={{ backgroundColor: "#6b7280", color: "#ffffff", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
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
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#6b7280", margin: "0 0 0.4rem" }}>Unlock High-Edge Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge ≥ {edgeLimit} pts — where the model is most accurate</p>
        </div>
        <div style={{ backgroundColor: "#6b7280", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>{highEdgeWinPct}%</div>
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
        <div style={{ backgroundColor: "#f0f1f3", border: "1px solid #d4d2cc", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.68rem", color: "#4b5563", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>ℹ️ Methodology:</strong> The overall rate excludes games where BBMI and Vegas lines differ by less than {MIN_EDGE_FOR_RECORD} points. A difference smaller than {MIN_EDGE_FOR_RECORD} pts is within normal book-to-book line variation and does not represent a meaningful BBMI disagreement with Vegas.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$10</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>One-time · No auto-renewal</div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02" style={{ display: "block", backgroundColor: "#6b7280", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Try 7 Days →</a>
          </div>
          <div style={{ border: "2px solid #2563eb", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#eff6ff", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "0.15rem 0.6rem", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>MOST POPULAR</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$35</div>
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
  if (edge >= 7) return "#6b7280";
  if (edge >= 5) return "#65a30d";
  if (edge >= 3) return "#ca8a04";
  return "#78716c";
}

// ------------------------------------------------------------
// CONFIDENCE HELPERS
// ------------------------------------------------------------

const CONFIDENCE_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  high:     { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", label: "HIGH" },
  medium:   { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "MEDIUM" },
  low:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca", label: "CAUTION" },
  very_low: { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5", label: "LOW CONF" },
};

const CONFIDENCE_FLAG_LABELS: Record<string, string> = {
  early_season_wk1_2: "Early Season (Wk 1-2)",
  early_season_wk3_5: "Early Season (Wk 3-5)",
  freezing: "Freezing Weather",
  very_cold: "Cold Weather",
  very_hot: "Extreme Heat",
  high_wind: "High Wind",
  heavy_precip: "Precipitation",
  letdown: "Letdown Spot",
  look_ahead: "Look-Ahead Spot",
  cold_climate_early: "Cold-Climate Away",
  prior_great_season: "Coach Coming Off 10+ Win Season",
  extreme_3rd_down: "Extreme 3rd Down Rate",
  huge_spread: "Huge Spread (21+)",
  large_spread: "Large Spread (14+)",
  no_data_home: "Limited Home Data",
  no_data_away: "Limited Away Data",
};

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
    const highEdge = allBets.filter((g) =>
      Math.abs((g._bbmifLine ?? 0) - (g._vegasLine ?? 0)) >= FREE_EDGE_LIMIT &&
      Math.abs(g._vegasLine ?? 0) <= MAX_SPREAD_PREMIUM
    );
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
      { name: "6\u20139 pts",  min: 6,  max: 9 },
      { name: "9\u201312 pts", min: 9,  max: 12 },
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

  // ── O/U parallel stats (no min edge — O/U is display-only) ─
  const ouEdgeStats = useMemo(() => {
    const allBets = historicalGames.filter(
      (g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null
    );
    const allWins = allBets.filter((g) => g.totalPick === g.totalResult).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";
    const highEdge = allBets.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) >= OU_FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => g.totalPick === g.totalResult).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const freeEdge = allBets.filter((g) => Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0)) < OU_FREE_EDGE_LIMIT);
    const freeEdgeWins = freeEdge.filter((g) => g.totalPick === g.totalResult).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length, freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  const ouHistoricalStats = useMemo(() => {
    const allBets = historicalGames.filter(
      (g) => g.vegasTotal != null && g.bbmiTotal != null && g.totalPick != null && g.actualTotal != null && g.totalResult != null
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
  const activeEdgeLimit = mode === "ats" ? FREE_EDGE_LIMIT : OU_FREE_EDGE_LIMIT;

  // ── Sort / Filter ──────────────────────────────────────────
  const atsEdgeOptions = [
    { label: "All Games", min: 0,  max: Infinity },
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

  // Free preview: top 2 premium picks (highest edge) visible to all users
  const FREE_PREVIEW_COUNT = 2;
  const premiumGames = useMemo(() =>
    recommendedGames
      .filter(g => g._edge >= activeEdgeLimit)
      .sort((a, b) => b._edge - a._edge),
    [recommendedGames, activeEdgeLimit]
  );
  const freePreviewIds = useMemo(() => {
    if (mode === "ou") return new Set<number>();
    return new Set(premiumGames.slice(0, FREE_PREVIEW_COUNT).map((_, i) => i));
  }, [premiumGames, mode]);
  // Track which premium games are free previews by matching
  const freePreviewKeys = useMemo(() => {
    const keys = new Set<string>();
    premiumGames.slice(0, FREE_PREVIEW_COUNT).forEach(g => {
      keys.add(`${g.awayTeam}|${g.homeTeam}|${g.gameDate}`);
    });
    return keys;
  }, [premiumGames]);

  const recLabel = mode === "ou"
    ? `${recommendedGames.filter(g => (g.bbmiTotal ?? 0) < (g.vegasTotal ?? 0)).length} under, ${recommendedGames.filter(g => (g.bbmiTotal ?? 0) > (g.vegasTotal ?? 0)).length} over`
    : `${recommendedGames.length} spread picks`;

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const lockedCount = mode === "ats"
    ? premiumGames.length - Math.min(FREE_PREVIEW_COUNT, premiumGames.length)
    : 0;

  // ── Table cell styles ──────────────────────────────────────
  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={activeEdgeStats.highEdgeWinPct} highEdgeTotal={activeEdgeStats.highEdgeTotal} overallWinPct={activeEdgeStats.overallWinPct} edgeLimit={activeEdgeLimit} />}

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#6b7280", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NCAA Football {"\u00B7"} Updated Daily
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 14px" }}>
              Today&apos;s Game Lines
            </h1>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {(["ats", "ou"] as const).map((m) => (
                <button key={m} onClick={() => { setMode(m); setEdgeOption(m === "ou" ? ouEdgeOptions[0] : atsEdgeOptions[0]); }} style={{
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

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 1100, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: mode === "ou" ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            {mode === "ats" ? (
              [
                { value: `${activeEdgeStats.highEdgeWinPct}%`, label: "Premium ATS", sub: `edge \u2265 ${activeEdgeLimit} pts`, premium: true },
                { value: `${activeEdgeStats.highEdgeTotal}+`, label: "Picks Per Season", sub: `~${Math.round(activeEdgeStats.highEdgeTotal / 15)} per week`, premium: false },
                { value: `+${activeHistoricalStats.roi}%`, label: "ROI at -110", sub: "walk-forward validated", premium: false },
              ].map((card) => (
                <div key={card.label} style={{ background: card.premium ? "#f0f1f3" : "#ffffff", border: card.premium ? "2px solid #6b7280" : "1px solid #d4d2cc", borderTop: "4px solid #6b7280", borderRadius: 10, padding: "14px 14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: card.premium ? 28 : 24, fontWeight: card.premium ? 700 : 500, color: "#6b7280", lineHeight: 1.1 }}>{card.value}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: card.premium ? "#6b7280" : "#777", margin: "4px 0 3px" }}>{card.label}</div>
                  <div style={{ fontSize: "0.63rem", color: "#666" }}>{card.sub}</div>
                </div>
              ))
            ) : (
              <div style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderTop: "4px solid #6b7280", borderRadius: 10, padding: "14px 14px 12px", textAlign: "center", maxWidth: 360, margin: "0 auto" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#6b7280", lineHeight: 1.1 }}>{activeHistoricalStats.winPct}%</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#777", margin: "4px 0 3px" }}>All Picks O/U</div>
                <div style={{ fontSize: "0.63rem", color: "#666" }}>{activeHistoricalStats.total.toLocaleString()} games (display-only)</div>
              </div>
            )}
          </div>

          {/* STATS METHODOLOGY NOTE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              {mode === "ats" ? (
                <>
                  † Record includes only games where BBMI and Vegas lines differ by ≥ {FREE_EDGE_LIMIT} points and Vegas spread ≤ {MAX_SPREAD_FOR_RECORD} pts ({activeEdgeStats.highEdgeTotal.toLocaleString()} games).
                  Walk-forward validated across 2 independent seasons (2024 + 2025) with 0.0pt overfitting gap.{" "}
                </>
              ) : (
                <>
                  † O/U record includes all {activeHistoricalStats.total.toLocaleString()} games where BBMI projected a total and Vegas set an over/under line.
                  O/U totals are display-only — walk-forward validation showed 53.2% across two seasons, not consistent enough for recommended picks.{" "}
                </>
              )}
              <Link href="/ncaaf-model-accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View full public log →</Link>
            </p>
          </div>

          {/* HIGH EDGE CALLOUT */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#f0f1f3", borderRadius: 6, borderLeft: "4px solid #6b7280", border: "1px solid #e7e5e4", borderLeftWidth: 4, borderLeftColor: "#6b7280", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#6b7280", lineHeight: 1 }}>{activeEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "#78716c" }}>win rate on picks with edge {"\u2265"} {activeEdgeLimit} pts</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#888", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "#78716c" }}>{activeEdgeStats.overallWinPct}%</strong> overall {"\u00B7"} documented across <strong style={{ color: "#78716c" }}>{activeEdgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#6b7280", fontWeight: 700 }}>{"\uD83D\uDD12"} {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked today</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#6b7280", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $10 →
                </button>
              </div>
            </div>
          )}

          {/* EDGE PERFORMANCE GRAPH */}
          {/* EdgePerformanceGraph expects bbmiHomeLine/vegasHomeLine/fakeBet/fakeWin.
              Remap football-games.json field names accordingly. */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #d4d2cc", padding: "1.5rem" }}>
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
                { name: "0\u20131 pts",  min: 0,  max: 1,        color: "#b0b8c4", width: 1.0  },
                { name: "1\u20132 pts",  min: 1,  max: 2,        color: "#7a9bbf", width: 1.25 },
                { name: "2\u20133 pts",  min: 2,  max: 3,        color: "#c4956a", width: 1.75 },
                { name: "3+ pts",        min: 3,  max: Infinity,  color: "#3b7a57", width: 2.5  },
              ] : [
                { name: "6\u20139 pts",  min: 6,  max: 9,        color: "#7a9bbf", width: 1.5  },
                { name: "9\u201312 pts", min: 9,  max: 12,       color: "#c4956a", width: 2.0  },
                { name: "12+ pts",       min: 12, max: Infinity,  color: "#3b7a57", width: 2.5  },
              ]}
              mode={mode}
            />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Historical Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "Win %", "95% CI", "ROI"].map((h) => (
                      <th key={h} style={{ backgroundColor: "#6b7280", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeEdgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.games.toLocaleString()}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: Number(stat.winPct) > 50 ? "#6b7280" : "#dc2626" }}>{stat.winPct}%</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "center", color: "#78716c", fontStyle: "italic", whiteSpace: "nowrap" }}>
                        {stat.ciLow.toFixed(1)}%–{stat.ciHigh.toFixed(1)}%
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.roiPositive ? "#6b7280" : "#dc2626" }}>{stat.roi}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#f5f3ef", borderTop: "1px solid #f5f5f4" }}>
                      {mode === "ats"
                        ? `Includes only picks where edge \u2265 ${FREE_EDGE_LIMIT} pts and Vegas spread \u2264 ${MAX_SPREAD_FOR_RECORD} pts \u00B7 95% CI uses Wilson score method.`
                        : "Includes all O/U games (display-only) \u00B7 95% CI uses Wilson score method."
                      }
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#f0f1f3", borderLeft: "4px solid #6b7280", border: "1px solid #d4d2cc", borderLeftWidth: 4, borderLeftColor: "#6b7280", borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#4b5563", margin: 0 }}>
              {mode === "ats" ? (
                <>
                  <strong>How to use this page:</strong> The model{"\u2019"}s {FREE_PREVIEW_COUNT} highest-conviction picks are shown free each week.{" "}
                  {!isPremium && <span>Subscribe to unlock <strong>all {activeEdgeStats.highEdgeTotal} premium picks</strong> (edge ≥ {activeEdgeLimit} pts) — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate.</span>}
                  {isPremium && <span>You have full access to all picks — use the edge filter to focus on the model&apos;s strongest picks.</span>}
                </>
              ) : (
                <><strong>O/U totals are display-only.</strong> The model projects totals for context but does not generate recommended O/U picks. Use the ATS tab for validated spread picks.</>
              )}
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
                      border: isActive ? "2px solid #6b7280" : "1px solid #c0bdb5",
                      backgroundColor: isActive ? "#6b7280" : "#ffffff",
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
                {mode === "ats" ? (
                  <>
                    {FREE_PREVIEW_COUNT} free preview picks shown. {lockedCount > 0 && `${lockedCount} more premium picks available. `}
                    <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                      Subscribe to unlock all picks →
                    </button>
                  </>
                ) : (
                  <>O/U totals are display-only — all projections shown.</>
                )}
              </p>
            )}
          </div>

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
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
                        <td colSpan={mode === "ats" ? 7 : 8} style={{ padding: "10px 16px", background: "#f0f1f3", borderTop: "3px solid #6b7280", borderBottom: "1px solid #d4d2cc" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>
                            {"\u2714"} Recommended picks {"\u00B7"} {recLabel}
                          </span>
                        </td>
                      </tr>
                    )}

                    {recommendedGames.map((g, i) => {
                      const edge = g._edge;
                      const bbmifPick = g._bbmifPick;
                      const isBelowMinEdge = edge < MIN_EDGE_FOR_RECORD;
                      const isPremiumPick = mode === "ats" && edge >= activeEdgeLimit;
                      const isFreePreview = isPremiumPick && freePreviewKeys.has(`${g.awayTeam}|${g.homeTeam}|${g.gameDate}`);
                      const isLocked = !isPremium && isPremiumPick && !isFreePreview;

                      if (isLocked) {
                        return <LockedRowOverlay key={i} colSpan={mode === "ats" ? 7 : 8} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} edgeLimit={activeEdgeLimit} />;
                      }

                      const rowBg = isBelowMinEdge
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb");
                      const rowOpacity = isBelowMinEdge ? 0.55 : 1;
                      const rowColor = isBelowMinEdge ? "#9ca3af" : undefined;

                      const winPct = g.bbmifWinPct;
                      const isLargeSpread = g.largeSpread || (Math.abs(g._vegasLine ?? 0) > MAX_SPREAD_FOR_RECORD);

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg, opacity: rowOpacity, color: rowColor }}>

                          {/* AWAY */}
                          <td style={{ ...TD, minWidth: 180, paddingLeft: 16 }}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280" }} className="hover:underline">
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
                                {g.awayLetdown && (
                                  <span title="Away team won by 14+ last week against a weaker opponent — letdown spot" style={{ fontSize: 9, color: "#d97706" }}>Letdown spot</span>
                                )}
                                {g.awayLookAhead && (
                                  <span title="Away team faces a strong opponent next week — look-ahead spot" style={{ fontSize: 9, color: "#7c3aed" }}>Look-ahead</span>
                                )}
                              </div>
                            </Link>
                          </td>

                          {/* HOME */}
                          <td style={{ ...TD, minWidth: 180 }}>
                            <Link href={`/ncaaf-team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#6b7280" }} className="hover:underline">
                              <NCAALogo teamName={g.homeTeam} size={22} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>
                                  {g.homeRank && g.homeRank <= 25 && (
                                    <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 3 }}>#{g.homeRank}</span>
                                  )}
                                  {g.homeTeam}
                                </span>
                                <div style={{ fontSize: 9, color: "#94a3b8", display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {g.neutralSite ? "(N) " : ""}
                                  {g.byeWeekHome ? "💤 Bye " : ""}
                                  {(g.altitudeAdj ?? 0) > 0 ? "🏔️ " : ""}
                                  {g.gameIndoor ? "🏟️ Dome" : g.gameTemp != null ? (
                                    <span style={{ color: (g.gameTemp ?? 70) < 40 ? "#3b82f6" : (g.gameTemp ?? 70) > 85 ? "#ef4444" : "#94a3b8" }}>
                                      {Math.round(g.gameTemp ?? 0)}{"\u00B0"}F
                                      {g.gameWind != null && g.gameWind > 10 ? ` ${Math.round(g.gameWind)}mph` : ""}
                                    </span>
                                  ) : ""}
                                  {g.homeLetdown && (
                                    <span title="Home team won by 14+ last week against a weaker opponent — letdown spot" style={{ color: "#d97706" }}>Letdown spot</span>
                                  )}
                                  {g.homeLookAhead && (
                                    <span title="Home team faces a strong opponent next week — look-ahead spot" style={{ color: "#7c3aed" }}>Look-ahead</span>
                                  )}
                                </div>
                              </div>
                            </Link>
                          </td>

                          {mode === "ats" ? (
                            <>
                              {/* VEGAS LINE */}
                              <td style={TD_RIGHT}>{fmtLine(g._vegasLine)}</td>

                              {/* BBMI LINE */}
                              <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#6b7280" }}>{fmtLine(g._bbmifLine)}</td>

                              {/* EDGE */}
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= activeEdgeLimit ? "#6b7280" : edgeColor(edge), fontWeight: edge >= activeEdgeLimit ? 800 : 600, fontSize: 14 }}>
                                {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                              </td>

                              {/* BBMI PICK */}
                              <td style={{ ...TD, minWidth: 160 }}>
                                {bbmifPick ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                    <Link href={`/ncaaf-team/${encodeURIComponent(bbmifPick)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280" }} className="hover:underline">
                                      <NCAALogo teamName={bbmifPick} size={18} />
                                      <span style={{ fontWeight: 700, fontSize: 13 }}>{bbmifPick}</span>
                                    </Link>
                                    {isFreePreview && !isPremium && (
                                      <span style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#ecfdf5", color: "#059669", border: "1px solid #6ee7b7", borderRadius: 4, padding: "1px 4px" }}>FREE PREVIEW</span>
                                    )}
                                    {isLargeSpread && (
                                      <span title="Large spread (>21 pts) — blowout territory" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 4px", cursor: "help" }}>BLOWOUT</span>
                                    )}
                                    {g.cautionWeek && (
                                      <span title="Weeks 4-7 — limited data, model less reliable" style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#fffbeb", color: "#d97706", border: "1px solid #fde68a", borderRadius: 4, padding: "1px 4px", cursor: "help" }}>EARLY SZN</span>
                                    )}
                                    {g.earlySpreadAdj != null && g.earlySpreadAdj !== 0 && (
                                      <span title={`Early-season spread adjustment: ${g.earlySpreadAdj} pts (model penalizes away team in weeks 1-5)`} style={{ fontSize: 9, fontWeight: 700, backgroundColor: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 4, padding: "1px 4px", cursor: "help" }}>
                                        ADJ {g.earlySpreadAdj > 0 ? "+" : ""}{g.earlySpreadAdj}
                                      </span>
                                    )}
                                    {g.confidenceTier != null && g.confidenceTier !== "high" && (() => {
                                      const cs = CONFIDENCE_STYLES[g.confidenceTier!] ?? CONFIDENCE_STYLES.medium;
                                      const flagDescs = (g.confidenceFlags ?? [])
                                        .map((f: string) => CONFIDENCE_FLAG_LABELS[f] ?? f)
                                        .join(", ");
                                      return (
                                        <span
                                          title={`Confidence: ${g.confidenceScore}/100 — ${flagDescs || "reduced confidence"}`}
                                          style={{ fontSize: 9, fontWeight: 700, backgroundColor: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, borderRadius: 4, padding: "1px 4px", cursor: "help" }}
                                        >
                                          {cs.label} {g.confidenceScore}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                ) : <span style={{ color: "#a8a29e" }}>—</span>}
                              </td>

                              {/* WIN % */}
                              <td style={{ ...TD_RIGHT, fontWeight: 600, color: winPct && winPct >= 60 ? "#6b7280" : "#57534e" }}>
                                {fmtPct(winPct)}
                              </td>
                            </>
                          ) : (
                            <>
                              {/* VEGAS O/U */}
                              <td style={TD_RIGHT}>{g.vegasTotal != null ? g.vegasTotal.toFixed(1) : "—"}</td>

                              {/* BBMI TOTAL */}
                              <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#6b7280" }}>
                                {g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "—"}
                                {g.tempTotalAdj != null && g.tempTotalAdj !== 0 && (
                                  <span title={`Temperature adjustment: ${g.tempTotalAdj > 0 ? "+" : ""}${g.tempTotalAdj} pts (${Math.round(g.gameTemp ?? 0)}°F)`} style={{ fontSize: 8, color: g.tempTotalAdj < 0 ? "#3b82f6" : "#ef4444", marginLeft: 3, cursor: "help" }}>
                                    {g.tempTotalAdj > 0 ? "+" : ""}{g.tempTotalAdj}
                                  </span>
                                )}
                              </td>

                              {/* EDGE */}
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= activeEdgeLimit ? "#6b7280" : edgeColor(edge), fontWeight: edge >= activeEdgeLimit ? 800 : 600, fontSize: 14 }}>
                                {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                              </td>

                              {/* O/U PICK */}
                              <td style={{ ...TD, minWidth: 100 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: g.totalPick === "over" ? "#6b7280" : g.totalPick === "under" ? "#dc2626" : "#a8a29e" }}>
                                    {g.totalPick ?? "—"}
                                  </span>
                                  {g.confidenceTier != null && g.confidenceTier !== "high" && (() => {
                                    const cs = CONFIDENCE_STYLES[g.confidenceTier!] ?? CONFIDENCE_STYLES.medium;
                                    const flagDescs = (g.confidenceFlags ?? [])
                                      .map((f: string) => CONFIDENCE_FLAG_LABELS[f] ?? f)
                                      .join(", ");
                                    return (
                                      <span
                                        title={`Confidence: ${g.confidenceScore}/100 — ${flagDescs || "reduced confidence"}`}
                                        style={{ fontSize: 9, fontWeight: 700, backgroundColor: cs.bg, color: cs.color, border: `1px solid ${cs.border}`, borderRadius: 4, padding: "1px 4px", cursor: "help" }}
                                      >
                                        {cs.label} {g.confidenceScore}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </td>

                              {/* ACTUAL TOTAL */}
                              <td style={{ ...TD_RIGHT, color: "#57534e" }}>
                                {g.actualTotal != null ? g.actualTotal : "—"}
                              </td>

                              {/* RESULT */}
                              <td style={{ ...TD_RIGHT, fontSize: 16, fontWeight: 700 }}>
                                {g.totalResult == null ? "—"
                                  : g.totalPick === g.totalResult
                                    ? <span style={{ color: "#6b7280" }}>&#10003;</span>
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
                            style={{ width: "100%", padding: "10px 16px", border: "none", borderTop: "2px solid #d4d2cc", background: "#f0f1f3", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#555555" }}
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
                      <tr style={{ backgroundColor: "#f0f1f3" }}>
                        <td colSpan={mode === "ats" ? 7 : 8} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#4b5563", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate vs {activeEdgeStats.overallWinPct}% overall
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#6b7280", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                            Unlock all picks — $10 for 7 days →
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
              {mode === "ats" ? (
                <>
                  <strong>How BBMI lines are generated:</strong> SP+ efficiency ratings, yards per play differential,
                  turnover margin, home field advantage, bye week adjustments, and altitude factors.
                  Lines are frozen at pipeline run time and do not change during the week.
                </>
              ) : (
                <>
                  <strong>How BBMI totals are generated:</strong> The model independently projects each team{"\u2019"}s expected scoring
                  based on offensive and defensive efficiency. The displayed total is a fully independent BBMI projection — not blended with Vegas.
                </>
              )}
            </p>
            <p style={{ fontSize: 12, color: "#92400e", margin: "8px 0 0 0", lineHeight: 1.7 }}>
              {mode === "ats" ? (
                <>
                  <strong>Betting strategy notes:</strong> The model performs best on competitive games (Vegas spread ≤ {MAX_SPREAD_PREMIUM} pts)
                  with meaningful edge (≥ {activeEdgeLimit} pts). Walk-forward validation showed consistent profitability
                  across all phases of the season, including early weeks (SP+ preseason ratings are highly predictive).
                  Games with Vegas spreads above {MAX_SPREAD_FOR_RECORD} pts are excluded — blowout mismatches produce
                  near-coin-flip ATS results regardless of model edge.{" "}
                </>
              ) : (
                <>
                  <strong>Note:</strong> O/U totals are display-only. Walk-forward validation showed 53.2% ATS across two seasons —
                  above breakeven but not consistent enough to qualify as recommended picks. Use the ATS tab for the validated spread product.{" "}
                </>
              )}
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
