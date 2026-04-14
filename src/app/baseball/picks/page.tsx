"use client";

import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import games from "@/data/betting-lines/baseball-games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import { AuthProvider, useAuth } from "../../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase-config";
import { MIN_EDGE as MIN_EDGE_FOR_RECORD, FREE_EDGE_LIMIT, MAX_EDGE as MAX_EDGE_FOR_RECORD, JUICE, OU_MAX_EDGE } from "@/config/ncaa-baseball-thresholds";

// Baseball edge categories for EdgePerformanceGraph
const BASEBALL_EDGE_CATEGORIES = [
  { name: "1\u20132 runs", min: 1, max: 2,        color: "#b0b8c4", width: 1.25 },
  { name: "2\u20133 runs", min: 2, max: 3,        color: "#7a9bbf", width: 1.75 },
  { name: "3\u20134 runs", min: 3, max: 4,        color: "#3b7a57", width: 2.5  },
];

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

// Standard -110 juice: win $90.91 on $100 bet, lose $100
function calcROI(wins: number, losses: number): string {
  const total = wins + losses;
  if (total === 0) return "0.0";
  const profitPerWin = 100 / (JUICE / -100);  // 90.91 at -110
  const profit = wins * profitPerWin - losses * 100;
  return (profit / (total * 100) * 100).toFixed(1);
}

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

function mlToProb(ml: number | null): number | null {
  if (ml == null) return null;
  if (ml > 1 && ml < 100) return 1 / ml;
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100);
  if (ml > 0) return 100 / (ml + 100);
  return 0.5;
}

function seriesLabel(pos: number): string {
  if (pos === 1) return "G1";
  if (pos === 2) return "G2";
  if (pos === 3) return "G3";
  return "MW";
}

// ────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────

type BaseballGame = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  homePitcher: string;
  awayPitcher: string;
  pitcherConfirmed: boolean;
  seriesGame: number;
  bbmiHomeProj: number | null;
  bbmiAwayProj: number | null;
  bbmiLine: number | null;
  bbmiTotal: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  bbmiMoneylineHome: number | null;
  bbmiMoneylineAway: number | null;
  vegasLine: number | null;
  vegasTotal: number | null;
  vegasOpeningLine: number | null;
  vegasOpeningTotal: number | null;
  lineMovement: number | null;
  totalMovement: number | null;
  edge: number | null;
  homeML: number | null;
  awayML: number | null;
  vegasWinProb: number | null;
  parkFactor: number;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  conference: string;
  isNeutralSite: boolean;
  modelMaturity: string;
  confidenceFlag: string;
  windSpeed: number | null;
  windDir: string;
  ouPick: string | null;
  ouEdge: number | null;
};

type SortKey =
  | "edge" | "date" | "away" | "home"
  | "vegasLine" | "bbmiLine" | "bbmiPick"
  | "homeWinPct" | "vegasWinProb"
  | "bbmiTotal" | "vegasTotal";

// ────────────────────────────────────────────────────────────────
// ESPN LIVE SCORES
// ────────────────────────────────────────────────────────────────

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
  startTime: string | null;
  inning: number | null;
  inningHalf: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ESPN shortDisplayName → our canonical team name
const ESPN_SHORT_MAP: Record<string, string> = {
  "fdu": "fairleigh dickinson", "st john's": "saint john's", "st. john's": "saint john's",
  "michigan st": "michigan state", "c michigan": "central michigan", "w michigan": "western michigan",
  "e michigan": "eastern michigan", "n illinois": "northern illinois", "s illinois": "southern illinois",
  "etsu": "east tennessee state", "unc greensboro": "unc greensboro",
  "mtsu": "middle tennessee", "utsa": "ut san antonio", "utep": "utep",
  "fau": "florida atlantic", "fiu": "florida international", "ucf": "ucf",
  "lsu": "lsu", "tcu": "tcu", "smu": "smu", "usc": "usc", "byu": "byu",
  "uab": "uab", "unlv": "unlv", "utrgv": "ut rio grande valley",
  "vcu": "vcu", "unc": "north carolina", "ole miss": "mississippi",
  "miami (oh)": "miami ohio", "miami (fl)": "miami",
  "pitt": "pittsburgh", "uconn": "connecticut", "umass": "massachusetts",
  "app state": "appalachian state", "ark state": "arkansas state",
  "ga southern": "georgia southern", "ga state": "georgia state",
  "la tech": "louisiana tech", "n kentucky": "northern kentucky",
  "s alabama": "south alabama", "s carolina": "south carolina",
  "n carolina": "north carolina", "w virginia": "west virginia",
  "oklahoma st": "oklahoma state", "oregon st": "oregon state",
  "kansas st": "kansas state", "miss state": "mississippi state",
  "kennesaw st": "kennesaw state", "wright st": "wright state",
  "kent st": "kent state", "fresno st": "fresno state",
  "san jose st": "san jose state", "boise st": "boise state",
  "colorado st": "colorado state", "utah st": "utah state",
  "arizona st": "arizona state", "washington st": "washington state",
  "arkansas st": "arkansas state", "ball st": "ball state",
  "nc state": "north carolina state", "penn st": "penn state",
  "sam houston": "sam houston state", "fgcu": "fgcu",
  "ucsb": "uc santa barbara", "uc davis": "uc davis",
  "cal poly": "cal poly", "cal st fullerton": "cal state fullerton",
  "missouri st": "missouri state", "wichita st": "wichita state",
  "mcneese": "mcneese state", "se missouri st": "southeast missouri",
  "sfa": "stephen f austin", "nw state": "northwestern state",
  "la monroe": "louisiana monroe", "la lafayette": "louisiana",
};

function normalizeForMatch(name: string): string {
  const n = norm(name);
  return ESPN_SHORT_MAP[n] ?? n;
}

