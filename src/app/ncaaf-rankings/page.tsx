"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import rankingsData from "@/data/rankings/football-rankings.json";
import { ChevronUp, ChevronDown } from "lucide-react";
import NCAALogo from "@/components/NCAALogo";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type FootballRanking = {
  team: string;
  conference: string;
  bbmif: number | string;
  model_rank: number | string;
  prev_rank: number | string;
  sp_offense: number | string;
  sp_defense: number | string;
  ypp_diff: number | string;
  turnover_margin: number | string;
  record: string;
};

// ── Tooltips ──────────────────────────────────────────────────────────────────
const TOOLTIPS: Record<string, string> = {
  model_rank:       "BBMIF's proprietary model rank — built on SP+ efficiency ratings, yards per play differential, turnover margin, quality wins, and home field advantage. This is the primary ranking used for BBMIF's picks and spread predictions.",
  bbmif:            "The raw BBMIF score — a composite efficiency rating that drives the model rank. Higher is better.",
  team:             "Team name. Click any column header label to learn what that stat means.",
  conference:       "The team's athletic conference. Use the conference filter above to narrow the table.",
  sp_offense:       "SP+ Offensive rating (Bill Connelly / ESPN). Measures points per drive above average. Higher is better.",
  sp_defense:       "SP+ Defensive rating. Measures points per drive conceded relative to average. Lower is better defense — a team allowing fewer points will have a lower SP+ Def number.",
  ypp_diff:         "Yards per play differential — team YPP minus opponent YPP, adjusted for schedule strength. Positive means the team consistently outgains opponents.",
  turnover_margin:  "Turnovers forced minus turnovers committed per game (recency-weighted). Positive is good — it means the team is taking the ball away more than giving it up.",
  record:           "Season win-loss record.",
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

// ── Sortable Header ───────────────────────────────────────────────────────────
function SortableHeader({
  label, columnKey, tooltipId, sortColumn, sortDirection, handleSort,
  activeDescId, openDesc, closeDesc, align = "center",
}: {
  label: string; columnKey: keyof FootballRanking; tooltipId?: string;
  sortColumn: keyof FootballRanking; sortDirection: "asc" | "desc";
  handleSort: (col: keyof FootballRanking) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
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
  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation(); closeDesc?.(); handleSort(columnKey);
  };

  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 10px", textAlign: align, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span onClick={handleSortClick} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.35, lineHeight: 1 }}>
          {isActive
            ? sortDirection === "asc"
              ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />
              : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} />
            : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

// ── Color Legend ──────────────────────────────────────────────────────────────
function RankColorLegend() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(22,163,74,0.25)", border: "1px solid rgba(22,163,74,0.4)" }} />
        <span style={{ fontSize: 12, color: "#57534e" }}>Strong YPP + turnover margin</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(232,184,48,0.18)", border: "1px solid rgba(232,184,48,0.4)" }} />
        <span style={{ fontSize: 12, color: "#57534e" }}>SP+ driven — limited box score data</span>
      </div>
    </div>
  );
}

// ── Explainer Accordion ───────────────────────────────────────────────────────
function WhyDifferentAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen(p => !p)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>🏈 How does BBMIF rank college football teams?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>BBMIF is built around one question: <strong>which teams are most likely to win against the spread?</strong> Unlike AP or CFP rankings that reward brand and reputation, BBMIF is purely predictive.</p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: "#1c1917" }}>BBMIF specifically rewards:</p>
          {[
            { label: "SP+ efficiency ratings", desc: "Bill Connelly's SP+ offense and defense ratings are the model's backbone — opponent-adjusted efficiency metrics built on play-by-play data." },
            { label: "Yards per play differential", desc: "Recency-weighted YPP differential captures how efficiently a team moves the ball relative to their opponents across recent games." },
            { label: "Turnover margin", desc: "Forcing turnovers while protecting the ball is one of the strongest predictors of ATS performance in college football." },
            { label: "Quality wins", desc: "Wins over well-ranked opponents are rewarded — losses to ranked teams are penalized less than losses to weak teams." },
          ].map(({ label, desc }) => (
            <p key={label} style={{ marginBottom: 10 }}><strong>{label}</strong> — {desc}</p>
          ))}
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>
            Model correlation vs actual game margins: 0.721 (2025 season, 785 games). Out-of-sample ATS: 58.6% using 2024-trained weights on 2025 Vegas lines.
          </p>
        </div>
      )}
    </div>
  );
}

