"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import gamesData from "@/data/betting-lines/football-games.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type FootballPick = {
  gameDate: string;
  gameTime: string;
  homeTeam: string;
  awayTeam: string;
  homeRank: number | null;
  awayRank: number | null;
  homeBbmif: number | null;
  awayBbmif: number | null;
  bbmifLine: number | null;
  vegasLine: number | null;
  vegasWinProb: number | null;
  homeSpreadOdds: number | null;
  awaySpreadOdds: number | null;
  edge: number | null;
  highEdge: boolean;
  bbmifPick: string | null;
  bbmifWinPct: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  homeFieldAdv: number;
  byeWeekHome: boolean;
  byeWeekAway: boolean;
  altitudeAdj: number;
  neutralSite: boolean;
  week: number | null;
  // Results (added after games complete)
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
};

// ── Tooltips ──────────────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  away:       "Away team. Bye week indicator (💤) shown if the team is coming off a rest week.",
  home:       "Home team. Neutral site games are marked with (N).",
  vegasLine:  "The Vegas spread (home perspective). Negative = home favored, Positive = away favored.",
  bbmifLine:  "BBMIF's projected spread based on SP+ efficiency, YPP differential, turnover margin, and home field advantage.",
  edge:       "The difference between BBMIF's line and Vegas. Larger edge = stronger disagreement with the market.",
  bbmifPick:  "The team BBMIF projects to cover the Vegas spread.",
  bbmifWinPct:"BBMIF's estimated win probability for the picked team.",
};

// ── Tooltip Portal ────────────────────────────────────────────────────────────

