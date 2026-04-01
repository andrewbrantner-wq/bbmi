"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import teamRatingsRaw from "@/data/rankings/mlb-rankings.json";
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
    <th ref={thRef} style={{ backgroundColor: "#0a1628", color: "#94a3b8", padding: "10px 12px", textAlign: align, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.1)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", userSelect: "none" }}>
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
      <button type="button" onClick={() => setOpen(prev => !prev)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: "#0a1628", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>{"\u26BE"} How does the BBMI MLB model work?</span>
        <span style={{ fontSize: 14 }}>{open ? "\u25B2" : "\u25BC"}</span>
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
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
  const filtersActive = search !== "" || sortColumn !== "model_rank" || sortDirection !== "asc";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper">
        <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ background: "#0a1628", borderRadius: 12, padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" width={48} height={48} style={{ marginRight: 12 }} />
              <span>MLB Power Rankings</span>
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              30 MLB teams ranked by BBMI composite score — pitching quality (FIP), offensive production (wOBA), and run differential. Updated daily.
            </p>

          </div>

          {/* ACCORDION */}
          <div style={{ maxWidth: 720, margin: "0 auto 24px" }}>
            <HowItWorksAccordion />
          </div>

          {/* TABLE */}
          <div style={{ maxWidth: 1120, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1200, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Rank"     columnKey="model_rank"            tooltipId="model_rank"            align="center" {...headerProps} />
                      <SortableHeader label="Team"     columnKey="team"                  tooltipId="team"                  align="left"   {...headerProps} />
                      <SortableHeader label="BBMI"     columnKey="bbmi_score"            tooltipId="bbmi_score"            align="center" {...headerProps} />
                      <SortableHeader label="OFF"      columnKey="off_rating"            tooltipId="off_rating"            align="center" {...headerProps} />
                      <SortableHeader label="PIT"      columnKey="pit_rating"            tooltipId="pit_rating"            align="center" {...headerProps} />
                      <SortableHeader label="Margin"   columnKey="scoring_margin"        tooltipId="scoring_margin"        align="center" {...headerProps} />
                      <SortableHeader label="FIP"      columnKey="fip"                   tooltipId="fip"                   align="center" {...headerProps} />
                      <SortableHeader label="wOBA*"    columnKey="woba_neutral"          tooltipId="woba_neutral"          align="center" {...headerProps} />
                      <SortableHeader label="OPS"      columnKey="ops"                   tooltipId="ops"                   align="center" {...headerProps} />
                      <SortableHeader label="Record"   columnKey="record"                tooltipId="record"                align="center" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t, i) => {
                      const rowBg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
                      return (
                        <tr key={t.team} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#0a1628" }}>{t.model_rank}</td>
                          <td style={TD}>
                            <Link href={`/mlb/team/${encodeURIComponent(t.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1628", textDecoration: "none" }} className="hover:underline">
                              <MLBLogo teamName={t.team} size={26} />
                              <span style={{ fontWeight: 600, fontSize: 13 }}>{t.team}</span>
                            </Link>
                          </td>
                          <td style={{ ...TD_MONO, fontWeight: 800, fontSize: 14, color: t.bbmi_score >= 105 ? "#16a34a" : t.bbmi_score >= 97 ? "#0a1628" : "#dc2626" }}>{t.bbmi_score.toFixed(1)}</td>
                          <td style={{ ...TD_MONO, fontWeight: 600, color: t.off_rating >= 105 ? "#16a34a" : t.off_rating >= 97 ? "#57534e" : "#dc2626" }}>{t.off_rating.toFixed(1)}</td>
                          <td style={{ ...TD_MONO, fontWeight: 600, color: t.pit_rating >= 105 ? "#16a34a" : t.pit_rating >= 97 ? "#57534e" : "#dc2626" }}>{t.pit_rating.toFixed(1)}</td>
                          <td style={TD}><MarginCell margin={t.scoring_margin} /></td>
                          <td style={{ ...TD_MONO, color: t.fip <= 3.5 ? "#16a34a" : t.fip <= 4.2 ? "#57534e" : "#dc2626" }}>{t.fip.toFixed(2)}</td>
                          <td style={{ ...TD_MONO, color: t.woba_neutral >= 0.330 ? "#16a34a" : t.woba_neutral >= 0.310 ? "#57534e" : "#dc2626" }}>{t.woba_neutral.toFixed(3)}</td>
                          <td style={{ ...TD_MONO, color: t.ops >= 0.750 ? "#16a34a" : t.ops >= 0.700 ? "#57534e" : "#dc2626" }}>{t.ops.toFixed(3)}</td>
                          <td style={TD_MONO}>{t.record}</td>
                        </tr>
                      );
                    })}
                    {sorted.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No teams match your search.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 6 }}>BBMI = 50% offense (park-neutral wOBA) + 50% pitching (FIP) {"\u00B7"} Bayesian-blended with prior year {"\u00B7"} 100 = league avg {"\u00B7"} wOBA* = park-neutral</p>
          </div>

        </div>
      </div>
    </>
  );
}
