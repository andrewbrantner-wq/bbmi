"use client";

import { useState, useMemo } from "react";
import games from "@/data/betting-lines/games.json";
import BBMILogo from "@/components/BBMILogo";

type UpcomingGame = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
};

type HistoricalGame = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string;
  fakeWin: number | null;
};

export default function BettingLinesPage() {
  // Remove empty or malformed rows
  const cleanedGames = games.filter((g) => {
    return g.date && g.away && g.home;
  });

  // Upcoming = no scores OR home score is 0
  const upcomingGames: UpcomingGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore === 0 ||
      g.actualHomeScore === null ||
      g.actualHomeScore === undefined ||
      g.actualAwayScore === null ||
      g.actualAwayScore === undefined
  );

  // Historical = completed games
  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualHomeScore !== undefined &&
      g.actualAwayScore !== null &&
      g.actualAwayScore !== undefined &&
      g.actualHomeScore !== 0
  );

  // ================================
  // TOP SUMMARY — ONLY games with bets
  // ================================
  const betHistorical = historicalGames.filter((g) => Number(g.fakeBet) > 0);

  const sampleSize = betHistorical.length;
  const wins = betHistorical.filter((g) => Number(g.fakeWin) > 0).length;

  const fakeWagered = betHistorical.reduce((sum, g) => {
    const bet = Number(g.fakeBet);
    return !isNaN(bet) ? sum + bet : sum;
  }, 0);

  const fakeWon = betHistorical.reduce(
    (sum, g) => sum + Number(g.fakeWin || 0),
    0
  );

  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 : 0;

  const summary = {
    sampleSize,
    bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0",
    fakeWagered,
    fakeWon,
    roi: roi.toFixed(1),
  };

  // Colors
  const bbmiBeatsVegasColor =
    Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";
  const fakeWageredColor = "#dc2626";
  const fakeWonColor =
    summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626";
  const roiColor = Number(summary.roi) > 100 ? "#16a34a" : "#dc2626";

  // Build dropdown list
  const availableDates = useMemo(() => {
    const set = new Set(historicalGames.map((g) => g.date));
    return Array.from(set).sort().reverse();
  }, [historicalGames]);

  const [selectedDate, setSelectedDate] = useState(
    availableDates.length > 0 ? availableDates[0] : ""
  );

  const filteredHistorical = useMemo(() => {
    return historicalGames.filter((g) => g.date === selectedDate);
  }, [historicalGames, selectedDate]);

  // ================================
  // DAILY SUMMARY — ONLY games with bets
  // ================================
  const betDaily = filteredHistorical.filter((g) => Number(g.fakeBet) > 0);

  const dailySampleSize = betDaily.length;
  const dailyWins = betDaily.filter((g) => Number(g.fakeWin) > 0).length;

  const dailyFakeWagered = betDaily.reduce((sum, g) => {
    const bet = Number(g.fakeBet);
    return !isNaN(bet) ? sum + bet : sum;
  }, 0);

  const dailyFakeWon = betDaily.reduce(
    (sum, g) => sum + Number(g.fakeWin || 0),
    0
  );

  const dailyRoi =
    dailyFakeWagered > 0 ? (dailyFakeWon / dailyFakeWagered) * 100 : 0;

  const dailySummary = {
    sampleSize: dailySampleSize,
    bbmiWinPct:
      dailySampleSize > 0
        ? ((dailyWins / dailySampleSize) * 100).toFixed(1)
        : "0",
    fakeWagered: dailyFakeWagered,
    fakeWon: dailyFakeWon,
    roi: dailyRoi.toFixed(1),
  };

  const dailyBbmiBeatsVegasColor =
    Number(dailySummary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";
  const dailyFakeWageredColor = "#dc2626";
  const dailyFakeWonColor =
    dailySummary.fakeWon > dailySummary.fakeWagered ? "#16a34a" : "#dc2626";
  const dailyRoiColor =
    Number(dailySummary.roi) > 100 ? "#16a34a" : "#dc2626";

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight">
            NCAA | Today's Picks
          </h1>
          
        </div>

        

        {/* Upcoming Games */}
        <h2 className="text-xl font-semibold tracking-tight mb-3">Upcoming Games</h2>

        <div className="rankings-table mb-10">
          <div className="rankings-scroll max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr>
                  <th className="sticky left-0 bg-white z-30 w-[120px] min-w-[120px]">
                    Date
                  </th>
                  <th className="sticky left-[120px] bg-white z-30">
                    Game
                  </th>
                  <th>Away Team</th>
                  <th>Home Team</th>
                  <th>Vegas Home Line</th>
                  <th>BBMI Home Line</th>
                  <th>BBMI Pick</th>
                  <th>BBMI Home Win %</th>
                </tr>
              </thead>

              <tbody>
                {upcomingGames.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-stone-500">
                      No upcoming games.
                    </td>
                  </tr>
                )}

                {upcomingGames.map((g, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                  >
                    <td className="sticky left-0 bg-white z-10 w-[120px] min-w-[120px]">
                      {g.date}
                    </td>

                    <td className="sticky left-[120px] bg-white z-10">
                      {`${g.away} @ ${g.home}`}
                    </td>

                    <td>{g.away}</td>
                    <td>{g.home}</td>
                    <td className="text-right">{g.vegasHomeLine}</td>
                    <td className="text-right">{g.bbmiHomeLine}</td>
                    <td className="text-right">
                      {g.bbmiHomeLine === g.vegasHomeLine
                        ? ""
                        : g.bbmiHomeLine > g.vegasHomeLine
                        ? g.away
                        : g.home}
                    </td>

                    <td className="text-right">
                      {g.bbmiWinProb !== null ? (g.bbmiWinProb * 100).toFixed(1) : "—"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        

        {/* Disclaimer */}
        <p className="text-xs text-stone-500 mt-8 text-center max-w-[600px] mx-auto leading-snug">
          This page is for entertainment and informational purposes only. It is
          not intended for real-world gambling or wagering.
        </p>
      </div>
    </div>
  );
}

/* Summary Card Component */
function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: any;
  color?: string;
}) {
  return (
    <div className="card p-4 text-center">
      <div
        className="text-xs uppercase tracking-wider text-stone-500 mb-1"
        style={{ fontWeight: 700 }}
      >
        {label}
      </div>
      <div
        className="text-2xl tracking-tight"
        style={{ fontWeight: 700, color: color ?? "inherit" }}
      >
        {value}
      </div>
    </div>
  );
}