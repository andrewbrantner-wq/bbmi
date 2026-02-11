import React from "react";

interface WIAATournamentTableProps {
  division: number;
  probabilities: {
    RegionalSemis: number;
    RegionalChampion: number;
    SectionalSemiFinalist: number;
    SectionalFinalist: number;
    StateQualifier: number;
    StateFinalist: number;
    StateChampion: number;
  };
}

function fmtPct(v: number): string {
  if (v === 0) return "0%";
  if (v < 0.001) return "<0.1%";
  return `${(v * 100).toFixed(1)}%`;
}

function WIAATournamentTable({
  division,
  probabilities,
}: WIAATournamentTableProps) {
  const rounds = [
    { label: "Regional Semis", value: probabilities.RegionalSemis },
    { label: "Regional Finals", value: probabilities.RegionalChampion },
    { label: "Sectional Semi", value: probabilities.SectionalSemiFinalist },
    { label: "Sectional Final", value: probabilities.SectionalFinalist },
    { label: "State Qualifier", value: probabilities.StateQualifier },
    { label: "State Final", value: probabilities.StateFinalist },
    { label: "State Champion", value: probabilities.StateChampion },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold tracking-tightest mb-4">
        Tournament Probabilities
      </h2>
      
      <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
        <div className="rankings-scroll">
          <table>
            <thead>
              <tr>
                <th className="text-left">Round</th>
                <th className="text-right">Probability</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, i) => (
                <tr
                  key={round.label}
                  className={i % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                >
                  <td className="font-semibold">{round.label}</td>
                  <td className="text-right font-mono">{fmtPct(round.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default WIAATournamentTable;
