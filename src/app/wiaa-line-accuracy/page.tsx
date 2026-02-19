"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import ncaaGames from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type RawGame = {
  team: string;
  teamDiv: string;
  date: string;
  opp: string;
  oppDiv: string;
  location: string;
  result: string;
  teamScore: number | string;
  oppScore: number | string;
  teamLine: number | null;
  teamWinPct: number | string;
};

type LineGame = {
  date: string;
  home: string;
  away: string;
  homeDiv: number;
  predictedLine: number;   // teamLine (home perspective, negative = home favored)
  actualMargin: number;    // oppScore - teamScore (negative = home won by more)
  error: number;           // predictedLine - actualMargin (near 0 = accurate)
  absError: number;
};

type NcaaGame = {
  vegasHomeLine: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const normalizeDate = (d: string) => d?.split(" ")[0].split("T")[0] ?? "";

const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
};

const signedFixed = (n: number, dec = 1) =>
  n > 0 ? `+${n.toFixed(dec)}` : n.toFixed(dec);

const sectionStyle: React.CSSProperties = {
  width: "fit-content",
  maxWidth: "100%",
  minWidth: "min(680px, 100%)",
  margin: "0 auto 2rem auto",
  overflow: "hidden",
  border: "1px solid #e7e5e4",
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
};

const sectionHeaderStyle: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "white",
  padding: "0.75rem 1rem",
  fontWeight: 600,
  fontSize: "0.875rem",
  textAlign: "center",
  letterSpacing: "0.05em",
};

// ------------------------------------------------------------
// TOOLTIPS + PORTAL
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  date: "Date the game was played.",
  matchup: "Away team @ Home team. Division shown in parentheses.",
  predicted: "BBMI's predicted home line. Negative = home team favored (e.g. -8.5 means home favored by 8.5).",
  actual: "Actual margin from home team's perspective: Away Score − Home Score. Negative = home team won by more.",
  error: "Predicted line minus actual margin. Near zero = accurate. Positive = BBMI overestimated the home team's advantage; negative = underestimated.",
  absError: "Absolute value of the error. How many points off the prediction was, regardless of direction.",
  div: "WIAA division (1–5).",
  avgError: "Average signed error across all games in this group. Near zero = well-calibrated (over- and under-predictions cancel out).",
  avgAbsError: "Average absolute error — how far off predictions were on average, regardless of direction. Lower is better.",
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
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

function DescHeader({ label, tooltipId, descPortal, openDesc, closeDesc, align = "center" }: {
  label: string; tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
  align?: "center" | "left";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId + "_wla";
  const descShowing = descPortal?.id === uid;
  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#fff", padding: "0.6rem 0.75rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, textAlign: align, whiteSpace: "nowrap" }}>
      <span
        onClick={(e) => { e.stopPropagation(); if (descShowing) closeDesc(); else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); } }}
        style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
      >{label}</span>
    </th>
  );
}

// ------------------------------------------------------------
// HOW TO USE ACCORDION
// ------------------------------------------------------------

function HowToUseAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "2rem" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}
      >
        <span>📖 How do I use this page?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>
            This page measures how accurately BBMI's predicted <strong>point spread</strong> matches the actual margin of victory — separate from simply picking the right winner.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Sign convention:</strong> A negative line means the home team is favored (e.g. −8.5 = home favored by 8.5). The actual margin uses the same convention: negative means the home team won by more points than the away team (Away − Home). So if both are −8, the prediction was perfect.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Error</strong> = Predicted Line − Actual Margin. A positive error means BBMI overestimated the home team's edge; negative means it underestimated. The <strong>Avg Error</strong> tells you about systematic bias — if it's near zero, the model isn't consistently leaning one way. The <strong>Avg Abs Error</strong> tells you how far off predictions are on average regardless of direction.
          </p>
          <p style={{ marginBottom: 0 }}>
            The game detail table shows every completed game this season. Click any column header to learn what it means.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER FOR DETAIL TABLE
// ------------------------------------------------------------

type SortCol = "date" | "matchup" | "predicted" | "actual" | "error" | "absError";

