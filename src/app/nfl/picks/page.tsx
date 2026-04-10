"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import { useAuth } from "../../AuthContext";
import gamesData from "@/data/betting-lines/nfl-games.json";
import {
  OU_MIN_EDGE, OU_STRONG_EDGE, OU_PREMIUM_EDGE, OU_MAX_EDGE, OU_JUICE,
  SPORT_ACCENT, SPORT_LABEL,
} from "@/config/nfl-thresholds";

// ── Helpers ──────────────────────────────────────────────────
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

function calcROI(w: number, l: number): string {
  const n = w + l;
  if (n === 0) return "0.0";
  const juice = Math.abs(OU_JUICE);
  const payout = 100 / (juice / 100);
  const profit = w * payout - l * 100;
  return ((profit / (n * 100)) * 100).toFixed(1);
}

// ── Types ────────────────────────────────────────────────────
type NFLGame = {
  gameId?: string;
  date: string;
  week?: number;
  gameTimeUTC?: string;
  homeTeam: string;
  awayTeam: string;
  bbmiTotal?: number | null;
  bbmiHomeProj?: number | null;
  bbmiAwayProj?: number | null;
  vegasTotal?: number | null;
  vegasSpread?: number | null;
  bbmiSpread?: number | null;
  ouEdge?: number | null;
  ouPick?: string | null;         // "OVER" or "UNDER"
  ouConfidenceTier?: number | null;
  spreadEdge?: number | null;
  spreadPick?: string | null;     // display only
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  scheduleAdj?: number | null;
  homeRestDays?: number | null;
  awayRestDays?: number | null;
};

const allGames = gamesData as NFLGame[];

const OU_EDGE_CATEGORIES = [
  { name: "2.5\u20134.0", min: 2.5, max: 4.0, color: "#b0b8c4", width: 1.5 },
  { name: "4.0\u20135.5", min: 4.0, max: 5.5, color: "#7a9bbf", width: 2.0 },
  { name: "5.5\u20137.0", min: 5.5, max: 7.0, color: "#013369", width: 2.5 },
];

