"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import rankingsData from "@/data/rankings/rankings.json";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import { ChevronUp, ChevronDown } from "lucide-react";

type Ranking = {
  team: string;
  conference: string;
  model_rank: number | string;
  kenpom_rank: number | string;
  net_ranking: number | string;
  last_ten: string;
  record: string;
};

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  model_rank: "BBMI's proprietary model rank — built on offensive/defensive efficiency, schedule strength, and predictive performance. This is the primary ranking used for BBMI's picks and spread predictions.",
  team: "Click any team name to view their full schedule, BBMI line history, and win probabilities.",
  conference: "The team's athletic conference. Use the conference filter above to narrow the table.",
  kenpom_rank: "KenPom rank — a widely-used efficiency-based rating by Ken Pomeroy. Provided for reference alongside BBMI's model.",
  net_ranking: "NCAA Evaluation Tool rank — the official NCAA metric used for tournament seeding and selection. Lower is better.",
  last_ten: "Win-loss record over the team's last 10 games. Useful for spotting teams on a hot or cold streak.",
  record: "Season win-loss record.",
};

// ------------------------------------------------------------
// PORTAL
// ------------------------------------------------------------

function ColDescPortal({
  tooltipId,
  anchorRect,
  onClose,
}: {
  tooltipId: string;
  anchorRect: DOMRect;
  onClose: () => void;
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

  const left = Math.min(
    anchorRect.left + anchorRect.width / 2 - 110,
    window.innerWidth - 234
  );
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div
      ref={el}
      style={{
        position: "fixed", top, left, zIndex: 99999, width: 220,
        backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f",
        borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>
        {text}
      </div>
      <button
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}
      >✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER — label click = description, chevron = sort
// ------------------------------------------------------------

function SortableHeader({
  label,
  columnKey,
  tooltipId,
  sortColumn,
  sortDirection,
  handleSort,
  activeDescId,
  openDesc,
  closeDesc,
  className = "",
  style = {},
}: {
  label: string;
  columnKey: keyof Ranking;
  tooltipId?: string;
  sortColumn: keyof Ranking;
  sortDirection: "asc" | "desc";
  handleSort: (col: keyof Ranking) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_rk" : null;
  const isActive = sortColumn === columnKey;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (descShowing) closeDesc?.();
    else {
      const rect = thRef.current?.getBoundingClientRect();
      if (rect) openDesc(uid, rect);
    }
  };

  const handleSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeDesc?.();
    handleSort(columnKey);
  };

  return (
    <th
      ref={thRef}
      className={`select-none px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white ${className}`}
      style={style}
    >
      <div className="flex items-center gap-1">
        <span
          onClick={handleLabelClick}
          className="text-xs font-semibold tracking-wide"
          style={{
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
          className="cursor-pointer hover:text-stone-300 transition-colors"
          style={{ opacity: isActive ? 1 : 0.4 }}
          title="Sort"
        >
          {isActive ? (
            sortDirection === "asc" ? (
              <ChevronUp className="inline-block w-3 h-3" />
            ) : (
              <ChevronDown className="inline-block w-3 h-3" />
            )
          ) : (
            <ChevronUp className="inline-block w-3 h-3" />
          )}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// COLOR LEGEND
// ------------------------------------------------------------

function RankColorLegend() {
  return (
    <div className="flex items-center justify-center gap-6 mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(22,163,74,0.25)", border: "1px solid rgba(22,163,74,0.4)" }} />
        <span className="text-xs text-stone-600">BBMI ranks <strong>higher</strong> than consensus</span>
      </div>
      <div className="flex items-center gap-2">
        <div style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: "rgba(220,38,38,0.20)", border: "1px solid rgba(220,38,38,0.35)" }} />
        <span className="text-xs text-stone-600">BBMI ranks <strong>lower</strong> than consensus</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// WHY DIFFERENT ACCORDION — matches picks history page style
// ------------------------------------------------------------

function WhyDifferentAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      width: '100%',
      border: '1px solid #d6d3d1',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      backgroundColor: 'transparent',
    }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          textAlign: 'left',
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: '0.02em',
          backgroundColor: open ? '#1e3a5f' : '#0a1a2f',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          borderRadius: open ? '8px 8px 0 0' : '8px',
          transition: 'background-color 0.15s',
        }}
      >
        <span>🏀 Why does BBMI rank teams differently than KenPom, NET, or the AP Poll?</span>
        <span style={{ fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          backgroundColor: '#ffffff',
          padding: '20px 24px',
          borderTop: '1px solid #d6d3d1',
          fontSize: 14,
          color: '#44403c',
          lineHeight: 1.65,
        }}>
          <p style={{ marginBottom: 12 }}>
            Most ranking systems — KenPom, NET, AP — are designed to measure how good a team is <em>right now</em>, or to reflect wins, losses, and public perception. BBMI is built around a different question:{' '}
            <strong>which teams are most likely to make a deep run in the NCAA Tournament?</strong>
          </p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: '#1c1917' }}>
            BBMI specifically rewards qualities that translate in single-elimination play:
          </p>
          {[
            { label: 'Shooting efficiency', desc: 'High conversion rates under pressure, particularly from three-point range and at the free throw line.' },
            { label: 'Defensive discipline', desc: 'Limiting opponent scoring opportunities — turnover generation and shot quality conceded, not just points allowed.' },
            { label: 'Ball security', desc: 'High assist-to-turnover ratio indicates a team that shares the ball and protects possessions — critical in tight tournament games.' },
            { label: 'Strength of schedule', desc: 'Teams that have beaten quality opponents are more proven than those with inflated records against weak competition.' },
          ].map(({ label, desc }) => (
            <p key={label} style={{ marginBottom: 10 }}>
              <strong>{label}</strong> — {desc}
            </p>
          ))}
          <p style={{ fontSize: 12, color: '#78716c', marginTop: 8, borderTop: '1px solid #e7e5e4', paddingTop: 8 }}>
            Green-highlighted rows indicate teams BBMI favors over the KenPom/NET consensus — often mid-major programs the model sees as tournament threats. Red rows are teams BBMI views as overrated. Only shown when divergence exceeds 10 spots.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function RankingsPage() {
  const [sortColumn, setSortColumn] = useState<keyof Ranking>("model_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState("");

  // Page-level portal state
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  // JSON-LD injection
  useEffect(() => {
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI NCAA Basketball Rankings",
      description: "Live NCAA basketball rankings generated by the Brantner Basketball Model Index.",
      url: "https://bbmihoops.com/ncaa-rankings",
      dateModified: new Date().toISOString(),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Last updated timestamp
  useEffect(() => {
    fetch("/data/rankings/last_updated.txt")
      .then((res) => { if (!res.ok) throw new Error("Bad response"); return res.text(); })
      .then((txt) => { if (txt.startsWith("<!DOCTYPE")) throw new Error("HTML returned"); setLastUpdated(txt.trim()); })
      .catch(() => setLastUpdated("Unknown"));
  }, []);

  // Normalize rankings
  const normalizedRankings = useMemo<Ranking[]>(() => {
    const raw = rankingsData as unknown;
    if (!Array.isArray(raw)) return [];
    const possibleTeamKeys = ["team", "Team", "name", "team_name", "teamName"];
    const parseNum = (v: unknown): number | string => {
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const n = Number(v.replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : v;
      }
      return "";
    };
    return (raw as unknown[]).map((row): Ranking => {
      const r = row as Record<string, unknown>;
      let teamVal: unknown = "";
      for (const k of possibleTeamKeys) {
        if (k in r && r[k] != null && String(r[k]).trim() !== "") { teamVal = r[k]; break; }
      }
      return {
        team: String(teamVal ?? ""),
        conference: String(r.conference ?? r.Conference ?? ""),
        model_rank: parseNum(r.model_rank ?? r.modelRank ?? r["Model Rank"]),
        kenpom_rank: parseNum(r.kenpom_rank ?? r.kenpomRank ?? r.kenpom),
        net_ranking: parseNum(r.net_ranking ?? r.netRanking ?? r.net),
        last_ten: String(r.last_ten ?? r.lastTen ?? ""),
        record: String(r.record ?? ""),
      };
    });
  }, []);

  // Returns background color string for divergence, or null if no divergence
  const getBbmiDivergenceColor = (team: Ranking): string | null => {
    const bbmi = Number(team.model_rank);
    const kp = Number(team.kenpom_rank);
    const net = Number(team.net_ranking);
    const validRanks = [kp, net].filter((n) => !isNaN(n) && n > 0);
    if (isNaN(bbmi) || validRanks.length === 0) return null;
    const consensus = validRanks.reduce((a, b) => a + b, 0) / validRanks.length;
    const divergence = consensus - bbmi;
    if (Math.abs(divergence) < 10) return null;
    const intensity = Math.min((Math.abs(divergence) - 10) / 40, 1);
    if (divergence > 0) {
      const alpha = 0.10 + intensity * 0.20;
      return `rgba(22, 163, 74, ${alpha})`;
    } else {
      const alpha = 0.10 + intensity * 0.18;
      return `rgba(220, 38, 38, ${alpha})`;
    }
  };

  const getBbmiDivergenceStyle = (team: Ranking): React.CSSProperties => {
    const color = getBbmiDivergenceColor(team);
    return color ? { backgroundColor: color } : {};
  };

  const conferences = useMemo(() => {
    const set = new Set<string>();
    normalizedRankings.forEach((t) => set.add(t.conference));
    return Array.from(set).sort();
  }, [normalizedRankings]);

  const handleSort = (column: keyof Ranking) => {
    if (column === sortColumn) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const filteredRankings = useMemo(() => {
    const q = search.toLowerCase();
    return normalizedRankings.filter((team) => {
      const matchesSearch =
        team.team.toLowerCase().includes(q) ||
        team.conference.toLowerCase().includes(q) ||
        String(team.model_rank).includes(q) ||
        String(team.kenpom_rank).includes(q) ||
        String(team.net_ranking).includes(q);
      const matchesConference = conferenceFilter === "all" || team.conference === conferenceFilter;
      return matchesSearch && matchesConference;
    });
  }, [search, conferenceFilter, normalizedRankings]);

  const sortedRankings = useMemo(() => {
    return [...filteredRankings].sort((a: Ranking, b: Ranking) => {
      const key = sortColumn;
      if (key === "model_rank" || key === "kenpom_rank" || key === "net_ranking") {
        const numA = Number(a[key]);
        const numB = Number(b[key]);
        if (!isNaN(numA) && !isNaN(numB)) return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      const sa = String(a[key] ?? "");
      const sb = String(b[key] ?? "");
      return sortDirection === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filteredRankings, sortColumn, sortDirection]);

  const totalTeams = normalizedRankings.length;
  const visibleTeams = sortedRankings.length;

  const headerProps = {
    sortColumn, sortDirection, handleSort,
    activeDescId: descPortal?.id,
    openDesc, closeDesc,
  };

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
          <div className="mt-10 flex flex-col items-center mb-3">
            <h1 className="flex items-center text-2xl sm:text-3xl font-bold tracking-tightest leading-tight mt-2">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>BBMI Men's Team Rankings</span>
            </h1>
            <p className="text-stone-500 text-sm text-center max-w-xl mt-2">
              Teams ranked by BBMI's predictive model — built on efficiency, schedule strength, and historical accuracy.
              KenPom and NET are shown alongside for reference. Click any column header label to learn what it means.
            </p>
          </div>

          {/* WHY BBMI DIFFERS — COLLAPSIBLE */}
          <div className="w-full max-w-2xl mx-auto mb-6">
            <WhyDifferentAccordion />
          </div>

          {/* SEARCH + FILTERS */}
          <div className="mb-4 flex flex-col items-center gap-3">
            <Input
              placeholder="Search teams, conferences, rankings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 text-sm tracking-tight"
            />
            <select
              value={conferenceFilter}
              onChange={(e) => setConferenceFilter(e.target.value)}
              className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
            >
              <option value="all">All conferences</option>
              {conferences.map((conf) => (
                <option key={conf} value={conf}>{conf}</option>
              ))}
            </select>
            <Button
              variant="outline"
              className="h-9 w-32 text-sm tracking-tight"
              onClick={() => { setSearch(""); setConferenceFilter("all"); setSortColumn("model_rank"); setSortDirection("asc"); }}
            >
              Reset
            </Button>
            <div className="text-sm text-stone-600 tracking-tight">
              Showing <span className="font-semibold">{visibleTeams}</span> of{" "}
              <span className="font-semibold">{totalTeams}</span> teams
              {lastUpdated ? `. Updated ${lastUpdated}` : ""}
            </div>
          </div>

          {/* COLOR LEGEND */}
          <RankColorLegend />

          {/* TABLE */}
          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse">
                <thead>
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader
                      label="BBMI Rank"
                      columnKey="model_rank"
                      tooltipId="model_rank"
                      className="sticky left-0 z-30"
                      style={{ width: 90 }}
                      {...headerProps}
                    />
                    <SortableHeader
                      label="Team"
                      columnKey="team"
                      tooltipId="team"
                      {...headerProps}
                    />
                    <SortableHeader
                      label="Conference"
                      columnKey="conference"
                      tooltipId="conference"
                      {...headerProps}
                    />
                    <SortableHeader
                      label="KenPom"
                      columnKey="kenpom_rank"
                      tooltipId="kenpom_rank"
                      {...headerProps}
                    />
                    <SortableHeader
                      label="NET"
                      columnKey="net_ranking"
                      tooltipId="net_ranking"
                      {...headerProps}
                    />
                    <SortableHeader
                      label="Last 10"
                      columnKey="last_ten"
                      tooltipId="last_ten"
                      {...headerProps}
                    />
                    <SortableHeader
                      label="Record"
                      columnKey="record"
                      tooltipId="record"
                      {...headerProps}
                    />
                  </tr>
                </thead>

                <tbody>
                  {sortedRankings.map((team) => (
                    <tr
                      key={`${team.team}-${team.model_rank}`}
                      className="border-b border-stone-200 text-sm"
                      style={getBbmiDivergenceStyle(team)}
                    >
                      <td
                        className="sticky left-0 z-20 px-3 py-2 font-mono text-sm whitespace-nowrap"
                        style={{ width: 90, backgroundColor: getBbmiDivergenceColor(team) ?? "white" }}
                      >
                        <span className="font-mono font-semibold text-stone-800">
                          {team.model_rank}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-stone-900 whitespace-nowrap">
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(team.team)}`}
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={team.team} size={28} />
                          <span>{team.team}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-stone-700">{team.conference}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {team.kenpom_rank}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {team.net_ranking}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {team.last_ten || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {team.record || "—"}
                      </td>
                    </tr>
                  ))}

                  {sortedRankings.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-stone-500">
                        No teams match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
