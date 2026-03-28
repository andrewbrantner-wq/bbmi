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
  bbmi: number | string;
  model_rank: number | string;
  prev_rank: number | string;
  kenpom_rank: number | string;
  net_ranking: number | string;
  ap_rank: number | string;
  record: string;
};

const TOOLTIPS: Record<string, string> = {
  model_rank: "BBMI's proprietary model rank — built on offensive/defensive efficiency, schedule strength, and predictive performance. This is the primary ranking used for BBMI's picks and spread predictions.",
  bbmi: "The raw BBMI score — a composite efficiency rating that drives the model rank. Higher is better. Teams with a higher score are predicted to perform better in single-elimination play.",
  team: "Click any team name to view their full schedule, BBMI line history, and win probabilities.",
  conference: "The team's athletic conference. Use the conference filter above to narrow the table.",
  kenpom_rank: "KenPom rank — a widely-used efficiency-based rating by Ken Pomeroy. Provided for reference alongside BBMI's model.",
  net_ranking: "NCAA Evaluation Tool rank — the official NCAA metric used for tournament seeding and selection. Lower is better.",
  ap_rank: "AP Top 25 poll rank — a weekly poll of sports media voters. Only the top 25 teams are ranked; unranked teams show '—'.",
  record: "Season win-loss record.",
};

async function fetchAPRankings(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return map;
    const data = await res.json();
    const polls: unknown[] = data?.rankings ?? [];
    const apPoll = polls.find((p: unknown) => {
      const poll = p as Record<string, unknown>;
      return typeof poll.name === "string" && poll.name.toLowerCase().includes("ap top 25");
    }) as Record<string, unknown> | undefined;
    if (!apPoll) return map;
    const ranks = apPoll.ranks as unknown[];
    if (!Array.isArray(ranks)) return map;
    for (const entry of ranks) {
      const e = entry as Record<string, unknown>;
      const current = e.current as number | undefined;
      const team = e.team as Record<string, unknown> | undefined;
      const name = team?.location as string | undefined;
      const displayName = team?.displayName as string | undefined;
      if (current && name) {
        map.set(name.toLowerCase(), current);
        if (displayName) map.set(displayName.toLowerCase(), current);
      }
    }
  } catch { }
  return map;
}

const TEAM_ALIASES: Record<string, string> = {
  "uconn": "connecticut", "brigham young": "byu", "connecticut": "connecticut",
  "ole miss": "mississippi", "mississippi": "mississippi", "usc": "southern california",
  "lsu": "lsu", "smu": "smu", "ucf": "ucf", "vcu": "vcu", "unlv": "unlv",
  "utep": "utep", "utsa": "utsa", "unc": "north carolina", "north carolina": "north carolina",
  "nc state": "nc state", "miami (fl)": "miami", "miami fl": "miami",
  "pitt": "pittsburgh", "pittsburgh": "pittsburgh", "saint mary's": "saint mary's",
  "st. mary's": "saint mary's", "st mary's": "saint mary's", "byu": "byu",
  "iowa st": "iowa state", "iowa state": "iowa state", "michigan st": "michigan state",
  "michigan state": "michigan state", "ohio st": "ohio state", "ohio state": "ohio state",
  "penn st": "penn state", "penn state": "penn state", "texas a&m": "texas a&m",
  "texas am": "texas a&m", "new mexico": "new mexico", "new mexico state": "new mexico state",
  "washington st": "washington state", "washington state": "washington state",
  "kansas st": "kansas state", "kansas state": "kansas state",
  "arizona st": "arizona state", "arizona state": "arizona state",
  "florida st": "florida state", "florida state": "florida state",
  "oregon st": "oregon state", "oregon state": "oregon state",
  "colorado st": "colorado state", "colorado state": "colorado state",
  "utah st": "utah state", "utah state": "utah state",
  "san diego st": "san diego state", "san diego state": "san diego state",
  "fresno st": "fresno state", "fresno state": "fresno state",
  "boise st": "boise state", "boise state": "boise state",
  "wichita st": "wichita state", "wichita state": "wichita state",
  "sam houston": "sam houston state", "saint louis": "saint louis",
  "st. louis": "saint louis", "st louis": "saint louis",
  "saint joseph's": "saint joseph's", "st. joseph's": "saint joseph's",
};

