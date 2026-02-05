"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
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
  | "vegaswinprob"
  | "edge";

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

  // Get historical games for win percentage calculation
  const historicalGames = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  // Edge filter state
  const [minEdge, setMinEdge] = useState<number>(0);

  // Generate edge threshold options (0, 0.5, 1.0, ..., 10.0)
  const edgeOptions = useMemo(() => {
    const options = [0];
    for (let i = 0.5; i <= 10; i += 0.5) {
      options.push(i);
    }
    return options;
  }, []);

  // Calculate historical win percentage at selected edge
  const historicalStats = useMemo(() => {
    const edgeFilteredHistorical = historicalGames.filter((g) => {
      const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      return minEdge === 0 ? true : edge >= minEdge;
    });

    const bets = edgeFilteredHistorical.filter((g) => Number(g.fakeBet || 0) > 0);
    const wins = bets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    
    const wagered = bets.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
    const won = bets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const roi = wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0";
    
    return {
      total: bets.length,
      wins: wins,
      winPct: bets.length > 0 ? ((wins / bets.length) * 100).toFixed(1) : "0",
      roi: roi,
      roiPositive: Number(roi) > 0
    };
  }, [historicalGames, minEdge]);

  // Apply edge filter to upcoming games
  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return upcomingGames;
    
    return upcomingGames.filter((g) => {
      const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      return edge >= minEdge;
    });
  }, [upcomingGames, minEdge]);

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

  const upcomingWithComputed = edgeFilteredGames.map((g) => ({
    ...g,
    bbmiPick:
      g.bbmiHomeLine == null || g.vegasHomeLine == null
        ? ""
        : g.bbmiHomeLine === g.vegasHomeLine
        ? ""
        : g.bbmiHomeLine > g.vegasHomeLine
        ? g.away
        : g.home,
    edge: Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)),
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

          {/* EDGE FILTER DROPDOWN */}
          <div className="flex flex-col items-center gap-3 mb-8">
            <label htmlFor="edge-filter" className="text-sm font-semibold text-stone-700">
              Minimum Edge (|BBMI Line - Vegas Line|):
            </label>
            <select
              id="edge-filter"
              className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none"
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
            >
              {edgeOptions.map((edge) => (
                <option key={edge} value={edge}>
                  {edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-600">
              Showing {sortedUpcoming.length} of {upcomingGames.length} games
            </p>
            
            {/* Historical Win Percentage Message */}
            {minEdge === 0 ? (
              <div className="rankings-table mt-4 overflow-hidden border border-stone-200 rounded-xl shadow-md max-w-3xl">
                <div style={{ 
                  background: 'hsl(210 30% 12%)',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  letterSpacing: '0.05em'
                }}>
                  HISTORICAL PERFORMANCE (ALL GAMES)
                </div>
                <div className="bg-white px-6 py-4">
                  <p className="text-sm text-stone-700 text-center leading-relaxed">
                    BBMI has beaten Vegas on{" "}
                    <span className="font-bold text-stone-900">{historicalStats.winPct}%</span> of{" "}
                    <span className="font-semibold text-stone-900">{historicalStats.total.toLocaleString()}</span> historical bets
                    {" with an ROI of "}
                    <span className="font-bold" style={{ color: historicalStats.roiPositive ? "#16a34a" : "#dc2626" }}>
                      {historicalStats.roi}%
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="rankings-table mt-4 overflow-hidden border border-stone-200 rounded-xl shadow-md max-w-3xl">
                <div style={{ 
                  background: 'hsl(210 30% 12%)',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  textAlign: 'center',
                  letterSpacing: '0.05em'
                }}>
                  HISTORICAL PERFORMANCE (EDGE ≥ {minEdge.toFixed(1)})
                </div>
                <div className="bg-white px-6 py-4">
                  <p className="text-sm text-stone-700 text-center leading-relaxed">
                    BBMI has beaten Vegas on{" "}
                    <span className="font-bold text-stone-900">{historicalStats.winPct}%</span> of{" "}
                    <span className="font-semibold text-stone-900">{historicalStats.total.toLocaleString()}</span> historical bets at this edge
                    {" with an ROI of "}
                    <span className="font-bold" style={{ color: historicalStats.roiPositive ? "#16a34a" : "#dc2626" }}>
                      {historicalStats.roi}%
                    </span>
                  </p>
                </div>
              </div>
            )}
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
                      label="Edge"
                      columnKey="edge"
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
                        colSpan={9}
                        className="text-center py-6 text-stone-500"
                      >
                        No games match the selected edge filter.
                      </td>
                    </tr>
                  )}

                  {sortedUpcoming.map((g, i) => (
                    <tr key={i} className="bg-white border-b border-stone-200">
                      <td className="px-3 py-2 whitespace-nowrap w-[120px]">
                        {g.date}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(String(g.away))}`}
                          className="hover:underline cursor-pointer"
                        >
                          {g.away}
                        </Link>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(String(g.home))}`}
                          className="hover:underline cursor-pointer"
                        >
                          {g.home}
                        </Link>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.vegasHomeLine}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.bbmiHomeLine}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">
                        {g.edge.toFixed(1)}
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                        {g.bbmiPick && (
                          <Link
                            href={`/ncaa-team/${encodeURIComponent(String(g.bbmiPick))}`}
                            className="hover:underline cursor-pointer"
                          >
                            {g.bbmiPick}
                          </Link>
                        )}
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
