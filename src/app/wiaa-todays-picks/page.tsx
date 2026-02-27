"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import wiaaRankings from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import { ChevronUp, ChevronDown } from "lucide-react";

// ------------------------------------------------------------
// TEAM NAME ALIASES
// Normalizes schedule team names to canonical ranking names
// ------------------------------------------------------------

const NAME_ALIASES: Record<string, string> = {
  "augustine prep south": "St Augustine Prep",
  "st ignatius chesterton academy": "Chesterton Academy Milwaukee",
  "st. john's northwestern": "Saint John's Northwestern",
  "st. francis": "Saint Francis",
  "durand": "Durand-Arkansaw",
};

const canonicalName = (name: string): string =>
  NAME_ALIASES[name.toLowerCase()] ?? name;

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const normalizeDate = (dateStr: string) => {
  if (!dateStr) return "";
  return dateStr.split(" ")[0].split("T")[0];
};

const truncate = (str: string, n = 20) =>
  str.length > n ? str.slice(0, n) + "…" : str;

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type TeamMeta = {
  team: string;
  record: string;
  bbmi_rank: number;
  slug: string;
};

type GameRow = {
  date: string;
  home: string;
  away: string;
  homeDiv: string;
  awayDiv: string;
  homeMeta: TeamMeta | null;
  awayMeta: TeamMeta | null;
  teamLine: number | null;
  homeWinProb: number;
  bbmiPick: string;
};

type SortCol = "away" | "home" | "line" | "pick" | "win";

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  away: "The visiting team. Division and season record shown below the name. Click the team name to view their full schedule and BBMI profile.",
  home: "The home team. Division and season record shown below the name. Click the team name to view their full schedule and BBMI profile.",
  line: "BBMI's predicted point spread from the home team's perspective. A negative number means BBMI favors the home team. A positive number means BBMI favors the away team.",
  pick: "The team BBMI predicts will win this game outright, based on its model line.",
  win: "BBMI's estimated probability that the home team wins. Below 50% means the model favors the away team.",
};

