"use client";

import React, { useState, useMemo } from "react";
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

function shortName(team: string): string {
  // Remove common suffixes like "Bulldogs", "Tigers", etc. but keep location identifiers
  const parts = team.split(" ");
  if (parts.length <= 2) return team;
  // Common mascot words to drop
  const mascots = new Set(["Bulldogs","Tigers","Bears","Eagles","Hawks","Wildcats","Panthers",
    "Cavaliers","Cardinals","Cougars","Huskies","Knights","Mustangs","Owls","Rams","Rebels",
    "Seminoles","Sooners","Terrapins","Volunteers","Wolverines","Aggies","Commodores",
    "Crimson","Demon","Deacons","Devil","Ducks","Gators","Golden","Hawkeyes","Hoosiers",
    "Horned","Frogs","Jayhawks","Longhorns","Mountaineers","Nittany","Lions","Razorbacks",
    "Scarlet","Tar","Heels","Trojans","Utes","Boilermakers","Buckeyes","Cornhuskers",
    "Cowboys","Cyclones","Hokies","Hurricanes","Irish","Musketeers","Shockers","Tribe",
    "Trailblazers","Patriots","Anteaters","Matadors","Gaels","Dons","Toreros","Wave",
    "Tide","Flames","Beavers","Bruins","Sun","Devils"]);
  // Drop trailing mascot words
  let end = parts.length;
  while (end > 2 && mascots.has(parts[end - 1])) end--;
  return parts.slice(0, end).join(" ");
}

