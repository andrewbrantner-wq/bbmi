"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import teamRatingsRaw from "@/data/rankings/mlb-rankings.json";
import playoffProbsRaw from "@/data/mlb-playoff-probs.json";
import { ChevronUp, ChevronDown } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────

type TeamRating = {
  team: string;
  model_rank: number;
  bbmi_score: number;
  off_rating: number;
  pit_rating: number;
  runs_per_game: number;
  runs_allowed_per_game: number;
  scoring_margin: number;
  era: number;
  fip: number;
  blended_fip: number;
  whip: number;
  k_per_9: number;
  k_bb_pct: number;
  woba_raw: number;
  woba_neutral: number;
  blended_woba: number;
  ops: number;
  obp: number;
  slg: number;
  record: string;
  wins: number;
  losses: number;
  games_played: number;
  park_factor: number;
  rank_change: number;
  previous_rank: number | null;
};

type SortKey = keyof TeamRating;

// ── Parse rankings ──────────────────────────────────────────────

function parseRatings(): TeamRating[] {
  const raw = teamRatingsRaw as Record<string, Record<string, unknown>>;
  return Object.entries(raw).map(([name, d]) => ({
    team: name,
    model_rank: Number(d.model_rank ?? 999),
    bbmi_score: Number(d.bbmi_score ?? 100),
    off_rating: Number(d.off_rating ?? 100),
    pit_rating: Number(d.pit_rating ?? 100),
    runs_per_game: Number(d.runs_per_game ?? 0),
    runs_allowed_per_game: Number(d.runs_allowed_per_game ?? 0),
    scoring_margin: Number(d.scoring_margin ?? 0),
    era: Number(d.era ?? 0),
    fip: Number(d.fip ?? 0),
    blended_fip: Number(d.blended_fip ?? 0),
    whip: Number(d.whip ?? 0),
    k_per_9: Number(d.k_per_9 ?? 0),
    k_bb_pct: Number(d.k_bb_pct ?? 0),
    woba_raw: Number(d.woba_raw ?? 0),
    woba_neutral: Number(d.woba_neutral ?? 0),
    blended_woba: Number(d.blended_woba ?? 0),
    ops: Number(d.ops ?? 0),
    obp: Number(d.obp ?? 0),
    slg: Number(d.slg ?? 0),
    record: String(d.record ?? ""),
    wins: Number(d.wins ?? 0),
    losses: Number(d.losses ?? 0),
    games_played: Number(d.games_played ?? 0),
    park_factor: Number(d.park_factor ?? 1.0),
    rank_change: Number(d.rank_change ?? 0),
    previous_rank: d.previous_rank != null ? Number(d.previous_rank) : null,
  }));
}

// ── Tooltips ─────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  model_rank: "BBMI power rank — composite of park-neutral offense (wOBA) and defense-independent pitching (FIP), Bayesian-blended with prior year. 100 = league average.",
  bbmi_score: "BBMI composite score — 50% offensive rating + 50% pitching rating, normalized to 100 = league average. Above 100 = above average team.",
  off_rating: "Offensive rating — park-neutral wOBA, Bayesian-blended with prior year, normalized to 100 = league average. Removes Coors/Oracle effects.",
  pit_rating: "Pitching rating — FIP-based (defense-independent), Bayesian-blended with prior year, inverted so higher = better. 100 = league average.",
  team: "Team name.",
  runs_per_game: "Average runs scored per game (raw, not park-adjusted).",
  runs_allowed_per_game: "Average runs allowed per game. Lower is better.",
  scoring_margin: "Average run differential per game. Positive = outscoring opponents.",
  era: "Team Earned Run Average — earned runs allowed per 9 innings. Lower is better.",
  fip: "Fielding Independent Pitching — isolates K, BB, HR from defense. More predictive than ERA. Lower is better.",
  woba_neutral: "Park-neutral wOBA — removes venue effects so teams are compared on talent, not environment.",
  ops: "On-base Plus Slugging. Higher is better.",
  record: "Season win-loss record.",
  proj_wins: "Most likely projected season record from BBMI's Monte Carlo playoff simulation. Based on 10,000 season simulations using team power ratings.",
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
  const uid = tooltipId ?? null;
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
    <th ref={thRef} style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "10px 12px", textAlign: align, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecorationLine: tooltipId ? "underline" : "none", textDecorationStyle: tooltipId ? "dotted" : undefined, textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span onClick={handleSortClick} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.35, lineHeight: 1 }}>
          {isActive ? sortDirection === "asc" ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

// ── Margin bar ───────────────────────────────────────────────────

function MarginCell({ margin }: { margin: number }) {
  const maxBar = 2;
  const pct = Math.min(Math.abs(margin) / maxBar, 1) * 50;
  const positive = margin >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, fontWeight: 700, color: positive ? "#16a34a" : "#dc2626", minWidth: 38, textAlign: "right" }}>
        {margin > 0 ? "+" : ""}{margin.toFixed(2)}
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

function HowItWorksAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen(prev => !prev)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: "#eae8e1", color: "#333333", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>{"\u26BE"} How does the BBMI MLB model work?</span>
        <span style={{ fontSize: 14, color: "#555555" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>The BBMI MLB model uses a <strong>Negative Binomial scoring engine</strong> to project game outcomes. Unlike simple win-loss models, it independently projects each team&apos;s run production and allows for the overdispersion (variance exceeding the mean) that characterizes MLB scoring.</p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: "#1c1917" }}>The model evaluates teams on:</p>
          {[
            { label: "Pitching quality (FIP-based)", desc: "Fielding Independent Pitching isolates what the pitcher controls (strikeouts, walks, home runs) from defense. More predictive of future performance than ERA." },
            { label: "Offensive production (wOBA)", desc: "Weighted On-Base Average captures the value of all offensive events (walks, singles, doubles, triples, HR) weighted by actual run value." },
            { label: "Park factors (asymmetric)", desc: "Hitter-friendly parks are adjusted asymmetrically — home teams' adapted rosters receive an attenuated park factor while visiting teams face the full park effect." },
            { label: "Scoring environment (trailing window)", desc: "A 30-day trailing league scoring average captures seasonal variation — the summer scoring peak and the September cool-down." },
          ].map(({ label, desc }) => (<p key={label} style={{ marginBottom: 10 }}><strong>{label}</strong> {"\u2014"} {desc}</p>))}
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>
            Rankings are derived from team run differential with BBMI offensive and pitching adjustments. Walk-forward validated on 4,866 games across 2024-2025 seasons.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function MLBRankingsPage() {
  const allTeams = useMemo(() => parseRatings(), []);

  const [sortColumn, setSortColumn] = useState<SortKey>("model_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const handleSort = (col: SortKey) => {
    if (col === sortColumn) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else {
      setSortColumn(col);
      const descDefault = ["runs_per_game", "scoring_margin", "woba_raw", "woba_neutral", "blended_woba", "ops", "obp", "slg", "k_per_9", "k_bb_pct", "bbmi_score", "off_rating", "pit_rating"].includes(col);
      setSortDirection(descDefault ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allTeams.filter(t => t.team.toLowerCase().includes(q) || String(t.model_rank).includes(q));
  }, [allTeams, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const key = sortColumn;
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") {
        if (key === "model_rank") {
          if (av >= 999 && bv < 999) return 1;
          if (bv >= 999 && av < 999) return -1;
        }
        return sortDirection === "asc" ? av - bv : bv - av;
      }
      return sortDirection === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortColumn, sortDirection]);

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
  const filtersActive = search !== "" || sortColumn !== "model_rank" || sortDirection !== "asc";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper">
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 20 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a6640", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              MLB {"\u00B7"} Power Rankings
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
              MLB BBMI Rankings
            </h1>
            <p style={{ fontSize: 13, color: "#666", maxWidth: 560, margin: "0 auto", lineHeight: 1.6 }}>
              Rankings reflect current team quality (pitching + offense). Projected record reflects season outlook
              including prior year and schedule. The two can disagree early in the season {"\u2014"} a hot start
              doesn&apos;t change underlying quality, and a cold start doesn&apos;t erase it.
            </p>
          </div>

          {/* ACCORDION */}
          <div style={{ maxWidth: 1100, margin: "0 auto 24px" }}>
            <HowItWorksAccordion />
          </div>

          {/* TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1200, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Rank"     columnKey="model_rank"            tooltipId="model_rank"            align="center" {...headerProps} />
                      <SortableHeader label="Team"     columnKey="team"                  tooltipId="team"                  align="left"   {...headerProps} />
                      <SortableHeader label="BBMI"     columnKey="bbmi_score"            tooltipId="bbmi_score"            align="center" {...headerProps} />
                      {(() => {
                        const projRef = React.createRef<HTMLTableCellElement>();
                        return (
                          <th ref={projRef} style={{ backgroundColor: "#1a6640", color: "#ffffff", padding: "10px 12px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.2)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", userSelect: "none" }}>
                            <span
                              onClick={() => {
                                if (descPortal?.id === "proj_wins") { closeDesc(); }
                                else { const rect = projRef.current?.getBoundingClientRect(); if (rect) openDesc("proj_wins", rect); }
                              }}
                              style={{ cursor: "help", textDecorationLine: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
                            >
                              Proj Record
                            </span>
                          </th>
                        );
                      })()}
                      <SortableHeader label="Record"   columnKey="record"                tooltipId="record"                align="center" {...headerProps} />
                      <SortableHeader label="Margin"   columnKey="scoring_margin"        tooltipId="scoring_margin"        align="center" {...headerProps} />
                      <SortableHeader label="FIP"      columnKey="fip"                   tooltipId="fip"                   align="center" {...headerProps} />
                      <SortableHeader label="wOBA*"    columnKey="woba_neutral"          tooltipId="woba_neutral"          align="center" {...headerProps} />
                      <SortableHeader label="OPS"      columnKey="ops"                   tooltipId="ops"                   align="center" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => {
                      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8f7f4";
                      return (
                        <tr key={t.team} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#1a1a1a" }}>
                            <span>{t.model_rank}</span>
                            {t.rank_change !== 0 && (
                              <span style={{ fontSize: 9, fontWeight: 600, marginLeft: 3, color: t.rank_change > 0 ? "#16a34a" : "#dc2626" }}>
                                {t.rank_change > 0 ? `\u25B2${t.rank_change}` : `\u25BC${Math.abs(t.rank_change)}`}
                              </span>
                            )}
                          </td>
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(t.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a", textDecoration: "none" }} className="hover:underline">
                              <MLBLogo teamName={t.team} size={26} />
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{t.team}</span>
                            </Link>
                          </td>
                          <td style={{ ...TD_MONO, fontWeight: 800, fontSize: 14, color: t.bbmi_score >= 105 ? "#157a3a" : t.bbmi_score >= 97 ? "#1a1a1a" : "#dc2626" }}>{t.bbmi_score.toFixed(1)}</td>
                          {/* Proj Record — color coded + quality vs record indicator */}
                          <td style={TD_MONO}>
                            {(() => {
                              const prob = (playoffProbsRaw as { results: Record<string, { projected_wins: number }> }).results[t.team];
                              if (!prob) return <span style={{ color: "#94a3b8" }}>{"\u2014"}</span>;
                              const w = Math.round(prob.projected_wins);
                              const l = 162 - w;
                              const projColor = w >= 82 ? "#16a34a" : w <= 80 ? "#dc2626" : "#57534e";

                              // Quality vs Record indicator: compare BBMI rank to projected wins rank
                              const allProbs = Object.entries((playoffProbsRaw as { results: Record<string, { projected_wins: number }> }).results);
                              const projRank = allProbs.sort((a, b) => b[1].projected_wins - a[1].projected_wins).findIndex(([name]) => name === t.team) + 1;
                              const rankDiff = t.model_rank - projRank; // positive = quality rank worse than proj rank
                              const showIndicator = Math.abs(rankDiff) >= 8;

                              return (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <span style={{ fontWeight: 700, color: projColor }}>{w}-{l}</span>
                                  {showIndicator && (
                                    <span title={rankDiff > 0 ? "Projections ahead of quality rank" : "Quality rank ahead of projections"}
                                      style={{ fontSize: 10, color: rankDiff > 0 ? "#f59e0b" : "#3b82f6" }}>
                                      {rankDiff > 0 ? "\u25B2" : "\u25BC"}
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={TD_MONO}>{t.record}</td>
                          <td style={{ ...TD_MONO, fontWeight: 600, color: t.scoring_margin > 0 ? "#16a34a" : t.scoring_margin < 0 ? "#dc2626" : "#57534e" }}>
                            {t.scoring_margin > 0 ? "+" : ""}{t.scoring_margin.toFixed(2)}
                          </td>
                          <td style={{ ...TD_MONO, color: t.fip <= 3.5 ? "#16a34a" : t.fip <= 4.2 ? "#57534e" : "#dc2626" }}>{t.fip.toFixed(2)}</td>
                          <td style={{ ...TD_MONO, color: t.woba_neutral >= 0.330 ? "#16a34a" : t.woba_neutral >= 0.310 ? "#57534e" : "#dc2626" }}>{t.woba_neutral.toFixed(3)}</td>
                          <td style={{ ...TD_MONO, color: t.ops >= 0.750 ? "#16a34a" : t.ops >= 0.700 ? "#57534e" : "#dc2626" }}>{t.ops.toFixed(3)}</td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No teams match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 6 }}>BBMI = 50% offense (park-neutral wOBA) + 50% pitching (FIP) {"\u00B7"} 100 = league avg {"\u00B7"} wOBA* = park-neutral {"\u00B7"} {"\u25B2"} proj ahead of quality {"\u25BC"} quality ahead of proj</p>
          </div>

        </div>
      </div>
    </>
  );
}
