import React from "react";
import wiaaScores from "@/data/wiaa-team/wiaa-scores.json";

type WIAAGame = {
  team: string;
  date: string;
  opp: string;
  result: string;
  teamScore: number | null;
  oppScore: number | null;
  [key: string]: unknown;
};

const SCORES = wiaaScores as WIAAGame[];

// Auto-detect tournament start date (same logic as bracket component)
const _marchCounts: Record<string, number> = {};
SCORES.forEach(g => {
  if (g.date.slice(5, 7) === "03") {
    _marchCounts[g.date] = (_marchCounts[g.date] ?? 0) + 1;
  }
});
const _highVolDates = Object.keys(_marchCounts).filter(d => _marchCounts[d] >= 20).sort();
const RQ_DATE = _highVolDates[0] ?? "2026-03-03";

interface WIAATournamentTableProps {
  division: number;
  teamName: string;
  probabilities: {
    RegionalQuarter: number;
    RegionalSemis: number;
    RegionalFinals: number;
    SectionalSemi: number;
    SectionalFinal: number;
    StateQualifier: number;
    StateFinalist: number;
    StateChampion: number;
  };
}

function clamp(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

function fmtPct(v: number): string {
  if (v === 0) return "0%";
  if (v < 0.001) return "<0.1%";
  return `${(v * 100).toFixed(1)}%`;
}

const ROUND_KEYS: (keyof WIAATournamentTableProps["probabilities"])[] = [
  "RegionalQuarter", "RegionalSemis", "RegionalFinals",
  "SectionalSemi", "SectionalFinal", "StateQualifier",
  "StateFinalist", "StateChampion",
];

function WIAATournamentTable({ division, teamName, probabilities }: WIAATournamentTableProps) {
  // Count tournament wins and check for elimination from actual scores
  const tourneyGames = SCORES.filter(g =>
    g.team === teamName && g.date >= RQ_DATE && g.result !== ""
  );
  const tourneyWins = tourneyGames.filter(g => g.result === "W").length;
  const hasLoss = tourneyGames.some(g => g.result === "L");

  // Walk through rounds, consuming wins only for competitive rounds.
  // Byes (prob == 1.0 in the JSON) don't consume a win.
  // This correctly handles varying bracket depths and bye structures.
  const adjusted = { ...probabilities };
  let winsRemaining = tourneyWins;

  for (let i = 0; i < ROUND_KEYS.length; i++) {
    const key = ROUND_KEYS[i];
    const prob = probabilities[key];

    if (prob === 0) continue; // team doesn't participate in this round

    if (prob >= 1.0) {
      // Bye or already guaranteed by pipeline — no win needed, already 100%
      adjusted[key] = 1.0;
      continue;
    }

    // Competitive round — need a win to advance
    if (winsRemaining > 0) {
      adjusted[key] = 1.0; // won this round
      winsRemaining--;
      continue;
    }

    // No more wins — this is as far as results take us.
    // If team has a loss, they're eliminated: zero out this and all later rounds.
    if (hasLoss) {
      for (let j = i; j < ROUND_KEYS.length; j++) {
        adjusted[ROUND_KEYS[j]] = 0;
      }
    }
    // Otherwise keep remaining probabilities as-is (games not yet played).
    break;
  }

  const rounds = [
    { label: "Regional Quarter",  value: clamp(adjusted.RegionalQuarter) },
    { label: "Regional Semis",    value: clamp(adjusted.RegionalSemis) },
    { label: "Regional Finals",   value: clamp(adjusted.RegionalFinals) },
    { label: "Sectional Semi",    value: clamp(adjusted.SectionalSemi) },
    { label: "Sectional Final",   value: clamp(adjusted.SectionalFinal) },
    { label: "State Qualifier",   value: clamp(adjusted.StateQualifier) },
    { label: "State Final",       value: clamp(adjusted.StateFinalist) },
    { label: "State Champion",    value: clamp(adjusted.StateChampion) },
  ];

  return (
    <div style={{ maxWidth: 400, margin: "0 auto 40px" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 12 }}>
        Tournament Probabilities
      </h2>
      <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{
                backgroundColor: "#0a1a2f", color: "#ffffff",
                padding: "8px 12px", textAlign: "left",
                fontSize: "0.72rem", fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                borderBottom: "2px solid rgba(255,255,255,0.1)",
              }}>
                Round
              </th>
              <th style={{
                backgroundColor: "#0a1a2f", color: "#ffffff",
                padding: "8px 12px", textAlign: "right",
                fontSize: "0.72rem", fontWeight: 700,
                letterSpacing: "0.06em", textTransform: "uppercase",
                borderBottom: "2px solid rgba(255,255,255,0.1)",
              }}>
                Probability
              </th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, i) => {
              const isChampion = round.label === "State Champion";
              return (
                <tr key={round.label} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                  <td style={{
                    padding: "8px 12px",
                    fontSize: 13, fontWeight: 600,
                    borderTop: "1px solid #f5f5f4",
                    color: isChampion ? "#b45309" : "#1c1917",
                  }}>
                    {round.label}
                  </td>
                  <td style={{
                    padding: "8px 12px", textAlign: "right",
                    fontFamily: "ui-monospace, monospace", fontSize: 13,
                    fontWeight: isChampion ? 800 : 600,
                    borderTop: "1px solid #f5f5f4",
                    color: isChampion ? "#b45309" : "#44403c",
                  }}>
                    {fmtPct(round.value)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WIAATournamentTable;
