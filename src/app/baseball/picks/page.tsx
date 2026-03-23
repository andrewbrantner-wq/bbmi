"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import Link from "next/link";
import games from "@/data/betting-lines/baseball-games.json";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import { AuthProvider, useAuth } from "../../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase-config";

// ── CONFIG ───────────────────────────────────────────────────────
const FREE_EDGE_LIMIT = 3;       // runs — premium threshold (lower than basketball's 6 pts)
const MIN_EDGE_FOR_RECORD = 1.0; // runs — walk-forward shows 1.0-1.5 edge is the best bucket (54.3%)
const MAX_EDGE_FOR_RECORD = 5.0; // runs — 5.0+ edges reverse (42.9% ATS) — model error, not market error

// ── TYPES ────────────────────────────────────────────────────────

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
};

type SortKey = "edge" | "date" | "away" | "home" | "vegasLine" | "bbmiLine" | "bbmiPick" | "homeWinPct" | "vegasWinProb";

// ── HELPERS ──────────────────────────────────────────────────────

function wilsonCI(wins: number, n: number) {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, ((c - m) / d) * 100), high: Math.min(100, ((c + m) / d) * 100) };
}

function mlToProb(ml: number | null): number | null {
  if (ml == null) return null;
  // Detect decimal odds (between 1.01 and 99)
  if (ml > 1 && ml < 100) {
    return 1 / ml; // decimal → implied prob
  }
  if (ml < 0) return Math.abs(ml) / (Math.abs(ml) + 100);
  if (ml > 0) return 100 / (ml + 100);
  return 0.5;
}

function seriesLabel(pos: number): string {
  if (pos === 1) return "G1";
  if (pos === 2) return "G2";
  if (pos === 3) return "G3";
  return "MW";  // midweek
}