// ── BBMIF Score Cell (gold bar) ───────────────────────────────────────────────
function BbmifScoreCell({ score }: { score: number | string }) {
  const num = Number(score);
  if (isNaN(num) || score === "") return <span style={{ color: "#a8a29e" }}>—</span>;
  const pct = Math.max(0, Math.min(1, (num - 0) / 40));
  const r = Math.round(140 + (232 - 140) * pct);
  const g = Math.round(100 + (184 - 100) * pct);
  const b = Math.round(10  + (48  - 10)  * pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: "#0a1a2f", minWidth: 40, textAlign: "right" }}>{num.toFixed(1)}</span>
      <div style={{ width: 44, height: 6, backgroundColor: "#e7e5e4", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: `rgb(${r},${g},${b})`, borderRadius: 3 }} />
      </div>
    </div>
  );
}

// ── SP+ Cell ──────────────────────────────────────────────────────────────────
function SpCell({ value }: { value: number | string }) {
  const num = Number(value);
  if (isNaN(num) || value === "" || value === 0 || num === 0) {
    return <span style={{ color: "#a8a29e", fontFamily: "ui-monospace, monospace", fontSize: 13 }}>—</span>;
  }
  return <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#57534e" }}>{num.toFixed(1)}</span>;
}

// ── Differential Cell (colored +/–) ──────────────────────────────────────────
function DiffCell({ value }: { value: number | string }) {
  const num = Number(value);
  // Treat 0, empty string, or non-finite as missing
  if (isNaN(num) || value === "" || value === 0 || value === "0" || value === "0.0" || value === "0.00") {
    return <span style={{ color: "#a8a29e", fontFamily: "ui-monospace, monospace", fontSize: 13 }}>—</span>;
  }
  const color = num > 0.3 ? "#16a34a" : num < -0.3 ? "#dc2626" : "#57534e";
  return (
    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: Math.abs(num) > 0.3 ? 600 : 400, color }}>
      {num > 0 ? "+" : ""}{num.toFixed(2)}
    </span>
  );
}

// ── Rank Movement ─────────────────────────────────────────────────────────────
function RankMovement({ current, previous }: { current: number | string; previous: number | string }) {
  const curr = Number(current), prev = Number(previous);
  if (!previous || previous === "" || isNaN(prev) || isNaN(curr)) return null;
  const diff = prev - curr;
  if (diff === 0) return <span style={{ fontSize: 10, color: "#a8a29e", fontWeight: 500, whiteSpace: "nowrap" }}>—</span>;
  const up = diff > 0;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: up ? "#16a34a" : "#dc2626", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 1 }}>
      {up ? "▲" : "▼"}{Math.abs(diff)}
    </span>
  );
}

