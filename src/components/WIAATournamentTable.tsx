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

function WIAATournamentTable({ division, probabilities }: WIAATournamentTableProps) {
  const rounds = [
    { label: "Regional Semis",    value: probabilities.RegionalSemis },
    { label: "Regional Finals",   value: probabilities.RegionalChampion },
    { label: "Sectional Semi",    value: probabilities.SectionalSemiFinalist },
    { label: "Sectional Final",   value: probabilities.SectionalFinalist },
    { label: "State Qualifier",   value: probabilities.StateQualifier },
    { label: "State Final",       value: probabilities.StateFinalist },
    { label: "State Champion",    value: probabilities.StateChampion },
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
              const isHighlight = round.label === "State Champion";
              return (
                <tr key={round.label} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                  <td style={{
                    padding: "8px 12px",
                    fontSize: 13, fontWeight: 600,
                    borderTop: "1px solid #f5f5f4",
                    color: isHighlight ? "#b45309" : "#1c1917",
                  }}>
                    {round.label}
                  </td>
                  <td style={{
                    padding: "8px 12px", textAlign: "right",
                    fontFamily: "ui-monospace, monospace", fontSize: 13,
                    fontWeight: isHighlight ? 800 : 600,
                    borderTop: "1px solid #f5f5f4",
                    color: isHighlight ? "#b45309" : "#44403c",
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