function oddsToDecimal(american: number): number {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

function computeAllocation(picks: Game[]): {
  game: Game;
  pickTeam: string;
  oppTeam: string;
  odds: number;
  edge: number;
  prob: number;
  units: number;
  toWin: number;
  expReturn: number;
}[] {
  if (picks.length === 0) return [];

  const totalEdge = picks.reduce((s, g) => s + (g.mlEdge ?? 0), 0);

  // First pass: compute raw units proportional to edge
  const rawAlloc = picks.map(g => {
    const odds = g.mlPickOdds ?? 0;
    const edge = g.mlEdge ?? 0;
    const prob = g.mlPickProb ?? 0;
    const pickTeam = g.mlPick === "HOME" ? g.homeTeam : g.awayTeam;
    const oppTeam = g.mlPick === "HOME" ? g.awayTeam : g.homeTeam;

    let units = totalEdge > 0 ? Math.round((edge / totalEdge) * DAILY_UNITS) : 0;
    units = Math.min(units, MAX_SINGLE);
    units = Math.max(units, 1);

    return { game: g, pickTeam, oppTeam, odds, edge, prob, units };
  });

  // Normalize so total is exactly DAILY_UNITS
  const rawTotal = rawAlloc.reduce((s, p) => s + p.units, 0);
  if (rawTotal !== DAILY_UNITS && rawTotal > 0) {
    // Distribute the difference across the highest-edge picks
    let diff = DAILY_UNITS - rawTotal;
    const sorted = [...rawAlloc].sort((a, b) => b.edge - a.edge);
    let i = 0;
    while (diff !== 0) {
      const adj = diff > 0 ? 1 : -1;
      if (sorted[i % sorted.length].units + adj >= 1 && sorted[i % sorted.length].units + adj <= MAX_SINGLE) {
        sorted[i % sorted.length].units += adj;
        diff -= adj;
      }
      i++;
      if (i > sorted.length * 3) break; // safety
    }
  }

  return rawAlloc.map(p => {
    const decimal = oddsToDecimal(p.odds);
    const toWin = p.units * (decimal - 1);
    const expReturn = (p.prob * toWin) - ((1 - p.prob) * p.units);
    return { ...p, toWin: Math.round(toWin * 10) / 10, expReturn: Math.round(expReturn * 10) / 10 };
  }).sort((a, b) => b.edge - a.edge);
}

export default function MoneylinePage() {
  const [showHistory, setShowHistory] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // Today's picks with allocation
  const todayPicks = useMemo(() => {
    const picks = allGames.filter(g => g.date === today && g.mlPick);
    return computeAllocation(picks);
  }, [today]);

  const todayTotals = useMemo(() => {
    const risked = todayPicks.reduce((s, p) => s + p.units, 0);
    const expReturn = todayPicks.reduce((s, p) => s + p.expReturn, 0);
    return { risked, expReturn: Math.round(expReturn * 10) / 10, picks: todayPicks.length };
  }, [todayPicks]);

  // Historical daily results
  const dailyResults = useMemo(() => {
    const byDate: Record<string, Game[]> = {};
    for (const g of allGames) {
      if (!g.mlPick || g.actualHomeScore == null || g.actualAwayScore == null) continue;
      if (!byDate[g.date]) byDate[g.date] = [];
      byDate[g.date].push(g);
    }

    let cumRisked = 0, cumReturned = 0, cumExpReturn = 0;
    let bestDay = -Infinity, worstDay = Infinity;
    const days: {
      date: string; picks: number; wins: number; losses: number;
      risked: number; returned: number; pnl: number; expReturn: number;
      cumRisked: number; cumReturned: number; cumPnl: number; cumExpPnl: number; roi: number;
    }[] = [];

    for (const date of Object.keys(byDate).sort()) {
      const dayGames = byDate[date];
      const alloc = computeAllocation(dayGames);

      let dayRisked = 0, dayReturned = 0, dayExpReturn = 0, wins = 0, losses = 0;

      for (const a of alloc) {
        const g = a.game;
        const homeWon = (g.actualHomeScore ?? 0) > (g.actualAwayScore ?? 0);
        const pickWon = (g.mlPick === "HOME" && homeWon) || (g.mlPick === "AWAY" && !homeWon);

        dayRisked += a.units;
        dayExpReturn += a.expReturn;

        if (pickWon) {
          dayReturned += a.units + a.toWin;
          wins++;
        } else {
          losses++;
        }
      }

      const pnl = dayReturned - dayRisked;
      cumRisked += dayRisked;
      cumReturned += dayReturned;
      cumExpReturn += dayExpReturn;

      if (pnl > bestDay) bestDay = pnl;
      if (pnl < worstDay) worstDay = pnl;

      days.push({
        date, picks: alloc.length, wins, losses,
        risked: Math.round(dayRisked), returned: Math.round(dayReturned * 10) / 10,
        pnl: Math.round(pnl * 10) / 10, expReturn: Math.round(dayExpReturn * 10) / 10,
        cumRisked: Math.round(cumRisked), cumReturned: Math.round(cumReturned * 10) / 10,
        cumPnl: Math.round((cumReturned - cumRisked) * 10) / 10,
        cumExpPnl: Math.round(cumExpReturn * 10) / 10,
        roi: cumRisked > 0 ? ((cumReturned - cumRisked) / cumRisked) * 100 : 0,
      });
    }

    return { days, bestDay: Math.round(bestDay * 10) / 10, worstDay: Math.round(worstDay * 10) / 10, cumRisked, cumReturned, cumExpReturn };
  }, []);

  const cumPnl = Math.round((dailyResults.cumReturned - dailyResults.cumRisked) * 10) / 10;
  const cumRoi = dailyResults.cumRisked > 0 ? ((dailyResults.cumReturned - dailyResults.cumRisked) / dailyResults.cumRisked) * 100 : 0;
  const totalDays = dailyResults.days.length;
  const totalWins = dailyResults.days.reduce((s, d) => s + d.wins, 0);
  const totalLosses = dailyResults.days.reduce((s, d) => s + d.losses, 0);
  const totalPicks = totalWins + totalLosses;
  const winPct = totalPicks > 0 ? (totalWins / totalPicks) * 100 : 0;

  const C = { accent: "#1a7a8a", bg: "#f5f3ef", card: "#fff", border: "#d4d2cc" };

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
            Platt-calibrated (a=2.80, b=-0.37) | Edge &ge; 5% | Max {MAX_SINGLE}u per pick
          </p>
        </div>

        {/* Cumulative Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: "1.5rem" }}>
          {[
            { label: "Record", value: `${totalWins}-${totalLosses}` },
            { label: "Win Rate", value: `${winPct.toFixed(1)}%` },
            { label: "Cum P&L", value: `${cumPnl >= 0 ? "+" : ""}${cumPnl.toFixed(1)}u`, color: cumPnl >= 0 ? "#16a34a" : "#dc2626" },
            { label: "ROI", value: `${cumRoi >= 0 ? "+" : ""}${cumRoi.toFixed(1)}%`, color: cumRoi >= 0 ? "#16a34a" : "#dc2626" },
            { label: "Best Day", value: totalDays > 0 ? `${dailyResults.bestDay >= 0 ? "+" : ""}${dailyResults.bestDay}u` : "\u2014", color: "#16a34a" },
            { label: "Worst Day", value: totalDays > 0 ? `${dailyResults.worstDay >= 0 ? "+" : ""}${dailyResults.worstDay}u` : "\u2014", color: "#dc2626" },
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

        {/* Expected vs Actual */}
        {totalDays > 0 && (
          <div style={{
            backgroundColor: cumPnl >= dailyResults.cumExpReturn * 0.85 ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${cumPnl >= 0 ? "#bbf7d0" : "#fecaca"}`,
            borderRadius: 8, padding: "10px 16px", marginBottom: "1.5rem",
            fontSize: 12, textAlign: "center", color: "#374151",
          }}>
            <strong>Expected P&L:</strong> {dailyResults.cumExpReturn >= 0 ? "+" : ""}{Math.round(dailyResults.cumExpReturn * 10) / 10}u
            &nbsp;&middot;&nbsp;
            <strong>Actual P&L:</strong> {cumPnl >= 0 ? "+" : ""}{cumPnl}u
            &nbsp;&middot;&nbsp;
            <strong>Tracking:</strong> {cumPnl >= dailyResults.cumExpReturn * 0.85 ? "Within expectations" : "Below expected — monitor"}
            &nbsp;&middot;&nbsp;
            {totalDays} days tracked
          </div>
        )}

        {/* Today's Allocation */}
        <div style={{
          backgroundColor: C.card, borderRadius: 10, border: `1px solid ${C.border}`,
          overflow: "hidden", marginBottom: "1.5rem",
        }}>
          <div style={{
            backgroundColor: "#e6f0f2", padding: "10px 16px",
            fontWeight: 700, fontSize: 13, color: C.accent, textAlign: "center",
          }}>
            Today&apos;s Allocation — {today} ({todayTotals.picks} picks, {todayTotals.risked}u risked, {todayTotals.expReturn >= 0 ? "+" : ""}{todayTotals.expReturn}u exp)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f6f2" }}>
                  {["Pick", "Matchup", "Odds", "Edge", "Prob", "Units", "To Win", "Exp Return"].map(h => (
                    <th key={h} style={{ padding: "7px 8px", textAlign: h === "Pick" || h === "Matchup" ? "left" : "right", fontWeight: 600, fontSize: 9, color: "#666", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayPicks.map(p => (
                  <tr key={p.game.gameId} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: "7px 8px", fontWeight: 700, color: C.accent }}>{shortName(p.pickTeam)}</td>
                    <td style={{ padding: "7px 8px", color: "#555" }}>{shortName(p.game.awayTeam)} @ {shortName(p.game.homeTeam)}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.odds > 0 ? `+${p.odds}` : p.odds}</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: p.edge >= 10 ? "#16a34a" : "#374151" }}>{p.edge.toFixed(1)}%</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{(p.prob * 100).toFixed(0)}%</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700 }}>{p.units}u</td>
                    <td style={{ padding: "7px 8px", textAlign: "right" }}>{p.toWin.toFixed(1)}u</td>
                    <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 600, color: p.expReturn >= 0 ? "#16a34a" : "#dc2626" }}>{p.expReturn >= 0 ? "+" : ""}{p.expReturn.toFixed(1)}u</td>
                  </tr>
                ))}
                {todayPicks.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#999" }}>No ML picks today</td></tr>
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
                  {dailyResults.days.slice().reverse().map(d => (
                    <tr key={d.date} style={{ borderTop: `1px solid ${C.border}`, backgroundColor: d.pnl >= 0 ? "#fafff8" : "#fffafa" }}>
                      <td style={{ padding: "6px 8px" }}>{d.date.slice(5)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.picks}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.wins}-{d.losses}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.risked}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: d.pnl >= 0 ? "#16a34a" : "#dc2626" }}>{d.pnl >= 0 ? "+" : ""}{d.pnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>{d.expReturn >= 0 ? "+" : ""}{d.expReturn}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: d.cumPnl >= 0 ? "#16a34a" : "#dc2626" }}>{d.cumPnl >= 0 ? "+" : ""}{d.cumPnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#888" }}>{d.cumExpPnl >= 0 ? "+" : ""}{d.cumExpPnl}u</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{d.roi.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#bbb", marginTop: "1.5rem" }}>
          Walk-forward benchmark: 51.9% win rate, +9.6% ROI | Platt a=2.796, b=-0.366 | Recalibrate annually
        </div>
      </div>
    </div>
  );
}
