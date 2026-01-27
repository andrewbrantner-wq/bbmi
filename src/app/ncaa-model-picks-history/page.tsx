"use client";

import React from "react";
import { useState, useMemo } from "react";
import games from "@/data/betting-lines/games.json";
import BBMILogo from "@/components/BBMILogo";

console.log(
  "Bad rows:",
  games.filter(
    (g) =>
      g.date === null ||
      g.away === null ||
      g.home === null ||
      typeof g.away === "number" ||
      typeof g.home === "number"
  )
);

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

export default function BettingLinesPage() {
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  const upcomingGames: UpcomingGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore === 0 ||
      g.actualHomeScore === null ||
      g.actualHomeScore === undefined ||
      g.actualAwayScore === null ||
      g.actualAwayScore === undefined
  );

  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualHomeScore !== undefined &&
      g.actualAwayScore !== null &&
      g.actualAwayScore !== undefined &&
      g.actualHomeScore !== 0
  );

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

  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 - 100 : 0;

  const summary = {
    sampleSize,
    bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0",
    fakeWagered,
    fakeWon,
    roi: roi.toFixed(1),
  };

  const bbmiBeatsVegasColor =
    Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";
  const fakeWageredColor = "#dc2626";
  const fakeWonColor =
    summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626";
  const roiColor = Number(summary.roi) > 0 ? "#16a34a" : "#dc2626";

  const availableDates = useMemo(() => {
    const set = new Set(
      historicalGames
        .map((g) => g.date)
        .filter((d): d is string => typeof d === "string")
    );
    return Array.from(set).sort().reverse();
  }, [historicalGames]);

  const [selectedDate, setSelectedDate] = useState<string>(
    availableDates.length > 0 ? availableDates[0] ?? "" : ""
  );

  const filteredHistorical = useMemo(() => {
    return historicalGames.filter((g) => g.date === selectedDate);
  }, [historicalGames, selectedDate]);

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
    dailyFakeWagered > 0 ? (dailyFakeWon / dailyFakeWagered) * 100 - 100 : 0;

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
    Number(dailySummary.roi) > 0 ? "#16a34a" : "#dc2626";

  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "asc",
  });

  const handleSort = (columnKey: string) => {
    setSortConfig((prev) => {
      if (prev.key === columnKey) {
        return {
          key: columnKey,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key: columnKey, direction: "asc" };
    });
  };

  const historicalWithComputed = filteredHistorical.map((g) => {
    const actualHomeLine =
      (g.actualAwayScore ?? 0) - (g.actualHomeScore ?? 0);

    const result =
      Number(g.fakeBet) > 0
        ? Number(g.fakeWin) > 0
          ? "win"
          : "loss"
        : "";

    return {
      ...g,
      games: `${g.away} @ ${g.home}`,
      actualHomeLine,
      result,
    };
  });

  const sortedHistorical = useMemo(() => {
    const sorted = [...historicalWithComputed];

    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a];
      const bVal = b[sortConfig.key as keyof typeof b];

      if (sortConfig.key === "result") {
        const order: Record<string, number> = { win: 3, loss: 2, "": 1 };

        const aKey = typeof aVal === "string" ? aVal : "";
        const bKey = typeof bVal === "string" ? bVal : "";

        const aOrder = order[aKey] ?? 0;
        const bOrder = order[bKey] ?? 0;

        return sortConfig.direction === "asc"
          ? bOrder - aOrder
          : aOrder - bOrder;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    return sorted;
  }, [historicalWithComputed, sortConfig]);

  // -------------------------------------------------------
  // SortableHeader accepts ReactNode for label and optional headerClass
  // -------------------------------------------------------
  type SortableHeaderProps = {
    label: React.ReactNode;
    columnKey: string;
    className?: string;
    headerClass?: string; // controls header text size/weight independently
  };

  const SortableHeader = ({
    label,
    columnKey,
    className,
    headerClass,
  }: SortableHeaderProps) => {
    const isActive = sortConfig.key === columnKey;
    const direction = sortConfig.direction;

    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`
          cursor-pointer select-none bg-white z-30
          whitespace-normal break-words
          px-2 py-1 text-center align-top
          ${className ?? ""}
        `}
      >
        <div className="flex flex-col items-center leading-tight">
          {/* headerClass controls font size; default is text-base to match original */}
          <span className={`${headerClass ?? "text-base font-semibold"} text-center`}>
            {label}
          </span>

          {isActive && (
            <span className="text-[10px] mt-0.5" aria-hidden>
              {direction === "asc" ? "▲" : "▼"}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight">
            NCAA | Picks Model Accuracy
          </h1>
          <p className="text-stone-700 text-sm tracking-tight">
            Daily comparison of BBMI model vs Vegas lines
          </p>
        </div>

        {/* Summary */}
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

        {/* Date Selector */}
        <h2 className="text-xl font-semibold tracking-tight text-center mb-3">
          Historical Results By Day
        </h2>

        <div className="mb-4 flex justify-center">
          <select
            className="border border-stone-300 rounded-md px-3 py-2 text-base"
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

        {/* Daily Summary */}
        <div className="rankings-table mb-12">
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

        {/* spacer: guaranteed visual gap between Daily Summary and Historical Results */}
        <div style={{ height: "1.5rem" }} aria-hidden />

        {/* ----------------------------------------------------
            HISTORICAL RESULTS TABLE — ONLY SELECT HEADERS WRAP
           ---------------------------------------------------- */}
        <div className="rankings-table" style={{ paddingTop: "1.5rem" }}>
          <div className="rankings-scroll max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr>
                  <SortableHeader label="Date" columnKey="date" />
                  <SortableHeader label="Away Team" columnKey="away" />
                  <SortableHeader label="Home Team" columnKey="home" />

                  {/* WRAPPED HEADERS: explicit break and restored font size */}
                  <SortableHeader
                    label={
                      <>
                        Vegas Home
                        <br />
                        Line
                      </>
                    }
                    columnKey="vegasHomeLine"
                    className="w-[80px]"
                    headerClass="text-sm font-semibold"
                  />
                  <SortableHeader
                    label={
                      <>
                        BBMI Home
                        <br />
                        Line
                      </>
                    }
                    columnKey="bbmiHomeLine"
                    className="w-[80px]"
                    headerClass="text-sm font-semibold"
                  />
                  <SortableHeader
                    label={
                      <>
                        Actual Home
                        <br />
                        Line
                      </>
                    }
                    columnKey="actualHomeLine"
                    className="w-[80px]"
                    headerClass="text-sm font-semibold"
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
                {sortedHistorical.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      className="text-center py-6 text-stone-500"
                    >
                      No results for this date.
                    </td>
                  </tr>
                )}

                {sortedHistorical.map((g, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                  >
                    <td className="bg-white z-10 w-[120px] min-w-[120px] px-2 py-1">
                      {g.date}
                    </td>

                    <td className="px-2 py-1">{g.away}</td>
                    <td className="px-2 py-1">{g.home}</td>

                    <td className="text-right px-2 py-1">{g.vegasHomeLine}</td>
                    <td className="text-right px-2 py-1">{g.bbmiHomeLine}</td>
                    <td className="text-right px-2 py-1">{g.actualHomeLine}</td>

                    <td className="text-right px-2 py-1">
                      {g.actualAwayScore}
                    </td>
                    <td className="text-right px-2 py-1">
                      {g.actualHomeScore}
                    </td>
                    <td className="text-right px-2 py-1">{g.fakeBet}</td>
                    <td className="text-right px-2 py-1">{g.fakeWin}</td>

                    <td className="text-center px-2 py-1">
                      {g.result === "win" ? (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          ✔
                        </span>
                      ) : g.result === "loss" ? (
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>
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

        <p className="text-xs text-stone-500 mt-8 text-center max-w-[600px] mx-auto leading-snug">
          This page is for entertainment and informational purposes only. It is
          not intended for real-world gambling or wagering.
        </p>
      </div>
    </div>
  );
}

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