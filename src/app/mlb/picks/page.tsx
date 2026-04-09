"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import games from "@/data/betting-lines/mlb-games.json";
import rankingsRaw from "@/data/rankings/mlb-rankings.json";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import MLBLogo from "@/components/MLBLogo";

const _mlbRanks = rankingsRaw as Record<string, Record<string, unknown>>;
function mlbRank(team: string): number | null {
  const r = _mlbRanks[team]?.model_rank;
  return r != null ? Number(r) : null;
}
import { AuthProvider, useAuth } from "../../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase-config";

// ────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────

// Shared thresholds — single source of truth
import {
  OU_MIN_EDGE, OU_STRONG_EDGE as OU_FREE_EDGE_LIMIT,
  RL_STRONG_MARGIN, RL_PREMIUM_MARGIN, RL_JUICE, RL_BASE_RATE as _RL_BASE_RATE,
} from "@/config/mlb-thresholds";

// Reference lines (base rates)
const RL_BASE_RATE = _RL_BASE_RATE;
const OU_BASE_RATE = 52.4;         // O/U base rate

// MLB edge categories for EdgePerformanceGraph — Run Line
const MLB_RL_EDGE_CATEGORIES = [
  { name: "0.00\u20130.10", min: 0.00, max: 0.10, color: "#b0b8c4", width: 1.25 },
  { name: "0.10\u20130.20", min: 0.10, max: 0.20, color: "#7a9bbf", width: 1.75 },
  { name: "0.20\u20130.30", min: 0.20, max: 0.30, color: "#c4956a", width: 2.5 },
  { name: ">0.30",          min: 0.30, max: Infinity, color: "#3b7a57", width: 3.0 },
];

// MLB edge categories for EdgePerformanceGraph — Over/Under
const MLB_OU_EDGE_CATEGORIES = [
  { name: "1.00\u20131.25 runs", min: 1.00, max: 1.25, color: "#b0b8c4", width: 1.25 },
  { name: "1.25\u20131.50",      min: 1.25, max: 1.50, color: "#7a9bbf", width: 1.75 },
  { name: "1.50\u20132.00",      min: 1.50, max: 2.00, color: "#c4956a", width: 2.5 },
  { name: ">2.00",               min: 2.00, max: Infinity, color: "#3b7a57", width: 3.0 },
];

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

// Juice constants by product type
const OU_JUICE = -110;   // O/U lines are typically -110/-110
// RL_JUICE imported from shared config

/** Does this RL pick cover? Away +1.5 covers when homeLeadBy <= 1. Home -1.5 covers when homeLeadBy >= 2. */
function rlCovers(rlPick: string | null, homeLeadBy: number): boolean {
  if (!rlPick) return false;
  if (rlPick.includes("-1.5")) return homeLeadBy >= 2;  // home favorite covers
  return homeLeadBy <= 1;  // away underdog covers
}

function calcROI(wins: number, losses: number, juice: number = OU_JUICE): string {
  const total = wins + losses;
  if (total === 0) return "0.0";
  const profitPerWin = juice < 0 ? 100 / (Math.abs(juice) / 100) : juice;
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

// ────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────

type MLBGame = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  homePitcher: string;
  awayPitcher: string;
  homePitcherERA: number | null;
  awayPitcherERA: number | null;
  homePitcherFIP: number | null;
  awayPitcherFIP: number | null;
  homePitcherStatus: string;    // "confirmed" | "projected" | "opener" | "tbd"
  awayPitcherStatus: string;
  bbmiHomeProj: number | null;
  bbmiAwayProj: number | null;
  bbmiTotal: number | null;
  bbmiMargin: number | null;    // projected margin: positive = away win projected
  vegasRunLine: number | null;  // e.g. -1.5 or +1.5 for home team
  vegasTotal: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  vegasWinProb: number | null;
  parkFactor: number;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  modelMaturity: string;
  confidenceFlag: string;
  homeRLJuice: number | null;
  awayRLJuice: number | null;
  homeML: number | null;
  awayML: number | null;
  ouEdge: number | null;
  rlMarginEdge: number | null;
  ouConfidenceTier: number | string;
  rlConfidenceTier: number;
  ouPick: string | null;
  ouSuppressed?: boolean;
  ouSuppressReason?: string | null;
  underCCS?: number | null;
  overCCS?: number | null;
  ccsBreakdown?: Record<string, number> | null;
  rlPick: string | null;
  rlPickDisplay: string | null;
  rlPickValidated: boolean | null;
  rlUnderdogTeam: string | null;
  rlFavoriteTeam: string | null;
  fipDifferential: number | null;
  temp_modifier: string | null;
  temperature_f: number | null;
  temp_deviation_f: number | null;
  wind_speed_mph: number | null;
  wrigleyWindModifier: string | null;
  wrigley_wind_adj: number | null;
};

type SortKey =
  | "edge" | "date" | "away" | "home"
  | "vegasLine" | "bbmiLine" | "bbmiPick"
  | "homeWinPct" | "vegasWinProb"
  | "bbmiTotal" | "vegasTotal";

// ────────────────────────────────────────────────────────────────
// MLB STATS API LIVE SCORES
// ────────────────────────────────────────────────────────────────

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  inning: number | null;
  inningHalf: string;  // "Top" | "Mid" | "Bot" | "End" | ""
  mlbAwayAbbrev: string;
  mlbHomeAbbrev: string;
  startTime: string | null;
}