function SortableHeader({ label, col, sortCol, sortDir, onSort, tooltipId, descPortal, openDesc, closeDesc, align = "center" }: {
  label: string; col: SortCol; sortCol: SortCol; sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
  tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
  align?: "center" | "left";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId + "_wla_sort";
  const descShowing = descPortal?.id === uid;
  const active = sortCol === col;

  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#fff", padding: "0.6rem 0.75rem", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, textAlign: align, whiteSpace: "nowrap", userSelect: "none" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <span
          onClick={(e) => { e.stopPropagation(); if (descShowing) closeDesc(); else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); } }}
          style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
        >{label}</span>
        <span
          onClick={() => onSort(col)}
          style={{ cursor: "pointer", opacity: active ? 1 : 0.45, fontSize: 10 }}
        >{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
      </span>
    </th>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAALineAccuracyPage() {
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const hp = { descPortal, openDesc, closeDesc };

  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [divFilter, setDivFilter] = useState<number | "all">("all");

  const handleSort = useCallback((col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
      else setSortDir("desc");
      return col;
    });
  }, []);

  // Build deduplicated completed games with line data
  const allGames = useMemo<LineGame[]>(() => {
    const seen = new Set<string>();
    const result: LineGame[] = [];

    (wiaaTeams as RawGame[])
      .filter((g) =>
        g.location === "Home" &&
        g.result && g.result.trim() !== "" &&
        g.teamLine !== null && g.teamLine !== 0 &&
        g.teamScore !== null && g.teamScore !== "" &&
        g.oppScore !== null && g.oppScore !== ""
      )
      .forEach((g) => {
        const key = [g.team, g.opp].sort().join("|") + "|" + normalizeDate(g.date);
        if (seen.has(key)) return;
        seen.add(key);

        const predictedLine = g.teamLine as number;
        // actual margin: oppScore - teamScore (negative = home team won by more)
        const actualMargin = Number(g.oppScore) - Number(g.teamScore);
        const error = predictedLine - actualMargin;

        result.push({
          date: normalizeDate(g.date),
          home: g.team,
          away: g.opp,
          homeDiv: Number(g.teamDiv),
          predictedLine,
          actualMargin,
          error,
          absError: Math.abs(error),
        });
      });

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  // Overall stats
  const overall = useMemo(() => {
    const n = allGames.length;
    if (n === 0) return null;
    const avgError = allGames.reduce((s, g) => s + g.error, 0) / n;
    const avgAbsError = allGames.reduce((s, g) => s + g.absError, 0) / n;
    const within3 = allGames.filter((g) => g.absError <= 3).length;
    const within6 = allGames.filter((g) => g.absError <= 6).length;
    return { n, avgError, avgAbsError, within3, within6 };
  }, [allGames]);

  // By division
  const byDivision = useMemo(() => {
    const divMap: Record<number, { games: LineGame[] }> = {};
    allGames.forEach((g) => {
      if (!divMap[g.homeDiv]) divMap[g.homeDiv] = { games: [] };
      divMap[g.homeDiv].games.push(g);
    });
    return Object.entries(divMap)
      .map(([div, { games }]) => {
        const n = games.length;
        const avgError = games.reduce((s, g) => s + g.error, 0) / n;
        const avgAbsError = games.reduce((s, g) => s + g.absError, 0) / n;
        return { div: Number(div), n, avgError, avgAbsError };
      })
      .sort((a, b) => a.div - b.div);
  }, [allGames]);

  // Filtered + sorted detail games
  const filteredGames = useMemo(() => {
    const base = divFilter === "all" ? allGames : allGames.filter((g) => g.homeDiv === divFilter);
    return [...base].sort((a, b) => {
      let va: number, vb: number;
      switch (sortCol) {
        case "date":      va = a.date.localeCompare(b.date); return sortDir === "asc" ? va : -va;
        case "matchup":   va = a.home.localeCompare(b.home); return sortDir === "asc" ? va : -va;
        case "predicted": va = a.predictedLine; vb = b.predictedLine; break;
        case "actual":    va = a.actualMargin; vb = b.actualMargin; break;
        case "error":     va = a.error; vb = b.error; break;
        case "absError":  va = a.absError; vb = b.absError; break;
        default:          va = 0; vb = 0;
      }
      return sortDir === "asc" ? va! - vb! : vb! - va!;
    });
  }, [allGames, divFilter, sortCol, sortDir]);

  // Vegas NCAA line accuracy reference (computed live)
  const vegasNcaaRef = useMemo(() => {
    const valid = (ncaaGames as NcaaGame[]).filter((g) =>
      g.vegasHomeLine !== null &&
      g.actualHomeScore !== null && g.actualHomeScore !== 0 &&
      g.actualAwayScore !== null
    );
    const n = valid.length;
    if (n === 0) return null;
    // actualHomeLine = actualAwayScore - actualHomeScore (negative = home won)
    // Same sign convention as vegasHomeLine, so error = vegasHomeLine - actualHomeLine
    const errors = valid.map((g) => {
      const actualHomeLine = g.actualAwayScore! - g.actualHomeScore!;
      return g.vegasHomeLine! - actualHomeLine;
    });
    const avgError = errors.reduce((s, e) => s + e, 0) / n;
    const avgAbsError = errors.reduce((s, e) => s + Math.abs(e), 0) / n;
    const within3 = errors.filter((e) => Math.abs(e) <= 3).length;
    const within6 = errors.filter((e) => Math.abs(e) <= 6).length;
    return { n, avgError, avgAbsError, within3Pct: (within3 / n) * 100, within6Pct: (within6 / n) * 100 };
  }, []);

  const errorColor = (err: number) => Math.abs(err) <= 3 ? "#16a34a" : Math.abs(err) <= 7 ? "#ca8a04" : "#dc2626";
  const biasColor = (err: number) => Math.abs(err) < 0.5 ? "#16a34a" : Math.abs(err) < 2 ? "#ca8a04" : "#dc2626";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.replace(/_wla(_sort)?$/, "")} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full mx-auto px-6 py-8" style={{ maxWidth: "820px" }}>

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-2xl sm:text-3xl font-bold tracking-tight leading-tight mb-3 text-center">
              <LogoBadge league="wiaa" />
              <span className="ml-3">WIAA Line Accuracy</span>
            </h1>
            <p className="text-stone-600 text-sm text-center max-w-xl">
              How close is BBMI's predicted spread to the actual margin of victory?
              Across <strong>{overall?.n.toLocaleString() ?? 0}</strong> completed WIAA games this season.
              Click any column header to learn what it means.
            </p>
          </div>

          {/* HOW TO USE */}
          <HowToUseAccordion />

          {/* OVERALL SUMMARY */}
          {overall && (
            <div style={sectionStyle}>
              <div style={sectionHeaderStyle}>OVERALL LINE ACCURACY</div>
              <div style={{ backgroundColor: "white", padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                  {[
                    { value: signedFixed(overall.avgError), label: "Avg Error (Bias)", sub: "near 0 = well-calibrated", color: biasColor(overall.avgError) },
                    { value: `${overall.avgAbsError.toFixed(1)} pts`, label: "Avg Abs Error", sub: "avg miss regardless of direction", color: "#0a1a2f" },
                  ].map((card) => (
                    <div key={card.label} style={{ padding: "1.5rem 1rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e7e5e4" }}>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "5px 0 3px" }}>{card.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "#78716c" }}>{card.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                  {[
                    { value: `${((overall.within3 / overall.n) * 100).toFixed(1)}%`, label: "Within 3 Points", sub: `${overall.within3.toLocaleString()} of ${overall.n.toLocaleString()} games`, color: "#16a34a" },
                    { value: `${((overall.within6 / overall.n) * 100).toFixed(1)}%`, label: "Within 6 Points", sub: `${overall.within6.toLocaleString()} of ${overall.n.toLocaleString()} games`, color: "#16a34a" },
                  ].map((card) => (
                    <div key={card.label} style={{ padding: "1.5rem 1rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e7e5e4" }}>
                      <div style={{ fontSize: "2rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "5px 0 3px" }}>{card.label}</div>
                      <div style={{ fontSize: "0.72rem", color: "#78716c" }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* VEGAS NCAA REFERENCE NOTE */}
                {vegasNcaaRef && (
                  <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: "0.8rem", color: "#14532d", lineHeight: 1.6 }}>
                    <strong>🏆 How does this compare to Vegas?</strong> Vegas doesn't set lines on WIAA games, but as a benchmark: across{" "}
                    <strong>{vegasNcaaRef.n.toLocaleString()}</strong> completed NCAA games, Vegas lines miss the actual margin by an average of{" "}
                    <strong>{vegasNcaaRef.avgAbsError.toFixed(1)} points</strong> (avg error {signedFixed(vegasNcaaRef.avgError, 1)}, within 3 pts: {vegasNcaaRef.within3Pct.toFixed(1)}%, within 6 pts: {vegasNcaaRef.within6Pct.toFixed(1)}%).
                    Vegas sets NCAA lines with access to enormous betting market data — BBMI's WIAA numbers in that context are a strong indicator of model quality.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BY DIVISION */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>LINE ACCURACY BY DIVISION</div>
            <div style={{ backgroundColor: "white", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <DescHeader label="Division" tooltipId="div" align="left" {...hp} />
                    <DescHeader label="Games" tooltipId="date" {...hp} />
                    <DescHeader label="Avg Error (Bias)" tooltipId="avgError" {...hp} />
                    <DescHeader label="Avg Abs Error" tooltipId="avgAbsError" {...hp} />
                  </tr>
                </thead>
                <tbody>
                  {byDivision.map((row, idx) => (
                    <tr key={row.div} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ padding: "0.7rem 1rem", fontWeight: 600, color: "#374151" }}>Division {row.div}</td>
                      <td style={{ padding: "0.7rem 1rem", textAlign: "center", color: "#6b7280" }}>{row.n.toLocaleString()}</td>
                      <td style={{ padding: "0.7rem 1rem", textAlign: "center", fontWeight: 700, color: biasColor(row.avgError) }}>
                        {signedFixed(row.avgError)}
                      </td>
                      <td style={{ padding: "0.7rem 1rem", textAlign: "center", fontWeight: 700, color: errorColor(row.avgAbsError) }}>
                        {row.avgAbsError.toFixed(1)} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "0.625rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #e7e5e4" }}>
              Avg Error near 0 = no systematic bias. Avg Abs Error = typical miss size in points.
            </div>
          </div>

          {/* GAME DETAIL TABLE */}
          <div style={{ ...sectionStyle, minWidth: "min(760px, 100%)" }}>
            <div style={sectionHeaderStyle}>GAME-BY-GAME LINE DETAIL</div>

            {/* Division filter */}
            <div style={{ backgroundColor: "#f8fafc", padding: "0.75rem 1rem", borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Division:</label>
              <select
                value={divFilter}
                onChange={(e) => setDivFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ border: "1px solid #d6d3d1", borderRadius: 6, padding: "4px 10px", fontSize: 13, backgroundColor: "white" }}
              >
                <option value="all">All Divisions</option>
                {byDivision.map((d) => <option key={d.div} value={d.div}>Division {d.div}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "#78716c" }}>{filteredGames.length.toLocaleString()} games</span>
            </div>

            <div style={{ backgroundColor: "white", overflowX: "auto", maxHeight: "520px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    <SortableHeader label="Date"      col="date"      sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="date"      align="left" {...hp} />
                    <SortableHeader label="Matchup"   col="matchup"   sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="matchup"   align="left" {...hp} />
                    <SortableHeader label="Predicted" col="predicted" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="predicted" {...hp} />
                    <SortableHeader label="Actual"    col="actual"    sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="actual"    {...hp} />
                    <SortableHeader label="Error"     col="error"     sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="error"     {...hp} />
                    <SortableHeader label="Abs Error" col="absError"  sortCol={sortCol} sortDir={sortDir} onSort={handleSort} tooltipId="absError"  {...hp} />
                  </tr>
                </thead>
                <tbody>
                  {filteredGames.map((g, idx) => (
                    <tr key={`${g.date}-${g.home}-${g.away}`} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "#6b7280", whiteSpace: "nowrap" }}>
                        {formatDate(g.date)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#6b7280" }}>{g.away}</span>
                        <span style={{ color: "#9ca3af", margin: "0 4px" }}>@</span>
                        <Link href={`/wiaa-team/${encodeURIComponent(g.home)}`} style={{ fontWeight: 600, color: "#0a1a2f" }} className="hover:underline">
                          {g.home}
                        </Link>
                        <span style={{ color: "#9ca3af", fontSize: "0.72rem", marginLeft: 4 }}>(D{g.homeDiv})</span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.85rem", color: "#374151" }}>
                        {signedFixed(g.predictedLine)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.85rem", color: "#374151" }}>
                        {signedFixed(g.actualMargin)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600, color: errorColor(g.error) }}>
                        {signedFixed(g.error)}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontFamily: "monospace", fontSize: "0.85rem", fontWeight: 600, color: errorColor(g.absError) }}>
                        {g.absError.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "0.625rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #e7e5e4" }}>
              Error color: <span style={{ color: "#16a34a", fontWeight: 600 }}>green ≤3 pts</span> · <span style={{ color: "#ca8a04", fontWeight: 600 }}>yellow ≤7 pts</span> · <span style={{ color: "#dc2626", fontWeight: 600 }}>red &gt;7 pts</span>. Click column headers to sort.
            </div>
          </div>

          {/* FOOTER NAV */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <Link href="/wiaa-model-accuracy" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600, marginRight: "1.5rem" }}>
              ← WIAA Prediction Accuracy
            </Link>
            <Link href="/wiaa-todays-picks" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600 }}>
              Today's Picks →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
