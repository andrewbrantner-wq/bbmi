"use client";

import React, { useState, useMemo } from "react";
import games from "@/data/betting-lines/games.json";
import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";

type UpcomingGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
};

type HistoricalGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string | number | null;
  fakeWin: number | null;
};

type SortKey =
  | "date"
  | "away"
  | "home"
  | "vegasHomeLine"
  | "bbmiHomeLine"
  | "actualAwayScore"
  | "actualHomeScore"
  | "actualHomeLine"
  | "fakeBet"
  | "fakeWin"
  | "result";

type SortDirection = "asc" | "desc";

// --- Weekly grouping helpers ---
function getWeekStart(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day;
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.toISOString().slice(0, 10);
}

function groupByWeek(rows: HistoricalGame[]) {
  const weeks: Record<string, HistoricalGame[]> = {};

  for (const g of rows) {
    if (!g.date) continue;
    const weekKey = getWeekStart(g.date);
    if (!weeks[weekKey]) weeks[weekKey] = [];
    weeks[weekKey].push(g);
  }

  return weeks;
}

export default function BettingLinesPage() {
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  const betHistorical = historicalGames.filter((g) => Number(g.fakeBet) > 0);

  // --- Global Summary ---
  const sampleSize = betHistorical.length;
  const wins = betHistorical.filter((g) => Number(g.fakeWin) > 0).length;
  const fakeWagered = betHistorical.reduce(
    (sum, g) => sum + Number(g.fakeBet || 0),
    0
  );
  const fakeWon = betHistorical.reduce(
    (sum, g) => sum + Number(g.fakeWin || 0),
    0
  );
  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 - 100 : 0;

  const summary = {
    sampleSize,
    bbmiWinPct:
      wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0",
    fakeWagered,
    fakeWon,
    roi: roi.toFixed(1),
  };

  const bbmiBeatsVegasColor =
    Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";
  const fakeWonColor =
    summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626";
  const roiColor = Number(summary.roi) > 0 ? "#16a34a" : "#dc2626";

  // --- Weekly Selection ---
  const weeklyGroups = useMemo(
    () => groupByWeek(historicalGames),
    [historicalGames]
  );

  const availableWeeks = useMemo(
    () => Object.keys(weeklyGroups).sort().reverse(),
    [weeklyGroups]
  );

  const [selectedWeek, setSelectedWeek] = useState<string>(
    availableWeeks[0] ?? ""
  );

  const filteredHistorical = weeklyGroups[selectedWeek] ?? [];

  // --- Weekly Summary ---
  const betWeekly = filteredHistorical.filter((g) => Number(g.fakeBet) > 0);

  const weeklySampleSize = betWeekly.length;
  const weeklyWins = betWeekly.filter((g) => Number(g.fakeWin) > 0).length;

  const weeklyFakeWagered = betWeekly.reduce(
    (sum, g) => sum + Number(g.fakeBet || 0),
    0
  );

  const weeklyFakeWon = betWeekly.reduce(
    (sum, g) => sum + Number(g.fakeWin || 0),
    0
  );

  const weeklyRoi =
    weeklyFakeWagered > 0
      ? (weeklyFakeWon / weeklyFakeWagered) * 100 - 100
      : 0;

  const weeklySummary = {
    sampleSize: weeklySampleSize,
    bbmiWinPct:
      weeklySampleSize > 0
        ? ((weeklyWins / weeklySampleSize) * 100).toFixed(1)
        : "0",
    fakeWagered: weeklyFakeWagered,
    fakeWon: weeklyFakeWon,
    roi: weeklyRoi.toFixed(1),
  };

  const weeklyBbmiBeatsVegasColor =
    Number(weeklySummary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";

  const weeklyFakeWonColor =
    weeklySummary.fakeWon > weeklySummary.fakeWagered
      ? "#16a34a"
      : "#dc2626";

  const weeklyRoiColor =
    Number(weeklySummary.roi) > 0 ? "#16a34a" : "#dc2626";

  // --- Sorting ---
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({
    key: "date",
    direction: "asc",
  });

  const handleSort = (columnKey: SortKey) => {
    setSortConfig((prev) => ({
      key: columnKey,
      direction:
        prev.key === columnKey && prev.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  const historicalWithComputed = filteredHistorical.map((g) => ({
    ...g,
    actualHomeLine:
      (g.actualAwayScore ?? 0) - (g.actualHomeScore ?? 0),
    result:
      Number(g.fakeBet) > 0
        ? Number(g.fakeWin) > 0
          ? "win"
          : "loss"
        : "",
  }));

  const sortedHistorical = useMemo(() => {
    const sorted = [...historicalWithComputed];

    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc"
          ? aVal - bVal
          : bVal - aVal;
      }

      const cmp = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [historicalWithComputed, sortConfig]);

  // --- Components ---
  const SortableHeader = ({
    label,
    columnKey,
    className,
    headerClass,
  }: {
    label: React.ReactNode;
    columnKey: SortKey;
    className?: string;
    headerClass?: string;
  }) => (
    <th
      onClick={() => handleSort(columnKey)}
      className={`cursor-pointer bg-white px-2 py-2 border-b border-stone-100 text-center align-top ${
        className ?? ""
      }`}
    >
      <div className="flex flex-col items-center">
        <span
          className={
            headerClass ??
            "text-xs font-bold uppercase tracking-wider text-stone-500"
          }
        >
          {label}
        </span>
        {sortConfig.key === columnKey && (
          <span className="text-[10px]">
            {sortConfig.direction === "asc" ? " ▲" : " ▼"}
          </span>
        )}
      </div>
    </th>
  );

  const HorizontalSummaryTable = ({
    data,
    colors,
    title,
  }: {
    data: any;
    colors: any;
    title: string;
  }) => (
    <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
      <div className="summary-header bg-stone-900 text-white p-2 text-center font-bold uppercase tracking-widest text-sm">
        {title}
      </div>
      <div className="bg-white overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/50">
              <th className="px-4 py-3 text-[10px] md:text-xs uppercase tracking-wider text-stone-500 font-bold text-center">
                Sample Size
              </th>
              <th className="px-4 py-3 text-[10px] md:text-xs uppercase tracking-wider text-stone-500 font-bold text-center">
                % Beats Vegas
              </th>
              <th className="px-4 py-3 text-[10px] md:text-xs uppercase tracking-wider text-stone-500 font-bold text-center">
                Wagered
              </th>
              <th className="px-4 py-3 text-[10px] md:text-xs uppercase tracking-wider text-stone-500 font-bold text-center">
                Won
              </th>
              <th className="px-4 py-3 text-[10px] md:text-xs uppercase tracking-wider text-stone-500 font-bold text-center">
                ROI
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-6 text-xl md:text-3xl font-bold text-center">
                {data.sampleSize.toLocaleString()}
              </td>
              <td
                className="px-4 py-6 text-xl md:text-3xl font-bold text-center"
                style={{ color: colors.winPct }}
              >
                {data.bbmiWinPct}%
              </td>
              <td
                className="px-4 py-6 text-xl md:text-3xl font-bold text-center"
                style={{ color: "#dc2626" }}
              >
                ${data.fakeWagered.toLocaleString()}
              </td>
              <td
                className="px-4 py-6 text-xl md:text-3xl font-bold text-center"
                style={{ color: colors.won }}
              >
                ${data.fakeWon.toLocaleString()}
              </td>
              <td
                className="px-4 py-6 text-xl md:text-3xl font-bold text-center"
                style={{ color: colors.roi }}
              >
                {data.roi}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="section-wrapper bg-stone-50 min-h-screen">
      <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
        <div className="mt-10 flex flex-col items-center mb-8">
          <BBMILogo />
          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
            <LogoBadge league="ncaa" />
            <span> Men's Picks Model Accuracy</span>
          </h1>
          <p className="text-stone-700 text-sm tracking-tight">
            Weekly comparison of BBMI model vs Vegas lines
          </p>
        </div>

        <HorizontalSummaryTable
          title="Summary Metrics"
          data={summary}
          colors={{
            winPct: bbmiBeatsVegasColor,
            won: fakeWonColor,
            roi: roiColor,
          }}
        />

        <div className="flex flex-col items-center mb-6">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Historical Results By Week
          </h2>

          <select
            className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            {availableWeeks.map((weekStart) => {
              const start = new Date(weekStart);
              const end = new Date(start);
              end.setDate(start.getDate() + 6);

              const label = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

              return (
                <option key={weekStart} value={weekStart}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <HorizontalSummaryTable
          title="Weekly Summary"
          data={weeklySummary}
          colors={{
            winPct: weeklyBbmiBeatsVegasColor,
            won: weeklyFakeWonColor,
            roi: weeklyRoiColor,
          }}
        />

        {/* --- Historical Table --- */}
        <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr>
                  <SortableHeader label="Date" columnKey="date" />
                  <SortableHeader label="Away" columnKey="away" />
                  <SortableHeader label="Home" columnKey="home" />
                  <SortableHeader
                    label={
                      <>
                        Vegas
                        <br />
                        Line
                      </>
                    }
                    columnKey="vegasHomeLine"
                  />
                  <SortableHeader
                    label={
                      <>
                        BBMI
                        <br />
                        Line
                      </>
                    }
                    columnKey="bbmiHomeLine"
                  />
                  <SortableHeader
                    label={
                      <>
                        Actual
                        <br />
                        Line
                      </>
                    }
                    columnKey="actualHomeLine"
                  />
                  <SortableHeader
                    label="Away Score"
                    columnKey="actualAwayScore"
                  />
                  <SortableHeader
                    label="Home Score"
                    columnKey="actualHomeScore"
                  />
                  <SortableHeader label="Bet" columnKey="fakeBet" />
                  <SortableHeader label="Win" columnKey="fakeWin" />
                  <SortableHeader label="Result" columnKey="result" />
                </tr>
              </thead>

              <tbody>
                {sortedHistorical.map((g, i) => (
                  <tr
                    key={i}
                    className={
                      i % 2 === 0 ? "bg-stone-50/40" : "bg-white"
                    }
                  >
                    <td className="px-2 py-2 text-xs border-t border-stone-100">
                      {g.date}
                    </td>
                    <td className="px-2 py-2 text-sm border-t border-stone-100">
                      {g.away}
                    </td>
                    <td className="px-2 py-2 text-sm border-t border-stone-100">
                      {g.home}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100">
                      {g.vegasHomeLine}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100">
                      {g.bbmiHomeLine}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100 font-semibold">
                      {g.actualHomeLine}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100">
                      {g.actualAwayScore}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100">
                      {g.actualHomeScore}
                    </td>
                    <td className="text-right px-2 py-2 border-t border-stone-100">
                      ${g.fakeBet}
                    </td>

                    <td
                      className="text-right px-2 py-2 border-t font-medium"
                      style={{
                        color:
                          Number(g.fakeWin) > 0
                            ? "#16a34a"
                            : "#dc2626",
                        borderTop: "1px solid black",
                      }}
                    >
                      ${g.fakeWin}
                    </td>

                    <td className="text-center px-2 py-2 border-t border-stone-100">
                      {g.result === "win" ? (
                        <span
                          style={{
                            color: "#16a34a",
                            fontWeight: 900,
                            fontSize: "1.25rem",
                          }}
                        >
                          ✔
                        </span>
                      ) : g.result === "loss" ? (
                        <span
                          style={{
                            color: "#dc2626",
                            fontWeight: 900,
                            fontSize: "1.25rem",
                          }}
                        >
                          ✘
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-500 mt-8 text-center max-w-[600px] mx-auto">
          This page is for entertainment purposes only. Not intended for
          real-world gambling.
        </p>
      </div>
    </div>
  );
}