// MLB Stats API team name → display abbreviation
const MLB_TEAM_ABBREVS: Record<string, string> = {
  "Arizona Diamondbacks": "ARI", "Atlanta Braves": "ATL", "Baltimore Orioles": "BAL",
  "Boston Red Sox": "BOS", "Chicago Cubs": "CHC", "Chicago White Sox": "CWS",
  "Cincinnati Reds": "CIN", "Cleveland Guardians": "CLE", "Colorado Rockies": "COL",
  "Detroit Tigers": "DET", "Houston Astros": "HOU", "Kansas City Royals": "KC",
  "Los Angeles Angels": "LAA", "Los Angeles Dodgers": "LAD", "Miami Marlins": "MIA",
  "Milwaukee Brewers": "MIL", "Minnesota Twins": "MIN", "New York Mets": "NYM",
  "New York Yankees": "NYY", "Oakland Athletics": "OAK", "Philadelphia Phillies": "PHI",
  "Pittsburgh Pirates": "PIT", "San Diego Padres": "SD", "San Francisco Giants": "SF",
  "Seattle Mariners": "SEA", "St. Louis Cardinals": "STL", "Tampa Bay Rays": "TB",
  "Texas Rangers": "TEX", "Toronto Blue Jays": "TOR", "Washington Nationals": "WSH",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeMLBName(name: string): string {
  return norm(name);
}

function getMLBTeamAbbrev(teamName: string): string {
  return MLB_TEAM_ABBREVS[teamName] ?? teamName.slice(0, 3).toUpperCase();
}

function getMLBDates(): string[] {
  const ctNow = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const utcTomorrow = tomorrow.toISOString().slice(0, 10);
  const dates = [ctNow];
  if (utcTomorrow !== ctNow) dates.push(utcTomorrow);
  return dates;
}

const INNING_ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

async function fetchMLBLiveScores(): Promise<Map<string, LiveGame>> {
  const map = new Map<string, LiveGame>();
  const dates = getMLBDates();

  for (const dateStr of dates) {
    try {
      const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=linescore`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();

      for (const dateEntry of data.dates ?? []) {
        for (const game of dateEntry.games ?? []) {
          const statusCode = game.status?.statusCode ?? "S";
          const abstractState = game.status?.abstractGameState ?? "Preview";
          let status: GameStatus = "pre";
          if (abstractState === "Live" || statusCode === "I" || statusCode === "MA" || statusCode === "MB") {
            status = "in";
          } else if (statusCode === "DI" || statusCode === "DR" || statusCode === "DG") {
            status = "pre";  // Postponed/delayed — treat as not started
          } else if (abstractState === "Final" || statusCode === "F" || statusCode === "O" || statusCode === "FR") {
            status = "post";
          }

          const linescore = game.linescore;
          const inning = linescore?.currentInning ?? null;
          const inningHalf = linescore?.inningHalf ?? "";
          const halfLabel = inningHalf === "Top" ? "Top" : inningHalf === "Bottom" ? "Bot" : inningHalf === "Middle" ? "Mid" : inningHalf === "End" ? "End" : "";

          let statusDisplay = game.status?.detailedState ?? "";
          if (status === "in" && inning != null) {
            const ordinal = inning <= 9 ? (INNING_ORDINALS[inning] ?? `${inning}th`) : `${inning}th`;
            statusDisplay = `${halfLabel} ${ordinal}`.trim();
          } else if (status === "post") {
            statusDisplay = inning && inning > 9 ? `Final (${inning})` : "Final";
          }

          const awayTeamName = game.teams?.away?.team?.name ?? "";
          const homeTeamName = game.teams?.home?.team?.name ?? "";
          const awayScore = game.teams?.away?.score ?? (linescore?.teams?.away?.runs ?? null);
          const homeScore = game.teams?.home?.score ?? (linescore?.teams?.home?.runs ?? null);

          const lg: LiveGame = {
            awayScore: awayScore != null ? Number(awayScore) : null,
            homeScore: homeScore != null ? Number(homeScore) : null,
            status,
            statusDisplay,
            inning,
            inningHalf: halfLabel,
            mlbAwayAbbrev: getMLBTeamAbbrev(awayTeamName),
            mlbHomeAbbrev: getMLBTeamAbbrev(homeTeamName),
            startTime: game.gameDate ?? null,
          };

          const aN = normalizeMLBName(awayTeamName);
          const hN = normalizeMLBName(homeTeamName);

          // Time-keyed entry for doubleheader disambiguation
          const timeKey = `${aN}|${hN}|${game.gameDate ?? ""}`;
          map.set(timeKey, lg);

          // Maintain array for doubleheader lookup
          const listKey = `list:${aN}|${hN}`;
          const existing = (map.get(listKey) as unknown as LiveGame[]) ?? [];
          existing.push(lg);
          map.set(listKey as unknown as string, existing as unknown as LiveGame);

          // Single-game fallback for non-doubleheaders
          if (!map.has(`${aN}|${hN}`)) {
            map.set(`${aN}|${hN}`, lg);
            for (const fk of [`away:${aN}`, `home:${hN}`]) {
              if (!map.has(fk)) map.set(fk, lg);
            }
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
      const m = await fetchMLBLiveScores();
      setLiveScores(m);
      setLastUpdated(new Date());
      const hasLive = Array.from(m.values()).some(g => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch {
      timerRef.current = setTimeout(load, 120_000);
    } finally { setLiveLoading(false); }
  }, []);

  useEffect(() => { load(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [load]);

  const getLive = useCallback((away: string, home: string, gameTimeUTC?: string | null): LiveGame | undefined => {
    const a = normalizeMLBName(away), h = normalizeMLBName(home);

    // Exact time match for doubleheaders
    if (gameTimeUTC) {
      const timeKey = `${a}|${h}|${gameTimeUTC}`;
      if (liveScores.has(timeKey)) return liveScores.get(timeKey);

      // Closest time match from list
      const list = liveScores.get(`list:${a}|${h}` as string) as unknown as LiveGame[] | undefined;
      if (list?.length) {
        const target = new Date(gameTimeUTC).getTime();
        return list.reduce((best, g) => {
          if (!g.startTime) return best;
          const diff = Math.abs(new Date(g.startTime).getTime() - target);
          const bestDiff = best?.startTime ? Math.abs(new Date(best.startTime).getTime() - target) : Infinity;
          return diff < bestDiff ? g : best;
        }, list[0]);
      }
    }

    // Single game fallback
    return liveScores.get(`${a}|${h}`)
      ?? liveScores.get(`away:${a}`)
      ?? liveScores.get(`home:${h}`);
  }, [liveScores]);

  return { getLive, lastUpdated, liveLoading };
}

// ────────────────────────────────────────────────────────────────
// LIVE SCORE BADGE
// ────────────────────────────────────────────────────────────────

function LiveScoreBadge({ lg, away, home, mode = "rl", bbmiMargin, vegasTotal, bbmiTotal, hasPick, rlPick }: {
  lg: LiveGame | undefined; away: string; home: string;
  mode?: "rl" | "ou"; bbmiMargin?: number | null; vegasTotal?: number | null; bbmiTotal?: number | null;
  hasPick?: boolean; rlPick?: string | null;
}) {
  if (!lg || lg.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay, inning } = lg;
  const hasScores = awayScore != null && homeScore != null;
  const isLive = status === "in";

  let bbmiLeading: boolean | null = null;

  if (!hasPick) {
    // No BBMI pick on this game — no color
    bbmiLeading = null;
  } else if (mode === "ou") {
    if (hasScores && bbmiTotal != null && vegasTotal != null && bbmiTotal !== vegasTotal) {
      const call = bbmiTotal < vegasTotal ? "under" : "over";
      const currentTotal = awayScore! + homeScore!;

      if (status === "post") {
        // Final result
        if (currentTotal === vegasTotal) bbmiLeading = null;
        else { const went = currentTotal > vegasTotal ? "over" : "under"; bbmiLeading = call === went; }
      } else {
        // Live — color based on estimated pace, not raw total
        const inn = lg.inning ?? 1;
        const half = lg.inningHalf;
        const completedInnings = (half === "Top" || half === "Mid") ? Math.max(inn - 1, 0.5) : inn;
        const estTotal = completedInnings > 0 ? currentTotal * 9 / completedInnings : currentTotal;

        if (call === "under") {
          if (estTotal < vegasTotal - 0.5) bbmiLeading = true;       // green: pacing under
          else if (estTotal > vegasTotal + 0.5) bbmiLeading = false;  // red: pacing over
          else bbmiLeading = null;                                     // neutral zone
        } else {
          // over pick
          if (estTotal > vegasTotal + 0.5) bbmiLeading = true;       // green: pacing over
          else if (estTotal < vegasTotal - 0.5) bbmiLeading = false;  // red: pacing under
          else bbmiLeading = null;
        }
      }
    }
  } else {
    // Run Line: away +1.5 or home -1.5
    if (hasScores && rlPick != null) {
      const homeLeadBy = homeScore! - awayScore!;
      const isHomePick = rlPick.includes("-1.5");
      if (status === "post") {
        bbmiLeading = rlCovers(rlPick, homeLeadBy);
      } else {
        // Live
        if (isHomePick) {
          // Home -1.5: need home to lead by 2+
          if (homeLeadBy >= 3) bbmiLeading = true;
          else if (homeLeadBy === 2) bbmiLeading = null;
          else bbmiLeading = false;
        } else {
          // Away +1.5: need home lead <= 1
          if (homeLeadBy <= 0) bbmiLeading = true;
          else if (homeLeadBy === 1) bbmiLeading = true;
          else if (homeLeadBy === 2) bbmiLeading = null;
          else bbmiLeading = false;
        }
        // Extra innings: tied or away leading = certainty
        if (inning && inning >= 10 && homeLeadBy <= 0) {
          bbmiLeading = true;
        }
      }
    }
  }

  const bgColor = bbmiLeading === true ? "#f0fdf4" : bbmiLeading === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiLeading === true ? "#86efac" : bbmiLeading === false ? "#fca5a5" : "#e2e8f0";
  const dotColor = bbmiLeading === true ? "#16a34a" : bbmiLeading === false ? "#dc2626" : "#94a3b8";
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
          <span style={{ color: awayScore! > homeScore! ? "#1e293b" : "#94a3b8", fontWeight: awayScore! > homeScore! ? 800 : 600 }}>{lg.mlbAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>{"\u2013"}</span>
          <span style={{ color: homeScore! > awayScore! ? "#1e293b" : "#94a3b8", fontWeight: homeScore! > awayScore! ? 800 : 600 }}>{homeScore} {lg.mlbHomeAbbrev}</span>
        </div>
      )}
      {isPost && (bbmiWon || bbmiLost) && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiWon ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiWon ? "\u2713 WIN" : "\u2717 LOSS"}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TOOLTIP SYSTEM (portal-based)
// ────────────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  date: "The date/time of the game.",
  away: "The visiting team.",
  home: "The home team.",
  vegasLine: "Run line set by sportsbooks. Standard MLB run line is -1.5 / +1.5.",
  bbmiMargin: "BBMI's projected edge magnitude. Larger values indicate stronger model conviction.",
  edge: "The gap between BBMI's projection and the Vegas line. Larger edge = stronger model conviction.",
  bbmiPick: "Run Line: the team BBMI projects to cover. Away +1.5 when BBMI projects away win by 1.0+ runs. Home -1.5 when BBMI projects home win by 1.1+ runs. O/U: UNDER when BBMI is 1.0+ runs below Vegas. OVER when 1.25+ above.",
  homeWinPct: "BBMI's estimated win probability for the picked side. Higher = stronger conviction.",
  vegasWinProb: "Vegas's implied win probability derived from the moneyline.",
  actual: "Actual total runs scored. Red = over the Vegas line. Blue = under.",
  result: "Whether BBMI's O/U pick was correct.",
  bbmiTotal: "BBMI's projected total runs scored in the game.",
  vegasTotal: "Vegas's projected total runs scored (over/under).",
  pitchers: "Starting pitchers with ERA and FIP. Status: confirmed, projected, or opener.",
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
// SORTABLE HEADER
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
      backgroundColor: "#1a6640", color: "#ffffff",
      padding: "10px 12px", textAlign: align,
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
      borderBottom: "1px solid rgba(255,255,255,0.2)",
      fontSize: "0.62rem", fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      verticalAlign: "middle", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecorationLine: tooltipId ? "underline" : "none", textDecorationStyle: tooltipId ? "dotted" : undefined, textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.35)" }}>
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
// CONFIDENCE TIER DOTS
// ────────────────────────────────────────────────────────────────

function ConfidenceDots({ mode, edge, tier, isOver }: { mode: "rl" | "ou"; edge: number; tier?: number; isOver?: boolean }) {
  let dots = 0;
  if (tier != null && tier > 0) {
    dots = tier;
  } else if (mode === "ou" && isOver) {
    // Over: 1 dot >= 1.25, 2 dots >= 1.50
    if (edge >= 1.50) dots = 2;
    else if (edge >= 1.25) dots = 1;
  } else if (mode === "ou") {
    if (edge >= 1.50) dots = 3;
    else if (edge >= 1.25) dots = 2;
    else if (edge >= 0.83) dots = 1;
  } else {
    if (edge >= 1.25) dots = 3;
    else if (edge >= 1.15) dots = 2;
    else if (edge >= 1.00) dots = 1;
  }
  if (dots === 0) return null;
  const isAce = dots === 4;
  return (
    <span style={{ display: "inline-flex", gap: 3, marginLeft: 5, alignItems: "center" }}>
      {Array.from({ length: Math.min(dots, 4) }).map((_, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#f0c040", display: "inline-block" }} />
      ))}
      {isAce && <span style={{ fontSize: 9, marginLeft: 2, color: "#f0c040", fontWeight: 700, letterSpacing: "0.04em" }}>ACE</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// CCS TIER BADGE
// ────────────────────────────────────────────────────────────────

function CCSTierBadge({ tier, ccs }: { tier?: string | number | null; ccs?: number | null }) {
  const tierStr = typeof tier === "string" ? tier : null;
  if (!tierStr || tierStr === "SUPPRESS") return null;

  const config: Record<string, { color: string; bg: string; label: string }> = {
    ELITE:    { color: "#92400e", bg: "#fef3c7", label: "Elite" },
    PREMIUM:  { color: "#1a6640", bg: "#e8f0ec", label: "Premium" },
    STANDARD: { color: "#4a6fa5", bg: "#e8eef6", label: "Standard" },
    MARGINAL: { color: "#78716c", bg: "#f0efe9", label: "Marginal" },
  };

  const c = config[tierStr];
  if (!c) return null;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 700, color: c.color, backgroundColor: c.bg,
      padding: "2px 8px", borderRadius: 999, letterSpacing: "0.04em",
    }}>
      {c.label}
      {ccs != null && <span style={{ fontSize: 9, color: c.color, opacity: 0.6 }}>CCS {ccs}</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// LOCKED ROW OVERLAY (premium gating)
// ────────────────────────────────────────────────────────────────

function LockedRowOverlay({ colSpan, onSubscribe, winPct, mode }: { colSpan: number; onSubscribe: () => void; winPct: string; mode: "rl" | "ou" }) {
  const label = mode === "ou"
    ? `High-edge pick \u2014 Edge \u2265 ${OU_FREE_EDGE_LIMIT} runs`
    : `Premium pick \u2014 Edge \u2265 ${RL_PREMIUM_MARGIN}`;
  return (
    <tr style={{ backgroundColor: "#e8f0ec" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>{"\uD83D\uDD12"}</span>
            <span style={{ fontSize: "0.78rem", color: "#1a6640", fontWeight: 700 }}>{label}</span>
            <span style={{ fontSize: "0.72rem", color: "#555" }}>
              These picks are <strong style={{ color: "#1a6640" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button onClick={onSubscribe} style={{ backgroundColor: "#1a6640", color: "#ffffff", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
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

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct, mode }: {
  onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string; mode: "rl" | "ou";
}) {
  const edgeLimitLabel = mode === "ou" ? `${OU_FREE_EDGE_LIMIT} runs` : `edge ${RL_PREMIUM_MARGIN}`;
  const minLabel = mode === "ou" ? `${OU_MIN_EDGE} runs` : "all RL picks";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ backgroundColor: "#f9fafb", borderRadius: 16, padding: "2rem 1.75rem", maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem" }}>
            {"\uD83D\uDD12"} Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.4rem" }}>Unlock Premium MLB Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge {"\u2265"} {edgeLimitLabel} {"\u2014"} where the model is most accurate</p>
        </div>
        <div style={{ backgroundColor: "#0a1a2f", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks {"\u00B7"} edge {"\u2265"} {edgeLimitLabel}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>picks with edge {"\u2265"} {minLabel}</div>
          </div>
        </div>
        {/* Methodology note */}
        <div style={{ backgroundColor: "#e8f0ec", border: "1px solid #c6dece", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.68rem", color: "#1a6640", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>{"\u2139\uFE0F"} Methodology:</strong>{" "}
            {mode === "rl"
              ? "The run line record includes games where the model projects a strong edge. Away +1.5 covers when the home team wins by 0\u20131 or the away team wins outright. Home -1.5 covers when the home team wins by 2+."
              : "The O/U record tracks under picks (BBMI projects 1.0+ runs below posted total) and over picks (BBMI projects 1.25+ runs above posted total). The Vegas line is captured at a specific point in time \u2014 lines can move between open and first pitch."
            }
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$10</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>One-time {"\u00B7"} No auto-renewal</div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02" style={{ display: "block", backgroundColor: "#16a34a", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Try 7 Days {"\u2192"}</a>
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
          <Link href="/auth?returnTo=/mlb/picks" onClick={onClose} style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>Sign in {"\u2192"}</Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// TODAY'S REPORT CARD
// ────────────────────────────────────────────────────────────────

function TodaysReportCard({ allGames, getLive, mode = "rl", edgeMin = 0 }: {
  allGames: MLBGame[]; getLive: (a: string, h: string, t?: string | null) => LiveGame | undefined; mode?: "rl" | "ou"; edgeMin?: number;
}) {
  const isOU = mode === "ou";
  const results = allGames.reduce((acc, g) => {
    const lg = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
    if (!lg || lg.status === "pre") return acc;
    const { awayScore, homeScore, status } = lg;
    if (awayScore == null || homeScore == null) return acc;

    if (isOU) {
      // Count games with any BBMI O/U pick (under or over watch)
      if (g.bbmiTotal == null || g.vegasTotal == null) return acc;
      const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
      // Trust pipeline's ouPick field for determining if game has a pick
      if (!g.ouPick) return acc;
      const isUnder = g.ouPick === "UNDER";
      const isOver = g.ouPick === "OVER";
      const call = isUnder ? "under" : "over";
      const actual = awayScore + homeScore;

      if (status === "post") {
        // Final: use actual total
        if (actual === g.vegasTotal) { acc.push++; return acc; }
        const went = actual > g.vegasTotal ? "over" : "under";
        if (call === went) acc.wins++; else acc.losses++;
        acc.final++;
      } else if (status === "in") {
        // Live: use estimated pace total
        const lg2 = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
        const inn = lg2?.inning ?? 1;
        const half = lg2?.inningHalf;
        const completedInnings = (half === "Top" || half === "Mid") ? Math.max(inn - 1, 0.5) : inn;
        const estTotal = completedInnings > 0 ? actual * 9 / completedInnings : actual;
        const pacing = estTotal > g.vegasTotal ? "over" : "under";
        if (call === pacing) acc.winning++; else acc.losing++;
        acc.live++;
      }
    } else {
      // Run Line: only games where BBMI makes a pick (model projects away win)
      if (g.rlPick == null) return acc;
      const absMargin = Math.abs(g.bbmiMargin ?? 0);
      if (absMargin < edgeMin) return acc;
      const homeLeadBy = homeScore - awayScore;
      const covers = rlCovers(g.rlPick, homeLeadBy);
      if (status === "in") { if (covers) acc.winning++; else acc.losing++; acc.live++; }
      else if (status === "post") { if (covers) acc.wins++; else acc.losses++; acc.final++; }
    }
    return acc;
  }, { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 });

  const settled = results.wins + results.losses;
  const combined = settled + results.winning + results.losing;
  const combinedWins = results.wins + results.winning;
  if (settled + results.live === 0 && results.push === 0) return null;

  const W = "#1a6640", L = "#dc2626";
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", backgroundColor: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #d4d2cc" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{"\u26BE"} Today&apos;s Report Card</span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#1a6640", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#1a6640", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #d4d2cc" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: settled === 0 ? "#94a3b8" : results.wins >= results.losses ? W : L }}>
            {results.wins}&ndash;{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#444444", marginTop: 4 }}>{isOU ? "O/U Record" : "Run Line Record"}</div>
          <div style={{ fontSize: "0.6rem", color: "#666666", marginTop: 2 }}>{settled} final{results.push > 0 ? ` \u00B7 ${results.push} push` : ""}</div>
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
// SEASONAL BANNERS
// ────────────────────────────────────────────────────────────────

function SeasonalBanner({ totalRecs }: { totalRecs: number }) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Summer validation: Jun 15 - Sep 30
  const isSummer = (month === 6 && day >= 15) || (month >= 7 && month <= 9);
  // Early season: < 100 recs
  const isEarlySeason = totalRecs < 100;

  if (!isSummer && !isEarlySeason) return null;

  return (
    <>
      {isSummer && (
        <div style={{
          maxWidth: 1100, margin: "0 auto 1rem",
          backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706",
          borderRadius: 6, padding: "12px 16px 12px 18px",
          fontSize: "0.75rem", color: "#92400e", lineHeight: 1.6,
        }}>
          <strong>Summer Validation Period:</strong> June 15 {"\u2013"} September 30 results are tracked as a validation cohort. Summer baseball can differ from spring due to roster turnover, bullpen fatigue accumulation, and elevated scoring environments.
        </div>
      )}
      {isEarlySeason && (
        <div style={{
          maxWidth: 1100, margin: "0 auto 1rem",
          backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706",
          borderRadius: 6, padding: "12px 16px 12px 18px",
          fontSize: "0.75rem", color: "#92400e", lineHeight: 1.6,
        }}>
          <strong>Small Sample Size:</strong> Only {totalRecs} recommendations tracked so far. Results may not be statistically significant. Minimum 100 recommendations needed before drawing conclusions.
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// MAIN PAGE CONTENT
// ────────────────────────────────────────────────────────────────

function MLBPicksContent() {
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
      name: "BBMI Today's Picks \u2013 MLB Predictions",
      description: "Live MLB run lines, BBMI model picks, pitcher matchups, and win probabilities for today's games.",
      url: "https://bbmisports.com/mlb/picks", dateModified: new Date().toISOString().split("T")[0],
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // ── Data processing ─────────────────────────────────────────
  const allGames = useMemo(() => {
    const raw = (games as unknown as MLBGame[]).filter(g => g.homeTeam && g.awayTeam);
    const seen = new Set<string>();
    return raw.filter(g => { if (seen.has(g.gameId)) return false; seen.add(g.gameId); return true; });
  }, []);
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

  // ── Run Line Stats (all validated RL picks) ──
  const rlEdgeStats = useMemo(() => {
    // Only validated picks that meet current thresholds (margin >= 1.0 or Ace)
    const qualified = historicalGames.filter(g => g.rlPick != null && (Math.abs(g.bbmiMargin ?? 0) >= 1.0 || g.rlConfidenceTier === 4));
    const wins = qualified.filter(g => {
      const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      return rlCovers(g.rlPick, homeLeadBy);
    }).length;
    const overallWinPct = qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "---";

    // Premium: margin >= 1.25 OR Away Ace (tier 4)
    const highEdge = qualified.filter(g => Math.abs(g.bbmiMargin ?? 0) >= RL_PREMIUM_MARGIN || g.rlConfidenceTier === 4);
    const highEdgeWins = highEdge.filter(g => {
      const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      return rlCovers(g.rlPick, homeLeadBy);
    }).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "---";

    // Free: margin < 1.25 and not ACE
    const freeEdge = qualified.filter(g => Math.abs(g.bbmiMargin ?? 0) < RL_PREMIUM_MARGIN && g.rlConfidenceTier !== 4);
    const freeEdgeWins = freeEdge.filter(g => {
      const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      return rlCovers(g.rlPick, homeLeadBy);
    }).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "---";

    const overallROI = calcROI(wins, qualified.length - wins, RL_JUICE);
    const highEdgeROI = calcROI(highEdgeWins, highEdge.length - highEdgeWins, RL_JUICE);

    return {
      overallWinPct, total: qualified.length, overallROI,
      highEdgeWinPct, highEdgeTotal: highEdge.length, highEdgeROI,
      freeEdgeWinPct, freeEdgeTotal: freeEdge.length,
    };
  }, [historicalGames]);

  // ── Run Line performance by margin bucket ──
  const rlEdgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "\u25CF", min: 1.00, max: RL_STRONG_MARGIN, aceOnly: false, excludeAce: false },
      { name: "\u25CF\u25CF", min: RL_STRONG_MARGIN, max: RL_PREMIUM_MARGIN, aceOnly: false, excludeAce: false },
      { name: "\u25CF\u25CF\u25CF", min: RL_PREMIUM_MARGIN, max: Infinity, aceOnly: false, excludeAce: true },
      { name: "\u25CF\u25CF\u25CF\u25CF ACE", min: 0.00, max: Infinity, aceOnly: true, excludeAce: false },
    ];
    return cats.map(cat => {
      const catGames = historicalGames.filter(g => {
        if (g.rlPick == null) return false;
        const am = Math.abs(g.bbmiMargin ?? 0);
        const inRange = am >= cat.min && am < cat.max;
        if (cat.aceOnly) {
          return g.rlConfidenceTier === 4;
        }
        if (cat.excludeAce && g.rlConfidenceTier === 4) return false;
        return inRange;
      });
      const wins = catGames.filter(g => {
        const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        return rlCovers(g.rlPick, homeLeadBy);
      }).length;
      const { low, high } = wilsonCI(wins, catGames.length);
      return {
        name: cat.name, games: catGames.length, wins,
        winPct: catGames.length > 0 ? ((wins / catGames.length) * 100).toFixed(1) : "---",
        roi: calcROI(wins, catGames.length - wins, RL_JUICE),
        ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── Run Line historical summary ──
  const rlHistoricalStats = useMemo(() => {
    const qualified = historicalGames.filter(g => g.rlPick != null && (Math.abs(g.bbmiMargin ?? 0) >= 1.0 || g.rlConfidenceTier === 4));
    const wins = qualified.filter(g => {
      const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      return rlCovers(g.rlPick, homeLeadBy);
    }).length;
    return {
      total: qualified.length,
      winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "---",
      roi: calcROI(wins, qualified.length - wins, RL_JUICE),
    };
  }, [historicalGames]);

  // ── O/U parallel stats ──────────────────────────────────────
  const ouIsWin = (g: MLBGame): boolean | null => {
    if (g.bbmiTotal == null || g.vegasTotal == null || g.bbmiTotal === g.vegasTotal) return null;
    const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
    if (edge < OU_MIN_EDGE) return null;
    const call = g.bbmiTotal < g.vegasTotal ? "under" : "over";
    const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
    if (actual === g.vegasTotal) return null;
    return call === (actual > g.vegasTotal ? "over" : "under");
  };

  const ouEdgeStats = useMemo(() => {
    // Under picks: proj < posted, edge >= 1.00
    const underPicks = historicalGames.filter(g =>
      g.bbmiTotal != null && g.vegasTotal != null &&
      g.bbmiTotal! < g.vegasTotal! &&
      Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_MIN_EDGE
    );
    // Over picks: proj > posted, edge >= 1.25
    const overPicks = historicalGames.filter(g =>
      g.bbmiTotal != null && g.vegasTotal != null &&
      g.bbmiTotal! > g.vegasTotal! &&
      Math.abs(g.bbmiTotal! - g.vegasTotal!) >= 1.25
    );
    // Combined: all BBMI O/U picks
    const qualified = [...underPicks, ...overPicks];
    const wins = qualified.filter(g => ouIsWin(g) === true).length;
    const overallWinPct = qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "---";

    // Premium: under edge >= 1.25 OR over edge >= 1.25
    const highEdge = qualified.filter(g => Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter(g => ouIsWin(g) === true).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "---";

    // Free: under picks with edge 1.00 to 1.25
    const freeEdge = underPicks.filter(g => {
      const e = Math.abs(g.bbmiTotal! - g.vegasTotal!);
      return e >= OU_MIN_EDGE && e < OU_FREE_EDGE_LIMIT;
    });
    const freeEdgeWins = freeEdge.filter(g => ouIsWin(g) === true).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "---";

    return {
      overallWinPct, total: qualified.length,
      overallROI: calcROI(wins, qualified.length - wins),
      highEdgeWinPct, highEdgeTotal: highEdge.length,
      highEdgeROI: calcROI(highEdgeWins, highEdge.length - highEdgeWins),
      freeEdgeWinPct, freeEdgeTotal: freeEdge.length,
    };
  }, [historicalGames]);

  const ouHistoricalStats = useMemo(() => {
    // Under picks + Over picks combined
    const underPicks = historicalGames.filter(g =>
      g.bbmiTotal != null && g.vegasTotal != null &&
      g.bbmiTotal! < g.vegasTotal! &&
      Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_MIN_EDGE
    );
    const overPicks = historicalGames.filter(g =>
      g.bbmiTotal != null && g.vegasTotal != null &&
      g.bbmiTotal! > g.vegasTotal! &&
      Math.abs(g.bbmiTotal! - g.vegasTotal!) >= 1.25
    );
    const qualified = [...underPicks, ...overPicks];
    const wins = qualified.filter(g => ouIsWin(g) === true).length;
    return {
      total: qualified.length,
      winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "---",
      roi: calcROI(wins, qualified.length - wins),
    };
  }, [historicalGames]);

  const ouEdgePerformanceStats = useMemo(() => {
    const rows = [
      // Under confidence tiers
      {
        name: "\u2193 Under \u25CF",
        filter: (g: MLBGame) => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal! < g.vegasTotal! && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_MIN_EDGE && Math.abs(g.bbmiTotal! - g.vegasTotal!) < OU_FREE_EDGE_LIMIT,
      },
      {
        name: "\u2193 Under \u25CF\u25CF",
        filter: (g: MLBGame) => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal! < g.vegasTotal! && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_FREE_EDGE_LIMIT && Math.abs(g.bbmiTotal! - g.vegasTotal!) < 1.50,
      },
      {
        name: "\u2193 Under \u25CF\u25CF\u25CF",
        filter: (g: MLBGame) => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal! < g.vegasTotal! && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= 1.50,
      },
      // Over confidence tiers (1 dot >= 1.25, 2 dots >= 1.50)
      {
        name: "\u2191 Over \u25CF",
        filter: (g: MLBGame) => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal! > g.vegasTotal! && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= OU_FREE_EDGE_LIMIT && Math.abs(g.bbmiTotal! - g.vegasTotal!) < 1.50,
      },
      {
        name: "\u2191 Over \u25CF\u25CF",
        filter: (g: MLBGame) => g.bbmiTotal != null && g.vegasTotal != null && g.bbmiTotal! > g.vegasTotal! && Math.abs(g.bbmiTotal! - g.vegasTotal!) >= 1.50,
      },
    ];
    return rows.map(row => {
      const cg = historicalGames.filter(row.filter);
      const wins = cg.filter(g => ouIsWin(g) === true).length;
      const { low, high } = wilsonCI(wins, cg.length);
      return {
        name: row.name, games: cg.length, wins,
        winPct: cg.length > 0 ? ((wins / cg.length) * 100).toFixed(1) : "0.0",
        roi: calcROI(wins, cg.length - wins),
        ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── Model maturity ──────────────────────────────────────────
  const modelMaturity = useMemo(() => {
    // Determine maturity based on total tracked picks, not pipeline label
    const totalTracked = historicalGames.filter(g =>
      g.actualHomeScore != null && (g.rlPick != null || g.ouPick === "UNDER")
    ).length;
    if (totalTracked < 100) return "early_season";
    if (totalTracked < 500) return "calibrating";
    if (totalTracked < 1500) return "calibrated";
    return "mature";
  }, [todaysGames]);

  // ── Graph data ──────────────────────────────────────────────
  const rlGraphGames = useMemo(() =>
    historicalGames.filter(g => g.rlPick != null).map(g => ({
      date: g.date,
      away: g.awayTeam,
      home: g.homeTeam,
      vegasHomeLine: g.vegasRunLine,
      bbmiHomeLine: g.bbmiMargin ? -g.bbmiMargin : null,
      actualAwayScore: g.actualAwayScore,
      actualHomeScore: g.actualHomeScore,
      fakeBet: 100,
      fakeWin: (() => {
        const homeLeadBy = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        return rlCovers(g.rlPick, homeLeadBy) ? 100 : 0;
      })(),
    })),
  [historicalGames]);

  const ouGraphGames = useMemo(() =>
    historicalGames
      .filter(g =>
        g.bbmiTotal != null && g.vegasTotal != null &&
        (
          (g.bbmiTotal < g.vegasTotal && Math.abs(g.bbmiTotal - g.vegasTotal) >= OU_MIN_EDGE) ||
          (g.bbmiTotal > g.vegasTotal && Math.abs(g.bbmiTotal - g.vegasTotal) >= OU_FREE_EDGE_LIMIT)
        )
      )
      .map(g => ({
        date: g.date, away: g.awayTeam, home: g.homeTeam,
        vegasHomeLine: g.vegasRunLine, bbmiHomeLine: g.bbmiMargin ? -g.bbmiMargin : null,
        actualAwayScore: g.actualAwayScore, actualHomeScore: g.actualHomeScore,
        fakeBet: 100,
        fakeWin: (() => { const hit = ouIsWin(g); return hit === true ? 100 : 0; })(),
        vegasTotal: g.vegasTotal, bbmiTotal: g.bbmiTotal,
        totalPick: g.bbmiTotal! < g.vegasTotal! ? "under" : "over",
        totalResult: (() => {
          if (g.actualHomeScore == null || g.actualAwayScore == null || g.vegasTotal == null) return null;
          const a = g.actualHomeScore + g.actualAwayScore;
          return a > g.vegasTotal ? "over" : a < g.vegasTotal ? "under" : "push";
        })(),
        actualTotal: g.actualHomeScore != null && g.actualAwayScore != null ? g.actualHomeScore + g.actualAwayScore : null,
      })),
  [historicalGames]);

  // ── Edge filter options ─────────────────────────────────────
  const rlEdgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: "1.00+", min: 1.00, max: Infinity },
    { label: "1.15+", min: 1.15, max: Infinity },
    { label: "1.30+", min: 1.30, max: Infinity },
    { label: "1.50+", min: 1.50, max: Infinity },
  ];

  const ouEdgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: "1.00+", min: 1.00, max: Infinity },
    { label: "1.25+", min: 1.25, max: Infinity },
    { label: "1.50+", min: 1.50, max: Infinity },
    { label: "2.00+", min: 2.00, max: Infinity },
  ];

  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"rl" | "ou">(() => searchParams.get("mode") === "rl" ? "rl" : "ou");

  const edgeOptions = mode === "rl" ? rlEdgeOptions : ouEdgeOptions;
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);

  // Reset filter when mode changes
  useEffect(() => {
    setEdgeOption(mode === "rl" ? rlEdgeOptions[0] : ouEdgeOptions[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Games filtering ─────────────────────────────────────────

  // Run Line: show games where model projects away win (margin > 0) and has vegas run line
  const rlGamesReady = useMemo(() =>
    todaysGames.filter(g => g.vegasRunLine != null && g.bbmiMargin != null),
  [todaysGames]);

  // O/U: show games with both totals
  const ouGamesReady = useMemo(() =>
    todaysGames.filter(g => g.vegasTotal != null && g.bbmiTotal != null),
  [todaysGames]);

  const gamesWithVegas = mode === "rl" ? rlGamesReady : ouGamesReady;

  // Games with no Vegas line at all
  const gamesNoVegas = useMemo(() =>
    todaysGames.filter(g => (g.vegasRunLine == null && g.vegasTotal == null) && g.actualHomeScore == null),
  [todaysGames]);

  const [noVegasOpen, setNoVegasOpen] = useState(false);

  // Active stats based on mode
  const activeEdgeStats = mode === "rl" ? rlEdgeStats : ouEdgeStats;
  const activeHistoricalStats = mode === "rl" ? rlHistoricalStats : ouHistoricalStats;
  const activeEdgePerformanceStats = mode === "rl" ? rlEdgePerformanceStats : ouEdgePerformanceStats;
  const activeEdgeLimit = mode === "rl" ? RL_PREMIUM_MARGIN : OU_FREE_EDGE_LIMIT;
  const activeBaseRate = mode === "rl" ? RL_BASE_RATE : OU_BASE_RATE;

  const filteredGames = useMemo(() => {
    let g = gamesWithVegas;
    if (edgeOption.label !== "All Games") {
      g = g.filter(game => {
        if (mode === "ou") {
          const edge = Math.abs((game.bbmiTotal ?? 0) - (game.vegasTotal ?? 0));
          return edge >= edgeOption.min && edge < edgeOption.max;
        } else {
          // RL: only show validated picks when edge filter is active
          if (game.rlPick == null) return false;
          const edge = Math.abs(game.bbmiMargin ?? 0);
          return edge >= edgeOption.min && edge < edgeOption.max;
        }
      });
    }
    return g;
  }, [gamesWithVegas, edgeOption, mode]);

  // ── Sort ────────────────────────────────────────────────────
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "bbmiPick", direction: "desc" });
  const handleSort = (columnKey: SortKey) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedGames = useMemo(() => {
    const withComputed = filteredGames.map(g => ({
      ...g,
      _edge: mode === "ou"
        ? Math.abs(g.ouEdge ?? 0)
        : Math.abs(g.bbmiMargin ?? 0),
      _pick: mode === "ou"
        ? ((g.bbmiTotal != null && g.vegasTotal != null)
          ? (g.bbmiTotal > g.vegasTotal ? "over" : g.bbmiTotal < g.vegasTotal ? "under" : "")
          : "")
        : (g.rlPick != null ? (g.rlPick.includes("-1.5") ? g.homeTeam : g.awayTeam) : ""),
    }));
    return [...withComputed].sort((a, b) => {
      const { key, direction } = sortConfig;
      let av: number | string = 0, bv: number | string = 0;
      if (key === "edge") { av = a._edge; bv = b._edge; }
      else if (key === "away") { av = a.awayTeam; bv = b.awayTeam; }
      else if (key === "home") { av = a.homeTeam; bv = b.homeTeam; }
      else if (key === "vegasLine") { av = a.vegasRunLine ?? 0; bv = b.vegasRunLine ?? 0; }
      else if (key === "bbmiLine") { av = Math.abs(a.bbmiMargin ?? 0); bv = Math.abs(b.bbmiMargin ?? 0); }
      else if (key === "homeWinPct") { av = a.homeWinPct ?? 0; bv = b.homeWinPct ?? 0; }
      else if (key === "vegasWinProb") { av = a.vegasWinProb ?? 0; bv = b.vegasWinProb ?? 0; }
      else if (key === "bbmiPick") {
        // Sort validated picks first, then by edge within each group
        const aHasPick = mode === "rl"
          ? (a.rlPick != null ? 1 : 0)
          : (a._pick ? 1 : 0);
        const bHasPick = mode === "rl"
          ? (b.rlPick != null ? 1 : 0)
          : (b._pick ? 1 : 0);
        if (aHasPick !== bHasPick) return direction === "desc" ? bHasPick - aHasPick : aHasPick - bHasPick;
        av = a._edge; bv = b._edge; // secondary sort by edge
      }
      else if (key === "bbmiTotal") { av = a.bbmiTotal ?? 0; bv = b.bbmiTotal ?? 0; }
      else if (key === "vegasTotal") { av = a.vegasTotal ?? 0; bv = b.vegasTotal ?? 0; }
      if (typeof av === "number" && typeof bv === "number") return direction === "asc" ? av - bv : bv - av;
      return direction === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filteredGames, sortConfig, mode]);

  // Split into recommended and below-threshold
  const isMLBRecommended = (g: typeof sortedGames[0]) => {
    if (mode === "rl") return g.rlPick != null;
    // O/U mode: trust the pipeline's ouPick field (set when edge >= OU_MIN_EDGE)
    return g.ouPick != null;
  };

  const recommendedGames = sortedGames.filter(g => isMLBRecommended(g));
  const belowThresholdGames = sortedGames.filter(g => !isMLBRecommended(g));
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);

  const recLabel = mode === "rl"
    ? `${recommendedGames.length} run line picks`
    : `${recommendedGames.filter(g => g._pick === "over").length} over, ${recommendedGames.filter(g => g._pick === "under").length} under`;

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  const lockedCount = sortedGames.filter(g => {
    if (mode === "rl") return !isPremium && g.rlPick != null && (Math.abs(g.bbmiMargin ?? 0) >= RL_PREMIUM_MARGIN || g.rlConfidenceTier === 4);
    return !isPremium && g.ouPick != null && g._edge >= OU_FREE_EDGE_LIMIT;
  }).length;

  const hasLiveGames = sortedGames.some(g => getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC)?.status === "in");

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  // Total recs for seasonal banner
  const totalRecs = mode === "rl" ? rlHistoricalStats.total : ouHistoricalStats.total;

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={activeEdgeStats.highEdgeWinPct} highEdgeTotal={activeEdgeStats.highEdgeTotal} overallWinPct={activeEdgeStats.overallWinPct} mode={mode} />}

      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

          {/* ── HEADER ──────────────────────────── */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a6640", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              MLB &middot; Updated daily
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 14px" }}>
              Today&apos;s Game Lines
            </h1>
            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
              {(["ou", "rl"] as const).map((m) => (
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
          </div>

          {/* ── SEASONAL BANNERS ──────────────────────────── */}
          <SeasonalBanner totalRecs={totalRecs} />

          {/* ── HEADLINE STATS ─────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
            {(mode === "rl" ? [
              { value: `${activeEdgeStats.freeEdgeWinPct}%`, label: "FREE PICKS", sub: `BBMI picks, edge \u2265 1.0 and < ${RL_PREMIUM_MARGIN}`, premium: false },
              { value: `${activeEdgeStats.highEdgeWinPct}%`, label: "PREMIUM PICKS", sub: `BBMI picks, edge \u2265 ${RL_PREMIUM_MARGIN}`, premium: true },
              { value: `${activeHistoricalStats.winPct}%`, label: "ALL BBMI PICKS", sub: `${activeHistoricalStats.total > 0 ? activeHistoricalStats.total.toLocaleString() : "0"} picks`, premium: false },
            ] : [
              { value: `${activeEdgeStats.freeEdgeWinPct}%`, label: "FREE PICKS", sub: `edge ${OU_MIN_EDGE}\u2013${OU_FREE_EDGE_LIMIT} runs`, premium: false },
              { value: `${activeEdgeStats.highEdgeWinPct}%`, label: "PREMIUM PICKS", sub: `edge \u2265 ${OU_FREE_EDGE_LIMIT} runs`, premium: true },
              { value: `${activeHistoricalStats.winPct}%`, label: "ALL BBMI PICKS", sub: `${activeHistoricalStats.total > 0 ? activeHistoricalStats.total.toLocaleString() : "0"} picks`, premium: false },
            ]).map(card => (
                <div key={card.label} style={{
                  background: card.premium ? "#e8f0ec" : "#ffffff",
                  borderRadius: 10,
                  border: card.premium ? "2px solid #1a6640" : "1px solid #d4d2cc",
                  borderTop: "4px solid #1a6640",
                  padding: "14px 14px 12px",
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: card.premium ? "#1a6640" : "#777", marginBottom: 6 }}>{card.label}</div>
                    <div style={{ fontSize: card.premium ? 28 : 24, fontWeight: card.premium ? 700 : 500, color: "#1a6640", lineHeight: 1.1 }}>{card.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#222", marginTop: 4 }}>{card.sub}</div>
                  </div>
                </div>
              ))}
          </div>

          {/* ── EDGE PERFORMANCE GRAPH ─────────────────────── */}
          {(() => {
            const graphGames = mode === "rl" ? rlGraphGames : ouGraphGames;
            const dates = [...new Set(graphGames.map(g => g.date?.split("T")[0]?.slice(0, 10)).filter(Boolean))].sort();
            const firstDate = dates[0];
            const lastDate = dates[dates.length - 1];
            const spanDays = firstDate && lastDate ? (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / 86400000 : 0;
            return spanDays >= 21;
          })() && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{
                backgroundColor: "#ffffff",
                borderRadius: 10,
                border: "1px solid #d4d2cc",
                padding: "20px 20px 16px",
              }}>
                <EdgePerformanceGraph
                  games={mode === "rl" ? rlGraphGames : ouGraphGames}
                  groupBy="week"
                  periodsToShow={8}
                  showTitle={true}
                  edgeCategories={mode === "rl" ? MLB_RL_EDGE_CATEGORIES : MLB_OU_EDGE_CATEGORIES}
                  mode={mode === "rl" ? "ats" : "ou"}
                />
              </div>
            </div>
          )}

          {/* ── METHODOLOGY NOTE ───────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              {mode === "rl" ? (
                <>
                  {"\u2020"} Record includes games where the model projects a strong run line edge. Away +1.5 covers when the home team wins by 0{"\u2013"}1 or the away team wins outright. Home -1.5 covers when the home team wins by 2+.{" "}
                  Away Ace ({"\u25CF\u25CF\u25CF\u25CF"}) picks require both margin conviction and a team pitching quality advantage (FIP differential).{" "}
                  <Link href="/mlb/accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View model history {"\u2192"}</Link>
                </>
              ) : (
                <>
                  {"\u2020"} Under picks require BBMI projection {OU_MIN_EDGE}+ runs below the posted total.{" "}
                  Over picks are CCS-gated and available June through September.{" "}
                  <Link href="/mlb/accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>View model history {"\u2192"}</Link>
                </>
              )}
            </p>
          </div>

          {/* ── PITCHER/LINES NOTE ──────────────────────────── */}
          <div style={{
            maxWidth: 1100, margin: "0 auto 1.25rem",
            backgroundColor: "#e8f0ec", borderTop: "1px solid #c6dece", borderRight: "1px solid #c6dece", borderBottom: "1px solid #c6dece", borderLeft: "4px solid #1a6640",
            borderRadius: 6, padding: "12px 16px 12px 18px",
            fontSize: "0.75rem", color: "#1a6640", lineHeight: 1.6,
          }}>
            BBMI projections include FIP-based pitcher quality adjustments for confirmed starters.
            Pitcher status is shown as Confirmed, Projected, or Opener.
            Lines update daily from the pipeline.
          </div>

          {/* ── HIGH EDGE CALLOUT ──────────────────────────── */}
          {isPremium === false && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e8f0ec", borderTop: "1px solid #e7e5e4", borderRight: "1px solid #e7e5e4", borderBottom: "1px solid #e7e5e4", borderLeft: "4px solid #1a6640", borderRadius: 6, padding: "12px 16px 12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "1.5rem", fontWeight: 900, color: "#1a6640", lineHeight: 1 }}>{activeEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "#78716c" }}>
                    win rate on {mode === "rl" ? `picks with edge \u2265 ${RL_PREMIUM_MARGIN}` : `picks with edge \u2265 ${OU_FREE_EDGE_LIMIT} runs`}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#a8a29e", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "#78716c" }}>{activeEdgeStats.freeEdgeWinPct}%</strong> free {"\u00B7"} documented across <strong style={{ color: "#78716c" }}>{activeEdgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#1a5c38", fontWeight: 700 }}>{"\uD83D\uDD12"} {lockedCount} premium {lockedCount === 1 ? "pick" : "picks"} locked today</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#1a6640", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $10 {"\u2192"}
                </button>
              </div>
            </div>
          )}

          {/* ── EDGE PERFORMANCE GRAPH (rendered in stat cards section) ── */}

          {/* ── EDGE PERFORMANCE STATS TABLE ───────────────── */}
          {historicalGames.length > 10 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#eae8e1", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", color: "#333333" }}>
                  Historical Performance by Confidence Tier
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Confidence", "Games", "Win %", "ROI", "95% CI"].map(h => (
                        <th key={h} style={{ backgroundColor: "#eae8e1", color: "#444444", padding: "8px 10px", textAlign: "right", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #d4d2cc" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEdgePerformanceStats.map((stat, idx) => {
                      // Insert FREE/PREMIUM divider between Tier 2 and Tier 3 in RL mode
                      const premiumStart = mode === "rl" ? 2 : (mode === "ou" ? 1 : -1);
                      const showFreeLabel = idx === 0;
                      const showPremiumLabel = idx === premiumStart;

                      return (
                      <React.Fragment key={idx}>
                        {showFreeLabel && (
                          <tr><td colSpan={5} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#1a6640", backgroundColor: "#e8f0ec", borderTop: "1px solid #c6dece", textTransform: "uppercase", letterSpacing: "0.08em" }}>Free Picks</td></tr>
                        )}
                        {showPremiumLabel && (
                          <tr><td colSpan={5} style={{ padding: "6px 14px", fontSize: 10, fontWeight: 700, color: "#1a6640", backgroundColor: "#e8f0ec", borderTop: "2px solid #1a6640", textTransform: "uppercase", letterSpacing: "0.08em" }}>Premium Picks</td></tr>
                        )}
                      <tr style={{ backgroundColor: idx % 2 === 0 ? "rgba(245,245,244,0.6)" : "#f9fafb" }}>
                        {(() => {
                          // Mute all colors until 100+ games — tiny samples are not meaningful
                          const totalGamesInTable = activeEdgePerformanceStats.reduce((s, st) => s + st.games, 0);
                          const useMuted = totalGamesInTable < 100;
                          const winColor = useMuted ? "#78716c" : Number(stat.winPct) >= activeBaseRate ? "#157a3a" : "#dc2626";
                          const roiColor = useMuted ? "#78716c" : Number(stat.roi) >= 0 ? "#16a34a" : "#dc2626";
                          return (
                            <>
                              <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 14, fontWeight: 600, textAlign: "right", color: "#0a1a2f" }}>{stat.name}</td>
                              <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "right", fontFamily: "ui-monospace, monospace", color: "#57534e" }}>{stat.games.toLocaleString()}</td>
                              <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: winColor }}>{stat.winPct}%</td>
                              <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: roiColor }}>
                                {Number(stat.roi) >= 0 ? "+" : ""}{stat.roi}%
                              </td>
                              <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "right", fontFamily: "ui-monospace, monospace", color: "#78716c", fontStyle: "italic", whiteSpace: "nowrap" }}>
                                {stat.ciLow.toFixed(1)}%{"\u2013"}{stat.ciHigh.toFixed(1)}%
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                        ROI calculated at {mode === "rl" ? "median \u2212156 away +1.5 juice (typical: \u2212130 to \u2212180)" : "standard \u2212110 juice"} {"\u00B7"} Reference: {mode === "rl" ? `away +1.5 base rate ${RL_BASE_RATE}%` : `O/U base rate ${OU_BASE_RATE}%`} {"\u00B7"} 95% CI uses Wilson score method.
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── HOW TO USE ─────────────────────────────────── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#e8f0ec", borderTop: "1px solid #c6dece", borderRight: "1px solid #c6dece", borderBottom: "1px solid #c6dece", borderLeft: "4px solid #1a6640", borderRadius: 6, padding: "12px 16px 12px 18px" }}>
            <p style={{ fontSize: "0.82rem", color: "#1a5c38", margin: 0 }}>
              <strong>How to use this page:</strong>{" "}
              {mode === "rl" ? (
                <>Free picks (edge &lt; {RL_PREMIUM_MARGIN}) are shown below.{" "}</>
              ) : (
                <>Free picks (edge &lt; {OU_FREE_EDGE_LIMIT} runs) are shown below.{" "}</>
              )}
              {!isPremium && <span>Subscribe to unlock <strong>premium picks</strong> {"\u2014"} the model&apos;s highest-conviction selections.</span>}
              {isPremium && <span>You have full access {"\u2014"} use the edge filter to focus on the model&apos;s strongest picks.</span>}
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
                      border: isActive ? "2px solid #1a6640" : "1px solid #c0bdb5",
                      backgroundColor: isActive ? "#1a6640" : "transparent",
                      color: isActive ? "#ffffff" : "#555",
                      fontSize: "0.85rem", fontWeight: isActive ? 700 : 500, cursor: "pointer",
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
          {/* ── STATUS LINE (scores + model maturity combined) ──── */}
          <div style={{ maxWidth: 1100, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 6, fontSize: "0.72rem", color: "#78716c", fontWeight: 500, paddingLeft: 4 }}>
            {liveLoading ? (
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
            ) : hasLiveGames ? (
              <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
            ) : (
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
            )}
            <span>
              {liveLoading ? "Loading live scores\u2026" : hasLiveGames
                ? `Live scores updating \u00B7 ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via MLB Stats API \u00B7 Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "\u2014"}`
              }
              {" \u00B7 Model: "}
              {modelMaturity === "early_season" ? "Early Season" : modelMaturity === "calibrating" ? "Calibrating" : modelMaturity === "calibrated" ? "Calibrated" : "Mature"}
            </span>
          </div>

          {/* ── TODAY'S REPORT CARD ─────────────────────────── */}
          <TodaysReportCard allGames={todaysGames} getLive={getLive} mode={mode} edgeMin={edgeOption.min} />

          {/* ── PICKS TABLE ────────────────────────────────── */}
          {gamesWithVegas.length > 0 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1050 }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        Score
                      </th>
                      <SortableHeader label="Away"        columnKey="away"         tooltipId="away"         align="left" {...headerProps} />
                      <SortableHeader label="Home"        columnKey="home"         tooltipId="home"         align="left" {...headerProps} />
                      <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        <div>Pitchers</div>
                        <div style={{ fontSize: "0.5rem", fontWeight: 500, letterSpacing: "0.04em", color: "rgba(255,255,255,0.6)", textTransform: "none", marginTop: 2 }}>Name {"\u00B7"} Status {"\u00B7"} Team FIP</div>
                      </th>
                      {mode === "rl" ? (
                        <>
                          <SortableHeader label="Run Line"     columnKey="vegasLine"    tooltipId="vegasLine"                 {...headerProps} />
                          <SortableHeader label="BBMI EDGE"  columnKey="edge"         tooltipId="edge"                      {...headerProps} />
                          <SortableHeader label="BBMI Pick"    columnKey="bbmiPick"     tooltipId="bbmiPick"     align="left" {...headerProps} />
                          <SortableHeader label="BBMI Win%"    columnKey="homeWinPct"   tooltipId="homeWinPct"                {...headerProps} />
                          <SortableHeader label="Vegas Win%"   columnKey="vegasWinProb" tooltipId="vegasWinProb"              {...headerProps} />
                        </>
                      ) : (
                        <>
                          <SortableHeader label="Vegas O/U"    columnKey="vegasTotal"   tooltipId="vegasTotal"                {...headerProps} />
                          <SortableHeader label="BBMI Total"   columnKey="bbmiTotal"    tooltipId="bbmiTotal"                 {...headerProps} />
                          <SortableHeader label="BBMI EDGE"    columnKey="edge"         tooltipId="edge"                      {...headerProps} />
                          <SortableHeader label="BBMI Pick"    columnKey="bbmiPick"     tooltipId="bbmiPick"     align="left" {...headerProps} />
                          <SortableHeader label="Actual"       columnKey="homeWinPct"   tooltipId="actual"                    {...headerProps} />
                          <SortableHeader label="Result"       columnKey="vegasWinProb" tooltipId="result"                    {...headerProps} />
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedGames.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected filter.</td></tr>
                    )}

                    {/* ── RECOMMENDED PICKS DIVIDER ── */}
                    {recommendedGames.length > 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: "10px 16px", background: "#e8f0ec", borderTop: "3px solid #1a6640", borderBottom: "1px solid #c6dece" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#1a6640" }}>
                            {"\u2714"} Recommended picks {"\u00B7"} {recLabel}
                          </span>
                        </td>
                      </tr>
                    )}

                    {recommendedGames.map((g, i) => {
                      const edge = g._edge;
                      const pick = g._pick;
                      const isLocked = mode === "rl"
                        ? (!isPremium && g.rlPick != null && (Math.abs(g.bbmiMargin ?? 0) >= RL_PREMIUM_MARGIN || g.rlConfidenceTier === 4))
                        : (!isPremium && g.ouPick != null && edge >= OU_FREE_EDGE_LIMIT);

                      if (isLocked) {
                        return <LockedRowOverlay key={g.gameId + "_locked"} colSpan={10} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} mode={mode} />;
                      }

                      const lg = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
                      const hasPick = mode === "rl"
                        ? (g.rlPick != null)
                        : (pick === "under" && edge >= OU_MIN_EDGE);
                      const isOverCalibrating = mode === "ou" && pick === "over" && edge >= OU_FREE_EDGE_LIMIT;
                      const rowBg = hasPick
                        ? "#fefce8"  // warm gold tint for validated picks
                        : isOverCalibrating
                        ? (i % 2 === 0 ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.04)")
                        : (i % 2 === 0 ? "#ffffff" : "#f8fafc");

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: rowBg, borderLeft: hasPick ? "4px solid #f0c040" : isOverCalibrating ? "4px solid #d97706" : "4px solid transparent" }}>
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
                              <LiveScoreBadge
                                lg={lg} away={g.awayTeam} home={g.homeTeam}
                                mode={mode}
                                bbmiMargin={g.bbmiMargin}
                                vegasTotal={g.vegasTotal}
                                bbmiTotal={g.bbmiTotal}
                                hasPick={hasPick || isOverCalibrating}
                                rlPick={g.rlPick}
                              />
                            )}
                          </td>
                          {/* Away */}
                          <td style={{ ...TD, paddingLeft: 10 }}>
                            <Link href={`/mlb/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                              <MLBLogo teamName={g.awayTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.awayTeam}</span>
                              {(() => { const r = mlbRank(g.awayTeam); return r ? <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(#{r})</span> : null; })()}
                            </Link>
                          </td>
                          {/* Home */}
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                              <MLBLogo teamName={g.homeTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.homeTeam}</span>
                              {(() => { const r = mlbRank(g.homeTeam); return r ? <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>(#{r})</span> : null; })()}
                            </Link>
                          </td>
                          {/* Pitchers — two-line cell with ERA/FIP */}
                          <td style={{ ...TD, textAlign: "center", fontSize: 10.5, lineHeight: 1.4, minWidth: 180 }}>
                            {(() => {
                              const awStatus = g.awayPitcherStatus ?? "tbd";
                              const hmStatus = g.homePitcherStatus ?? "tbd";
                              const awayIsBlank = awStatus === "tbd" || !g.awayPitcher;
                              const homeIsBlank = hmStatus === "tbd" || !g.homePitcher;

                              const statusBadge = (st: string) => {
                                if (st === "confirmed") return <span style={{ fontSize: 7, color: "#16a34a", fontWeight: 700, marginLeft: 3, textTransform: "uppercase" }}>C</span>;
                                if (st === "projected") return <span style={{ fontSize: 7, color: "#6366f1", fontWeight: 700, marginLeft: 3, textTransform: "uppercase" }}>P</span>;
                                if (st === "opener") return <span style={{ fontSize: 7, color: "#f97316", fontWeight: 700, marginLeft: 3, textTransform: "uppercase" }}>OP</span>;
                                return null;
                              };

                              const statLine = (era: number | null, fip: number | null) => {
                                if (era == null && fip == null) return "";
                                const parts = [];
                                if (era != null) parts.push(`${era.toFixed(2)}`);
                                if (fip != null) parts.push(`${fip.toFixed(2)}`);
                                return parts.join(" / ");
                              };

                              return (
                                <>
                                  <div style={{ color: awayIsBlank ? "#d1d5db" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                                    <span>{awayIsBlank ? "TBD" : g.awayPitcher}</span>
                                    {!awayIsBlank && statusBadge(awStatus)}
                                    {!awayIsBlank && (g.awayPitcherERA != null || g.awayPitcherFIP != null) && (
                                      <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 3 }}>{statLine(g.awayPitcherERA, g.awayPitcherFIP)}</span>
                                    )}
                                  </div>
                                  <div style={{ color: "#d1d5db", fontSize: 9 }}>vs</div>
                                  <div style={{ color: homeIsBlank ? "#d1d5db" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                                    <span>{homeIsBlank ? "TBD" : g.homePitcher}</span>
                                    {!homeIsBlank && statusBadge(hmStatus)}
                                    {!homeIsBlank && (g.homePitcherERA != null || g.homePitcherFIP != null) && (
                                      <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 3 }}>{statLine(g.homePitcherERA, g.homePitcherFIP)}</span>
                                    )}
                                  </div>
                                  {awayIsBlank && homeIsBlank && (
                                    <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>Team baseline</div>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          {mode === "rl" ? (
                            <>
                              {/* Run Line — show both sides */}
                              <td style={{ ...TD, fontSize: 11, textAlign: "center", lineHeight: 1.4 }}>
                                {g.vegasRunLine != null ? (
                                  g.vegasRunLine < 0 ? (
                                    <>
                                      <div style={{ color: "#94a3b8" }}>{g.awayTeam.split(" ").pop()} +1.5</div>
                                      <div style={{ fontWeight: 600 }}>{g.homeTeam.split(" ").pop()} -1.5</div>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{ fontWeight: 600 }}>{g.awayTeam.split(" ").pop()} -1.5</div>
                                      <div style={{ color: "#94a3b8" }}>{g.homeTeam.split(" ").pop()} +1.5</div>
                                    </>
                                  )
                                ) : "\u2014"}
                              </td>
                              {/* BBMI EDGE — always show edge value */}
                              <td style={{ ...TD_RIGHT, color: hasPick ? "#1a6640" : "#a8a29e", fontWeight: hasPick ? 700 : 400, fontFamily: "ui-monospace, monospace" }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  {edge.toFixed(2)}
                                  {hasPick && <ConfidenceDots mode="rl" edge={edge} tier={g.rlConfidenceTier} />}
                                </span>
                              </td>
                              {/* BBMI Pick — validated RL picks or em-dash */}
                              <td style={{ ...TD, textAlign: "center", minHeight: 40 }}>
                                {hasPick && pick ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: "#0a1628", whiteSpace: "nowrap" }}>
                                    <MLBLogo teamName={pick} size={16} />
                                    {pick.split(" ").pop()} {g.rlPick?.includes("-1.5") ? "-1.5" : "+1.5"}
                                  </span>
                                ) : (
                                  <span style={{ color: "#a8a29e" }}>{"\u2014"}</span>
                                )}
                              </td>
                              {/* BBMI Win% (away) */}
                              <td style={TD_RIGHT}>{g.awayWinPct != null ? `${(g.awayWinPct * 100).toFixed(0)}%` : g.homeWinPct != null ? `${((1 - g.homeWinPct) * 100).toFixed(0)}%` : "\u2014"}</td>
                              {/* Vegas Win% */}
                              <td style={TD_RIGHT}>{g.vegasWinProb != null ? `${((1 - g.vegasWinProb) * 100).toFixed(0)}%` : "\u2014"}</td>
                            </>
                          ) : (
                            <>
                              <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, fontWeight: 700 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                              {(() => {
                                const isUnderEdge = (g.bbmiTotal ?? 0) < (g.vegasTotal ?? 0);
                                const isOverEdge = !isUnderEdge && edge >= OU_FREE_EDGE_LIMIT;
                                const hasDots = (isUnderEdge && edge >= OU_MIN_EDGE) || isOverEdge;
                                const edgeColor = isUnderEdge && edge >= OU_FREE_EDGE_LIMIT ? "#16a34a"
                                  : isOverEdge ? "#d97706"
                                  : "#374151";
                                return (
                                  <td style={{ ...TD_RIGHT, color: edgeColor, fontWeight: hasDots ? 800 : 600 }}>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                      {g.temp_modifier === "boost" && (
                                        <span title={`${g.temperature_f?.toFixed(0) ?? "?"}°F at game time (${g.temp_deviation_f?.toFixed(0) ?? "?"}° below avg). Temperature does not produce a consistent enough pattern to adjust the projection, but extreme cold adds uncertainty.`} style={{ cursor: "help", fontSize: 12 }}>{"\u2744\uFE0F"}</span>
                                      )}
                                      {g.temp_modifier === "caution" && (
                                        <span title={`${g.temperature_f?.toFixed(0) ?? "?"}°F at game time (+${g.temp_deviation_f?.toFixed(0) ?? "?"}° above avg). Temperature does not produce a consistent enough pattern to adjust the projection, but extreme heat adds uncertainty.`} style={{ cursor: "help", fontSize: 12 }}>{"\uD83C\uDF21\uFE0F"}</span>
                                      )}
                                      {g.wrigleyWindModifier === "wind_in" && (
                                        <span title={`Wind blowing in at Wrigley (${g.wind_speed_mph?.toFixed(0) ?? "?"}mph) \u2014 projection adjusted ${Math.abs(g.wrigley_wind_adj ?? 0).toFixed(1)} runs downward`} style={{ cursor: "help", fontSize: 12 }}>{"\uD83D\uDCA8"}</span>
                                      )}
                                      {g.wrigleyWindModifier === "wind_out" && (
                                        <span title={`Wind blowing out at Wrigley (${g.wind_speed_mph?.toFixed(0) ?? "?"}mph) \u2014 projection adjusted +${Math.abs(g.wrigley_wind_adj ?? 0).toFixed(1)} runs upward`} style={{ cursor: "help", fontSize: 12 }}>{"\uD83D\uDCA8"}</span>
                                      )}
                                      {edge.toFixed(2)}
                                      {hasDots && <ConfidenceDots mode="ou" edge={edge} isOver={isOverEdge} />}
                                    </span>
                                  </td>
                                );
                              })()}
                              <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
                                {(() => {
                                  const ouTier = g.ouConfidenceTier;
                                  const tierStr = typeof ouTier === "string" ? ouTier : null;
                                  const ccs = g.underCCS ?? g.overCCS;

                                  // Under pick
                                  if (g.ouPick === "UNDER") {
                                    return (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                        <span style={{ color: "#2563eb", fontWeight: 700 }}>{"\u2193"} Under</span>
                                        <CCSTierBadge tier={tierStr} ccs={ccs} />
                                      </span>
                                    );
                                  }
                                  // Over pick
                                  if (g.ouPick === "OVER") {
                                    return (
                                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                        <span style={{ color: "#d97706", fontWeight: 700 }}>{"\u2191"} Over</span>
                                        <CCSTierBadge tier={tierStr} ccs={ccs} />
                                      </span>
                                    );
                                  }
                                  // Suppressed — show reason
                                  if (g.ouSuppressed) {
                                    const reason = g.ouSuppressReason === "early_season" ? "Early Season"
                                      : g.ouSuppressReason === "opener" ? "Opener"
                                      : g.ouSuppressReason === "over_seasonal" ? "Seasonal"
                                      : "";
                                    return reason
                                      ? <span style={{ color: "#b0b0b0", fontSize: 10, fontStyle: "italic" }}>{reason}</span>
                                      : <span style={{ color: "#b0b0b0", fontSize: 10, fontStyle: "italic" }}>{"\u2014"}</span>;
                                  }
                                  return <span style={{ color: "#b0b0b0", fontSize: 10, fontStyle: "italic" }}>{"\u2014"}</span>;
                                })()}
                              </td>
                              {/* Actual + Result — show for all picks (under + over) */}
                              {(() => {
                                const hasUnderPick = pick === "under" && edge >= OU_MIN_EDGE;
                                const hasOverPick = pick === "over" && edge >= OU_FREE_EDGE_LIMIT;
                                if (!hasUnderPick && !hasOverPick) {
                                  return <><td style={TD_RIGHT}></td><td style={TD_RIGHT}></td></>;
                                }
                                const liveg = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
                                const hs = liveg?.homeScore; const as_ = liveg?.awayScore;
                                // Actual column — show estimated total pace for in-progress games
                                let actualCell;
                                if (hs != null && as_ != null) {
                                  const actual = hs + as_;
                                  const vt = g.vegasTotal ?? 0;
                                  const isFinal = liveg?.status === "post";
                                  const isLive = liveg?.status === "in";

                                  // Pick direction: green = pick is winning, red = pick is losing
                                  const pickIsOver = pick === "over" && edge >= OU_FREE_EDGE_LIMIT;
                                  const pickColor = (total: number) => {
                                    if (total > vt) return pickIsOver ? "#16a34a" : "#dc2626"; // over pace: good for over picks, bad for under
                                    if (total < vt) return pickIsOver ? "#dc2626" : "#16a34a"; // under pace: good for under picks, bad for over
                                    return "#374151";
                                  };

                                  if (isFinal) {
                                    actualCell = <td style={{ ...TD_RIGHT, fontWeight: 700, color: pickColor(actual) }}>{actual}</td>;
                                  } else if (isLive && liveg?.inning) {
                                    const halfInning = liveg.inningHalf;
                                    const completedInnings = halfInning === "Top" || halfInning === "Mid"
                                      ? Math.max(liveg.inning - 1, 0.5)
                                      : liveg.inning;
                                    const estTotal = completedInnings > 0 ? Math.round(actual * 9 / completedInnings * 10) / 10 : actual;
                                    actualCell = (
                                      <td style={{ ...TD_RIGHT, fontWeight: 700, color: pickColor(estTotal) }} title={`Actual: ${actual} · Est. final: ${estTotal.toFixed(1)}`}>
                                        {actual}
                                        <span style={{ fontSize: 9, marginLeft: 3 }}>({estTotal.toFixed(1)})</span>
                                      </td>
                                    );
                                  } else {
                                    actualCell = <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#374151" }}>{actual}</td>;
                                  }
                                } else {
                                  actualCell = <td style={TD_RIGHT}>{"\u2014"}</td>;
                                }
                                // Result column — only show when game is final
                                let resultCell;
                                if (!liveg || liveg.status !== "post" || hs == null || as_ == null) {
                                  resultCell = <td style={TD_RIGHT}>{"\u2014"}</td>;
                                } else {
                                  const bt = g.bbmiTotal ?? 0; const vt = g.vegasTotal ?? 0;
                                  const call = bt < vt ? "under" : "over";
                                  const actual = hs + as_;
                                  if (actual === vt) {
                                    resultCell = <td style={{ ...TD_RIGHT, color: "#94a3b8" }}>Push</td>;
                                  } else {
                                    const went = actual > vt ? "over" : "under";
                                    const correct = call === went;
                                    resultCell = <td style={{ ...TD_RIGHT, fontWeight: 700, color: correct ? "#16a34a" : "#dc2626" }}>{correct ? "\u2713" : "\u2717"}</td>;
                                  }
                                }
                                return <>{actualCell}{resultCell}</>;
                              })()}
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {/* ── BELOW THRESHOLD ── */}
                    {belowThresholdGames.length > 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: 0 }}>
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
                      const lg = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
                      return (
                        <tr key={g.gameId + "_bt"} style={{ backgroundColor: i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)", opacity: 0.82, color: "#6b7280" }}>
                          <td style={{ ...TD, textAlign: "center", paddingRight: 8 }}>
                            {!lg || lg.status === "pre" ? (
                              <div style={{ minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>{g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : g.date}</span>
                              </div>
                            ) : (
                              <LiveScoreBadge lg={lg} away={g.awayTeam} home={g.homeTeam} mode={mode} bbmiMargin={g.bbmiMargin} bbmiTotal={g.bbmiTotal} vegasTotal={g.vegasTotal} rlPick={g.rlPick} />
                            )}
                          </td>
                          <td style={{ ...TD, paddingLeft: 10 }}>
                            <Link href={`/mlb/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280" }}>
                              <MLBLogo teamName={g.awayTeam} size={20} />
                              <span style={{ fontSize: 12 }}>{g.awayTeam}</span>
                            </Link>
                          </td>
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280" }}>
                              <MLBLogo teamName={g.homeTeam} size={20} />
                              <span style={{ fontSize: 12 }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontSize: 10, color: "#6b7280" }}>
                            {g.awayPitcher || "TBD"} vs {g.homePitcher || "TBD"}
                          </td>
                          {mode === "ou" ? (
                            <>
                              <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, fontWeight: 700 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                              <td style={TD_RIGHT}>{edge > 0 ? edge.toFixed(2) : "\u2014"}</td>
                              <td style={{ ...TD, textAlign: "center", fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>
                                {pick === "over" ? "\u2191 Over" : pick === "under" ? "\u2193 Under" : "\u2014"}
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={TD_RIGHT}>{g.vegasRunLine ?? "\u2014"}</td>
                              <td style={TD_RIGHT}>{edge > 0 ? edge.toFixed(2) : "\u2014"}</td>
                              <td style={{ ...TD, fontSize: 11, color: "#6b7280" }}>{"\u2014"}</td>
                              <td style={TD_RIGHT}>{g.homeWinPct != null ? `${(g.homeWinPct * 100).toFixed(0)}%` : "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.vegasWinProb != null ? `${(g.vegasWinProb * 100).toFixed(0)}%` : "\u2014"}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {isPremium === false && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#e8f0ec" }}>
                        <td colSpan={10} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#1a5c38", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} premium {lockedCount === 1 ? "pick" : "picks"}</strong> locked above {"\u2014"} the model&apos;s highest-conviction selections
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#1a6640", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
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
                        <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</th>
                        <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Away</th>
                        <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Home</th>
                        <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Pitchers</th>
                        <th style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gamesNoVegas.map((g, i) => {
                        const lg = getLive(g.awayTeam, g.homeTeam, g.gameTimeUTC);
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
                              <Link href={`/mlb/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#0a1a2f" }} className="hover:underline">
                                <MLBLogo teamName={g.awayTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                                {(() => { const r = mlbRank(g.awayTeam); return r ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{r})</span> : null; })()}
                              </Link>
                            </td>
                            <td style={TD}>
                              <Link href={`/mlb/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "#0a1a2f" }} className="hover:underline">
                                <MLBLogo teamName={g.homeTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                                {(() => { const r = mlbRank(g.homeTeam); return r ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{r})</span> : null; })()}
                              </Link>
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontSize: 10, color: "#64748b" }}>
                              {g.awayPitcher || "TBD"} vs {g.homePitcher || "TBD"}
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontSize: 11, color: "#92400e", fontWeight: 600 }}>
                              Awaiting lines
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
            <details style={{ backgroundColor: "#e8f0ec", border: "1px solid #c6dece", borderRadius: 10, overflow: "hidden" }}>
              <summary style={{ padding: "0.75rem 1.25rem", fontSize: "0.82rem", fontWeight: 700, color: "#374151", cursor: "pointer", userSelect: "none" }}>
                Methodology &amp; How to Read This Page
              </summary>
              <div style={{ padding: "0 1.25rem 1rem", fontSize: "0.75rem", color: "#1a6640", lineHeight: 1.7 }}>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Run Line (Away +1.5):</strong> The standard MLB run line is -1.5 / +1.5. BBMI generates projected game outcomes using a Negative Binomial model with park factors, FIP-based pitcher quality adjustments, and team offensive ratings (wOBA). When the model projects the away team to win, it recommends away +1.5. The away team covers +1.5 whenever the home team wins by 0{"\u2013"}1 runs or the away team wins outright. MLB base rate for away +1.5 is {RL_BASE_RATE}%.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Over/Under:</strong> BBMI projects total runs scored and compares to the Vegas O/U. Picks are generated when the edge is {OU_MIN_EDGE}+ runs. Picks with edge {"\u2265"} {OU_FREE_EDGE_LIMIT} runs are premium.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>BBMI Edge:</strong> The magnitude of the model&apos;s projected advantage. Larger edge = stronger model conviction. Only games where the model projects an away team advantage generate a run line pick.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Confidence Dots:</strong> Visual indicator of pick strength. Run Line: 1 dot ({"\u2265"}1.00 edge), 2 dots ({"\u2265"}1.15 edge), 3 dots ({"\u2265"}1.25 edge). Under: 1 dot ({"\u2265"}{OU_MIN_EDGE} runs), 2 dots ({"\u2265"}{OU_FREE_EDGE_LIMIT} runs), 3 dots ({"\u2265"}1.50 runs). Over: 1 dot ({"\u2265"}{OU_FREE_EDGE_LIMIT} runs), 2 dots ({"\u2265"}1.50 runs).
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Pitchers:</strong> Starting pitcher matchups with ERA and FIP when available. Status indicators: <span style={{ color: "#16a34a", fontWeight: 700 }}>C</span> = Confirmed, <span style={{ color: "#6366f1", fontWeight: 700 }}>P</span> = Projected, <span style={{ color: "#f97316", fontWeight: 700 }}>OP</span> = Opener. Games with TBD pitchers use team baseline projections.
                </p>
                <p style={{ margin: "0.5rem 0" }}>
                  <strong style={{ color: "#374151" }}>Win %:</strong> BBMI Win% shows the model&apos;s estimated win probability for the picked side. Vegas Win% is implied from the posted moneyline.
                </p>
                <p style={{ margin: "0.5rem 0", color: "#94a3b8", fontStyle: "italic" }}>
                  95% confidence intervals (CI) use the Wilson score method. All run line records count only away-win-projected games.
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

export default function MLBPicksPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}>
        <MLBPicksContent />
      </Suspense>
    </AuthProvider>
  );
}
