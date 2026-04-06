"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import games from "@/data/betting-lines/baseball-games.json";

type Game = {
  gameId: string; date: string; homeTeam: string; awayTeam: string;
  bbmiLine: number | null; vegasLine: number | null;
  bbmiTotal: number | null; vegasTotal: number | null;
  actualHomeScore: number | null; actualAwayScore: number | null;
  homeWinPct: number | null; bbmiMoneylineHome: number | null;
};

const TH: React.CSSProperties = { backgroundColor: "#1a7a8a", color: "#ffffff", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" };
const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
const TDM: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

export default function BaseballVsVegasPage() {
  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);

  // Games with both BBMI and Vegas lines
  const withBoth = useMemo(() =>
    allGames.filter(g => g.bbmiLine != null && g.vegasLine != null),
  [allGames]);

  // Completed games with results
  const completed = useMemo(() =>
    withBoth.filter(g => g.actualHomeScore != null && g.actualAwayScore != null),
  [withBoth]);

  // Agreement analysis
  const analysis = useMemo(() => {
    let agreeSide = 0, disagreeSide = 0;
    let bbmiCloser = 0, vegasCloser = 0, tie = 0;
    let bbmiMAE = 0, vegasMAE = 0;

    completed.forEach(g => {
      const actual = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const bbmi = g.bbmiLine!;
      const vegas = g.vegasLine!;

      // Same side of the spread?
      if ((bbmi > 0 && vegas > 0) || (bbmi < 0 && vegas < 0) || (bbmi === 0 && vegas === 0)) agreeSide++;
      else disagreeSide++;

      // Who was closer to actual margin?
      const bbmiErr = Math.abs(actual - (-bbmi));  // BBMI line is from home perspective
      const vegasErr = Math.abs(actual - (-vegas));
      bbmiMAE += bbmiErr;
      vegasMAE += vegasErr;
      if (bbmiErr < vegasErr) bbmiCloser++;
      else if (vegasErr < bbmiErr) vegasCloser++;
      else tie++;
    });

    const n = completed.length;
    return {
      total: n,
      agreeSide, disagreeSide,
      agreePct: n > 0 ? ((agreeSide / n) * 100).toFixed(1) : "—",
      bbmiCloser, vegasCloser, tie,
      bbmiMAE: n > 0 ? (bbmiMAE / n).toFixed(2) : "—",
      vegasMAE: n > 0 ? (vegasMAE / n).toFixed(2) : "—",
    };
  }, [completed]);

  // Line difference distribution
  const lineDiffBuckets = useMemo(() => {
    const buckets = [
      { name: "Agree (< 0.5)", min: 0, max: 0.5, count: 0 },
      { name: "Close (0.5–1.5)", min: 0.5, max: 1.5, count: 0 },
      { name: "Moderate (1.5–3)", min: 1.5, max: 3, count: 0 },
      { name: "Large (3–5)", min: 3, max: 5, count: 0 },
      { name: "Extreme (5+)", min: 5, max: Infinity, count: 0 },
    ];
    withBoth.forEach(g => {
      const diff = Math.abs(g.bbmiLine! - g.vegasLine!);
      const b = buckets.find(b => diff >= b.min && diff < b.max);
      if (b) b.count++;
    });
    return buckets;
  }, [withBoth]);

  // Recent games table — last 30
  const recentGames = useMemo(() =>
    [...completed].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
  [completed]);

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

        {/* HEADER */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a7a8a", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NCAA Baseball {"\u00B7"} Model vs Market
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
            BBMI vs Vegas
          </h1>
          <p style={{ fontSize: 13, color: "#666", margin: "0 auto", lineHeight: 1.6 }}>How does the BBMI model compare to sportsbook lines?</p>
        </div>

        {/* COMPARISON CARDS */}
        <div style={{ maxWidth: 1100, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "0.75rem" }}>
          {[
            { value: analysis.total.toString(), label: "Games Compared", color: "#1a1a1a" },
            { value: analysis.agreePct + (analysis.total > 0 ? "%" : ""), label: "Same Side", color: "#3b82f6" },
            { value: analysis.bbmiMAE, label: "BBMI MAE", color: Number(analysis.bbmiMAE) <= Number(analysis.vegasMAE) ? "#1a7a8a" : "#dc2626" },
            { value: analysis.vegasMAE, label: "Vegas MAE", color: Number(analysis.vegasMAE) <= Number(analysis.bbmiMAE) ? "#1a7a8a" : "#dc2626" },
          ].map(c => (
            <div key={c.label} style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderTop: "4px solid #1a7a8a", borderRadius: 10, padding: "14px 14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* WHO WAS CLOSER */}
        {analysis.total > 0 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Who Was Closer to Actual Margin?</div>
              <div style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ flex: 1, padding: "16px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: analysis.bbmiCloser >= analysis.vegasCloser ? "#1a7a8a" : "#dc2626" }}>{analysis.bbmiCloser}</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#78716c", marginTop: 4 }}>BBMI Closer</div>
                </div>
                <div style={{ flex: 1, padding: "16px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#94a3b8" }}>{analysis.tie}</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#78716c", marginTop: 4 }}>Tie</div>
                </div>
                <div style={{ flex: 1, padding: "16px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: analysis.vegasCloser >= analysis.bbmiCloser ? "#1a7a8a" : "#dc2626" }}>{analysis.vegasCloser}</div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#78716c", marginTop: 4 }}>Vegas Closer</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LINE DIFFERENCE DISTRIBUTION */}
        <div style={{ maxWidth: 1100, margin: "0 auto 2rem" }}>
          <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Line Disagreement Distribution</div>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>
                {["Difference", "Games", "% of Total"].map(h => <th key={h} style={{ backgroundColor: "#1a7a8a", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lineDiffBuckets.map((b, i) => {
                  const pct = withBoth.length > 0 ? ((b.count / withBoth.length) * 100).toFixed(1) : "0";
                  return (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={{ ...TDM, fontWeight: 600 }}>{b.name}</td>
                      <td style={TDM}>{b.count}</td>
                      <td style={TDM}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CALIBRATION NOTICE */}
        <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#f0fdf4", borderLeft: "4px solid #1a7a8a", border: "1px solid #c6e0ce", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
          <p style={{ fontSize: "0.78rem", color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>
            <strong>Note:</strong> MAE (Mean Absolute Error) measures how close each model&apos;s line was to the actual game margin. Lower = more accurate. The model is in its first season — these numbers will become more meaningful as games accumulate.
          </p>
        </div>

        {/* RECENT GAMES TABLE */}
        {recentGames.length > 0 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#eae8e1", color: "#333333", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Recent Games — Line Comparison</div>
              <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 750 }}>
                  <thead><tr>
                    {["Date", "Away", "Home", "Vegas", "BBMI", "Diff", "Actual", "BBMI Err", "Vegas Err", "Closer"].map(h => (
                      <th key={h} style={{ ...TH, textAlign: h === "Away" || h === "Home" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {recentGames.map((g, i) => {
                      const actual = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
                      const bbmiErr = Math.abs(actual - (-(g.bbmiLine ?? 0)));
                      const vegasErr = Math.abs(actual - (-(g.vegasLine ?? 0)));
                      const diff = Math.abs((g.bbmiLine ?? 0) - (g.vegasLine ?? 0));
                      const closer = bbmiErr < vegasErr ? "BBMI" : vegasErr < bbmiErr ? "Vegas" : "Tie";
                      return (
                        <tr key={g.gameId} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                          <td style={{ ...TDM, fontSize: 12 }}>{g.date}</td>
                          <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={g.awayTeam} size={18} /><span style={{ fontSize: 12 }}>{g.awayTeam}</span></Link></td>
                          <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={g.homeTeam} size={18} /><span style={{ fontSize: 12 }}>{g.homeTeam}</span></Link></td>
                          <td style={TDM}>{g.vegasLine}</td>
                          <td style={TDM}>{g.bbmiLine}</td>
                          <td style={{ ...TDM, color: diff >= 3 ? "#f59e0b" : "#94a3b8", fontWeight: diff >= 3 ? 700 : 400 }}>{diff.toFixed(1)}</td>
                          <td style={{ ...TDM, fontWeight: 700 }}>{g.actualAwayScore}–{g.actualHomeScore}</td>
                          <td style={{ ...TDM, color: closer === "BBMI" ? "#1a7a8a" : "#57534e" }}>{bbmiErr.toFixed(1)}</td>
                          <td style={{ ...TDM, color: closer === "Vegas" ? "#1a7a8a" : "#57534e" }}>{vegasErr.toFixed(1)}</td>
                          <td style={{ ...TDM, fontWeight: 700, color: closer === "BBMI" ? "#1a7a8a" : closer === "Vegas" ? "#dc2626" : "#94a3b8" }}>{closer}</td>
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
