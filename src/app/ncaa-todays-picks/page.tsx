"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
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

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  date: "The date of the game.",
  away: "The visiting team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  home: "The home team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  vegasHomeLine: "Point spread set by sportsbooks for the home team. Negative = home team is favored. Example: -5.5 means home must win by 6+ to cover.",
  bbmiHomeLine: "What BBMI's model predicts the spread should be. Compare to the Vegas line — the bigger the gap, the more the model disagrees with Vegas.",
  edge: "The gap between BBMI's line and the Vegas line. Larger edge = stronger model conviction. Use the filter below to focus on high-edge games.",
  bbmiPick: "The team BBMI's model favors to cover the Vegas spread, based on the direction and size of the edge.",
  bbmiWinProb: "BBMI's estimated probability that the home team wins the game outright (money line, not spread).",
  vegaswinprob: "Vegas's implied probability that the home team wins outright, derived from the money line odds.",
};

// ------------------------------------------------------------
// COLUMN DESC PORTAL
// ------------------------------------------------------------

function ColDescPortal({
  tooltipId,
  anchorRect,
  onClose,
}: {
  tooltipId: string;
  anchorRect: DOMRect;
  onClose: () => void;
}) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (el.current && !el.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!text || typeof document === "undefined") return null;

  const left = Math.min(
    anchorRect.left + anchorRect.width / 2 - 110,
    window.innerWidth - 234
  );
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div
      ref={el}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 99999,
        width: 220,
        backgroundColor: "#1e3a5f",
        border: "1px solid #3a5a8f",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div
        style={{
          padding: "10px 28px 6px 12px",
          fontSize: 12,
          color: "#e2e8f0",
          lineHeight: 1.5,
          textAlign: "left",
          whiteSpace: "normal",
        }}
      >
        {text}
      </div>
      <button
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute", top: 6, right: 8,
          background: "none", border: "none", cursor: "pointer",
          color: "#94a3b8", fontSize: 12, lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER — label click = description, triangle = sort
// ------------------------------------------------------------

