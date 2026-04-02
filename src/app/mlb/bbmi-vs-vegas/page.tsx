"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import games from "@/data/betting-lines/mlb-games.json";
import rankingsRaw from "@/data/rankings/mlb-rankings.json";

const _bvRanks = rankingsRaw as Record<string, Record<string, unknown>>;
function bvRank(team: string): number | null {
  const r = _bvRanks[team]?.model_rank;
  return r != null ? Number(r) : null;
}

// ────────────────────────────────────────────────────────────────
// TYPES & DATA
// ────────────────────────────────────────────────────────────────

type MLBGame = {
  gameId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  bbmiTotal: number | null;
  bbmiMargin: number | null;
  bbmiHomeProj: number | null;
  bbmiAwayProj: number | null;
  vegasTotal: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  vegasWinProb: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  parkFactor: number;
};

const allGames = (() => {
  const raw = games as unknown as MLBGame[];
  const seen = new Set<string>();
  return raw.filter(g => { if (seen.has(g.gameId)) return false; seen.add(g.gameId); return true; });
})();

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

function mae(errors: number[]): number {
  if (errors.length === 0) return 0;
  return errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
}

function rmse(errors: number[]): number {
  if (errors.length === 0) return 0;
  return Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
}

// ────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  backgroundColor: "#0a1628", color: "#94a3b8", padding: "10px 12px",
  textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0,
  zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.1)",
  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", verticalAlign: "middle",
};

const TD: React.CSSProperties = {
  padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13,
  whiteSpace: "nowrap", verticalAlign: "middle",
};

const TD_MONO: React.CSSProperties = {
  ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e",
};

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