function lookupAPRank(apMap: Map<string, number>, teamName: string): number | null {
  if (apMap.size === 0) return null;
  const lower = teamName.toLowerCase().trim();
  if (apMap.has(lower)) return apMap.get(lower)!;
  const alias = TEAM_ALIASES[lower];
  if (alias && apMap.has(alias)) return apMap.get(alias)!;
  return null;
}

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

function SortableHeader({ label, columnKey, tooltipId, sortColumn, sortDirection, handleSort, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: keyof Ranking; tooltipId?: string;
  sortColumn: keyof Ranking; sortDirection: "asc" | "desc";
  handleSort: (col: keyof Ranking) => void;
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
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 10px", textAlign: align, whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span onClick={handleSortClick} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.35, lineHeight: 1 }}>
          {isActive ? sortDirection === "asc" ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} /> : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

function RankColorLegend() {
  return (
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
  );
}

function WhyDifferentAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen((prev) => !prev)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>🏀 Why does BBMI rank teams differently than KenPom, NET, or the AP Poll?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>Most ranking systems — KenPom, NET, AP — are designed to measure how good a team is <em>right now</em>, or to reflect wins, losses, and public perception. BBMI is built around a different question:{" "}<strong>which teams are most likely to make a deep run in the NCAA Tournament?</strong></p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: "#1c1917" }}>BBMI specifically rewards qualities that translate in single-elimination play:</p>
          {[
            { label: "Shooting efficiency", desc: "High conversion rates under pressure, particularly from three-point range and at the free throw line." },
            { label: "Defensive discipline", desc: "Limiting opponent scoring opportunities — turnover generation and shot quality conceded, not just points allowed." },
            { label: "Ball security", desc: "High assist-to-turnover ratio indicates a team that shares the ball and protects possessions — critical in tight tournament games." },
            { label: "Strength of schedule", desc: "Teams that have beaten quality opponents are more proven than those with inflated records against weak competition." },
          ].map(({ label, desc }) => (<p key={label} style={{ marginBottom: 10 }}><strong>{label}</strong> — {desc}</p>))}
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>Green-highlighted rows indicate teams BBMI favors over the KenPom/NET/AP consensus. Red rows are teams BBMI views as overrated. Only shown when divergence exceeds 10 spots.</p>
        </div>
      )}
    </div>
  );
}

