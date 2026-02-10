"use client";

import React from "react";

type TournamentTableProps = {
  teamName: string;
  division: number;
  probabilities: {
    RegionalSemis?: number;
    RegionalChampion?: number;
    SectionalSemiFinalist?: number;
    SectionalFinalist?: number;
    StateQualifier?: number;
    StateFinalist?: number;
    StateChampion?: number;
  };
};

export default function WIAATournamentTable({ 
  teamName, 
  division,
  probabilities 
}: TournamentTableProps) {
  const formatPct = (v: number | undefined) => {
    if (v === undefined || v === null || v === 0) return "—";
    if (v < 0.001) return "<0.1%";
    return `${(v * 100).toFixed(1)}%`;
  };

  const rounds = [
    { key: "RegionalSemis", label: "Regional Semis", color: "#e0f2fe" },
    { key: "RegionalChampion", label: "Regional Finals", color: "#bae6fd" },
    { key: "SectionalSemiFinalist", label: "Sectional Semi", color: "#7dd3fc" },
    { key: "SectionalFinalist", label: "Sectional Final", color: "#38bdf8" },
    { key: "StateQualifier", label: "State Qualifier", color: "#0ea5e9" },
    { key: "StateFinalist", label: "State Final", color: "#0284c7" },
    { key: "StateChampion", label: "State Champion", color: "#0369a1" },
  ];

  return (
    <div className="mb-10">
      <h2 className="text-2xl font-bold tracking-tightest mb-4">
        Division {division} Tournament Probabilities
      </h2>

      <div className="rankings-table overflow-hidden border border-stone-200 rounded-md shadow-sm">
        <div className="rankings-scroll">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-[#0a1a2f] text-white">
                <th className="px-4 py-3 text-left">Round</th>
                <th className="px-4 py-3 text-center">Probability</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, idx) => {
                const prob = probabilities[round.key as keyof typeof probabilities];
                const pctValue = prob ? prob * 100 : 0;
                
                return (
                  <tr
                    key={round.key}
                    className={idx % 2 === 0 ? "bg-white" : "bg-stone-50"}
                  >
                    <td className="px-4 py-3 font-medium">{round.label}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-full max-w-[200px] h-6 bg-stone-200 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${Math.min(pctValue, 100)}%`,
                              backgroundColor: round.color,
                            }}
                          />
                        </div>
                        <span className="font-mono text-sm font-semibold min-w-[60px]">
                          {formatPct(prob)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-500 mt-3">
        Probabilities are based on Monte Carlo simulations using BBMI rankings and seeding.
      </p>
    </div>
  );
}