// ------------------------------------------------------------
// PORTAL
// ------------------------------------------------------------

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
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({
  label, columnKey, tooltipId, sortColumn, sortDirection, handleSort,
  activeDescId, openDesc, closeDesc, align = "center",
}: {
  label: string; columnKey: SortCol; tooltipId?: string;
  sortColumn: SortCol; sortDirection: "asc" | "desc";
  handleSort: (col: SortCol) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  align?: "left" | "center";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_wiaa_picks" : null;
  const isActive = sortColumn === columnKey;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (activeDescId === uid) closeDesc?.();
    else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); }
  };

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeDesc?.();
    handleSort(columnKey);
  };

  return (
    <th
      ref={thRef}
      style={{
        backgroundColor: "#0a1a2f",
        color: "#ffffff",
        padding: "8px 10px",
        textAlign: align,
        whiteSpace: "nowrap",
        position: "sticky",
        top: 0,
        zIndex: 20,
        borderBottom: "2px solid rgba(255,255,255,0.1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span
          onClick={handleLabelClick}
          style={{
            fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: tooltipId ? "help" : "default",
            textDecoration: tooltipId ? "underline dotted" : "none",
            textUnderlineOffset: 3,
            textDecorationColor: "rgba(255,255,255,0.45)",
          }}
        >
          {label}
        </span>
        <span
          onClick={handleSortClick}
          style={{ cursor: "pointer", opacity: isActive ? 1 : 0.35, lineHeight: 1 }}
        >
          {isActive
            ? sortDirection === "asc" ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} />
            : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// HOW TO USE ACCORDION
// ------------------------------------------------------------

function HowToUseAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "1.5rem" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>📖 How do I use this page?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>This page shows BBMI's predictions for today's WIAA games. Each row is one matchup — use the date picker to browse upcoming games and the division filter to narrow by division.</p>
          <p style={{ marginBottom: 12 }}><strong>The Home Line</strong> is BBMI's predicted point spread from the home team's perspective. A negative number (e.g. -8) means the model thinks the home team wins by 8. A positive number means the model favors the away team.</p>
          <p style={{ marginBottom: 12 }}><strong>The BBMI Pick</strong> is the team the model predicts will win outright. The <strong>Home Win %</strong> shows model confidence — values below 50% mean the model favors the away team.</p>
          <p style={{ marginBottom: 12 }}><strong>Click any team name</strong> to view their full schedule, BBMI rank, and tournament probabilities. Division and season record are shown below each name for quick context.</p>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "#166534", margin: 0, fontWeight: 600 }}>
              💡 Rows marked with a ★ are high-confidence picks — home win probability ≥70% or ≤30%. These are the games where the model is most decisive and historically most accurate.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>WIAA games don't have Vegas lines. The Home Line is BBMI's model prediction only — not a betting spread. For entertainment purposes only.</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// WIAA ACCURACY CALLOUT
// ------------------------------------------------------------

function WIAAAccuracyCallout({
  overallWinPct, overallTotal,
  highConfWinPct, highConfTotal,
}: {
  overallWinPct: string; overallTotal: number;
  highConfWinPct: string; highConfTotal: number;
}) {
  const improvement = (Number(highConfWinPct) - Number(overallWinPct)).toFixed(1);

  return (
    <div style={{ backgroundColor: "#0a1a2f", borderRadius: 12, border: "2px solid #facc15", marginBottom: "2rem", overflow: "hidden" }}>
      <style>{`
        .wiaa-callout-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          padding: 1.25rem 1rem 0.75rem;
        }
        .wiaa-callout-cta {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 0.85rem 1rem 1rem;
          text-align: center;
        }
        .wiaa-callout-divider {
          width: 1px; background: rgba(255,255,255,0.1);
          align-self: stretch; margin: 0.25rem 0;
        }
        @media (min-width: 640px) {
          .wiaa-callout-grid {
            grid-template-columns: 1fr auto 1fr auto 1fr;
            padding: 1.25rem 1.5rem;
            align-items: center;
          }
          .wiaa-callout-divider { height: 56px; align-self: center; margin: 0; }
          .wiaa-callout-cta { grid-column: auto; border-top: none; padding: 0 0.75rem; }
        }
      `}</style>

      <div style={{ backgroundColor: "rgba(250,204,21,0.1)", borderBottom: "1px solid rgba(250,204,21,0.2)", padding: "0.5rem 1.25rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>
        🎯 BBMI WIAA model accuracy — documented this season
      </div>

      <div className="wiaa-callout-grid">
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Overall Pick Accuracy</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.3rem" }}>{overallWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{overallTotal.toLocaleString()} games tracked</div>
        </div>
        <div className="wiaa-callout-divider" />
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>High Confidence ★ Picks</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1, marginBottom: "0.3rem" }}>{highConfWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{highConfTotal} games (win prob ≥70% or ≤30%)</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(250,204,21,0.15)", color: "#facc15", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>
            +{improvement}pts vs overall
          </div>
        </div>
        <div className="wiaa-callout-cta">
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", lineHeight: 1.5 }}>
            WIAA picks are <strong style={{ color: "#4ade80" }}>always free</strong> — no subscription needed
          </div>
          <Link href="/wiaa-model-accuracy" style={{ display: "inline-block", backgroundColor: "#facc15", color: "#0a1a2f", padding: "0.5rem 1.1rem", borderRadius: 7, fontWeight: 800, fontSize: "0.8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
            View full accuracy history →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAATodaysPicks() {
  const [sortColumn, setSortColumn] = useState<SortCol>("away");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const today = new Date().toLocaleDateString("en-CA");
  const [selectedDate, setSelectedDate] = useState(today);
  const [division, setDivision] = useState<number | "all">("all");

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI Today's Picks – WIAA High School Basketball Predictions",
      description: "Live WIAA basketball BBMI model picks and win probabilities for today's games.",
      url: "https://bbmihoops.com/wiaa-todays-picks",
      dateModified: new Date().toISOString(),
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Rankings map uses canonical names as keys
  const rankingsMap = useMemo(() => {
    const map = new Map<string, TeamMeta>();
    wiaaRankings.forEach((r) => map.set(r.team, r));
    return map;
  }, []);

  // Helper: look up meta using canonical name
  const getMeta = (name: string): TeamMeta | null =>
    rankingsMap.get(canonicalName(name)) ?? null;

  const allCompletedGames = useMemo(() => {
    const gamesMap = new Map<string, { home: string; away: string; homeWinProb: number; bbmiPick: string; actualHomeWon: boolean }>();
    (wiaaTeams as any[])
      .filter((g) => g.location === "Home" && g.result && g.result.trim() !== "" && g.teamLine !== null && g.teamLine !== 0)
      .forEach((g) => {
        const gameKey = [g.team, g.opp].sort().join("|") + "|" + normalizeDate(g.date);
        if (gamesMap.has(gameKey)) return;
        gamesMap.set(gameKey, {
          home: g.team, away: g.opp,
          homeWinProb: g.teamWinPct,
          bbmiPick: g.teamLine < 0 ? g.team : g.opp,
          actualHomeWon: g.result === "W",
        });
      });
    return Array.from(gamesMap.values());
  }, []);

  const accuracyStats = useMemo(() => {
    if (allCompletedGames.length === 0) {
      return { overallWinPct: "0.0", overallTotal: 0, highConfWinPct: "0.0", highConfTotal: 0 };
    }
    let correct = 0;
    allCompletedGames.forEach((g) => {
      if ((g.bbmiPick === g.home) === g.actualHomeWon) correct++;
    });
    const overallWinPct = ((correct / allCompletedGames.length) * 100).toFixed(1);
    const highConf = allCompletedGames.filter((g) => g.homeWinProb >= 0.70 || g.homeWinProb <= 0.30);
    let highConfCorrect = 0;
    highConf.forEach((g) => { if ((g.bbmiPick === g.home) === g.actualHomeWon) highConfCorrect++; });
    const highConfWinPct = highConf.length > 0 ? ((highConfCorrect / highConf.length) * 100).toFixed(1) : "0.0";
    return { overallWinPct, overallTotal: allCompletedGames.length, highConfWinPct, highConfTotal: highConf.length };
  }, [allCompletedGames]);

  const gamesForDate: GameRow[] = useMemo(() => {
    const gamesMap = new Map<string, GameRow>();
    wiaaTeams
      .filter((g) => normalizeDate(g.date) === selectedDate && g.location === "Home")
      .forEach((g) => {
        const gameKey = [g.team, g.opp].sort().join("|");
        if (gamesMap.has(gameKey)) return;
        gamesMap.set(gameKey, {
          date: normalizeDate(g.date),
          home: g.team, away: g.opp,
          homeDiv: g.teamDiv, awayDiv: g.oppDiv,
          homeMeta: getMeta(g.team),
          awayMeta: getMeta(g.opp),
          teamLine: g.teamLine,
          homeWinProb: g.teamWinPct,
          bbmiPick: g.teamLine !== null && g.teamLine !== 0 ? (g.teamLine < 0 ? g.team : g.opp) : "",
        });
      });
    return Array.from(gamesMap.values());
  }, [selectedDate, rankingsMap]);

  const divisions = useMemo(() => {
    const set = new Set<number>();
    gamesForDate.forEach((g) => { const d = Number(g.homeDiv); if (!Number.isNaN(d)) set.add(d); });
    return Array.from(set).sort((a, b) => a - b);
  }, [gamesForDate]);

  const filteredGames = useMemo(() => {
    if (division === "all") return gamesForDate;
    return gamesForDate.filter((g) => Number(g.homeDiv) === division);
  }, [gamesForDate, division]);

  const todaysGames = useMemo(() => {
    const sorted = [...filteredGames];
    sorted.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case "away": valA = a.away; valB = b.away; break;
        case "home": valA = a.home; valB = b.home; break;
        case "line": valA = a.teamLine; valB = b.teamLine; break;
        case "pick": valA = a.bbmiPick; valB = b.bbmiPick; break;
        case "win": valA = a.homeWinProb; valB = b.homeWinProb; break;
      }
      if (typeof valA === "number" && typeof valB === "number")
        return sortDirection === "asc" ? valA - valB : valB - valA;
      return sortDirection === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return sorted;
  }, [filteredGames, sortColumn, sortDirection]);

  const handleSort = (column: SortCol) => {
    if (column === sortColumn) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  // Helper: render a team name as a link if we have meta, plain text if not
  const TeamLink = ({ name, meta, style }: { name: string; meta: TeamMeta | null; style?: React.CSSProperties }) => {
    const canonical = canonicalName(name);
    if (meta) {
      return (
        <Link
          href={`/wiaa-team/${encodeURIComponent(canonical)}`}
          style={{ fontSize: 13, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#0a1a2f", ...style }}
          className="hover:underline"
        >
          {name}
        </Link>
      );
    }
    return (
      <span style={{ fontSize: 13, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#44403c", ...style }}>
        {name}
      </span>
    );
  };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full max-w-[1400px] mx-auto px-4 py-8">

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="wiaa" />
              <span> WIAA Picks</span>
            </h1>
            <p className="text-stone-500 text-sm text-center max-w-xl mt-2">
              BBMI model predictions for today's WIAA games — win probabilities and predicted spreads by division.
            </p>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 720, margin: "0 auto 1.5rem" }}>
            <HowToUseAccordion />
          </div>

          {/* ACCURACY CALLOUT */}
          <div style={{ maxWidth: 720, margin: "0 auto 2rem" }}>
            <WIAAAccuracyCallout
              overallWinPct={accuracyStats.overallWinPct}
              overallTotal={accuracyStats.overallTotal}
              highConfWinPct={accuracyStats.highConfWinPct}
              highConfTotal={accuracyStats.highConfTotal}
            />
          </div>

          {/* FILTERS */}
          <div style={{ maxWidth: 720, margin: "0 auto 1.5rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "14px 16px", backgroundColor: "#ffffff", border: "1px solid #d6d3d1", borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <input
                type="date"
                value={selectedDate}
                min={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ height: 36, flex: "1 1 140px", fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 8px" }}
              />
              <select
                value={division}
                onChange={(e) => setDivision(e.target.value === "all" ? "all" : Number(e.target.value))}
                style={{ height: 36, flex: "1 1 140px", fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 8px" }}
              >
                <option value="all">All Divisions</option>
                {divisions.map((d) => <option key={d} value={d}>Division {d}</option>)}
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: 10,
                overflow: "hidden",
                backgroundColor: "#ffffff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
              }}
            >
              {/* Mobile hint */}
              <div style={{ padding: "6px 14px", fontSize: 11, color: "#a8a29e", borderBottom: "1px solid #f5f5f4", display: "flex", justifyContent: "space-between" }}>
                <span>{todaysGames.length} game{todaysGames.length !== 1 ? "s" : ""}</span>
                <span className="sm:hidden">← scroll →</span>
              </div>

              <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "27%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <SortableHeader label="Away" columnKey="away" tooltipId="away" align="left" {...headerProps} />
                      <SortableHeader label="Home" columnKey="home" tooltipId="home" align="left" {...headerProps} />
                      <SortableHeader label="Line" columnKey="line" tooltipId="line" {...headerProps} />
                      <SortableHeader label="BBMI Pick" columnKey="pick" tooltipId="pick" {...headerProps} />
                      <SortableHeader label="Home Win %" columnKey="win" tooltipId="win" {...headerProps} />
                    </tr>
                  </thead>

                  <tbody>
                    {todaysGames.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>
                          No games found for this date{division !== "all" ? ` / Division ${division}` : ""}.
                        </td>
                      </tr>
                    )}

                    {todaysGames.map((g, i) => {
                      const isHighConf = g.homeWinProb >= 0.70 || g.homeWinProb <= 0.30;
                      const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";
                      const pickMeta = g.bbmiPick === g.home ? g.homeMeta : g.awayMeta;
                      const pickSlug = pickMeta?.slug;
                      const pickCanonical = canonicalName(g.bbmiPick);

                      return (
                        <tr
                          key={i}
                          style={{
                            backgroundColor: rowBg,
                            borderLeft: isHighConf ? "3px solid #facc15" : "3px solid transparent",
                          }}
                        >
                          {/* Away */}
                          <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              {g.awayMeta?.slug && (
                                <Image src={`/logos/wiaa/${g.awayMeta.slug}.png`} alt={g.away} width={24} height={24} style={{ flexShrink: 0 }} />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <TeamLink name={g.away} meta={g.awayMeta} />
                                <div style={{ fontSize: 11, color: "#a8a29e", whiteSpace: "nowrap" }}>
                                  D{Math.round(Number(g.awayDiv))}{g.awayMeta?.record ? ` · ${g.awayMeta.record}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Home */}
                          <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              {g.homeMeta?.slug && (
                                <Image src={`/logos/wiaa/${g.homeMeta.slug}.png`} alt={g.home} width={24} height={24} style={{ flexShrink: 0 }} />
                              )}
                              <div style={{ minWidth: 0 }}>
                                <TeamLink name={g.home} meta={g.homeMeta} />
                                <div style={{ fontSize: 11, color: "#a8a29e", whiteSpace: "nowrap" }}>
                                  D{Math.round(Number(g.homeDiv))}{g.homeMeta?.record ? ` · ${g.homeMeta.record}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Line */}
                          <td style={{ padding: "8px 6px", borderTop: "1px solid #f5f5f4", textAlign: "center", fontSize: 13, fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                            {g.teamLine === null ? "—" : g.teamLine > 0 ? `+${g.teamLine}` : g.teamLine}
                          </td>

                          {/* BBMI Pick */}
                          <td style={{ padding: "8px 6px", borderTop: "1px solid #f5f5f4", textAlign: "center", verticalAlign: "middle" }}>
                            {g.bbmiPick ? (
                              pickMeta ? (
                                <Link
                                  href={`/wiaa-team/${encodeURIComponent(pickCanonical)}`}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, fontSize: 13, color: "#0a1a2f", maxWidth: "100%", overflow: "hidden" }}
                                  className="hover:underline"
                                >
                                  {pickSlug && (
                                    <Image
                                      src={`/logos/wiaa/${pickSlug}.png`}
                                      alt={g.bbmiPick} width={18} height={18}
                                      style={{ flexShrink: 0 }}
                                    />
                                  )}
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {g.bbmiPick}
                                  </span>
                                </Link>
                              ) : (
                                <span style={{ fontSize: 13, fontWeight: 600, color: "#44403c" }}>{g.bbmiPick}</span>
                              )
                            ) : <span style={{ color: "#a8a29e" }}>—</span>}
                          </td>

                          {/* Win % */}
                          <td style={{ padding: "8px 6px", borderTop: "1px solid #f5f5f4", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 13, fontFamily: "ui-monospace, monospace", fontWeight: isHighConf ? 800 : 600, color: g.homeWinProb >= 0.5 ? "#16a34a" : "#dc2626" }}>
                              {(g.homeWinProb * 100).toFixed(1)}%
                            </span>
                            {isHighConf && (
                              <span title="High confidence pick" style={{ marginLeft: 3, fontSize: "0.6rem", color: "#d97706" }}>★</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div style={{ padding: "8px 14px", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4", fontSize: 11, color: "#78716c", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ borderLeft: "3px solid #facc15", paddingLeft: 6 }}>
                  ★ High confidence — win prob ≥70% or ≤30%
                </span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: 11, color: "#78716c", marginTop: 14, textAlign: "center", maxWidth: 600, margin: "14px auto 0" }}>
            WIAA games do not have Vegas lines. The Home Line is BBMI's model prediction only. For entertainment purposes only.
          </p>

        </div>
      </div>
    </>
  );
}
