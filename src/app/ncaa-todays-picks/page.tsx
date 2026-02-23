"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import { AuthProvider, useAuth } from "../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";

// ------------------------------------------------------------
// FREE TIER THRESHOLD
// ------------------------------------------------------------
const FREE_EDGE_LIMIT = 5;

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

type UpcomingGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
  vegaswinprob: number | null;
};

type SortableKeyUpcoming =
  | "bbmiPick" | "date" | "away" | "home"
  | "vegasHomeLine" | "bbmiHomeLine" | "bbmiWinProb"
  | "vegaswinprob" | "edge";

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

// Minimal shape we need from each ESPN competitor object
interface EspnCompetitor {
  homeAway: string;
  score?: string | null;
  team: {
    displayName: string;
    shortDisplayName: string;
    abbreviation: string;
  };
}

// ── Team name crosswalk — [BBMI name, ESPN displayName] ──────────────────────
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
  ["FIU",               "FIU"],
  ["FAU",               "FAU"],
  ["LSU",               "LSU"],
  ["USC",               "USC"],
  ["UCF",               "UCF"],
  ["UAB",               "UAB"],
  ["Louisiana",         "Louisiana"],
  ["Merrimack",         "Merrimack College"],
  ["Purdue",            "Purdue Boilermakers"],
];

// Names that must NOT have their last word stripped — stripping would cause
// false matches (e.g. "iowa state" → "iowa", "michigan state" → "michigan")
const NO_STRIP = new Set([
  "iowa state",
  "michigan state",
  "ohio state",
  "florida state",
  "kansas state",
  "penn state",
  "utah state",
  "fresno state",
  "san jose state",
  "boise state",
  "colorado state",
  "kent state",
  "ball state",
  "north carolina state",
  "mississippi state",
  "washington state",
  "oregon state",
  "arizona state",
  "oklahoma state",
  "texas state",
  "morgan state",
  "alcorn state",
  "coppin state",
  "jackson state",
  "grambling state",
  "savannah state",
  "tennessee state",
  "illinois state",
  "indiana state",
  "wichita state",
  "kennesaw state",
  "portland state",
  "weber state",
  "north carolina",
  "south carolina",
  "north florida",
  "south florida",
  "northern iowa",
  "southern illinois",
  "central michigan",
  "eastern michigan",
  "western michigan",
  "northern michigan",
  "central connecticut",
  "western kentucky",
  "eastern kentucky",
  "northern kentucky",
  "southern mississippi",
  "northern illinois",
  "eastern illinois",
  "western illinois",
]);

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ESPN displayName → BBMI name lookup (first=BBMI, second=ESPN in crosswalk)
const ESPN_TO_BBMI: Record<string, string> = Object.fromEntries(
  TEAM_CROSSWALK.map(([bbmi, espn]) => [norm(espn), norm(bbmi)])
);

function normalizeTeamName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ESPN_TO_BBMI[base] ?? base;
}

function normalizeWithoutMascot(name: string): string {
  const n = normalizeTeamName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const withoutLast = words.slice(0, -1).join(" ");
  // If stripping the mascot reveals a protected name, stop there
  if (NO_STRIP.has(withoutLast)) return withoutLast;
  return words.length > 1 ? withoutLast : n;
}

function normalizeWithoutTwoWords(name: string): string {
  const n = normalizeTeamName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const withoutOne = words.slice(0, -1).join(" ");
  const withoutTwo = words.length > 2 ? words.slice(0, -2).join(" ") : withoutOne;
  // If stripping one word reveals a protected name, stop there — don't strip further
  if (NO_STRIP.has(withoutOne)) return withoutOne;
  if (NO_STRIP.has(withoutTwo)) return withoutTwo;
  return words.length > 2 ? withoutTwo : normalizeWithoutMascot(name);
}

function makeGameKey(away: string, home: string): string {
  return `${normalizeTeamName(away)}|${normalizeTeamName(home)}`;
}
function makeAwayKey(away: string): string { return `away:${normalizeTeamName(away)}`; }
function makeHomeKey(home: string): string { return `home:${normalizeTeamName(home)}`; }

