"use client";

import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import games from "@/data/betting-lines/games.json";
import injuryData from "@/data/betting-lines/injuries.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import EdgePerformanceGraph, { BASKETBALL_EDGE_CATEGORIES } from "@/components/EdgePerformanceGraph";
import { AuthProvider, useAuth } from "../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";

// ------------------------------------------------------------
// FREE TIER THRESHOLD
// ------------------------------------------------------------
const FREE_EDGE_LIMIT = 6;

// Minimum edge to count in the performance record.
// The Vegas line is captured at a specific point in time. Lines routinely move
// 1–2 points between open and tip-off, and can vary by a point or more across
// different books. A difference smaller than 2 pts is within normal market noise
// and does not represent a meaningful BBMI disagreement with Vegas.
const MIN_EDGE_FOR_RECORD = 2;

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
// INJURY HELPERS
// ------------------------------------------------------------

type InjuryPlayer = {
  player: string;
  status: string;
  note: string;
  avg_minutes?: number | null;
};

const injuries = injuryData as Record<string, InjuryPlayer[]>;

function getInjuryImpact(teamName: string): { impact: number; players: InjuryPlayer[] } {
  const teamInjuries = injuries[teamName] ?? [];
  const impactPlayers = teamInjuries.filter(
    (p) => p.status === "out" || p.status === "doubtful"
  );
  const totalMinutes = impactPlayers.reduce((sum, p) => {
    const mins = (p as InjuryPlayer & { avg_minutes?: number | null }).avg_minutes;
    return sum + (mins ?? 3);
  }, 0);
  const impact = totalMinutes / 200;
  return { impact, players: teamInjuries };
}

function getInjuryColor(impact: number, playerCount: number): string {
  // When avg_minutes is unknown, use player count as proxy
  if (playerCount >= 3) return "#dc2626";      // red: 3+ players out
  if (playerCount >= 2) return "#f97316";       // orange: 2 players out
  if (playerCount >= 1) return "#eab308";       // yellow: 1 player out
  return "transparent";
}

