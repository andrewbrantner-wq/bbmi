"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import games from "@/data/betting-lines/baseball-games.json";

type Game = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeML: number | null;
  awayML: number | null;
  plattHomeProb: number | null;
  plattAwayProb: number | null;
  plattMLHome: number | null;
  plattMLAway: number | null;
  mlPick: string | null;
  mlEdge: number | null;
  mlPickProb: number | null;
  mlPickOdds: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  homeWinPct: number | null;
  vegasWinProb: number | null;
};

const allGames = (games as Game[]);
const DAILY_UNITS = 100;
const MAX_SINGLE = 15;
const MAX_PICKS_PER_DAY = 10;

function shortName(team: string): string {
  const parts = team.split(" ");
  if (parts.length <= 2) return team;
  const mascots = new Set(["Bulldogs","Tigers","Bears","Eagles","Hawks","Wildcats","Panthers",
    "Cavaliers","Cardinals","Cougars","Huskies","Knights","Mustangs","Owls","Rams","Rebels",
    "Seminoles","Sooners","Terrapins","Volunteers","Wolverines","Aggies","Commodores",
    "Crimson","Demon","Deacons","Devil","Ducks","Gators","Golden","Hawkeyes","Hoosiers",
    "Horned","Frogs","Jayhawks","Longhorns","Mountaineers","Nittany","Lions","Razorbacks",
    "Scarlet","Tar","Heels","Trojans","Utes","Boilermakers","Buckeyes","Cornhuskers",
    "Cowboys","Cyclones","Hokies","Hurricanes","Irish","Musketeers","Shockers","Tribe",
    "Trailblazers","Patriots","Anteaters","Matadors","Gaels","Dons","Toreros","Wave",
    "Tide","Flames","Beavers","Bruins","Sun","Devils"]);
  let end = parts.length;
  while (end > 2 && mascots.has(parts[end - 1])) end--;
  return parts.slice(0, end).join(" ");
}

function oddsToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

type Allocation = {
  game: Game;
  pickTeam: string;
  oppTeam: string;
  odds: number;
  edge: number;
  prob: number;
  units: number;
  toWin: number;
  expReturn: number;
  status: "pending" | "completed";
  won?: boolean;
  pnl?: number;
};

function computeAllocation(picks: Game[]): Allocation[] {
  if (picks.length === 0) return [];

  // Sort by edge descending — top N get units, rest tracked at 0u
  const sorted = [...picks].sort((a, b) => (b.mlEdge ?? 0) - (a.mlEdge ?? 0));
  const allocated = new Set(sorted.slice(0, MAX_PICKS_PER_DAY).map(g => g.gameId));

  const totalEdge = sorted.filter(g => allocated.has(g.gameId)).reduce((s, g) => s + (g.mlEdge ?? 0), 0);

  const rawAlloc = sorted.map(g => {
    const odds = g.mlPickOdds ?? 0;
    const edge = g.mlEdge ?? 0;
    const prob = g.mlPickProb ?? 0;
    const pickTeam = g.mlPick === "HOME" ? g.homeTeam : g.awayTeam;
    const oppTeam = g.mlPick === "HOME" ? g.awayTeam : g.homeTeam;

    const isAllocated = allocated.has(g.gameId);
    let units = isAllocated && totalEdge > 0 ? Math.round((edge / totalEdge) * DAILY_UNITS) : 0;
    if (isAllocated) {
      units = Math.min(units, MAX_SINGLE);
      units = Math.max(units, 1);
    }

    // Determine game status
    const hasScore = g.actualHomeScore != null && g.actualAwayScore != null;
    const status: "pending" | "completed" = hasScore ? "completed" : "pending";
    let won: boolean | undefined;
    let pnl: number | undefined;

    if (hasScore) {
      const homeWon = (g.actualHomeScore ?? 0) > (g.actualAwayScore ?? 0);
      won = (g.mlPick === "HOME" && homeWon) || (g.mlPick === "AWAY" && !homeWon);
    }

    return { game: g, pickTeam, oppTeam, odds, edge, prob, units, status, won };
  });

  // Normalize allocated picks so total is exactly DAILY_UNITS
  const allocatedPicks = rawAlloc.filter(p => p.units > 0);
  const rawTotal = allocatedPicks.reduce((s, p) => s + p.units, 0);
  if (rawTotal !== DAILY_UNITS && rawTotal > 0) {
    let diff = DAILY_UNITS - rawTotal;
    const sortedAlloc = [...allocatedPicks].sort((a, b) => b.edge - a.edge);
    let i = 0;
    while (diff !== 0) {
      const adj = diff > 0 ? 1 : -1;
      if (sortedAlloc[i % sortedAlloc.length].units + adj >= 1 && sortedAlloc[i % sortedAlloc.length].units + adj <= MAX_SINGLE) {
        sortedAlloc[i % sortedAlloc.length].units += adj;
        diff -= adj;
      }
      i++;
      if (i > sortedAlloc.length * 3) break;
    }
  }

  return rawAlloc.map(p => {
    const decimal = oddsToDecimal(p.odds);
    const toWin = p.units * (decimal - 1);
    const expReturn = (p.prob * toWin) - ((1 - p.prob) * p.units);
    let pnl: number | undefined;
    if (p.status === "completed") {
      pnl = p.won ? toWin : -p.units;
    }
    return {
      ...p,
      toWin: Math.round(toWin * 10) / 10,
      expReturn: Math.round(expReturn * 10) / 10,
      pnl: pnl !== undefined ? Math.round(pnl * 10) / 10 : undefined,
    };
  }).sort((a, b) => b.edge - a.edge);
}