// ── Row highlight ─────────────────────────────────────────────────────────────
function getRowColor(team: FootballRanking): string | null {
  const ypp = Number(team.ypp_diff);
  const to  = Number(team.turnover_margin);
  if (!isNaN(ypp) && !isNaN(to) && ypp > 1.0 && to > 0.3) return "rgba(22,163,74,0.10)";
  const spO = Number(team.sp_offense), spD = Number(team.sp_defense);
  if (!isNaN(spO) && !isNaN(spD) && spO > 35 && spD < 15) return "rgba(232,184,48,0.10)";
  return null;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FootballRankingsPage() {
  const [sortColumn,       setSortColumn]       = useState<keyof FootballRanking>("model_rank");
  const [sortDirection,    setSortDirection]    = useState<"asc" | "desc">("asc");
  const [search,           setSearch]           = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  const [descPortal,       setDescPortal]       = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc  = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // JSON-LD structured data
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org", "@type": "Dataset",
      name: "BBMIF NCAA Football Rankings",
      description: "Live NCAA football rankings generated by the BBMI Football Model Index.",
      url: "https://bbmisports.com/ncaaf-rankings",
      dateModified: new Date().toISOString(),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Parse last_updated and normalize rows
  const { normalizedRankings, lastUpdated } = useMemo(() => {
    const raw = rankingsData as unknown;
    if (!Array.isArray(raw)) return { normalizedRankings: [], lastUpdated: "" };

    const parseNum = (v: unknown): number | string => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : v;
      }
      return "";
    };

    let lu = "";
    const rows = (raw as Record<string, unknown>[])
      .filter(r => {
        const name = String(r.team ?? r.my_name ?? "").trim();
        return name !== "" && name !== "last_updated";
      })
      .map((r): FootballRanking => {
        if (r.last_updated) lu = String(r.last_updated);
        const team = String(r.team ?? r.my_name ?? "");
        return {
          team,
          conference:      String(r.conference ?? ""),
          bbmif:           parseNum(r.bbmif ?? r.bbmi ?? r.score),
          model_rank:      parseNum(r.model_rank ?? r.bbmif_rank ?? r.rank),
          prev_rank:       parseNum(r.prev_rank ?? ""),
          sp_offense:      parseNum(r.sp_offense ?? ""),
          sp_defense:      parseNum(r.sp_defense ?? ""),
          ypp_diff:        parseNum(r.ypp_diff ?? ""),
          turnover_margin: parseNum(r.turnover_margin ?? ""),
          record:          String(r.record ?? ""),
        };
      });

    return { normalizedRankings: rows, lastUpdated: lu };
  }, []);

  const conferences = useMemo(() => {
    const set = new Set<string>();
    normalizedRankings.forEach(t => { if (t.conference) set.add(t.conference); });
    return Array.from(set).sort();
  }, [normalizedRankings]);

  const handleSort = (column: keyof FootballRanking) => {
    if (column === sortColumn) setSortDirection(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(column); setSortDirection(column === "bbmif" ? "desc" : "asc"); }
  };

  const filteredRankings = useMemo(() => {
    const q = search.toLowerCase();
    return normalizedRankings.filter(team => {
      const matchesSearch = team.team.toLowerCase().includes(q) ||
        team.conference.toLowerCase().includes(q) ||
        String(team.model_rank).includes(q);
      const matchesConf = conferenceFilter === "all" || team.conference === conferenceFilter;
      return matchesSearch && matchesConf;
    });
  }, [search, conferenceFilter, normalizedRankings]);

  const sortedRankings = useMemo(() => {
    const numericKeys: (keyof FootballRanking)[] = ["model_rank", "bbmif", "sp_offense", "sp_defense", "ypp_diff", "turnover_margin"];
    return [...filteredRankings].sort((a, b) => {
      const key = sortColumn;
      if (numericKeys.includes(key)) {
        const nA = Number(a[key]), nB = Number(b[key]);
        const aV = !isNaN(nA) && a[key] !== "", bV = !isNaN(nB) && b[key] !== "";
        if (!aV && !bV) return 0; if (!aV) return 1; if (!bV) return -1;
        return sortDirection === "asc" ? nA - nB : nB - nA;
      }
      const sA = String(a[key] ?? ""), sB = String(b[key] ?? "");
      return sortDirection === "asc" ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });
  }, [filteredRankings, sortColumn, sortDirection]);

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const TD: React.CSSProperties      = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
  const filtersActive = search !== "" || conferenceFilter !== "all" || sortColumn !== "model_rank" || sortDirection !== "asc";

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
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <span style={{ fontSize: "2rem" }}>🏈</span>
              <span>BBMIF Team Rankings</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              FBS teams ranked by BBMIF&apos;s predictive model — built on SP+ efficiency, yards per play
              differential, turnover margin, and quality wins. Updated weekly after each round of games.
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
                placeholder="Search teams or conferences…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ height: 38, fontSize: 13, borderRadius: 8, border: search !== "" ? "1.5px solid #0a1a2f" : "1.5px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 12px", width: 240, outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
              />
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <select
                  value={conferenceFilter}
                  onChange={e => setConferenceFilter(e.target.value)}
                  style={{ height: 38, fontSize: 13, borderRadius: 8, border: conferenceFilter !== "all" ? "1.5px solid #0a1a2f" : "1.5px solid #d6d3d1", backgroundColor: conferenceFilter !== "all" ? "#0a1a2f" : "#ffffff", color: conferenceFilter !== "all" ? "#ffffff" : "#1c1917", padding: "0 32px 0 12px", minWidth: 160, appearance: "none", cursor: "pointer", fontWeight: conferenceFilter !== "all" ? 600 : 400, outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <option value="all">All conferences</option>
                  {conferences.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={conferenceFilter !== "all" ? "#ffffff" : "#78716c"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, pointerEvents: "none" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {filtersActive && (
                <button
                  onClick={() => { setSearch(""); setConferenceFilter("all"); setSortColumn("model_rank"); setSortDirection("asc"); }}
                  style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1.5px solid #e7e5e4", backgroundColor: "#f8fafc", color: "#64748b", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Clear
                </button>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#57534e" }}>
              Showing <strong>{sortedRankings.length}</strong> of <strong>{normalizedRankings.length}</strong> teams
              {lastUpdated ? `. Updated ${lastUpdated}` : ""}
            </div>
          </div>

          {/* LEGEND */}
          <RankColorLegend />

          {/* TABLE */}
          <div style={{ maxWidth: 1080, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 700, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto", minWidth: 780 }}>
                  <colgroup>
                    <col style={{ width: 80 }} />
                    <col />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: 120 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 80 }} />
                    <col style={{ width: 70 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader label="Rank"       columnKey="model_rank"       tooltipId="model_rank"      align="center" {...headerProps} />
                      <SortableHeader label="Team"       columnKey="team"              tooltipId="team"            align="left"   {...headerProps} />
                      <SortableHeader label="Conference" columnKey="conference"        tooltipId="conference"      align="left"   {...headerProps} />
                      <SortableHeader label="BBMIF"      columnKey="bbmif"             tooltipId="bbmif"           align="center" {...headerProps} />
                      <SortableHeader label="SP+ Off"    columnKey="sp_offense"        tooltipId="sp_offense"      align="center" {...headerProps} />
                      <SortableHeader label="SP+ Def"    columnKey="sp_defense"        tooltipId="sp_defense"      align="center" {...headerProps} />
                      <SortableHeader label="YPP Diff"   columnKey="ypp_diff"          tooltipId="ypp_diff"        align="center" {...headerProps} />
                      <SortableHeader label="TO Margin"  columnKey="turnover_margin"   tooltipId="turnover_margin" align="center" {...headerProps} />
                      <SortableHeader label="Record"     columnKey="record"            tooltipId="record"          align="center" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRankings.map((team, i) => {
                      const rowBg = getRowColor(team) ?? (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      return (
                        <tr key={`${team.team}-${team.model_rank}`} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#0a1a2f" }}>
                            {team.model_rank}
                          </td>
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Link href={`/ncaaf-team/${encodeURIComponent(team.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", fontWeight: 600, fontSize: 13, textDecoration: "none" }} className="hover:underline">
                                <NCAALogo teamName={team.team} size={26} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.team}</span>
                              </Link>
                              <RankMovement current={team.model_rank} previous={team.prev_rank} />
                            </div>
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: "#57534e", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {team.conference || "—"}
                          </td>
                          <td style={{ ...TD, textAlign: "center" }}>
                            <BbmifScoreCell score={team.bbmif} />
                          </td>
                          <td style={{ ...TD_MONO }}>
                            <SpCell value={team.sp_offense} />
                          </td>
                          <td style={{ ...TD_MONO }}>
                            <SpCell value={team.sp_defense} />
                          </td>
                          <td style={{ ...TD, textAlign: "center" }}>
                            <DiffCell value={team.ypp_diff} />
                          </td>
                          <td style={{ ...TD, textAlign: "center" }}>
                            <DiffCell value={team.turnover_margin} />
                          </td>
                          <td style={TD_MONO}>
                            {team.record || "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {sortedRankings.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>
                          No teams match your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 6 }}>
              SP+ ratings via CollegeFootballData.com · updated weekly
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
