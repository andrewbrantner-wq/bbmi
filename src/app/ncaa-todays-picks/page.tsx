"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import { AuthProvider, useAuth } from "../AuthContext";
import ProtectedRoute from "../ProtectedRoute";

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
   SORTABLE HEADER COMPONENT
---------------------------------------------- */
function SortableHeader({
  label,
  columnKey,
  sortConfig,
  handleSort,
  rowSpan,
}: {
  label: string;
  columnKey: SortableKeyUpcoming;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
  rowSpan?: number;
}) {
  const isActive = sortConfig.key === columnKey;
  const direction = sortConfig.direction;

  return (
    <th
      onClick={() => handleSort(columnKey)}
      className="cursor-pointer select-none px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white"
      rowSpan={rowSpan}
      style={{ textAlign: 'center' }}
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
   INNER COMPONENT (THE ACTUAL PAGE CONTENT)
---------------------------------------------- */
function BettingLinesPageContent() {
  const { user } = useAuth();

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
    (g) => {
      // Include games with no scores (upcoming games)
      const hasNoScore = g.actualHomeScore === 0 ||
                        g.actualHomeScore == null ||
                        g.actualAwayScore == null;
      
      return hasNoScore;
    }
  );

  // Get historical games for win percentage calculation
  const historicalGames = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  // Calculate each team's record when BBMI picks them to beat Vegas
  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    
    historicalGames.forEach((g) => {
      // Only count games where there was a bet
      if (Number(g.fakeBet || 0) <= 0) return;
      
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      
      // Skip if lines are equal (no pick)
      if (vegasLine === bbmiLine) return;
      
      // Determine which team BBMI picked
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      
      // Initialize record if needed
      if (!records[pickedTeam]) {
        records[pickedTeam] = { wins: 0, picks: 0 };
      }
      
      // Increment picks
      records[pickedTeam].picks++;
      
      // Check if the pick won (fakeWin > 0)
      if (Number(g.fakeWin || 0) > 0) {
        records[pickedTeam].wins++;
      }
    });
    
    return records;
  }, [historicalGames]);

  // Helper to get team's BBMI pick record
  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    
    const winPct = ((record.wins / record.picks) * 100).toFixed(0);
    return {
      wins: record.wins,
      picks: record.picks,
      winPct: winPct,
      display: `${record.wins}-${record.picks - record.wins}`,
      color: record.wins / record.picks >= 0.5 ? '#16a34a' : '#dc2626'
    };
  };

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
            
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>Men's Picks</span>
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

          <p className="text-xs text-stone-600 mb-3 text-center italic">
            Team records shown below team names indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>

          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll max-h-[1400px] overflow-y-auto overflow-x-auto">
              <table className="min-w-[1000px] w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  {/* First header row */}
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader
                      label="Date"
                      columnKey="date"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      rowSpan={2}
                    />
                    <SortableHeader
                      label="Away Team"
                      columnKey="away"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      rowSpan={2}
                    />
                    <SortableHeader
                      label="Home Team"
                      columnKey="home"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      rowSpan={2}
                    />
                    {/* Merged "Home Line" header */}
                    <th
                      colSpan={2}
                      className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white"
                      style={{ 
                        textAlign: 'center'
                      }}
                    >
                      <div className="flex items-center justify-center text-xs font-semibold">
                        Home Line
                      </div>
                    </th>
                    <SortableHeader
                      label="Edge"
                      columnKey="edge"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      rowSpan={2}
                    />
                    <SortableHeader
                      label="BBMI Pick"
                      columnKey="bbmiPick"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                      rowSpan={2}
                    />
                    {/* Merged "Money Line Home Win %" header */}
                    <th
                      colSpan={2}
                      className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white"
                      style={{ 
                        textAlign: 'center'
                      }}
                    >
                      <div className="flex items-center justify-center text-xs font-semibold">
                        Money Line Home Win %
                      </div>
                    </th>
                  </tr>

                  {/* Second header row - sub-columns only */}
                  <tr className="bg-[#0a1a2f] text-white text-sm" style={{ position: 'sticky', top: '39px', zIndex: 20 }}>
                    <SortableHeader
                      label="Vegas"
                      columnKey="vegasHomeLine"
                      sortConfig={sortConfig}
                      handleSort={handleSort}
                    />
                    <SortableHeader
                      label="BBMI"
                      columnKey="bbmiHomeLine"
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
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={String(g.away)} size={24} />
                          <div className="flex flex-col">
                            <span>{g.away}</span>
                            {(() => {
                              const record = getTeamRecord(String(g.away));
                              return record ? (
                                <span 
                                  className="text-[10px] font-semibold"
                                  style={{ color: record.color }}
                                  title={`${record.winPct}% when BBMI picks them`}
                                >
                                  {record.display}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </Link>
                      </td>

                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(String(g.home))}`}
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={String(g.home)} size={24} />
                          <div className="flex flex-col">
                            <span>{g.home}</span>
                            {(() => {
                              const record = getTeamRecord(String(g.home));
                              return record ? (
                                <span 
                                  className="text-[10px] font-semibold"
                                  style={{ color: record.color }}
                                  title={`${record.winPct}% when BBMI picks them`}
                                >
                                  {record.display}
                                </span>
                              ) : null;
                            })()}
                          </div>
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
                            className="hover:underline cursor-pointer flex items-center justify-end gap-2"
                          >
                            <NCAALogo teamName={String(g.bbmiPick)} size={20} />
                            <span>{g.bbmiPick}</span>
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

          
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------
   MAIN EXPORTED COMPONENT (WRAPPED WITH AUTH)
---------------------------------------------- */
export default function BettingLinesPage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <BettingLinesPageContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
