"use client";

import { useState, useMemo } from "react";
import games from "@/data/betting-lines/json/games.json";

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
    return (
      g.date &&
      g.away &&
      g.home &&
      g.vegasHomeLine !== null &&
      g.bbmiHomeLine !== null
    );
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

  // Summary metrics (full dataset)
  const sampleSize = historicalGames.length;
  const wins = historicalGames.filter((g) => Number(g.fakeWin) > 0).length;

  const fakeWagered = historicalGames.reduce((sum, g) => {
    const bet = Number(g.fakeBet);
    return !isNaN(bet) ? sum + bet : sum;
  }, 0);

  const fakeWon = historicalGames.reduce(
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

  // Colors (inline-safe)
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

  // DAILY SUMMARY (new)
  const dailySampleSize = filteredHistorical.length;
  const dailyWins = filteredHistorical.filter((g) => Number(g.fakeWin) > 0).length;

  const dailyFakeWagered = filteredHistorical.reduce((sum, g) => {
    const bet = Number(g.fakeBet);
    return !isNaN(bet) ? sum + bet : sum;
  }, 0);

  const dailyFakeWon = filteredHistorical.reduce(
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tightest leading-tight">
            Betting Lines
          </h1>
          <p className="text-stone-700 text-sm tracking-tight">
            Daily comparison of BBMI model vs Vegas lines
          </p>
        </div>

        {/* Summary Metrics (full dataset) */}
        <div className="rankings-table mb-10">
          <div className="summary-header">Summary Metrics</div>

          <div className="bg-white p-4 rounded-b-md">
            <div className="flex flex-wrap gap-4 justify-between">
              <SummaryCard
                label="Sample Size (Games)"
                value={summary.sampleSize.toLocaleString()}
              />
              <SummaryCard
                label="% BBMI Beats Vegas"
                value={`${summary.bbmiWinPct}%`}
                color={bbmiBeatsVegasColor}
              />
              <SummaryCard
                label="Fake Money Wagered"
                value={`$${summary.fakeWagered.toLocaleString()}`}
                color={fakeWageredColor}
              />
              <SummaryCard
                label="Fake Money Won"
                value={`$${summary.fakeWon.toLocaleString()}`}
                color={fakeWonColor}
              />
              <SummaryCard
                label="ROI"
                value={`${summary.roi}%`}
                color={roiColor}
              />
            </div>
          </div>
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
                      {(g.bbmiWinProb * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historical Results */}
        <h2 className="text-xl font-semibold tracking-tight text-center mb-3">
          Historical Results
        </h2>

        {/* Date Dropdown */}
        <div className="mb-4 flex justify-center">
          <select
  className="border border-stone-300 rounded-md px-3 py-2 text-base !px-4 !py-2 !text-base"
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}
>

            {availableDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* DAILY SUMMARY (new compact version) */}
        <div className="rankings-table mb-6">
          <div className="summary-header">Daily Summary</div>

          <div className="bg-white p-3 rounded-b-md">
            <div className="flex flex-wrap gap-3 justify-between">
              <SummaryCard
                label="Sample Size (Games)"
                value={dailySummary.sampleSize.toLocaleString()}
              />
              <SummaryCard
                label="% BBMI Beats Vegas"
                value={`${dailySummary.bbmiWinPct}%`}
                color={dailyBbmiBeatsVegasColor}
              />
              <SummaryCard
                label="Fake Money Wagered"
                value={`$${dailySummary.fakeWagered.toLocaleString()}`}
                color={dailyFakeWageredColor}
              />
              <SummaryCard
                label="Fake Money Won"
                value={`$${dailySummary.fakeWon.toLocaleString()}`}
                color={dailyFakeWonColor}
              />
              <SummaryCard
                label="ROI"
                value={`${dailySummary.roi}%`}
                color={dailyRoiColor}
              />
            </div>
          </div>
        </div>

        {/* Historical Results Table */}
        <div className="rankings-table">
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
                  <th>Actual Home Line</th>
                  <th>Away Score</th>
                  <th>Home Score</th>
                  <th>Bet</th>
                  <th>Win</th>
                  <th>Result</th>
                </tr>
              </thead>

              <tbody>
                {filteredHistorical.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center py-6 text-stone-500">
                      No results for this date.
                    </td>
                  </tr>
                )}

                {filteredHistorical.map((g, i) => {
                  const actualHomeLine = g.actualHomeScore - g.actualAwayScore;

                  return (
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
                      <td className="text-right">{actualHomeLine}</td>
                      <td className="text-right">{g.actualAwayScore}</td>
                      <td className="text-right">{g.actualHomeScore}</td>
                      <td className="text-right">{g.fakeBet}</td>
                      <td className="text-right">{g.fakeWin}</td>

                      <td className="text-center">
                        {Number(g.fakeBet) > 0 ? (
                          Number(g.fakeWin) > 0 ? (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>
                              ✔
                            </span>
                          ) : (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>
                              ✘
                            </span>
                          )
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
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