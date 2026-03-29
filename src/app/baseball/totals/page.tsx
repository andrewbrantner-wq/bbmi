"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/baseball-games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

// ------------------------------------------------------------
// COLUMN TOOLTIPS
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  awayTeam: "The visiting team.",
  homeTeam: "The home team.",
  vegasTotal: "Vegas over/under line \u2014 the sportsbook\u2019s projected total runs scored in the game.",
  bbmiTotal: "BBMI\u2019s projected total runs scored, based on pitcher-adjusted team scoring models.",
  edge: "The gap between BBMI\u2019s total and the Vegas O/U in runs. Larger edge = stronger model conviction.",
  pick: "BBMI\u2019s over/under call. Under picks are the primary product \u2014 over picks are shown for transparency only.",
  score: "Live game score or final result. Shows start time for upcoming games.",
  pitchers: "Confirmed or projected starting pitchers for each team. PROJ = inferred from rotation.",
  actual: "Actual total runs scored. For live games, shows the running total. For finals, colored red (over) or blue (under) relative to the Vegas line.",
  date: "The date the game was played.",
  actualTotal: "Final combined runs scored. Red = went over the Vegas line. Blue = went under.",
  result: "Whether BBMI\u2019s pick was correct (\u2713) or wrong (\u2717).",
};

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  bbmiLine: number | null;
  vegasLine: number | null;
  bbmiTotal: number | null;
  vegasTotal: number | null;
  bbmiHomeProj: number | null;
  bbmiAwayProj: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homeWinPct: number | null;
  homePitcher: string;
  awayPitcher: string;
  pitcherConfirmed: boolean;
  homePitcherSource?: string;
  awayPitcherSource?: string;
  homePitcherERA?: number | null;
  awayPitcherERA?: number | null;
  confidenceFlag?: string;
  modelMaturity?: string;
};

type SortableKey =
  | "awayTeam" | "homeTeam" | "vegasTotal" | "bbmiTotal"
  | "edge" | "pick";

const MIN_EDGE_FOR_RECORD = 1; // runs — minimum edge to count in report card
const PREMIUM_EDGE_RUNS = 3;   // runs — split point for free/premium display

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

/** True if this pitcher source represents a real starter (not team baseline). */
function hasPitcher(source?: string): boolean {
  return !!source && source !== "team_baseline";
}

/** True if the pitcher source is rotation-inferred (projected, not confirmed). */
function isProjectedPitcher(source?: string): boolean {
  return !!source && source.startsWith("rotation");
}

/** ROI at standard -110 juice */
function roiAtStandardJuice(wins: number, losses: number): string {
  if (wins + losses === 0) return "\u2014";
  const profit = wins * (100 / 110) - losses;
  return `${profit >= 0 ? "+" : ""}${((profit / (wins + losses)) * 100).toFixed(1)}%`;
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
  startTime: string | null;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
}

