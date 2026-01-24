"use client";

import React, { useMemo, useState } from "react";
import seedingData from "@/data/seeding/seeding.json";
import BBMILogo from "@/components/BBMILogo";

type SeedRow = {
  Team: string;
  Region?: string;
  CurrentSeed?: string | number;
  Sweet16Pct?: number;
  Elite8Pct?: number;
  FinalFourPct?: number;
  ChampionshipPct?: number;
  WinTitlePct?: number;
  [k: string]: any;
};

const COLUMNS = [
  "Team",
  "Region",
  "Seed",
  "Sweet16Pct",
  "Elite8Pct",
  "FinalFourPct",
  "ChampionshipPct",
  "WinTitlePct",
];

function fmtPct(v: unknown) {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(String(v).replace(/[%\s]/g, ""));
  if (Number.isNaN(n)) return String(v);
  if (n > 0 && n <= 1) return `${(n * 100).toFixed(1)}%`;
  if (n > 1 && n <= 100) return `${n.toFixed(1)}%`;
  return String(v);
}

export default function SeedingPage() {
  const [sortCol, setSortCol] = useState<string>("WinTitlePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows: SeedRow[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return seedingData.map((r: any) => ({
      Team: String(r.Team ?? r.team ?? ""),
      Region: String(r.Region ?? r.region ?? ""), // NEW
      CurrentSeed: r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? "",

      // RoundOf32Pct removed

      Sweet16Pct: r.Sweet16Pct ?? r.sweet16Pct ?? r.R16 ?? undefined,
      Elite8Pct: r.Elite8Pct ?? r.elite8Pct ?? r.R8 ?? undefined,
      FinalFourPct: r.FinalFourPct ?? r.finalFourPct ?? r.R4 ?? undefined,
      ChampionshipPct: r.ChampionshipPct ?? r.championshipPct ?? r.Final ?? undefined,
      WinTitlePct: r.WinTitlePct ?? r.winTitlePct ?? r.WinPct ?? undefined,

      ...r,
    }));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);

      if (Number.isFinite(an) && Number.isFinite(bn)) {
        return sortDir === "asc" ? an - bn : bn - an;
      }

      return String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
        sensitivity: "base",
      });
    });

    return copy;
  }, [rows, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  return (
    <div className="section-wrapper">
      <div className="mt-10 flex flex-col items-center mb-6">
        <BBMILogo />
        <h1 className="text-3xl font-bold mb-6">NCAA Tournament Seed and Round Predictions</h1>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* LEFT SIDE — TABLE */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm rankings-table">
              <div className="rankings-scroll overflow-x-auto">
                <table
                  className="min-w-full border-collapse-separate"
                  style={{ borderSpacing: 0 }}
                >
                  <thead>
                    <tr>
                      {COLUMNS.map((c) => (
                        <th
                          key={c}
                          className="p-2 text-left cursor-pointer sticky-header"
                          onClick={() => toggleSort(c)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{c}</span>
                            {sortCol === c && (
                              <span className="text-xs">
                                {sortDir === "asc" ? "▲" : "▼"}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {sorted.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 align-top">{r.Team}</td>
                        <td className="p-2 align-top">{r.Region}</td>
                        <td className="p-2 align-top">{r.CurrentSeed}</td>
                        <td className="p-2 align-top">{fmtPct(r.Sweet16Pct)}</td>
                        <td className="p-2 align-top">{fmtPct(r.Elite8Pct)}</td>
                        <td className="p-2 align-top">{fmtPct(r.FinalFourPct)}</td>
                        <td className="p-2 align-top">{fmtPct(r.ChampionshipPct)}</td>
                        <td className="p-2 align-top">{fmtPct(r.WinTitlePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE — Notes */}
          <aside className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-medium mb-2">Notes</h3>
            <ul className="text-sm space-y-1">
              <li>Click any column header to sort.</li>
              <li>Percent values are displayed as percentages.</li>
            </ul>
          </aside>
        </section>
      </div>
    </div>
  );
}