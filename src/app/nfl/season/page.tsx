"use client";

import React from "react";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import seasonData from "@/data/nfl-season.json";

const ACCENT = "#013369";

type StandingsTeam = {
  team: string; teamName: string; wins: number; losses: number; ties?: number;
  pct: number; bbmiRating: number; playoffPct: number; projectedWins: number;
};

type Storyline = { type: string; text: string };

type SeasonData = {
  season: number; week: number; lastUpdated: string;
  standings: Record<string, Record<string, StandingsTeam[]>>;
  storylines: Storyline[];
};

const data = seasonData as SeasonData;

const STORYLINE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  riser: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  faller: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  overperformer: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  underperformer: { bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  insight: { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
};

function SeasonContent() {

  const hasData = data.week > 0;

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1000px] mx-auto px-6 py-8">

        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: ACCENT, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NFL Analytics {"\u00B7"} Season Dashboard
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
            {data.season} NFL Season
          </h1>
          <p style={{ fontSize: "0.8rem", color: "#78716c", margin: 0 }}>
            Week {data.week} {"\u00B7"} Standings, projections, and storylines
          </p>
        </div>

        {!hasData ? (
          <div style={{ background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12, padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\uD83C\uDFC8"}</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>Season Dashboard Available Week 1</h2>
            <p style={{ color: "#78716c", fontSize: "0.85rem" }}>Standings and projections update weekly once the 2026 NFL season begins.</p>
          </div>
        ) : (
          <>
            {/* Standings by conference */}
            {["AFC", "NFC"].map(conf => (
              <div key={conf} style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: ACCENT, marginBottom: 12 }}>{conf} Standings</h2>
                {["East", "North", "South", "West"].map(div => {
                  const teams = data.standings[conf]?.[div] || [];
                  if (teams.length === 0) return null;
                  return (
                    <div key={div} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#78716c", marginBottom: 6 }}>{conf} {div}</div>
                      <div style={{ border: "1px solid #d4d2cc", borderRadius: 8, overflow: "hidden", backgroundColor: "#fff" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                          <colgroup>
                            <col style={{ width: "auto" }} />
                            <col style={{ width: 45 }} />
                            <col style={{ width: 45 }} />
                            <col style={{ width: 35 }} />
                            <col style={{ width: 65 }} />
                            <col style={{ width: 75 }} />
                            <col style={{ width: 85 }} />
                            <col style={{ width: 70 }} />
                          </colgroup>
                          <thead>
                            <tr>
                              {["Team", "W", "L", "T", "Pct", "Rating", "Playoff %", "Proj Rec"].map(h => (
                                <th key={h} style={{
                                  backgroundColor: ACCENT, color: "#fff", padding: "6px 10px",
                                  fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase",
                                  letterSpacing: "0.08em", textAlign: h === "Team" ? "left" : "center",
                                }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {teams.map((t, i) => (
                              <tr key={t.team} style={{ backgroundColor: i === 0 ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                                <td style={{ padding: "6px 10px", fontSize: 13 }}>
                                  <Link href={`/nfl/teams/${t.team}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#1c1917", textDecoration: "none" }} className="hover:underline">
                                    <NFLLogo team={t.team} size={20} />
                                    <span style={{ fontWeight: 600 }}>{t.teamName}</span>
                                  </Link>
                                </td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 13, fontWeight: 600 }}>{t.wins}</td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 13, color: "#78716c" }}>{t.losses}</td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 13, color: t.ties ? "#d97706" : "#d4d2cc" }}>{t.ties || 0}</td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{t.pct.toFixed(3)}</td>
                                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, fontWeight: 700, color: t.bbmiRating > 0 ? "#15803d" : "#dc2626" }}>
                                  {t.bbmiRating > 0 ? "+" : ""}{t.bbmiRating.toFixed(1)}
                                </td>
                                {(
                                  <>
                                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, fontWeight: 600 }}>{t.playoffPct.toFixed(0)}%</td>
                                    <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12 }}>{Math.round(t.projectedWins)}-{17 - Math.round(t.projectedWins)}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Storylines (premium) */}
            {data.storylines.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: ACCENT, marginBottom: 12 }}>Season Storylines</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.storylines.map((s, i) => {
                    const style = STORYLINE_COLORS[s.type] || STORYLINE_COLORS.insight;
                    return (
                      <div key={i} style={{
                        background: style.bg, border: `1px solid ${style.border}`,
                        borderRadius: 8, padding: "12px 16px", fontSize: 13, color: style.color,
                        lineHeight: 1.6,
                      }}>
                        {s.text}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </>
        )}

        <div style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6, marginTop: "1rem" }}>
          Projections based on 10,000 Monte Carlo simulations using BBMI Composite Ratings.{" "}
          <Link href="/nfl/methodology" style={{ color: ACCENT }}>Methodology</Link>
        </div>
      </div>
    </div>
  );
}

export default function NFLSeasonPage() {
  return <SeasonContent />;
}
