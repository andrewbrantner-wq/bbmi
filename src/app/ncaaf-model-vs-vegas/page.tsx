"use client";

import { useMemo } from "react";
import Link from "next/link";
import gamesData from "@/data/betting-lines/football-games.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type FootballPick = {
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  bbmifLine: number | null;
  vegasLine: number | null;
  edge: number | null;
  highEdge: boolean;
  bbmifPick: string | null;
  bbmifWinPct: number | null;
  homeWinPct: number | null;
  week: number | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NCAAFModelVsVegasPage() {
  const allPicks = useMemo(() => (gamesData as unknown as FootballPick[]).filter(g => g.homeTeam && g.awayTeam), []);

  const completed = useMemo(() => {
    return allPicks.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.bbmifLine != null && g.vegasLine != null
    ).map(g => {
      const actualMargin = g.actualHomeScore! - g.actualAwayScore!;
      const bbmifError = Math.abs(actualMargin - (-g.bbmifLine!));
      const vegasError = Math.abs(actualMargin - (-g.vegasLine!));
      const homeCovers = actualMargin + g.vegasLine! > 0;
      const bbmifPickedHome = g.bbmifPick === g.homeTeam;
      const bbmifCovered = bbmifPickedHome ? homeCovers : !homeCovers;
      return { ...g, actualMargin, bbmifError, vegasError, bbmifCovered };
    });
  }, [allPicks]);

  // Aggregate stats
  const stats = useMemo(() => {
    if (completed.length === 0) return null;

    const bbmifMAE = completed.reduce((s, g) => s + g.bbmifError, 0) / completed.length;
    const vegasMAE = completed.reduce((s, g) => s + g.vegasError, 0) / completed.length;

    const bbmifCloser = completed.filter(g => g.bbmifError < g.vegasError).length;
    const vegasCloser = completed.filter(g => g.vegasError < g.bbmifError).length;
    const ties = completed.filter(g => g.bbmifError === g.vegasError).length;

    const bbmifAtsWins = completed.filter(g => g.bbmifCovered).length;
    const bbmifAtsPct = ((bbmifAtsWins / completed.length) * 100).toFixed(1);

    // High edge subset
    const highEdge = completed.filter(g => (g.edge ?? 0) >= 5);
    const highEdgeWins = highEdge.filter(g => g.bbmifCovered).length;
    const highEdgePct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "—";

    // BBMIF closer by edge bucket
    const buckets = [
      { label: "All games", games: completed },
      { label: "Edge ≥ 2", games: completed.filter(g => (g.edge ?? 0) >= 2) },
      { label: "Edge ≥ 5", games: completed.filter(g => (g.edge ?? 0) >= 5) },
      { label: "Edge ≥ 7", games: completed.filter(g => (g.edge ?? 0) >= 7) },
    ].map(b => ({
      label: b.label,
      total: b.games.length,
      bbmifCloser: b.games.filter(g => g.bbmifError < g.vegasError).length,
      vegasCloser: b.games.filter(g => g.vegasError < g.bbmifError).length,
      bbmifAts: b.games.filter(g => g.bbmifCovered).length,
      bbmifAtsPct: b.games.length > 0 ? ((b.games.filter(g => g.bbmifCovered).length / b.games.length) * 100).toFixed(1) : "—",
    }));

    return { bbmifMAE, vegasMAE, bbmifCloser, vegasCloser, ties, bbmifAtsPct, highEdgePct, highEdgeTotal: highEdge.length, total: completed.length, buckets };
  }, [completed]);

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
            <span>BBMIF vs Vegas</span>
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
            How does BBMIF&apos;s predicted margin compare to the Vegas line? Who gets closer to the actual result?
          </p>
        </div>

        {stats ? (
          <>
            {/* Head-to-head stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
              <div style={{
                background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
                borderRadius: 10, padding: "20px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#e8b830" }}>BBMIF</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", margin: "4px 0" }}>{stats.bbmifMAE.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Mean Absolute Error</div>
                <div style={{ fontSize: 13, color: "#e8b830", fontWeight: 700, marginTop: 6 }}>{stats.bbmifAtsPct}% ATS</div>
              </div>
              <div style={{
                background: "linear-gradient(135deg, #292524 0%, #44403c 100%)",
                borderRadius: 10, padding: "20px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#a8a29e" }}>Vegas</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", margin: "4px 0" }}>{stats.vegasMAE.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "#a8a29e" }}>Mean Absolute Error</div>
                <div style={{ fontSize: 13, color: "#a8a29e", fontWeight: 700, marginTop: 6 }}>Baseline</div>
              </div>
            </div>

            {/* Closer to actual */}
            <div style={{
              backgroundColor: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 10, padding: "16px 20px", marginBottom: 28, textAlign: "center",
            }}>
              <div style={{ fontSize: 13, color: "#57534e", marginBottom: 8 }}>
                Out of <strong>{stats.total}</strong> games, who was closer to the actual margin?
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e8b830" }}>{stats.bbmifCloser}</div>
                  <div style={{ fontSize: 11, color: "#78716c" }}>BBMIF closer</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#78716c" }}>{stats.vegasCloser}</div>
                  <div style={{ fontSize: 11, color: "#78716c" }}>Vegas closer</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#a8a29e" }}>{stats.ties}</div>
                  <div style={{ fontSize: 11, color: "#78716c" }}>Tie</div>
                </div>
              </div>
            </div>

            {/* ATS by edge bucket */}
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0a1a2f", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              📊 ATS Performance by Edge
            </h2>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: 28, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    <th style={TH}>Edge Filter</th>
                    <th style={TH}>Games</th>
                    <th style={TH}>BBMIF ATS</th>
                    <th style={TH}>BBMIF Closer</th>
                    <th style={TH}>Vegas Closer</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.buckets.map((b, i) => (
                    <tr key={b.label} style={{ backgroundColor: i % 2 === 0 ? "#fafaf9" : "#fff" }}>
                      <td style={{ ...TD, fontWeight: 700, color: "#0a1a2f" }}>{b.label}</td>
                      <td style={{ ...TD, color: "#78716c" }}>{b.total}</td>
                      <td style={{ ...TD, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: Number(b.bbmifAtsPct) >= 55 ? "#16a34a" : "#57534e" }}>
                        {b.bbmifAtsPct}%
                      </td>
                      <td style={{ ...TD, fontFamily: "ui-monospace, monospace", color: "#e8b830", fontWeight: 600 }}>
                        {b.bbmifCloser} ({b.total > 0 ? ((b.bbmifCloser / b.total) * 100).toFixed(0) : 0}%)
                      </td>
                      <td style={{ ...TD, fontFamily: "ui-monospace, monospace", color: "#78716c" }}>
                        {b.vegasCloser} ({b.total > 0 ? ((b.vegasCloser / b.total) * 100).toFixed(0) : 0}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Honest bottom line */}
            <div style={{
              backgroundColor: "#fffbeb", borderRadius: 10, padding: "14px 18px",
              border: "1px solid #fde68a", marginBottom: 28,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>The honest bottom line</div>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                Vegas closing lines are extremely efficient — they incorporate sharp money from professional bettors.
                BBMIF doesn&apos;t need to beat Vegas&apos;s closing line on accuracy. It needs to beat the
                <em> opening line</em> often enough to clear the 52.4% breakeven threshold.
                The edge filter shows where the model disagrees most — and historically, that&apos;s where the profit is.
              </p>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
            No completed games with both BBMIF and Vegas lines available. Data will populate after games are played.
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