// ── Page ─────────────────────────────────────────────────────
export default function NFLPicksPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  // Split historical vs today
  const historicalGames = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null),
  []);

  const todaysGames = useMemo(() =>
    allGames.filter(g => g.date === today),
  []);

  // Check if season is active
  const hasGames = allGames.length > 0;
  const seasonActive = todaysGames.length > 0;

  // ── O/U historical stats ──
  const ouHistorical = useMemo(() => {
    const qualified = historicalGames.filter(g => {
      if (g.bbmiTotal == null || g.vegasTotal == null) return false;
      const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
      return edge >= OU_MIN_EDGE && edge <= OU_MAX_EDGE;
    });
    const wins = qualified.filter(g => {
      const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
      const call = g.bbmiTotal! < g.vegasTotal! ? "under" : "over";
      if (actual === g.vegasTotal!) return false; // push
      return call === (actual > g.vegasTotal! ? "over" : "under");
    }).length;
    const losses = qualified.length - wins;
    return {
      total: qualified.length, wins, losses,
      winPct: qualified.length > 0 ? ((wins / qualified.length) * 100).toFixed(1) : "---",
      roi: calcROI(wins, losses),
    };
  }, [historicalGames]);

  // ── Edge bucket performance ──
  const edgeBuckets = useMemo(() => {
    const cats = [
      { name: "2.5\u20134.0 pts", min: 2.5, max: 4.0, inclusive: false },
      { name: "4.0\u20135.5 pts", min: 4.0, max: 5.5, inclusive: false },
      { name: "5.5\u20137.0 pts", min: 5.5, max: OU_MAX_EDGE, inclusive: true },
    ];
    return cats.map(cat => {
      const bucket = historicalGames.filter(g => {
        if (g.bbmiTotal == null || g.vegasTotal == null) return false;
        const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
        return edge >= cat.min && (cat.inclusive ? edge <= cat.max : edge < cat.max);
      });
      const wins = bucket.filter(g => {
        const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
        const call = g.bbmiTotal! < g.vegasTotal! ? "under" : "over";
        if (actual === g.vegasTotal!) return false;
        return call === (actual > g.vegasTotal! ? "over" : "under");
      }).length;
      const losses = bucket.length - wins;
      const { low, high } = wilsonCI(wins, bucket.length);
      return {
        name: cat.name, games: bucket.length, wins,
        winPct: bucket.length > 0 ? ((wins / bucket.length) * 100).toFixed(1) : "---",
        roi: calcROI(wins, losses), ciLow: low, ciHigh: high,
      };
    });
  }, [historicalGames]);

  // ── Styles ──
  const accent = SPORT_ACCENT;
  const cardBg = "#ffffff";
  const borderColor = "#d4d2cc";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1c1917", margin: 0 }}>
          NFL Totals Picks
        </h1>
        <p style={{ color: "#78716c", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Opponent-adjusted total projections vs. Vegas lines
        </p>
      </div>

      {/* Season status */}
      {!hasGames && (
        <div style={{
          background: "#f8f7f4", border: `1px solid ${borderColor}`, borderRadius: 12,
          padding: "3rem 2rem", textAlign: "center", marginBottom: "2rem",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏈</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917", marginBottom: "0.5rem" }}>
            NFL Season Starts September 2026
          </h2>
          <p style={{ color: "#78716c", fontSize: "0.85rem", lineHeight: 1.6, maxWidth: 500, margin: "0 auto" }}>
            The NFL totals model has been validated across four seasons (2022&ndash;2025) at 56.0% ATS
            in the [2.5, 7.0] edge band. Picks will be published weekly once the 2026 season begins.
          </p>
          <div style={{
            display: "inline-block", marginTop: "1.5rem", padding: "0.5rem 1.5rem",
            background: accent, color: "#fff", borderRadius: 8, fontSize: "0.8rem", fontWeight: 700,
          }}>
            Model Status: Validated &amp; Ready
          </div>
        </div>
      )}

      {/* Historical performance summary */}
      {ouHistorical.total > 0 && (
        <div style={{
          background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12,
          padding: "1.5rem", marginBottom: "1.5rem",
        }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: accent, marginBottom: "1rem", textAlign: "center" }}>
            Historical Performance (Walk-Forward)
          </h2>
          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: Number(ouHistorical.winPct) >= 52.4 ? "#1a6640" : "#dc2626" }}>
                {ouHistorical.winPct}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#78716c" }}>ATS Win Rate</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1c1917" }}>
                {ouHistorical.total}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#78716c" }}>Games Tracked</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, color: Number(ouHistorical.roi) >= 0 ? "#1a6640" : "#dc2626" }}>
                {Number(ouHistorical.roi) >= 0 ? "+" : ""}{ouHistorical.roi}%
              </div>
              <div style={{ fontSize: "0.7rem", color: "#78716c" }}>ROI at {OU_JUICE}</div>
            </div>
          </div>
          <p style={{ fontSize: "0.68rem", color: "#78716c", textAlign: "center", marginTop: "1rem", marginBottom: 0 }}>
            Record includes games where edge {"\u2265"} {OU_MIN_EDGE} pts and {"\u2264"} {OU_MAX_EDGE} pts.
            Edges above {OU_MAX_EDGE} pts are capped (model error, not market error).
            Spreads are display-only &mdash; no wagering recommendations.
          </p>
        </div>
      )}

      {/* Edge bucket table */}
      {edgeBuckets.some(b => b.games > 0) && (
        <div style={{
          background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12,
          overflow: "hidden", marginBottom: "1.5rem",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: accent, color: "#fff" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}>Edge Size</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}>Games</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}>Win %</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}>ROI</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "0.68rem" }}>95% CI</th>
              </tr>
            </thead>
            <tbody>
              {edgeBuckets.map((b, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{b.name}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>{b.games}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: b.games > 0 && Number(b.winPct) >= 52.4 ? "#1a6640" : b.games > 0 ? "#dc2626" : "#78716c" }}>
                    {b.winPct}{b.games > 0 ? "%" : ""}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: Number(b.roi) >= 0 ? "#1a6640" : "#dc2626" }}>
                    {b.games > 0 ? `${Number(b.roi) >= 0 ? "+" : ""}${b.roi}%` : "---"}
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center", fontSize: "0.72rem", color: "#78716c" }}>
                    {b.games > 0 ? `${b.ciLow.toFixed(1)}\u2013${b.ciHigh.toFixed(1)}%` : "---"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: "0.65rem", color: "#78716c", backgroundColor: "#f8f7f4", borderTop: `1px solid ${borderColor}` }}>
                  ROI calculated at standard {"\u2212"}110 juice {"\u00B7"} Edges above {OU_MAX_EDGE} pts excluded {"\u00B7"} 95% CI uses Wilson score method.
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Today's games */}
      {seasonActive && todaysGames.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: accent, marginBottom: "1rem" }}>
            Week {todaysGames[0]?.week ?? ""} Picks
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {todaysGames.map((g, i) => {
              const hasLine = g.bbmiTotal != null && g.vegasTotal != null;
              const edge = hasLine ? Math.abs(g.bbmiTotal! - g.vegasTotal!) : 0;
              const qualifies = hasLine && edge >= OU_MIN_EDGE && edge <= OU_MAX_EDGE;
              const call = hasLine ? (g.bbmiTotal! < g.vegasTotal! ? "UNDER" : g.bbmiTotal! > g.vegasTotal! ? "OVER" : null) : null;
              const tier = edge >= OU_PREMIUM_EDGE ? 3 : edge >= OU_STRONG_EDGE ? 2 : edge >= OU_MIN_EDGE ? 1 : 0;

              return (
                <div key={i} style={{
                  background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 10,
                  borderLeft: qualifies ? `3px solid ${accent}` : `3px solid #d4d2cc`,
                  padding: "1rem 1.25rem",
                  opacity: qualifies ? 1 : 0.6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1c1917" }}>
                      {g.awayTeam} @ {g.homeTeam}
                    </span>
                    {qualifies && call && (
                      <span style={{
                        padding: "0.2rem 0.7rem", borderRadius: 6, fontSize: "0.68rem", fontWeight: 800,
                        backgroundColor: call === "UNDER" ? "#e8edf4" : "#fef3c7",
                        color: call === "UNDER" ? accent : "#92400e",
                      }}>
                        {call} {g.vegasTotal}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.75rem", color: "#78716c" }}>
                    <span>BBMI Total: <strong style={{ color: "#1c1917" }}>{g.bbmiTotal?.toFixed(1) ?? "---"}</strong></span>
                    <span>Vegas: <strong style={{ color: "#1c1917" }}>{g.vegasTotal ?? "---"}</strong></span>
                    {hasLine && <span>Edge: <strong style={{ color: qualifies ? accent : "#78716c" }}>{edge.toFixed(1)}</strong></span>}
                    {qualifies && <span>{"\u25CF".repeat(tier)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Methodology */}
      <div style={{
        background: "#f8f7f4", border: `1px solid ${borderColor}`, borderRadius: 12,
        padding: "1.5rem", marginTop: "2rem",
      }}>
        <h3 style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1c1917", marginBottom: "0.75rem" }}>
          How NFL Totals Work
        </h3>
        <div style={{ fontSize: "0.75rem", color: "#78716c", lineHeight: 1.7 }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            BBMI projects each NFL game&apos;s total scoring environment using opponent-adjusted offensive and defensive
            efficiency ratings, Bayesian preseason priors (from Vegas win totals), and schedule adjustments for bye weeks
            and short-week games.
          </p>
          <p style={{ margin: "0 0 0.5rem" }}>
            When BBMI&apos;s projected total disagrees with the Vegas total by {OU_MIN_EDGE}+ points, a pick is generated.
            Only games in the [{OU_MIN_EDGE}, {OU_MAX_EDGE}] edge band qualify &mdash; extreme disagreements (above {OU_MAX_EDGE} pts)
            correlate with model error and are excluded.
          </p>
          <p style={{ margin: 0 }}>
            Spreads are displayed for context but are not a wagering product. The model&apos;s edge is in totals only,
            validated at 56.0% ATS across four independent NFL seasons (2022&ndash;2025).
          </p>
        </div>
      </div>
    </div>
  );
}
