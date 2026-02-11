"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

/* -------------------------------------------------------
   TYPES
-------------------------------------------------------- */
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

type SummaryData = {
  sampleSize: number;
  bbmiWinPct: string;
  fakeWagered: number;
  fakeWon: number;
  roi: string;
};

type SummaryColors = {
  winPct: string;
  won: string;
  roi: string;
};

/* -------------------------------------------------------
   SORTABLE HEADER (OUTSIDE MAIN COMPONENT)
-------------------------------------------------------- */
function SortableHeader({
  label,
  columnKey,
  sortConfig,
  handleSort,
}: {
  label: React.ReactNode;
  columnKey: SortKey;
  sortConfig: { key: SortKey; direction: SortDirection };
  handleSort: (key: SortKey) => void;
}) {
  const isActive = sortConfig.key === columnKey;
  const direction = sortConfig.direction;

  return (
    <th
      onClick={() => handleSort(columnKey)}
      className="cursor-pointer select-none px-3 py-2 whitespace-nowrap text-center bg-[#0a1a2f] text-white"
    >
      <div className="flex flex-col items-center leading-tight">
        <span className="text-xs font-semibold tracking-wide">{label}</span>
        {isActive && (
          <span className="text-[10px]">
            {direction === "asc" ? "▲" : "▼"}
          </span>
        )}
      </div>
    </th>
  );
}

