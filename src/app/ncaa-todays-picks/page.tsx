"use client";

import { useState, useMemo } from "react";
import games from "@/data/betting-lines/games.json";
import BBMILogo from "@/components/BBMILogo";

type UpcomingGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
};

type SortableKeyUpcoming =
  | "bbmiPick"
  | "date"
  | "away"
  | "home"
  | "vegasHomeLine"
  | "bbmiHomeLine"
  | "bbmiWinProb";

export default function BettingLinesPage() {
  // Clean rows
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  // Upcoming = no scores yet
  const upcomingGames: UpcomingGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore === 0 ||
      g.actualHomeScore === null ||
      g.actualHomeScore === undefined ||
      g.actualAwayScore === null ||
      g.actualAwayScore === undefined
  );

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKeyUpcoming;
    direction: "asc" | "desc";
  }>({
    key: "date",
    direction: "asc",
  });

  const handleSort = (columnKey: SortableKeyUpcoming) => {
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

  // Add computed fields
  const upcomingWithComputed = upcomingGames.map((g) => ({
    ...g,
    bbmiPick:
      g.bbmiHomeLine == null || g.vegasHomeLine == null
        ? ""
        : g.bbmiHomeLine === g.vegasHomeLine
        ? ""
        : g.bbmiHomeLine > g.vegasHomeLine
        ? g.away
        : g.home,
  }));

  // Sorting logic
  const sortedUpcoming = useMemo(() => {
    const sorted = [...upcomingWithComputed];

    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key as keyof typeof a];
      const bVal = b[sortConfig.key as keyof typeof b];

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
  }, [upcomingWithComputed, sortConfig]);

  // Sortable header
  const SortableHeader = ({
    label,
    columnKey,
  }: {
    label: string;
    columnKey: SortableKeyUpcoming;
  }) => {
    const isActive = sortConfig.key === columnKey;
    const direction = sortConfig.direction;

    return (
      <th
        onClick={() => handleSort(columnKey)}
        className="cursor-pointer select-none bg-white z-30"
      >
        <div className="flex items-center justify-center gap-1">
          {label}
          {isActive && (
            <span className="text-xs">{direction === "asc" ? "▲" : "▼"}</span>
          )}
        </div>
      </th>
    );
  };

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
        <h2 className="text-xl font-semibold tracking-tight mb-3">
          Upcoming Games
        </h2>

        <div className="rankings-table mb-10">
          <div className="rankings-scroll max-h-[600px] overflow-y-auto overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-20">
                <tr>
                  <SortableHeader label="Date" columnKey="date" />
                  <SortableHeader label="Away Team" columnKey="away" />
                  <SortableHeader label="Home Team" columnKey="home" />
                  <SortableHeader
                    label="Vegas Home Line"
                    columnKey="vegasHomeLine"
                  />
                  <SortableHeader
                    label="BBMI Home Line"
                    columnKey="bbmiHomeLine"
                  />
                  <SortableHeader label="BBMI Pick" columnKey="bbmiPick" />
                  <SortableHeader
                    label="BBMI Home Win %"
                    columnKey="bbmiWinProb"
                  />
                </tr>
              </thead>

              <tbody>
                {sortedUpcoming.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-6 text-stone-500"
                    >
                      No upcoming games.
                    </td>
                  </tr>
                )}

                {sortedUpcoming.map((g, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                  >
                    <td className="bg-white z-10 w-[120px] min-w-[120px]">
                      {g.date}
                    </td>

                    <td>{g.away}</td>
                    <td>{g.home}</td>
                    <td className="text-right">{g.vegasHomeLine}</td>
                    <td className="text-right">{g.bbmiHomeLine}</td>
                    <td className="text-right">{g.bbmiPick}</td>

                    <td className="text-right">
                      {g.bbmiWinProb == null
                        ? "—"
                        : (g.bbmiWinProb * 100).toFixed(1)}
                      %
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