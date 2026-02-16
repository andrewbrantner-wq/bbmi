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
   SORTABLE HEADER - COPIED FROM TODAY'S PICKS
-------------------------------------------------------- */
function SortableHeader({
  label,
  columnKey,
  sortConfig,
  handleSort,
  rowSpan,
}: {
  label: React.ReactNode;
  columnKey: SortKey;
  sortConfig: { key: SortKey; direction: SortDirection };
  handleSort: (key: SortKey) => void;
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
        <span className="text-xs font-semibold tracking-wide">{label}</span>
        {isActive && (
          <span className="text-xs">{direction === "asc" ? "▲" : "▼"}</span>
        )}
      </div>
    </th>
  );
}

/* -------------------------------------------------------
   SUMMARY CARD - COPIED STRUCTURE FROM TODAY'S PICKS
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
      <div 
        className="p-2 text-center font-bold uppercase tracking-widest text-sm"
        style={{ 
          backgroundColor: '#0a1a2f',
          color: '#ffffff'
        }}
      >
        {title}
      </div>

      <div className="bg-white overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr 
              className="border-b border-stone-200"
              style={{ backgroundColor: '#0a1a2f' }}
            >
              <th 
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                style={{ color: '#ffffff' }}
              >
                Sample Size
              </th>
              <th 
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                style={{ color: '#ffffff' }}
              >
                % Beats Vegas
              </th>
              <th 
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                style={{ color: '#ffffff' }}
              >
                Wagered
              </th>
              <th 
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                style={{ color: '#ffffff' }}
              >
                Won
              </th>
              <th 
                className="px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                style={{ color: '#ffffff' }}
              >
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

  // Generate edge threshold options
  const edgeOptions = useMemo(() => {
    const options = [0];
    for (let i = 0.5; i <= 10; i += 0.5) {
      options.push(i);
    }
    return options;
  }, []);

  // Get unique team list
  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    historicalGames.forEach((g) => {
      if (g.away) teams.add(String(g.away));
      if (g.home) teams.add(String(g.home));
    });
    return Array.from(teams).sort();
  }, [historicalGames]);

  // Filter teams based on search
  const filteredTeams = useMemo(() => {
    if (!teamSearch) return [];
    const search = teamSearch.toLowerCase();
    return allTeams.filter((team) =>
      team.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [teamSearch, allTeams]);

  // Apply edge filter
  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return historicalGames;
    
    return historicalGames.filter((g) => {
      const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
      return edge >= minEdge;
    });
  }, [historicalGames, minEdge]);

  // Apply team filter
  const teamAndEdgeFilteredGames = useMemo(() => {
    if (!selectedTeam) return edgeFilteredGames;
    
    return edgeFilteredGames.filter((g) => 
      String(g.away) === selectedTeam || String(g.home) === selectedTeam
    );
  }, [edgeFilteredGames, selectedTeam]);

  // Calculate team records
  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    
    teamAndEdgeFilteredGames.forEach((g) => {
      if (Number(g.fakeBet || 0) <= 0) return;
      
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      
      if (vegasLine === bbmiLine) return;
      
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      
      if (!records[pickedTeam]) {
        records[pickedTeam] = { wins: 0, picks: 0 };
      }
      
      records[pickedTeam].picks++;
      
      if (Number(g.fakeWin || 0) > 0) {
        records[pickedTeam].wins++;
      }
    });
    
    return records;
  }, [teamAndEdgeFilteredGames]);

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

  // Filter bets - if team is selected, only show games where BBMI picked that team
  const betHistorical = useMemo(() => {
    const bets = teamAndEdgeFilteredGames.filter((g) => Number(g.fakeBet) > 0);
    
    // If no team selected, return all bets
    if (!selectedTeam) return bets;
    
    // If team is selected, only return bets where BBMI picked that team
    return bets.filter((g) => {
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      
      // Skip if lines are equal (no pick)
      if (vegasLine === bbmiLine) return false;
      
      // Determine which team BBMI picked
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      
      // Only include if BBMI picked the selected team
      return pickedTeam === selectedTeam;
    });
  }, [teamAndEdgeFilteredGames, selectedTeam]);

  /* ---------------- GLOBAL SUMMARY ---------------- */
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

  /* ---------------- WEEKLY GROUPING ---------------- */
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

  const weekRanges = useMemo(() => {
    if (allDates.length === 0) return [];
    
    const ranges: Array<{start: string, end: string}> = [];
    
    const addDays = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };
    
    let currentStart = allDates[0];
    
    while (currentStart <= allDates[allDates.length - 1]) {
      const currentEnd = addDays(currentStart, 6);
      
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

  /* ---------------- TEAM PERFORMANCE ---------------- */
  const teamPerformance = useMemo(() => {
    const teamStats: Record<string, {
      games: number;
      wins: number;
      wagered: number;
      won: number;
    }> = {};

    betHistorical.forEach((g) => {
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      
      if (vegasLine === bbmiLine) return;
      
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      
      const isWin = Number(g.fakeWin) > 0;
      const bet = Number(g.fakeBet || 0);
      const won = Number(g.fakeWin || 0);

      if (!teamStats[pickedTeam]) {
        teamStats[pickedTeam] = { games: 0, wins: 0, wagered: 0, won: 0 };
      }

      teamStats[pickedTeam].games++;
      
      if (isWin) {
        teamStats[pickedTeam].wins++;
      }

      teamStats[pickedTeam].wagered += bet;
      teamStats[pickedTeam].won += won;
    });

    const teamsArray = Object.entries(teamStats)
      .filter(([_, stats]) => stats.games >= 3)
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
  const [teamReportSize, setTeamReportSize] = useState(5);

  const displayedTeams = useMemo(() => {
    if (showTopTeams) {
      return teamPerformance.slice(0, teamReportSize);
    } else {
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

  const handleTeamSelect = (team: string) => {
    setSelectedTeam(team);
    setTeamSearch(team);
    setShowSuggestions(false);
    setSelectedWeekIndex(0);
  };

  const handleClearTeam = () => {
    setSelectedTeam("");
    setTeamSearch("");
    setSelectedWeekIndex(0);
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
                  autoComplete="off"
                  onChange={(e) => {
                    setTeamSearch(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) {
                      setSelectedTeam("");
                    }
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleTeamSelect(team);
                      }}
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
            <div 
              className="px-4 py-2 rounded-md flex items-center gap-2"
              style={{ 
                backgroundColor: '#0a1a2f',
                color: '#ffffff'
              }}
            >
              <NCAALogo teamName={selectedTeam} size={24} />
              <span className="font-semibold" style={{ color: '#ffffff' }}>
                Showing results for: {selectedTeam}
              </span>
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
            <div 
              className="p-2 text-center font-bold uppercase tracking-widest text-sm"
              style={{ 
                backgroundColor: '#0a1a2f',
                color: '#ffffff'
              }}
            >
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

            {/* Table - COPIED FROM TODAY'S PICKS PATTERN */}
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: '#0a1a2f', color: '#ffffff' }}>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-left"
                      style={{ color: '#ffffff' }}
                    >
                      Rank
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-left"
                      style={{ color: '#ffffff' }}
                    >
                      Team
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                      title="Games where BBMI picked this team to beat Vegas"
                      style={{ color: '#ffffff' }}
                    >
                      Picked
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                      title="Win % when BBMI picked this team"
                      style={{ color: '#ffffff' }}
                    >
                      Win %
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                      style={{ color: '#ffffff' }}
                    >
                      Wagered
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                      style={{ color: '#ffffff' }}
                    >
                      Won
                    </th>
                    <th 
                      className="px-3 py-3 text-[10px] uppercase tracking-wider font-semibold text-center"
                      style={{ color: '#ffffff' }}
                    >
                      ROI
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {displayedTeams.map((teamData, idx) => {
                    const rank = idx + 1;
                    
                    const winPctColor = teamData.winPct >= 50 ? "#16a34a" : "#dc2626";
                    const roiColor = teamData.roi >= 0 ? "#16a34a" : "#dc2626";
                    const profitColor = teamData.won >= teamData.wagered ? "#16a34a" : "#dc2626";

                    return (
                      <tr key={teamData.team} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="px-3 py-3 text-center font-semibold text-stone-600">
                          {rank}
                        </td>
                        
                        <td className="px-3 py-3">
                          <Link
                            href={`/ncaa-team/${encodeURIComponent(teamData.team)}`}
                            className="hover:underline cursor-pointer flex items-center gap-2"
                          >
                            <NCAALogo teamName={teamData.team} size={24} />
                            <span className="font-medium">{teamData.team}</span>
                          </Link>
                        </td>
                        
                        <td className="px-3 py-3 text-center">
                          {teamData.games}
                        </td>
                        
                        <td 
                          className="px-3 py-3 text-center font-semibold"
                          style={{ color: winPctColor }}
                        >
                          {teamData.winPct.toFixed(1)}%
                        </td>
                        
                        <td className="px-3 py-3 text-center text-red-600 font-medium">
                          ${teamData.wagered.toLocaleString()}
                        </td>
                        
                        <td 
                          className="px-3 py-3 text-center font-medium"
                          style={{ color: profitColor }}
                        >
                          ${teamData.won.toLocaleString()}
                        </td>
                        
                        <td 
                          className="px-3 py-3 text-center font-semibold"
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
              Minimum 3 games required. "Picked" = games where BBMI picked this team to beat Vegas. Based on current edge filter (≥{minEdge.toFixed(1)} points).
            </div>
          </div>
          </div>
        )}

        {/* WEEK SELECTOR */}
        <div className="flex flex-col items-center gap-6">
          <h2 className="text-xl font-semibold tracking-tight mb-3">
            Historical Results By Week
          </h2>
          <p className="text-xs text-stone-600 mb-3 text-center italic">
            Team records shown on this page indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>
          <select
            className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none mb-6"
            value={selectedWeekIndex}
            onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
          >
            {weekRanges.map((range, idx) => {
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

        {/* HISTORICAL TABLE - COPIED FROM TODAY'S PICKS PATTERN */}
        <div className="w-full">
          <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm mt-10">
          <div className="max-h-[600px] overflow-auto pt-6">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10">
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
                    label="Away"
                    columnKey="away"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Home"
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
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}
                  >
                    Home Line
                  </th>
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
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Away Score"
                    columnKey="actualAwayScore"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Home Score"
                    columnKey="actualHomeScore"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Bet"
                    columnKey="fakeBet"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Win"
                    columnKey="fakeWin"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                  <SortableHeader
                    label="Result"
                    columnKey="result"
                    sortConfig={sortConfig}
                    handleSort={handleSort}
                    rowSpan={2}
                  />
                </tr>
                {/* Second header row - sub-columns only */}
                <tr className="bg-[#0a1a2f] text-white text-sm" style={{ position: 'sticky', top: '32px', zIndex: 10 }}>
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
                    
                    <td className="px-3 py-2 text-sm">
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

        
      </div>
    </div>
  );
}