export default function BBMIvsVegasPage() {
  // ── Completed games with both BBMI and Vegas totals ──
  const completed = useMemo(() =>
    allGames.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      (g.actualHomeScore > 0 || g.actualAwayScore > 0) &&
      g.bbmiTotal != null && g.vegasTotal != null
    ),
  []);

  // ── Per-game comparison rows ──
  const rows = useMemo(() =>
    completed
      .map(g => {
        const actualTotal = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        const actualMargin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const bbmiTotal = g.bbmiTotal!;
        const vegasTotal = g.vegasTotal!;
        const bbmiTotalErr = bbmiTotal - actualTotal;
        const vegasTotalErr = vegasTotal - actualTotal;
        const bbmiMargin = g.bbmiMargin ?? 0;
        const bbmiMarginErr = bbmiMargin - actualMargin;
        // Winner prediction
        const bbmiPickHome = bbmiMargin > 0;
        const vegasPickHome = g.vegasWinProb != null ? g.vegasWinProb > 0.5 : null;
        const actualHomeWin = actualMargin > 0;
        const bbmiWinnerCorrect = actualMargin === 0 ? null : bbmiPickHome === actualHomeWin;
        const vegasWinnerCorrect = actualMargin === 0 || vegasPickHome === null ? null : vegasPickHome === actualHomeWin;
        return {
          ...g, actualTotal, actualMargin,
          bbmiTotal, vegasTotal,
          bbmiTotalErr, vegasTotalErr,
          bbmiMargin, bbmiMarginErr,
          bbmiWinnerCorrect, vegasWinnerCorrect,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
  [completed]);

  // ── Aggregate stats ──
  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    const bbmiTotalErrors = rows.map(r => r.bbmiTotalErr);
    const vegasTotalErrors = rows.map(r => r.vegasTotalErr);

    const bbmiTotalMAE = mae(bbmiTotalErrors);
    const vegasTotalMAE = mae(vegasTotalErrors);
    const bbmiTotalRMSE = rmse(bbmiTotalErrors);
    const vegasTotalRMSE = rmse(vegasTotalErrors);

    // Bias: average signed error (positive = model overestimates)
    const bbmiTotalBias = bbmiTotalErrors.reduce((s, e) => s + e, 0) / bbmiTotalErrors.length;
    const vegasTotalBias = vegasTotalErrors.reduce((s, e) => s + e, 0) / vegasTotalErrors.length;

    // Closer to actual total
    let bbmiCloser = 0, vegasCloser = 0, tied = 0;
    rows.forEach(r => {
      const bbmiAbs = Math.abs(r.bbmiTotalErr);
      const vegasAbs = Math.abs(r.vegasTotalErr);
      if (bbmiAbs < vegasAbs) bbmiCloser++;
      else if (vegasAbs < bbmiAbs) vegasCloser++;
      else tied++;
    });

    // Winner prediction accuracy
    const bbmiWinnerDecided = rows.filter(r => r.bbmiWinnerCorrect !== null);
    const bbmiWinnerCorrect = bbmiWinnerDecided.filter(r => r.bbmiWinnerCorrect).length;
    const vegasWinnerDecided = rows.filter(r => r.vegasWinnerCorrect !== null);
    const vegasWinnerCorrect = vegasWinnerDecided.filter(r => r.vegasWinnerCorrect).length;

    return {
      games: rows.length,
      bbmiTotalMAE, vegasTotalMAE,
      bbmiTotalRMSE, vegasTotalRMSE,
      bbmiTotalBias, vegasTotalBias,
      bbmiCloser, vegasCloser, tied,
      bbmiWinnerPct: bbmiWinnerDecided.length > 0 ? (bbmiWinnerCorrect / bbmiWinnerDecided.length * 100) : 0,
      vegasWinnerPct: vegasWinnerDecided.length > 0 ? (vegasWinnerCorrect / vegasWinnerDecided.length * 100) : 0,
      bbmiWinnerTotal: bbmiWinnerDecided.length,
      vegasWinnerTotal: vegasWinnerDecided.length,
    };
  }, [rows]);

  const better = (a: number, b: number, lowerIsBetter = true) => {
    if (lowerIsBetter) return a < b ? "#16a34a" : a > b ? "#dc2626" : "#57534e";
    return a > b ? "#16a34a" : a < b ? "#dc2626" : "#57534e";
  };

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#fafaf9", minHeight: "100vh" }}>
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* ── HEADER ──────────────────────────────────────── */}
        <div style={{ background: "#0a1628", borderRadius: 0, padding: "32px 24px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff" }}>
            <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" style={{ width: 36, height: 36, marginRight: 12 }} />
            <span>BBMI vs Vegas</span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
            Head-to-head comparison of BBMI projections against market lines
          </p>

        </div>

        {/* ── EARLY SEASON NOTICE ─────────────────────────── */}
        {stats && stats.games < 100 && (
          <div style={{ maxWidth: 900, margin: "0 auto 1.5rem", backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 700, marginBottom: 4 }}>Early Season &mdash; {stats.games} games</p>
              <p style={{ fontSize: "0.76rem", color: "#92400e", lineHeight: 1.55, margin: 0 }}>
                Small sample sizes produce noisy statistics. These comparisons become meaningful after 100+ completed games.
                Walk-forward validation (2024-2025) showed BBMI totals closer to actual scoring than posted lines by ~0.32 runs on average.
              </p>
            </div>
          </div>
        )}

        {/* ── SUMMARY CARDS ───────────────────────────────── */}
        {stats && (
          <div style={{ maxWidth: 900, margin: "0 auto 2rem" }}>
            {/* Total Accuracy */}
            <div style={{ backgroundColor: "#0a1a2f", borderRadius: 0, border: "2px solid #1e3a5f", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ padding: "8px 14px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                Total Projection Accuracy ({stats.games} games)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", padding: "1.25rem 1.5rem", alignItems: "center" }}>
                {/* BBMI */}
                {(() => {
                  const bbmiLeads = stats.bbmiTotalMAE < stats.vegasTotalMAE;
                  const vegasLeads = stats.vegasTotalMAE < stats.bbmiTotalMAE;
                  return (
                    <>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>BBMI</div>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: bbmiLeads ? "#facc15" : "#94a3b8", lineHeight: 1 }}>{stats.bbmiTotalMAE.toFixed(2)}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>MAE (runs)</div>
                      </div>
                      <div style={{ width: 1, height: 56, background: "rgba(255,255,255,0.1)", margin: "0 1.5rem" }} />
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>Vegas</div>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: vegasLeads ? "#facc15" : "#94a3b8", lineHeight: 1 }}>{stats.vegasTotalMAE.toFixed(2)}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>MAE (runs)</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem" }}>
              {[
                {
                  label: "RMSE",
                  bbmi: stats.bbmiTotalRMSE.toFixed(2),
                  vegas: stats.vegasTotalRMSE.toFixed(2),
                  bbmiColor: better(stats.bbmiTotalRMSE, stats.vegasTotalRMSE),
                  vegasColor: better(stats.vegasTotalRMSE, stats.bbmiTotalRMSE),
                  sub: "Root mean squared error",
                },
                {
                  label: "Bias",
                  bbmi: `${stats.bbmiTotalBias >= 0 ? "+" : ""}${stats.bbmiTotalBias.toFixed(2)}`,
                  vegas: `${stats.vegasTotalBias >= 0 ? "+" : ""}${stats.vegasTotalBias.toFixed(2)}`,
                  bbmiColor: better(Math.abs(stats.bbmiTotalBias), Math.abs(stats.vegasTotalBias)),
                  vegasColor: better(Math.abs(stats.vegasTotalBias), Math.abs(stats.bbmiTotalBias)),
                  sub: "Avg signed error (+ = over)",
                },
                {
                  label: "Closer to Actual",
                  bbmi: `${stats.bbmiCloser}`,
                  vegas: `${stats.vegasCloser}`,
                  bbmiColor: better(stats.bbmiCloser, stats.vegasCloser, false),
                  vegasColor: better(stats.vegasCloser, stats.bbmiCloser, false),
                  sub: `${stats.tied} tied`,
                },
                {
                  label: "Winner Pick %",
                  bbmi: `${stats.bbmiWinnerPct.toFixed(0)}%`,
                  vegas: `${stats.vegasWinnerPct.toFixed(0)}%`,
                  bbmiColor: better(stats.bbmiWinnerPct, stats.vegasWinnerPct, false),
                  vegasColor: better(stats.vegasWinnerPct, stats.bbmiWinnerPct, false),
                  sub: `${stats.bbmiWinnerTotal} decided games`,
                },
              ].map(c => (
                <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "0.75rem", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1e3a5f", marginBottom: 8, textAlign: "center" }}>{c.label}</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 4 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c.bbmiColor }}>{c.bbmi}</div>
                      <div style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 600 }}>BBMI</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: c.vegasColor }}>{c.vegas}</div>
                      <div style={{ fontSize: "0.58rem", color: "#94a3b8", fontWeight: 600 }}>VEGAS</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.58rem", color: "#a8a29e", textAlign: "center" }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── WALK-FORWARD REFERENCE ──────────────────────── */}
        <div style={{ maxWidth: 900, margin: "0 auto 1.5rem", backgroundColor: "#eff6ff", borderLeft: "4px solid #2563eb", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "#1e40af", textAlign: "center" }}>
          <strong>Walk-Forward Finding (2024-2025):</strong>{" "}
          Vegas systematically under-prices totals by ~0.32 runs on average. BBMI is closer to actual scoring.
          The model&apos;s edge comes from identifying games where even a conservative market has over-priced the total.
        </div>

        {/* ── GAME-BY-GAME TABLE ──────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: "0 auto 40px" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 16 }}>Game-by-Game Comparison</h2>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ overflowX: "auto", maxHeight: 700, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1300 }}>
                <thead>
                  <tr>
                    <th style={TH}>Date</th>
                    <th style={{ ...TH, textAlign: "left" }}>Away</th>
                    <th style={{ ...TH, textAlign: "left" }}>Home</th>
                    <th style={TH}>Actual Total</th>
                    <th style={TH}>BBMI Total</th>
                    <th style={TH}>Vegas Total</th>
                    <th style={TH}>BBMI Error</th>
                    <th style={TH}>Vegas Error</th>
                    <th style={TH}>Closer</th>
                    <th style={TH}>Score</th>
                    <th style={TH}>BBMI Pick</th>
                    <th style={TH}>Vegas Pick</th>
                    <th style={TH}>Winner</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={13} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No completed games with both BBMI and Vegas lines yet.</td></tr>
                  )}
                  {rows.map((r, i) => {
                    const bbmiAbs = Math.abs(r.bbmiTotalErr);
                    const vegasAbs = Math.abs(r.vegasTotalErr);
                    const closerLabel = bbmiAbs < vegasAbs ? "BBMI" : vegasAbs < bbmiAbs ? "Vegas" : "Tie";
                    const closerColor = bbmiAbs < vegasAbs ? "#16a34a" : vegasAbs < bbmiAbs ? "#dc2626" : "#94a3b8";

                    return (
                      <tr key={r.gameId} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                        <td style={{ ...TD_MONO, fontSize: 12 }}>{r.date}</td>
                        <td style={TD}>
                          <Link href={`/mlb/team/${encodeURIComponent(r.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                            <MLBLogo teamName={r.awayTeam} size={18} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>{r.awayTeam}</span>
                            {(() => { const rk = bvRank(r.awayTeam); return rk ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                          </Link>
                        </td>
                        <td style={TD}>
                          <Link href={`/mlb/team/${encodeURIComponent(r.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}>
                            <MLBLogo teamName={r.homeTeam} size={18} />
                            <span style={{ fontSize: 12 }}>{r.homeTeam}</span>
                            {(() => { const rk = bvRank(r.homeTeam); return rk ? <span style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600 }}>(#{rk})</span> : null; })()}
                          </Link>
                        </td>
                        <td style={{ ...TD_MONO, fontWeight: 800, color: "#0a1a2f", fontSize: 15 }}>{r.actualTotal}</td>
                        <td style={{ ...TD_MONO, fontWeight: 700, color: "#3b82f6" }}>{r.bbmiTotal.toFixed(1)}</td>
                        <td style={TD_MONO}>{r.vegasTotal.toFixed(1)}</td>
                        <td style={{ ...TD_MONO, fontWeight: 700, color: bbmiAbs <= vegasAbs ? "#16a34a" : "#dc2626" }}>
                          {r.bbmiTotalErr >= 0 ? "+" : ""}{r.bbmiTotalErr.toFixed(1)}
                        </td>
                        <td style={{ ...TD_MONO, fontWeight: 700, color: vegasAbs <= bbmiAbs ? "#16a34a" : "#dc2626" }}>
                          {r.vegasTotalErr >= 0 ? "+" : ""}{r.vegasTotalErr.toFixed(1)}
                        </td>
                        <td style={{ ...TD_MONO, fontWeight: 800, color: closerColor, fontSize: 12 }}>{closerLabel}</td>
                        <td style={{ ...TD_MONO, fontSize: 12 }}>{r.actualAwayScore}{"\u2013"}{r.actualHomeScore}</td>
                        {/* BBMI Pick */}
                        <td style={{ ...TD, textAlign: "center" }}>
                          {r.actualMargin === 0
                            ? <span style={{ color: "#94a3b8" }}>{"\u2014"}</span>
                            : (() => {
                                const team = r.bbmiMargin > 0 ? r.homeTeam : r.awayTeam;
                                const color = r.bbmiWinnerCorrect ? "#16a34a" : "#dc2626";
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={team}>
                                    <span style={{ borderRadius: "50%", border: `2px solid ${color}`, display: "inline-flex", padding: 1 }}>
                                      <MLBLogo teamName={team} size={20} />
                                    </span>
                                  </span>
                                );
                              })()
                          }
                        </td>
                        {/* Vegas Pick */}
                        <td style={{ ...TD, textAlign: "center" }}>
                          {r.vegasWinnerCorrect === null
                            ? <span style={{ color: "#94a3b8" }}>{"\u2014"}</span>
                            : (() => {
                                const team = (r.vegasWinProb ?? 0) > 0.5 ? r.homeTeam : r.awayTeam;
                                const color = r.vegasWinnerCorrect ? "#16a34a" : "#dc2626";
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={team}>
                                    <span style={{ borderRadius: "50%", border: `2px solid ${color}`, display: "inline-flex", padding: 1 }}>
                                      <MLBLogo teamName={team} size={20} />
                                    </span>
                                  </span>
                                );
                              })()
                          }
                        </td>
                        {/* Actual Winner */}
                        <td style={{ ...TD, textAlign: "center" }}>
                          {r.actualMargin === 0
                            ? <span style={{ color: "#94a3b8" }}>{"\u2014"}</span>
                            : (() => {
                                const team = r.actualMargin > 0 ? r.homeTeam : r.awayTeam;
                                return (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={team}>
                                    <MLBLogo teamName={team} size={22} />
                                  </span>
                                );
                              })()
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── METHODOLOGY ─────────────────────────────────── */}
        <div style={{ maxWidth: 900, margin: "0 auto 0", backgroundColor: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ padding: "10px 14px", backgroundColor: "#0a1628", color: "white", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            How to Read This Page
          </div>
          <div style={{ padding: "1.25rem 1.5rem", fontSize: "0.82rem", color: "#44403c", lineHeight: 1.65 }}>
            <p style={{ marginBottom: 12 }}>
              <strong>MAE (Mean Absolute Error)</strong> measures how far off each projection was from the actual result, on average. Lower is better.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong>RMSE (Root Mean Squared Error)</strong> penalizes large misses more heavily than MAE. A model with lower RMSE makes fewer catastrophic errors.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong>Bias</strong> shows whether projections systematically run high (positive) or low (negative). A bias near zero means the model is well-calibrated on average.
            </p>
            <p style={{ marginBottom: 12 }}>
              <strong>Closer to Actual</strong> counts how many games each source was nearer to the actual total. This is the most intuitive comparison.
            </p>
            <p style={{ marginBottom: 0 }}>
              <strong>Winner Pick %</strong> shows how often each source correctly predicted the winning team. BBMI uses its projected margin; Vegas uses implied probability from the moneyline.
            </p>
          </div>
          <div style={{ padding: "8px 14px", fontSize: "0.68rem", color: "#a8a29e", borderTop: "1px solid #e5e7eb", backgroundColor: "#fafaf9" }}>
            BBMI projections use a Negative Binomial model with FIP-based pitching, park-neutral wOBA offense, and Bayesian blending.
            Vegas lines are captured from the opening line of the day.
          </div>
        </div>

        {/* ── MODEL DEVELOPMENT STATUS ─────────────────── */}
        <div style={{ maxWidth: 900, margin: "24px auto 0", backgroundColor: "white", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ padding: "10px 14px", backgroundColor: "#0a1628", color: "white", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Model Development Status
          </div>
          <div style={{ padding: "1.25rem 1.5rem" }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1628", marginBottom: 4 }}>Phase 2 {"\u2014"} Complete (results documented)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  "Bullpen quality: analytically valid, does not improve betting performance",
                  "Starter IP projection: validated component, available for future use",
                  "Bullpen fatigue: no empirical signal (r = 0.003)",
                  "Rest and travel: no actionable signal",
                  "F5 product: does not outperform full-game product",
                ].map((item, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#57534e", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 4, padding: "3px 8px" }}>{item}</span>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1628", marginBottom: 4 }}>Phase 3 {"\u2014"} Planned</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  "Leverage context (requires entry inning data from MLB Gameday API)",
                  "Statcast batted-ball integration",
                  "Lineup-specific projections",
                  "Umpire zone adjustment",
                ].map((item, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#94a3b8", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 4, padding: "3px 8px" }}>{item}</span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ padding: "8px 14px", fontSize: "0.68rem", color: "#a8a29e", borderTop: "1px solid #e5e7eb", backgroundColor: "#fafaf9" }}>
            All Phase 2 investigations are documented in the research report with full methodology and results.
            The baseline model (Phase 1 configuration) is the production model.
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 24 }}>
          <p>
            Projections are generated before first pitch using data available through the prior day.
            Vegas lines are captured at a specific point in time and may differ from closing lines.
          </p>
          <p style={{ marginTop: 8 }}>
            <Link href="/mlb/picks" style={{ color: "#3b82f6", textDecoration: "underline" }}>
              View today&apos;s picks {"\u2192"}
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}
