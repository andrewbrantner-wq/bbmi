"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import wiaaRankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import { ChevronUp, ChevronDown } from "lucide-react";

// Helpers
const normalizeDate = (dateStr: string) => {
  if (!dateStr) return "";
  // Handle both "YYYY-MM-DD" and "YYYY-MM-DD HH:MM:SS" formats
  return dateStr.split(" ")[0].split("T")[0];
};

const truncate = (str: string, n = 20) =>
  str.length > n ? str.slice(0, n) + "…" : str;

// Types
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
  teamLine: number | null;   // ← update this
  homeWinProb: number;
  bbmiPick: string;
};

export default function WIAATodaysPicks() {
  // Sorting
  const [sortColumn, setSortColumn] = useState<
    "away" | "home" | "line" | "pick" | "win"
  >("away");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filters
// Around line 46-47
const today = new Date().toLocaleDateString('en-CA'); // Returns YYYY-MM-DD
const [selectedDate, setSelectedDate] = useState(today);
  const [division, setDivision] = useState<number | "all">("all");

  // JSON-LD
useEffect(() => {
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI Today's Picks – WIAA High School Basketball Predictions",
    description:
      "Live WIAA basketball BBMI model picks and win probabilities for today's games.",
    url: "https://bbmihoops.com/wiaa-todays-picks",
    dateModified: "2025-01-01",
  });

  document.head.appendChild(script);

  return () => {
    document.head.removeChild(script);
  };
}, []);

  // Rankings lookup
  const rankingsMap = new Map<string, TeamMeta>();
  wiaaRankings.forEach((r) => rankingsMap.set(r.team, r));

  // Build raw games for selected date
  const gamesForDate: GameRow[] = wiaaTeams
    .filter((g) => normalizeDate(g.date) === selectedDate && g.location === "Home")
    .map((g) => {
      const homeMeta = rankingsMap.get(g.team) || null;
      const awayMeta = rankingsMap.get(g.opp) || null;

      let bbmiPick = "";
if (g.teamLine !== null && g.teamLine !== 0) {
  bbmiPick = g.teamLine < 0 ? g.team : g.opp;
}
      return {
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
      };
    });

  // Build division list
  const divisions = useMemo(() => {
    const set = new Set<number>();
    gamesForDate.forEach((g) => {
      const d = Number(g.homeDiv);
      if (!Number.isNaN(d)) set.add(d);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [gamesForDate]);

  // Apply division filter
  const filteredGames = useMemo(() => {
    if (division === "all") return gamesForDate;
    return gamesForDate.filter((g) => Number(g.homeDiv) === division);
  }, [gamesForDate, division]);

  // Sorting logic
  const todaysGames = useMemo(() => {
    const sorted = [...filteredGames];

    sorted.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortColumn) {
        case "away":
          valA = a.away;
          valB = b.away;
          break;
        case "home":
          valA = a.home;
          valB = b.home;
          break;
        case "line":
          valA = a.teamLine;
          valB = b.teamLine;
          break;
        case "pick":
          valA = a.bbmiPick;
          valB = b.bbmiPick;
          break;
        case "win":
          valA = a.homeWinProb;
          valB = b.homeWinProb;
          break;
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return sorted;
  }, [filteredGames, sortColumn, sortDirection]);

  const handleSort = (column: typeof sortColumn) => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortIcon = (column: typeof sortColumn) => {
    if (column !== sortColumn) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline-block w-4 h-4 ml-1 text-white" />
    ) : (
      <ChevronDown className="inline-block w-4 h-4 ml-1 text-white" />
    );
  };

  return (
    <div className="section-wrapper bg-stone-50 min-h-screen">
      <div className="w-full max-w-[1400px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-8">
          
          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
            <LogoBadge league="wiaa" />
            <span> WIAA Picks</span>
          </h1>
        </div>

{/* Filters */}
<div className="flex justify-center mb-6">
  <div className="flex flex-wrap justify-center gap-4 px-4 py-4 bg-white border border-stone-300 rounded-md shadow-sm max-w-[600px]">
    {/* Date Picker (today or future only) */}
    <input
      type="date"
      value={selectedDate}
      min={today}
      onChange={(e) => setSelectedDate(e.target.value)}
      className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
    />

    {/* Division Dropdown */}
    <select
      value={division}
      onChange={(e) =>
        setDivision(e.target.value === "all" ? "all" : Number(e.target.value))
      }
      className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
    >
      <option value="all">Show All Divisions</option>
      {divisions.map((d) => (
        <option key={d} value={d}>
          Division {d}
        </option>
      ))}
    </select>
  </div>
</div>

        {/* Table */}
        <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 bg-white z-20 border-b border-stone-100">
                <tr className="text-center">
                  <th
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 cursor-pointer"
                    onClick={() => handleSort("away")}
                  >
                    Away {sortIcon("away")}
                  </th>
                  <th
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 cursor-pointer"
                    onClick={() => handleSort("home")}
                  >
                    Home {sortIcon("home")}
                  </th>
                  <th
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 cursor-pointer"
                    onClick={() => handleSort("line")}
                  >
                    Home Line {sortIcon("line")}
                  </th>
                  <th
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 cursor-pointer"
                    onClick={() => handleSort("pick")}
                  >
                    BBMI Pick {sortIcon("pick")}
                  </th>
                  <th
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-stone-500 cursor-pointer"
                    onClick={() => handleSort("win")}
                  >
                    Home Win % {sortIcon("win")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {todaysGames.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-6 text-stone-500 italic text-sm"
                    >
                      No games found for this date/division.
                    </td>
                  </tr>
                )}

                {todaysGames.map((g, i) => {
                  const pickIsHome = g.bbmiPick === g.home;
                  const pickIsAway = g.bbmiPick === g.away;

                  return (
                    <tr
                      key={i}
                      className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                    >
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
                            <Link
                              href={`/wiaa-team/${encodeURIComponent(g.away)}`}
                              className="font-medium hover:underline"
                            >
                              {truncate(g.away)}
                            </Link>
                            <div className="text-xs text-stone-500">
                              (D{Math.round(Number(g.awayDiv))} •{" "}
                              {g.awayMeta?.record ?? ""})
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
                            <Link
                              href={`/wiaa-team/${encodeURIComponent(g.home)}`}
                              className="font-medium hover:underline"
                            >
                              {truncate(g.home)}
                            </Link>
                            <div className="text-xs text-stone-500">
                              (D{Math.round(Number(g.homeDiv))} •{" "}
                              {g.homeMeta?.record ?? ""})
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Line */}
<td className="px-3 py-2 text-center text-sm border-t border-stone-100">
  {g.teamLine === null
    ? ""
    : g.teamLine > 0
      ? `+${g.teamLine}`
      : g.teamLine}
</td>

                      {/* BBMI Pick */}
                      <td className="px-3 py-2 text-center text-sm border-t border-stone-100">
                        <span
                          className={`inline-block px-2 py-1 rounded-md ${
                            pickIsHome || pickIsAway ? "bg-stone-200" : ""
                          }`}
                        >
                          {truncate(g.bbmiPick)}
                        </span>
                      </td>

                      {/* Win % */}
                      <td className="px-3 py-2 text-center text-sm border-t border-stone-100">
                        {(g.homeWinProb * 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-stone-500 mt-8 text-center max-w-[600px] mx-auto">
          This page is for entertainment purposes only.
        </p>
      </div>
    </div>
  );
}