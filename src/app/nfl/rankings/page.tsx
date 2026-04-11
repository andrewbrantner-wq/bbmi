"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import rankingsData from "@/data/rankings/nfl-rankings.json";
import { SPORT_ACCENT } from "@/config/nfl-thresholds";

// ── Types ────────────────────────────────────────────────────────
type TeamRating = {
  rank: number;
  team: string;
  gp: number;
  record: string;
  wins: number;
  losses: number;
  bbmiScore: number;
  adjOff: number;
  adjDef: number;
  net: number;
  sos: number;
  adjYpp: number;
  adjOppYpp: number;
  toMargin: number;
};

type SortKey = keyof TeamRating;
type SortDir = "asc" | "desc";

const allRankings = rankingsData as TeamRating[];
const accent = SPORT_ACCENT;

// ── Tooltips ─────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  rank: "BBMI power rank \u2014 based on opponent-adjusted net rating (Adj Off minus Adj Def).",
  team: "NFL team abbreviation.",
  bbmiScore: "BBMI composite score \u2014 100 = league average. Above 100 = above average team. Derived from net rating.",
  record: "Season win-loss record.",
  gp: "Games played this season.",
  sos: "Strength of Schedule \u2014 average opponent net rating. Positive = harder schedule, negative = easier schedule.",
  adjOff: "Adjusted Offensive PPG \u2014 opponent-adjusted points scored per game. Higher = better offense.",
  adjDef: "Adjusted Defensive PPG \u2014 opponent-adjusted points allowed per game. Lower = better defense.",
  net: "Net Rating \u2014 Adj Off minus Adj Def. Positive = outperforming opponents.",
  adjYpp: "Adjusted Yards Per Play (offense). Higher = more efficient offense.",
  toMargin: "Average turnover margin per game. Positive = forcing more turnovers than committing.",
};

function ColDescPortal({ tooltipId, anchorRect, onClose }: { tooltipId: string; anchorRect: DOMRect; onClose: () => void }) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (el.current && !el.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;
  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#0a1e3d", border: `1px solid ${accent}`, borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>x</button>
    </div>,
    document.body
  );
}

