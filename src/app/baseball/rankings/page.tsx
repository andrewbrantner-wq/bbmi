"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import teamRatingsRaw from "@/data/rankings/baseball-rankings.json";
import { ChevronUp, ChevronDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type TeamRating = {
  team: string;
  conference: string;
  model_rank: number;
  bbmi_score: number;
  rpi_rank: number;
  sos_rank: number;
  adj_runs_per_game: number;
  runs_allowed_per_game: number;
  scoring_margin: number;
  era: number;
  whip: number;
  k_per_9: number;
  fielding_pct: number;
  woba: number;
  obp: number;
  slg: number;
  ops: number;
  record: string;
  wins: number;
  losses: number;
  home_record: string;
  road_record: string;
  q1_record: string;
};

type SortKey = keyof TeamRating;

// ── Parse team_ratings.json into array ───────────────────────────

function parseRatings(): TeamRating[] {
  const raw = teamRatingsRaw as Record<string, Record<string, unknown>>;
  return Object.entries(raw).map(([name, d]) => ({
    team:                  name,
    conference:            String(d.conference ?? ""),
    model_rank:            Number(d.model_rank ?? 999),
    bbmi_score:            Number(d.bbmi_score ?? 0),
    rpi_rank:              Number(d.rpi_rank ?? 999),
    sos_rank:              Number(d.sos_rank ?? 999),
    adj_runs_per_game:     Number(d.adj_runs_per_game ?? 0),
    runs_allowed_per_game: Number(d.runs_allowed_per_game ?? 0),
    scoring_margin:        Number(d.scoring_margin ?? 0),
    era:                   Number(d.era ?? 0),
    whip:                  Number(d.whip ?? 0),
    k_per_9:               Number(d.k_per_9 ?? 0),
    fielding_pct:          Number(d.fielding_pct ?? 0),
    woba:                  Number(d.woba ?? 0),
    obp:                   Number(d.obp ?? 0),
    slg:                   Number(d.slg ?? 0),
    ops:                   Number(d.ops ?? 0),
    record:                String(d.record ?? ""),
    wins:                  Number(d.wins ?? 0),
    losses:                Number(d.losses ?? 0),
    home_record:           String(d.home_record ?? ""),
    road_record:           String(d.road_record ?? ""),
    q1_record:             String(d.q1_record ?? ""),
  }));
}

// ── Tooltips ─────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  model_rank: "BBMI model rank — composite rating based on adjusted run scoring, pitching (FIP/ERA), wOBA, bullpen quality, K rate, SOS, and fielding. Higher-ranked teams are projected to outscore opponents by the widest margin.",
  bbmi_score: "BBMI composite score — offensive rating minus defensive rating. Positive = projected to outscore opponents. The primary ranking metric.",
  rpi_rank: "Warren Nolan RPI rank — measures team strength based on wins, opponent quality, and opponents' opponents. Used by the NCAA selection committee.",
  team: "Team name. Sorted alphabetically by default.",
  conference: "Athletic conference. Use the filter above to narrow by conference.",
  adj_runs_per_game: "Average runs scored per game — the team's offensive output.",
  runs_allowed_per_game: "Average runs allowed per game — lower is better pitching/defense.",
  scoring_margin: "Average scoring margin (runs scored minus runs allowed per game). Positive = outscoring opponents.",
  sos_rank: "Warren Nolan Strength of Schedule rank. Lower = harder schedule faced.",
  record: "Overall season win-loss record.",
  era: "Team Earned Run Average — runs allowed per 9 innings pitched. Lower is better.",
  woba: "Weighted On-Base Average — advanced offensive metric weighting walks, singles, doubles, triples, HR by run value. Higher is better.",
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

// ── Sortable Header ──────────────────────────────────────────────

function SortableHeader({ label, columnKey, tooltipId, sortColumn, sortDirection, handleSort, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortKey; tooltipId?: string;
  sortColumn: SortKey; sortDirection: "asc" | "desc";
  handleSort: (col: SortKey) => void;
  activeDescId?: string | null; openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
  align?: "left" | "center" | "right";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_rk" : null;
  const isActive = sortColumn === columnKey;
  const descShowing = !!(uid && activeDescId === uid);
  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (descShowing) closeDesc?.();
    else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); }
  };
  const handleSortClick = (e: React.MouseEvent) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); };
  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1628", color: "#ffffff", padding: "8px 10px", textAlign: align, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span onClick={handleSortClick} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.35, lineHeight: 1 }}>
          {isActive ? sortDirection === "asc" ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

// ── Margin bar ───────────────────────────────────────────────────

function MarginCell({ margin }: { margin: number }) {
  const maxBar = 8; // cap bar width at ±8 runs
  const pct = Math.min(Math.abs(margin) / maxBar, 1) * 50;
  const positive = margin >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: positive ? "#16a34a" : "#dc2626", minWidth: 38, textAlign: "right" }}>
        {margin > 0 ? "+" : ""}{margin.toFixed(1)}
      </span>
      <div style={{ width: 50, height: 6, backgroundColor: "#e7e5e4", borderRadius: 3, overflow: "hidden", flexShrink: 0, position: "relative" }}>
        {positive ? (
          <div style={{ position: "absolute", left: "50%", width: `${pct}%`, height: "100%", backgroundColor: "#16a34a", borderRadius: "0 3px 3px 0" }} />
        ) : (
          <div style={{ position: "absolute", right: "50%", width: `${pct}%`, height: "100%", backgroundColor: "#dc2626", borderRadius: "3px 0 0 3px" }} />
        )}
      </div>
    </div>
  );
}

