"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ------------------------------------------------------------
// COLUMN TOOLTIPS
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  away: "The visiting team.",
  home: "The home team.",
  vegasTotal: "Vegas over/under line \u2014 the sportsbook\u2019s projected total points scored in the game.",
  bbmiTotal: "BBMI\u2019s projected total points scored, based on KenPom efficiency and tempo projections.",
  totalEdge: "The gap between BBMI\u2019s total and the Vegas O/U in points. Larger edge = stronger model conviction. Picks with edge < 2 are faded.",
  totalPick: "BBMI\u2019s over/under call based on whether the projected total is above or below the Vegas line.",
  overOdds: "Sportsbook odds for the over bet, converted to American format (e.g. -110).",
  underOdds: "Sportsbook odds for the under bet, converted to American format (e.g. -110).",
  score: "Live game score or final result. Shows start time for upcoming games.",
  actual: "Actual or pace-adjusted estimated total. For live games, projects final total based on current scoring pace and time remaining.",
  date: "The date the game was played.",
  actualTotal: "Final combined score. Red = went over the Vegas line. Blue = went under.",
  result: "Whether BBMI\u2019s pick was correct (\u2713) or wrong (\u2717). Only counted when edge \u2265 2 pts.",
};
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/firebase-config";
import { AuthProvider, useAuth } from "@/app/AuthContext";
import games from "@/data/betting-lines/games.json";
import backtestData from "@/data/betting-lines/basketball-ou-backtest.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
  vegaswinprob: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  vegasTotal: number | null;
  bbmiTotal: number | null;
  homePtsProj: number | null;
  awayPtsProj: number | null;
  totalEdge: number | null;
  totalPick: string | null;
  overOdds: number | null;
  underOdds: number | null;
  actualTotal: number | null;
  totalResult: string | null;
};

type SortableKey =
  | "away" | "home" | "vegasTotal" | "bbmiTotal"
  | "totalEdge" | "totalPick" | "overOdds" | "underOdds";

// Minimum edge to count in the performance record.
const MIN_EDGE_FOR_RECORD = 2;
const FREE_EDGE_LIMIT = 4;  // pts — premium threshold for O/U picks

/**
 * Round to nearest 0.5 (standard Vegas-style rounding).
 * e.g. 143.9 → 144.0, 152.7 → 152.5, 146.3 → 146.5
 */
function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/**
 * Convert decimal odds (e.g. 1.91) to American format string
 * Decimal >= 2.0 → positive (e.g. 2.50 → "+150")
 * Decimal < 2.0  → negative (e.g. 1.91 → "-110")
 */
function decimalToAmerican(decimal: number): string {
  if (decimal >= 2.0) {
    return `+${Math.round((decimal - 1) * 100)}`;
  }
  return `${Math.round(-100 / (decimal - 1))}`;
}

// ------------------------------------------------------------
// LIVE SCORES — ESPN API (simplified from spreads page)
// ------------------------------------------------------------

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  startTime: string | null;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
}

interface EspnCompetitor {
  homeAway: string;
  score?: string | null;
  team: {
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
  };
}

const TEAM_CROSSWALK: [string, string][] = [
  ["Connecticut",       "UConn"],
  ["Pittsburgh",        "Pitt"],
  ["Mississippi",       "Ole Miss"],
  ["UNLV",              "UNLV"],
  ["VCU",               "VCU"],
  ["SMU",               "SMU"],
  ["TCU",               "TCU"],
  ["North Carolina",    "UNC"],
  ["Appalachian State", "App State"],
  ["Massachusetts",     "UMass"],
  ["Miami",             "Miami"],
  ["Miami (OH)",        "Miami OH"],
  ["St. John's (NY)",   "St. John's"],
  ["Saint Joseph's",    "Saint Joseph's"],
  ["Saint Mary's (CA)", "Saint Mary's"],
  ["Mount St. Mary's",  "Mount St. Mary's"],
  ["Loyola Chicago",    "Loyola IL"],
  ["Loyola Marymount",  "LMU"],
  ["UC Davis",          "UC Davis"],
  ["UC Irvine",         "UC Irvine"],
  ["UC Santa Barbara",  "UC Santa Barbara"],
  ["UC Riverside",      "UC Riverside"],
  ["UC San Diego",      "UC San Diego"],
  ["UTSA",              "UTSA"],
  ["UTEP",              "UTEP"],
  ["Texas-RGV",         "UT Rio Grande Valley"],
  ["UT Rio Grande Valley", "Texas-RGV"],
  ["FIU",               "FIU"],
  ["FAU",               "FAU"],
  ["LSU",               "LSU"],
  ["USC",               "USC"],
  ["UCF",               "UCF"],
  ["UAB",               "UAB"],
  ["Louisiana",         "Louisiana"],
  ["Merrimack",         "Merrimack College"],
  ["Purdue",            "Purdue Boilermakers"],
  ["Saint Francis (PA)", "St. Francis (PA)"],
  ["Central Connecticut", "Central Connecticut State"],
  ["Nicholls State",    "Nicholls"],
  ["McNeese State",     "McNeese State"],
  ["McNeese",           "McNeese State"],
];

