"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import BBMILogo from "@/components/BBMILogo";
import wiaaData from "@/data/wiaa-rankings/WIAArankings.json";

type WIAARow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
};

export default function WIAARankingsPage() {
  const [division, setDivision] = useState(1);

  // Normalize JSON
  const normalized = useMemo<WIAARow[]>(() => {
    const raw = wiaaData as any[];
    return raw.map((r) => ({
      division: Number(r.division),
      team: String(r.team ?? ""),
      record: String(r.record ?? ""),
      bbmi_rank: Number(r.bbmi_rank ?? r.ranking ?? 0),
    }));
  }, []);

  // Build division list
  const divisions = useMemo(() => {
    const set = new Set<number>();
    normalized.forEach((t) => {
      if (!Number.isNaN(t.division)) set.add(t.division);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [normalized]);

  // Filter by division
  const filtered = useMemo(
    () => normalized.filter((t) => t.division === division),
    [normalized, division]
  );

  // Sort alphabetically by team
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.team.localeCompare(b.team));
  }, [filtered]);

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />
          <h1 className="text-3xl font-bold tracking-tightest leading-tight">
            WIAA | Click School Name for Boys Varsity Team Page
          </h1>
        </div>

        {/* Division Filter */}
        <div className="rankings-table mb-6">
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

        {/* Rankings Table */}
        <div className="section-wrapper">
          <div className="rankings-table">
            <div className="rankings-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="text-left">Team</th>
                    <th className="text-right">Record</th>
                  </tr>
                </thead>

                <tbody>
                  {sorted.map((row, index) => (
                    <tr
                      key={`${row.team}-${row.bbmi_rank}`}
                      className={index % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                    >
                      {/* Team (clickable) */}
                      <td className="font-medium text-stone-900 whitespace-nowrap">
                        <Link
                          href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                          className="hover:underline cursor-pointer"
                        >
                          {row.team}
                        </Link>
                      </td>

                      {/* Record */}
                      <td className="whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {row.record || "—"}
                      </td>
                    </tr>
                  ))}

                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-center py-6 text-stone-500">
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