function stripMascot(name: string): string {
  const NO_STRIP = new Set([
    "iowa state","michigan state","ohio state","florida state","kansas state",
    "penn state","utah state","fresno state","san jose state","boise state",
    "colorado state","kent state","ball state","north carolina state",
    "mississippi state","washington state","oregon state","arizona state",
    "oklahoma state","texas state","arkansas state","mcneese state",
    "texas tech","georgia tech","virginia tech","louisiana tech",
    "texas am","boston college","air force","wake forest","holy cross",
    "mount st marys","sam houston state","grand canyon","central michigan",
    "eastern michigan","western michigan","northern illinois","southern illinois",
    "middle tennessee","east carolina","south carolina","north carolina",
    "west virginia","south florida","south alabama","north alabama",
  ]);
  const n = norm(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const withoutLast = words.slice(0, -1).join(" ");
  if (NO_STRIP.has(withoutLast)) return withoutLast;
  if (words.length > 2) {
    const withoutTwo = words.slice(0, -2).join(" ");
    if (NO_STRIP.has(withoutTwo)) return withoutTwo;
    if (withoutTwo.length > 2) {
      const twoWord = words.slice(-2).join(" ");
      const MULTI = ["golden eagles","yellow jackets","crimson tide","red raiders",
        "tar heels","sun devils","horned frogs","golden bears","red wolves",
        "golden gophers","nittany lions"];
      if (MULTI.includes(twoWord)) return withoutTwo;
    }
  }
  return words.length > 1 ? withoutLast : n;
}

function getEspnBaseballDates(): string[] {
  const ctNow = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const ctDate = ctNow.replace(/-/g, "");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const utcTomorrow = tomorrow.toISOString().slice(0, 10).replace(/-/g, "");
  const dates = [ctDate];
  if (utcTomorrow !== ctDate) dates.push(utcTomorrow);
  return dates;
}

async function fetchEspnBaseballScores(): Promise<Map<string, LiveGame>> {
  const map = new Map<string, LiveGame>();
  const dates = getEspnBaseballDates();

  for (const dateStr of dates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=200`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();

      for (const event of data.events ?? []) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        const awayC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "away");
        const homeC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "home");
        if (!awayC || !homeC) continue;

        const st = comp.status ?? event.status ?? {};
        const sid = st?.type?.id ?? "1";
        const status: GameStatus = sid === "2" || sid === "22" || sid === "23" ? "in" : sid === "3" ? "post" : "pre";

        let statusDisplay = st?.type?.description ?? "";
        const inning = st?.period ?? null;
        let inningHalf: string | null = null;
        if (status === "in") {
          const half = st?.type?.id === "22" ? "Mid" : st?.type?.id === "23" ? "End" : "Top";
          inningHalf = half;
          statusDisplay = sid === "23" ? `${half} ${inning}` : `${st?.displayClock ?? ""} Inn ${inning}`.trim();
        }

        const lg: LiveGame = {
          awayScore: awayC.score != null ? parseInt(awayC.score, 10) : null,
          homeScore: homeC.score != null ? parseInt(homeC.score, 10) : null,
          status, statusDisplay,
          espnAwayAbbrev: awayC.team?.abbreviation ?? "",
          espnHomeAbbrev: homeC.team?.abbreviation ?? "",
          startTime: event.date ?? null,
          inning: inning != null ? Number(inning) : null,
          inningHalf,
        };

        const aN = stripMascot(awayC.team?.displayName ?? "");
        const hN = stripMascot(homeC.team?.displayName ?? "");
        // Also index by short display name for abbreviation matching
        const aSN = normalizeForMatch(awayC.team?.shortDisplayName ?? "");
        const hSN = normalizeForMatch(homeC.team?.shortDisplayName ?? "");
        if (!map.has(`${aN}|${hN}`)) {
          map.set(`${aN}|${hN}`, lg);
          // Index by short names too
          if (aSN !== aN || hSN !== hN) map.set(`${aSN}|${hSN}`, lg);
          for (const fk of [`away:${aN}`, `home:${hN}`, `away:${aSN}`, `home:${hSN}`]) {
            if (!map.has(fk)) map.set(fk, lg);
          }
        }
      }
    } catch { /* silent */ }
  }
  return map;
}

function useLiveScores() {
  const [liveScores, setLiveScores] = useState<Map<string, LiveGame>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await fetchEspnBaseballScores();
      setLiveScores(m);
      setLastUpdated(new Date());
      const hasLive = Array.from(m.values()).some(g => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch {
      timerRef.current = setTimeout(load, 120_000);
    } finally { setLiveLoading(false); }
  }, []);

  useEffect(() => { load(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [load]);

  const getLive = useCallback((away: string, home: string): LiveGame | undefined => {
    const a = stripMascot(away), h = stripMascot(home);
    const aN = normalizeForMatch(away), hN = normalizeForMatch(home);
    return liveScores.get(`${a}|${h}`)
      ?? liveScores.get(`${aN}|${hN}`)
      ?? liveScores.get(`away:${a}`) ?? liveScores.get(`away:${aN}`)
      ?? liveScores.get(`home:${h}`) ?? liveScores.get(`home:${hN}`);
  }, [liveScores]);

  return { getLive, lastUpdated, liveLoading };
}

// ────────────────────────────────────────────────────────────────
// LIVE SCORE BADGE
// ────────────────────────────────────────────────────────────────

function LiveScoreBadge({ lg, away, home, bbmiPick, vegasLine, mode = "ats", bbmiTotal, vegasTotal, ouPick }: {
  lg: LiveGame | undefined; away: string; home: string; bbmiPick?: string; vegasLine?: number | null;
  mode?: "ats" | "ou"; bbmiTotal?: number | null; vegasTotal?: number | null; ouPick?: string | null;
}) {
  if (!lg || lg.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = lg;
  const hasScores = awayScore != null && homeScore != null;
  const isLive = status === "in";

  let bbmiLeading: boolean | null = null;
  if (mode === "ou") {
    if (hasScores && ouPick && vegasTotal != null) {
      const call = ouPick.toLowerCase();
      const actual = awayScore! + homeScore!;

      if (isLive && lg.inning) {
        // Live — use estimated pace total, not raw score
        const halfInning = lg.inningHalf;
        const completedInnings = (halfInning === "Top" || halfInning === "Mid") ? Math.max(lg.inning - 1, 0.5) : lg.inning;
        const estTotal = completedInnings > 0 ? actual * 9 / completedInnings : actual;

        if (call === "under") {
          if (estTotal < vegasTotal - 0.5) bbmiLeading = true;
          else if (estTotal > vegasTotal + 0.5) bbmiLeading = false;
          else bbmiLeading = null;
        } else {
          if (estTotal > vegasTotal + 0.5) bbmiLeading = true;
          else if (estTotal < vegasTotal - 0.5) bbmiLeading = false;
          else bbmiLeading = null;
        }
      } else {
        // Final — use actual total
        if (actual === vegasTotal) bbmiLeading = null;
        else { const went = actual > vegasTotal ? "over" : "under"; bbmiLeading = call === went; }
      }
    }
  } else {
    const pickIsHome = bbmiPick ? stripMascot(bbmiPick) === stripMascot(home) : false;
    if (hasScores && bbmiPick && vegasLine != null) {
      const margin = homeScore! - awayScore!;
      const homeCovers = margin > -vegasLine;
      if (margin === -vegasLine) bbmiLeading = null;
      else bbmiLeading = pickIsHome ? homeCovers : !homeCovers;
    }
  }

  const bgColor = bbmiLeading === true ? "#f0fdf4" : bbmiLeading === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiLeading === true ? "#86efac" : bbmiLeading === false ? "#fca5a5" : "#e2e8f0";
  const dotColor = bbmiLeading === true ? "#1a7a8a" : bbmiLeading === false ? "#dc2626" : "#94a3b8";
  const statusColor = bbmiLeading === true ? "#15803d" : bbmiLeading === false ? "#b91c1c" : "#64748b";
  const isPost = status === "post";
  const bbmiWon = isPost && bbmiLeading === true;
  const bbmiLost = isPost && bbmiLeading === false;

  return (
    <div style={{ borderRadius: 6, padding: "3px 6px", display: "flex", flexDirection: "column", gap: 1, backgroundColor: bgColor, border: `1px solid ${borderColor}`, minHeight: 36, fontSize: "0.65rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isLive && <span className="live-dot" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor }} />}
        <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: statusColor }}>{statusDisplay}</span>
      </div>
      {hasScores && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.75rem" }}>
          <span style={{ color: awayScore! > homeScore! ? "#1e293b" : "#94a3b8", fontWeight: awayScore! > homeScore! ? 800 : 600 }}>{lg.espnAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>–</span>
          <span style={{ color: homeScore! > awayScore! ? "#1e293b" : "#94a3b8", fontWeight: homeScore! > awayScore! ? 800 : 600 }}>{homeScore} {lg.espnHomeAbbrev}</span>
        </div>
      )}
      {isPost && (bbmiWon || bbmiLost) && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiWon ? "#1a7a8a" : "#dc2626" }}>
          BBMI {bbmiWon ? "\u2713 WIN" : "\u2717 LOSS"}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TOOLTIP SYSTEM (portal-based, same as basketball)
// ────────────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  date: "The date/time of the game.",
  away: "The visiting team.",
  home: "The home team.",
  vegasLine: "Run line set by sportsbooks for the home team. Negative = home team is favored.",
  bbmiLine: "What BBMI's model predicts the run line should be.",
  edge: "The gap between BBMI's line and the Vegas line in runs. Larger edge = stronger model conviction.",
  bbmiPick: "The team BBMI's model favors to cover the Vegas run line.",
  homeWinPct: "BBMI's estimated probability that the home team wins outright.",
  vegasWinProb: "Vegas's implied probability that the home team wins outright (from moneyline).",
  actual: "Actual total runs scored. Red = over the Vegas line. Blue = under.",
  result: "Whether BBMI's O/U pick was correct.",
  bbmiTotal: "BBMI's projected total runs scored in the game.",
  vegasTotal: "Vegas's projected total runs scored (over/under).",
};

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
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>{"\u2715"}</button>
    </div>,
    document.body
  );
}

// ────────────────────────────────────────────────────────────────
// SORTABLE HEADER (same pattern as basketball)
// ────────────────────────────────────────────────────────────────

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortKey; tooltipId?: string;
  sortConfig: { key: SortKey; direction: "asc" | "desc" };
  handleSort: (key: SortKey) => void;
  rowSpan?: number; activeDescId?: string | null;
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
    <th ref={thRef} rowSpan={rowSpan} style={{
      backgroundColor: "#1a7a8a", color: "#ffffff",
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
          {isActive ? (sortConfig.direction === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
        </span>
      </div>
    </th>
  );
}

// ────────────────────────────────────────────────────────────────
// LOCKED ROW OVERLAY (premium gating)
// ────────────────────────────────────────────────────────────────

function LockedRowOverlay({ colSpan, onSubscribe, winPct, edgeLimit = FREE_EDGE_LIMIT }: { colSpan: number; onSubscribe: () => void; winPct: string; edgeLimit?: number }) {
  return (
    <tr style={{ backgroundColor: "#e6f0f2" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>{"\uD83D\uDD12"}</span>
            <span style={{ fontSize: "0.78rem", color: "#1a7a8a", fontWeight: 700 }}>High-edge pick {"\u2014"} Edge {"\u2265"} {edgeLimit} runs</span>
            <span style={{ fontSize: "0.72rem", color: "#555" }}>
              These picks are <strong style={{ color: "#1a7a8a" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button onClick={onSubscribe} style={{ backgroundColor: "#1a7a8a", color: "#ffffff", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            Unlock {"\u2192"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────
// PAYWALL MODAL
// ────────────────────────────────────────────────────────────────

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct, edgeLimit = FREE_EDGE_LIMIT }: {
  onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string; edgeLimit?: number;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ backgroundColor: "#f9fafb", borderRadius: 16, padding: "2rem 1.75rem", maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem" }}>
            {"\uD83D\uDD12"} Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1a1a1a", margin: "0 0 0.4rem" }}>Unlock High-Edge Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge {"\u2265"} {edgeLimit} runs — where the model is most accurate</p>
        </div>
        <div style={{ backgroundColor: "#1a7a8a", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks {"\u00B7"} edge {"\u2265"} {edgeLimit}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>picks with edge {"\u2265"} {MIN_EDGE_FOR_RECORD} runs</div>
          </div>
        </div>
        {/* Methodology note */}
        <div style={{ backgroundColor: "#e6f0f2", border: "1px solid #c0dde2", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.68rem", color: "#155e6e", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>{"\u2139\uFE0F"} Methodology:</strong> The overall rate excludes games where BBMI and Vegas lines differ by less than {MIN_EDGE_FOR_RECORD} runs and caps at {MAX_EDGE_FOR_RECORD} runs (extreme edges are model error, not market error). The Vegas line is captured at a specific point in time — lines can move between open and first pitch.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$10</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>One-time {"\u00B7"} No auto-renewal</div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02" style={{ display: "block", backgroundColor: "#1a7a8a", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Try 7 Days {"\u2192"}</a>
          </div>
          <div style={{ border: "2px solid #2563eb", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#eff6ff", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "0.15rem 0.6rem", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>MOST POPULAR</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$35</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e40af", margin: "0.3rem 0 0.2rem" }}>Per Month</div>
            <div style={{ fontSize: "0.65rem", color: "#3b82f6", backgroundColor: "#dbeafe", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>Cancel anytime</div>
            <a href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01" style={{ display: "block", background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Subscribe {"\u2192"}</a>
          </div>
        </div>
        <button onClick={onClose} style={{ fontSize: "0.75rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          No thanks, keep browsing free picks
        </button>
        <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #f3f4f6" }}>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>Already subscribed? </span>
          <Link href="/auth?returnTo=/baseball/picks" onClick={onClose} style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>Sign in {"\u2192"}</Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TODAY'S REPORT CARD
// ────────────────────────────────────────────────────────────────

function TodaysReportCard({ allGames, getLive, mode = "ats" }: {
  allGames: BaseballGame[]; getLive: (a: string, h: string) => LiveGame | undefined; mode?: "ats" | "ou";
}) {
  const isOU = mode === "ou";
  const results = allGames.reduce((acc, g) => {
    const lg = getLive(g.awayTeam, g.homeTeam);
    if (!lg || lg.status === "pre") return acc;
    const { awayScore, homeScore, status } = lg;
    if (awayScore == null || homeScore == null) return acc;

    if (isOU) {
      if (!g.ouPick || g.vegasTotal == null) return acc;
      const call = g.ouPick.toLowerCase();
      const actual = awayScore + homeScore;

      if (status === "post") {
        if (actual === g.vegasTotal) { acc.push++; return acc; }
        const went = actual > g.vegasTotal ? "over" : "under";
        if (call === went) acc.wins++; else acc.losses++;
        acc.final++;
      } else if (status === "in") {
        // Use projected pace total for live games
        const lg2 = getLive(g.awayTeam, g.homeTeam);
        const inn = lg2?.inning ?? 1;
        const half = lg2?.inningHalf;
        const completedInnings = (half === "Top" || half === "Mid") ? Math.max(inn - 1, 0.5) : inn;
        const estTotal = completedInnings > 0 ? actual * 9 / completedInnings : actual;
        const pacing = estTotal > g.vegasTotal ? "over" : "under";
        if (call === pacing) acc.winning++; else acc.losing++;
        acc.live++;
      }
    } else {
      const vegas = g.vegasLine;
      const bbmi = g.bbmiLine;
      if (vegas == null || bbmi == null || bbmi === vegas) return acc;
      const edge = Math.abs(bbmi - vegas);
      if (edge < 2.0 || edge > 5.0) return acc;
      const pickIsHome = bbmi < vegas;
      const margin = homeScore - awayScore;
      const homeCovers = margin > -vegas;
      const push = margin === -vegas;
      const correct = push ? null : pickIsHome ? homeCovers : !homeCovers;
      if (push) { acc.push++; return acc; }
      if (status === "in") { if (correct) acc.winning++; else acc.losing++; acc.live++; }
      else if (status === "post") { if (correct) acc.wins++; else acc.losses++; acc.final++; }
    }
    return acc;
  }, { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 });

  const settled = results.wins + results.losses;
  const combined = settled + results.winning + results.losing;
  const combinedWins = results.wins + results.winning;
  if (settled + results.live === 0 && results.push === 0) return null;

  const W = "#1a7a8a", L = "#dc2626";
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", backgroundColor: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d4d2cc" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{"\u26BE"} Today&apos;s Report Card</span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#1a7a8a", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#1a7a8a", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #d4d2cc" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: settled === 0 ? "#94a3b8" : results.wins >= results.losses ? W : L }}>
            {results.wins}&ndash;{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#444444", marginTop: 4 }}>{isOU ? "O/U Record" : "ATS Record"}</div>
          <div style={{ fontSize: "0.6rem", color: "#666666", marginTop: 2 }}>{settled} final (edge {"\u2265"} {MIN_EDGE_FOR_RECORD}){results.push > 0 ? ` \u00B7 ${results.push} push` : ""}</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #d4d2cc" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : results.winning >= results.losing ? W : L }}>
            {results.winning}&ndash;{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#444444", marginTop: 4 }}>{isOU ? "Currently Hitting" : "Currently Covering"}</div>
          <div style={{ fontSize: "0.6rem", color: "#666666", marginTop: 2 }}>{results.live} live</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: combined === 0 ? "#94a3b8" : combinedWins / combined >= 0.5 ? W : L }}>
            {combined === 0 ? "\u2014" : `${((combinedWins / combined) * 100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#444444", marginTop: 4 }}>Today&apos;s Win Rate</div>
          <div style={{ fontSize: "0.6rem", color: "#666666", marginTop: 2 }}>{combined === 0 ? "no games yet" : `${combinedWins} of ${combined} (incl. live)`}</div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// MAIN PAGE CONTENT
// ────────────────────────────────────────────────────────────────

function BaseballPicksContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const { getLive, lastUpdated, liveLoading } = useLiveScores();

  useEffect(() => {
    async function checkPremium() {
      if (!user) { setIsPremium(false); return; }
      try {
        const d = await getDoc(doc(db, "users", user.uid));
        setIsPremium(d.exists() && d.data()?.premium === true);
      } catch { setIsPremium(false); }
    }
    checkPremium();
  }, [user]);

  // Structured data for SEO
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org", "@type": "Dataset",
      name: "BBMI Today's Picks – NCAA Baseball Predictions",
      description: "Live NCAA D1 baseball run lines, BBMI model picks, pitcher matchups, and win probabilities for today's games.",
      url: "https://bbmisports.com/baseball/picks", dateModified: new Date().toISOString().split("T")[0],
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // ── Data processing ─────────────────────────────────────────
  const allGames = (games as BaseballGame[]).filter(g => g.homeTeam && g.awayTeam);
  const today = new Date().toLocaleDateString("en-CA");

  const todaysGames = useMemo(() =>
    allGames.filter(g => {
      const d = g.date ? String(g.date).split("T")[0] : "";
      return d === today;
    }),
  [allGames, today]);

  const historicalGames = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null),
  [allGames]);

  // ── Edge stats (overall + high-edge for paywall) ────────────
  const edgeStats = useMemo(() => {
    const qualified = historicalGames.filter(g => {
      if (g.vegasLine == null || g.bbmiLine == null) return false;
      const edge = Math.abs(g.bbmiLine - g.vegasLine);
      return edge >= MIN_EDGE_FOR_RECORD && edge <= MAX_EDGE_FOR_RECORD;
    });
    const wins = qualified.filter(g => {
      const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const pickIsHome = g.bbmiLine! < g.vegasLine!;
      const homeCovers = margin > -g.vegasLine!;
      return pickIsHome ? homeCovers : !homeCovers;
    }).length;
    const overallWinPct = qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "0.0";

    const highEdge = qualified.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter(g => {
      const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const pickIsHome = g.bbmiLine! < g.vegasLine!;
      const homeCovers = margin > -g.vegasLine!;
      return pickIsHome ? homeCovers : !homeCovers;
    }).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";

    const overallROI = calcROI(wins, qualified.length - wins);
    const highEdgeROI = calcROI(highEdgeWins, highEdge.length - highEdgeWins);
    const freeEdge = qualified.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) < FREE_EDGE_LIMIT);
    const freeEdgeWins = freeEdge.filter(g => {
      const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const pickIsHome = g.bbmiLine! < g.vegasLine!;
      const homeCovers = margin > -g.vegasLine!;
      return pickIsHome ? homeCovers : !homeCovers;
    }).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: qualified.length, overallROI, highEdgeWinPct, highEdgeTotal: highEdge.length, highEdgeROI, freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  // ── Edge performance by bucket (runs) ──────────────────────
  const edgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "1–2 runs", min: 1, max: 2, inclusive: false },
      { name: "2–3 runs", min: 2, max: 3, inclusive: false },
      { name: "3–4 runs", min: 3, max: MAX_EDGE_FOR_RECORD, inclusive: true },
    ];
    return cats.map(cat => {
      const catGames = historicalGames.filter(g => {
        if (g.vegasLine == null || g.bbmiLine == null) return false;
        const edge = Math.abs(g.bbmiLine - g.vegasLine);
        return edge >= cat.min && (cat.inclusive ? edge <= cat.max : edge < cat.max);
      });
      const wins = catGames.filter(g => {
        const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const pickIsHome = g.bbmiLine! < g.vegasLine!;
        const homeCovers = margin > -g.vegasLine!;
        return pickIsHome ? homeCovers : !homeCovers;
      }).length;
      const { low, high } = wilsonCI(wins, catGames.length);
      const losses = catGames.length - wins;
      return {
        name: cat.name, games: catGames.length, wins,
        winPct: catGames.length > 0 ? ((wins / catGames.length) * 100).toFixed(1) : "0.0",
        roi: calcROI(wins, losses),
        ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── Overall historical stats ────────────────────────────────
  const historicalStats = useMemo(() => {
    const qualified = historicalGames.filter(g => {
      if (g.vegasLine == null || g.bbmiLine == null) return false;
      const edge = Math.abs(g.bbmiLine - g.vegasLine);
      return edge >= MIN_EDGE_FOR_RECORD && edge <= MAX_EDGE_FOR_RECORD;
    });
    const wins = qualified.filter(g => {
      const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const pickIsHome = g.bbmiLine! < g.vegasLine!;
      const homeCovers = margin > -g.vegasLine!;
      return pickIsHome ? homeCovers : !homeCovers;
    }).length;
    const losses = qualified.length - wins;
    return {
      total: qualified.length,
      winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "0.0",
      roi: calcROI(wins, losses),
    };
  }, [historicalGames]);

  // ── Model maturity ──────────────────────────────────────────
  const modelMaturity = useMemo(() => {
    const first = todaysGames.find(g => g.modelMaturity);
    return first?.modelMaturity ?? "early_season";
  }, [todaysGames]);

  // Line movement removed — opening lines never populated, so movement is always null.

  // ── EdgePerformanceGraph data (adapt to Game type) ──────────
  // Include all games with edge >= 1.0 (including 1-2 bucket) for the graph
  const graphGames = useMemo(() =>
    historicalGames.map(g => ({
      date: g.date,
      away: g.awayTeam,
      home: g.homeTeam,
      vegasHomeLine: g.vegasLine,
      bbmiHomeLine: g.bbmiLine,
      actualAwayScore: g.actualAwayScore,
      actualHomeScore: g.actualHomeScore,
      fakeBet: (g.vegasLine != null && g.bbmiLine != null && Math.abs(g.bbmiLine - g.vegasLine) >= 1.0) ? 100 : 0,
      fakeWin: (() => {
        if (g.vegasLine == null || g.bbmiLine == null) return 0;
        const edge = Math.abs(g.bbmiLine - g.vegasLine);
        if (edge < 1.0) return 0;
        const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const pickIsHome = g.bbmiLine < g.vegasLine;
        const homeCovers = margin > -g.vegasLine;
        const won = pickIsHome ? homeCovers : !homeCovers;
        return won ? 100 : 0;
      })(),
    })),
  [historicalGames]);

  // ── O/U parallel stats ──────────────────────────────────────
  const ouIsWin = (g: BaseballGame): boolean | null => {
    if (g.bbmiTotal == null || g.vegasTotal == null || g.bbmiTotal === g.vegasTotal) return null;
    const call = g.bbmiTotal < g.vegasTotal ? "under" : "over";
    const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
    if (actual === g.vegasTotal) return null;
    return call === (actual > g.vegasTotal ? "over" : "under");
  };

  const ouEdgeStats = useMemo(() => {
    const OU_FREE = 3;
    const OU_MIN = 1.0;  // O/U uses its own minimum, not the spread minimum
    const qualified = historicalGames.filter(g => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal !== g.vegasTotal && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_MIN);
    const wins = qualified.filter(g => ouIsWin(g) === true).length;
    const overallWinPct = qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "0.0";
    const highEdge = qualified.filter(g => Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_FREE);
    const highEdgeWins = highEdge.filter(g => ouIsWin(g) === true).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const freeEdge = qualified.filter(g => Math.abs(g.bbmiTotal! - g.vegasTotal!) < OU_FREE);
    const freeEdgeWins = freeEdge.filter(g => ouIsWin(g) === true).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: qualified.length, overallROI: calcROI(wins, qualified.length - wins), highEdgeWinPct, highEdgeTotal: highEdge.length, highEdgeROI: calcROI(highEdgeWins, highEdge.length - highEdgeWins), freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  const ouHistoricalStats = useMemo(() => {
    const OU_MIN = 1.0;
    const qualified = historicalGames.filter(g => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal !== g.vegasTotal && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_MIN);
    const wins = qualified.filter(g => ouIsWin(g) === true).length;
    return { total: qualified.length, winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "0.0", roi: calcROI(wins, qualified.length - wins) };
  }, [historicalGames]);

  const ouEdgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "1\u20132 runs", min: 1, max: 2, inclusive: false },
      { name: "2\u20133 runs", min: 2, max: 3, inclusive: false },
      { name: "3\u20134 runs", min: 3, max: 4, inclusive: false },
      { name: "4\u20135 runs", min: 4, max: OU_MAX_EDGE, inclusive: true },
    ];
    return cats.map(cat => {
      const cg = historicalGames.filter(g => {
        if (g.bbmiTotal == null || g.vegasTotal == null) return false;
        const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
        return edge >= cat.min && (cat.inclusive ? edge <= cat.max : edge < cat.max);
      });
      const wins = cg.filter(g => ouIsWin(g) === true).length;
      const { low, high } = wilsonCI(wins, cg.length);
      return { name: cat.name, games: cg.length, wins, winPct: cg.length > 0 ? ((wins / cg.length) * 100).toFixed(1) : "0.0", roi: calcROI(wins, cg.length - wins), ciLow: low, ciHigh: high };
    });
  }, [historicalGames]);

  const ouGraphGames = useMemo(() =>
    historicalGames.map(g => ({
      date: g.date, away: g.awayTeam, home: g.homeTeam,
      vegasHomeLine: g.vegasLine, bbmiHomeLine: g.bbmiLine,
      actualAwayScore: g.actualAwayScore, actualHomeScore: g.actualHomeScore,
      fakeBet: (g.bbmiTotal != null && g.vegasTotal != null && Math.abs(g.bbmiTotal - g.vegasTotal) >= 1.0) ? 100 : 0,
      fakeWin: (() => { const hit = ouIsWin(g); return hit === true ? 100 : 0; })(),
      vegasTotal: g.vegasTotal, bbmiTotal: g.bbmiTotal,
      totalPick: g.bbmiTotal != null && g.vegasTotal != null ? (g.bbmiTotal < g.vegasTotal ? "under" : g.bbmiTotal > g.vegasTotal ? "over" : null) : null,
      totalResult: (() => { if (g.actualHomeScore == null || g.actualAwayScore == null || g.vegasTotal == null) return null; const a = g.actualHomeScore + g.actualAwayScore; return a > g.vegasTotal ? "over" : a < g.vegasTotal ? "under" : "push"; })(),
      actualTotal: g.actualHomeScore != null && g.actualAwayScore != null ? g.actualHomeScore + g.actualAwayScore : null,
    })),
  [historicalGames]);

  // ── Edge filter options ─────────────────────────────────────
  const edgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: "1\u20132 runs", min: 1, max: 2 },
    { label: "2\u20133 runs", min: 2, max: 3 },
    { label: "3\u20134 runs", min: 3, max: MAX_EDGE_FOR_RECORD },
  ];
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);

  // Show BBMI lines for games with pitchers (confirmed OR rotation-inferred) AND Vegas line
  // All games with Vegas line + BBMI line are ready to display
  // Games without confirmed pitchers use team baseline (pitcher adj is only ~0.36 runs)
  const gamesReady = useMemo(() =>
    todaysGames.filter(g => g.vegasLine != null && g.bbmiLine != null),
  [todaysGames]);

  // No "awaiting" section needed — all Vegas-lined games show with whatever pitcher data is available
  const gamesAwaitingPitchers: BaseballGame[] = [];

  // Games with no Vegas line at all
  const gamesNoVegas = useMemo(() =>
    todaysGames.filter(g => (g.vegasLine == null || g.bbmiLine == null) && g.actualHomeScore == null),
  [todaysGames]);

  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"ats" | "ou">(() => searchParams.get("mode") === "ats" ? "ats" : "ou");

  const ouGamesReady = useMemo(() =>
    todaysGames.filter(g => g.vegasTotal != null && g.bbmiTotal != null),
  [todaysGames]);

  // For backward compat — gamesWithVegas used in filtering/sorting below
  const gamesWithVegas = mode === "ats" ? gamesReady : ouGamesReady;

  const [noVegasOpen, setNoVegasOpen] = useState(false);
  const [awaitingOpen, setAwaitingOpen] = useState(true);  // default open so users see pending games

  // Active stats based on mode — must be after mode state and all stat useMemos
  const activeEdgeStats = mode === "ats" ? edgeStats : ouEdgeStats;
  const activeHistoricalStats = mode === "ats" ? historicalStats : ouHistoricalStats;
  const activeEdgePerformanceStats = mode === "ats" ? edgePerformanceStats : ouEdgePerformanceStats;
  const activeEdgeLimit = mode === "ats" ? FREE_EDGE_LIMIT : 3;

  const filteredGames = useMemo(() => {
    let g = gamesWithVegas;
    if (edgeOption.label !== "All Games") {
      g = g.filter(game => {
        const edge = mode === "ou"
          ? Math.abs((game.bbmiTotal ?? 0) - (game.vegasTotal ?? 0))
          : Math.abs(game.bbmiLine! - game.vegasLine!);
        return edge >= edgeOption.min && edge < edgeOption.max;
      });
    }
    return g;
  }, [gamesWithVegas, edgeOption, mode]);

  // ── Sort ────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortKey) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedGames = useMemo(() => {
    const withComputed = filteredGames.map(g => ({
      ...g,
      _edge: mode === "ou"
        ? (g.ouEdge != null ? g.ouEdge : (g.bbmiTotal != null && g.vegasTotal != null) ? Math.abs(g.bbmiTotal - g.vegasTotal) : 0)
        : ((g.vegasLine != null && g.bbmiLine != null) ? Math.abs(g.bbmiLine - g.vegasLine) : 0),
      _pick: mode === "ou"
        ? (g.ouPick ? g.ouPick.toLowerCase() : "")
        : ((g.vegasLine != null && g.bbmiLine != null)
          ? (g.bbmiLine < g.vegasLine ? g.homeTeam : g.bbmiLine > g.vegasLine ? g.awayTeam : "")
          : ""),
    }));
    return [...withComputed].sort((a, b) => {
      const { key, direction } = sortConfig;
      let av: number | string = 0, bv: number | string = 0;
      if (key === "edge") { av = a._edge; bv = b._edge; }
      else if (key === "away") { av = a.awayTeam; bv = b.awayTeam; }
      else if (key === "home") { av = a.homeTeam; bv = b.homeTeam; }
      else if (key === "vegasLine") { av = a.vegasLine ?? 0; bv = b.vegasLine ?? 0; }
      else if (key === "bbmiLine") { av = a.bbmiLine ?? 0; bv = b.bbmiLine ?? 0; }
      else if (key === "homeWinPct") { av = a.homeWinPct ?? 0; bv = b.homeWinPct ?? 0; }
      else if (key === "vegasWinProb") { av = a.vegasWinProb ?? 0; bv = b.vegasWinProb ?? 0; }
      else if (key === "bbmiPick") { av = a._pick; bv = b._pick; }
      else if (key === "bbmiTotal") { av = a.bbmiTotal ?? 0; bv = b.bbmiTotal ?? 0; }
      else if (key === "vegasTotal") { av = a.vegasTotal ?? 0; bv = b.vegasTotal ?? 0; }
      if (typeof av === "number" && typeof bv === "number") return direction === "asc" ? av - bv : bv - av;
      return direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filteredGames, sortConfig]);

  // Split into recommended and below-threshold
  const OU_OVER_MIN = 1.5;   // Phase 2 validated (was 2.5)
  const OU_UNDER_MIN = 1.5;
  const ATS_REC_MIN = 2.0;
  const ATS_REC_MAX = 5.0;

  const isRecommended = (g: typeof sortedGames[0]) => {
    if (mode === "ou") {
      if (g._pick === "over") return g._edge >= OU_OVER_MIN;
      if (g._pick === "under") return g._edge >= OU_UNDER_MIN;
      return false;
    }
    return g._edge >= ATS_REC_MIN && g._edge <= ATS_REC_MAX && g._pick !== "";
  };

  const recommendedGames = sortedGames.filter(g => isRecommended(g));
  const belowThresholdGames = sortedGames.filter(g => !isRecommended(g));
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);

  const recOverCount = recommendedGames.filter(g => g._pick === "over").length;
  const recUnderCount = recommendedGames.filter(g => g._pick === "under").length;
  const recLabel = mode === "ou"
    ? `${recOverCount} over, ${recUnderCount} under`
    : `${recommendedGames.length} picks`;

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const lockedCount = sortedGames.filter(g => g._edge >= activeEdgeLimit).length;
  const hasLiveGames = sortedGames.some(g => getLive(g.awayTeam, g.homeTeam)?.status === "in");

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={activeEdgeStats.highEdgeWinPct} highEdgeTotal={activeEdgeStats.highEdgeTotal} overallWinPct={activeEdgeStats.overallWinPct} edgeLimit={activeEdgeLimit} />}

      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* ── HEADER ─────────────────────────────────────── */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a7a8a", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NCAA Baseball {"\u00B7"} Updated Daily
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 14px" }}>
              Today&apos;s Game Lines
            </h1>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {(["ou", "ats"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={{
                  padding: "6px 20px", borderRadius: 999, fontSize: 13,
                  border: mode === m ? "none" : "1px solid #c0bdb5",
                  backgroundColor: mode === m ? "#1a7a8a" : "transparent",
                  color: mode === m ? "#ffffff" : "#555",
                  fontWeight: mode === m ? 500 : 400, cursor: "pointer",
                }}>
                  {m === "ats" ? "Against The Spread" : "Over/Under"}
                </button>
              ))}
            </div>
          </div>

          {/* ── HEADLINE STATS ─────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            {[
              { value: `${activeEdgeStats.freeEdgeWinPct}%`, label: "Free Picks", sub: `edge ${mode === "ats" ? MIN_EDGE_FOR_RECORD : 1.0}\u2013${activeEdgeLimit} runs`, premium: false },
              { value: `${activeEdgeStats.highEdgeWinPct}%`, label: "Premium Picks", sub: `edge \u2265 ${activeEdgeLimit} runs`, premium: true },
              { value: `${activeHistoricalStats.winPct}%`, label: mode === "ats" ? "Overall ATS" : "Overall O/U", sub: `${activeHistoricalStats.total.toLocaleString()} games`, premium: false },
            ].map(card => (
              <div key={card.label} style={{
                background: card.premium ? "#e6f0f2" : "#ffffff",
                border: card.premium ? "2px solid #1a7a8a" : "1px solid #d4d2cc",
                borderTop: "4px solid #1a7a8a", borderRadius: 10,
                padding: "14px 14px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: card.premium ? 28 : 24, fontWeight: card.premium ? 700 : 500, color: "#1a7a8a", lineHeight: 1.1 }}>{card.value}</div>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: card.premium ? "#1a7a8a" : "#777", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.63rem", color: "#666" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* ── METHODOLOGY NOTE ───────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              {"\u2020"} Record includes only games where BBMI and Vegas {mode === "ats" ? "run lines" : "totals"} differ by {"\u2265"} {mode === "ats" ? MIN_EDGE_FOR_RECORD : 1.0} runs{mode === "ats" ? ` and \u2264 ${MAX_EDGE_FOR_RECORD} runs` : ""} ({activeHistoricalStats.total.toLocaleString()} completed games).
              {mode === "ats" ? `Edges above ${MAX_EDGE_FOR_RECORD} runs are capped as they correlate with model error, not market error.` : ""}
              Model is in calibration phase — bet recommendations will be enabled after 300+ tracked games with locked parameters.{" "}
              <Link href="/baseball/accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View model history {"\u2192"}</Link>
            </p>
          </div>

          {/* ── PITCHER/LINES NOTE ──────────────────────────── */}
          <div style={{
            maxWidth: 1100, margin: "0 auto 1.25rem",
            backgroundColor: "#e6f0f2", border: "1px solid #c0dde2",
            borderRadius: 8, padding: "10px 16px",
            fontSize: "0.75rem", color: "#155e6e", lineHeight: 1.6, textAlign: "center",
          }}>
            <strong>Note:</strong> BBMI projections are published for all games with a Vegas line.
            Games with confirmed starters include a pitcher adjustment (~0.36 runs).
            Games without confirmed starters use team baseline projections.
            Lines update hourly from 10 AM{"\u2013"}6 PM CT.
          </div>

          {/* ── HIGH EDGE CALLOUT ──────────────────────────── */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e6f0f2", borderRadius: 6, borderLeft: "4px solid #1a7a8a", border: "1px solid #e7e5e4", borderLeftWidth: 4, borderLeftColor: "#1a7a8a", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#1a7a8a", lineHeight: 1 }}>{activeEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "#78716c" }}>win rate on picks with edge {"\u2265"} {activeEdgeLimit} runs</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#888", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "#78716c" }}>{activeEdgeStats.overallWinPct}%</strong> overall {"\u00B7"} documented across <strong style={{ color: "#78716c" }}>{activeEdgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#1a7a8a", fontWeight: 700 }}>{"\uD83D\uDD12"} {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked today</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#1a7a8a", color: "#1a1a1a", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $10 {"\u2192"}
                </button>
              </div>
            </div>
          )}

          {/* ── EDGE PERFORMANCE GRAPH ─────────────────────── */}
          {graphGames.length > 10 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#ffffff", borderRadius: 10, border: "1px solid #d4d2cc", padding: "1.5rem" }}>
              <EdgePerformanceGraph games={mode === "ou" ? ouGraphGames : graphGames} showTitle={true} edgeCategories={BASEBALL_EDGE_CATEGORIES} groupBy="week" mode={mode} />
            </div>
          )}

          {/* ── EDGE PERFORMANCE STATS TABLE ───────────────── */}
          {historicalGames.length > 10 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Historical Performance by Edge Size (Runs)
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Edge Size", "Games", "Win %", "ROI", "95% CI"].map(h => (
                        <th key={h} style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
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
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: Number(stat.winPct) >= 52.4 ? "#1a7a8a" : "#dc2626" }}>{stat.winPct}%</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", fontWeight: 700, color: Number(stat.roi) >= 0 ? "#1a7a8a" : "#dc2626" }}>
                          {Number(stat.roi) >= 0 ? "+" : ""}{stat.roi}%
                        </td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "center", color: "#78716c", fontStyle: "italic", whiteSpace: "nowrap" }}>
                          {stat.ciLow.toFixed(1)}%{"\u2013"}{stat.ciHigh.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                        ROI calculated at standard {"\u2212"}110 juice {"\u00B7"} Edges above {MAX_EDGE_FOR_RECORD} runs excluded {"\u00B7"} 95% CI uses Wilson score method.
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── HOW TO USE ─────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e6f0f2", borderLeft: "4px solid #1a7a8a", border: "1px solid #c0dde2", borderLeftWidth: 4, borderLeftColor: "#1a7a8a", borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#155e6e", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {activeEdgeLimit} runs) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks {"\u2265"} {activeEdgeLimit} runs</strong> — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access — use the edge filter to focus on the model&apos;s strongest picks.</span>}
            </p>
          </div>

          {/* ── SECTION: UPCOMING GAMES ────────────────────── */}
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s Games</h2>
          {todaysGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              Today&apos;s picks are published by 10am CT once the daily pipeline runs.
            </p>
          )}

          {/* ── EDGE FILTER ────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Edge</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {edgeOptions.map(o => {
                const isActive = edgeOption.label === o.label;
                return (
                  <button
                    key={o.label}
                    onClick={() => setEdgeOption(o)}
                    style={{
                      height: 38, padding: "0 16px", borderRadius: 999,
                      border: isActive ? "2px solid #1a7a8a" : "1px solid #c0bdb5",
                      backgroundColor: isActive ? "#1a7a8a" : "transparent",
                      color: isActive ? "#ffffff" : "#44403c",
                      fontSize: "0.85rem", fontWeight: isActive ? 700 : 500, cursor: "pointer",
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
              {gamesWithVegas.length > 0 ? (
                <>Showing <strong>{sortedGames.length}</strong> of <strong>{gamesWithVegas.length}</strong> games</>
              ) : (
                <>No Vegas lines available yet {"\u00B7"} {gamesNoVegas.length} games scheduled</>
              )}
            </p>
          </div>

          {/* ── LIVE SCORES STATUS PILL ────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: hasLiveGames ? "#e6f0f2" : "#f8fafc", border: `1px solid ${hasLiveGames ? "#c0dde2" : "#e2e8f0"}`, borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem", color: hasLiveGames ? "#155e6e" : "#64748b", fontWeight: 600 }}>
              {liveLoading ? (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              ) : hasLiveGames ? (
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#1a7a8a", display: "inline-block" }} />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              )}
              {liveLoading ? "Loading live scores\u2026" : hasLiveGames
                ? `Live scores updating \u00B7 ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN \u00B7 Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "\u2014"}`
              }
            </div>
          </div>

          {/* ── MODEL STATUS BAR ───────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 10px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 12px",
              backgroundColor: modelMaturity === "mature" ? "#e6f0f2" : modelMaturity === "calibrated" ? "#e6f0f2" : modelMaturity === "calibrating" ? "#fefce8" : "#fef2f2",
              color: modelMaturity === "mature" ? "#155e6e" : modelMaturity === "calibrated" ? "#155e6e" : modelMaturity === "calibrating" ? "#a16207" : "#b91c1c",
              border: `1px solid ${modelMaturity === "mature" ? "#86efac" : modelMaturity === "calibrated" ? "#93c5fd" : modelMaturity === "calibrating" ? "#fde68a" : "#fca5a5"}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" }} />
              Model: {modelMaturity === "early_season" ? "Early Season" : modelMaturity === "calibrating" ? "Calibrating" : modelMaturity === "calibrated" ? "Calibrated" : "Mature"}
            </span>
          </div>

          {/* ── TODAY'S REPORT CARD ─────────────────────────── */}
          <TodaysReportCard allGames={todaysGames} getLive={getLive} mode={mode} />

          {/* ── PICKS TABLE ────────────────────────────────── */}
          {gamesWithVegas.length > 0 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 950 }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        Score
                      </th>
                      <SortableHeader label="Away"        columnKey="away"         tooltipId="away"         align="left" {...headerProps} />
                      <SortableHeader label="Home"        columnKey="home"         tooltipId="home"         align="left" {...headerProps} />
                      <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        Pitchers
                      </th>
                      {mode === "ats" ? (
                        <>
                          <SortableHeader label="Vegas"       columnKey="vegasLine"    tooltipId="vegasLine"                 {...headerProps} />
                          <SortableHeader label="BBMI"        columnKey="bbmiLine"     tooltipId="bbmiLine"                  {...headerProps} />
                          <SortableHeader label="Edge"        columnKey="edge"         tooltipId="edge"                      {...headerProps} />
                          <SortableHeader label="BBMI Pick"   columnKey="bbmiPick"     tooltipId="bbmiPick"     align="left" {...headerProps} />
                          <SortableHeader label="BBMI Win%"   columnKey="homeWinPct"   tooltipId="homeWinPct"                {...headerProps} />
                          <SortableHeader label="Vegas Win%"  columnKey="vegasWinProb" tooltipId="vegasWinProb"              {...headerProps} />
                        </>
                      ) : (
                        <>
                          <SortableHeader label="Vegas O/U"   columnKey="vegasTotal"   tooltipId="vegasTotal"                {...headerProps} />
                          <SortableHeader label="BBMI Total"  columnKey="bbmiTotal"    tooltipId="bbmiTotal"                 {...headerProps} />
                          <SortableHeader label="Edge"        columnKey="edge"         tooltipId="edge"                      {...headerProps} />
                          <SortableHeader label="O/U Pick"    columnKey="bbmiPick"     tooltipId="bbmiPick"     align="left" {...headerProps} />
                          <SortableHeader label="Actual"      columnKey="homeWinPct"   tooltipId="actual"                    {...headerProps} />
                          <SortableHeader label="Result"      columnKey="vegasWinProb" tooltipId="result"                    {...headerProps} />
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedGames.length === 0 && (
                      <tr><td colSpan={13} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {/* ── RECOMMENDED PICKS DIVIDER ── */}
                    {recommendedGames.length > 0 && (
                      <tr>
                        <td colSpan={13} style={{ padding: "10px 16px", background: "#e6f0f2", borderTop: "3px solid #1a7a8a", borderBottom: "1px solid #c0dde2" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a7a8a" }}>
                            {"\u2714"} Recommended picks {"\u00B7"} {recLabel}
                          </span>
                        </td>
                      </tr>
                    )}

                    {recommendedGames.map((g, i) => {
                      const edge = g._edge;
                      const pick = g._pick;
                      const isLocked = !isPremium && edge >= activeEdgeLimit;

                      if (isLocked) {
                        return <LockedRowOverlay key={g.gameId + "_locked"} colSpan={13} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} edgeLimit={activeEdgeLimit} />;
                      }

                      const lg = getLive(g.awayTeam, g.homeTeam);
                      const hasLine = mode === "ou" ? (g.vegasTotal != null) : (g.vegasLine != null);
                      const belowMin = hasLine && edge < MIN_EDGE_FOR_RECORD;
                      const aboveMax = mode === "ats" && hasLine && edge > MAX_EDGE_FOR_RECORD;
                      const muted = belowMin || aboveMax;
                      const rowBg = muted
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb");
                      const seriesTag = g.seriesGame > 0 ? seriesLabel(g.seriesGame) : "";

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: rowBg, opacity: muted ? 0.55 : 1, color: muted ? "#9ca3af" : undefined }}>
                          {/* Score / Time */}
                          <td style={{ ...TD, textAlign: "center", paddingRight: 8 }}>
                            {!lg || lg.status === "pre" ? (
                              <div style={{ minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {lg?.startTime
                                    ? new Date(lg.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                    : g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : g.date}
                                </span>
                              </div>
                            ) : (
                              <LiveScoreBadge lg={lg} away={g.awayTeam} home={g.homeTeam} bbmiPick={pick || undefined} vegasLine={g.vegasLine} mode={mode} bbmiTotal={g.bbmiTotal} vegasTotal={g.vegasTotal} ouPick={g.ouPick} />
                            )}
                          </td>
                          {/* Away */}
                          <td style={{ ...TD, paddingLeft: 16 }}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.awayTeam} size={22} />
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{g.awayTeam}</span>
                                {seriesTag && <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6, fontWeight: 700 }}>{seriesTag}</span>}
                              </div>
                            </Link>
                          </td>
                          {/* Home */}
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.homeTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          {/* Pitchers */}
                          <td style={{ ...TD, textAlign: "center", fontSize: 10.5, lineHeight: 1.4 }}>
                            {(() => {
                              const awSrc = (g as Record<string, unknown>).awayPitcherSource as string | undefined;
                              const hmSrc = (g as Record<string, unknown>).homePitcherSource as string | undefined;
                              const isAwayRotation = awSrc?.startsWith("rotation");
                              const isHomeRotation = hmSrc?.startsWith("rotation");
                              const isAwayBaseline = !awSrc || awSrc === "team_baseline";
                              const isHomeBaseline = !hmSrc || hmSrc === "team_baseline";
                              return (
                                <>
                                  <div style={{ color: isAwayBaseline ? "#d1d5db" : "#374151" }}>
                                    {isAwayBaseline ? "TBD" : g.awayPitcher}
                                    {isAwayRotation && <span style={{ fontSize: 8, color: "#6366f1", fontWeight: 600, marginLeft: 3 }}>Projected</span>}
                                  </div>
                                  <div style={{ color: "#d1d5db", fontSize: 9 }}>vs</div>
                                  <div style={{ color: isHomeBaseline ? "#d1d5db" : "#374151" }}>
                                    {isHomeBaseline ? "TBD" : g.homePitcher}
                                    {isHomeRotation && <span style={{ fontSize: 8, color: "#6366f1", fontWeight: 600, marginLeft: 3 }}>Projected</span>}
                                  </div>
                                  {isAwayBaseline && isHomeBaseline && (
                                    <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>Team baseline</div>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          {mode === "ats" ? (
                            <>
                              <td style={TD_RIGHT}>{g.vegasLine ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.bbmiLine ?? "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, color: g.vegasLine == null ? "#d1d5db" : muted ? "#9ca3af" : edge >= activeEdgeLimit ? "#1a7a8a" : "#374151", fontWeight: edge >= activeEdgeLimit ? 800 : 600 }}>
                                {g.vegasLine == null ? "\u2014" : (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                    {`${muted ? "~" : ""}${edge.toFixed(1)}`}
                                    {g.confidenceFlag === "high" && !muted && (
                                      <span style={{ fontSize: 8, backgroundColor: "#1a7a8a", color: "#fff", borderRadius: 3, padding: "0 3px", fontWeight: 700, lineHeight: "14px" }}>H</span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td style={TD}>
                                {pick && g.vegasLine != null && (
                                  <Link href={`/baseball/team/${encodeURIComponent(pick)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                                    <NCAALogo teamName={pick} size={18} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{pick}</span>
                                  </Link>
                                )}
                              </td>
                              <td style={TD_RIGHT}>{g.homeWinPct != null ? `${(g.homeWinPct * 100).toFixed(0)}%` : "\u2014"}</td>
                              <td style={TD_RIGHT}>{(() => {
                                const vp = g.vegasWinProb ?? mlToProb(g.homeML);
                                return vp != null ? `${(vp * 100).toFixed(0)}%` : "\u2014";
                              })()}</td>
                            </>
                          ) : (
                            <>
                              <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, fontWeight: 700 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, color: muted ? "#9ca3af" : edge >= 3 ? "#1a7a8a" : "#374151", fontWeight: edge >= 3 ? 800 : 600 }}>
                                {muted ? "~" : ""}{edge.toFixed(1)}
                              </td>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
                                {pick === "under" ? (
                                  <span style={{ color: "#2563eb" }}>{"\u2193"} Under</span>
                                ) : pick === "over" ? (
                                  <span style={{ color: "#dc2626" }}>{"\u2191"} Over</span>
                                ) : "\u2014"}
                              </td>
                              {(() => {
                                const lg = getLive(g.awayTeam, g.homeTeam);
                                const hs = lg?.homeScore; const as_ = lg?.awayScore;
                                if (hs != null && as_ != null) {
                                  const actual = hs + as_;
                                  const vt = g.vegasTotal ?? 0;
                                  const color = actual > vt ? "#dc2626" : actual < vt ? "#2563eb" : "#374151";
                                  return <td style={{ ...TD_RIGHT, fontWeight: 700, color }}>{actual}</td>;
                                }
                                return <td style={TD_RIGHT}>{"\u2014"}</td>;
                              })()}
                              {(() => {
                                const lg = getLive(g.awayTeam, g.homeTeam);
                                if (!lg || lg.status !== "post") return <td style={TD_RIGHT}>{"\u2014"}</td>;
                                const hs = lg.homeScore; const as_ = lg.awayScore;
                                if (hs == null || as_ == null) return <td style={TD_RIGHT}>{"\u2014"}</td>;
                                if (!g.ouPick) return <td style={TD_RIGHT}>{"\u2014"}</td>;
                                const call = g.ouPick.toLowerCase();
                                const actual = hs + as_;
                                const vt = g.vegasTotal ?? 0;
                                if (actual === vt) return <td style={{ ...TD_RIGHT, color: "#94a3b8" }}>Push</td>;
                                const went = actual > vt ? "over" : "under";
                                const correct = call === went;
                                return <td style={{ ...TD_RIGHT, fontWeight: 700, color: correct ? "#1a7a8a" : "#dc2626" }}>{correct ? "\u2713" : "\u2717"}</td>;
                              })()}
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* ── BELOW THRESHOLD DIVIDER ── */}
                    {belowThresholdGames.length > 0 && (
                      <tr>
                        <td colSpan={13} style={{ padding: 0 }}>
                          <button
                            onClick={() => setShowBelowThreshold(p => !p)}
                            style={{ width: "100%", padding: "10px 16px", border: "none", borderTop: "2px solid #d4d2cc", background: "#f0efe9", cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#555555" }}
                          >
                            {showBelowThreshold ? "\u25B4" : "\u25BE"} All games {"\u00B7"} below model threshold ({belowThresholdGames.length})
                          </button>
                        </td>
                      </tr>
                    )}

                    {showBelowThreshold && belowThresholdGames.map((g, i) => {
                      const edge = g._edge;
                      const pick = g._pick;
                      const lg = getLive(g.awayTeam, g.homeTeam);
                      const hasLine = mode === "ou" ? (g.vegasTotal != null) : (g.vegasLine != null);
                      const seriesTag = g.seriesGame > 0 ? seriesLabel(g.seriesGame) : "";
                      return (
                        <tr key={g.gameId + "_bt"} style={{ backgroundColor: i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)", opacity: 0.55, color: "#9ca3af" }}>
                          {/* Score */}
                          <td style={{ ...TD, textAlign: "center", paddingRight: 8 }}>
                            {!lg || lg.status === "pre" ? (
                              <div style={{ minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>{g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : g.date}</span>
                              </div>
                            ) : (
                              <LiveScoreBadge lg={lg} away={g.awayTeam} home={g.homeTeam} bbmiPick={pick} vegasLine={mode === "ats" ? g.vegasLine : null} mode={mode} bbmiTotal={g.bbmiTotal} vegasTotal={g.vegasTotal} ouPick={g.ouPick} />
                            )}
                          </td>
                          {/* Away */}
                          <td style={{ ...TD, paddingLeft: 10 }}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                              <NCAALogo teamName={g.awayTeam} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                            </Link>
                          </td>
                          {/* Home */}
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#9ca3af" }}>
                              <NCAALogo teamName={g.homeTeam} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          {/* Pitchers */}
                          <td style={{ ...TD, textAlign: "center", fontSize: 10, color: "#b0b0b0" }}>
                            {g.awayPitcher || "TBD"} vs {g.homePitcher || "TBD"}
                          </td>
                          {mode === "ou" ? (
                            <>
                              <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.bbmiTotal ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{hasLine ? edge.toFixed(1) : "\u2014"}</td>
                              <td style={{ ...TD, textAlign: "center", fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#b0b0b0" }}>
                                {pick === "over" ? "\u2191 Over" : pick === "under" ? "\u2193 Under" : "\u2014"}
                              </td>
                              <td style={TD_RIGHT}>{"\u2014"}</td>
                              <td style={TD_RIGHT}>{"\u2014"}</td>
                            </>
                          ) : (
                            <>
                              <td style={TD_RIGHT}>{g.vegasLine ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.bbmiLine ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{hasLine ? edge.toFixed(1) : "\u2014"}</td>
                              <td style={{ ...TD, fontSize: 11, color: "#b0b0b0" }}>{pick || "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.homeWinPct != null ? `${(g.homeWinPct * 100).toFixed(0)}%` : "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.vegasWinProb != null ? `${(g.vegasWinProb * 100).toFixed(0)}%` : "\u2014"}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#e6f0f2" }}>
                        <td colSpan={13} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#1a6a72", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate vs {activeEdgeStats.freeEdgeWinPct}% free picks
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#1a7a8a", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
                            Unlock all picks — $10 for 7 days {"\u2192"}
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* ── AWAITING PITCHERS ROLLUP ─────────────────────── */}
          {gamesAwaitingPitchers.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1rem" }}>
              <button
                onClick={() => setAwaitingOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 16px",
                  backgroundColor: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: awaitingOpen ? "8px 8px 0 0" : 8,
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#92400e",
                }}
              >
                <span style={{ fontSize: 11 }}>{awaitingOpen ? "\u25BC" : "\u25B6"}</span>
                Awaiting Starting Lineups ({gamesAwaitingPitchers.length}) — BBMI lines published once starters confirmed
              </button>
              {awaitingOpen && (
                <div style={{ border: "1px solid #fde68a", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Away</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Home</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vegas Line</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Vegas Total</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamesAwaitingPitchers.map((g, i) => (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "#fffbeb" : "#ffffff" }}>
                          <td style={{ ...TD, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                            {g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "TBD"}
                          </td>
                          <td style={{ ...TD, paddingLeft: 10 }}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a1a1a", textDecoration: "none" }}>
                              <NCAALogo teamName={g.awayTeam} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                            </Link>
                          </td>
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a1a1a", textDecoration: "none" }}>
                              <NCAALogo teamName={g.homeTeam} size={18} />
                              <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600 }}>
                            {g.vegasLine != null ? (g.vegasLine > 0 ? `+${g.vegasLine.toFixed(1)}` : g.vegasLine.toFixed(1)) : "\u2014"}
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                            {g.vegasTotal != null ? g.vegasTotal.toFixed(1) : "\u2014"}
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                            Awaiting starters
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── NO VEGAS LINE ROLLUP ───────────────────────── */}
          {gamesNoVegas.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <button
                onClick={() => setNoVegasOpen(o => !o)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "10px 16px",
                  backgroundColor: "#f8fafc", border: "1px solid #e2e0de",
                  borderRadius: noVegasOpen ? "8px 8px 0 0" : 8,
                  cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#57534e",
                }}
              >
                <span style={{ fontSize: 11 }}>{noVegasOpen ? "\u25BC" : "\u25B6"}</span>
                Games Without Vegas Lines ({gamesNoVegas.length})
              </button>
              {noVegasOpen && (
                <div style={{ border: "1px solid #e2e0de", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Away</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Home</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI Line</th>
                        <th style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI Win%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamesNoVegas.map((g, i) => {
                        const lg = getLive(g.awayTeam, g.homeTeam);
                        const hasScores = lg && lg.status !== "pre" && (lg.awayScore != null || lg.homeScore != null);
                        return (
                          <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "#fafafa" : "#ffffff" }}>
                            <td style={{ ...TD, textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                              {hasScores ? (
                                <span style={{ fontWeight: 600, color: "#374151" }}>{lg!.awayScore} - {lg!.homeScore}</span>
                              ) : (
                                g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : "TBD"
                              )}
                            </td>
                            <td style={{ ...TD, paddingLeft: 10 }}>
                              <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a1a1a", textDecoration: "none" }}>
                                <NCAALogo teamName={g.awayTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                              </Link>
                            </td>
                            <td style={TD}>
                              <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1a1a1a", textDecoration: "none" }}>
                                <NCAALogo teamName={g.homeTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                              </Link>
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600 }}>
                              {g.bbmiLine != null ? (g.bbmiLine > 0 ? `+${g.bbmiLine.toFixed(1)}` : g.bbmiLine.toFixed(1)) : "\u2014"}
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                              {g.homeWinPct != null ? `${(Math.max(g.homeWinPct, 1 - g.homeWinPct) * 100).toFixed(0)}%` : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── METHODOLOGY ACCORDION ──────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 3rem" }}>
            <details style={{ backgroundColor: "#e6f0f2", border: "1px solid #c0dde2", borderRadius: 10, overflow: "hidden" }}>
              <summary style={{ padding: "0.75rem 1.25rem", fontSize: "0.82rem", fontWeight: 700, color: "#155e6e", cursor: "pointer", userSelect: "none" }}>
                Methodology &amp; How to Read This Page
              </summary>
              <div style={{ padding: "0 1.25rem 1rem", fontSize: "0.75rem", color: "#64748b", lineHeight: 1.7 }}>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Run Line (Spread):</strong> The run line is baseball&apos;s equivalent of the point spread. A home team at -1.5 is expected to win by at least 2 runs. BBMI generates its own projected run line using a Poisson model with SOS (Strength of Schedule) adjustment, then compares it to the Vegas line.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Edge:</strong> The absolute difference between BBMI&apos;s projected line and the Vegas line. Larger edges indicate stronger model conviction. Edges below {MIN_EDGE_FOR_RECORD} runs are within normal market noise. Edges above {MAX_EDGE_FOR_RECORD} runs are capped (extreme disagreements typically indicate model error, not a market opportunity).
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>BBMI Pick:</strong> The team that BBMI favors to cover the Vegas run line. If BBMI&apos;s line is lower (more negative) than Vegas for the home team, BBMI picks the home team to cover.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Totals (O/U):</strong> BBMI&apos;s projected total runs vs. the Vegas over/under. This is informational — the ATS record tracks only run-line picks.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Win %:</strong> BBMI&apos;s estimated probability that the home team wins outright. Vegas Win% is implied from the moneyline.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Pitchers:</strong> Starting pitcher matchups as confirmed by the pipeline. Games with TBD pitchers carry additional uncertainty.
                </p>
                <p style={{ margin: "0.5rem 0", color: "#94a3b8", fontStyle: "italic" }}>
                  95% confidence intervals (CI) use the Wilson score method. All records exclude sub-{MIN_EDGE_FOR_RECORD} and over-{MAX_EDGE_FOR_RECORD} run edges.
                </p>
              </div>
            </details>
          </div>

        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// EXPORT (wrapped in AuthProvider)
// ────────────────────────────────────────────────────────────────

export default function BaseballPicksPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}>
        <BaseballPicksContent />
      </Suspense>
    </AuthProvider>
  );
}
