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

  // --- Date Selection ---
  const availableDates = useMemo(() => {
    const set = new Set(
      historicalGames
        .map((g) => g.date)
        .filter((d): d is string => typeof d === "string")
    );
    return Array.from(set).sort().reverse();
  }, [historicalGames]);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates[0] ?? ""
  );

  const filteredHistorical = useMemo(
    () => historicalGames.filter((g) => g.date === selectedDate),
    [historicalGames, selectedDate]
  );

  // --- Daily Summary ---
  const betDaily = filteredHistorical.filter((g) => Number(g.fakeBet) > 0);
  const dailySampleSize = betDaily.length;
  const dailyWins = betDaily.filter((g) => Number(g.fakeWin) > 0).length;
  const dailyFakeWagered = betDaily.reduce(
    (sum, g) => sum + Number(g.fakeBet || 0),
    0
  );
  const dailyFakeWon = betDaily.reduce(
    (sum, g) => sum + Number(g.fakeWin || 0),
    0
  );
  const dailyRoi =
    dailyFakeWagered > 0
      ? (dailyFakeWon / dailyFakeWagered) * 100 - 100
      : 0;

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
  const dailyFakeWonColor =
    dailySummary.fakeWon > dailySummary.fakeWagered
      ? "#16a34a"
      : "#dc2626";
  const dailyRoiColor =
    Number(dailySummary.roi) > 0 ? "#16a34a" : "#dc2626";

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

      // Handle nulls
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Numeric sort
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc"
          ? aVal - bVal
          : bVal - aVal;
      }

      // String sort
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
            Daily comparison of BBMI model vs Vegas lines
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
            Historical Results By Day
          </h2>
          <select
            className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none"
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

        <HorizontalSummaryTable
          title="Daily Summary"
          data={dailySummary}
          colors={{
            winPct: dailyBbmiBeatsVegasColor,
            won: dailyFakeWonColor,
            roi: dailyRoiColor,
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
                      className="text-right px-2 py-2 border-t border-stone-100 font-medium"
                      style={{
                        color:
                          Number(g.fakeWin) > 0
                            ? "#16a34a"
                            : "#dc2626",
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