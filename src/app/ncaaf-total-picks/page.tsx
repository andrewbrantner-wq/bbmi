"use client";

import { useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import gamesData from "@/data/betting-lines/football-games.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type FootballPick = {
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  homeRank: number | null;
  awayRank: number | null;
  bbmifLine: number | null;
  vegasLine: number | null;
  edge: number | null;
  highEdge: boolean;
  bbmifPick: string | null;
  bbmifWinPct: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  week: number | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NCAAFTotalPicksPage() {
  const picks = useMemo(() => (gamesData as FootballPick[]).filter(g => g.homeTeam && g.awayTeam), []);

  const completedPicks = useMemo(() => {
    return picks.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.bbmifPick != null && g.vegasLine != null
    );
  }, [picks]);

  // ATS results grouped by edge bucket
  const edgeBuckets = useMemo(() => {
    const buckets = [
      { label: "0–2 pts", min: 0, max: 2, wins: 0, total: 0 },
      { label: "2–4 pts", min: 2, max: 4, wins: 0, total: 0 },
      { label: "4–6 pts", min: 4, max: 6, wins: 0, total: 0 },
      { label: "6–8 pts", min: 6, max: 8, wins: 0, total: 0 },
      { label: "8+ pts",  min: 8, max: 999, wins: 0, total: 0 },
    ];
    completedPicks.forEach(g => {
      const edge = g.edge ?? 0;
      const margin = g.actualHomeScore! - g.actualAwayScore!;
      const homeCovers = margin + g.vegasLine! > 0;
      const bbmifPickedHome = g.bbmifPick === g.homeTeam;
      const covered = bbmifPickedHome ? homeCovers : !homeCovers;
      for (const b of buckets) {
        if (edge >= b.min && edge < b.max) {
          b.total++;
          if (covered) b.wins++;
          break;
        }
      }
    });
    return buckets;
  }, [completedPicks]);

  // Weekly ATS
  const weeklyAts = useMemo(() => {
    const weeks: Record<number, { wins: number; total: number }> = {};
    completedPicks.forEach(g => {
      const wk = g.week ?? 0;
      if (!weeks[wk]) weeks[wk] = { wins: 0, total: 0 };
      const margin = g.actualHomeScore! - g.actualAwayScore!;
      const homeCovers = margin + g.vegasLine! > 0;
      const bbmifPickedHome = g.bbmifPick === g.homeTeam;
      const covered = bbmifPickedHome ? homeCovers : !homeCovers;
      weeks[wk].total++;
      if (covered) weeks[wk].wins++;
    });
    return Object.entries(weeks)
      .map(([wk, data]) => ({ week: Number(wk), ...data, pct: data.total > 0 ? (data.wins / data.total * 100).toFixed(1) : "0" }))
      .sort((a, b) => a.week - b.week);
  }, [completedPicks]);

  const overallWins = edgeBuckets.reduce((s, b) => s + b.wins, 0);
  const overallTotal = edgeBuckets.reduce((s, b) => s + b.total, 0);
  const overallPct = overallTotal > 0 ? ((overallWins / overallTotal) * 100).toFixed(1) : "—";

  const TH: React.CSSProperties = {
    backgroundColor: "#0a1a2f", color: "#ffffff",
    padding: "10px 14px", fontSize: 11, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
  };
  const TD: React.CSSProperties = {
    padding: "10px 14px", fontSize: 14, textAlign: "center",
    borderTop: "1px solid #f0f0ef",
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 py-8">

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span style={{ fontSize: "2rem" }}>🏈</span>
            <span>BBMIF Model Performance</span>
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
            ATS performance broken down by edge size and week. {overallTotal} completed games tracked.
          </p>
        </div>

        {/* Overall stat */}
        <div style={{
          background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
          borderRadius: 10, padding: "20px 24px", textAlign: "center", marginBottom: 28,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Overall ATS Record</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", margin: "4px 0" }}>{overallPct}%</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{overallWins}-{overallTotal - overallWins} across {overallTotal} games</div>
        </div>

        {/* Edge bucket table */}
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0a1a2f", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          📊 ATS by Edge Size
        </h2>
        <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={TH}>Edge Range</th>
                <th style={TH}>Record</th>
                <th style={TH}>Win %</th>
                <th style={TH}>Games</th>
              </tr>
            </thead>
            <tbody>
              {edgeBuckets.map((b, i) => {
                const pct = b.total > 0 ? (b.wins / b.total * 100).toFixed(1) : "—";
                const pctNum = b.total > 0 ? b.wins / b.total * 100 : 0;
                return (
                  <tr key={b.label} style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "#fff" }}>
                    <td style={{ ...TD, fontWeight: 700, color: "#0a1a2f" }}>{b.label}</td>
                    <td style={{ ...TD, fontFamily: "ui-monospace, monospace" }}>{b.wins}-{b.total - b.wins}</td>
                    <td style={{ ...TD, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: pctNum >= 55 ? "#16a34a" : pctNum >= 52.4 ? "#ca8a04" : "#dc2626" }}>
                      {pct}{pct !== "—" ? "%" : ""}
                    </td>
                    <td style={{ ...TD, color: "#78716c" }}>{b.total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Weekly ATS table */}
        {weeklyAts.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0a1a2f", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              📅 ATS by Week
            </h2>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={TH}>Week</th>
                    <th style={TH}>Record</th>
                    <th style={TH}>Win %</th>
                    <th style={TH}>Games</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyAts.map((w, i) => {
                    const pctNum = w.total > 0 ? w.wins / w.total * 100 : 0;
                    return (
                      <tr key={w.week} style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "#fff" }}>
                        <td style={{ ...TD, fontWeight: 700, color: "#0a1a2f" }}>Week {w.week}</td>
                        <td style={{ ...TD, fontFamily: "ui-monospace, monospace" }}>{w.wins}-{w.total - w.wins}</td>
                        <td style={{ ...TD, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: pctNum >= 55 ? "#16a34a" : pctNum >= 52.4 ? "#ca8a04" : "#dc2626" }}>
                          {w.pct}%
                        </td>
                        <td style={{ ...TD, color: "#78716c" }}>{w.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {completedPicks.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
            No completed games yet. Performance data will populate after games are played and scored.
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <Link href="/ncaaf-picks" style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            ← Back to Weekly Picks
          </Link>
        </div>
      </div>
    </div>
  );
}