function getEspnUrl(): string {
  const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date()).replace(/-/g, "");
  return `https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${ctDate}&limit=200`;
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const res = await fetch(getEspnUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  const data = await res.json();
  const map = new Map<string, LiveGame>();

  for (const event of data.events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const awayC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "away");
    const homeC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "home");
    if (!awayC || !homeC) continue;

    const st = comp.status ?? event.status;
    const statusType = st?.type?.name ?? "";
    if (statusType === "STATUS_SCHEDULED") continue;

    const sid = st?.type?.id ?? "";
    const isLive = sid === "2" || sid === "23";
    const status: GameStatus = isLive ? "in" : sid === "3" ? "post" : "pre";

    let statusDisplay = "";
    if (statusType === "STATUS_FINAL") {
      statusDisplay = "Final";
    } else if (isLive) {
      const inning = st?.period ?? 1;
      const half = st?.type?.shortDetail ?? `${inning}`;
      statusDisplay = half;
    } else {
      statusDisplay = st?.type?.description ?? "";
    }

    const awayScore = awayC.score != null ? Number(awayC.score) : null;
    const homeScore = homeC.score != null ? Number(homeC.score) : null;

    const liveGame: LiveGame = {
      awayScore: Number.isNaN(awayScore) ? null : awayScore,
      homeScore: Number.isNaN(homeScore) ? null : homeScore,
      status, statusDisplay,
      startTime: event.date ?? null,
      espnAwayAbbrev: awayC.team?.abbreviation ?? awayC.team?.shortDisplayName ?? "",
      espnHomeAbbrev: homeC.team?.abbreviation ?? homeC.team?.shortDisplayName ?? "",
    };

    // Index by multiple name variants
    const names = (c: typeof awayC) => {
      const full = normalizeTeamName(c.team?.displayName ?? "");
      const short = normalizeTeamName(c.team?.shortDisplayName ?? "");
      // Also strip last word (mascot) for matching
      const stripped = full.split(" ").slice(0, -1).join(" ");
      return [full, short, stripped].filter(Boolean);
    };

    for (const a of names(awayC)) {
      for (const h of names(homeC)) {
        map.set(`${a}|${h}`, liveGame);
      }
      map.set(`away:${a}`, liveGame);
    }
    for (const h of names(homeC)) {
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
// LIVE TOTAL SCORE BADGE (mirrored from basketball)
// ------------------------------------------------------------

function LiveTotalBadge({ liveGame, vegasTotal, bbmiPick }: {
  liveGame: LiveGame | undefined;
  vegasTotal: number | null;
  bbmiPick: string;
}) {
  if (!liveGame || liveGame.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = liveGame;
  const hasScores = awayScore != null && homeScore != null;
  const currentTotal = hasScores ? awayScore + homeScore : null;
  const isPost = status === "post";

  let bbmiCorrect: boolean | null = null;
  if (currentTotal != null && vegasTotal != null && bbmiPick && isPost) {
    if (currentTotal === vegasTotal) {
      bbmiCorrect = null;
    } else if (bbmiPick === "over") {
      bbmiCorrect = currentTotal > vegasTotal;
    } else {
      bbmiCorrect = currentTotal < vegasTotal;
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
        {status === "in" && (
          <span className="live-dot" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor }} />
        )}
        <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: statusColor }}>
          {statusDisplay}
        </span>
      </div>
      {hasScores && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.75rem" }}>
          <span style={{ color: "#1e293b" }}>{liveGame.espnAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>&ndash;</span>
          <span style={{ color: "#1e293b" }}>{homeScore} {liveGame.espnHomeAbbrev}</span>
        </div>
      )}
      {isPost && bbmiCorrect !== null && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiCorrect ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiCorrect ? "\u2713 WIN" : "\u2717 LOSS"}
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
  label: string;
  columnKey: SortableKey;
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

// ------------------------------------------------------------
// TODAY'S O/U REPORT CARD
// ------------------------------------------------------------

function TotalsReportCard({ games: todayGames, getLiveGame }: {
  games: Array<Game & { edge: number; pick: string }>;
  getLiveGame: (away: string, home: string) => LiveGame | undefined;
}) {
  type Acc = { wins: number; losses: number; winning: number; losing: number; push: number; live: number; final: number };
  const empty = (): Acc => ({ wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 });

  function tally(filterPick?: "under" | "over"): Acc {
    return todayGames.reduce((acc, g) => {
      if (!g.pick || g.vegasTotal == null || g.pick === "push") return acc;
      if (g.edge < MIN_EDGE_FOR_RECORD) return acc;
      if (filterPick && g.pick !== filterPick) return acc;

      const getActual = (): { total: number; status: GameStatus } | null => {
        if (g.actualHomeScore != null && g.actualAwayScore != null)
          return { total: g.actualHomeScore + g.actualAwayScore, status: "post" };
        const live = getLiveGame(g.awayTeam, g.homeTeam);
        if (!live || live.status === "pre" || live.awayScore == null || live.homeScore == null) return null;
        return { total: live.awayScore + live.homeScore, status: live.status };
      };

      const actual = getActual();
      if (!actual) return acc;

      if (actual.total === g.vegasTotal) { acc.push++; return acc; }
      const correct = g.pick === "over" ? actual.total > g.vegasTotal : actual.total < g.vegasTotal;

      if (actual.status === "post") {
        if (correct) acc.wins++; else acc.losses++;
        acc.final++;
      } else {
        if (correct) acc.winning++; else acc.losing++;
        acc.live++;
      }
      return acc;
    }, empty());
  }

  const under = tally("under");
  const all = tally();

  const underSettled = under.wins + under.losses;
  const underCombined = underSettled + under.winning + under.losing;
  const underCombinedWins = under.wins + under.winning;
  const allSettled = all.wins + all.losses;
  const allCombined = allSettled + all.winning + all.losing;
  const allCombinedWins = all.wins + all.winning;
  const totalTracked = allSettled + all.live;

  if (totalTracked === 0 && all.push === 0) return null;

  const winColor = "#16a34a";
  const lossColor = "#dc2626";
  const liveColor = "#f59e0b";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* UNDER PICKS — PRIMARY (prominent, blue accent) */}
      <div style={{ backgroundColor: "#ffffff", border: "2px solid #2563eb", borderRadius: 10, boxShadow: "0 2px 8px rgba(37,99,235,0.12)", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{"\u2193"} Today&apos;s Under Picks</span>
          {under.live > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600 }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
              {under.live} game{under.live !== 1 ? "s" : ""} live
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: 1, padding: "16px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: underSettled === 0 ? "#94a3b8" : under.wins >= under.losses ? winColor : lossColor }}>
              {under.wins}&ndash;{under.losses}
            </div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2563eb", marginTop: 4 }}>Under Record</div>
            <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{underSettled} final (edge &ge; {MIN_EDGE_FOR_RECORD}){under.push > 0 ? ` \u00B7 ${under.push} push` : ""}</div>
          </div>
          <div style={{ flex: 1, padding: "16px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: under.live === 0 ? "#94a3b8" : liveColor }}>
              {under.winning}&ndash;{under.losing}
            </div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2563eb", marginTop: 4 }}>Currently Hitting</div>
            <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{under.live} under{under.live !== 1 ? "s" : ""} in progress</div>
          </div>
          <div style={{ flex: 1, padding: "16px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem", fontWeight: 800, lineHeight: 1, color: underCombined === 0 ? "#94a3b8" : underCombinedWins / underCombined >= 0.5 ? winColor : lossColor }}>
              {underCombined === 0 ? "\u2014" : `${((underCombinedWins / underCombined) * 100).toFixed(0)}%`}
            </div>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#2563eb", marginTop: 4 }}>Under Win Rate</div>
            <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{underCombined === 0 ? "no unders yet" : `${underCombinedWins} of ${underCombined} under picks`}</div>
          </div>
        </div>
      </div>

      {/* ALL O/U — SECONDARY (smaller, muted) */}
      <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8 }}>All O/U (Over + Under)</span>
          {all.live > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.6rem", color: "#fcd34d", fontWeight: 600 }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
              {all.live} game{all.live !== 1 ? "s" : ""} live
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: 1, padding: "10px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, lineHeight: 1, color: allSettled === 0 ? "#94a3b8" : all.wins >= all.losses ? winColor : lossColor }}>
              {all.wins}&ndash;{all.losses}
            </div>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>O/U Record</div>
            <div style={{ fontSize: "0.55rem", color: "#a8a29e", marginTop: 2 }}>{allSettled} final (edge &ge; {MIN_EDGE_FOR_RECORD}){all.push > 0 ? ` \u00B7 ${all.push} push` : ""}</div>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, lineHeight: 1, color: all.live === 0 ? "#94a3b8" : liveColor }}>
              {all.winning}&ndash;{all.losing}
            </div>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Hitting</div>
            <div style={{ fontSize: "0.55rem", color: "#a8a29e", marginTop: 2 }}>{all.live} game{all.live !== 1 ? "s" : ""} in progress</div>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, lineHeight: 1, color: allCombined === 0 ? "#94a3b8" : allCombinedWins / allCombined >= 0.5 ? winColor : lossColor }}>
              {allCombined === 0 ? "\u2014" : `${((allCombinedWins / allCombined) * 100).toFixed(0)}%`}
            </div>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Today&apos;s Win Rate</div>
            <div style={{ fontSize: "0.55rem", color: "#a8a29e", marginTop: 2 }}>{allCombined === 0 ? "no games yet" : `${allCombinedWins} of ${allCombined} picks (incl. live)`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export default function BaseballTotalsPage() {
  const { getLiveGame, lastUpdated, liveLoading } = useLiveScores();

  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);
  const today = new Date().toLocaleDateString("en-CA");

  // Today's games
  const todaysAllGames = useMemo(() =>
    allGames.filter(g => g.date?.split("T")[0] === today && g.bbmiTotal != null),
  [allGames, today]);

  const todaysActionable = useMemo(() =>
    todaysAllGames.filter(g => g.vegasTotal != null),
  [todaysAllGames]);

  const todaysAwaiting = useMemo(() =>
    todaysAllGames.filter(g => g.vegasTotal == null && g.actualHomeScore == null),
  [todaysAllGames]);

  // Completed games with results
  const completed = useMemo(() =>
    allGames.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.bbmiTotal != null && g.vegasTotal != null
    ),
  [allGames]);

  // Overall O/U record
  const ouRecordAll = useMemo(() => {
    let wins = 0, losses = 0, pushes = 0;
    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      const bbmiSays = g.bbmiTotal! > g.vegasTotal! ? "over" : g.bbmiTotal! < g.vegasTotal! ? "under" : "push";
      if (bbmiSays === "push") { pushes++; return; }
      if (actual === g.vegasTotal!) { pushes++; return; }
      const actualResult = actual > g.vegasTotal! ? "over" : "under";
      if (bbmiSays === actualResult) wins++; else losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "\u2014";
    return { wins, losses, pushes, total, pct };
  }, [completed]);

  // Under-only record
  const underRecord = useMemo(() => {
    let wins = 0, losses = 0, pushes = 0;
    completed.forEach(g => {
      const bbmiSays = g.bbmiTotal! > g.vegasTotal! ? "over" : g.bbmiTotal! < g.vegasTotal! ? "under" : "push";
      if (bbmiSays !== "under") return;
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      if (actual === g.vegasTotal!) { pushes++; return; }
      const actualResult = actual > g.vegasTotal! ? "over" : "under";
      if (actualResult === "under") wins++; else losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "\u2014";
    const roi = roiAtStandardJuice(wins, losses);
    return { wins, losses, pushes, total, pct, roi };
  }, [completed]);

  // Free/premium under-only split
  const underSplitStats = useMemo(() => {
    const compute = (filter: (g: typeof completed[0]) => boolean) => {
      let wins = 0, losses = 0;
      completed.filter(g => g.bbmiTotal! < g.vegasTotal!).filter(filter).forEach(g => {
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        if (actual === g.vegasTotal!) return;
        if (actual < g.vegasTotal!) wins++; else losses++;
      });
      const total = wins + losses;
      return { wins, losses, total, pct: total > 0 ? ((wins / total) * 100).toFixed(1) : "\u2014" };
    };
    return {
      free: compute(g => Math.abs(g.bbmiTotal! - g.vegasTotal!) < PREMIUM_EDGE_RUNS),
      premium: compute(g => Math.abs(g.bbmiTotal! - g.vegasTotal!) >= PREMIUM_EDGE_RUNS),
    };
  }, [completed]);

  // Edge bucket performance (under picks only)
  const underBucketStats = useMemo(() => {
    const buckets = [
      { name: "0.5\u20131 run", min: 0.5, max: 1 },
      { name: "1\u20132 runs", min: 1, max: 2 },
      { name: "2\u20133 runs", min: 2, max: 3 },
      { name: "\u2265 3 runs", min: 3, max: Infinity },
    ];
    return buckets.map(b => {
      let wins = 0, total = 0;
      completed.forEach(g => {
        if (g.bbmiTotal! >= g.vegasTotal!) return;
        const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
        if (edge < b.min || edge >= b.max) return;
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        if (actual === g.vegasTotal!) return;
        total++;
        if (actual < g.vegasTotal!) wins++;
      });
      return {
        name: b.name, total, wins,
        winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "\u2014",
        roi: total > 0 ? roiAtStandardJuice(wins, total - wins) : "\u2014",
      };
    });
  }, [completed]);

  // Tooltip portal
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const headerProps = { activeDescId: descPortal?.id, openDesc, closeDesc };

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKey) =>
    setSortConfig(prev => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedToday = useMemo(() => {
    const withEdge = todaysActionable.map(g => {
      const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
      const pick = g.bbmiTotal! < g.vegasTotal! ? "under" : g.bbmiTotal! > g.vegasTotal! ? "over" : "push";
      return { ...g, edge, pick };
    });
    return [...withEdge].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      switch (sortConfig.key) {
        case "awayTeam": aVal = a.awayTeam; bVal = b.awayTeam; break;
        case "homeTeam": aVal = a.homeTeam; bVal = b.homeTeam; break;
        case "vegasTotal": aVal = a.vegasTotal; bVal = b.vegasTotal; break;
        case "bbmiTotal": aVal = a.bbmiTotal; bVal = b.bbmiTotal; break;
        case "edge": aVal = a.edge; bVal = b.edge; break;
        case "pick": aVal = a.pick; bVal = b.pick; break;
      }
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [todaysActionable, sortConfig]);

  const hasLiveGames = sortedToday.some(g => {
    const live = getLiveGame(g.awayTeam, g.homeTeam);
    return live?.status === "in";
  });

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

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
              <LogoBadge league="ncaa-baseball" />
              <span style={{ marginLeft: 12 }}>Over/Under Totals</span>
            </h1>
            <p style={{ fontSize: "0.78rem", color: "#78716c", marginTop: 6, textAlign: "center", maxWidth: 560 }}>
              BBMI projected game totals vs Vegas over/under lines for NCAA D1 baseball.
              <br />
              <span style={{ fontSize: "0.68rem", color: "#a8a29e" }}>
                This is an <strong>under-focused</strong> product &mdash; under picks hit at a significantly higher rate than overs.
              </span>
            </p>
          </div>

          {/* HEADLINE STATS CARDS */}
          {underRecord.total > 0 && (
            <>
              <div style={{ maxWidth: 500, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#94a3b8", lineHeight: 1 }}>
                    {underSplitStats.free.total > 0 ? `${underSplitStats.free.pct}%` : "\u2014"}
                  </div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Free Unders</div>
                  <div style={{ fontSize: "0.68rem", color: "#78716c" }}>edge &lt; {PREMIUM_EDGE_RUNS} runs</div>
                </div>
                <div style={{ backgroundColor: "#0a1a2f", border: "2px solid #facc15", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#facc15", lineHeight: 1 }}>
                    {underSplitStats.premium.total > 0 ? `${underSplitStats.premium.pct}%` : "\u2014"}
                  </div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#ffffff", margin: "4px 0 3px" }}>Premium Unders</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)" }}>edge &ge; {PREMIUM_EDGE_RUNS} runs</div>
                </div>
                <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: Number(underRecord.pct) >= 52.4 ? "#16a34a" : "#dc2626", lineHeight: 1 }}>
                    {underRecord.pct}%
                  </div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Overall Unders</div>
                  <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{underRecord.total} picks</div>
                </div>
              </div>
              <div style={{ maxWidth: 500, margin: "0 auto 1.75rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.62rem", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                  Overall O/U (over + under): {ouRecordAll.pct}% ({ouRecordAll.wins}W&ndash;{ouRecordAll.losses}L).
                  Over picks displayed for transparency only. Bet recommendations are under-only.
                </p>
              </div>
            </>
          )}

          {/* UNDER-ONLY EDGE BUCKET TABLE */}
          {underRecord.total > 0 && (
            <div style={{ maxWidth: 520, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Under Picks by Edge Size
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Edge Size", "Games", "W\u2013L", "Win %", "ROI"].map(h => (
                        <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {underBucketStats.map((stat, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.total}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.wins}&ndash;{stat.total - stat.wins}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.winPct !== "\u2014" && Number(stat.winPct) >= 52.4 ? "#16a34a" : stat.winPct !== "\u2014" ? "#dc2626" : "#94a3b8" }}>
                          {stat.winPct === "\u2014" ? "\u2014" : `${stat.winPct}%`}
                        </td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", fontWeight: 700, color: stat.roi !== "\u2014" && stat.roi.startsWith("+") ? "#16a34a" : stat.roi !== "\u2014" ? "#dc2626" : "#94a3b8" }}>
                          {stat.roi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                        ROI at standard &minus;110 juice &middot; Under picks only
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TODAY'S REPORT CARD */}
          <TotalsReportCard games={sortedToday} getLiveGame={getLiveGame} />

          {/* TODAY'S O/U PICKS */}
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s O/U Picks</h2>

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
              {liveLoading ? "Loading live scores\u2026" : hasLiveGames
                ? `Live scores updating \u00B7 ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN \u00B7 Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "\u2014"}`
              }
            </div>
          </div>

          <p style={{ fontSize: "0.68rem", color: "#a8a29e", textAlign: "center", marginBottom: 16 }}>
            BBMI lines are not published until lineups are released. Under picks are the primary product.
          </p>

          {sortedToday.length === 0 ? (
            <p style={{ textAlign: "center", color: "#78716c", fontSize: 14, marginBottom: 32 }}>
              No actionable O/U picks today. Picks appear once both pitchers are confirmed and Vegas totals are posted.
            </p>
          ) : (
            <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 1050 }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none", width: 160, minWidth: 160 }}>
                          Score
                        </th>
                        <SortableHeader label="Away"       columnKey="awayTeam"   tooltipId="awayTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" {...headerProps} />
                        <SortableHeader label="Home"       columnKey="homeTeam"   tooltipId="homeTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" {...headerProps} />
                        <SortableHeader label="Pitchers"   columnKey="awayTeam"   tooltipId="pitchers"   sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                        <SortableHeader label="Vegas O/U"  columnKey="vegasTotal" tooltipId="vegasTotal" sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                        <SortableHeader label="BBMI Total" columnKey="bbmiTotal"  tooltipId="bbmiTotal"  sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                        <SortableHeader label="Actual"     columnKey="edge"       tooltipId="actual"     sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                        <SortableHeader label="Edge"       columnKey="edge"       tooltipId="edge"       sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                        <SortableHeader label="Pick"       columnKey="pick"       tooltipId="pick"       sortConfig={sortConfig} handleSort={handleSort} {...headerProps} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedToday.length === 0 && (
                        <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No actionable totals picks for today.</td></tr>
                      )}
                      {sortedToday.map((g, i) => {
                        const isUnder = g.pick === "under";
                        const isOver = g.pick === "over";
                        const liveGame = getLiveGame(g.awayTeam, g.homeTeam);
                        const rowBg = isUnder
                          ? (i % 2 === 0 ? "rgba(239,246,255,0.5)" : "rgba(239,246,255,0.3)")
                          : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                        const rowOpacity = isOver ? 0.6 : 1;
                        const awayProjected = isProjectedPitcher(g.awayPitcherSource);
                        const homeProjected = isProjectedPitcher(g.homePitcherSource);

                        return (
                          <tr key={g.gameId} style={{ backgroundColor: rowBg, opacity: rowOpacity }}>
                            {/* SCORE BADGE */}
                            <td style={{ ...TD, textAlign: "center", width: 160, minWidth: 160, paddingRight: 12 }}>
                              {!liveGame || liveGame.status === "pre" ? (
                                <div style={{ width: 148, minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                    {liveGame?.startTime
                                      ? new Date(liveGame.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                      : "\u2014"}
                                  </span>
                                </div>
                              ) : (
                                <LiveTotalBadge liveGame={liveGame} vegasTotal={g.vegasTotal} bbmiPick={g.pick} />
                              )}
                            </td>

                            {/* AWAY */}
                            <td style={{ ...TD, paddingLeft: 16 }}>
                              <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                <NCAALogo teamName={g.awayTeam} size={22} />
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.awayTeam}</span>
                              </Link>
                            </td>

                            {/* HOME */}
                            <td style={TD}>
                              <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", textDecoration: "none" }} className="hover:underline">
                                <NCAALogo teamName={g.homeTeam} size={22} />
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.homeTeam}</span>
                              </Link>
                            </td>

                            {/* PITCHERS */}
                            <td style={{ ...TD_CENTER, fontSize: 11, lineHeight: 1.4 }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                <span style={{ color: "#374151" }}>
                                  {g.awayPitcher}{awayProjected && <span style={{ fontSize: 9, color: "#d97706", marginLeft: 3 }} title="Projected from rotation">PROJ</span>}
                                </span>
                                <span style={{ color: "#d1d5db", fontSize: 9 }}>vs</span>
                                <span style={{ color: "#374151" }}>
                                  {g.homePitcher}{homeProjected && <span style={{ fontSize: 9, color: "#d97706", marginLeft: 3 }} title="Projected from rotation">PROJ</span>}
                                </span>
                              </div>
                            </td>

                            {/* VEGAS O/U */}
                            <td style={TD_CENTER}>{g.vegasTotal ?? "\u2014"}</td>

                            {/* BBMI TOTAL */}
                            <td style={{ ...TD_CENTER, fontWeight: 700, fontSize: 15 }}>{(Math.round((g.bbmiTotal ?? 0) * 2) / 2).toFixed(1)}</td>

                            {/* ACTUAL */}
                            {(() => {
                              // Check JSON data first (completed games)
                              if (g.actualHomeScore != null && g.actualAwayScore != null) {
                                const actual = g.actualHomeScore + g.actualAwayScore;
                                const overLine = g.vegasTotal != null && actual > g.vegasTotal;
                                const underLine = g.vegasTotal != null && actual < g.vegasTotal;
                                const totalColor = overLine ? "#dc2626" : underLine ? "#2563eb" : "#374151";
                                return <td style={{ ...TD_CENTER, fontWeight: 800, color: totalColor }}>{actual}</td>;
                              }
                              // Check live scores
                              if (liveGame && liveGame.status !== "pre" && liveGame.awayScore != null && liveGame.homeScore != null) {
                                const currentTotal = liveGame.awayScore + liveGame.homeScore;
                                if (liveGame.status === "post") {
                                  const overLine = g.vegasTotal != null && currentTotal > g.vegasTotal;
                                  const underLine = g.vegasTotal != null && currentTotal < g.vegasTotal;
                                  const totalColor = overLine ? "#dc2626" : underLine ? "#2563eb" : "#374151";
                                  return <td style={{ ...TD_CENTER, fontWeight: 800, color: totalColor }}>{currentTotal}</td>;
                                }
                                return (
                                  <td style={{ ...TD_CENTER, color: "#78716c" }}>
                                    <span style={{ fontWeight: 700 }}>{currentTotal}</span>
                                  </td>
                                );
                              }
                              return <td style={{ ...TD_CENTER, color: "#94a3b8" }}>&mdash;</td>;
                            })()}

                            {/* EDGE */}
                            <td style={{
                              ...TD_CENTER,
                              fontWeight: g.edge >= 2 ? 800 : 600,
                              color: isUnder && g.edge >= 2 ? "#16a34a" : isUnder ? "#374151" : "#9ca3af",
                            }}>
                              {g.edge.toFixed(1)}
                            </td>

                            {/* PICK */}
                            <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>
                              {isUnder ? (
                                <span style={{ color: "#2563eb" }}>{"\u2193"} UNDER</span>
                              ) : isOver ? (
                                <span style={{ color: "#9ca3af", fontWeight: 500, fontSize: 11 }}>
                                  over <span style={{ fontSize: 9, display: "block", color: "#c4b5a0" }}>info only</span>
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>PUSH</span>
                              )}
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

          {/* AWAITING STARTERS SECTION */}
          {todaysAwaiting.length > 0 && (
            <div style={{ maxWidth: 800, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Awaiting Starters / Vegas Lines ({todaysAwaiting.length} game{todaysAwaiting.length !== 1 ? "s" : ""})
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                    <thead>
                      <tr>
                        {["Away", "Home", "Away SP", "Home SP", "BBMI Total", "Status"].map(h => (
                          <th key={h} style={{
                            backgroundColor: "#0a1a2f", color: "#ffffff",
                            padding: "6px 7px", textAlign: h === "Away" || h === "Home" ? "left" : "center",
                            whiteSpace: "nowrap", fontSize: "0.68rem", fontWeight: 700,
                            letterSpacing: "0.06em", textTransform: "uppercase",
                            borderBottom: "2px solid rgba(255,255,255,0.1)",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todaysAwaiting.map((g, i) => {
                        const awayMissing = !hasPitcher(g.awayPitcherSource);
                        const homeMissing = !hasPitcher(g.homePitcherSource);
                        const vegasMissing = g.vegasTotal == null;
                        const reasons: string[] = [];
                        if (awayMissing) reasons.push("Away SP");
                        if (homeMissing) reasons.push("Home SP");
                        if (vegasMissing) reasons.push("Vegas total");

                        return (
                          <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff", opacity: 0.7 }}>
                            <td style={{ ...TD, paddingLeft: 10 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <NCAALogo teamName={g.awayTeam} size={16} />
                                <span style={{ fontSize: 12 }}>{g.awayTeam}</span>
                              </div>
                            </td>
                            <td style={TD}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <NCAALogo teamName={g.homeTeam} size={16} />
                                <span style={{ fontSize: 12 }}>{g.homeTeam}</span>
                              </div>
                            </td>
                            <td style={{ ...TD_CENTER, fontSize: 11, color: awayMissing ? "#d1d5db" : "#374151" }}>
                              {awayMissing ? "TBD" : g.awayPitcher}
                            </td>
                            <td style={{ ...TD_CENTER, fontSize: 11, color: homeMissing ? "#d1d5db" : "#374151" }}>
                              {homeMissing ? "TBD" : g.homePitcher}
                            </td>
                            <td style={{ ...TD_CENTER, fontSize: 12, color: "#57534e" }}>{(Math.round((g.bbmiTotal ?? 0) * 2) / 2).toFixed(1)}</td>
                            <td style={{ ...TD_CENTER, fontSize: 10, color: "#d97706" }}>
                              Needs: {reasons.join(", ")}
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

          {/* COMPLETED GAMES — O/U RESULTS (Prediction History) */}
          {completed.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginTop: 32, marginBottom: 8 }}>
                Prediction History
              </h2>
              <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px", maxWidth: 500 }}>
                All completed O/U predictions &mdash; 2026 live results.
              </p>
              <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
                <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                  <div style={{ overflowX: "auto", maxHeight: 800, overflowY: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 850 }}>
                      <thead>
                        <tr>
                          {([
                            ["Date", "date"], ["Away", "awayTeam"], ["Home", "homeTeam"],
                            ["Vegas O/U", "vegasTotal"], ["BBMI Total", "bbmiTotal"],
                            ["Actual", "actualTotal"], ["Edge", "edge"],
                            ["Pick", "pick"], ["Result", "result"],
                          ] as [string, string][]).map(([label, tid]) => {
                            const text = TOOLTIPS[tid];
                            return (
                              <th key={label} style={{
                                backgroundColor: "#0a1a2f", color: "#ffffff",
                                padding: "8px 10px", textAlign: "center",
                                whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
                                borderBottom: "2px solid rgba(255,255,255,0.1)",
                                fontSize: "0.72rem", fontWeight: 700,
                                letterSpacing: "0.06em", textTransform: "uppercase",
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
                        {[...completed].sort((a, b) => b.date.localeCompare(a.date)).map((g, i) => {
                          const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
                          const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
                          const bbmiCall = g.bbmiTotal! > g.vegasTotal! ? "OVER" : g.bbmiTotal! < g.vegasTotal! ? "UNDER" : "PUSH";
                          const actualOU = actual > g.vegasTotal! ? "OVER" : actual < g.vegasTotal! ? "UNDER" : "PUSH";
                          const correct = bbmiCall === "PUSH" || actualOU === "PUSH" ? null : bbmiCall === actualOU;
                          const pickColor = bbmiCall === "UNDER" ? "#2563eb" : bbmiCall === "OVER" ? "#dc2626" : "#94a3b8";
                          const actualColor = actualOU === "OVER" ? "#dc2626" : actualOU === "UNDER" ? "#2563eb" : "#374151";
                          const resultColor = correct === true ? "#16a34a" : correct === false ? "#dc2626" : "#94a3b8";

                          return (
                            <tr key={g.gameId + i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", whiteSpace: "nowrap", color: "#57534e" }}>{g.date}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, fontWeight: 500 }}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}>
                                  <NCAALogo teamName={g.awayTeam} size={16} />
                                  <span>{g.awayTeam}</span>
                                </Link>
                              </td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, fontWeight: 500 }}>
                                <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}>
                                  <NCAALogo teamName={g.homeTeam} size={16} />
                                  <span>{g.homeTeam}</span>
                                </Link>
                              </td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontFamily: "ui-monospace, monospace" }}>{g.vegasTotal}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontFamily: "ui-monospace, monospace" }}>{(Math.round((g.bbmiTotal ?? 0) * 2) / 2).toFixed(1)}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 700, color: actualColor }}>{actual}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{edge.toFixed(1)}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontWeight: 700, color: pickColor, textTransform: "uppercase" }}>{bbmiCall}</td>
                              <td style={{ padding: "6px 10px", borderTop: "1px solid #f5f5f4", fontSize: 12, textAlign: "center", fontWeight: 700, color: resultColor }}>
                                {correct === true ? "\u2713" : correct === false ? "\u2717" : "P"}
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

          {/* FOOTER */}
          <div style={{ maxWidth: 600, margin: "0 auto 2rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", lineHeight: 1.6, marginBottom: 8 }}>
              Totals predictions are derived from the BBMI model&apos;s pitcher-adjusted team scoring projections.
              Under picks are the primary product &mdash; over picks are shown for informational purposes only.
              Lines are not published until confirmed or rotation-inferred starting pitchers are available.
            </p>
            <Link href="/baseball/accuracy" style={{ fontSize: "0.72rem", color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
              View full model accuracy history &rarr;
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
