"use client";

import { useMemo } from "react";
import rankingsData from "@/data/rankings/nfl-rankings.json";
import { SPORT_ACCENT } from "@/config/nfl-thresholds";

type TeamRanking = {
  rank?: number;
  team: string;
  gp?: number;
  adjOff: number;
  adjDef: number;
  net: number;
  adjYpp?: number;
  adjOppYpp?: number;
  toMargin?: number;
};

const allRankings = rankingsData as TeamRanking[];

export default function NFLRankingsPage() {
  const accent = SPORT_ACCENT;
  const hasData = allRankings.length > 0;

  const ranked = useMemo(() =>
    [...allRankings].sort((a, b) => b.net - a.net).map((t, i) => ({ ...t, rank: i + 1 })),
  []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1c1917", margin: 0 }}>
          NFL Power Rankings
        </h1>
        <p style={{ color: "#78716c", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Opponent-adjusted efficiency ratings
        </p>
      </div>

      {!hasData ? (
        <div style={{
          background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12,
          padding: "3rem 2rem", textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏈</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917", marginBottom: "0.5rem" }}>
            Rankings Available Week 3
          </h2>
          <p style={{ color: "#78716c", fontSize: "0.85rem" }}>
            Rankings update weekly once the 2026 NFL season begins in September.
          </p>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: accent, color: "#fff" }}>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>#</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Team</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>GP</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Adj Off</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Adj Def</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((t, i) => (
                <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "#78716c" }}>{t.rank}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: "#1c1917" }}>{t.team}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", color: "#78716c" }}>{t.gp ?? "---"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>{t.adjOff.toFixed(1)}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>{t.adjDef.toFixed(1)}</td>
                  <td style={{
                    padding: "8px 12px", textAlign: "center", fontWeight: 800,
                    color: t.net > 0 ? "#1a6640" : t.net < 0 ? "#dc2626" : "#78716c",
                  }}>
                    {t.net > 0 ? "+" : ""}{t.net.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", marginTop: "1rem" }}>
        Ratings are opponent-adjusted with Bayesian preseason priors.
        Adj Off = adjusted points scored per game. Adj Def = adjusted points allowed (lower is better).
        Net = Adj Off &minus; Adj Def.
      </p>
    </div>
  );
}