function ColDescPortal({
  tooltipId, anchorRect, onClose,
}: {
  tooltipId: string; anchorRect: DOMRect; onClose: () => void;
}) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (el.current && !el.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top  = anchorRect.bottom + 6;
  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

// ── Edge color helper ─────────────────────────────────────────────────────────

function edgeColor(edge: number | null): string {
  if (edge == null) return "#a8a29e";
  if (edge >= 7) return "#16a34a";
  if (edge >= 5) return "#65a30d";
  if (edge >= 3) return "#ca8a04";
  return "#78716c";
}

function edgeBg(edge: number | null): string {
  if (edge == null) return "transparent";
  if (edge >= 7) return "rgba(22,163,74,0.08)";
  if (edge >= 5) return "rgba(101,163,13,0.06)";
  return "transparent";
}

// ── Format helpers ────────────────────────────────────────────────────────────

function fmtLine(v: number | null): string {
  if (v == null) return "—";
  return v > 0 ? `+${v}` : String(v);
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Edge filter options ───────────────────────────────────────────────────────

type EdgeOption = { label: string; min: number };
const EDGE_OPTIONS: EdgeOption[] = [
  { label: "All Games", min: 0 },
  { label: "Edge ≥ 2", min: 2 },
  { label: "Edge ≥ 3", min: 3 },
  { label: "Edge ≥ 5", min: 5 },
  { label: "Edge ≥ 7", min: 7 },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NCAAFPicksPage() {
  const [edgeOption, setEdgeOption] = useState<EdgeOption>(EDGE_OPTIONS[0]);
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc  = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const picks = useMemo(() => {
    return (gamesData as FootballPick[]).filter(
      (g) => g.homeTeam && g.awayTeam
    );
  }, []);

  const upcomingPicks = useMemo(() => {
    return picks.filter(g => g.actualHomeScore == null || g.actualAwayScore == null);
  }, [picks]);

  const completedPicks = useMemo(() => {
    return picks.filter(g => g.actualHomeScore != null && g.actualAwayScore != null);
  }, [picks]);

  const filteredUpcoming = useMemo(() => {
    return upcomingPicks
      .filter(g => (g.edge ?? 0) >= edgeOption.min)
      .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  }, [upcomingPicks, edgeOption]);

  // Group by game date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, FootballPick[]> = {};
    filteredUpcoming.forEach(g => {
      const key = g.gameDate || "Unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredUpcoming]);

  // Week number from first pick
  const currentWeek = upcomingPicks[0]?.week;

  // ATS stats from completed games
  const atsStats = useMemo(() => {
    let total = 0, wins = 0, highEdgeTotal = 0, highEdgeWins = 0;
    completedPicks.forEach(g => {
      if (g.bbmifPick == null || g.vegasLine == null || g.actualHomeScore == null || g.actualAwayScore == null) return;
      const margin = g.actualHomeScore - g.actualAwayScore;
      const homeCovers = margin + g.vegasLine > 0;
      const bbmifPickedHome = g.bbmifPick === g.homeTeam;
      const covered = bbmifPickedHome ? homeCovers : !homeCovers;
      total++;
      if (covered) wins++;
      if (g.highEdge) {
        highEdgeTotal++;
        if (covered) highEdgeWins++;
      }
    });
    return {
      total, wins,
      pct: total > 0 ? ((wins / total) * 100).toFixed(1) : "—",
      highEdgeTotal, highEdgeWins,
      highEdgePct: highEdgeTotal > 0 ? ((highEdgeWins / highEdgeTotal) * 100).toFixed(1) : "—",
    };
  }, [completedPicks]);

  // ── Table styles ────────────────────────────────────────────
  const TH: React.CSSProperties = {
    backgroundColor: "#0a1a2f", color: "#ffffff",
    padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap",
    position: "sticky", top: 0, zIndex: 20,
    borderBottom: "2px solid rgba(255,255,255,0.1)",
    fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", userSelect: "none",
  };
  const TD: React.CSSProperties = {
    padding: "8px 10px", fontSize: 13, borderTop: "1px solid #f5f5f4",
    whiteSpace: "nowrap", verticalAlign: "middle",
  };
  const MONO: React.CSSProperties = {
    ...TD, fontFamily: "ui-monospace, monospace", textAlign: "center", color: "#57534e",
  };

  function SortableHeader({ label, tooltipId, align = "center" }: { label: string; tooltipId?: string; align?: string }) {
    const thRef = useRef<HTMLTableCellElement>(null);
    const uid = tooltipId ? tooltipId + "_fp" : null;
    const descShowing = !!(uid && descPortal?.id === uid);

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!tooltipId || !TOOLTIPS[tooltipId] || !uid) return;
      if (descShowing) closeDesc();
      else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); }
    };

    return (
      <th ref={thRef} style={{ ...TH, textAlign: align as "left" | "center" | "right" }}>
        <span onClick={handleClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
      </th>
    );
  }

  return (
    <>
      {descPortal && (
        <ColDescPortal
          tooltipId={descPortal.id.split("_")[0]}
          anchorRect={descPortal.rect}
          onClose={closeDesc}
        />
      )}

      <div className="section-wrapper">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <span style={{ fontSize: "2rem" }}>🏈</span>
              <span>BBMIF{currentWeek ? ` Week ${currentWeek}` : ""} Picks</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              BBMIF line predictions for upcoming college football games — sorted by edge size.
              Larger edge = stronger model disagreement with Vegas.
            </p>
          </div>

          {/* ATS STATS BAR */}
          {atsStats.total > 0 && (
            <div style={{
              display: "flex", gap: 12, justifyContent: "center", marginBottom: 20, flexWrap: "wrap",
            }}>
              <div style={{
                background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
                borderRadius: 8, padding: "10px 20px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>Season ATS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff" }}>{atsStats.pct}%</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>{atsStats.wins}-{atsStats.total - atsStats.wins} ({atsStats.total} games)</div>
              </div>
              {atsStats.highEdgeTotal > 0 && (
                <div style={{
                  background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
                  borderRadius: 8, padding: "10px 20px", textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#86efac" }}>High Edge ATS</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff" }}>{atsStats.highEdgePct}%</div>
                  <div style={{ fontSize: 10, color: "#4ade80" }}>{atsStats.highEdgeWins}-{atsStats.highEdgeTotal - atsStats.highEdgeWins} (edge ≥ 5)</div>
                </div>
              )}
            </div>
          )}

          {/* EDGE FILTER */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <label style={{ fontSize: 14, fontWeight: 700, color: "#1c1917" }}>Filter by Edge:</label>
            <select
              value={edgeOption.label}
              onChange={(e) => setEdgeOption(EDGE_OPTIONS.find(o => o.label === e.target.value) ?? EDGE_OPTIONS[0])}
              style={{
                height: 38, border: "1.5px solid #d6d3d1", borderRadius: 8,
                padding: "0 16px", backgroundColor: "#fff", fontSize: 13,
                fontWeight: 600, color: "#1c1917", minWidth: 140,
              }}
            >
              {EDGE_OPTIONS.map(o => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
            <span style={{ fontSize: 13, color: "#57534e" }}>
              Showing <strong>{filteredUpcoming.length}</strong> of <strong>{upcomingPicks.length}</strong> games
            </span>
          </div>

          {/* PICKS TABLE — grouped by date */}
          {groupedByDate.length > 0 ? (
            groupedByDate.map(([dateKey, games]) => (
              <div key={dateKey} style={{ maxWidth: 1100, margin: "0 auto 24px" }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "#0a1a2f",
                  padding: "8px 12px", backgroundColor: "#f1f5f9",
                  borderRadius: "8px 8px 0 0", border: "1px solid #e2e8f0",
                  borderBottom: "none",
                }}>
                  📅 {fmtDate(dateKey)}
                </div>
                <div style={{ border: "1px solid #e7e5e4", borderRadius: "0 0 10px 10px", overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                      <thead>
                        <tr>
                          <SortableHeader label="Away" tooltipId="away" align="left" />
                          <SortableHeader label="Home" tooltipId="home" align="left" />
                          <SortableHeader label="Vegas Line" tooltipId="vegasLine" />
                          <SortableHeader label="BBMIF Line" tooltipId="bbmifLine" />
                          <SortableHeader label="Edge" tooltipId="edge" />
                          <SortableHeader label="BBMIF Pick" tooltipId="bbmifPick" align="left" />
                          <SortableHeader label="Win%" tooltipId="bbmifWinPct" />
                        </tr>
                      </thead>
                      <tbody>
                        {games.map((g, i) => {
                          const rowBg = edgeBg(g.edge) || (i % 2 === 0 ? "#fafaf9" : "#fff");
                          return (
                            <tr key={`${g.homeTeam}-${g.awayTeam}-${i}`} style={{ backgroundColor: rowBg }}>
                              <td style={{ ...TD, minWidth: 180 }}>
                                <Link href={`/ncaaf-team/${encodeURIComponent(g.awayTeam)}`} style={{ textDecoration: "none", color: "#0a1a2f", display: "flex", alignItems: "center", gap: 6 }}>
                                  <NCAALogo teamName={g.awayTeam} size={22} />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                      {g.awayRank && g.awayRank <= 25 ? <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 3 }}>#{g.awayRank}</span> : null}
                                      {g.awayTeam}
                                    </div>
                                    {g.byeWeekAway && <span style={{ fontSize: 9, color: "#ca8a04" }}>💤 Bye week</span>}
                                  </div>
                                </Link>
                              </td>
                              <td style={{ ...TD, minWidth: 180 }}>
                                <Link href={`/ncaaf-team/${encodeURIComponent(g.homeTeam)}`} style={{ textDecoration: "none", color: "#0a1a2f", display: "flex", alignItems: "center", gap: 6 }}>
                                  <NCAALogo teamName={g.homeTeam} size={22} />
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                                      {g.homeRank && g.homeRank <= 25 ? <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 3 }}>#{g.homeRank}</span> : null}
                                      {g.homeTeam}
                                    </div>
                                    <div style={{ fontSize: 9, color: "#94a3b8" }}>
                                      {g.neutralSite ? "(N)" : ""}
                                      {g.byeWeekHome ? " 💤 Bye week" : ""}
                                      {g.altitudeAdj > 0 ? " 🏔️" : ""}
                                    </div>
                                  </div>
                                </Link>
                              </td>
                              <td style={MONO}>{fmtLine(g.vegasLine)}</td>
                              <td style={{ ...MONO, fontWeight: 700, color: "#0a1a2f" }}>{fmtLine(g.bbmifLine)}</td>
                              <td style={{ ...MONO, fontWeight: 700, color: edgeColor(g.edge), fontSize: 14 }}>
                                {g.edge != null ? g.edge.toFixed(1) : "—"}
                              </td>
                              <td style={{ ...TD, minWidth: 140 }}>
                                {g.bbmifPick ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <NCAALogo teamName={g.bbmifPick} size={18} />
                                    <span style={{ fontWeight: 700, color: "#0a1a2f", fontSize: 13 }}>{g.bbmifPick}</span>
                                  </div>
                                ) : <span style={{ color: "#a8a29e" }}>—</span>}
                              </td>
                              <td style={{ ...MONO, fontWeight: 600, color: g.bbmifWinPct && g.bbmifWinPct >= 60 ? "#16a34a" : "#57534e" }}>
                                {fmtPct(g.bbmifWinPct)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
              {upcomingPicks.length === 0
                ? "No upcoming games in the current data. Check back after the pipeline runs."
                : "No games match the selected edge filter."}
            </div>
          )}

          {/* METHODOLOGY NOTE */}
          <div style={{
            maxWidth: 720, margin: "16px auto 40px",
            backgroundColor: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 8, padding: "12px 16px", textAlign: "center",
          }}>
            <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6 }}>
              BBMIF lines are generated from SP+ efficiency ratings, yards per play differential,
              turnover margin, home field advantage, bye week adjustments, and altitude factors.
              Lines are frozen at pipeline run time and do not change during the week.{" "}
              <Link href="/ncaaf-rankings" style={{ color: "#92400e", fontWeight: 700, textDecoration: "underline" }}>
                View full rankings →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