function SortableHeader({
  label,
  columnKey,
  tooltipId,
  sortConfig,
  handleSort,
  rowSpan,
  activeDescId,
  openDesc,
  closeDesc,
}: {
  label: string;
  columnKey: SortableKeyUpcoming;
  tooltipId?: string;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
  rowSpan?: number;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
}) {
  const isActive = sortConfig.key === columnKey;
  const direction = sortConfig.direction;
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_" + columnKey : null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && TOOLTIPS[tooltipId] && openDesc && uid) {
      if (descShowing) {
        closeDesc?.();
      } else {
        const rect = thRef.current?.getBoundingClientRect();
        if (rect) openDesc(uid, rect);
      }
    }
  };

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeDesc?.();
    handleSort(columnKey);
  };

  return (
    <th
      ref={thRef}
      className="select-none px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white"
      rowSpan={rowSpan}
      style={{ textAlign: "center", verticalAlign: "middle" }}
    >
      <div className="flex items-center justify-center gap-1">
        <span
          onClick={handleLabelClick}
          className="text-xs font-semibold tracking-wide"
          style={{
            cursor: tooltipId ? "help" : "default",
            textDecoration: tooltipId ? "underline dotted" : "none",
            textUnderlineOffset: 3,
            textDecorationColor: "rgba(255,255,255,0.45)",
          }}
        >
          {label}
        </span>
        <span
          onClick={handleSortClick}
          className="text-xs cursor-pointer hover:text-stone-300 transition-colors"
          style={{ opacity: isActive ? 1 : 0.4, minWidth: 10 }}
          title="Sort"
        >
          {isActive ? (direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

/* ---------------------------------------------
   INNER COMPONENT (THE ACTUAL PAGE CONTENT)
---------------------------------------------- */
function BettingLinesPageContent() {
  const { user } = useAuth();

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
    return () => { document.head.removeChild(script); };
  }, []);

  // ---------------- PAGE-LEVEL PORTAL STATE ----------------
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);

  const openDesc = useCallback((id: string, rect: DOMRect) => {
    setDescPortal({ id, rect });
  }, []);

  const closeDesc = useCallback(() => {
    setDescPortal(null);
  }, []);

  // ---------------- DATA ----------------
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);

  const upcomingGames: UpcomingGame[] = cleanedGames.filter((g) => {
    const hasNoScore =
      g.actualHomeScore === 0 ||
      g.actualHomeScore == null ||
      g.actualAwayScore == null;
    return hasNoScore;
  });

  const historicalGames = cleanedGames.filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    historicalGames.forEach((g) => {
      if (Number(g.fakeBet || 0) <= 0) return;
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      if (!records[pickedTeam]) records[pickedTeam] = { wins: 0, picks: 0 };
      records[pickedTeam].picks++;
      if (Number(g.fakeWin || 0) > 0) records[pickedTeam].wins++;
    });
    return records;
  }, [historicalGames]);

  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    const winPct = ((record.wins / record.picks) * 100).toFixed(0);
    return {
      wins: record.wins,
      picks: record.picks,
      winPct,
      display: `${record.wins}-${record.picks - record.wins}`,
      color: record.wins / record.picks >= 0.5 ? "#16a34a" : "#dc2626",
    };
  };

  const [minEdge, setMinEdge] = useState<number>(0);

  const edgeOptions = useMemo(() => {
    const options = [0];
    for (let i = 0.5; i <= 10; i += 0.5) options.push(i);
    return options;
  }, []);

  const edgePerformanceStats = useMemo(() => {
    const edgeCategories = [
      { name: "≤2 pts", min: 0, max: 2 },
      { name: "2-4 pts", min: 2, max: 4 },
      { name: "4-6 pts", min: 4, max: 6 },
      { name: "6-8 pts", min: 6, max: 8 },
      { name: ">8 pts", min: 8, max: Infinity },
    ];

    return edgeCategories.map((category) => {
      const categoryGames = historicalGames.filter((g) => {
        if (Number(g.fakeBet || 0) <= 0) return false;
        const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
        return edge >= category.min && edge < category.max;
      });
      const wins = categoryGames.filter((g) => Number(g.fakeWin || 0) > 0).length;
      const wagered = categoryGames.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
      const won = categoryGames.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
      const roi = wagered > 0 ? won / wagered * 100 - 100 : 0;
      return {
        name: category.name,
        games: categoryGames.length,
        winPct: categoryGames.length > 0 ? ((wins / categoryGames.length) * 100).toFixed(1) : "0.0",
        roi: roi.toFixed(1),
        roiPositive: roi > 0,
      };
    });
  }, [historicalGames]);

  const historicalStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const wins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const wagered = allBets.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
    const won = allBets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const roi = wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0";
    return {
      total: allBets.length,
      winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0",
      roi,
    };
  }, [historicalGames]);

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
  }>({ key: "date", direction: "asc" });

  const handleSort = (columnKey: SortableKeyUpcoming) => {
    setSortConfig((prev) => ({
      key: columnKey,
      direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc",
    }));
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

  // Shared props for every SortableHeader
  const headerProps = {
    sortConfig,
    handleSort,
    activeDescId: descPortal?.id,
    openDesc,
    closeDesc,
  };

  return (
    <>
      {/* PAGE-LEVEL PORTAL */}
      {descPortal && (
        <ColDescPortal
          tooltipId={descPortal.id.split("_")[0]}
          anchorRect={descPortal.rect}
          onClose={closeDesc}
        />
      )}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* Header */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>Men's Picks</span>
            </h1>
          </div>

          {/* HEADLINE STATS STRIP */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginBottom: '2rem',
            }}
          >
            {[
              { value: `${historicalStats.winPct}%`, label: 'Beat Vegas', sub: 'All tracked picks' },
              { value: `${historicalStats.roi}%`, label: 'ROI', sub: 'Flat $100/game' },
              { value: historicalStats.total.toLocaleString(), label: 'Games Tracked', sub: 'Every result logged' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e7e5e4',
                  borderRadius: 8,
                  padding: '0.875rem 0.75rem',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0a1a2f', lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#0a1a2f', margin: '4px 0 3px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#78716c' }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* EDGE PERFORMANCE GRAPH */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <EdgePerformanceGraph games={historicalGames} showTitle={true} />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-xl shadow-md">
            <div style={{
              background: "hsl(210 30% 12%)",
              color: "white",
              padding: "0.75rem 1rem",
              fontWeight: "600",
              fontSize: "0.875rem",
              textAlign: "center",
              letterSpacing: "0.05em",
            }}>
              HISTORICAL PERFORMANCE BY EDGE SIZE
            </div>
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "hsl(210 30% 12%)", color: "white" }}>
                    {(["Edge Size", "Games", "Win %", "ROI"] as const).map((h, i) => (
                      <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 text-center font-semibold text-stone-700">{stat.name}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{stat.games.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold text-lg" style={{ color: Number(stat.winPct) > 50 ? "#16a34a" : "#dc2626" }}>
                        {stat.winPct}%
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-lg" style={{ color: stat.roiPositive ? "#16a34a" : "#dc2626" }}>
                        {stat.roi}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-stone-50 p-3 text-center text-xs text-stone-600 border-t border-stone-200">
              Historical performance across all completed games where BBMI made a pick
            </div>
          </div>

          {/* Upcoming Games */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '0.75rem 1.25rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '0.875rem', color: '#166534', margin: 0 }}>
              <strong>How to use this page:</strong> Find today's games below, then use the Edge filter to focus on picks where the model most strongly disagrees with Vegas — those are historically where the highest win rates and ROI occur.
            </p>
          </div>

          <h2 className="text-xl font-semibold tracking-tight mb-6 text-center">
            Upcoming Games
          </h2>

          {/* EDGE FILTER */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <label htmlFor="edge-filter" className="text-lg font-bold text-stone-800" style={{ fontSize: "1.125rem" }}>
              Filter by Minimum Edge
            </label>
            <select
              id="edge-filter"
              className="border-2 border-stone-400 rounded-lg px-6 py-3 bg-white shadow-md focus:ring-2 focus:ring-stone-600 focus:border-stone-600 outline-none font-semibold text-stone-800"
              style={{ minWidth: "20px", fontSize: "1.125rem" }}
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
            >
              {edgeOptions.map((edge) => (
                <option key={edge} value={edge} style={{ fontSize: "1.125rem" }}>
                  {edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}
                </option>
              ))}
            </select>
            <p className="text-sm font-semibold text-stone-700">
              Showing <span className="font-bold text-stone-900">{sortedUpcoming.length}</span> of{" "}
              <span className="font-bold text-stone-900">{upcomingGames.length}</span> games
            </p>
            <p className="text-xs text-stone-500 italic">
              Tip: The model performs best when edge is highest. Try ≥ 4.0 points to see picks where BBMI most strongly disagrees with Vegas.
            </p>
          </div>

          <p className="text-xs text-stone-600 mb-1 text-center italic">
            Team records shown below team names indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>
          <p className="text-xs text-stone-500 mb-4 text-center italic">
            When BBMI and Vegas win probabilities diverge significantly, that's a second signal the model sees something the market doesn't — worth noting alongside high-edge picks.
          </p>

          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll max-h-[1400px] overflow-y-auto overflow-x-auto">
              <table className="min-w-[1000px] w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  {/* First header row */}
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader label="Date" columnKey="date" tooltipId="date" rowSpan={2} {...headerProps} />
                    <SortableHeader label="Away Team" columnKey="away" tooltipId="away" rowSpan={2} {...headerProps} />
                    <SortableHeader label="Home Team" columnKey="home" tooltipId="home" rowSpan={2} {...headerProps} />
                    <th
                      colSpan={2}
                      className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white"
                      style={{ textAlign: "center" }}
                    >
                      <div className="flex items-center justify-center text-xs font-semibold">
                        Home Line
                      </div>
                    </th>
                    <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" rowSpan={2} {...headerProps} />
                    <SortableHeader label="BBMI Pick" columnKey="bbmiPick" tooltipId="bbmiPick" rowSpan={2} {...headerProps} />
                    <th
                      colSpan={2}
                      className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white"
                      style={{ textAlign: "center" }}
                    >
                      <div className="flex items-center justify-center text-xs font-semibold">
                        Money Line Home Win %
                      </div>
                    </th>
                  </tr>

                  {/* Second header row */}
                  <tr className="bg-[#0a1a2f] text-white text-sm" style={{ position: "sticky", top: "39px", zIndex: 20 }}>
                    <SortableHeader label="Vegas" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" {...headerProps} />
                    <SortableHeader label="BBMI" columnKey="bbmiHomeLine" tooltipId="bbmiHomeLine" {...headerProps} />
                    <SortableHeader label="BBMI" columnKey="bbmiWinProb" tooltipId="bbmiWinProb" {...headerProps} />
                    <SortableHeader label="Vegas" columnKey="vegaswinprob" tooltipId="vegaswinprob" {...headerProps} />
                  </tr>
                </thead>

                <tbody>
                  {sortedUpcoming.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-stone-500">
                        No games match the selected edge filter.
                      </td>
                    </tr>
                  )}

                  {sortedUpcoming.map((g, i) => (
                    <tr key={i} className="bg-white border-b border-stone-200">
                      <td className="px-3 py-2 whitespace-nowrap w-[120px]">{g.date}</td>

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

                      <td className="px-3 py-2 whitespace-nowrap text-right">{g.vegasHomeLine}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">{g.bbmiHomeLine}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">{g.edge.toFixed(1)}</td>

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
                        {g.bbmiWinProb == null ? "—" : (g.bbmiWinProb * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right">
                        {g.vegaswinprob == null ? "—" : (g.vegaswinprob * 100).toFixed(1)}%
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