const NO_STRIP = new Set([
  "iowa state", "michigan state", "ohio state", "florida state", "kansas state",
  "penn state", "utah state", "fresno state", "san jose state", "boise state",
  "colorado state", "kent state", "ball state", "north carolina state",
  "mississippi state", "washington state", "oregon state", "arizona state",
  "oklahoma state", "texas state", "morgan state", "alcorn state", "coppin state",
  "jackson state", "grambling state", "savannah state", "tennessee state",
  "illinois state", "indiana state", "wichita state", "kennesaw state",
  "portland state", "weber state", "north carolina", "south carolina",
  "north florida", "south florida", "northern iowa", "southern illinois",
  "central michigan", "eastern michigan", "western michigan", "northern michigan",
  "central connecticut", "western kentucky", "eastern kentucky", "northern kentucky",
  "southern mississippi", "northern illinois", "eastern illinois", "western illinois",
  "mcneese state", "nicholls state", "tarleton state", "dixie state", "st. thomas",
  "houston christian", "incarnate word", "southeastern louisiana",
  "stephen f austin", "east texas am", "northwestern state",
]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

const ESPN_TO_BBMI: Record<string, string> = Object.fromEntries(
  TEAM_CROSSWALK.map(([bbmi, espn]) => [norm(espn), norm(bbmi)])
);

function normalizeTeamName(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return ESPN_TO_BBMI[base] ?? base;
}

function normalizeWithoutMascot(name: string): string {
  const n = normalizeTeamName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const withoutLast = words.slice(0, -1).join(" ");
  if (NO_STRIP.has(withoutLast)) return withoutLast;
  return words.length > 1 ? withoutLast : n;
}

function normalizeWithoutTwoWords(name: string): string {
  const n = normalizeTeamName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const withoutOne = words.slice(0, -1).join(" ");
  const withoutTwo = words.length > 2 ? words.slice(0, -2).join(" ") : withoutOne;
  if (NO_STRIP.has(withoutOne)) return withoutOne;
  if (NO_STRIP.has(withoutTwo)) return withoutTwo;
  return words.length > 2 ? withoutTwo : normalizeWithoutMascot(name);
}

function getEspnUrl(): string {
  const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date()).replace(/-/g, "");
  return `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=${ctDate}`;
}

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const res = await fetch(getEspnUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  const data = await res.json();
  const map = new Map<string, LiveGame>();

  const todayLocal = new Date().toLocaleDateString("en-CA");
  const todayUTC = new Date().toISOString().slice(0, 10);
  const tomorrowUTC = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  for (const event of data.events ?? []) {
    const gameDate = (event.date ?? "").slice(0, 10);
    if (gameDate !== todayLocal && gameDate !== todayUTC && gameDate !== tomorrowUTC) continue;

    const comp = event.competitions?.[0];
    if (!comp) continue;

    const awayC = (comp.competitors as EspnCompetitor[]).find((c) => c.homeAway === "away");
    const homeC = (comp.competitors as EspnCompetitor[]).find((c) => c.homeAway === "home");
    if (!awayC || !homeC) continue;

    const st = comp.status ?? event.status;
    const sid = st.type.id;
    const isLive = sid === "2" || sid === "23";
    const status: GameStatus = isLive ? "in" : sid === "3" ? "post" : "pre";

    let statusDisplay = st.type.description;
    if (sid === "23") {
      const p = st.period ?? 1;
      statusDisplay = p === 1 ? "Halftime" : `End OT${p - 2}`;
    } else if (sid === "2") {
      const p = st.period ?? 1;
      const half = p === 1 ? "1st Half" : p === 2 ? "2nd Half" : `OT${p - 2}`;
      statusDisplay = st.displayClock ? `${half} ${st.displayClock}` : half;
    }

    const awayScore = awayC.score != null ? parseInt(awayC.score, 10) : null;
    const homeScore = homeC.score != null ? parseInt(homeC.score, 10) : null;

    const liveGame: LiveGame = {
      awayScore: Number.isNaN(awayScore) ? null : awayScore,
      homeScore: Number.isNaN(homeScore) ? null : homeScore,
      status, statusDisplay,
      startTime: event.date ?? null,
      espnAwayAbbrev: awayC.team.abbreviation ?? awayC.team.shortDisplayName ?? awayC.team.displayName.split(" ")[0],
      espnHomeAbbrev: homeC.team.abbreviation ?? homeC.team.shortDisplayName ?? homeC.team.displayName.split(" ")[0],
    };

    // Index by multiple name variants for reliable matching
    const nameVariants = (c: EspnCompetitor) => [
      normalizeTeamName(c.team.displayName),
      normalizeTeamName(c.team.shortDisplayName),
      normalizeWithoutMascot(c.team.displayName),
      normalizeWithoutMascot(c.team.shortDisplayName),
      normalizeWithoutTwoWords(c.team.displayName),
      normalizeWithoutTwoWords(c.team.shortDisplayName),
    ];

    const awayVariants = nameVariants(awayC);
    const homeVariants = nameVariants(homeC);

    for (const a of awayVariants) {
      for (const h of homeVariants) {
        map.set(`${a}|${h}`, liveGame);
      }
      map.set(`away:${a}`, liveGame);
    }
    for (const h of homeVariants) {
      map.set(`home:${h}`, liveGame);
    }
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
      const map = await fetchEspnScores();
      setLiveScores(map);
      setLastUpdated(new Date());
      const hasLive = Array.from(map.values()).some((g) => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch {
      timerRef.current = setTimeout(load, 120_000);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [load]);

  const getLiveGame = useCallback(
    (away: string, home: string): LiveGame | undefined => {
      const aN = normalizeTeamName(away);
      const hN = normalizeTeamName(home);
      return liveScores.get(`${aN}|${hN}`) ??
        liveScores.get(`away:${aN}`) ??
        liveScores.get(`home:${hN}`);
    },
    [liveScores]
  );

  return { getLiveGame, lastUpdated, liveLoading };
}

// ------------------------------------------------------------
// LIVE TOTAL SCORE BADGE
// ------------------------------------------------------------

function LiveTotalBadge({ liveGame, vegasTotal, bbmiPick, estTotal }: {
  liveGame: LiveGame | undefined;
  vegasTotal: number | null;
  bbmiPick: string | null;
  estTotal?: number | null;
}) {
  if (!liveGame || liveGame.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = liveGame;
  const hasScores = awayScore != null && homeScore != null;
  const currentTotal = hasScores ? awayScore + homeScore : null;
  const isLive = status === "in";
  const isPost = status === "post";

  // Determine if BBMI pick is currently correct
  // For live games: use pace-adjusted estTotal (projected final total)
  // For final games: use actual current total (which IS the final)
  const compareTotal = isPost ? currentTotal : (estTotal ?? currentTotal);
  let bbmiCorrect: boolean | null = null;
  if (compareTotal != null && vegasTotal != null && bbmiPick) {
    if (compareTotal === vegasTotal) {
      bbmiCorrect = null; // push / on the number
    } else if (bbmiPick === "over") {
      bbmiCorrect = compareTotal > vegasTotal;
    } else {
      bbmiCorrect = compareTotal < vegasTotal;
    }
  }

  const bgColor = bbmiCorrect === true ? "#f0fdf4" : bbmiCorrect === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiCorrect === true ? "#86efac" : bbmiCorrect === false ? "#fca5a5" : "#e2e8f0";
  const dotColor = bbmiCorrect === true ? "#16a34a" : bbmiCorrect === false ? "#dc2626" : "#94a3b8";
  const statusColor = bbmiCorrect === true ? "#15803d" : bbmiCorrect === false ? "#b91c1c" : "#64748b";

  return (
    <div style={{
      borderRadius: 6, padding: "4px 8px",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
      backgroundColor: bgColor, border: `1px solid ${borderColor}`,
      width: 160, minHeight: 42,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isLive && (
          <span className="live-dot" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor }} />
        )}
        <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: statusColor }}>
          {statusDisplay}
        </span>
      </div>
      {hasScores && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.75rem" }}>
          <span style={{ color: "#1e293b" }}>{liveGame.espnAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>–</span>
          <span style={{ color: "#1e293b" }}>{homeScore} {liveGame.espnHomeAbbrev}</span>
        </div>
      )}
      {isPost && bbmiCorrect !== null && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiCorrect ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiCorrect ? "✓ WIN" : "✗ LOSS"}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// COLUMN DESCRIPTION PORTAL
// ------------------------------------------------------------

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
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>{"\u2715"}</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortableKey;
  tooltipId?: string;
  sortConfig: { key: SortableKey; direction: "asc" | "desc" };
  handleSort: (key: SortableKey) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  align?: "left" | "center" | "right";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ?? null;
  const isActive = sortConfig.key === columnKey;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (descShowing) closeDesc?.();
    else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); }
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
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}>
          {isActive ? (sortConfig.direction === "asc" ? "\u25B2" : "\u25BC") : "\u21C5"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// TODAY'S O/U REPORT CARD
// ------------------------------------------------------------

function TotalsReportCard({ games: todayGames, getLiveGame }: {
  games: Game[];
  getLiveGame: (away: string, home: string) => LiveGame | undefined;
}) {
  const results = todayGames.reduce(
    (acc, g) => {
      if (!g.totalPick || g.vegasTotal == null) return acc;
      const live = getLiveGame(String(g.away), String(g.home));
      if (!live || live.status === "pre") return acc;
      const { awayScore, homeScore, status } = live;
      if (awayScore == null || homeScore == null) return acc;
      const actualTotal = awayScore + homeScore;
      const edge = Math.abs(g.totalEdge ?? 0);
      if (edge < MIN_EDGE_FOR_RECORD) return acc;

      // For live games, compute pace-adjusted estimated total
      let compareTotal = actualTotal;
      if (status === "in") {
        const display = live.statusDisplay ?? "";
        const GM = 40, HM = 20, OT = 5;
        const cm = display.match(/(\d+):(\d+)/);
        const clk = cm ? parseInt(cm[1], 10) + parseInt(cm[2], 10) / 60 : 0;
        const lo = display.toLowerCase();
        let me = HM;
        if (lo.includes("halftime")) me = HM;
        else if (lo.includes("1st half")) me = HM - clk;
        else if (lo.includes("2nd half")) me = HM + (HM - clk);
        else if (lo.includes("ot")) me = GM + (OT - clk);
        me = Math.max(me, 0.5);
        compareTotal = Math.round(GM / me * actualTotal);
      }

      if (compareTotal === g.vegasTotal) { acc.push++; return acc; }

      const correct = g.totalPick === "over"
        ? compareTotal > g.vegasTotal
        : compareTotal < g.vegasTotal;

      if (status === "in") {
        // For live games, based on pace-adjusted projection
        if (correct) acc.winning++; else acc.losing++;
        acc.live++;
      } else if (status === "post") {
        if (correct) acc.wins++; else acc.losses++;
        acc.final++;
      }
      return acc;
    },
    { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 }
  );

  const totalSettled = results.wins + results.losses;
  const totalCombined = results.wins + results.losses + results.winning + results.losing;
  const combinedWins = results.wins + results.winning;
  const totalTracked = totalSettled + results.live;

  if (totalTracked === 0 && results.push === 0) return null;

  const winColor = "#16a34a";
  const lossColor = "#dc2626";
  const liveColor = "#f59e0b";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Today&apos;s O/U Report Card</span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: totalSettled === 0 ? "#94a3b8" : results.wins >= results.losses ? winColor : lossColor }}>
            {results.wins}–{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>O/U Record</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{totalSettled} final (edge ≥ 2){results.push > 0 ? ` · ${results.push} push` : ""}</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : liveColor }}>
            {results.winning}–{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Hitting</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{results.live} game{results.live !== 1 ? "s" : ""} in progress</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: totalCombined === 0 ? "#94a3b8" : combinedWins / totalCombined >= 0.5 ? winColor : lossColor }}>
            {totalCombined === 0 ? "—" : `${((combinedWins / totalCombined) * 100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Today&apos;s Win Rate</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{totalCombined === 0 ? "no games yet" : `${combinedWins} of ${totalCombined} picks (incl. live)`}</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN PAGE CONTENT
// ------------------------------------------------------------

function TotalsPageContent() {
  const { getLiveGame, lastUpdated, liveLoading } = useLiveScores();
  const { user } = useAuth();
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsPremium(false); return; }
    getDoc(doc(db, "users", user.uid)).then((d) => {
      setIsPremium(d.exists() && d.data()?.premium === true);
    }).catch(() => setIsPremium(false));
  }, [user]);

  const allGames = games as Game[];
  const cleanedGames = allGames.filter((g) => g.away && g.home);
  const today = new Date().toLocaleDateString("en-CA");

  const upcomingGames = cleanedGames.filter((g) => {
    const gameDate = g.date ? String(g.date).split("T")[0] : "";
    return gameDate === today && g.vegasTotal != null && g.bbmiTotal != null;
  });

  // Tooltip portal
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const headerProps = { activeDescId: descPortal?.id, openDesc, closeDesc };

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "totalEdge", direction: "desc" });
  const handleSort = (columnKey: SortableKey) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedGames = useMemo(() => {
    const withEdge = upcomingGames.map((g) => {
      const bbmiRounded = roundToHalf(g.bbmiTotal ?? 0);
      return {
        ...g,
        bbmiTotal: bbmiRounded,
        totalEdge: Math.abs(bbmiRounded - (g.vegasTotal ?? 0)),
        totalPick: g.totalPick ?? (bbmiRounded > (g.vegasTotal ?? 0) ? "over" : "under"),
      };
    });
    return [...withEdge].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a];
      const bVal = b[sortConfig.key as keyof typeof b];
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [upcomingGames, sortConfig]);

  const hasLiveGames = sortedGames.some((g) => {
    const live = getLiveGame(String(g.away), String(g.home));
    return live?.status === "in";
  });

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>Totals (O/U) Tracker</span>
            </h1>
            <p style={{ fontSize: "0.78rem", color: "#78716c", marginTop: 6 }}>
              BBMI projected totals vs. Vegas lines — walk-forward validated
            </p>
          </div>

          {/* COMBINED PERFORMANCE: Walk-Forward + Live */}
          <div style={{ maxWidth: 520, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                O/U Performance &middot; Walk-Forward + Live
              </div>
              {/* Headline row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: "1px solid #f5f5f4" }}>
                <div style={{ textAlign: "center", padding: "12px 8px" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#94a3b8", lineHeight: 1 }}>{backtestData.buckets[0]?.winPct ?? 0}%</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", marginTop: 4 }}>Free Picks</div>
                  <div style={{ fontSize: "0.62rem", color: "#78716c" }}>edge 2&ndash;{FREE_EDGE_LIMIT} pts</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px 8px", backgroundColor: "#0a1a2f", borderRadius: 0 }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#facc15", lineHeight: 1 }}>
                    {(() => { const prem = (backtestData.history as Array<{edge: number; correct: boolean}>).filter(g => g.edge >= FREE_EDGE_LIMIT); const w = prem.filter(g => g.correct).length; return prem.length > 0 ? (w / prem.length * 100).toFixed(1) : "0.0"; })()}%
                  </div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#ffffff", marginTop: 4 }}>Premium Picks</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)" }}>edge &ge; {FREE_EDGE_LIMIT} pts</div>
                </div>
                <div style={{ textAlign: "center", padding: "12px 8px" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: backtestData.overall.winPct >= 52.4 ? "#16a34a" : "#dc2626", lineHeight: 1 }}>{backtestData.overall.winPct}%</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", marginTop: 4 }}>Overall ATS</div>
                  <div style={{ fontSize: "0.62rem", color: "#78716c" }}>{backtestData.overall.games.toLocaleString()} games</div>
                </div>
              </div>
              {/* Edge buckets */}
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "W\u2013L", "Win %", "ROI"].map((h) => (
                      <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backtestData.buckets.map((stat: { name: string; games: number; wins: number; losses: number; winPct: number; roi: number }, idx: number) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.games}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.wins}&ndash;{stat.losses}</td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.winPct > 52.4 ? "#16a34a" : stat.winPct > 0 ? "#dc2626" : "#94a3b8" }}>
                        {stat.games === 0 ? "\u2014" : `${stat.winPct}%`}
                      </td>
                      <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", fontWeight: 600, color: stat.roi > 0 ? "#16a34a" : stat.roi < 0 ? "#dc2626" : "#94a3b8" }}>
                        {stat.games === 0 ? "\u2014" : `${stat.roi > 0 ? "+" : ""}${stat.roi}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: "8px 14px", fontSize: "0.62rem", color: "#94a3b8", textAlign: "center", borderTop: "1px solid #f5f5f4" }}>
                ROI at standard &ndash;110 juice &middot; Includes 2024-25 walk-forward + 2025-26 live results.
              </div>
            </div>
          </div>

          {/* TODAY'S REPORT CARD */}
          <TotalsReportCard games={sortedGames} getLiveGame={getLiveGame} />

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s O/U Picks</h2>
          {upcomingGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              No totals picks for today yet. Games will appear once pipeline runs.
            </p>
          )}

          {/* LIVE SCORES STATUS PILL */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: hasLiveGames ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasLiveGames ? "#86efac" : "#e2e8f0"}`, borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem", color: hasLiveGames ? "#15803d" : "#64748b", fontWeight: 600 }}>
              {liveLoading ? (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              ) : hasLiveGames ? (
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              )}
              {liveLoading ? "Loading live scores…" : hasLiveGames
                ? `Live scores updating · ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN · Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—"}`
              }
            </div>
          </div>

          {/* PREMIUM LOCK BANNER */}
          {!isPremium && sortedGames.filter(g => g.totalEdge >= FREE_EDGE_LIMIT).length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1rem" }}>
              <div style={{ backgroundColor: "#0a1a2f", borderRadius: 8, padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 700 }}>{"\uD83D\uDD12"} {sortedGames.filter(g => g.totalEdge >= FREE_EDGE_LIMIT).length} high-edge {sortedGames.filter(g => g.totalEdge >= FREE_EDGE_LIMIT).length === 1 ? "pick" : "picks"} locked today</span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)" }}>Edge {"\u2265"} {FREE_EDGE_LIMIT} pts &middot; {backtestData.overall.winPct}% accurate</span>
                </div>
                <button onClick={() => router.push("/subscribe")} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                  Subscribe {"\u2192"}
                </button>
              </div>
            </div>
          )}

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 1050 }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none", width: 160, minWidth: 160 }}>
                        Score
                      </th>
                      <SortableHeader label="Away"         columnKey="away"       tooltipId="away"       sortConfig={sortConfig} handleSort={handleSort} align="left" {...headerProps} />
                      <SortableHeader label="Home"         columnKey="home"       tooltipId="home"       sortConfig={sortConfig} handleSort={handleSort} align="left" {...headerProps} />
                      <SortableHeader label="Vegas O/U"    columnKey="vegasTotal" tooltipId="vegasTotal" sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="BBMI Total"   columnKey="bbmiTotal"  tooltipId="bbmiTotal"  sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="Actual (Est.)" columnKey="totalEdge" tooltipId="actual"     sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="Edge"         columnKey="totalEdge"  tooltipId="totalEdge"  sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="Pick"         columnKey="totalPick"  tooltipId="totalPick"  sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="Over Odds"    columnKey="overOdds"   tooltipId="overOdds"   sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      <SortableHeader label="Under Odds"   columnKey="underOdds"  tooltipId="underOdds"  sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No totals picks available for today.</td></tr>
                    )}
                    {sortedGames.map((g, i) => {
                      const awayStr = String(g.away);
                      const homeStr = String(g.home);
                      const liveGame = getLiveGame(awayStr, homeStr);

                      // Compute pace-adjusted estimated total for live games
                      let rowEstTotal: number | null = null;
                      if (liveGame && liveGame.status === "in" && liveGame.awayScore != null && liveGame.homeScore != null) {
                        const curTotal = liveGame.awayScore + liveGame.homeScore;
                        const display = liveGame.statusDisplay ?? "";
                        const GM = 40, HM = 20, OT = 5;
                        const cm = display.match(/(\d+):(\d+)/);
                        const clk = cm ? parseInt(cm[1], 10) + parseInt(cm[2], 10) / 60 : 0;
                        const lo = display.toLowerCase();
                        let me = HM; // fallback
                        if (lo.includes("halftime")) me = HM;
                        else if (lo.includes("1st half")) me = HM - clk;
                        else if (lo.includes("2nd half")) me = HM + (HM - clk);
                        else if (lo.includes("ot")) me = GM + (OT - clk);
                        me = Math.max(me, 0.5);
                        rowEstTotal = Math.round(GM / me * curTotal);
                      }

                      const isLocked = !isPremium && g.totalEdge >= FREE_EDGE_LIMIT;
                      const isBelowMinEdge = g.totalEdge < MIN_EDGE_FOR_RECORD;

                      if (isLocked) {
                        return (
                          <tr key={i} style={{ backgroundColor: "#0a1a2f" }}>
                            <td colSpan={10} style={{ padding: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                                  <span style={{ fontSize: "1rem" }}>{"\uD83D\uDD12"}</span>
                                  <span style={{ fontSize: "0.78rem", color: "#facc15", fontWeight: 700 }}>High-edge pick — Edge {"\u2265"} {FREE_EDGE_LIMIT} pts</span>
                                  <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
                                    These picks are <strong style={{ color: "#facc15" }}>{backtestData.overall.winPct}%</strong> accurate historically
                                  </span>
                                </div>
                                <button onClick={() => router.push("/subscribe")} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
                                  Unlock {"\u2192"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      const rowBg = isBelowMinEdge
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const rowOpacity = isBelowMinEdge ? 0.55 : 1;
                      const rowColor = isBelowMinEdge ? "#9ca3af" : undefined;
                      const pickColor = g.totalPick === "over" ? "#dc2626" : "#2563eb";

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg, opacity: rowOpacity, color: rowColor }}>
                          <td style={{ ...TD, textAlign: "center", width: 160, minWidth: 160, paddingRight: 12 }}>
                            {!liveGame || liveGame.status === "pre" ? (
                              <div style={{ width: 148, minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {liveGame?.startTime
                                    ? new Date(liveGame.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                    : g.date}
                                </span>
                              </div>
                            ) : (
                              <LiveTotalBadge liveGame={liveGame} vegasTotal={g.vegasTotal} bbmiPick={g.totalPick} estTotal={rowEstTotal} />
                            )}
                          </td>

                          <td style={{ ...TD, paddingLeft: 16 }}>
                            <Link href={`/ncaa-team/${encodeURIComponent(awayStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={awayStr} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                            </Link>
                          </td>

                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(homeStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={homeStr} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                            </Link>
                          </td>

                          <td style={TD_RIGHT}>{g.vegasTotal}</td>
                          <td style={TD_RIGHT}>{g.bbmiTotal.toFixed(1)}</td>
                          {(() => {
                            const live = getLiveGame(awayStr, homeStr);
                            if (!live || live.status === "pre") {
                              return <td style={{ ...TD_RIGHT, color: "#94a3b8" }}>—</td>;
                            }
                            const aS = live.awayScore ?? 0;
                            const hS = live.homeScore ?? 0;
                            const currentTotal = aS + hS;
                            const isPost = live.status === "post";

                            if (isPost) {
                              // Final score — show actual total
                              const overLine = g.vegasTotal != null && currentTotal > g.vegasTotal;
                              const underLine = g.vegasTotal != null && currentTotal < g.vegasTotal;
                              const totalColor = overLine ? "#dc2626" : underLine ? "#2563eb" : "#374151";
                              return (
                                <td style={{ ...TD_RIGHT, fontWeight: 800, color: totalColor }}>
                                  {currentTotal}
                                </td>
                              );
                            }

                            // Live game — estimate total using actual clock time
                            // NCAA basketball = 40 minutes (two 20-min halves)
                            // statusDisplay format: "1st Half 8:10" or "2nd Half 3:18" or "Halftime" or "OT1 2:30"
                            const display = live.statusDisplay ?? "";
                            const GAME_MINUTES = 40;
                            const HALF_MINUTES = 20;
                            const OT_MINUTES = 5;

                            // Parse MM:SS from the display string
                            const clockMatch = display.match(/(\d+):(\d+)/);
                            const clockMinutes = clockMatch
                              ? parseInt(clockMatch[1], 10) + parseInt(clockMatch[2], 10) / 60
                              : 0;

                            let minutesElapsed: number;
                            const lower = display.toLowerCase();

                            if (lower.includes("halftime")) {
                              minutesElapsed = HALF_MINUTES;
                            } else if (lower.includes("1st half")) {
                              // Clock counts down from 20:00; time remaining = clockMinutes
                              minutesElapsed = HALF_MINUTES - clockMinutes;
                            } else if (lower.includes("2nd half")) {
                              minutesElapsed = HALF_MINUTES + (HALF_MINUTES - clockMinutes);
                            } else if (lower.includes("ot")) {
                              // OT clock counts down from 5:00
                              minutesElapsed = GAME_MINUTES + (OT_MINUTES - clockMinutes);
                            } else {
                              // Fallback — assume halfway
                              minutesElapsed = HALF_MINUTES;
                            }

                            // Clamp to avoid division issues
                            minutesElapsed = Math.max(minutesElapsed, 0.5);

                            const estTotal = Math.round(GAME_MINUTES / minutesElapsed * currentTotal);

                            return (
                              <td style={{ ...TD_RIGHT, color: "#78716c" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                  <span style={{ fontWeight: 700 }}>~{estTotal}</span>
                                  <span style={{ fontSize: 9, color: "#94a3b8" }}>now: {currentTotal}</span>
                                </div>
                              </td>
                            );
                          })()}
                          <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : g.totalEdge >= 6 ? "#16a34a" : "#374151", fontWeight: g.totalEdge >= 6 ? 800 : 600 }}>
                            {isBelowMinEdge ? "~" : ""}{g.totalEdge.toFixed(1)}
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: isBelowMinEdge ? "#9ca3af" : pickColor, textTransform: "uppercase", fontSize: 13 }}>
                            {g.totalPick === "over" ? "⬆ Over" : "⬇ Under"}
                          </td>
                          <td style={TD_RIGHT}>{g.overOdds ? decimalToAmerican(g.overOdds) : "—"}</td>
                          <td style={TD_RIGHT}>{g.underOdds ? decimalToAmerican(g.underOdds) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* HISTORY TABLE */}
          {backtestData.history && backtestData.history.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginTop: 32, marginBottom: 8 }}>
                Prediction History
              </h2>
              <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px", maxWidth: 500 }}>
                All completed O/U predictions — 2024-25 walk-forward backtest + 2025-26 live results.
              </p>
              <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
                <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                  <div style={{ overflowX: "auto", maxHeight: 800, overflowY: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 850 }}>
                      <thead>
                        <tr>
                          {([
                            ["Date", "date"], ["Away", "away"], ["Home", "home"],
                            ["Vegas O/U", "vegasTotal"], ["BBMI Total", "bbmiTotal"],
                            ["Actual", "actualTotal"], ["Edge", "totalEdge"],
                            ["Pick", "totalPick"], ["Result", "result"],
                          ] as [string, string][]).map(([label, tid]) => {
                            const text = TOOLTIPS[tid];
                            return (
                              <th key={label} ref={null} style={{
                                backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 10px",
                                textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
                                borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem",
                                fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                              }}>
                                <span
                                  onClick={(e) => {
                                    if (!text) return;
                                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                                    if (descPortal?.id === tid) closeDesc();
                                    else openDesc(tid, rect);
                                  }}
                                  style={{ cursor: text ? "help" : "default", textDecoration: text ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
                                >
                                  {label}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {(backtestData.history as Array<{
                          date: string; away: string; home: string;
                          vegasTotal: number; bbmiTotal: number; actualTotal: number;
                          edge: number; pick: string; result: string; correct: boolean; season: string;
                        }>).map((g, i) => {
                          const isBelowMin = g.edge < MIN_EDGE_FOR_RECORD;
                          const rowBg = isBelowMin
                            ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                            : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                          const pickColor = g.pick === "over" ? "#dc2626" : "#2563eb";
                          const resultColor = g.correct ? "#16a34a" : "#dc2626";
                          const actualColor = g.actualTotal > g.vegasTotal ? "#dc2626" : g.actualTotal < g.vegasTotal ? "#2563eb" : "#374151";

                          return (
                            <tr key={i} style={{ backgroundColor: rowBg, opacity: isBelowMin ? 0.5 : 1 }}>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", whiteSpace: "nowrap", color: "#57534e" }}>
                                {g.date}
                                {g.season === "2025-26" && (
                                  <span style={{ marginLeft: 4, fontSize: 9, color: "#3b82f6", fontWeight: 700 }}>LIVE</span>
                                )}
                              </td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, fontWeight: 500 }}>{g.away}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, fontWeight: 500 }}>{g.home}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{g.vegasTotal}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{roundToHalf(g.bbmiTotal).toFixed(1)}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: actualColor }}>{g.actualTotal}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "right", fontFamily: "ui-monospace, monospace", fontWeight: isBelowMin ? 400 : 600 }}>{g.edge.toFixed(1)}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontWeight: 700, color: isBelowMin ? "#9ca3af" : pickColor, textTransform: "uppercase" }}>{g.pick}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontWeight: 700, color: isBelowMin ? "#9ca3af" : resultColor }}>
                                {g.correct ? "\u2713" : "\u2717"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* FOOTER NOTE */}
          <div style={{ maxWidth: 600, margin: "0 auto 2rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", lineHeight: 1.6 }}>
              Totals predictions are derived from the BBMI model&apos;s KenPom efficiency and tempo projections.
              2024-25 results are walk-forward (out-of-sample). 2025-26 results are live.
              All picks published before tip-off. No retroactive edits.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

export default function TotalsPicksPage() {
  return (
    <AuthProvider>
      <TotalsPageContent />
    </AuthProvider>
  );
}