// ── Accordion ────────────────────────────────────────────────────

function WhyDifferentAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen(prev => !prev)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1628", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>⚾ How does the BBMI Baseball model work?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>The BBMI Baseball model uses a <strong>Poisson-based run scoring model</strong> — the same approach used by professional sportsbooks to price baseball games. Unlike basketball or football, baseball runs follow a count distribution (you can&apos;t score negative runs), making Poisson the mathematically correct framework.</p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: "#1c1917" }}>The model evaluates teams on:</p>
          {[
            { label: "Opponent-adjusted run production", desc: "How many runs a team scores against average-quality opponents, adjusted for strength of schedule via Warren Nolan SOS." },
            { label: "Pitching quality (FIP-based)", desc: "Fielding Independent Pitching isolates what the pitcher controls (strikeouts, walks, home runs) from defense — more predictive than ERA." },
            { label: "Bullpen depth", desc: "College starters average ~4.5 innings. The bullpen throws 40-50% of every game — teams with poor bullpens are systematically mis-priced." },
            { label: "Series position", desc: "Friday = ace, Saturday = #2, Sunday = #3 starter. The model tracks where each game falls in a weekend series to adjust pitching expectations." },
          ].map(({ label, desc }) => (<p key={label} style={{ marginBottom: 10 }}><strong>{label}</strong> — {desc}</p>))}
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>
            Rankings are derived from Warren Nolan RPI with BBMI offensive and defensive adjustments. The model is in its first season — rankings will sharpen as calibration data accumulates.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function BaseballRankingsPage() {
  const allTeams = useMemo(() => parseRatings(), []);

  const [sortColumn, setSortColumn] = useState<SortKey>("model_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const conferences = useMemo(() => {
    const set = new Set<string>();
    allTeams.forEach(t => { if (t.conference) set.add(t.conference); });
    return Array.from(set).sort();
  }, [allTeams]);

  const handleSort = (col: SortKey) => {
    if (col === sortColumn) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else {
      setSortColumn(col);
      // Default direction: ascending for ranks, descending for stats where higher = better
      const descDefault = ["adj_runs_per_game", "scoring_margin", "woba", "ops", "obp", "slg", "k_per_9", "bbmi_score"].includes(col);
      setSortDirection(descDefault ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTeams.filter(t => {
      const matchSearch = t.team.toLowerCase().includes(q) || t.conference.toLowerCase().includes(q) || String(t.model_rank).includes(q) || String(t.rpi_rank).includes(q);
      const matchConf = conferenceFilter === "all" || t.conference === conferenceFilter;
      return matchSearch && matchConf;
    });
  }, [allTeams, search, conferenceFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sortColumn;
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") {
        // Push 0/999 to bottom for rank columns
        if (key === "model_rank" || key === "rpi_rank" || key === "sos_rank") {
          if (av >= 999 && bv < 999) return 1;
          if (bv >= 999 && av < 999) return -1;
        }
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      return sortDirection === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortColumn, sortDirection]);

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
  const filtersActive = search !== "" || conferenceFilter !== "all" || sortColumn !== "model_rank" || sortDirection !== "asc";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa-baseball" />
              <span style={{ marginLeft: 12 }}>Baseball Team Rankings</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              308 D1 teams ranked by Warren Nolan RPI with BBMI offensive and defensive metrics.
              Click any column header label to learn what it means.
            </p>
          </div>

          {/* ACCORDION */}
          <div style={{ maxWidth: 720, margin: "0 auto 24px" }}>
            <WhyDifferentAccordion />
          </div>

          {/* SEARCH + FILTERS */}
          <div style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
              <input
                placeholder="Search teams, conferences…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ height: 38, fontSize: 13, borderRadius: 8, border: search !== "" ? "1.5px solid #0a1628" : "1.5px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 12px", width: 240, outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              />
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <select
                  value={conferenceFilter}
                  onChange={e => setConferenceFilter(e.target.value)}
                  style={{ height: 38, fontSize: 13, borderRadius: 8, border: conferenceFilter !== "all" ? "1.5px solid #0a1628" : "1.5px solid #d6d3d1", backgroundColor: conferenceFilter !== "all" ? "#0a1628" : "#ffffff", color: conferenceFilter !== "all" ? "#ffffff" : "#1c1917", padding: "0 32px 0 12px", minWidth: 160, appearance: "none", cursor: "pointer", fontWeight: conferenceFilter !== "all" ? 600 : 400, outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <option value="all">All conferences</option>
                  {conferences.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={conferenceFilter !== "all" ? "#ffffff" : "#78716c"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, pointerEvents: "none" }}><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {filtersActive && (
                <button onClick={() => { setSearch(""); setConferenceFilter("all"); setSortColumn("rpi_rank"); setSortDirection("asc"); }} style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e7e5e4", backgroundColor: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Clear
                </button>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#57534e" }}>
              Showing <strong>{sorted.length}</strong> of <strong>{allTeams.length}</strong> teams. Updated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          </div>

          {/* COLOR LEGEND */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(22,163,74,0.25)", border: "1px solid rgba(22,163,74,0.4)" }} />
              <span style={{ fontSize: 12, color: "#57534e" }}>BBMI ranks <strong>higher</strong> than consensus</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(220,38,38,0.20)", border: "1px solid rgba(220,38,38,0.35)" }} />
              <span style={{ fontSize: 12, color: "#57534e" }}>BBMI ranks <strong>lower</strong> than consensus</span>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ maxWidth: 1120, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1200, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto", minWidth: 900 }}>
                  <colgroup>
                    <col style={{ width: 70 }} />
                    <col />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 65 }} />
                    <col style={{ width: 65 }} />
                    <col style={{ width: 70 }} />
                    <col style={{ width: 80 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader label="Rank"      columnKey="model_rank"            tooltipId="model_rank"            align="center" {...headerProps} />
                      <SortableHeader label="Team"      columnKey="team"                  tooltipId="team"                  align="left"   {...headerProps} />
                      <SortableHeader label="Conf"      columnKey="conference"            tooltipId="conference"            align="left"   {...headerProps} />
                      <SortableHeader label="BBMI"      columnKey="bbmi_score"            tooltipId="bbmi_score"            align="center" {...headerProps} />
                      <SortableHeader label="RPI"       columnKey="rpi_rank"              tooltipId="rpi_rank"              align="center" {...headerProps} />
                      <SortableHeader label="R/G"       columnKey="adj_runs_per_game"     tooltipId="adj_runs_per_game"     align="center" {...headerProps} />
                      <SortableHeader label="RA/G"      columnKey="runs_allowed_per_game" tooltipId="runs_allowed_per_game" align="center" {...headerProps} />
                      <SortableHeader label="Margin"    columnKey="scoring_margin"        tooltipId="scoring_margin"        align="center" {...headerProps} />
                      <SortableHeader label="SOS"       columnKey="sos_rank"              tooltipId="sos_rank"              align="center" {...headerProps} />
                      <SortableHeader label="ERA"       columnKey="era"                   tooltipId="era"                   align="center" {...headerProps} />
                      <SortableHeader label="wOBA"      columnKey="woba"                  tooltipId="woba"                  align="center" {...headerProps} />
                      <SortableHeader label="Record"    columnKey="record"                tooltipId="record"                align="center" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => {
                      const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";
                      return (
                        <tr key={t.team} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#0a1628" }}>{t.model_rank}</td>
                          <td style={TD}>
                            <Link href={`/baseball/team/${encodeURIComponent(t.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1628" }} className="hover:underline">
                              <NCAALogo teamName={t.team} size={26} />
                              <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.team}</span>
                            </Link>
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: "#57534e", overflow: "hidden", textOverflow: "ellipsis" }}>{t.conference}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: t.bbmi_score > 0.5 ? "#16a34a" : t.bbmi_score > -0.5 ? "#57534e" : "#dc2626" }}>{t.bbmi_score > 0 ? "+" : ""}{t.bbmi_score.toFixed(2)}</td>
                          <td style={TD_MONO}>{t.rpi_rank}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: t.adj_runs_per_game >= 7 ? "#16a34a" : t.adj_runs_per_game >= 5.5 ? "#0a1628" : "#dc2626" }}>{t.adj_runs_per_game.toFixed(1)}</td>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: t.runs_allowed_per_game <= 4 ? "#16a34a" : t.runs_allowed_per_game <= 6 ? "#0a1628" : "#dc2626" }}>{t.runs_allowed_per_game.toFixed(1)}</td>
                          <td style={TD}><MarginCell margin={t.scoring_margin} /></td>
                          <td style={TD_MONO}>{t.sos_rank}</td>
                          <td style={{ ...TD_MONO, color: t.era <= 3.5 ? "#16a34a" : t.era <= 5.0 ? "#57534e" : "#dc2626" }}>{t.era.toFixed(2)}</td>
                          <td style={{ ...TD_MONO, color: t.woba >= 0.370 ? "#16a34a" : t.woba >= 0.300 ? "#57534e" : "#dc2626" }}>{t.woba.toFixed(3)}</td>
                          <td style={TD_MONO}>{t.record}</td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan={12} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No teams match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 6 }}>BBMI rank = offensive rating − defensive rating · RPI/SOS via Warren Nolan · updated daily</p>
          </div>

        </div>
      </div>
    </>
  );
}
