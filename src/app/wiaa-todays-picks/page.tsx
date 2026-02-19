"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import wiaaRankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import { ChevronUp, ChevronDown } from "lucide-react";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const normalizeDate = (dateStr: string) => {
  if (!dateStr) return "";
  return dateStr.split(" ")[0].split("T")[0];
};

const truncate = (str: string, n = 20) =>
  str.length > n ? str.slice(0, n) + "…" : str;

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type TeamMeta = {
  team: string;
  record: string;
  bbmi_rank: number;
  slug: string;
};

type GameRow = {
  date: string;
  home: string;
  away: string;
  homeDiv: string;
  awayDiv: string;
  homeMeta: TeamMeta | null;
  awayMeta: TeamMeta | null;
  teamLine: number | null;
  homeWinProb: number;
  bbmiPick: string;
};

type SortCol = "away" | "home" | "line" | "pick" | "win";

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  away: "The visiting team. Division and season record shown below the name. Click the team name to view their full schedule and BBMI profile.",
  home: "The home team. Division and season record shown below the name. Click the team name to view their full schedule and BBMI profile.",
  line: "BBMI's predicted point spread from the home team's perspective. A negative number means BBMI favors the home team by that many points. A positive number means BBMI favors the away team.",
  pick: "The team BBMI predicts will win this game outright, based on its model line.",
  win: "BBMI's estimated probability that the home team wins this game. Below 50% means the model favors the away team.",
};