function BbmiScoreCell({ score }: { score: number | string }) {
  const num = Number(score);
  if (isNaN(num) || score === "") return <span style={{ color: "#a8a29e" }}>—</span>;
  const MIN = 0, MAX = 40;
  const pct = Math.max(0, Math.min(1, (num - MIN) / (MAX - MIN)));
  const r = Math.round(148 - (148 - 29) * pct);
  const g = Math.round(163 - (163 - 78) * pct);
  const b = Math.round(189 + (216 - 189) * pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: "#0a1a2f", minWidth: 40, textAlign: "right" }}>{num.toFixed(2)}</span>
      <div style={{ width: 44, height: 6, backgroundColor: "#e7e5e4", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: `rgb(${r},${g},${b})`, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function RankMovement({ current, previous }: { current: number | string; previous: number | string }) {
  const curr = Number(current), prev = Number(previous);
  if (!previous || previous === "" || isNaN(prev) || isNaN(curr)) return null;
  const diff = prev - curr;
  if (diff === 0) return <span style={{ fontSize: 10, color: "#a8a29e", fontWeight: 500, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>—</span>;
  const up = diff > 0;
  return <span style={{ fontSize: 10, fontWeight: 700, color: up ? "#16a34a" : "#dc2626", whiteSpace: "nowrap", letterSpacing: "0.01em", display: "inline-flex", alignItems: "center", gap: 1 }}>{up ? "▲" : "▼"}{Math.abs(diff)}</span>;
}

export default function RankingsPage() {
  const [sortColumn, setSortColumn] = useState<keyof Ranking>("model_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [conferenceFilter, setConferenceFilter] = useState("all");
  const lastUpdated: string = (() => {
    const raw = rankingsData as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
      const meta = (raw as Record<string, unknown>[]).find((r) => r["last_updated"]);
      return meta ? String(meta["last_updated"]) : "";
    }
    const obj = raw as Record<string, unknown>;
    return obj["last_updated"] ? String(obj["last_updated"]) : "";
  })();
  const [apMap, setApMap] = useState<Map<string, number>>(new Map());
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  useEffect(() => { fetchAPRankings().then(setApMap); }, []);

  useEffect(() => {
    const jsonLd = { "@context": "https://schema.org", "@type": "Dataset", name: "BBMI NCAA Basketball Rankings", description: "Live NCAA basketball rankings generated by the Benchmark Basketball Model Index.", url: "https://bbmisports.com/ncaa-rankings", dateModified: new Date().toISOString() };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const normalizedRankings = useMemo<Ranking[]>(() => {
    const raw = rankingsData as unknown;
    if (!Array.isArray(raw)) return [];
    const possibleTeamKeys = ["team", "Team", "name", "team_name", "teamName"];
    const parseNum = (v: unknown): number | string => {
      if (typeof v === "number") return v;
      if (typeof v === "string") { const n = Number(v.replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : v; }
      return "";
    };
    return (raw as unknown[]).map((row): Ranking => {
      const r = row as Record<string, unknown>;
      let teamVal: unknown = "";
      for (const k of possibleTeamKeys) { if (k in r && r[k] != null && String(r[k]).trim() !== "") { teamVal = r[k]; break; } }
      return { team: String(teamVal ?? ""), conference: String(r.conference ?? r.Conference ?? ""), bbmi: parseNum(r.bbmi ?? r.bbmi_score ?? r.bbmiScore ?? r.score), model_rank: parseNum(r.model_rank ?? r.modelRank ?? r["Model Rank"]), prev_rank: parseNum(r.prev_rank ?? r.prevRank ?? ""), kenpom_rank: parseNum(r.kenpom_rank ?? r.kenpomRank ?? r.kenpom), net_ranking: parseNum(r.net_ranking ?? r.netRanking ?? r.net), ap_rank: "", record: String(r.record ?? "") };
    });
  }, []);

  const rankingsWithAP = useMemo<Ranking[]>(() => normalizedRankings.map((team) => ({ ...team, ap_rank: lookupAPRank(apMap, team.team) ?? "" })), [normalizedRankings, apMap]);

  const getBbmiDivergenceColor = (team: Ranking): string | null => {
    const bbmiRank = Number(team.model_rank);
    const kp = Number(team.kenpom_rank), net = Number(team.net_ranking), ap = Number(team.ap_rank);
    const validRanks = [kp, net, ...(ap >= 1 && ap <= 25 ? [ap] : [])].filter((n) => !isNaN(n) && n > 0);
    if (isNaN(bbmiRank) || validRanks.length === 0) return null;
    const consensus = validRanks.reduce((a, b) => a + b, 0) / validRanks.length;
    const divergence = consensus - bbmiRank;
    if (Math.abs(divergence) < 10) return null;
    const intensity = Math.min((Math.abs(divergence) - 10) / 40, 1);
    if (divergence > 0) return `rgba(22, 163, 74, ${0.10 + intensity * 0.20})`;
    return `rgba(220, 38, 38, ${0.10 + intensity * 0.18})`;
  };

  const conferences = useMemo(() => { const set = new Set<string>(); rankingsWithAP.forEach((t) => set.add(t.conference)); return Array.from(set).sort(); }, [rankingsWithAP]);

  const handleSort = (column: keyof Ranking) => {
    if (column === sortColumn) { setSortDirection((d) => (d === "asc" ? "desc" : "asc")); }
    else { setSortColumn(column); setSortDirection(column === "bbmi" ? "desc" : "asc"); }
  };

  const filteredRankings = useMemo(() => {
    const q = search.toLowerCase();
    return rankingsWithAP.filter((team) => {
      const matchesSearch = team.team.toLowerCase().includes(q) || team.conference.toLowerCase().includes(q) || String(team.model_rank).includes(q) || String(team.kenpom_rank).includes(q) || String(team.net_ranking).includes(q) || String(team.ap_rank).includes(q);
      const matchesConference = conferenceFilter === "all" || team.conference === conferenceFilter;
      return matchesSearch && matchesConference;
    });
  }, [search, conferenceFilter, rankingsWithAP]);

  const sortedRankings = useMemo(() => {
    return [...filteredRankings].sort((a, b) => {
      const key = sortColumn;
      if (key === "model_rank" || key === "kenpom_rank" || key === "net_ranking" || key === "ap_rank") {
        const numA = Number(a[key]), numB = Number(b[key]);
        const aValid = !isNaN(numA) && numA > 0, bValid = !isNaN(numB) && numB > 0;
        if (!aValid && !bValid) return 0; if (!aValid) return 1; if (!bValid) return -1;
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      if (key === "bbmi") {
        const numA = Number(a[key]), numB = Number(b[key]);
        const aValid = !isNaN(numA) && a[key] !== "", bValid = !isNaN(numB) && b[key] !== "";
        if (!aValid && !bValid) return 0; if (!aValid) return 1; if (!bValid) return -1;
        return sortDirection === "desc" ? numB - numA : numA - numB;
      }
      const sa = String(a[key] ?? ""), sb = String(b[key] ?? "");
      return sortDirection === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filteredRankings, sortColumn, sortDirection]);

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_MONO: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

  const filtersActive = search !== "" || conferenceFilter !== "all" || sortColumn !== "model_rank" || sortDirection !== "asc";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>BBMI Men&apos;s Team Rankings</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              Teams ranked by BBMI&apos;s predictive model — built on efficiency, schedule strength, and historical accuracy.
              KenPom, NET, and AP Top 25 are shown alongside for reference. Click any column header label to learn what it means.
            </p>
          </div>

          {/* ACCORDION */}
          <div style={{ maxWidth: 720, margin: "0 auto 24px" }}>
            <WhyDifferentAccordion />
          </div>

          {/* SEARCH + FILTERS */}
          <div style={{ maxWidth: 720, margin: "0 auto 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
              {/* Search */}
              <input
                placeholder="Search teams, conferences, rankings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  height: 38, fontSize: 13, borderRadius: 8,
                  border: search !== "" ? "1.5px solid #0a1a2f" : "1.5px solid #d6d3d1",
                  backgroundColor: "#ffffff", color: "#1c1917",
                  padding: "0 12px", width: 240, outline: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              />
              {/* Conference dropdown */}
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
                <select
                  value={conferenceFilter}
                  onChange={(e) => setConferenceFilter(e.target.value)}
                  style={{
                    height: 38, fontSize: 13, borderRadius: 8,
                    border: conferenceFilter !== "all" ? "1.5px solid #0a1a2f" : "1.5px solid #d6d3d1",
                    backgroundColor: conferenceFilter !== "all" ? "#0a1a2f" : "#ffffff",
                    color: conferenceFilter !== "all" ? "#ffffff" : "#1c1917",
                    padding: "0 32px 0 12px", minWidth: 160,
                    appearance: "none", cursor: "pointer",
                    fontWeight: conferenceFilter !== "all" ? 600 : 400,
                    outline: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                >
                  <option value="all">All conferences</option>
                  {conferences.map((conf) => <option key={conf} value={conf}>{conf}</option>)}
                </select>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={conferenceFilter !== "all" ? "#ffffff" : "#78716c"}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", right: 10, pointerEvents: "none" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {/* Clear — only visible when filters are active */}
              {filtersActive && (
                <button
                  onClick={() => { setSearch(""); setConferenceFilter("all"); setSortColumn("model_rank"); setSortDirection("asc"); }}
                  style={{
                    height: 38, padding: "0 14px", borderRadius: 8,
                    border: "1.5px solid #e7e5e4", backgroundColor: "#f8fafc",
                    color: "#64748b", fontSize: 13, fontWeight: 500,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
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

          {/* COLOR LEGEND */}
          <RankColorLegend />

          {/* TABLE */}
          <div style={{ maxWidth: 1020, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1200, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto", minWidth: 720 }}>
                  <colgroup>
                    <col style={{ width: 90 }} /><col /><col style={{ width: "15%" }} />
                    <col style={{ width: 120 }} /><col style={{ width: 70 }} />
                    <col style={{ width: 60 }} /><col style={{ width: 60 }} /><col style={{ width: 75 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader label="BBMI Rank"  columnKey="model_rank"  tooltipId="model_rank"  align="center" {...headerProps} />
                      <SortableHeader label="Team"        columnKey="team"         tooltipId="team"        align="left"   {...headerProps} />
                      <SortableHeader label="Conference"  columnKey="conference"   tooltipId="conference"  align="left"   {...headerProps} />
                      <SortableHeader label="BBMI Score"  columnKey="bbmi"         tooltipId="bbmi"        align="center" {...headerProps} />
                      <SortableHeader label="KenPom"      columnKey="kenpom_rank"  tooltipId="kenpom_rank" align="center" {...headerProps} />
                      <SortableHeader label="NET"         columnKey="net_ranking"  tooltipId="net_ranking" align="center" {...headerProps} />
                      <SortableHeader label="AP"          columnKey="ap_rank"      tooltipId="ap_rank"     align="center" {...headerProps} />
                      <SortableHeader label="Record"      columnKey="record"       tooltipId="record"      align="center" {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRankings.map((team, i) => {
                      const divColor = getBbmiDivergenceColor(team);
                      const rowBg = divColor ?? (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const apDisplay = team.ap_rank !== "" && Number(team.ap_rank) > 0 ? String(team.ap_rank) : "—";
                      const apStyle: React.CSSProperties = { ...TD_MONO, ...(apDisplay !== "—" ? { fontWeight: 700, color: "#1d4ed8" } : {}) };
                      return (
                        <tr key={`${team.team}-${team.model_rank}`} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...TD_MONO, fontWeight: 700, color: "#0a1a2f" }}>{team.model_rank}</td>
                          <td style={TD}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Link href={`/ncaa-team/${encodeURIComponent(team.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", fontWeight: 600, fontSize: 13 }} className="hover:underline">
                                <NCAALogo teamName={team.team} size={26} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.team}</span>
                              </Link>
                              <RankMovement current={team.model_rank} previous={team.prev_rank} />
                            </div>
                          </td>
                          <td style={{ ...TD, fontSize: 12, color: "#57534e", overflow: "hidden", textOverflow: "ellipsis" }}>{team.conference}</td>
                          <td style={{ ...TD, textAlign: "center" }}><BbmiScoreCell score={team.bbmi} /></td>
                          <td style={TD_MONO}>{team.kenpom_rank}</td>
                          <td style={TD_MONO}>{team.net_ranking}</td>
                          <td style={apStyle}>{apDisplay}</td>
                          <td style={TD_MONO}>{team.record || "—"}</td>
                        </tr>
                      );
                    })}
                    {sortedRankings.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No teams match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#a8a29e", textAlign: "right", marginTop: 6 }}>AP Top 25 data via ESPN · updates weekly</p>
          </div>

        </div>
      </div>
    </>
  );
}
