"use client";

import React from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";

// ------------------------------------------------------------
// WILSON SCORE 95% CONFIDENCE INTERVAL
// ------------------------------------------------------------
function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, ((centre - margin) / denom) * 100),
    high: Math.min(100, ((centre + margin) / denom) * 100),
  };
}

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number;
  bbmiHomeLine: number;
  bbmiWinProb: number;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: number;
  fakeWin: number;
  vegaswinprob: number;
};

type GameWithEdge = Game & {
  edge: number;
  awayRank: number | null;
  homeRank: number | null;
};

type Props = {
  topPlays: GameWithEdge[];
  historicalWinPct: string;
  historicalWins: number;
  historicalTotal: number;
};

// ------------------------------------------------------------
// SHARED STYLES
// ------------------------------------------------------------

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "center",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "2px solid rgba(255,255,255,0.1)",
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "10px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_RIGHT: React.CSSProperties = {
  ...TD,
  textAlign: "right",
  fontFamily: "ui-monospace, monospace",
};

// ------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------

export default function BestPlaysCard({ topPlays, historicalWinPct, historicalWins, historicalTotal }: Props) {
  if (topPlays.length === 0) return null;

  const { low, high } = wilsonCI(historicalWins, historicalTotal);

  // Plays sorted by edge desc (should already be, but ensure it)
  const sorted = [...topPlays].sort((a, b) => b.edge - a.edge);

  const lockedPlays = sorted.slice(0, 2);   // top 3 — blurred
  const freePlays   = sorted.slice(2, 6);   // plays 4–6 — revealed

  const getBBMIPick = (g: GameWithEdge) => {
    if (g.bbmiHomeLine < g.vegasHomeLine) return g.home;
    if (g.bbmiHomeLine > g.vegasHomeLine) return g.away;
    return "";
  };

  return (
    <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: "left" }}>Away</th>
            <th style={{ ...TH, textAlign: "left" }}>Home</th>
            <th style={TH}>Vegas</th>
            <th style={TH}>BBMI</th>
            <th style={TH}>Edge</th>
            <th style={{ ...TH, textAlign: "left" }}>Pick</th>
          </tr>
        </thead>

        <tbody>

          {/* ── LOCKED ROWS (plays 1–3) — blurred with overlay ── */}
          {lockedPlays.map((g, i) => (
            <tr key={`locked-${i}`} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
              <td colSpan={6} style={{ padding: 0, borderTop: "1px solid #f5f5f4", position: "relative", overflow: "hidden" }}>
                {/* Blurred content underneath */}
                <div style={{
                  padding: "10px 12px",
                  display: "flex", gap: "2rem", alignItems: "center",
                  filter: "blur(4px)",
                  userSelect: "none", pointerEvents: "none",
                  opacity: 0.5,
                  fontSize: 13,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#e7e5e4" }} />
                    <span>{g.away}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 140 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", backgroundColor: "#e7e5e4" }} />
                    <span>{g.home}</span>
                  </div>
                  <span style={{ fontFamily: "ui-monospace, monospace", minWidth: 40, textAlign: "right" }}>{g.vegasHomeLine}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", minWidth: 40, textAlign: "right" }}>{g.bbmiHomeLine}</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "#15803d", minWidth: 50, textAlign: "right" }}>{g.edge.toFixed(1)}</span>
                  <span style={{ fontWeight: 600 }}>{getBBMIPick(g)}</span>
                </div>
                {/* Lock overlay */}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(90deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0.55) 100%)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      backgroundColor: "#facc15", color: "#0a1a2f",
                      borderRadius: 4, padding: "2px 8px",
                      fontSize: "0.65rem", fontWeight: 800, letterSpacing: "0.05em",
                    }}>
                      #{i + 1} PICK
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#57534e", fontWeight: 600 }}>
                      🔒 {g.edge.toFixed(1)} pt edge — subscriber only
                    </span>
                  </div>
                </div>
              </td>
            </tr>
          ))}

          {/* ── CTA ROW between locked and free ── */}
          <tr style={{ backgroundColor: "#0a1a2f" }}>
            <td colSpan={6} style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", marginBottom: "0.5rem" }}>
                <strong style={{ color: "#facc15" }}>Top {lockedPlays.length} picks locked</strong>
                {" "}· historically{" "}
                <strong style={{ color: "#4ade80" }}>{historicalWinPct}%</strong> accurate at this edge
                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem", marginLeft: 6 }}>
                  (95% CI: {low.toFixed(1)}%–{high.toFixed(1)}%)
                </span>
              </div>
              <Link
                href="/ncaa-todays-picks"
                style={{
                  display: "inline-block",
                  backgroundColor: "#facc15", color: "#0a1a2f",
                  borderRadius: 7, padding: "0.4rem 1.25rem",
                  fontSize: "0.78rem", fontWeight: 800,
                  textDecoration: "none", letterSpacing: "0.02em",
                }}
              >
                Unlock top picks →
              </Link>
            </td>
          </tr>

          {/* ── FREE ROWS (plays 4–6) — fully revealed ── */}
          {freePlays.length > 0 ? freePlays.map((g, i) => {
            const pickTeam = getBBMIPick(g);
            const pickRank = pickTeam === g.home ? g.homeRank : pickTeam === g.away ? g.awayRank : null;
            const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";

            return (
              <tr key={`free-${i}`} style={{ backgroundColor: rowBg }}>
                {/* Away */}
                <td style={TD}>
                  <Link href={`/ncaa-team/${encodeURIComponent(g.away)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                    <NCAALogo teamName={g.away} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {g.away}
                      {g.awayRank !== null && (
                        <span style={{ marginLeft: 4, fontSize: "0.65rem", fontStyle: "italic", fontWeight: g.awayRank <= 25 ? 700 : 400, color: g.awayRank <= 25 ? "#dc2626" : "#78716c" }}>
                          (#{g.awayRank})
                        </span>
                      )}
                    </span>
                  </Link>
                </td>

                {/* Home */}
                <td style={TD}>
                  <Link href={`/ncaa-team/${encodeURIComponent(g.home)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                    <NCAALogo teamName={g.home} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      {g.home}
                      {g.homeRank !== null && (
                        <span style={{ marginLeft: 4, fontSize: "0.65rem", fontStyle: "italic", fontWeight: g.homeRank <= 25 ? 700 : 400, color: g.homeRank <= 25 ? "#dc2626" : "#78716c" }}>
                          (#{g.homeRank})
                        </span>
                      )}
                    </span>
                  </Link>
                </td>

                {/* Vegas */}
                <td style={TD_RIGHT}>{g.vegasHomeLine}</td>

                {/* BBMI */}
                <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>

                {/* Edge */}
                <td style={{ ...TD_RIGHT, fontWeight: 700, color: "#374151" }}>
                  {g.edge.toFixed(1)}
                </td>

                {/* Pick */}
                <td style={TD}>
                  {pickTeam && (
                    <Link href={`/ncaa-team/${encodeURIComponent(pickTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                      <NCAALogo teamName={pickTeam} size={20} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>
                        {pickTeam}
                        {pickRank !== null && (
                          <span style={{ marginLeft: 4, fontSize: "0.65rem", fontStyle: "italic", fontWeight: pickRank <= 25 ? 700 : 400, color: pickRank <= 25 ? "#dc2626" : "#78716c" }}>
                            (#{pickRank})
                          </span>
                        )}
                      </span>
                    </Link>
                  )}
                </td>
              </tr>
            );
          }) : (
            // If fewer than 4 total plays, show a note
            <tr>
              <td colSpan={6} style={{ ...TD, textAlign: "center", color: "#78716c", fontStyle: "italic" }}>
                Subscribe to see all picks for today
              </td>
            </tr>
          )}

        </tbody>

        <tfoot>
          <tr>
            <td colSpan={6} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4", fontStyle: "italic" }}>
              Win rate climbs to {historicalWinPct}% (95% CI: {low.toFixed(1)}%–{high.toFixed(1)}%) when BBMI edge ≥ 6.5 pts across {historicalTotal.toLocaleString()} picks · Past results are not indicative of future performance
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