// ------------------------------------------------------------
// PORTAL
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
      if (el.current && !el.current.contains(e.target as Node)) onClose();
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
        position: "fixed", top, left, zIndex: 99999, width: 220,
        backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f",
        borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>
        {text}
      </div>
      <button
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
      >✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({
  label,
  columnKey,
  tooltipId,
  sortColumn,
  sortDirection,
  handleSort,
  activeDescId,
  openDesc,
  closeDesc,
  className = "",
}: {
  label: string;
  columnKey: SortCol;
  tooltipId?: string;
  sortColumn: SortCol;
  sortDirection: "asc" | "desc";
  handleSort: (col: SortCol) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  className?: string;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_wiaa_picks" : null;
  const isActive = sortColumn === columnKey;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (activeDescId === uid) closeDesc?.();
    else {
      const rect = thRef.current?.getBoundingClientRect();
      if (rect) openDesc(uid, rect);
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
      className={`select-none px-3 py-2 bg-[#0a1a2f] text-white ${className}`}
    >
      <div className="flex items-center justify-center gap-1">
        <span
          onClick={handleLabelClick}
          className="text-xs font-semibold tracking-wide uppercase"
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
          className="cursor-pointer hover:text-stone-300 transition-colors"
          style={{ opacity: isActive ? 1 : 0.4 }}
          title="Sort"
        >
          {isActive ? (
            sortDirection === "asc" ? (
              <ChevronUp className="inline-block w-3 h-3" />
            ) : (
              <ChevronDown className="inline-block w-3 h-3" />
            )
          ) : (
            <ChevronUp className="inline-block w-3 h-3" />
          )}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// HOW TO USE ACCORDION
// ------------------------------------------------------------

function HowToUseAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      width: "100%",
      border: "1px solid #d6d3d1",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      backgroundColor: "transparent",
      marginBottom: "1.5rem",
    }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: "0.02em",
          backgroundColor: open ? "#1e3a5f" : "#0a1a2f",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          borderRadius: open ? "8px 8px 0 0" : "8px",
          transition: "background-color 0.15s",
        }}
      >
        <span>📖 How do I use this page?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          backgroundColor: "#ffffff",
          padding: "20px 24px",
          borderTop: "1px solid #d6d3d1",
          fontSize: 14,
          color: "#44403c",
          lineHeight: 1.65,
        }}>
          <p style={{ marginBottom: 12 }}>
            This page shows BBMI's predictions for today's WIAA games. Each row is one matchup — use the date picker to browse upcoming games and the division filter to narrow to a specific division.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>The Home Line</strong> is BBMI's predicted point spread from the home team's perspective. A negative number (e.g. -8) means the model thinks the home team will win by 8 points. A positive number means the model favors the away team.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>The BBMI Pick</strong> is the team the model predicts will win outright. The <strong>Home Win %</strong> shows how confident the model is — values below 50% mean the model favors the away team.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Click any team name</strong> to view their full schedule, BBMI rank, and tournament probabilities. Division and season record are shown below each team name for quick context.
          </p>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8 }}>
            WIAA games don't have Vegas lines, so the Home Line here is BBMI's model prediction only — not a betting spread. This page is for entertainment purposes only.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAATodaysPicks() {
  const [sortColumn, setSortColumn] = useState<SortCol>("away");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const today = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(today);
  const [division, setDivision] = useState<number | "all">("all");

  // Portal state
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // JSON-LD
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI Today's Picks – WIAA High School Basketball Predictions",
      description: "Live WIAA basketball BBMI model picks and win probabilities for today's games.",
      url: "https://bbmihoops.com/wiaa-todays-picks",
      dateModified: new Date().toISOString(),
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const rankingsMap = useMemo(() => {
    const map = new Map<string, TeamMeta>();
    wiaaRankings.forEach((r) => map.set(r.team, r));
    return map;
  }, []);

  // All completed games for team performance analysis (not date-filtered)
  const allCompletedGames = useMemo(() => {
    const gamesMap = new Map<string, { home: string; away: string; homeWinProb: number; bbmiPick: string; actualHomeWon: boolean }>();
    (wiaaTeams as any[])
      .filter((g) => g.location === "Home" && g.result && g.result.trim() !== "" && g.teamLine !== null && g.teamLine !== 0)
      .forEach((g) => {
        const gameKey = [g.team, g.opp].sort().join("|") + "|" + normalizeDate(g.date);
        if (gamesMap.has(gameKey)) return;
        const bbmiPick = g.teamLine < 0 ? g.team : g.opp;
        const homeWon = g.result === "W";
        gamesMap.set(gameKey, {
          home: g.team,
          away: g.opp,
          homeWinProb: g.teamWinPct,
          bbmiPick,
          actualHomeWon: homeWon,
        });
      });
    return Array.from(gamesMap.values());
  }, []);

  // Team performance: how often did BBMI correctly predict each team's games
  const [showTopTeams, setShowTopTeams] = useState(true);
  const [teamReportSize, setTeamReportSize] = useState(10);

  const teamPerformance = useMemo(() => {
    const stats: Record<string, { games: number; correct: number }> = {};
    allCompletedGames.forEach((g) => {
      const bbmiPickedHome = g.bbmiPick === g.home;
      const bbmiCorrect = bbmiPickedHome === g.actualHomeWon;
      // Track the picked team
      const picked = g.bbmiPick;
      if (!stats[picked]) stats[picked] = { games: 0, correct: 0 };
      stats[picked].games++;
      if (bbmiCorrect) stats[picked].correct++;
    });
    return Object.entries(stats)
      .filter(([, s]) => s.games >= 3)
      .map(([team, s]) => ({ team, games: s.games, correct: s.correct, winPct: (s.correct / s.games) * 100 }))
      .sort((a, b) => b.winPct - a.winPct || b.games - a.games);
  }, [allCompletedGames]);

  const displayedTeams = useMemo(() => {
    const sorted = showTopTeams ? teamPerformance : [...teamPerformance].reverse();
    return sorted.slice(0, teamReportSize);
  }, [teamPerformance, showTopTeams, teamReportSize]);

  const gamesForDate: GameRow[] = useMemo(() => {
    const gamesMap = new Map<string, GameRow>();

    wiaaTeams
      .filter((g) => normalizeDate(g.date) === selectedDate && g.location === "Home")
      .forEach((g) => {
        const gameKey = [g.team, g.opp].sort().join("|");
        if (gamesMap.has(gameKey)) return;

        const homeMeta = rankingsMap.get(g.team) || null;
        const awayMeta = rankingsMap.get(g.opp) || null;

        let bbmiPick = "";
        if (g.teamLine !== null && g.teamLine !== 0) {
          bbmiPick = g.teamLine < 0 ? g.team : g.opp;
        }

        gamesMap.set(gameKey, {
          date: normalizeDate(g.date),
          home: g.team,
          away: g.opp,
          homeDiv: g.teamDiv,
          awayDiv: g.oppDiv,
          homeMeta,
          awayMeta,
          teamLine: g.teamLine,
          homeWinProb: g.teamWinPct,
          bbmiPick,
        });
      });

    return Array.from(gamesMap.values());
  }, [selectedDate, rankingsMap]);

  const divisions = useMemo(() => {
    const set = new Set<number>();
    gamesForDate.forEach((g) => {
      const d = Number(g.homeDiv);
      if (!Number.isNaN(d)) set.add(d);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [gamesForDate]);

  const filteredGames = useMemo(() => {
    if (division === "all") return gamesForDate;
    return gamesForDate.filter((g) => Number(g.homeDiv) === division);
  }, [gamesForDate, division]);

  const todaysGames = useMemo(() => {
    const sorted = [...filteredGames];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "away": valA = a.away; valB = b.away; break;
        case "home": valA = a.home; valB = b.home; break;
        case "line": valA = a.teamLine; valB = b.teamLine; break;
        case "pick": valA = a.bbmiPick; valB = b.bbmiPick; break;
        case "win": valA = a.homeWinProb; valB = b.homeWinProb; break;
      }
      if (typeof valA === "number" && typeof valB === "number")
        return sortDirection === "asc" ? valA - valB : valB - valA;
      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return sorted;
  }, [filteredGames, sortColumn, sortDirection]);

  const handleSort = (column: SortCol) => {
    if (column === sortColumn) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const headerProps = {
    sortColumn, sortDirection, handleSort,
    activeDescId: descPortal?.id,
    openDesc, closeDesc,
  };

  return (
    <>
      {descPortal && (
        <ColDescPortal
          tooltipId={descPortal.id.split("_")[0]}
          anchorRect={descPortal.rect}
          onClose={closeDesc}
        />
      )}

      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full max-w-[1400px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="wiaa" />
              <span> WIAA Picks</span>
            </h1>
            <p className="text-stone-500 text-sm text-center max-w-xl mt-2">
              BBMI model predictions for today's WIAA games — win probabilities and predicted spreads by division.
              Click any column header label to learn what it means.
            </p>
          </div>

          {/* HOW TO USE ACCORDION */}
          <div className="w-full max-w-2xl mx-auto">
            <HowToUseAccordion />
          </div>

          {/* FILTERS */}
          <div className="flex justify-center mb-6">
            <div className="flex flex-wrap justify-center gap-4 px-4 py-4 bg-white border border-stone-300 rounded-md shadow-sm max-w-[600px]">
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
              />
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
              >
                <option value="all">Show All Divisions</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>Division {d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm">
            <div className="max-h-[1000px] overflow-auto">
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <SortableHeader label="Away" columnKey="away" tooltipId="away" className="text-left" {...headerProps} />
                    <SortableHeader label="Home" columnKey="home" tooltipId="home" className="text-left" {...headerProps} />
                    <SortableHeader label="Home Line" columnKey="line" tooltipId="line" {...headerProps} />
                    <SortableHeader label="BBMI Pick" columnKey="pick" tooltipId="pick" {...headerProps} />
                    <SortableHeader label="Home Win %" columnKey="win" tooltipId="win" {...headerProps} />
                  </tr>
                </thead>

                <tbody>
                  {todaysGames.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-stone-500 italic text-sm">
                        No games found for this date/division.
                      </td>
                    </tr>
                  )}

                  {todaysGames.map((g, i) => {
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}>
                        {/* Away */}
                        <td className="px-3 py-2 text-left text-sm border-t border-stone-100">
                          <div className="flex items-center gap-2">
                            {g.awayMeta?.slug && (
                              <Image
                                src={`/logos/wiaa/${g.awayMeta.slug}.png`}
                                alt={g.away}
                                width={26}
                                height={26}
                              />
                            )}
                            <div>
                              <Link href={`/wiaa-team/${encodeURIComponent(g.away)}`} className="font-medium hover:underline">
                                {truncate(g.away)}
                              </Link>
                              <div className="text-xs text-stone-500">
                                (D{Math.round(Number(g.awayDiv))} • {g.awayMeta?.record ?? ""})
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Home */}
                        <td className="px-3 py-2 text-left text-sm border-t border-stone-100">
                          <div className="flex items-center gap-2">
                            {g.homeMeta?.slug && (
                              <Image
                                src={`/logos/wiaa/${g.homeMeta.slug}.png`}
                                alt={g.home}
                                width={26}
                                height={26}
                              />
                            )}
                            <div>
                              <Link href={`/wiaa-team/${encodeURIComponent(g.home)}`} className="font-medium hover:underline">
                                {truncate(g.home)}
                              </Link>
                              <div className="text-xs text-stone-500">
                                (D{Math.round(Number(g.homeDiv))} • {g.homeMeta?.record ?? ""})
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Line */}
                        <td className="px-3 py-2 text-center text-sm border-t border-stone-100 font-mono">
                          {g.teamLine === null ? "" : g.teamLine > 0 ? `+${g.teamLine}` : g.teamLine}
                        </td>

                        {/* BBMI Pick */}
                        <td className="px-3 py-2 text-center text-sm border-t border-stone-100">
                          {g.bbmiPick && (
                            <Link
                              href={`/wiaa-team/${encodeURIComponent(g.bbmiPick)}`}
                              className="hover:underline cursor-pointer inline-flex items-center gap-2 font-medium"
                            >
                              {(g.bbmiPick === g.home ? g.homeMeta?.slug : g.awayMeta?.slug) && (
                                <Image
                                  src={`/logos/wiaa/${g.bbmiPick === g.home ? g.homeMeta?.slug : g.awayMeta?.slug}.png`}
                                  alt={g.bbmiPick}
                                  width={20}
                                  height={20}
                                />
                              )}
                              <span>{truncate(g.bbmiPick)}</span>
                            </Link>
                          )}
                        </td>

                        {/* Win % */}
                        <td className="px-3 py-2 text-center text-sm border-t border-stone-100 font-mono">
                          <span style={{
                            color: g.homeWinProb >= 0.5 ? "#16a34a" : "#dc2626",
                            fontWeight: 600,
                          }}>
                            {(g.homeWinProb * 100).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          
          <p className="text-xs text-stone-500 mt-6 text-center max-w-[600px] mx-auto">
            WIAA games do not have Vegas lines. The Home Line shown is BBMI's model prediction only. This page is for entertainment purposes only.
          </p>

        </div>
      </div>
    </>
  );
}
