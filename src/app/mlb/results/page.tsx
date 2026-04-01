"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import games from "@/data/betting-lines/mlb-games.json";

// ────────────────────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────────────────────
const OU_MIN_EDGE = 0.83;
const RL_BASE_RATE = 64.0;
const MIN_SAMPLE_FOR_STATS = 100;

type MLBGame = {
  gameId: string;
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  bbmiTotal: number | null;
  bbmiMargin: number | null;
  vegasTotal: number | null;
  homeWinPct: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  ouEdge: number | null;
  ouPick: string | null;
  rlPick: string | null;
  rlMarginEdge: number | null;
  ouConfidenceTier: number;
  rlConfidenceTier: number;
};

const allGames = (() => {
  const raw = games as unknown as MLBGame[];
  const seen = new Set<string>();
  return raw.filter(g => { if (seen.has(g.gameId)) return false; seen.add(g.gameId); return true; });
})();

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────

function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, ((c - m) / d) * 100), high: Math.min(100, ((c + m) / d) * 100) };
}

// ────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 900, margin: "0 auto", padding: "2rem 1rem",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  color: "#1e293b",
};

const cardRow: React.CSSProperties = {
  display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 24,
};

const card = (bg: string, border: string): React.CSSProperties => ({
  flex: "1 1 200px", maxWidth: 260, padding: "1rem 1.25rem",
  borderRadius: 10, border: `1px solid ${border}`, background: bg,
  textAlign: "center",
});

const tableWrap: React.CSSProperties = {
  overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 32,
};

const th: React.CSSProperties = {
  padding: "8px 12px", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "#94a3b8", backgroundColor: "#0a1628",
  textAlign: "left", whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "7px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap",
};

// ────────────────────────────────────────────────────────────────
// PAGE
// ────────────────────────────────────────────────────────────────

