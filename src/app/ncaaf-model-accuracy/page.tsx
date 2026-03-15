"use client";

import { useState, useMemo } from "react";
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
  week: number | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtLine(v: number | null): string {
  if (v == null) return "—";
  return v > 0 ? `+${v}` : String(v);
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NCAAFModelAccuracyPage() {
  const [weekFilter, setWeekFilter] = useState<number | "all">("all");
  const [edgeFilter, setEdgeFilter] = useState<number>(0);

  const allPicks = useMemo(() => (gamesData as FootballPick[]).filter(g => g.homeTeam && g.awayTeam), []);

  const completedPicks = useMemo(() => {
    return allPicks.filter(g =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.bbmifPick != null && g.vegasLine != null
    ).map(g => {
      const margin = g.actualHomeScore! - g.actualAwayScore!;
      const homeCovers = margin + g.vegasLine! > 0;
      const bbmifPickedHome = g.bbmifPick === g.homeTeam;
      const covered = bbmifPickedHome ? homeCovers : !homeCovers;
      const push = margin + g.vegasLine! === 0;
      return { ...g, covered, push };
    });
  }, [allPicks]);

  const weeks = useMemo(() => {
    const set = new Set<number>();
    completedPicks.forEach(g => { if (g.week != null) set.add(g.week); });
    return Array.from(set).sort((a, b) => a - b);
  }, [completedPicks]);

  const filtered = useMemo(() => {
    return completedPicks.filter(g => {
      if (weekFilter !== "all" && g.week !== weekFilter) return false;
      if ((g.edge ?? 0) < edgeFilter) return false;
      return true;
    }).sort((a, b) => b.gameDate.localeCompare(a.gameDate));
  }, [completedPicks, weekFilter, edgeFilter]);

  const wins = filtered.filter(g => g.covered).length;
  const losses = filtered.filter(g => !g.covered && !g.push).length;
  const pushes = filtered.filter(g => g.push).length;
  const pct = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : "—";

  const TH: React.CSSProperties = {
    backgroundColor: "#0a1a2f", color: "#ffffff",
    padding: "8px 10px", fontSize: 10.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
    position: "sticky", top: 0, zIndex: 10, whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = {
    padding: "8px 10px", fontSize: 13, borderTop: "1px solid #f0f0ef",
    whiteSpace: "nowrap", verticalAlign: "middle", textAlign: "center",
  };
  const MONO: React.CSSProperties = {
    ...TD, fontFamily: "ui-monospace, monospace", color: "#57534e",
  };

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8">

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span style={{ fontSize: "2rem" }}>🏈</span>
            <span>BBMIF Pick History</span>
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
            Every BBMIF pick logged publicly. Filter by week or edge size. No picks are removed or edited.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
          borderRadius: 10, padding: "16px 24px", textAlign: "center", marginBottom: 20,
          display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>ATS Record</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>{wins}-{losses}{pushes > 0 ? `-${pushes}` : ""}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Win %</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: Number(pct) >= 55 ? "#4ade80" : "#ffffff" }}>{pct}%</div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Games</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>{filtered.length}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#57534e" }}>Week:</label>
            <select
              value={weekFilter}
              onChange={e => setWeekFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              style={{ height: 36, border: "1.5px solid #d6d3d1", borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 600, backgroundColor: "#fff", color: "#1c1917" }}
            >
              <option value="all">All Weeks</option>
              {weeks.map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#57534e" }}>Min Edge:</label>
            <select
              value={edgeFilter}
              onChange={e => setEdgeFilter(Number(e.target.value))}
              style={{ height: 36, border: "1.5px solid #d6d3d1", borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 600, backgroundColor: "#fff", color: "#1c1917" }}
            >
              {[0, 2, 3, 5, 7].map(v => <option key={v} value={v}>{v === 0 ? "All" : `≥ ${v}`}</option>)}
            </select>
          </div>
        </div>

        {/* Picks table */}
        {filtered.length > 0 ? (
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto", maxHeight: 800, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 950 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Date</th>
                      <th style={TH}>Wk</th>
                      <th style={{ ...TH, textAlign: "left" }}>Away</th>
                      <th style={{ ...TH, textAlign: "left" }}>Home</th>
                      <th style={TH}>Score</th>
                      <th style={TH}>Vegas</th>
                      <th style={TH}>BBMIF</th>
                      <th style={TH}>Edge</th>
                      <th style={{ ...TH, textAlign: "left" }}>Pick</th>
                      <th style={TH}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((g, i) => (
                      <tr key={`${g.gameDate}-${g.homeTeam}-${i}`} style={{ backgroundColor: g.covered ? "rgba(22,163,74,0.05)" : g.push ? "rgba(234,179,8,0.05)" : "rgba(220,38,38,0.04)" }}>
                        <td style={{ ...TD, textAlign: "left", fontSize: 12, color: "#78716c" }}>{fmtDate(g.gameDate)}</td>
                        <td style={MONO}>{g.week ?? "—"}</td>
                        <td style={{ ...TD, textAlign: "left" }}>
                          <Link href={`/ncaaf-team/${encodeURIComponent(g.awayTeam)}`} style={{ textDecoration: "none", color: "#0a1a2f", display: "flex", alignItems: "center", gap: 5 }}>
                            <NCAALogo teamName={g.awayTeam} size={18} />
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{g.awayTeam}</span>
                          </Link>
                        </td>
                        <td style={{ ...TD, textAlign: "left" }}>
                          <Link href={`/ncaaf-team/${encodeURIComponent(g.homeTeam)}`} style={{ textDecoration: "none", color: "#0a1a2f", display: "flex", alignItems: "center", gap: 5 }}>
                            <NCAALogo teamName={g.homeTeam} size={18} />
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{g.homeTeam}</span>
                          </Link>
                        </td>
                        <td style={MONO}>{g.actualAwayScore}-{g.actualHomeScore}</td>
                        <td style={MONO}>{fmtLine(g.vegasLine)}</td>
                        <td style={{ ...MONO, fontWeight: 700, color: "#0a1a2f" }}>{fmtLine(g.bbmifLine)}</td>
                        <td style={{ ...MONO, fontWeight: 700, color: (g.edge ?? 0) >= 5 ? "#16a34a" : "#57534e" }}>
                          {g.edge?.toFixed(1) ?? "—"}
                        </td>
                        <td style={{ ...TD, textAlign: "left" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <NCAALogo teamName={g.bbmifPick ?? ""} size={16} />
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{g.bbmifPick}</span>
                          </div>
                        </td>
                        <td style={{
                          ...TD, fontWeight: 800, fontSize: 12,
                          color: g.covered ? "#16a34a" : g.push ? "#ca8a04" : "#dc2626",
                        }}>
                          {g.push ? "PUSH" : g.covered ? "✓ WIN" : "✗ LOSS"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
            No completed picks match the selected filters.
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