// ── Sortable Header ──────────────────────────────────────────────
function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: React.ReactNode; columnKey: SortKey; tooltipId?: string; align?: string;
  sortConfig: { key: SortKey; dir: SortDir }; handleSort: (k: SortKey) => void;
  activeDescId: string | null; openDesc: (id: string, rect: DOMRect) => void; closeDesc: () => void;
}) {
  const isSorted = sortConfig.key === columnKey;
  const arrow = isSorted ? (sortConfig.dir === "asc" ? " \u25B2" : " \u25BC") : "";
  return (
    <th style={{
      backgroundColor: accent, color: "#fff", padding: "8px 10px",
      textAlign: align as React.CSSProperties["textAlign"], whiteSpace: "nowrap", position: "sticky", top: 0,
      zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)",
      fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", verticalAlign: "middle", userSelect: "none",
      cursor: "pointer",
    }} onClick={(e) => {
      handleSort(columnKey);
      if (tooltipId && activeDescId !== tooltipId) {
        openDesc(tooltipId, (e.target as HTMLElement).getBoundingClientRect());
      } else {
        closeDesc();
      }
    }}>
      {label}{arrow}
    </th>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function NFLRankingsPage() {
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; dir: SortDir }>({ key: "rank", dir: "asc" });
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);

  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "rank" || key === "team" || key === "adjDef" ? "asc" : "desc" });
  }, []);

  const hasData = allRankings.length > 0;

  const ranked = useMemo(() => {
    let data = [...allRankings];
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(t => t.team.toLowerCase().includes(q));
    }
    const dir = sortConfig.dir === "asc" ? 1 : -1;
    data.sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * ((av as number) - (bv as number));
    });
    return data;
  }, [search, sortConfig]);

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id ?? null, openDesc, closeDesc };

  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* Header */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: accent, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NFL &middot; Power Rankings
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
              NFL Power Rankings
            </h1>
            <p style={{ fontSize: "0.8rem", color: "#78716c", margin: 0 }}>
              Opponent-adjusted efficiency ratings &middot; Bayesian blended with preseason priors
            </p>
          </div>

          {!hasData ? (
            <div style={{ background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12, padding: "3rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏈</div>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>Rankings Available Week 3</h2>
              <p style={{ color: "#78716c", fontSize: "0.85rem" }}>Rankings update weekly once the 2026 NFL season begins.</p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div style={{ maxWidth: 400, margin: "0 auto 1.5rem" }}>
                <input
                  type="text"
                  placeholder="Search teams..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "10px 16px", borderRadius: 8,
                    border: "1px solid #d4d2cc", backgroundColor: "#fff",
                    fontSize: 14, color: "#1c1917", outline: "none",
                  }}
                />
              </div>

              {/* Table */}
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <SortableHeader label="#" columnKey="rank" tooltipId="rank" {...headerProps} />
                        <SortableHeader label="Team" columnKey="team" tooltipId="team" align="left" {...headerProps} />
                        <SortableHeader label="BBMI" columnKey="bbmiScore" tooltipId="bbmiScore" {...headerProps} />
                        <SortableHeader label="Record" columnKey="wins" tooltipId="record" {...headerProps} />
                        <SortableHeader label="GP" columnKey="gp" tooltipId="gp" {...headerProps} />
                        <SortableHeader label="Adj Off" columnKey="adjOff" tooltipId="adjOff" {...headerProps} />
                        <SortableHeader label="Adj Def" columnKey="adjDef" tooltipId="adjDef" {...headerProps} />
                        <SortableHeader label="Net" columnKey="net" tooltipId="net" {...headerProps} />
                        <SortableHeader label="SOS" columnKey="sos" tooltipId="sos" {...headerProps} />
                        <SortableHeader label="YPP" columnKey="adjYpp" tooltipId="adjYpp" {...headerProps} />
                        <SortableHeader label="TO Margin" columnKey="toMargin" tooltipId="toMargin" {...headerProps} />
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((t, i) => {
                        // Net rating bar
                        const maxNet = Math.max(...allRankings.map(r => Math.abs(r.net)));
                        const barWidth = maxNet > 0 ? Math.abs(t.net) / maxNet * 60 : 0;
                        const barColor = t.net > 0 ? "#1a6640" : "#dc2626";

                        return (
                          <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                            <td style={{ ...TD_MONO, fontWeight: 700, color: "#78716c", width: 40 }}>{t.rank}</td>
                            <td style={TD}>
                              <Link href={`/nfl/team/${encodeURIComponent(t.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1c1917" }} className="hover:underline">
                                <NFLLogo team={t.team} size={24} />
                                <span style={{ fontWeight: 700 }}>{t.team}</span>
                              </Link>
                            </td>
                            <td style={{ ...TD_MONO, fontWeight: 700, color: t.bbmiScore >= 100 ? "#1a6640" : "#dc2626" }}>{t.bbmiScore.toFixed(1)}</td>
                            <td style={{ ...TD_MONO, fontWeight: 600 }}>{t.record}</td>
                            <td style={{ ...TD_MONO, color: "#9ca3af" }}>{t.gp}</td>
                            <td style={{ ...TD_MONO, fontWeight: 600 }}>{t.adjOff.toFixed(1)}</td>
                            <td style={{ ...TD_MONO, fontWeight: 600 }}>{t.adjDef.toFixed(1)}</td>
                            <td style={{ ...TD_MONO, fontWeight: 800, position: "relative", minWidth: 100 }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <span style={{ color: barColor, minWidth: 40, textAlign: "right" }}>
                                  {t.net > 0 ? "+" : ""}{t.net.toFixed(1)}
                                </span>
                                <div style={{ width: 60, height: 8, backgroundColor: "#f0efe9", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                                  {t.net > 0 ? (
                                    <div style={{ position: "absolute", left: "50%", width: `${barWidth / 2}%`, height: "100%", backgroundColor: barColor, borderRadius: "0 4px 4px 0" }} />
                                  ) : (
                                    <div style={{ position: "absolute", right: "50%", width: `${barWidth / 2}%`, height: "100%", backgroundColor: barColor, borderRadius: "4px 0 0 4px" }} />
                                  )}
                                  <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, backgroundColor: "#d4d2cc" }} />
                                </div>
                              </div>
                            </td>
                            <td style={{ ...TD_MONO, color: t.sos > 0 ? "#1a6640" : t.sos < 0 ? "#dc2626" : "#78716c" }}>{t.sos > 0 ? "+" : ""}{t.sos.toFixed(1)}</td>
                            <td style={TD_MONO}>{t.adjYpp.toFixed(2)}</td>
                            <td style={{ ...TD_MONO, color: t.toMargin > 0 ? "#1a6640" : t.toMargin < 0 ? "#dc2626" : "#78716c" }}>
                              {t.toMargin > 0 ? "+" : ""}{t.toMargin.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Methodology */}
              <div style={{ marginTop: "1.5rem", fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
                Ratings are opponent-adjusted with {allRankings[0]?.gp ?? 17} iterations and Bayesian preseason priors (Vegas win totals, decaying over 10 weeks).
                Adj Off = adjusted points scored per game. Adj Def = adjusted points allowed (lower is better).
                Net = Adj Off {"\u2212"} Adj Def. Click any column header for a description, click again to sort.
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