// First day of live (point-in-time) tracking. Days before this are reconstructed.
// ML tracking paused until homeWinPct std dev crosses 0.09 (team ratings stabilized).
// Set this to the first date after the threshold is met.
const LIVE_TRACKING_START = "2026-04-15";
const ML_PAUSED = false;

// ── Live scoring ─────────────────────────────────────────────
type GameStatus = "pre" | "in" | "post";
interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
  inning: number | null;
  inningHalf: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function stripMascotML(name: string): string {
  const words = norm(name).split(" ");
  if (words.length <= 1) return words.join(" ");
  const NO_STRIP = new Set([
    "iowa state","michigan state","ohio state","florida state","kansas state",
    "penn state","utah state","fresno state","san jose state","boise state",
    "colorado state","kent state","ball state","north carolina state",
    "mississippi state","washington state","oregon state","arizona state",
    "oklahoma state","texas state","arkansas state","mcneese state",
    "texas tech","georgia tech","virginia tech","louisiana tech",
    "boston college","air force","wake forest","sam houston state",
    "central michigan","eastern michigan","western michigan",
    "northern illinois","southern illinois","middle tennessee",
    "east carolina","south carolina","north carolina","west virginia",
    "south florida","south alabama","north alabama",
  ]);
  const n = norm(name);
  if (NO_STRIP.has(n)) return n;
  const withoutLast = words.slice(0, -1).join(" ");
  if (NO_STRIP.has(withoutLast)) return withoutLast;
  return words.length > 1 ? withoutLast : n;
}

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const map = new Map<string, LiveGame>();
  const ctNow = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const dates = [ctNow.replace(/-/g, "")];
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const utcT = tomorrow.toISOString().slice(0, 10).replace(/-/g, "");
  if (utcT !== dates[0]) dates.push(utcT);

  for (const dateStr of dates) {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard?dates=${dateStr}&limit=200`, { cache: "no-store" });
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
          const half = sid === "22" ? "Mid" : sid === "23" ? "End" : "Top";
          inningHalf = half;
          statusDisplay = sid === "23" ? `${half} ${inning}` : `${st?.displayClock ?? ""} Inn ${inning}`.trim();
        }
        const lg: LiveGame = {
          awayScore: awayC.score != null ? parseInt(awayC.score, 10) : null,
          homeScore: homeC.score != null ? parseInt(homeC.score, 10) : null,
          status, statusDisplay,
          espnAwayAbbrev: awayC.team?.abbreviation ?? "",
          espnHomeAbbrev: homeC.team?.abbreviation ?? "",
          inning: inning != null ? Number(inning) : null, inningHalf,
        };
        const aN = stripMascotML(awayC.team?.displayName ?? "");
        const hN = stripMascotML(homeC.team?.displayName ?? "");
        if (!map.has(`${aN}|${hN}`)) {
          map.set(`${aN}|${hN}`, lg);
          map.set(`away:${aN}`, lg);
          map.set(`home:${hN}`, lg);
        }
      }
    } catch { /* silent */ }
  }
  return map;
}

function useLiveScores() {
  const [liveScores, setLiveScores] = useState<Map<string, LiveGame>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    try {
      const m = await fetchEspnScores();
      setLiveScores(m);
      setLastUpdated(new Date());
      const hasLive = Array.from(m.values()).some(g => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch { timerRef.current = setTimeout(load, 120_000); }
  }, []);
  useEffect(() => { load(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [load]);
  const getLive = useCallback((away: string, home: string): LiveGame | undefined => {
    const a = stripMascotML(away), h = stripMascotML(home);
    return liveScores.get(`${a}|${h}`) ?? liveScores.get(`away:${a}`) ?? liveScores.get(`home:${h}`);
  }, [liveScores]);
  return { getLive, lastUpdated };
}

export default function MoneylinePage() {
  const [showHistory, setShowHistory] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const { getLive, lastUpdated } = useLiveScores();

  const today = new Date().toLocaleDateString("en-CA");

  // Today's picks: all games for today that have (or had) an ML pick
  const todayPicks = useMemo(() => {
    const picks = allGames.filter(g => g.date === today && g.mlPick);
    return computeAllocation(picks);
  }, [today]);

  const allocatedPicks = todayPicks.filter(p => p.units > 0);
  const trackedPicks = todayPicks.filter(p => p.units === 0);
  const pendingPicks = allocatedPicks.filter(p => p.status === "pending");
  const completedPicks = allocatedPicks.filter(p => p.status === "completed");
  const todayWins = completedPicks.filter(p => p.won).length;
  const todayLosses = completedPicks.filter(p => !p.won).length;
  const todayPnl = completedPicks.reduce((s, p) => s + (p.pnl ?? 0), 0);

  const todayTotals = useMemo(() => {
    const risked = allocatedPicks.reduce((s, p) => s + p.units, 0);
    const expReturn = allocatedPicks.reduce((s, p) => s + p.expReturn, 0);
    return { risked, expReturn: Math.round(expReturn * 10) / 10, picks: allocatedPicks.length, tracked: trackedPicks.length };
  }, [allocatedPicks, trackedPicks]);

  // Historical daily results (completed days only)
  const dailyResults = useMemo(() => {
    const byDate: Record<string, Game[]> = {};
    for (const g of allGames) {
      if (!g.mlPick || g.date === today) continue;
      if (!byDate[g.date]) byDate[g.date] = [];
      byDate[g.date].push(g);
    }

    let cumRisked = 0, cumReturned = 0, cumExpReturn = 0;
    let bestDay = -Infinity, worstDay = Infinity;
    const days: {
      date: string; picks: number; wins: number; losses: number; pending: number;
      risked: number; returned: number; pnl: number; expReturn: number;
      cumRisked: number; cumReturned: number; cumPnl: number; cumExpPnl: number; roi: number;
      alloc: Allocation[];
    }[] = [];

    for (const date of Object.keys(byDate).sort()) {
      const dayGames = byDate[date];
      const alloc = computeAllocation(dayGames);
      const completed = alloc.filter(a => a.status === "completed");
      const pending = alloc.filter(a => a.status === "pending");

      let dayRisked = 0, dayReturned = 0, dayExpReturn = 0, wins = 0, losses = 0;

      for (const a of completed) {
        dayRisked += a.units;
        dayExpReturn += a.expReturn;
        if (a.won) {
          dayReturned += a.units + a.toWin;
          wins++;
        } else {
          losses++;
        }
      }

      // Include pending games' risk in exposure but not in P&L
      for (const a of pending) {
        dayExpReturn += a.expReturn;
      }

      if (completed.length === 0 && pending.length > 0) continue; // day hasn't started resolving

      const pnl = dayReturned - dayRisked;
      cumRisked += dayRisked;
      cumReturned += dayReturned;
      cumExpReturn += dayExpReturn;

      if (pnl > bestDay) bestDay = pnl;
      if (pnl < worstDay) worstDay = pnl;

      days.push({
        date, picks: alloc.length, wins, losses, pending: pending.length,
        risked: Math.round(dayRisked), returned: Math.round(dayReturned * 10) / 10,
        pnl: Math.round(pnl * 10) / 10, expReturn: Math.round(dayExpReturn * 10) / 10,
        cumRisked: Math.round(cumRisked), cumReturned: Math.round(cumReturned * 10) / 10,
        cumPnl: Math.round((cumReturned - cumRisked) * 10) / 10,
        cumExpPnl: Math.round(cumExpReturn * 10) / 10,
        roi: cumRisked > 0 ? ((cumReturned - cumRisked) / cumRisked) * 100 : 0,
        alloc,
      });
    }

    return { days, bestDay: Math.round(bestDay * 10) / 10, worstDay: Math.round(worstDay * 10) / 10, cumRisked, cumReturned, cumExpReturn };
  }, [today]);

  // Header stats: live-tracked days only (exclude reconstructed backfill)
  const liveDays = dailyResults.days.filter(d => d.date >= LIVE_TRACKING_START);
  const liveRisked = liveDays.reduce((s, d) => s + d.risked, 0);
  const liveReturned = liveDays.reduce((s, d) => s + d.returned, 0);
  const cumPnl = Math.round((liveReturned - liveRisked) * 10) / 10;
  const cumRoi = liveRisked > 0 ? ((liveReturned - liveRisked) / liveRisked) * 100 : 0;
  const totalDays = liveDays.length;
  const totalWins = liveDays.reduce((s, d) => s + d.wins, 0);
  const totalLosses = liveDays.reduce((s, d) => s + d.losses, 0);
  const totalPicks = totalWins + totalLosses;
  const winPct = totalPicks > 0 ? (totalWins / totalPicks) * 100 : 0;

  const C = { accent: "#1a7a8a", bg: "#f5f3ef", card: "#fff", border: "#d4d2cc" };

  const renderPickRow = (p: Allocation, showResult: boolean) => {
    const lg = getLive(p.game.awayTeam, p.game.homeTeam);
    const isLive = lg?.status === "in";
    const liveAway = lg?.awayScore ?? null;
    const liveHome = lg?.homeScore ?? null;

    // Use live scores for display if available, fall back to JSON
    const dispAwayScore = liveAway ?? p.game.actualAwayScore;
    const dispHomeScore = liveHome ?? p.game.actualHomeScore;
    const hasScore = dispAwayScore != null && dispHomeScore != null;

    // Determine W/L from scores — live, ESPN-final, or JSON-final
    const isEspnFinal = lg?.status === "post";
    let resultColor = "#888";
    let resultText: React.ReactNode = <span style={{ color: "#999", fontWeight: 400 }}>--</span>;
    let pnlText: React.ReactNode = <span style={{ color: "#999" }}>--</span>;

    if (p.status === "completed") {
      // JSON has final scores
      resultColor = p.won ? "#16a34a" : "#dc2626";
      resultText = p.won ? "W" : "L";
      pnlText = p.pnl !== undefined ? `${p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(1)}u` : <span style={{ color: "#999" }}>--</span>;
    } else if (hasScore && (isLive || isEspnFinal)) {
      // Live or ESPN-final: show W/L and P&L based on current/final score
      const pickIsHome = p.game.homeTeam === p.pickTeam;
      const pickScore = pickIsHome ? dispHomeScore! : dispAwayScore!;
      const oppScore = pickIsHome ? dispAwayScore! : dispHomeScore!;
      if (pickScore > oppScore) {
        resultColor = "#16a34a"; resultText = "W";
        pnlText = `+${p.toWin.toFixed(1)}u`;
      } else if (pickScore < oppScore) {
        resultColor = "#dc2626"; resultText = "L";
        pnlText = `${(-p.units).toFixed(1)}u`;
      } else {
        resultColor = "#888"; resultText = <span style={{ fontSize: 9 }}>tied</span>;
      }
    }

    // Score display
    let scoreDisplay: React.ReactNode = "--";
    if (hasScore) {
      const pickIsAway = p.game.awayTeam === p.pickTeam;
      scoreDisplay = `${pickIsAway ? dispAwayScore : dispHomeScore}-${pickIsAway ? dispHomeScore : dispAwayScore}`;
    }

    // Row background and opacity
    const isTrackedOnly = p.units === 0;
    let rowBg = "transparent";
    if (p.status === "completed") rowBg = p.won ? "#fafff8" : "#fffafa";
    else if (isLive) rowBg = "#f0f9ff";
    const rowOpacity = isTrackedOnly ? 0.55 : 1;

    return (
      <tr key={p.game.gameId} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: rowBg, opacity: rowOpacity }}>
        <td style={{ padding: "7px 8px", fontWeight: 700, color: C.accent }}>{shortName(p.pickTeam)}</td>
        <td style={{ padding: "7px 8px", color: "#555" }}>{shortName(p.game.awayTeam)} @ {shortName(p.game.homeTeam)}</td>
        <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.odds > 0 ? `+${p.odds}` : p.odds}</td>
        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: p.edge >= 10 ? "#16a34a" : "#374151" }}>{p.edge.toFixed(1)}%</td>
        <td style={{ padding: "7px 8px", textAlign: "right" }}>{(p.prob * 100).toFixed(0)}%</td>
        <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>{p.units}u</td>
        {showResult ? (
          <>
            <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: resultColor }}>
              {isLive && <span className="live-dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: resultColor, marginRight: 3, verticalAlign: "middle" }} />}
              {resultText}
            </td>
            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: resultColor }}>
              {pnlText}
            </td>
            <td style={{ padding: "7px 8px", textAlign: "right", color: isLive ? "#0369a1" : "#888", fontSize: 10, fontWeight: isLive ? 700 : 400 }}>
              {isLive && lg?.statusDisplay ? <span style={{ fontSize: 8, color: "#0369a1", marginRight: 3 }}>{lg.statusDisplay}</span> : null}
              {scoreDisplay}
            </td>
          </>
        ) : (
          <>
            <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.toWin.toFixed(1)}u</td>
            <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: p.expReturn >= 0 ? "#16a34a" : "#dc2626" }}>{p.expReturn >= 0 ? "+" : ""}{p.expReturn.toFixed(1)}u</td>
          </>
        )}
      </tr>
    );
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            Internal Tracking Only — Not Published
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
            Moneyline Picks — {DAILY_UNITS}u Daily Allocation
          </h1>
          <p style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
            Platt-calibrated (a=2.80, b=-0.37) | Edge &ge; 5% | Top {MAX_PICKS_PER_DAY} by edge | Max {MAX_SINGLE}u per pick | Picks locked at first generation
          </p>
          {ML_PAUSED && (
            <div style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 6, padding: "8px 14px", marginTop: 8, fontSize: 11, color: "#92400e", textAlign: "center" }}>
              ML picks paused — early-season team ratings stabilizing. Tracking begins automatically when model confidence reaches minimum threshold (homeWinPct std &gt; 0.09).
            </div>
          )}
        </div>

        {/* Cumulative Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
          {[
            { label: "Record", value: `${totalWins}-${totalLosses}` },
            { label: "Win Rate", value: `${winPct.toFixed(1)}%` },
            { label: "Cum P&L", value: `${cumPnl >= 0 ? "+" : ""}${cumPnl.toFixed(1)}u`, color: cumPnl >= 0 ? "#16a34a" : "#dc2626" },
            { label: "ROI", value: `${cumRoi >= 0 ? "+" : ""}${cumRoi.toFixed(1)}%`, color: cumRoi >= 0 ? "#16a34a" : "#dc2626" },
            { label: "Best Day", value: totalDays > 0 ? `${Math.max(...liveDays.map(d => d.pnl)) >= 0 ? "+" : ""}${Math.round(Math.max(...liveDays.map(d => d.pnl)) * 10) / 10}u` : "\u2014", color: totalDays > 0 ? (Math.max(...liveDays.map(d => d.pnl)) >= 0 ? "#16a34a" : "#dc2626") : undefined },
            { label: "Worst Day", value: totalDays > 0 ? `${Math.min(...liveDays.map(d => d.pnl)) >= 0 ? "+" : ""}${Math.round(Math.min(...liveDays.map(d => d.pnl)) * 10) / 10}u` : "\u2014", color: totalDays > 0 ? (Math.min(...liveDays.map(d => d.pnl)) >= 0 ? "#16a34a" : "#dc2626") : undefined },
          ].map(c => (
            <div key={c.label} style={{
              backgroundColor: C.card, borderRadius: 8, padding: "10px 8px",
              border: `1px solid ${C.border}`, textAlign: "center",
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: c.color ?? C.accent }}>{c.value}</div>
              <div style={{ fontSize: 9, color: "#999", textTransform: "uppercase", marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Expected vs Actual — live days only */}
        {totalDays > 0 && (() => {
          const liveExpReturn = liveDays.reduce((s, d) => s + d.expReturn, 0);
          const liveBest = Math.max(...liveDays.map(d => d.pnl));
          const liveWorst = Math.min(...liveDays.map(d => d.pnl));
          return (
          <div style={{
            backgroundColor: cumPnl >= liveExpReturn * 0.85 ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${cumPnl >= 0 ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 8, padding: "10px 16px", marginBottom: "1.5rem",
            fontSize: 12, textAlign: "center", color: "#374151",
          }}>
            <strong>Expected P&L:</strong> {liveExpReturn >= 0 ? "+" : ""}{Math.round(liveExpReturn * 10) / 10}u
            &nbsp;&middot;&nbsp;
            <strong>Actual P&L:</strong> {cumPnl >= 0 ? "+" : ""}{cumPnl}u
            &nbsp;&middot;&nbsp;
            <strong>Tracking:</strong> {cumPnl >= liveExpReturn * 0.85 ? "Within expectations" : "Below expected \u2014 monitor"}
            &nbsp;&middot;&nbsp;
            {totalDays} live days tracked
          </div>
          );
        })()}

        {/* Today's Allocation — shows all picks with inline results for completed games */}
        <div style={{
          backgroundColor: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
          overflow: "hidden", marginBottom: "1.5rem",
        }}>
          <div style={{
            backgroundColor: "#e6f0f2", padding: "10px 16px",
            fontWeight: 700, fontSize: 13, color: C.accent, textAlign: "center",
          }}>
            Today&apos;s Picks — {today}
            {todayPicks.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: 11, color: "#666" }}>
                {" "}({todayTotals.picks} picks, {todayTotals.risked}u risked
                {todayTotals.tracked > 0 && ` | ${todayTotals.tracked} tracked`}
                {completedPicks.length > 0 && ` | ${todayWins}W-${todayLosses}L ${todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(1)}u`}
                {pendingPicks.length > 0 && ` | ${pendingPicks.length} pending`})
              </span>
            )}
            {lastUpdated && (
              <div style={{ fontSize: 9, color: "#999", fontWeight: 400, marginTop: 2 }}>
                Live scores updated {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f6f2" }}>
                  {["Pick", "Matchup", "Odds", "Edge", "Prob", "Units", "Result", "P&L", "Score"].map(h => (
                    <th key={h} style={{ padding: "7px 8px", textAlign: h === "Pick" || h === "Matchup" ? "left" : h === "Result" ? "center" : "right", fontWeight: 600, fontSize: 9, color: "#666", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayPicks.map(p => renderPickRow(p, true))}
                {todayPicks.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "#999" }}>No ML picks today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daily History */}
        <div style={{
          backgroundColor: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
          overflow: "hidden",
        }}>
          <div
            style={{
              backgroundColor: "#e6f0f2", padding: "10px 16px",
              fontWeight: 700, fontSize: 13, color: C.accent, textAlign: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowHistory(!showHistory)}
          >
            Daily History ({totalDays} days) {showHistory ? "\u25B2" : "\u25BC"}
          </div>
          {showHistory && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8f6f2" }}>
                    {["Date", "Picks", "W-L", "Risked", "P&L", "Exp P&L", "Cum P&L", "Cum Exp", "ROI"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: h === "Date" ? "left" : "right", fontWeight: 600, fontSize: 9, color: "#666", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyResults.days.slice().reverse().map(d => {
                    const isBackfill = d.date < LIVE_TRACKING_START;
                    const isExpanded = expandedDays.has(d.date);
                    return (
                    <React.Fragment key={d.date}>
                    <tr
                      style={{ borderTop: `1px solid ${C.border}`, backgroundColor: isBackfill ? "#f5f5f0" : d.pnl >= 0 ? "#fafff8" : "#fffafa", opacity: isBackfill ? 0.7 : 1, cursor: "pointer" }}
                      onClick={() => setExpandedDays(prev => {
                        const next = new Set(prev);
                        if (next.has(d.date)) next.delete(d.date); else next.add(d.date);
                        return next;
                      })}
                    >
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ fontSize: 9, marginRight: 4, color: "#999" }}>{isExpanded ? "\u25B2" : "\u25BC"}</span>
                        {d.date.slice(5)}
                        {isBackfill && <span style={{ color: "#b0a090", fontSize: 8, marginLeft: 4, fontStyle: "italic" }}>recon</span>}
                        {d.pending > 0 && <span style={{ color: "#f59e0b", fontSize: 9, marginLeft: 4 }}>({d.pending} pending)</span>}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.picks}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.wins}-{d.losses}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.risked}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: d.pnl >= 0 ? "#16a34a" : "#dc2626" }}>{d.pnl >= 0 ? "+" : ""}{d.pnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>{d.expReturn >= 0 ? "+" : ""}{d.expReturn}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: d.cumPnl >= 0 ? "#16a34a" : "#dc2626" }}>{d.cumPnl >= 0 ? "+" : ""}{d.cumPnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>{d.cumExpPnl >= 0 ? "+" : ""}{d.cumExpPnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.roi.toFixed(1)}%</td>
                    </tr>
                    {isExpanded && d.alloc.map(p => {
                      const resultColor = p.won === true ? "#16a34a" : p.won === false ? "#dc2626" : "#888";
                      const score = p.game.actualHomeScore != null
                        ? `${p.game.awayTeam === p.pickTeam ? p.game.actualAwayScore : p.game.actualHomeScore}-${p.game.awayTeam === p.pickTeam ? p.game.actualHomeScore : p.game.actualAwayScore}`
                        : null;
                      return (
                      <tr key={p.game.gameId} style={{ backgroundColor: "#f8f6f2", borderTop: `1px solid #e8e6e0`, opacity: isBackfill ? 0.7 : 1 }}>
                        <td style={{ padding: "5px 8px 5px 24px", fontWeight: 600, color: C.accent, fontSize: 10 }}>{shortName(p.pickTeam)}</td>
                        <td style={{ padding: "5px 8px", color: "#555", fontSize: 10 }}>{shortName(p.game.awayTeam)} @ {shortName(p.game.homeTeam)}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10 }}>{p.odds > 0 ? `+${p.odds}` : p.odds}</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: p.edge >= 10 ? "#16a34a" : "#374151" }}>{p.edge.toFixed(1)}%</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: resultColor }}>
                          {p.status === "completed" ? (p.won ? "W" : "L") : "--"}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10 }}>{p.units}u</td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, fontWeight: 600, color: resultColor }}>
                          {p.pnl !== undefined ? `${p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(1)}u` : "--"}
                        </td>
                        <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 10, color: "#888" }}>{score ?? "--"}</td>
                        <td />
                      </tr>
                      );
                    })}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#bbb", marginTop: "1.5rem" }}>
          Walk-forward benchmark: 51.9% win rate, +9.6% ROI | Platt a=2.796, b=-0.366 | Picks locked at first pipeline run
        </div>
      </div>
    </div>
  );
}