/* -------------------------------------------------------
   SUMMARY CARD (NAVY HEADER)
-------------------------------------------------------- */
function SummaryCard({
  title,
  data,
  colors,
}: {
  title: string;
  data: SummaryData;
  colors: SummaryColors;
}) {
  return (
    <div className="rankings-table mb-20 overflow-hidden border border-stone-200 rounded-md shadow-sm">
      <div className="bg-[#0a1a2f] text-white p-2 text-center font-bold uppercase tracking-widest text-sm">
        {title}
      </div>

      <div className="bg-white overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                Sample Size
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                % Beats Vegas
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                Wagered
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                Won
              </th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                ROI
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="px-4 py-10 text-2xl font-bold text-center">
                {data.sampleSize.toLocaleString()}
              </td>

              <td
                className="px-4 py-10 text-2xl font-bold text-center"
                style={{ color: colors.winPct }}
              >
                {data.bbmiWinPct}%
              </td>

              <td className="px-4 py-10 text-2xl font-bold text-center text-red-600">
                ${data.fakeWagered.toLocaleString()}
              </td>

              <td
                className="px-4 py-10 text-2xl font-bold text-center"
                style={{ color: colors.won }}
              >
                ${data.fakeWon.toLocaleString()}
              </td>

              <td
                className="px-4 py-6 text-2xl font-bold text-center"
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
}

/* -------------------------------------------------------
   MAIN PAGE
-------------------------------------------------------- */
export default function BettingLinesPage() {
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  // Edge filter state
  const [minEdge, setMinEdge] = useState<number>(0);

  // Team filter state
  const [teamSearch, setTeamSearch] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  // Generate edge threshold options (0, 0.5, 1.0, ..., 10.0)
  const edgeOptions = useMemo(() => {
    const options = [0];
    for (let i = 0.5; i <= 10; i += 0.5) {
      options.push(i);
    }
    return options;
  }, []);

  // Get unique team list from all games
  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    historicalGames.forEach((g) => {
      if (g.away) teams.add(String(g.away));
      if (g.home) teams.add(String(g.home));
    });
    return Array.from(teams).sort();
  }, [historicalGames]);

  // Filter teams based on search input
  const filteredTeams = useMemo(() => {
    if (!teamSearch) return [];
    const search = teamSearch.toLowerCase();
    return allTeams.filter((team) =>
      team.toLowerCase().includes(search)
    ).slice(0, 10); // Limit to 10 suggestions
  }, [teamSearch, allTeams]);

  // Apply edge filter to historical games
  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return historicalGames;
    
    return historicalGames.filter((g) => {
      const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      return edge >= minEdge;
    });
  }, [historicalGames, minEdge]);

  // Apply team filter on top of edge filter
  const teamAndEdgeFilteredGames = useMemo(() => {
    if (!selectedTeam) return edgeFilteredGames;
    
    return edgeFilteredGames.filter((g) => 
      String(g.away) === selectedTeam || String(g.home) === selectedTeam
    );
  }, [edgeFilteredGames, selectedTeam]);

  const betHistorical = teamAndEdgeFilteredGames.filter((g) => Number(g.fakeBet) > 0);

  /* ---------------- GLOBAL SUMMARY (WITH FILTERS) ---------------- */
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

  const summary: SummaryData = {
    sampleSize,
    bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0",
    fakeWagered,
    fakeWon,
    roi: roi.toFixed(1),
  };

  const bbmiBeatsVegasColor =
    Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";

  const fakeWonColor =
    summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626";

  const roiColor = Number(summary.roi) > 0 ? "#16a34a" : "#dc2626";

  /* ---------------- WEEKLY GROUPING - SIMPLE APPROACH ---------------- */
  // Get all unique dates, sorted
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const g of teamAndEdgeFilteredGames) {
      if (g.date) {
        const dateStr = g.date.split('T')[0].split(' ')[0];
        dates.add(dateStr);
      }
    }
    return Array.from(dates).sort();
  }, [teamAndEdgeFilteredGames]);

  // Create 7-day chunks starting from earliest date - only include if they have games
  const weekRanges = useMemo(() => {
    if (allDates.length === 0) return [];
    
    const ranges: Array<{start: string, end: string}> = [];
    
    // Helper to add days to a date string
    const addDays = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    
    let currentStart = allDates[0];
    
    // Keep creating 7-day windows until we pass the last date
    while (currentStart <= allDates[allDates.length - 1]) {
      const currentEnd = addDays(currentStart, 6);
      
      // Check if this range has any games
      const hasGames = teamAndEdgeFilteredGames.some((g) => {
        if (!g.date) return false;
        const gameDateStr = g.date.split('T')[0].split(' ')[0];
        return gameDateStr >= currentStart && gameDateStr <= currentEnd;
      });
      
      if (hasGames) {
        ranges.push({ start: currentStart, end: currentEnd });
      }
      
      currentStart = addDays(currentStart, 7);
    }
    
    return ranges.reverse();
  }, [allDates, teamAndEdgeFilteredGames]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  // Simple filter: show only games within the selected date range
  const filteredHistorical = useMemo(() => {
    const range = weekRanges[selectedWeekIndex];
    if (!range) return [];
    
    return teamAndEdgeFilteredGames.filter((g) => {
      if (!g.date) return false;
      const gameDateStr = g.date.split('T')[0].split(' ')[0];
      return gameDateStr >= range.start && gameDateStr <= range.end;
    });
  }, [teamAndEdgeFilteredGames, weekRanges, selectedWeekIndex]);

  /* ---------------- WEEKLY SUMMARY ---------------- */
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

  const weeklySummary: SummaryData = {
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

  /* ---------------- TEAM PERFORMANCE ANALYSIS ---------------- */
  // Calculate performance by team
  const teamPerformance = useMemo(() => {
    const teamStats: Record<string, {
      games: number;
      wins: number;
      wagered: number;
      won: number;
    }> = {};

    betHistorical.forEach((g) => {
      const awayTeam = String(g.away);
      const homeTeam = String(g.home);
      const isWin = Number(g.fakeWin) > 0;
      const bet = Number(g.fakeBet || 0);
      const won = Number(g.fakeWin || 0);

      // Initialize teams if not present
      if (!teamStats[awayTeam]) {
        teamStats[awayTeam] = { games: 0, wins: 0, wagered: 0, won: 0 };
      }
      if (!teamStats[homeTeam]) {
        teamStats[homeTeam] = { games: 0, wins: 0, wagered: 0, won: 0 };
      }

      // Update stats for both teams
      teamStats[awayTeam].games++;
      teamStats[homeTeam].games++;
      
      if (isWin) {
        teamStats[awayTeam].wins++;
        teamStats[homeTeam].wins++;
      }

      teamStats[awayTeam].wagered += bet;
      teamStats[homeTeam].wagered += bet;
      teamStats[awayTeam].won += won;
      teamStats[homeTeam].won += won;
    });

    // Convert to array and calculate percentages
    const teamsArray = Object.entries(teamStats)
      .filter(([_, stats]) => stats.games >= 3) // Minimum 3 games
      .map(([team, stats]) => ({
        team,
        games: stats.games,
        winPct: (stats.wins / stats.games) * 100,
        roi: stats.wagered > 0 ? ((stats.won / stats.wagered) * 100 - 100) : 0,
        wagered: stats.wagered,
        won: stats.won,
      }));

    return teamsArray.sort((a, b) => b.winPct - a.winPct);
  }, [betHistorical]);

  const [showTopTeams, setShowTopTeams] = useState(true);
  const [teamReportSize, setTeamReportSize] = useState(10);

  const displayedTeams = useMemo(() => {
    if (showTopTeams) {
      return teamPerformance.slice(0, teamReportSize);
    } else {
      // Get the worst teams and reverse so worst is first
      return teamPerformance.slice(-teamReportSize).reverse();
    }
  }, [teamPerformance, showTopTeams, teamReportSize]);

  /* ---------------- SORTING ---------------- */
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
        prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc",
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

  // Handle team selection from suggestions
  const handleTeamSelect = (team: string) => {
    setSelectedTeam(team);
    setTeamSearch(team);
    setShowSuggestions(false);
  };

  // Handle clearing team filter
  const handleClearTeam = () => {
    setSelectedTeam("");
    setTeamSearch("");
  };

  /* -------------------------------------------------------
     RENDER
  -------------------------------------------------------- */
  return (
    <div className="section-wrapper bg-stone-50 min-h-screen">
      <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
        {/* HEADER */}
        <div className="mt-10 flex flex-col items-center mb-8">
          
          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
            <LogoBadge league="ncaa" className="h-8 mr-3" />
            <span>Men's Picks Model Accuracy</span>
          </h1>
          <p className="text-stone-700 text-sm tracking-tight">
            Weekly comparison of BBMI model vs Vegas lines
          </p>
        </div>

        {/* FILTERS SECTION */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-8 relative">
          {/* EDGE FILTER */}
          <div className="flex flex-col items-center gap-3">
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
          </div>

          {/* TEAM FILTER */}
          <div className="flex flex-col items-center gap-3">
            <label htmlFor="team-search" className="text-sm font-semibold text-stone-700">
              Filter by Team:
            </label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <input
                  id="team-search"
                  type="text"
                  placeholder="Search team name..."
                  className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none w-64"
                  value={teamSearch}
                  onChange={(e) => {
                    setTeamSearch(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) {
                      setSelectedTeam("");
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                />
                {selectedTeam && (
                  <button
                    onClick={handleClearTeam}
                    className="px-3 py-2 bg-stone-200 hover:bg-stone-300 rounded-md text-sm font-medium transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {/* Autocomplete suggestions */}
              {showSuggestions && filteredTeams.length > 0 && (
                <div 
                  className="absolute w-full mt-1 bg-white border-2 border-stone-400 rounded-md shadow-2xl max-h-60 overflow-y-auto"
                  style={{
                    zIndex: 999999,
                    backgroundColor: 'white'
                  }}
                >
                  {filteredTeams.map((team) => (
                    <div
                      key={team}
                      className="px-4 py-2 hover:bg-stone-100 cursor-pointer text-sm flex items-center gap-2"
                      style={{ backgroundColor: 'white' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f5f4')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      onClick={() => handleTeamSelect(team)}
                    >
                      <NCAALogo teamName={team} size={20} />
                      <span>{team}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected team indicator */}
        {selectedTeam && (
          <div className="flex justify-center mb-6">
            <div className="bg-[#0a1a2f] text-white px-4 py-2 rounded-md flex items-center gap-2">
              <NCAALogo teamName={selectedTeam} size={24} />
              <span className="font-semibold">Showing results for: {selectedTeam}</span>
            </div>
          </div>
        )}

        {/* GLOBAL SUMMARY */}
        <div className="w-full">
          <SummaryCard
            title={selectedTeam ? `Summary Metrics - ${selectedTeam}` : "Summary Metrics"}
            data={summary}
            colors={{
              winPct: bbmiBeatsVegasColor,
              won: fakeWonColor,
              roi: roiColor,
            }}
          />
        </div>

        {/* TEAM PERFORMANCE REPORT */}
        {!selectedTeam && teamPerformance.length > 0 && (
          <div className="w-full">
            <div className="rankings-table mb-20 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="bg-[#0a1a2f] text-white p-2 text-center font-bold uppercase tracking-widest text-sm">
              Team Performance Analysis
            </div>

            {/* Controls */}
            <div className="bg-stone-50 p-4 border-b border-stone-200">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-stone-700">
                    Show:
                  </label>
                  <select
                    className="border border-stone-300 rounded-md px-3 py-1.5 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none text-sm"
                    value={showTopTeams ? "top" : "bottom"}
                    onChange={(e) => setShowTopTeams(e.target.value === "top")}
                  >
                    <option value="top">Best Performing Teams</option>
                    <option value="bottom">Worst Performing Teams</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-stone-700">
                    Number of Teams:
                  </label>
                  <select
                    className="border border-stone-300 rounded-md px-3 py-1.5 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none text-sm"
                    value={teamReportSize}
                    onChange={(e) => setTeamReportSize(Number(e.target.value))}
                  >
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={25}>Top 25</option>
                    <option value={50}>Top 50</option>
                    <option value={100}>Top 100</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-left">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-left">
                      Team
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                      Games
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                      Win %
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                      Wagered
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                      Won
                    </th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider text-stone-600 font-semibold text-center">
                      ROI
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayedTeams.map((teamData, idx) => {
                    // Both top and bottom views now count from 1
                    const rank = idx + 1;
                    
                    const winPctColor = teamData.winPct >= 50 ? "#16a34a" : "#dc2626";
                    const roiColor = teamData.roi >= 0 ? "#16a34a" : "#dc2626";
                    const profitColor = teamData.won >= teamData.wagered ? "#16a34a" : "#dc2626";

                    return (
                      <tr key={teamData.team} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-4 py-3 text-center font-semibold text-stone-600">
                          {rank}
                        </td>
                        
                        <td className="px-4 py-3">
                          <Link
                            href={`/ncaa-team/${encodeURIComponent(teamData.team)}`}
                            className="hover:underline cursor-pointer flex items-center gap-2"
                          >
                            <NCAALogo teamName={teamData.team} size={24} />
                            <span className="font-medium">{teamData.team}</span>
                          </Link>
                        </td>
                        
                        <td className="px-4 py-3 text-center">
                          {teamData.games}
                        </td>
                        
                        <td 
                          className="px-4 py-3 text-center font-semibold"
                          style={{ color: winPctColor }}
                        >
                          {teamData.winPct.toFixed(1)}%
                        </td>
                        
                        <td className="px-4 py-3 text-center text-red-600 font-medium">
                          ${teamData.wagered.toLocaleString()}
                        </td>
                        
                        <td 
                          className="px-4 py-3 text-center font-medium"
                          style={{ color: profitColor }}
                        >
                          ${teamData.won.toLocaleString()}
                        </td>
                        
                        <td 
                          className="px-4 py-3 text-center font-semibold"
                          style={{ color: roiColor }}
                        >
                          {teamData.roi.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-stone-50 p-3 text-center text-xs text-stone-600 border-t border-stone-200">
              Minimum 3 games required. Based on current edge filter (≥{minEdge.toFixed(1)} points).
            </div>
          </div>
          </div>
        )}

        {/* WEEK SELECTOR */}
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Historical Results By Week
          </h2>

          <select
            className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none mb-6"
            value={selectedWeekIndex}
            onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
          >
            {weekRanges.map((range, idx) => {
              // Format date strings directly without Date object conversion
              const formatDate = (dateStr: string) => {
                const [year, month, day] = dateStr.split('-');
                return `${parseInt(month)}/${parseInt(day)}/${year}`;
              };

              const label = `${formatDate(range.start)} – ${formatDate(range.end)}`;

              return (
                <option key={idx} value={idx}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <div className="w-full">
          <SummaryCard
            title={selectedTeam ? `Weekly Summary - ${selectedTeam}` : "Weekly Summary"}
            data={weeklySummary}
            colors={{
              winPct: weeklyBbmiBeatsVegasColor,
              won: weeklyFakeWonColor,
              roi: weeklyRoiColor,
            }}
          />
        </div>

        {/* HISTORICAL TABLE */}
        <div className="w-full">
          <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm mt-10">
          <div className="max-h-[600px] overflow-auto pt-6">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#0a1a2f] text-white text-sm">
                  <SortableHeader
                    label="Date"
                    columnKey="date"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Away"
                    columnKey="away"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Home"
                    columnKey="home"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label={
                      <>
                        Vegas
                        <br />
                        Line
                      </>
                    }
                    columnKey="vegasHomeLine"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
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
                    sortConfig={sortConfig}
                    handleSort={handleSort}
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
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Away Score"
                    columnKey="actualAwayScore"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Home Score"
                    columnKey="actualHomeScore"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Bet"
                    columnKey="fakeBet"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Win"
                    columnKey="fakeWin"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                  <SortableHeader
                    label="Result"
                    columnKey="result"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                  />
                </tr>
              </thead>

              <tbody>
                {sortedHistorical.map((g, i) => (
                  <tr key={i} className="bg-white border-b border-stone-200">
                    <td className="px-3 py-2 text-xs">{g.date}</td>
                    
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/ncaa-team/${encodeURIComponent(String(g.away))}`}
                        className="hover:underline cursor-pointer flex items-center gap-2"
                      >
                        <NCAALogo teamName={String(g.away)} size={24} />
                        <span>{g.away}</span>
                      </Link>
                    </td>
                    
                    <td className="px-3 py-2 text-sm">
                      <Link
                        href={`/ncaa-team/${encodeURIComponent(String(g.home))}`}
                        className="hover:underline cursor-pointer flex items-center gap-2"
                      >
                        <NCAALogo teamName={String(g.home)} size={24} />
                        <span>{g.home}</span>
                      </Link>
                    </td>

                    <td className="text-right px-3 py-2">{g.vegasHomeLine}</td>
                    <td className="text-right px-3 py-2">{g.bbmiHomeLine}</td>

                    <td className="text-right px-3 py-2 font-semibold">
                      {g.actualHomeLine}
                    </td>

                    <td className="text-right px-3 py-2">
                      {g.actualAwayScore}
                    </td>
                    <td className="text-right px-3 py-2">
                      {g.actualHomeScore}
                    </td>

                    <td className="text-right px-3 py-2">
                      ${g.fakeBet}
                    </td>

                    <td
                      className="text-right px-3 py-2 font-medium"
                      style={{
                        color:
                          Number(g.fakeWin) > 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      ${g.fakeWin}
                    </td>

                    <td className="text-center px-3 py-2">
                      {g.result === "win" ? (
                        <span style={{ color: "#16a34a", fontWeight: 900, fontSize: "1.25rem" }}>
                          ✓
                        </span>
                      ) : g.result === "loss" ? (
                        <span style={{ color: "#dc2626", fontWeight: 900, fontSize: "1.25rem" }}>
                          ✗
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
        </div>

        <p className="text-xs text-stone-500 mt-8 text-center max-w-[600px] mx-auto">
          This page is for entertainment purposes only. Not intended for real-world gambling.
        </p>
      </div>
    </div>
  );
}
