"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import BBMILogo from "@/components/BBMILogo";
import { ChevronUp, ChevronDown } from "lucide-react";
import wiaaData from "@/data/wiaa-rankings/WIAArankings.json";

type WIAARow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
};

export default function WIAARankingsPage() {
  const [division, setDivision] = useState(1);
  const [sortColumn, setSortColumn] = useState<"bbmi_rank" | "team">("bbmi_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const rankRef = useRef<HTMLTableCellElement>(null);
  const rankHeaderRef = useRef<HTMLTableCellElement>(null);
  const [rankWidth, setRankWidth] = useState(0);

  const normalized = useMemo<WIAARow[]>(() => {
    const raw = wiaaData as any[];
    return raw.map((r) => ({
      division: Number(r.division),
      team: String(r.team ?? ""),
      record: String(r.record ?? ""),
      bbmi_rank: Number(r.bbmi_rank ?? r.ranking ?? 0),
    }));
  }, []);

  const divisions = useMemo(() => {
    const set = new Set<number>();
    normalized.forEach((t) => {
      if (!Number.isNaN(t.division)) set.add(t.division);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [normalized]);

  // Filter by division FIRST
  const filtered = useMemo(
    () => normalized.filter((t) => t.division === division),
    [normalized, division]
  );

  // Sort SECOND
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortColumn === "bbmi_rank") {
        return sortDirection === "asc"
          ? a.bbmi_rank - b.bbmi_rank
          : b.bbmi_rank - a.bbmi_rank;
      }
      if (sortColumn === "team") {
        return sortDirection === "asc"
          ? a.team.localeCompare(b.team)
          : b.team.localeCompare(a.team);
      }
      return 0;
    });
  }, [filtered, sortColumn, sortDirection]);

  // Limit to TOP 50
  const top50 = useMemo(() => sorted.slice(0, 50), [sorted]);

  useEffect(() => {
    const measure = () => {
      const w1 = rankRef.current?.offsetWidth ?? 0;
      const w2 = rankHeaderRef.current?.offsetWidth ?? 0;
      setRankWidth(Math.max(w1, w2));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [top50]);

  const handleSort = (column: "bbmi_rank" | "team") => {
    if (column === sortColumn) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortIcon = (column: "bbmi_rank" | "team") => {
    if (column !== sortColumn) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="inline-block w-4 h-4 ml-1 text-white" />
    ) : (
      <ChevronDown className="inline-block w-4 h-4 ml-1 text-white" />
    );
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight">
            WIAA | Boys Varsity Top 50 Team Rankings
          </h1>
        </div>

        {/* Division Filter */}
        <div className="rankings-table mb-2">
          <div className="rankings-scroll">
            <select
              value={division}
              onChange={(e) => setDivision(Number(e.target.value))}
              className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
            >
              {divisions.map((d) => (
                <option key={d} value={d}>
                  Division {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ⭐ Disclaimer */}
        <p className="text-xs text-stone-500 mt-[-0.25rem] mb-4">
          *Record reflects games played only against WIAA member schools.
        </p>

        {/* Rankings Table */}
        <div className="section-wrapper">
          <div className="rankings-table">
            <div className="rankings-scroll">
              <table>
                <thead>
                  <tr>
                    {/* Sticky BBMI Rank */}
                    <th
                      ref={rankHeaderRef}
                      className="sticky left-0 z-30 cursor-pointer select-none"
                      onClick={() => handleSort("bbmi_rank")}
                    >
                      BBMI Rank
                      {sortIcon("bbmi_rank") && (
                        <span className="inline-block ml-1">
                          {sortIcon("bbmi_rank")}
                        </span>
                      )}
                    </th>

                    {/* Sticky Team */}
                    <th
                      className="sticky z-30 cursor-pointer select-none"
                      style={{ left: rankWidth }}
                      onClick={() => handleSort("team")}
                    >
                      Team
                      {sortIcon("team") && (
                        <span className="inline-block ml-1">
                          {sortIcon("team")}
                        </span>
                      )}
                    </th>

                    <th className="text-right">Record</th>
                  </tr>
                </thead>

                <tbody>
                  {top50.map((row, index) => (
                    <tr
                      key={`${row.team}-${row.bbmi_rank}`}
                      className={index % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                    >
                      {/* Sticky BBMI Rank */}
                      <td
                        ref={index === 0 ? rankRef : null}
                        className="sticky left-0 z-20 bg-white/90 backdrop-blur-sm font-mono text-sm"
                      >
                        {row.bbmi_rank}
                      </td>

                      {/* Sticky Team — clickable */}
                      <td
                        className="sticky z-20 bg-white/90 backdrop-blur-sm font-medium text-stone-900 whitespace-nowrap"
                        style={{ left: rankWidth }}
                      >
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                          className="hover:underline cursor-pointer"
                        >
                          {row.team}
                        </Link>
                      </td>

                      <td className="whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {row.record || "—"}
                      </td>
                    </tr>
                  ))}

                  {top50.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-stone-500">
                        No teams found for this division.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}