function InjuryBadge({ teamName }: { teamName: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { impact, players } = getInjuryImpact(teamName);

  const impactPlayers = players
  .filter(p => p.status === "out" || p.status === "doubtful")
  .sort((a, b) => (b.avg_minutes ?? 0) - (a.avg_minutes ?? 0));

  // GTD/questionable/day-to-day players (low severity)
  const minorPlayers = players
  .filter(p => p.status !== "out" && p.status !== "doubtful")
  .sort((a, b) => (b.avg_minutes ?? 0) - (a.avg_minutes ?? 0));

  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showTooltip]);

  useLayoutEffect(() => {
    if (!showTooltip) return;
    const update = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) {
        setTooltipPos({ top: 0, left: 0 });
        return;
      }
      const top = rect.bottom + 6;
      const tooltipWidth = 260;
      const spaceRight = window.innerWidth - rect.left;
      const left = spaceRight >= tooltipWidth ? rect.left : Math.max(8, rect.right - tooltipWidth);
      setTooltipPos({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showTooltip]);

  if (impactPlayers.length === 0 && minorPlayers.length === 0) return null;

  const isMinorOnly = impactPlayers.length === 0;
  const color = isMinorOnly ? "#d1d5db" : getInjuryColor(impact, impactPlayers.length);
  const allPlayers = isMinorOnly ? minorPlayers : impactPlayers;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTooltip(v => !v); }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ cursor: "pointer", flexShrink: 0 }}>
        <circle cx="12" cy="12" r="11" fill="white" />
        <circle cx="12" cy="12" r="11" fill={color} />
        <rect x="9" y="4" width="6" height="16" rx="1.5" fill={isMinorOnly ? "#6b7280" : "white"} />
        <rect x="4" y="9" width="16" height="6" rx="1.5" fill={isMinorOnly ? "#6b7280" : "white"} />
      </svg>

      {showTooltip && (
        <div style={{
          position: "fixed",
          top: tooltipPos.top,
          left: tooltipPos.left,
          zIndex: 99999,
          backgroundColor: "#0a1a2f", border: "1px solid #1e3a5f",
          borderRadius: 8, padding: "10px 12px", minWidth: 200, maxWidth: 260,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          pointerEvents: "auto",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 7 }}>
            {teamName} — Injuries
          </div>
          {allPlayers.map((p, i) => {
            const statusColor = p.status === "out" ? "#ef4444" : p.status === "doubtful" ? "#f97316" : "#94a3b8";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "baseline", justifyContent: "space-between",
                gap: 10, padding: "3px 0",
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{p.player}</span>
                  {p.note && p.note !== "Undisclosed" && (
                    <span style={{ fontSize: 10, color: "#78716c", marginLeft: 5 }}>· {p.note}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {p.status}
                  </span>
                  <span style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap" }}>
                    {(p as InjuryPlayer & { avg_minutes?: number | null }).avg_minutes != null
                      ? `${(p as InjuryPlayer & { avg_minutes?: number | null }).avg_minutes} mpg`
                      : "INF"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type UpcomingGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
  vegaswinprob: number | null;
  vegasTotal: number | null;
  bbmiTotal: number | null;
  totalEdge: number | null;
  totalPick: string | null;
  overOdds: number | null;
  underOdds: number | null;
};

type SortableKeyUpcoming =
  | "bbmiPick" | "date" | "away" | "home"
  | "vegasHomeLine" | "bbmiHomeLine" | "bbmiWinProb"
  | "vegaswinprob" | "edge"
  | "vegasTotal" | "bbmiTotal" | "totalEdge" | "totalPick"
  | "overOdds" | "underOdds";

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2.0) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

// ------------------------------------------------------------
// LIVE SCORES — ESPN API
// ------------------------------------------------------------

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  period: number | null;
  clock: string | null;
  startTime: string | null;
  espnAwayName: string;
  espnHomeName: string;
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
  ["McNeese State", "McNeese State"],   // ESPN sends "McNeese Cowboys" → strips to "McNeese" → needs to map to "McNeese State"
  ["McNeese",       "McNeese State"],   // catch the stripped form too
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

function makeGameKey(away: string, home: string): string {
  return `${normalizeTeamName(away)}|${normalizeTeamName(home)}`;
}
function makeAwayKey(away: string): string { return `away:${normalizeTeamName(away)}`; }
function makeHomeKey(home: string): string { return `home:${normalizeTeamName(home)}`; }

function getEspnDates(): string[] {
  const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date()).replace(/-/g, "");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const utcTomorrow = tomorrow.toISOString().slice(0, 10).replace(/-/g, "");
  const dates = [ctDate];
  if (utcTomorrow !== ctDate) dates.push(utcTomorrow);
  return dates;
}

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const map = new Map<string, LiveGame>();
  const dates = getEspnDates();

  for (const dateStr of dates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=${dateStr}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) continue;
    const data = await res.json();

  for (const event of data.events ?? []) {

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
      period: st.period ?? null,
      clock: st.displayClock ?? null,
      startTime: event.date ?? null,
      espnAwayName: awayC.team.displayName,
      espnHomeName: homeC.team.displayName,
      espnAwayAbbrev: awayC.team.abbreviation ?? awayC.team.shortDisplayName ?? awayC.team.displayName.split(" ")[0],
      espnHomeAbbrev: homeC.team.abbreviation ?? homeC.team.shortDisplayName ?? homeC.team.displayName.split(" ")[0],
    };

    [
      [awayC.team.displayName, homeC.team.displayName],
      [awayC.team.shortDisplayName, homeC.team.shortDisplayName],
      [awayC.team.abbreviation, homeC.team.abbreviation],
    ].forEach(([a, h]) => map.set(makeGameKey(a, h), liveGame));

    [awayC.team.displayName, awayC.team.shortDisplayName].forEach((aN) => {
      [homeC.team.displayName, homeC.team.shortDisplayName].forEach((hN) => {
        const a0 = normalizeTeamName(aN), h0 = normalizeTeamName(hN);
        const a1 = normalizeWithoutMascot(aN), h1 = normalizeWithoutMascot(hN);
        const a2 = normalizeWithoutTwoWords(aN), h2 = normalizeWithoutTwoWords(hN);
        map.set(`${a1}|${h1}`, liveGame); map.set(`${a1}|${h0}`, liveGame);
        map.set(`${a0}|${h1}`, liveGame); map.set(`${a2}|${h2}`, liveGame);
        map.set(`${a2}|${h0}`, liveGame); map.set(`${a0}|${h2}`, liveGame);
        map.set(`${a2}|${h1}`, liveGame); map.set(`${a1}|${h2}`, liveGame);
      });
    });

    [awayC.team.displayName, awayC.team.shortDisplayName, awayC.team.abbreviation].forEach((n) => {
      map.set(makeAwayKey(n), liveGame);
      map.set(`away:${normalizeWithoutMascot(n)}`, liveGame);
      map.set(`away:${normalizeWithoutTwoWords(n)}`, liveGame);
    });
    [homeC.team.displayName, homeC.team.shortDisplayName, homeC.team.abbreviation].forEach((n) => {
      map.set(makeHomeKey(n), liveGame);
      map.set(`home:${normalizeWithoutMascot(n)}`, liveGame);
      map.set(`home:${normalizeWithoutTwoWords(n)}`, liveGame);
    });
  }
  } // end for dateStr
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
// LIVE SCORE BADGE
// ------------------------------------------------------------

function LiveScoreBadge({ liveGame, awayName, homeName, bbmiPickTeam, vegasHomeLine }: {
  liveGame: LiveGame | undefined;
  awayName: string;
  homeName: string;
  bbmiPickTeam?: string;
  vegasHomeLine?: number | null;
}) {
  if (!liveGame || liveGame.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = liveGame;
  const hasScores = awayScore != null && homeScore != null;
  const isLive = status === "in";

  const vegasLine = vegasHomeLine;
  const bbmiPickIsHome = bbmiPickTeam ? normalizeTeamName(bbmiPickTeam) === normalizeTeamName(homeName) : false;
  const bbmiPickIsAway = bbmiPickTeam ? normalizeTeamName(bbmiPickTeam) === normalizeTeamName(awayName) : false;
  let bbmiLeading: boolean | null = null;

  if (hasScores && bbmiPickTeam && vegasLine != null) {
    const actualMargin = homeScore! - awayScore!;
    const homeCoversSpread = actualMargin > -vegasLine;
    if (actualMargin === -vegasLine) {
      bbmiLeading = null;
    } else {
      bbmiLeading = bbmiPickIsHome ? homeCoversSpread : !homeCoversSpread;
    }
  }

  const bgColor = bbmiLeading === true ? "#f0fdf4" : bbmiLeading === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiLeading === true ? "#86efac" : bbmiLeading === false ? "#fca5a5" : "#e2e8f0";
  const dotColor = bbmiLeading === true ? "#16a34a" : bbmiLeading === false ? "#dc2626" : "#94a3b8";
  const statusColor = bbmiLeading === true ? "#15803d" : bbmiLeading === false ? "#b91c1c" : "#64748b";

  const awayAhead = hasScores && awayScore! > homeScore!;
  const homeAhead = hasScores && homeScore! > awayScore!;
  const awayScoreColor = awayAhead ? (bbmiPickIsAway ? "#16a34a" : "#dc2626") : "#1e293b";
  const homeScoreColor = homeAhead ? (bbmiPickIsHome ? "#16a34a" : "#dc2626") : "#1e293b";

  const isPost = status === "post";
  const bbmiWon = isPost && bbmiLeading === true;
  const bbmiLost = isPost && bbmiLeading === false;

  return (
    <div style={{
      borderRadius: 6, padding: "3px 6px",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 1,
      backgroundColor: bgColor, border: `1px solid ${borderColor}`,
      minHeight: 36,
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
          <span style={{ color: awayScoreColor, fontWeight: awayAhead ? 800 : 600 }}>{liveGame.espnAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>–</span>
          <span style={{ color: homeScoreColor, fontWeight: homeAhead ? 800 : 600 }}>{homeScore} {liveGame.espnHomeAbbrev}</span>
        </div>
      )}
      {isPost && (bbmiWon || bbmiLost) && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiWon ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiWon ? "✓ WIN" : "✗ LOSS"}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  date: "The date of the game.",
  away: "The visiting team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  home: "The home team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  vegasHomeLine: "Point spread set by sportsbooks for the home team. Negative = home team is favored.",
  bbmiHomeLine: "What BBMI's model predicts the spread should be.",
  edge: "The gap between BBMI's line and the Vegas line. Larger edge = stronger model conviction.",
  bbmiPick: "The team BBMI's model favors to cover the Vegas spread.",
  bbmiWinProb: "BBMI's estimated probability that the home team wins outright.",
  vegaswinprob: "Vegas's implied probability that the home team wins outright.",
  vegasTotal: "Vegas over/under line \u2014 the sportsbook\u2019s projected total points scored in the game.",
  bbmiTotal: "BBMI\u2019s projected total points scored, based on KenPom efficiency and tempo projections.",
  totalEdge: "The gap between BBMI\u2019s total and the Vegas O/U in points. Larger edge = stronger model conviction.",
  totalPick: "BBMI\u2019s over/under call based on whether the projected total is above or below the Vegas line.",
  overOdds: "Sportsbook odds for the over bet, converted to American format (e.g. -110).",
  underOdds: "Sportsbook odds for the under bet, converted to American format (e.g. -110).",
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
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortableKeyUpcoming; tooltipId?: string;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
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

function LockedRowOverlay({ colSpan, onSubscribe, winPct }: { colSpan: number; onSubscribe: () => void; winPct: string }) {
  return (
    <tr style={{ backgroundColor: "#0a1a2f" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>🔒</span>
            <span style={{ fontSize: "0.78rem", color: "#facc15", fontWeight: 700 }}>High-edge pick — Edge ≥ {FREE_EDGE_LIMIT} pts</span>
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

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct }: {
  onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "2rem 1.75rem", maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem" }}>
            🔒 Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.4rem" }}>Unlock High-Edge Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge ≥ {FREE_EDGE_LIMIT} pts — where the model is most accurate</p>
        </div>
        <div style={{ backgroundColor: "#0a1a2f", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks · edge ≥ {FREE_EDGE_LIMIT}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>picks with statistically significant edge (≥ 2 pts)</div>
          </div>
        </div>
        {/* Methodology note */}
        <div style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.6rem 0.9rem", marginBottom: "1rem", textAlign: "left" }}>
          <p style={{ fontSize: "0.68rem", color: "#64748b", margin: 0, lineHeight: 1.6 }}>
            <strong style={{ color: "#374151" }}>ℹ️ Methodology:</strong> The overall rate excludes games where BBMI and Vegas lines differ by less than 2 points. The Vegas line is captured at a specific point in time — lines routinely move 1–2 points between open and tip-off, and can vary by a point or more across different books. A difference smaller than 2 pts is within normal market noise and does not represent a meaningful BBMI disagreement with Vegas.
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
          <Link href="/auth" onClick={onClose} style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>Sign in →</Link>
        </div>
      </div>
    </div>
  );
}

function TodaysReportCard({ games, getLiveGame }: {
  games: Array<{ away: string | number | null; home: string | number | null; vegasHomeLine: number | null; bbmiHomeLine: number | null; edge: number }>;
  getLiveGame: (away: string, home: string) => LiveGame | undefined;
}) {
  const results = games.reduce(
    (acc, g) => {
      const live = getLiveGame(String(g.away), String(g.home));
      if (!live || live.status === "pre") return acc;
      const { awayScore, homeScore, status } = live;
      if (awayScore == null || homeScore == null) return acc;
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      if (bbmiLine === vegasLine) return acc;
      // Exclude sub-2 edge games from the report card to match the overall record methodology.
      // Differences < 2 pts are within normal line movement and book-to-book variation.
      if (Math.abs(bbmiLine - vegasLine) < MIN_EDGE_FOR_RECORD) return acc;
      const bbmiPickIsHome = bbmiLine < vegasLine;
      const actualMargin = homeScore - awayScore;
      const homeCovers = actualMargin > -vegasLine;
      const push = actualMargin === -vegasLine;
      const bbmiCorrect = push ? null : bbmiPickIsHome ? homeCovers : !homeCovers;
      if (push) { acc.push++; return acc; }
      if (status === "in") { if (bbmiCorrect) { acc.winning++; } else { acc.losing++; } acc.live++; return acc; }
      if (status === "post") { if (bbmiCorrect) { acc.wins++; } else { acc.losses++; } acc.final++; return acc; }
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
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Today&apos;s Report Card</span>
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
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>ATS Record</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{totalSettled} final (edge ≥ 2){results.push > 0 ? ` · ${results.push} push` : ""}</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : liveColor }}>
            {results.winning}–{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Covering</div>
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

function BettingLinesPageContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const { getLiveGame, lastUpdated, liveLoading } = useLiveScores();

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

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org", "@type": "Dataset",
      name: "BBMI Today's Picks – NCAA Betting Lines & Predictions",
      description: "Live NCAA basketball betting lines, BBMI model picks, and win probabilities for today's games.",
      url: "https://bbmisports.com/ncaa-todays-picks", dateModified: "2025-01-01",
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"ats" | "ou">(() => searchParams.get("mode") === "ou" ? "ou" : "ats");
  const cleanedGames = games.filter((g) => g.away && g.home);
  const today = new Date().toLocaleDateString("en-CA");
  const atsUpcomingGames: UpcomingGame[] = cleanedGames.filter((g) => {
    const gameDate = g.date ? String(g.date).split("T")[0] : "";
    return gameDate === today && g.bbmiHomeLine != null && g.vegasHomeLine != null;
  });
  const ouUpcomingGames: UpcomingGame[] = cleanedGames.filter((g) => {
    const gameDate = g.date ? String(g.date).split("T")[0] : "";
    return gameDate === today && g.vegasTotal != null && g.bbmiTotal != null;
  });
  const upcomingGames = mode === "ats" ? atsUpcomingGames : ouUpcomingGames;
  const historicalGames = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  const futureGames: UpcomingGame[] = useMemo(() => {
    return cleanedGames
      .filter((g) => {
        const gameDate = g.date ? String(g.date).split("T")[0] : "";
        return gameDate > today && g.bbmiHomeLine != null && g.vegasHomeLine != null;
      })
      .sort((a, b) => {
        const da = a.date ? String(a.date) : "";
        const db = b.date ? String(b.date) : "";
        return da.localeCompare(db);
      });
  }, [cleanedGames, today]);

  const [showFuture, setShowFuture] = useState(false);

  const edgeStats = useMemo(() => {
    // Only count picks where edge >= MIN_EDGE_FOR_RECORD (2 pts).
    // Smaller differences are likely explained by line movement or book-to-book
    // variation — not a genuine model disagreement with the market.
    const allBets = historicalGames.filter(
      (g) =>
        Number(g.fakeBet || 0) > 0 &&
        Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";
    const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const freeEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) < FREE_EDGE_LIMIT);
    const freeEdgeWins = freeEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const freeEdgeWinPct = freeEdge.length > 0 ? ((freeEdgeWins / freeEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length, freeEdgeWinPct, freeEdgeTotal: freeEdge.length };
  }, [historicalGames]);

  // O/U parallel stats
  const ouEdgeStats = useMemo(() => {
    const OU_FREE = 4;
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
    return {
      total: allBets.length,
      winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0",
    };
  }, [historicalGames]);

  const ouEdgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "2\u20134 pts", min: 2, max: 4 },
      { name: "4\u20136 pts", min: 4, max: 6 },
      { name: "6\u20138 pts", min: 6, max: 8 },
      { name: ">8 pts", min: 8, max: Infinity },
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

  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    historicalGames.forEach((g) => {
      if (Number(g.fakeBet || 0) <= 0) return;
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const pickedTeam = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      if (!records[pickedTeam]) records[pickedTeam] = { wins: 0, picks: 0 };
      records[pickedTeam].picks++;
      if (Number(g.fakeWin || 0) > 0) records[pickedTeam].wins++;
    });
    return records;
  }, [historicalGames]);

  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    return {
      wins: record.wins, picks: record.picks,
      winPct: ((record.wins / record.picks) * 100).toFixed(0),
      display: `${record.wins}-${record.picks - record.wins}`,
      color: record.wins / record.picks >= 0.5 ? "#16a34a" : "#dc2626",
    };
  };

  const edgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: "2–5 pts",   min: 2, max: 5 },
    { label: "5–6 pts",   min: 5, max: 6 },
    { label: "6–7 pts",   min: 6, max: 7 },
    { label: "7–8 pts",   min: 7, max: 8 },
    { label: "≥ 8 pts",   min: 8, max: Infinity },
  ];
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);

  const edgePerformanceStats = useMemo(() => {
    // Buckets start at 2 pts minimum — sub-2 games are excluded as they fall
    // within normal line movement and book-to-book variation.
    const cats = [
      { name: "2–5 pts", min: 2, max: 5 },
      { name: "5–6 pts", min: 5, max: 6 },
      { name: "6–7 pts", min: 6, max: 7 },
      { name: "7–8 pts", min: 7, max: 8 },
      { name: ">8 pts",  min: 8, max: Infinity },
    ];
    return cats.map((cat) => {
      const catGames = historicalGames.filter((g) => {
        if (Number(g.fakeBet || 0) <= 0) return false;
        const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
        return edge >= cat.min && edge < cat.max;
      });
      const wins = catGames.filter((g) => Number(g.fakeWin || 0) > 0).length;
      const wagered = catGames.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
      const won = catGames.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
      const roi = wagered > 0 ? won / wagered * 100 - 100 : 0;
      const { low, high } = wilsonCI(wins, catGames.length);
      return {
        name: cat.name, games: catGames.length, wins,
        winPct: catGames.length > 0 ? ((wins / catGames.length) * 100).toFixed(1) : "0.0",
        roi: roi.toFixed(1), roiPositive: roi > 0, ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  const historicalStats = useMemo(() => {
    // Only count picks with edge >= MIN_EDGE_FOR_RECORD (2 pts) — smaller differences
    // are likely explained by line movement or book-to-book variation, not a genuine
    // model disagreement with the market.
    const allBets = historicalGames.filter(
      (g) =>
        Number(g.fakeBet || 0) > 0 &&
        Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= MIN_EDGE_FOR_RECORD
    );
    const wins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const wagered = allBets.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
    const won = allBets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    return {
      total: allBets.length,
      winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0",
      roi: wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0",
    };
  }, [historicalGames]);

  // Active stats based on mode — must be after all stat useMemos
  const activeEdgeStats = mode === "ats" ? edgeStats : ouEdgeStats;
  const activeHistoricalStats = mode === "ats" ? historicalStats : ouHistoricalStats;
  const activeEdgePerformanceStats = mode === "ats" ? edgePerformanceStats : ouEdgePerformanceStats;
  const activeEdgeLimit = mode === "ats" ? FREE_EDGE_LIMIT : 4;

  const edgeFilteredGames = useMemo(() => {
    if (edgeOption.label === "All Games") return upcomingGames;
    return upcomingGames.filter((g) => {
      const edge = mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      if (edgeOption.label === "2–5 pts") return edge >= 2 && edge < 5;
      if (edgeOption.label === "5–6 pts") return edge >= 5 && edge < 6;
      if (edgeOption.label === "6–7 pts") return edge >= 6 && edge < 7;
      if (edgeOption.label === "7–8 pts") return edge >= 7 && edge < 8;
      if (edgeOption.label === "≥ 8 pts") return edge >= 8;
      return true;
    });
  }, [upcomingGames, edgeOption]);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKeyUpcoming; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKeyUpcoming) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedUpcoming = useMemo(() => {
    const withComputed = edgeFilteredGames.map((g) => ({
      ...g,
      bbmiPick: g.bbmiHomeLine == null || g.vegasHomeLine == null ? ""
        : g.bbmiHomeLine === g.vegasHomeLine ? ""
        : g.bbmiHomeLine > g.vegasHomeLine ? g.away : g.home,
      edge: mode === "ou"
        ? Math.abs((g.bbmiTotal ?? 0) - (g.vegasTotal ?? 0))
        : Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)),
    }));
    return [...withComputed].sort((a, b) => {
      const aVal = a[sortConfig.key], bVal = b[sortConfig.key];
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [edgeFilteredGames, sortConfig]);

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const lockedCount = sortedUpcoming.filter((g) => g.edge >= activeEdgeLimit).length;
  const futureLockedCount = !isPremium
    ? futureGames.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT).length
    : 0;
  const hasLiveGames = sortedUpcoming.some((g) => {
    const live = getLiveGame(String(g.away), String(g.home));
    return live?.status === "in";
  });

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={activeEdgeStats.highEdgeWinPct} highEdgeTotal={activeEdgeStats.highEdgeTotal} overallWinPct={activeEdgeStats.overallWinPct} />}

      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>Today&apos;s Game Lines</span>
            </h1>
            <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
              {(["ats", "ou"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  style={{
                    padding: "6px 20px", borderRadius: 999, fontSize: 14, fontWeight: mode === m ? 700 : 500,
                    border: mode === m ? "2px solid #0a1a2f" : "2px solid #d6d3d1",
                    backgroundColor: mode === m ? "#0a1a2f" : "#ffffff",
                    color: mode === m ? "#ffffff" : "#44403c", cursor: "pointer",
                  }}>
                  {m === "ats" ? "Against the Spread" : "Over/Under"}
                </button>
              ))}
            </div>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 600, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { value: `${activeEdgeStats.freeEdgeWinPct}%`, label: "Free Picks", sub: `edge 2\u2013${activeEdgeLimit} pts`, color: "#94a3b8" },
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
              † Record includes only games where BBMI and Vegas lines differ by ≥ 2 points ({activeHistoricalStats.total.toLocaleString()} of 2,927 completed games).
              The Vegas line is captured at a specific point in time — lines routinely move 1–2 points between open and tip-off,
              and can vary by a point or more across different books. A difference smaller than 2 pts is within normal market noise
              and does not represent a meaningful BBMI disagreement with Vegas.{" "}
              <Link href="/ncaa-model-picks-history" style={{ color: "#2563eb", textDecoration: "underline" }}>View full public log →</Link>
            </p>
          </div>

          {/* HIGH EDGE CALLOUT */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#0a1a2f", borderRadius: 10, border: "2px solid #facc15", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{activeEdgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>win rate on picks with edge ≥ {FREE_EDGE_LIMIT} pts</span>
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
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#0a1a2f", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", padding: "1.5rem" }}>
            <EdgePerformanceGraph games={historicalGames} showTitle={true} edgeCategories={mode === "ou" ? [
              { name: "2\u20134 pts", min: 2, max: 4, color: "#64748b", width: 1.25 },
              { name: "4\u20136 pts", min: 4, max: 6, color: "#3b82f6", width: 1.75 },
              { name: "6\u20138 pts", min: 6, max: 8, color: "#f97316", width: 2.5 },
              { name: ">8 pts", min: 8, max: Infinity, color: "#22c55e", width: 2.5 },
            ] : BASKETBALL_EDGE_CATEGORIES} groupBy="biweek" mode={mode} />
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
                      Includes only picks where edge ≥ 2 pts — differences smaller than 2 pts are within normal line movement and book-to-book variation · 95% CI uses Wilson score method.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>


          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Upcoming Games</h2>
          {upcomingGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              Today&apos;s picks are typically published by 10am CT, once Vegas opening lines are available.
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
            </p>
          </div>

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

          {/* LEGEND */}
          <div style={{ maxWidth: 560, margin: "0 auto 1.25rem", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "0.65rem 1rem" }}>
            <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.65, textAlign: "center" }}>
              <span style={{ fontWeight: 600, color: "#374151" }}>Team record</span> below name = BBMI W-L when picking that team
            </div>
            <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "0.45rem", paddingTop: "0.45rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: 11, color: "#64748b" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="11" fill="#dc2626" />
                <rect x="9" y="4" width="6" height="16" rx="1.5" fill="white" />
                <rect x="4" y="9" width="16" height="6" rx="1.5" fill="white" />
              </svg>
              <span><strong style={{ color: "#374151" }}>Injury flag</strong> — Out/Doubtful players:</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#eab308", display: "inline-block" }} /> ~10% team min
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f97316", display: "inline-block" }} /> ~15%
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#dc2626", display: "inline-block" }} /> 15%+
              </span>
              <span style={{ color: "#94a3b8" }}>· hover for details · informational only</span>
            </div>
          </div>


          {/* TODAY'S REPORT CARD */}
          <TodaysReportCard games={sortedUpcoming} getLiveGame={getLiveGame} />

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 1000 }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none", width: 120 }}>
                        Score
                      </th>
                      <SortableHeader label="Away"       columnKey="away"          tooltipId="away"          align="left" {...headerProps} />
                      <SortableHeader label="Home"       columnKey="home"          tooltipId="home"          align="left" {...headerProps} />
                      {mode === "ats" ? (
                        <>
                          <SortableHeader label="Vegas Line" columnKey="vegasHomeLine" tooltipId="vegasHomeLine"              {...headerProps} />
                          <SortableHeader label="BBMI Line"  columnKey="bbmiHomeLine"  tooltipId="bbmiHomeLine"               {...headerProps} />
                          <SortableHeader label="Edge"       columnKey="edge"          tooltipId="edge"                       {...headerProps} />
                          <SortableHeader label="BBMI Pick"  columnKey="bbmiPick"      tooltipId="bbmiPick"      align="left" {...headerProps} />
                          <SortableHeader label="BBMI Win%"  columnKey="bbmiWinProb"   tooltipId="bbmiWinProb"                {...headerProps} />
                          <SortableHeader label="Vegas Win%" columnKey="vegaswinprob"  tooltipId="vegaswinprob"               {...headerProps} />
                        </>
                      ) : (
                        <>
                          <SortableHeader label="Vegas O/U"  columnKey="vegasTotal"  tooltipId="vegasTotal"    {...headerProps} />
                          <SortableHeader label="BBMI Total" columnKey="bbmiTotal"   tooltipId="bbmiTotal"     {...headerProps} />
                          <SortableHeader label="Edge"       columnKey="totalEdge"   tooltipId="totalEdge"     {...headerProps} />
                          <SortableHeader label="Pick"       columnKey="totalPick"   tooltipId="totalPick"     {...headerProps} />
                          <SortableHeader label="Over Odds"  columnKey="overOdds"    tooltipId="overOdds"      {...headerProps} />
                          <SortableHeader label="Under Odds" columnKey="underOdds"   tooltipId="underOdds"     {...headerProps} />
                        </>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {sortedUpcoming.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {sortedUpcoming.map((g, i) => {
                      const isLocked = !isPremium && g.edge >= activeEdgeLimit;
                      if (isLocked) {
                        return <LockedRowOverlay key={i} colSpan={9} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} />;
                      }

                      const awayStr = String(g.away);
                      const homeStr = String(g.home);
                      const pickStr = g.bbmiPick ? String(g.bbmiPick) : undefined;
                      const liveGame = getLiveGame(awayStr, homeStr);
                      const isBelowMinEdge = g.edge < MIN_EDGE_FOR_RECORD;
                      const rowBg = isBelowMinEdge
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const rowOpacity = isBelowMinEdge ? 0.55 : 1;
                      const rowColor = isBelowMinEdge ? "#9ca3af" : undefined;

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg, opacity: rowOpacity, color: rowColor }}>
                          <td style={{ ...TD, textAlign: "center", paddingRight: 8 }}>
                            {!liveGame || liveGame.status === "pre" ? (
                              <div style={{ minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {liveGame?.startTime
                                    ? new Date(liveGame.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                    : g.date}
                                </span>
                              </div>
                            ) : (
                              <LiveScoreBadge liveGame={liveGame} awayName={awayStr} homeName={homeStr} bbmiPickTeam={pickStr} vegasHomeLine={g.vegasHomeLine} />
                            )}
                          </td>

                          <td style={{ ...TD, paddingLeft: 16 }}>
                            <Link href={`/ncaa-team/${encodeURIComponent(awayStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={awayStr} size={22} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {(() => { const r = getTeamRecord(awayStr); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                                  <InjuryBadge teamName={awayStr} />
                                </div>
                              </div>
                            </Link>
                          </td>

                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(homeStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={homeStr} size={22} />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {(() => { const r = getTeamRecord(homeStr); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                                  <InjuryBadge teamName={homeStr} />
                                </div>
                              </div>
                            </Link>
                          </td>

                          {mode === "ats" ? (
                            <>
                              <td style={TD_RIGHT}>{g.vegasHomeLine}</td>
                              <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : g.edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: g.edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                                {isBelowMinEdge ? "~" : ""}{g.edge.toFixed(1)}
                              </td>
                              <td style={TD}>
                                {g.bbmiPick && (
                                  <Link href={`/ncaa-team/${encodeURIComponent(String(g.bbmiPick))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                                    <NCAALogo teamName={String(g.bbmiPick)} size={18} />
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{g.bbmiPick}</span>
                                  </Link>
                                )}
                              </td>
                              <td style={TD_RIGHT}>{g.bbmiWinProb == null ? "\u2014" : `${(g.bbmiWinProb * 100).toFixed(1)}%`}</td>
                              <td style={TD_RIGHT}>{g.vegaswinprob == null ? "\u2014" : `${(g.vegaswinprob * 100).toFixed(1)}%`}</td>
                            </>
                          ) : (
                            <>
                              <td style={TD_RIGHT}>{g.vegasTotal ?? "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, fontWeight: 700 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : g.edge >= 4 ? "#16a34a" : "#374151", fontWeight: g.edge >= 4 ? 800 : 600 }}>
                                {isBelowMinEdge ? "~" : ""}{g.edge.toFixed(1)}
                              </td>
                              <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
                                {g.totalPick === "over" ? (
                                  <span style={{ color: "#dc2626" }}>{"\u2191"} Over</span>
                                ) : g.totalPick === "under" ? (
                                  <span style={{ color: "#2563eb" }}>{"\u2193"} Under</span>
                                ) : "\u2014"}
                              </td>
                              <td style={TD_RIGHT}>{g.overOdds ? decimalToAmerican(g.overOdds) : "\u2014"}</td>
                              <td style={TD_RIGHT}>{g.underOdds ? decimalToAmerican(g.underOdds) : "\u2014"}</td>
                            </>
                          )}
                        </tr>
                      );
                    })}

                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#f0f9ff" }}>
                        <td colSpan={9} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate vs {activeEdgeStats.freeEdgeWinPct}% free picks
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

          {/* UPCOMING GAMES TOGGLE */}
          {futureGames.length > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
              <button
                onClick={() => setShowFuture((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "12px 20px",
                  backgroundColor: showFuture ? "#0a1a2f" : "#ffffff",
                  color: showFuture ? "#ffffff" : "#0a1a2f",
                  border: showFuture ? "2px solid #0a1a2f" : "2px solid #d6d3d1",
                  borderRadius: 10, fontSize: "0.88rem", fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.02em",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 16 }}>📅</span>
                {showFuture ? "Hide" : "Show"} Upcoming Games ({futureGames.length})
                <span style={{ fontSize: 12, opacity: 0.7 }}>{showFuture ? "▲" : "▼"}</span>
              </button>

              {showFuture && (
                <div style={{ marginTop: 12, border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                  <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 16px", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Upcoming Games — Lines Already Set
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 920 }}>
                      <colgroup>
                        <col style={{ width: 100 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 150 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 70 }} />
                        <col style={{ width: 130 }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 90 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {["Date", "Away", "Home", "Vegas Line", "BBMI Line", "Edge", "BBMI Pick", "BBMI Win%", "Vegas Win%"].map((h) => (
                            <th key={h} style={{
                              backgroundColor: "#1e3a5f", color: "#ffffff",
                              padding: "6px 7px", textAlign: h === "Away" || h === "Home" || h === "BBMI Pick" ? "left" : "center",
                              whiteSpace: "nowrap", fontSize: "0.72rem", fontWeight: 700,
                              letterSpacing: "0.06em", textTransform: "uppercase",
                              borderBottom: "2px solid rgba(255,255,255,0.1)",
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...futureGames].sort((a, b) => {
                          const edgeA = Math.abs((a.bbmiHomeLine ?? 0) - (a.vegasHomeLine ?? 0));
                          const edgeB = Math.abs((b.bbmiHomeLine ?? 0) - (b.vegasHomeLine ?? 0));
                          return edgeB - edgeA;
                        }).map((g, i) => {
                          const awayStr = String(g.away);
                          const homeStr = String(g.home);
                          const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
                          const bbmiPick = g.bbmiHomeLine == null || g.vegasHomeLine == null ? ""
                            : g.bbmiHomeLine === g.vegasHomeLine ? ""
                            : g.bbmiHomeLine > g.vegasHomeLine ? g.away : g.home;
                          const pickStr = bbmiPick ? String(bbmiPick) : undefined;
                          const isBelowMinEdge = edge < MIN_EDGE_FOR_RECORD;
                          const isLocked = !isPremium && edge >= FREE_EDGE_LIMIT;
                          const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";

                          const dateDisplay = g.date
                            ? (() => {
                                try {
                                  const d = new Date(String(g.date).split("T")[0] + "T12:00:00");
                                  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" });
                                } catch { return String(g.date).split("T")[0]; }
                              })()
                            : "—";

                          if (isLocked) {
                            return <LockedRowOverlay key={i} colSpan={9} onSubscribe={() => setShowPaywall(true)} winPct={activeEdgeStats.highEdgeWinPct} />;
                          }

                          return (
                            <tr key={i} style={{ backgroundColor: rowBg, opacity: isBelowMinEdge ? 0.55 : 1, color: isBelowMinEdge ? "#9ca3af" : undefined }}>
                              <td style={{ ...TD, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#57534e" }}>{dateDisplay}</td>
                              <td style={{ ...TD, paddingLeft: 8 }}>
                                <Link href={`/ncaa-team/${encodeURIComponent(awayStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                                  <NCAALogo teamName={awayStr} size={22} />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <InjuryBadge teamName={awayStr} />
                                    </div>
                                  </div>
                                </Link>
                              </td>
                              <td style={TD}>
                                <Link href={`/ncaa-team/${encodeURIComponent(homeStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                                  <NCAALogo teamName={homeStr} size={22} />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                    <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <InjuryBadge teamName={homeStr} />
                                    </div>
                                  </div>
                                </Link>
                              </td>
                              <td style={TD_RIGHT}>{g.vegasHomeLine}</td>
                              <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>
                              <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                                {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                              </td>
                              <td style={TD}>
                                {pickStr && (
                                  <Link href={`/ncaa-team/${encodeURIComponent(pickStr)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                                    <NCAALogo teamName={pickStr} size={18} />
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{pickStr}</span>
                                  </Link>
                                )}
                              </td>
                              <td style={TD_RIGHT}>{g.bbmiWinProb == null ? "—" : `${(g.bbmiWinProb * 100).toFixed(1)}%`}</td>
                              <td style={TD_RIGHT}>{g.vegaswinprob == null ? "—" : `${(g.vegaswinprob * 100).toFixed(1)}%`}</td>
                            </tr>
                          );
                        })}

                        {!isPremium && futureLockedCount > 0 && (
                          <tr style={{ backgroundColor: "#f0f9ff" }}>
                            <td colSpan={9} style={{ padding: "1rem", textAlign: "center" }}>
                              <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                                <strong>{futureLockedCount} high-edge {futureLockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{activeEdgeStats.highEdgeWinPct}%</strong> accurate vs {activeEdgeStats.freeEdgeWinPct}% free picks
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
                  <div style={{ padding: "8px 16px", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4", textAlign: "center" }}>
                    <span style={{ fontSize: 11, color: "#78716c" }}>
                      Lines set by the pipeline ahead of game day — Vegas lines may shift before tip-off.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

import { Suspense } from "react";

export default function BettingLinesPage() {
  return (
    <AuthProvider>
      <Suspense fallback={<div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}>
        <BettingLinesPageContent />
      </Suspense>
    </AuthProvider>
  );
}