const ESPN_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50";

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const res = await fetch(ESPN_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  const data = await res.json();
  const map = new Map<string, LiveGame>();

  // Only include today's games — prevents stale results from yesterday bleeding in.
  // Use local date (not UTC) so evening games don't get filtered out when UTC
  // has already rolled over to the next day.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

  for (const event of data.events ?? []) {
    const gameDate = (event.date ?? "").slice(0, 10);
    if (gameDate !== today) continue;

    const comp = event.competitions?.[0];
    if (!comp) continue;

    // Fix: type the find callback instead of using any
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
      status,
      statusDisplay,
      period: st.period ?? null,
      clock: st.displayClock ?? null,
      startTime: event.date ?? null,
      espnAwayName: awayC.team.displayName,
      espnHomeName: homeC.team.displayName,
      espnAwayAbbrev: awayC.team.abbreviation ?? awayC.team.shortDisplayName ?? awayC.team.displayName.split(" ")[0],
      espnHomeAbbrev: homeC.team.abbreviation ?? homeC.team.shortDisplayName ?? homeC.team.displayName.split(" ")[0],
    };

    // Register under multiple key variants for fuzzy matching
    [
      [awayC.team.displayName, homeC.team.displayName],
      [awayC.team.shortDisplayName, homeC.team.shortDisplayName],
      [awayC.team.abbreviation, homeC.team.abbreviation],
    ].forEach(([a, h]) => map.set(makeGameKey(a, h), liveGame));

    [awayC.team.displayName, awayC.team.shortDisplayName].forEach((aN) => {
      [homeC.team.displayName, homeC.team.shortDisplayName].forEach((hN) => {
        const a0 = normalizeTeamName(aN),        h0 = normalizeTeamName(hN);
        const a1 = normalizeWithoutMascot(aN),   h1 = normalizeWithoutMascot(hN);
        const a2 = normalizeWithoutTwoWords(aN),  h2 = normalizeWithoutTwoWords(hN);
        map.set(`${a1}|${h1}`, liveGame);
        map.set(`${a1}|${h0}`, liveGame);
        map.set(`${a0}|${h1}`, liveGame);
        map.set(`${a2}|${h2}`, liveGame);
        map.set(`${a2}|${h0}`, liveGame);
        map.set(`${a0}|${h2}`, liveGame);
        map.set(`${a2}|${h1}`, liveGame);
        map.set(`${a1}|${h2}`, liveGame);
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
      return (
        liveScores.get(`${aN}|${hN}`) ??
        liveScores.get(`away:${aN}`) ??
        liveScores.get(`home:${hN}`)
      );
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
  const uid = tooltipId ? tooltipId + "_" + columnKey : null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && TOOLTIPS[tooltipId] && openDesc && uid) {
      // Fix: no-non-null-asserted-optional-chain + no-unused-expressions
      if (descShowing) {
        closeDesc?.();
      } else {
        const rect = thRef.current?.getBoundingClientRect();
        if (rect) openDesc(uid, rect);
      }
    }
  };

  return (
    <th
      ref={thRef}
      rowSpan={rowSpan}
      style={{
        backgroundColor: "#0a1a2f", color: "#ffffff",
        padding: "6px 7px", textAlign: align,
        whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
        borderBottom: "2px solid rgba(255,255,255,0.1)",
        fontSize: "0.72rem", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        verticalAlign: "middle", userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span
          onClick={handleLabelClick}
          style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
        >
          {label}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }}
          style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}
        >
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// LOCKED ROW OVERLAY
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// PAYWALL MODAL
// ------------------------------------------------------------

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

        <div style={{ backgroundColor: "#0a1a2f", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks · edge ≥ {FREE_EDGE_LIMIT}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>all picks tracked</div>
          </div>
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
          <Link href="/auth" onClick={onClose} style={{ fontSize: "0.75rem", color: "#2563eb", fontWeight: 700, textDecoration: "underline" }}>
            Sign in →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// TODAY'S REPORT CARD
// ------------------------------------------------------------

function TodaysReportCard({ games, getLiveGame }: {
  // Fix: replaced any with proper union type
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
      const bbmiLine  = g.bbmiHomeLine  ?? 0;

      // No pick when lines agree — exclude from all counts
      if (bbmiLine === vegasLine) return acc;

      const bbmiPickIsHome = bbmiLine < vegasLine;

      const actualMargin = homeScore - awayScore;
      const homeCovers   = actualMargin > -vegasLine;
      const push         = actualMargin === -vegasLine;
      const bbmiCorrect  = push ? null : bbmiPickIsHome ? homeCovers : !homeCovers;

      if (push) { acc.push++; return acc; }
      // Fix: replaced ternary side-effects with explicit if/else (no-unused-expressions)
      if (status === "in")   { if (bbmiCorrect) { acc.winning++; } else { acc.losing++; } acc.live++;  return acc; }
      if (status === "post") { if (bbmiCorrect) { acc.wins++;    } else { acc.losses++; } acc.final++; return acc; }
      return acc;
    },
    { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 }
  );

  const totalSettled  = results.wins + results.losses;
  const totalCombined = results.wins + results.losses + results.winning + results.losing;
  const combinedWins  = results.wins + results.winning;
  const totalTracked  = totalSettled + results.live;

  if (totalTracked === 0 && results.push === 0) return null;

  const winColor  = "#16a34a";
  const lossColor = "#dc2626";
  const liveColor = "#f59e0b";

  return (
    <div style={{
      maxWidth: 1100, margin: "0 auto 1.25rem",
      backgroundColor: "#ffffff", border: "1px solid #e7e5e4",
      borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
      overflow: "hidden",
    }}>
      <div style={{
        backgroundColor: "#0a1a2f", color: "#ffffff",
        padding: "8px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          📋 Today&apos;s Report Card
        </span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Final ATS record */}
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: totalSettled === 0 ? "#94a3b8" : results.wins >= results.losses ? winColor : lossColor }}>
            {results.wins}–{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>ATS Record</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>
            {totalSettled} final{results.push > 0 ? ` · ${results.push} push` : ""}
          </div>
        </div>

        {/* Currently covering */}
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : liveColor }}>
            {results.winning}–{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Covering</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>
            {results.live} game{results.live !== 1 ? "s" : ""} in progress
          </div>
        </div>

        {/* Today's win rate — includes live games */}
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
          <div style={{
            fontSize: "1.6rem", fontWeight: 800, lineHeight: 1,
            color: totalCombined === 0 ? "#94a3b8" : combinedWins / totalCombined >= 0.5 ? winColor : lossColor,
          }}>
            {totalCombined === 0 ? "—" : `${((combinedWins / totalCombined) * 100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Today&apos;s Win Rate</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>
            {totalCombined === 0 ? "no games yet" : `${combinedWins} of ${totalCombined} picks (incl. live)`}
          </div>
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
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI Today's Picks – NCAA Betting Lines & Predictions",
      description: "Live NCAA basketball betting lines, BBMI model picks, and win probabilities for today's games.",
      url: "https://bbmihoops.com/ncaa-todays-picks",
      dateModified: "2025-01-01",
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const cleanedGames = games.filter((g) => g.date && g.away && g.home);
  const upcomingGames: UpcomingGame[] = cleanedGames.filter((g) =>
    g.actualHomeScore === 0 || g.actualHomeScore == null || g.actualAwayScore == null
  );
  const historicalGames = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  const edgeStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";
    const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length };
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
      wins: record.wins,
      picks: record.picks,
      winPct: ((record.wins / record.picks) * 100).toFixed(0),
      display: `${record.wins}-${record.picks - record.wins}`,
      color: record.wins / record.picks >= 0.5 ? "#16a34a" : "#dc2626",
    };
  };

  const [minEdge, setMinEdge] = useState<number>(0);
  const edgeOptions = useMemo(() => { const o = [0]; for (let i = 0.5; i <= 10; i += 0.5) o.push(i); return o; }, []);

  const edgePerformanceStats = useMemo(() => {
    const cats = [
      { name: "≤2 pts", min: 0, max: 2 },
      { name: "2–4 pts", min: 2, max: 4 },
      { name: "4–6 pts", min: 4, max: 6 },
      { name: "6–8 pts", min: 6, max: 8 },
      { name: ">8 pts", min: 8, max: Infinity },
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
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const wins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const wagered = allBets.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
    const won = allBets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    return {
      total: allBets.length,
      winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0",
      roi: wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0",
    };
  }, [historicalGames]);

  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return upcomingGames;
    return upcomingGames.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= minEdge);
  }, [upcomingGames, minEdge]);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKeyUpcoming; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKeyUpcoming) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedUpcoming = useMemo(() => {
    const withComputed = edgeFilteredGames.map((g) => ({
      ...g,
      bbmiPick: g.bbmiHomeLine == null || g.vegasHomeLine == null ? ""
        : g.bbmiHomeLine === g.vegasHomeLine ? ""
        : g.bbmiHomeLine > g.vegasHomeLine ? g.away : g.home,
      edge: Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)),
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
  const lockedCount = sortedUpcoming.filter((g) => g.edge >= FREE_EDGE_LIMIT).length;

  const hasLiveGames = sortedUpcoming.some((g) => {
    const live = getLiveGame(String(g.away), String(g.home));
    return live?.status === "in";
  });

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={edgeStats.highEdgeWinPct} highEdgeTotal={edgeStats.highEdgeTotal} overallWinPct={edgeStats.overallWinPct} />}

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
              <span style={{ marginLeft: 12 }}>Men&apos;s Picks</span>
            </h1>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 600, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { value: `${historicalStats.winPct}%`, label: "Beat Vegas", sub: "All tracked picks", color: Number(historicalStats.winPct) >= 50 ? "#16a34a" : "#dc2626" },
              { value: `${historicalStats.roi}%`, label: "ROI", sub: "Flat $100/game", color: Number(historicalStats.roi) >= 0 ? "#16a34a" : "#dc2626" },
              { value: historicalStats.total.toLocaleString(), label: "Games Tracked", sub: "Every result logged", color: "#0a1a2f" },
            ].map((card) => (
              <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* HIGH EDGE CALLOUT */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#0a1a2f", borderRadius: 10, border: "2px solid #facc15", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{edgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>win rate on picks with edge ≥ {FREE_EDGE_LIMIT} pts</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "rgba(255,255,255,0.6)" }}>{edgeStats.overallWinPct}%</strong> overall · documented across <strong style={{ color: "rgba(255,255,255,0.6)" }}>{edgeStats.highEdgeTotal}</strong> picks
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
            <EdgePerformanceGraph games={historicalGames} showTitle={true} />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Historical Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
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
                  {edgePerformanceStats.map((stat, idx) => (
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
                      Historical performance across all completed games where BBMI made a pick · 95% CI uses Wilson score method.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#166534", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {FREE_EDGE_LIMIT} pts) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks ≥ {FREE_EDGE_LIMIT} pts</strong> — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access — use the edge filter to focus on the model&apos;s strongest picks.</span>}
            </p>
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 16 }}>Upcoming Games</h2>

          {/* EDGE FILTER */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <label htmlFor="edge-filter" style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Minimum Edge</label>
            <select
              id="edge-filter"
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
              style={{ height: 44, border: "2px solid #d6d3d1", borderRadius: 8, padding: "0 20px", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", fontSize: "1rem", fontWeight: 600, color: "#1c1917", minWidth: 200 }}
            >
              {edgeOptions.map((edge) => (
                <option key={edge} value={edge}>{edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}</option>
              ))}
            </select>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#44403c", margin: 0 }}>
              Showing <strong>{sortedUpcoming.length}</strong> of <strong>{upcomingGames.length}</strong> games
              {!isPremium && lockedCount > 0 && <span style={{ color: "#dc2626", marginLeft: 8 }}>· {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked 🔒</span>}
            </p>
            {!isPremium && (
              <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic", margin: 0 }}>
                Free picks shown for edge &lt; {FREE_EDGE_LIMIT} pts.{" "}
                <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                  Subscribe to unlock high-edge picks →
                </button>
              </p>
            )}
          </div>

          {/* LIVE SCORES STATUS PILL */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              backgroundColor: hasLiveGames ? "#f0fdf4" : "#f8fafc",
              border: `1px solid ${hasLiveGames ? "#86efac" : "#e2e8f0"}`,
              borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem",
              color: hasLiveGames ? "#15803d" : "#64748b", fontWeight: 600,
            }}>
              {liveLoading ? (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              ) : hasLiveGames ? (
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              )}
              {liveLoading
                ? "Loading live scores…"
                : hasLiveGames
                ? `Live scores updating · ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN · Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—"}`
              }
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#78716c", textAlign: "center", fontStyle: "italic", marginBottom: 8 }}>
            Team records shown below team names indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>

          {/* TODAY'S REPORT CARD */}
          <TodaysReportCard games={sortedUpcoming} getLiveGame={getLiveGame} />

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
  <colgroup>
    <col style={{ width: 120 }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: 75 }} />
    <col style={{ width: 75 }} />
    <col style={{ width: 60 }} />
    <col style={{ width: "15%" }} />
    <col style={{ width: 75 }} />
    <col style={{ width: 75 }} />
  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none" }}>
                        Score
                      </th>
                      <SortableHeader label="Away"       columnKey="away"          tooltipId="away"         align="left" {...headerProps} />
                      <SortableHeader label="Home"       columnKey="home"          tooltipId="home"         align="left" {...headerProps} />
                      <SortableHeader label="Vegas Line" columnKey="vegasHomeLine" tooltipId="vegasHomeLine"             {...headerProps} />
                      <SortableHeader label="BBMI Line"  columnKey="bbmiHomeLine"  tooltipId="bbmiHomeLine"              {...headerProps} />
                      <SortableHeader label="Edge"       columnKey="edge"          tooltipId="edge"                      {...headerProps} />
                      <SortableHeader label="BBMI Pick"  columnKey="bbmiPick"      tooltipId="bbmiPick"     align="left" {...headerProps} />
                      <SortableHeader label="BBMI Win%"  columnKey="bbmiWinProb"   tooltipId="bbmiWinProb"               {...headerProps} />
                      <SortableHeader label="Vegas Win%" columnKey="vegaswinprob"  tooltipId="vegaswinprob"              {...headerProps} />
                    </tr>
                  </thead>

                  <tbody>
                    {sortedUpcoming.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {sortedUpcoming.map((g, i) => {
                      const isLocked = !isPremium && g.edge >= FREE_EDGE_LIMIT;
                      if (isLocked) {
                        return <LockedRowOverlay key={i} colSpan={9} onSubscribe={() => setShowPaywall(true)} winPct={edgeStats.highEdgeWinPct} />;
                      }

                      const awayStr = String(g.away);
                      const homeStr = String(g.home);
                      const pickStr = g.bbmiPick ? String(g.bbmiPick) : undefined;
                      const liveGame = getLiveGame(awayStr, homeStr);
                      const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD, textAlign: "center", width: 120 }}>
                            {!liveGame || liveGame.status === "pre" ? (
                              <div style={{ width: 112, minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
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

                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(awayStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={awayStr} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                                {(() => { const r = getTeamRecord(awayStr); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>

                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(homeStr)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={homeStr} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                                {(() => { const r = getTeamRecord(homeStr); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>

                          <td style={TD_RIGHT}>{g.vegasHomeLine}</td>
                          <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>
                          <td style={{ ...TD_RIGHT, color: g.edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: g.edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                            {g.edge.toFixed(1)}
                          </td>
                          <td style={TD}>
                            {g.bbmiPick && (
                              <Link href={`/ncaa-team/${encodeURIComponent(String(g.bbmiPick))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                                <NCAALogo teamName={String(g.bbmiPick)} size={18} />
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{g.bbmiPick}</span>
                              </Link>
                            )}
                          </td>
                          <td style={TD_RIGHT}>{g.bbmiWinProb == null ? "—" : `${(g.bbmiWinProb * 100).toFixed(1)}%`}</td>
                          <td style={TD_RIGHT}>{g.vegaswinprob == null ? "—" : `${(g.vegaswinprob * 100).toFixed(1)}%`}</td>
                        </tr>
                      );
                    })}

                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#f0f9ff" }}>
                        <td colSpan={9} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate vs {edgeStats.overallWinPct}% overall
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

        </div>
      </div>
    </>
  );
}

export default function BettingLinesPage() {
  return (
    <AuthProvider>
      <BettingLinesPageContent />
    </AuthProvider>
  );
}
