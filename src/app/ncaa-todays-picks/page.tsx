"use client";

import { useState, useMemo, useEffect } from "react";
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
  vegaswinprob: number | null;
};

type SortableKeyUpcoming =
  | "bbmiPick"
  | "date"
  | "away"
  | "home"
  | "vegasHomeLine"
  | "bbmiHomeLine"
  | "bbmiWinProb"
  | "vegaswinprob";

/* ---------------------------------------------
   SORTABLE HEADER COMPONENT (MOVED OUTSIDE)
---------------------------------------------- */
function SortableHeader({
  label,
  columnKey,
  sortConfig,
  handleSort,
}: {
  label: string;
  columnKey: SortableKeyUpcoming;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
}) {
  const isActive = sortConfig.key === columnKey;
  const direction = sortConfig.direction;

  return (
    <th
      onClick={() => handleSort(columnKey)}
      className="cursor-pointer select-none px-3 py-2 whitespace-nowrap text-center bg-[#0a1a2f] text-white"
    >
      <div className="flex items-center justify-center gap-1">
        {label}
        {isActive && (
          <span className="text-xs">{direction === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );
}

/* ---------------------------------------------
   MAIN PAGE COMPONENT
---------------------------------------------- */
export default function BettingLinesPage() {
  // JSON-LD injection
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI Today's Picks – NCAA Betting Lines & Predictions",
      description:
        "Live NCAA basketball betting lines, BBMI model picks, and win probabilities for today's games.",
      url: "https://bbmihoops.com/ncaa-todays-picks",
      dateModified: "2025-01-01",
    });
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  const upcomingGames: UpcomingGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore === 0 ||
      g.actualHomeScore == null ||
      g.actualAwayScore == null
  );

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

  const sortedUpcoming = useMemo(() => {
    const sorted = [...upcomingWithComputed];

    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

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

  return (
    <>
      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">
          {/* Header */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <BBMILogo />
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>Men's Picks for Today</span>
            </h1>
          </div>

          {/* Upcoming Games */}
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Upcoming Games
          </h2>

          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll max-h-[600px] overflow-y-auto overflow-x-auto">
              <table className="min-w-[1000px] w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <th colSpan={5} className="px-3 py-2"></th>
                    <th className="px-3 py-2"></th>
                    <th
                      colSpan={2}
                      className="px-3 py-2 text-center font-semibold"
                    >
                      Money Line Home Win %
                    </th>
                  </tr>

                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader
                      label="Date"
                      columnKey="date"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="Away Team"
                      columnKey="away"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="Home Team"
                      columnKey="home"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="Vegas Home Line"
                      columnKey="vegasHomeLine"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="BBMI Home Line"
                      columnKey="bbmiHomeLine"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="BBMI Pick"
                      columnKey="bbmiPick"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="BBMI"
                      columnKey="bbmiWinProb"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="Vegas"
                      columnKey="vegaswinprob"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                  </tr>
                </thead>

                <tbody>
                  {sortedUpcoming.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-6 text-stone-500"
                      >
                        No upcoming games.
                      </td>
                    </tr>
                  )}

                  {sortedUpcoming.map((g, i) => (
                    <tr key={i} className="bg-white border-b border-stone-200">
                      <td className="px-3 py-2 whitespace-nowrap w-[120px]">
                        {g.date}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">{g.away}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{g.home}</td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.vegasHomeLine}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.bbmiHomeLine}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.bbmiPick}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.bbmiWinProb == null
                          ? "—"
                          : (g.bbmiWinProb * 100).toFixed(1)}
                        %
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.vegaswinprob == null
                          ? "—"
                          : (g.vegaswinprob * 100).toFixed(1)}
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
    </>
  );
}