// ── ESPN LIVE SCORES ─────────────────────────────────────────────

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
  startTime: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
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
  // Multi-word mascots
  if (words.length > 2) {
    const withoutTwo = words.slice(0, -2).join(" ");
    if (NO_STRIP.has(withoutTwo)) return withoutTwo;
    // If the result is non-empty and reasonable, try it
    if (withoutTwo.length > 2) {
      // Check common multi-word mascots
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
  // Also fetch the next UTC day to catch late-night CT games ESPN lists on tomorrow's page
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
        if (status === "in") {
          const inning = st?.period ?? 1;
          const half = st?.type?.id === "22" ? "Mid" : "End";
          statusDisplay = sid === "23" ? `${half} ${inning}` : `${st?.displayClock ?? ""} Inn ${inning}`.trim();
        }

        const lg: LiveGame = {
          awayScore: awayC.score != null ? parseInt(awayC.score, 10) : null,
          homeScore: homeC.score != null ? parseInt(homeC.score, 10) : null,
          status, statusDisplay,
          espnAwayAbbrev: awayC.team?.abbreviation ?? "",
          espnHomeAbbrev: homeC.team?.abbreviation ?? "",
          startTime: event.date ?? null,
        };

        // Key by multiple name forms for matching
        const aN = stripMascot(awayC.team?.displayName ?? "");
        const hN = stripMascot(homeC.team?.displayName ?? "");
        if (!map.has(`${aN}|${hN}`)) {
          map.set(`${aN}|${hN}`, lg);
          // Single-team fallback keys for when pipeline names don't match ESPN exactly.
          // If a team appears in multiple games, delete the key to prevent cross-matches.
          for (const fk of [`away:${aN}`, `home:${hN}`]) {
            if (map.has(fk)) {
              map.delete(fk); // ambiguous — two games with same team fragment
            } else {
              map.set(fk, lg);
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
  const [loading, setLoading] = useState(true);
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [load]);

  const getLive = useCallback((away: string, home: string): LiveGame | undefined => {
    const a = stripMascot(away), h = stripMascot(home);
    return liveScores.get(`${a}|${h}`) ?? liveScores.get(`away:${a}`) ?? liveScores.get(`home:${h}`);
  }, [liveScores]);

  return { getLive, lastUpdated, loading };
}

// ── LIVE SCORE BADGE ─────────────────────────────────────────────

function LiveScoreBadge({ lg, away, home, bbmiPick, vegasLine }: {
  lg: LiveGame | undefined; away: string; home: string; bbmiPick?: string; vegasLine?: number | null;
}) {
  if (!lg || lg.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = lg;
  const hasScores = awayScore != null && homeScore != null;
  const isLive = status === "in";

  const pickIsHome = bbmiPick ? stripMascot(bbmiPick) === stripMascot(home) : false;
  let bbmiLeading: boolean | null = null;
  if (hasScores && bbmiPick && vegasLine != null) {
    const margin = homeScore! - awayScore!;
    const homeCovers = margin > -vegasLine;
    if (margin === -vegasLine) bbmiLeading = null;
    else bbmiLeading = pickIsHome ? homeCovers : !homeCovers;
  }

  const bgColor = bbmiLeading === true ? "#f0fdf4" : bbmiLeading === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiLeading === true ? "#86efac" : bbmiLeading === false ? "#fca5a5" : "#e2e8f0";
  const dotColor = bbmiLeading === true ? "#16a34a" : bbmiLeading === false ? "#dc2626" : "#94a3b8";
  const statusColor = bbmiLeading === true ? "#15803d" : bbmiLeading === false ? "#b91c1c" : "#64748b";
  const isPost = status === "post";
  const bbmiWon = isPost && bbmiLeading === true;
  const bbmiLost = isPost && bbmiLeading === false;

  return (
    <div style={{ borderRadius: 6, padding: "4px 8px", display: "flex", flexDirection: "column", gap: 2, backgroundColor: bgColor, border: `1px solid ${borderColor}`, width: 160, minHeight: 42 }}>
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
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiWon ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiWon ? "✓ WIN" : "✗ LOSS"}
        </div>
      )}
    </div>
  );
}

// ── REPORT CARD ──────────────────────────────────────────────────

function TodaysReportCard({ allGames, getLive }: {
  allGames: BaseballGame[]; getLive: (a: string, h: string) => LiveGame | undefined;
}) {
  const results = allGames.reduce((acc, g) => {
    const lg = getLive(g.awayTeam, g.homeTeam);
    if (!lg || lg.status === "pre") return acc;
    const { awayScore, homeScore, status } = lg;
    if (awayScore == null || homeScore == null) return acc;
    const vegas = g.vegasLine;
    const bbmi = g.bbmiLine;
    if (vegas == null || bbmi == null) return acc;
    if (bbmi === vegas) return acc;
    if (Math.abs(bbmi - vegas) < MIN_EDGE_FOR_RECORD) return acc;
    const pickIsHome = bbmi < vegas;
    const margin = homeScore - awayScore;
    const homeCovers = margin > -vegas;
    const push = margin === -vegas;
    const correct = push ? null : pickIsHome ? homeCovers : !homeCovers;
    if (push) { acc.push++; return acc; }
    if (status === "in") { if (correct) acc.winning++; else acc.losing++; acc.live++; return acc; }
    if (status === "post") { if (correct) acc.wins++; else acc.losses++; acc.final++; return acc; }
    return acc;
  }, { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 });

  const settled = results.wins + results.losses;
  const combined = settled + results.winning + results.losing;
  const combinedWins = results.wins + results.winning;
  if (settled + results.live === 0 && results.push === 0) return null;

  const W = "#16a34a", L = "#dc2626";
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#0a1628", color: "#ffffff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>⚾ Today&apos;s Report Card</span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: settled === 0 ? "#94a3b8" : results.wins >= results.losses ? W : L }}>
            {results.wins}–{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>ATS Record</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{settled} final (edge ≥ {MIN_EDGE_FOR_RECORD}){results.push > 0 ? ` · ${results.push} push` : ""}</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : results.winning >= results.losing ? W : L }}>
            {results.winning}–{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Covering</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{results.live} live</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: combined === 0 ? "#94a3b8" : combinedWins / combined >= 0.5 ? W : L }}>
            {combined === 0 ? "—" : `${((combinedWins / combined) * 100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Today&apos;s Win Rate</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{combined === 0 ? "no games yet" : `${combinedWins} of ${combined} (incl. live)`}</div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────

function BaseballPicksContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const { getLive, lastUpdated, loading: liveLoading } = useLiveScores();

  useEffect(() => {
    async function check() {
      if (!user) { setIsPremium(false); return; }
      try {
        const d = await getDoc(doc(db, "users", user.uid));
        setIsPremium(d.exists() && d.data()?.premium === true);
      } catch { setIsPremium(false); }
    }
    check();
  }, [user]);

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

  // Edge performance by bucket (runs)
  const edgePerformance = useMemo(() => {
    const cats = [
      { name: "1.5–2", min: 1.5, max: 2 },
      { name: "2–3", min: 2, max: 3 },
      { name: "3–4", min: 3, max: 4 },
      { name: "≥ 4", min: 4, max: Infinity },
    ];
    return cats.map(cat => {
      const g = historicalGames.filter(g => {
        if (g.vegasLine == null || g.bbmiLine == null) return false;
        const edge = Math.abs(g.bbmiLine - g.vegasLine);
        return edge >= cat.min && edge < cat.max;
      });
      const wins = g.filter(g => {
        const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const pickIsHome = g.bbmiLine! < g.vegasLine!;
        const homeCovers = margin > -g.vegasLine!;
        return pickIsHome ? homeCovers : !homeCovers;
      }).length;
      const { low, high } = wilsonCI(wins, g.length);
      return { name: cat.name, games: g.length, wins, winPct: g.length > 0 ? ((wins / g.length) * 100).toFixed(1) : "0.0", ciLow: low, ciHigh: high };
    });
  }, [historicalGames]);

  const overallStats = useMemo(() => {
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
    return { total: qualified.length, winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "—" };
  }, [historicalGames]);

  // Model maturity (from pipeline output)
  const modelMaturity = useMemo(() => {
    const first = todaysGames.find(g => g.modelMaturity);
    return first?.modelMaturity ?? "early_season";
  }, [todaysGames]);

  // Line movement stats
  const lineMovementStats = useMemo(() => {
    const withMovement = todaysGames.filter(g => g.lineMovement != null && g.lineMovement !== 0);
    const reverseMovement = withMovement.filter(g => {
      // Reverse line movement: BBMI and line moving in opposite directions
      if (g.edge == null || g.lineMovement == null) return false;
      // If BBMI favors home (negative edge) but line moved toward away (positive movement), that's reverse
      return (g.edge < 0 && g.lineMovement > 0) || (g.edge > 0 && g.lineMovement < 0);
    });
    return { total: withMovement.length, reverse: reverseMovement.length };
  }, [todaysGames]);

  // Edge filter
  const edgeOptions = [
    { label: "All Games", min: 0, max: Infinity },
    { label: "1.5–2 runs", min: 1.5, max: 2 },
    { label: "2–3 runs", min: 2, max: 3 },
    { label: "3–4 runs", min: 3, max: 4 },
    { label: "≥ 4 runs", min: 4, max: Infinity },
  ];
  const [edgeOption, setEdgeOption] = useState(edgeOptions[0]);

  const gamesWithVegas = useMemo(() =>
    todaysGames.filter(g => g.vegasLine != null && g.bbmiLine != null),
  [todaysGames]);

  const gamesNoVegas = useMemo(() =>
    todaysGames.filter(g => g.vegasLine == null || g.bbmiLine == null),
  [todaysGames]);

  const [noVegasOpen, setNoVegasOpen] = useState(false);

  const filteredGames = useMemo(() => {
    let g = gamesWithVegas;
    if (edgeOption.label !== "All Games") {
      g = g.filter(game => {
        const edge = Math.abs(game.bbmiLine! - game.vegasLine!);
        return edge >= edgeOption.min && edge < edgeOption.max;
      });
    }
    return g;
  }, [gamesWithVegas, edgeOption]);

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "edge", dir: "desc" });
  const handleSort = (key: SortKey) => setSortConfig(prev => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));

  const sorted = useMemo(() => {
    const withEdge = filteredGames.map(g => ({
      ...g,
      _edge: (g.vegasLine != null && g.bbmiLine != null) ? Math.abs(g.bbmiLine - g.vegasLine) : 0,
      _pick: (g.vegasLine != null && g.bbmiLine != null)
        ? (g.bbmiLine < g.vegasLine ? g.homeTeam : g.bbmiLine > g.vegasLine ? g.awayTeam : "")
        : "",
    }));
    return [...withEdge].sort((a, b) => {
      const { key, dir } = sortConfig;
      let av: number | string = 0, bv: number | string = 0;
      if (key === "edge") { av = a._edge; bv = b._edge; }
      else if (key === "away") { av = a.awayTeam; bv = b.awayTeam; }
      else if (key === "home") { av = a.homeTeam; bv = b.homeTeam; }
      else if (key === "vegasLine") { av = a.vegasLine ?? 0; bv = b.vegasLine ?? 0; }
      else if (key === "bbmiLine") { av = a.bbmiLine ?? 0; bv = b.bbmiLine ?? 0; }
      else if (key === "homeWinPct") { av = a.homeWinPct ?? 0; bv = b.homeWinPct ?? 0; }
      else if (key === "vegasWinProb") { av = a.vegasWinProb ?? 0; bv = b.vegasWinProb ?? 0; }
      else if (key === "bbmiPick") { av = a._pick; bv = b._pick; }
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filteredGames, sortConfig]);

  const hasLiveGames = sorted.some(g => getLive(g.awayTeam, g.homeTeam)?.status === "in");

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_R: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  const SortTH = ({ label, k, align = "center" }: { label: string; k: SortKey; align?: string }) => {
    const active = sortConfig.key === k;
    return (
      <th onClick={() => handleSort(k)} style={{
        backgroundColor: "#1e3a5f", color: "#ffffff", padding: "6px 7px",
        textAlign: align as "left" | "center" | "right", whiteSpace: "nowrap",
        fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
        borderBottom: "2px solid rgba(255,255,255,0.1)", cursor: "pointer", userSelect: "none",
      }}>
        {label} {active ? (sortConfig.dir === "asc" ? "▲" : "▼") : ""}
      </th>
    );
  };

  return (
    <>
      <style>{`
        @keyframes livepulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa-baseball" />
              <span style={{ marginLeft: 12 }}>Today&apos;s Game Lines</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              NCAA D1 Baseball · Powered by Poisson model with SOS adjustment
            </p>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 600, margin: "0 auto 0.5rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { value: overallStats.total > 0 ? `${overallStats.winPct}%` : "—", label: "Beat Vegas†", sub: `edge ≥ ${MIN_EDGE_FOR_RECORD} runs`, color: Number(overallStats.winPct) >= 50 ? "#16a34a" : overallStats.total > 0 ? "#dc2626" : "#94a3b8" },
              { value: "NEW", label: "Model Status", sub: "Calibrating — tracking results", color: "#f59e0b" },
              { value: overallStats.total > 0 ? overallStats.total.toLocaleString() : "0", label: "Games Tracked", sub: `edge ≥ ${MIN_EDGE_FOR_RECORD} runs`, color: "#0a1a2f" },
            ].map(card => (
              <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* METHODOLOGY NOTE */}
          <div style={{ maxWidth: 600, margin: "0 auto 1.75rem" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
              † Record includes only games where BBMI and Vegas run lines differ by ≥ {MIN_EDGE_FOR_RECORD} runs.
              Model is in calibration phase — bet recommendations will be enabled after 300+ tracked games with locked parameters.
            </p>
          </div>

          {/* EDGE PERFORMANCE TABLE */}
          {historicalGames.length > 10 && (
            <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#0a1628", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Performance by Edge Size (Runs)
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Edge", "Games", "Win %", "95% CI"].map(h => (
                        <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {edgePerformance.map((s, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{s.name}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{s.games}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: Number(s.winPct) > 50 ? "#16a34a" : "#dc2626" }}>{s.winPct}%</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 11, textAlign: "center", color: "#78716c", fontStyle: "italic" }}>{s.ciLow.toFixed(1)}%–{s.ciHigh.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORT CARD */}
          <TodaysReportCard allGames={todaysGames} getLive={getLive} />

          {/* GAMES HEADER */}
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s Games</h2>
          {todaysGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              Today&apos;s picks are published by 10am CT once the daily pipeline runs.
            </p>
          )}

          {/* EDGE FILTER */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Edge</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {edgeOptions.map(o => {
                const active = edgeOption.label === o.label;
                return (
                  <button key={o.label} onClick={() => setEdgeOption(o)} style={{
                    height: 38, padding: "0 16px", borderRadius: 999,
                    border: active ? "2px solid #0a1628" : "2px solid #d6d3d1",
                    backgroundColor: active ? "#0a1628" : "#ffffff",
                    color: active ? "#ffffff" : "#44403c",
                    fontSize: "0.85rem", fontWeight: active ? 700 : 500, cursor: "pointer",
                    boxShadow: active ? "0 2px 8px rgba(10,22,40,0.18)" : "0 1px 3px rgba(0,0,0,0.07)",
                  }}>{o.label}</button>
                );
              })}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#44403c", margin: 0 }}>
              Showing <strong>{sorted.length}</strong> of <strong>{todaysGames.length}</strong> games
            </p>
          </div>

          {/* LIVE SCORES STATUS */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: hasLiveGames ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasLiveGames ? "#86efac" : "#e2e8f0"}`, borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem", color: hasLiveGames ? "#15803d" : "#64748b", fontWeight: 600 }}>
              {liveLoading ? (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              ) : hasLiveGames ? (
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              )}
              {liveLoading ? "Loading scores…" : hasLiveGames
                ? `Live scores updating · ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN · ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—"}`}
            </div>
          </div>

          {/* MODEL STATUS BAR */}
          <div style={{ maxWidth: 1200, margin: "0 auto 10px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {/* Maturity badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 12px",
              backgroundColor: modelMaturity === "mature" ? "#f0fdf4" : modelMaturity === "calibrated" ? "#eff6ff" : modelMaturity === "calibrating" ? "#fefce8" : "#fef2f2",
              color: modelMaturity === "mature" ? "#15803d" : modelMaturity === "calibrated" ? "#1d4ed8" : modelMaturity === "calibrating" ? "#a16207" : "#b91c1c",
              border: `1px solid ${modelMaturity === "mature" ? "#86efac" : modelMaturity === "calibrated" ? "#93c5fd" : modelMaturity === "calibrating" ? "#fde68a" : "#fca5a5"}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "currentColor" }} />
              Model: {modelMaturity === "early_season" ? "Early Season" : modelMaturity === "calibrating" ? "Calibrating" : modelMaturity === "calibrated" ? "Calibrated" : "Mature"}
            </span>
            {/* Line movement count */}
            {lineMovementStats.total > 0 && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "3px 12px",
                backgroundColor: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0",
              }}>
                {lineMovementStats.total} line move{lineMovementStats.total !== 1 ? "s" : ""}
                {lineMovementStats.reverse > 0 && (
                  <span style={{ color: "#dc2626", fontWeight: 700 }}> ({lineMovementStats.reverse} reverse)</span>
                )}
              </span>
            )}
          </div>

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1200, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 950 }}>
                  <thead>
                    <tr>
                      <SortTH label="Score" k="date" />
                      <SortTH label="Away" k="away" align="left" />
                      <SortTH label="Home" k="home" align="left" />
                      <th style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "6px 7px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Pitchers</th>
                      <SortTH label="Vegas" k="vegasLine" />
                      <th style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "6px 7px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>Move</th>
                      <SortTH label="BBMI" k="bbmiLine" />
                      <SortTH label="Edge" k="edge" />
                      <SortTH label="BBMI Pick" k="bbmiPick" align="left" />
                      <SortTH label="BBMI Win%" k="homeWinPct" />
                      <SortTH label="Vegas Win%" k="vegasWinProb" />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr><td colSpan={11} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected filter.</td></tr>
                    )}
                    {sorted.map((g, i) => {
                      const lg = getLive(g.awayTeam, g.homeTeam);
                      const edge = g._edge;
                      const pick = g._pick;
                      const hasVegas = g.vegasLine != null;
                      const belowMin = hasVegas && edge < MIN_EDGE_FOR_RECORD;
                      const rowBg = belowMin ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)") : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const seriesTag = g.seriesGame > 0 ? seriesLabel(g.seriesGame) : "";

                      return (
                        <tr key={g.gameId} style={{ backgroundColor: rowBg, opacity: belowMin ? 0.55 : 1, color: belowMin ? "#9ca3af" : undefined }}>
                          {/* Score / Time */}
                          <td style={{ ...TD, textAlign: "center", width: 160, minWidth: 160, paddingRight: 12 }}>
                            {!lg || lg.status === "pre" ? (
                              <div style={{ width: 148, minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {lg?.startTime
                                    ? new Date(lg.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                    : g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) : g.date}
                                </span>
                              </div>
                            ) : (
                              <LiveScoreBadge lg={lg} away={g.awayTeam} home={g.homeTeam} bbmiPick={pick || undefined} vegasLine={g.vegasLine} />
                            )}
                          </td>
                          {/* Away */}
                          <td style={{ ...TD, paddingLeft: 16 }}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.awayTeam} size={22} />
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 500, color: "#0a1a2f" }}>{g.awayTeam}</span>
                                {seriesTag && <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 6, fontWeight: 700 }}>{seriesTag}</span>}
                              </div>
                            </Link>
                          </td>
                          {/* Home */}
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}>
                              <NCAALogo teamName={g.homeTeam} size={22} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#0a1a2f" }}>{g.homeTeam}</span>
                            </Link>
                          </td>
                          {/* Pitchers */}
                          <td style={{ ...TD, textAlign: "center", fontSize: 10.5, lineHeight: 1.4 }}>
                            <div style={{ color: g.awayPitcher === "TBD" ? "#d1d5db" : "#374151" }}>{g.awayPitcher}</div>
                            <div style={{ color: "#d1d5db", fontSize: 9 }}>vs</div>
                            <div style={{ color: g.homePitcher === "TBD" ? "#d1d5db" : "#374151" }}>{g.homePitcher}</div>
                            {!g.pitcherConfirmed && <div style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, marginTop: 1 }}>⚠ TBD</div>}
                          </td>
                          {/* Vegas Line */}
                          <td style={TD_R}>{g.vegasLine ?? "—"}</td>
                          {/* Line Movement */}
                          <td style={{ ...TD_R, fontSize: 11 }}>
                            {g.lineMovement != null ? (
                              <span style={{
                                color: g.lineMovement === 0 ? "#94a3b8"
                                  : Math.abs(g.lineMovement) >= 1.0 ? "#dc2626" : "#78716c",
                                fontWeight: Math.abs(g.lineMovement ?? 0) >= 1.0 ? 700 : 400,
                              }}>
                                {g.lineMovement > 0 ? "+" : ""}{g.lineMovement.toFixed(1)}
                              </span>
                            ) : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          {/* BBMI Line */}
                          <td style={TD_R}>{g.bbmiLine ?? "—"}</td>
                          {/* Edge */}
                          <td style={{ ...TD_R, color: g.vegasLine == null ? "#d1d5db" : belowMin ? "#9ca3af" : edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                            {g.vegasLine == null ? "—" : (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                {`${belowMin ? "~" : ""}${edge.toFixed(1)}`}
                                {g.confidenceFlag === "high" && !belowMin && (
                                  <span style={{ fontSize: 8, backgroundColor: "#16a34a", color: "#fff", borderRadius: 3, padding: "0 3px", fontWeight: 700, lineHeight: "14px" }}>H</span>
                                )}
                              </span>
                            )}
                          </td>
                          {/* BBMI Pick */}
                          <td style={TD}>
                            {pick && g.vegasLine != null && (
                              <Link href={`/baseball/team/${encodeURIComponent(pick)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                                <NCAALogo teamName={pick} size={18} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#0a1a2f" }}>{pick}</span>
                              </Link>
                            )}
                          </td>
                          {/* BBMI Win% */}
                          <td style={TD_R}>{g.homeWinPct != null ? `${(g.homeWinPct * 100).toFixed(0)}%` : "—"}</td>
                          {/* Vegas Win% */}
                          <td style={TD_R}>{(() => {
                            const vp = g.vegasWinProb ?? mlToProb(g.homeML);
                            return vp != null ? `${(vp * 100).toFixed(0)}%` : "—";
                          })()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* NO VEGAS LINE ROLLUP */}
          {gamesNoVegas.length > 0 && (
            <div style={{ marginTop: 16 }}>
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
                <span style={{ fontSize: 11 }}>{noVegasOpen ? "▼" : "▶"}</span>
                Games Without Vegas Lines ({gamesNoVegas.length})
              </button>
              {noVegasOpen && (
                <div style={{ border: "1px solid #e2e0de", borderTop: "none", borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: "#64748b", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Time</th>
                        <th style={{ backgroundColor: "#64748b", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Away</th>
                        <th style={{ backgroundColor: "#64748b", color: "#ffffff", padding: "6px 10px", textAlign: "left", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Home</th>
                        <th style={{ backgroundColor: "#64748b", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI Line</th>
                        <th style={{ backgroundColor: "#64748b", color: "#ffffff", padding: "6px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI Win%</th>
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
                              <Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f", textDecoration: "none" }}>
                                <NCAALogo teamName={g.awayTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.awayTeam}</span>
                              </Link>
                            </td>
                            <td style={TD}>
                              <Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f", textDecoration: "none" }}>
                                <NCAALogo teamName={g.homeTeam} size={18} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{g.homeTeam}</span>
                              </Link>
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 600 }}>
                              {g.bbmiLine != null ? (g.bbmiLine > 0 ? `+${g.bbmiLine.toFixed(1)}` : g.bbmiLine.toFixed(1)) : "—"}
                            </td>
                            <td style={{ ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
                              {g.homeWinPct != null ? `${(Math.max(g.homeWinPct, 1 - g.homeWinPct) * 100).toFixed(0)}%` : "—"}
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

        </div>
      </div>
    </>
  );
}

export default function BaseballPicksPage() {
  return (
    <AuthProvider>
      <BaseballPicksContent />
    </AuthProvider>
  );
}