export default function MLBResultsPage() {
  const [mode, setMode] = useState<"ou" | "rl">("ou");

  // ── Completed games with picks ──
  const completed = useMemo(() => {
    return allGames.filter(
      (g) => g.actualHomeScore != null && g.actualAwayScore != null
    );
  }, []);

  // ── Under results ──
  const underResults = useMemo(() => {
    return completed
      .filter((g) => g.ouPick === "UNDER" && g.vegasTotal != null)
      .map((g) => {
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        const won = actual < (g.vegasTotal ?? 0);
        return { ...g, actualTotal: actual, won };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [completed]);

  // ── Run line results ──
  const rlResults = useMemo(() => {
    return completed
      .filter((g) => g.rlPick != null)
      .map((g) => {
        const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
        const won = margin <= 1; // away +1.5 covers
        return { ...g, actualMargin: margin, won };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [completed]);

  const activeResults = mode === "ou" ? underResults : rlResults;

  // ── Summary stats ──
  const wins = activeResults.filter((r) => r.won).length;
  const total = activeResults.length;
  const ats = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  const ci = wilsonCI(wins, total);
  const belowMinSample = total < MIN_SAMPLE_FOR_STATS;

  // ── Rolling 30 ──
  const rolling30 = useMemo(() => {
    const sorted = [...activeResults].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 10) return null;
    const last30 = sorted.slice(-30);
    const w = last30.filter((r) => r.won).length;
    return { wins: w, total: last30.length, ats: ((w / last30.length) * 100).toFixed(1) };
  }, [activeResults]);

  // ── Streak ──
  const streak = useMemo(() => {
    if (activeResults.length === 0) return "";
    let count = 1;
    const dir = activeResults[0].won ? "W" : "L";
    for (let i = 1; i < activeResults.length; i++) {
      if ((activeResults[i].won ? "W" : "L") === dir) count++;
      else break;
    }
    return `${dir}${count}`;
  }, [activeResults]);

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24, background: "#0a1628", borderRadius: 12, padding: "32px 24px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#fff" }}>
          BBMI MLB — 2026 Live Performance
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0" }}>
          Live since March 30, 2026. Walk-forward validation (2024-2025) is the primary performance reference.
        </p>

        {/* Mode toggle */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 20 }}>
          {(["ou", "rl"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "6px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "#0a1628" : "#94a3b8",
                border: mode === m ? "1px solid #fff" : "1px solid #475569",
              }}
            >
              {m === "ou" ? "Over/Under" : "Run Line"}
            </button>
          ))}
        </div>
      </div>

      {/* Early season caveat */}
      {belowMinSample && (
        <div style={{
          backgroundColor: "#fffbeb", borderLeft: "4px solid #d97706",
          borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a",
          borderRadius: 8, padding: "10px 16px", fontSize: 12, color: "#92400e", marginBottom: 20,
          textAlign: "center",
        }}>
          <strong>Early season</strong> — sample too small for statistical inference ({total} picks).
          Walk-forward validation (2024-2025) remains the primary performance reference.
        </div>
      )}

      {/* Summary cards */}
      <div style={cardRow}>
        <div style={card("#0a1628", "#0a1628")}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#f0c040" }}>{ats}%</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            {mode === "ou" ? "Under ATS" : "Away +1.5 Cover Rate"}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
            {wins}W - {total - wins}L ({total} picks)
          </div>
        </div>

        <div style={card("#fff", "#e5e7eb")}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0a1a2f" }}>
            {rolling30 ? `${rolling30.ats}%` : "—"}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Last 30 Picks
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            {rolling30 ? `${rolling30.wins}W - ${rolling30.total - rolling30.wins}L` : "Not enough data"}
          </div>
        </div>

        <div style={card("#fff", "#e5e7eb")}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#0a1a2f" }}>{streak || "—"}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
            Current Streak
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
            95% CI: {ci.low.toFixed(1)}–{ci.high.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Walk-forward reference */}
      <div style={{
        backgroundColor: "#eff6ff", borderLeft: "4px solid #2563eb", borderRadius: 8,
        padding: "12px 16px", fontSize: 12, color: "#1e40af", marginBottom: 24, textAlign: "center",
      }}>
        <strong>Walk-Forward Validation (2024-2025):</strong>{" "}
        {mode === "ou"
          ? "58.8% ATS on 565 games at edge >= 0.83 runs. ROI: +12.2% at -110."
          : "69.4% cover rate on 1,897 games. +5.4 pp above 64.0% MLB base rate."
        }
      </div>

      {/* Daily record table */}
      <div style={tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Matchup</th>
              {mode === "ou" ? (
                <>
                  <th style={th}>Vegas O/U</th>
                  <th style={th}>BBMI Total</th>
                  <th style={th}>Edge</th>
                  <th style={th}>Actual</th>
                </>
              ) : (
                <>
                  <th style={th}>BBMI Pick</th>
                  <th style={th}>Margin</th>
                  <th style={th}>Tier</th>
                  <th style={th}>Final</th>
                </>
              )}
              <th style={th}>Result</th>
            </tr>
          </thead>
          <tbody>
            {activeResults.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: "center", color: "#94a3b8", padding: 24 }}>
                  No completed picks yet. Check back after today&apos;s games.
                </td>
              </tr>
            ) : (
              activeResults.map((r, i) => {
                const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
                const resultColor = r.won ? "#16a34a" : "#dc2626";
                const resultBg = r.won ? "#f0fdf4" : "#fef2f2";

                return (
                  <tr key={r.gameId + mode} style={{ background: bg }}>
                    <td style={{ ...td, fontSize: 12, color: "#64748b" }}>{r.date}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>{r.awayTeam}</span>
                      <span style={{ color: "#94a3b8", margin: "0 4px" }}>@</span>
                      <span style={{ fontWeight: 600 }}>{r.homeTeam}</span>
                    </td>
                    {mode === "ou" ? (
                      <>
                        <td style={td}>{r.vegasTotal ?? "—"}</td>
                        <td style={td}>{r.bbmiTotal ?? "—"}</td>
                        <td style={{ ...td, fontWeight: 600 }}>
                          {r.ouEdge != null ? r.ouEdge.toFixed(1) : "—"}
                        </td>
                        <td style={td}>
                          {(r.actualHomeScore ?? 0) + (r.actualAwayScore ?? 0)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...td, fontWeight: 600 }}>{r.rlPick ?? "—"}</td>
                        <td style={td}>
                          {r.rlMarginEdge != null ? r.rlMarginEdge.toFixed(2) : "—"}
                        </td>
                        <td style={td}>
                          {"●".repeat(r.rlConfidenceTier || 0)}
                        </td>
                        <td style={td}>
                          {r.actualAwayScore}–{r.actualHomeScore}
                        </td>
                      </>
                    )}
                    <td style={{
                      ...td, fontWeight: 700, color: resultColor,
                      background: resultBg, borderRadius: 4, textAlign: "center",
                    }}>
                      {r.won ? "W" : "L"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Over Watch Monitoring Section */}
      <div style={{
        backgroundColor: "#fffbeb", borderLeft: "4px solid #d97706",
        borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a",
        borderRadius: 10, padding: "16px 20px", marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>
          {"\u26A0\uFE0F"} BBMI OVER WATCH — May/June Monitoring (edge {"\u2265"} 1.25)
        </div>
        <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6 }}>
          <strong>Walk-forward signal (2024-2025):</strong> 115 games | 55.7% over ATS | both years above break-even
        </div>
        <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.6, marginTop: 4 }}>
          <strong>Status:</strong> MONITORING — not a validated product.
          Validation target: 55%+ ATS on 80+ combined May-June games across 2024, 2025, and 2026
          would trigger formal gate evaluation.
        </div>
      </div>

      {/* Methodology link */}
      <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8" }}>
        <p>
          Walk-forward results represent historical simulation using data available before each game.
          Past performance does not guarantee future results.
        </p>
        <p style={{ marginTop: 8 }}>
          <Link href="/mlb/picks" style={{ color: "#3b82f6", textDecoration: "underline" }}>
            View today&apos;s picks →
          </Link>
        </p>
      </div>
    </div>
  );
}
