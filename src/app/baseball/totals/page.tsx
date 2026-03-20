"use client";

import React, { useMemo } from "react";
import NCAALogo from "@/components/NCAALogo";
import games from "@/data/betting-lines/baseball-games.json";

type Game = {
  gameId: string; date: string; homeTeam: string; awayTeam: string;
  bbmiLine: number | null; vegasLine: number | null;
  bbmiTotal: number | null; vegasTotal: number | null;
  actualHomeScore: number | null; actualAwayScore: number | null;
  homeWinPct: number | null; homePitcher: string; awayPitcher: string;
};

function wilsonCI(wins: number, n: number) {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96, p = wins / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { low: Math.max(0, (c - m) / d * 100), high: Math.min(100, (c + m) / d * 100) };
}

const TH: React.CSSProperties = { backgroundColor: "#0a1628", color: "#fff", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" };
const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
const TDM: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

export default function BaseballTotalsPage() {
  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);

  const today = new Date().toLocaleDateString("en-CA");
  const todaysGames = useMemo(() =>
    allGames.filter(g => g.date?.split("T")[0] === today && g.bbmiTotal != null),
  [allGames, today]);

  const completed = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null && g.bbmiTotal != null && g.vegasTotal != null),
  [allGames]);

  // O/U record: did BBMI correctly predict over or under the Vegas total?
  const ouRecord = useMemo(() => {
    let wins = 0, losses = 0, pushes = 0;
    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      const bbmiSays = g.bbmiTotal! > g.vegasTotal! ? "over" : g.bbmiTotal! < g.vegasTotal! ? "under" : "push";
      if (bbmiSays === "push") { pushes++; return; }
      if (actual === g.vegasTotal!) { pushes++; return; }
      const actualResult = actual > g.vegasTotal! ? "over" : "under";
      if (bbmiSays === actualResult) wins++; else losses++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "—";
    const { low, high } = wilsonCI(wins, total);
    return { wins, losses, pushes, total, pct, ciLow: low, ciHigh: high };
  }, [completed]);

  // MAE for totals
  const totalMAE = useMemo(() => {
    if (completed.length === 0) return { bbmi: "—", vegas: "—" };
    let bbmiErr = 0, vegasErr = 0;
    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      bbmiErr += Math.abs(actual - g.bbmiTotal!);
      vegasErr += Math.abs(actual - g.vegasTotal!);
    });
    return { bbmi: (bbmiErr / completed.length).toFixed(2), vegas: (vegasErr / completed.length).toFixed(2) };
  }, [completed]);

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#fafaf9", minHeight: "100vh" }}>
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* HEADER */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span style={{ fontSize: "1.6rem", marginRight: 12 }}>⚾</span>
            Baseball Over/Under
          </h1>
          <p style={{ color: "#57534e", fontSize: 14, marginTop: 4 }}>BBMI projected game totals vs Vegas lines</p>
        </div>

        {/* STATS CARDS */}
        <div style={{ maxWidth: 700, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
          {[
            { value: ouRecord.total > 0 ? `${ouRecord.pct}%` : "—", label: "O/U Accuracy", sub: `${ouRecord.wins}–${ouRecord.losses}${ouRecord.pushes > 0 ? ` · ${ouRecord.pushes}P` : ""}`, color: ouRecord.total > 0 && Number(ouRecord.pct) >= 52.4 ? "#16a34a" : ouRecord.total > 0 ? "#dc2626" : "#94a3b8" },
            { value: totalMAE.bbmi, label: "BBMI MAE", sub: "runs from actual total", color: "#0a1628" },
            { value: totalMAE.vegas, label: "Vegas MAE", sub: "runs from actual total", color: "#0a1628" },
            { value: completed.length.toString(), label: "Games Tracked", sub: "with Vegas total + result", color: "#0a1628" },
          ].map(c => (
            <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.75rem 0.5rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1628", marginTop: 4 }}>{c.label}</div>
              <div style={{ fontSize: "0.6rem", color: "#78716c" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* TODAY'S TOTALS */}
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 16 }}>Today&apos;s Game Totals</h2>

        {todaysGames.length === 0 ? (
          <p style={{ textAlign: "center", color: "#78716c", fontSize: 14, marginBottom: 32 }}>No games with totals today. Totals are published by 10am CT.</p>
        ) : (
          <div style={{ maxWidth: 900, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 650 }}>
                  <thead><tr>
                    {["Away", "Home", "Pitchers", "BBMI Total", "Vegas Total", "Diff", "BBMI Call"].map(h => (
                      <th key={h} style={{ ...TH, textAlign: h === "Away" || h === "Home" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {todaysGames.map((g, i) => {
                      const diff = g.vegasTotal != null ? (g.bbmiTotal! - g.vegasTotal).toFixed(1) : "—";
                      const call = g.vegasTotal != null
                        ? (g.bbmiTotal! > g.vegasTotal ? "OVER" : g.bbmiTotal! < g.vegasTotal ? "UNDER" : "PUSH")
                        : "—";
                      const callColor = call === "OVER" ? "#dc2626" : call === "UNDER" ? "#3b82f6" : "#94a3b8";
                      return (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                          <td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><NCAALogo teamName={g.awayTeam} size={20} /><span style={{ fontWeight: 500, fontSize: 13 }}>{g.awayTeam}</span></div></td>
                          <td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><NCAALogo teamName={g.homeTeam} size={20} /><span style={{ fontWeight: 500, fontSize: 13 }}>{g.homeTeam}</span></div></td>
                          <td style={{ ...TDM, fontSize: 11, lineHeight: 1.3 }}>
                            <div style={{ color: g.awayPitcher === "TBD" ? "#d1d5db" : "#374151" }}>{g.awayPitcher}</div>
                            <div style={{ color: "#d1d5db", fontSize: 9 }}>vs</div>
                            <div style={{ color: g.homePitcher === "TBD" ? "#d1d5db" : "#374151" }}>{g.homePitcher}</div>
                          </td>
                          <td style={{ ...TDM, fontWeight: 700, fontSize: 15 }}>{g.bbmiTotal}</td>
                          <td style={TDM}>{g.vegasTotal ?? "—"}</td>
                          <td style={{ ...TDM, color: Number(diff) > 0 ? "#dc2626" : Number(diff) < 0 ? "#3b82f6" : "#94a3b8" }}>{typeof diff === "string" ? diff : (Number(diff) > 0 ? "+" : "") + diff}</td>
                          <td style={{ ...TDM, fontWeight: 700, color: callColor }}>{call}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* COMPLETED O/U TABLE */}
        {completed.length > 0 && (
          <div style={{ maxWidth: 1000, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1628", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Completed Games — Over/Under Results</div>
              <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 750 }}>
                  <thead><tr>
                    {["Date", "Away", "Home", "BBMI", "Vegas", "Call", "Actual", "Result"].map(h => (
                      <th key={h} style={{ ...TH, textAlign: h === "Away" || h === "Home" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {[...completed].sort((a, b) => b.date.localeCompare(a.date)).map((g, i) => {
                      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
                      const bbmiCall = g.bbmiTotal! > g.vegasTotal! ? "OVER" : g.bbmiTotal! < g.vegasTotal! ? "UNDER" : "PUSH";
                      const actualResult = actual > g.vegasTotal! ? "OVER" : actual < g.vegasTotal! ? "UNDER" : "PUSH";
                      const correct = bbmiCall === "PUSH" || actualResult === "PUSH" ? null : bbmiCall === actualResult;
                      return (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                          <td style={{ ...TDM, fontSize: 12 }}>{g.date}</td>
                          <td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><NCAALogo teamName={g.awayTeam} size={16} /><span style={{ fontSize: 12 }}>{g.awayTeam}</span></div></td>
                          <td style={TD}><div style={{ display: "flex", alignItems: "center", gap: 5 }}><NCAALogo teamName={g.homeTeam} size={16} /><span style={{ fontSize: 12 }}>{g.homeTeam}</span></div></td>
                          <td style={TDM}>{g.bbmiTotal}</td>
                          <td style={TDM}>{g.vegasTotal}</td>
                          <td style={{ ...TDM, fontWeight: 700, color: bbmiCall === "OVER" ? "#dc2626" : "#3b82f6" }}>{bbmiCall}</td>
                          <td style={{ ...TDM, fontWeight: 700 }}>{actual}</td>
                          <td style={{ ...TDM, fontWeight: 700, color: correct === true ? "#16a34a" : correct === false ? "#dc2626" : "#94a3b8" }}>
                            {correct === true ? "✓" : correct === false ? "✗" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
