"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import { ChevronUp, ChevronDown } from "lucide-react";
import wiaaData from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import LogoBadge from "@/components/LogoBadge";
import TeamLogo from "@/components/TeamLogo";

type WIAARow = {
  division: number;
  team: string;
  record: string;
  bbmi_rank: number;
  slug: string;
};

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  bbmi_rank: "BBMI's model rank for this division — built on offensive/defensive efficiency, schedule strength, and predictive performance. Teams are ranked within their division only.",
  team: "Click any team name to view their full schedule, BBMI line history, and win probabilities.",
  record: "Season win-loss record. Only includes games played against WIAA member schools.",
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

type SortCol = "bbmi_rank" | "team";

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
  children,
}: {
  label: React.ReactNode;
  columnKey: SortCol;
  tooltipId?: string;
  sortColumn: SortCol;
  sortDirection: "asc" | "desc";
  handleSort: (col: SortCol) => void;
  activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void;
  closeDesc?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_wiaa" : null;
  const isActive = sortColumn === columnKey;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tooltipId || !TOOLTIPS[tooltipId] || !openDesc || !uid) return;
    if (activeDescId === uid) closeDesc?.();
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
      className={`select-none px-3 py-2 bg-[#0a1a2f] text-white ${className}`}
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
        {children}
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// WHY DIFFERENT ACCORDION — matches picks history page style
// ------------------------------------------------------------

function WhyDifferentAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      width: "100%",
      border: "1px solid #d6d3d1",
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      backgroundColor: "transparent",
    }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          textAlign: "left",
          fontWeight: 600,
          fontSize: 14,
          letterSpacing: "0.02em",
          backgroundColor: open ? "#1e3a5f" : "#0a1a2f",
          color: "#ffffff",
          border: "none",
          cursor: "pointer",
          borderRadius: open ? "8px 8px 0 0" : "8px",
          transition: "background-color 0.15s",
        }}
      >
        <span>🏀 How does BBMI rank WIAA teams?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          backgroundColor: "#ffffff",
          padding: "20px 24px",
          borderTop: "1px solid #d6d3d1",
          fontSize: 14,
          color: "#44403c",
          lineHeight: 1.65,
        }}>
          <p style={{ marginBottom: 12 }}>
            WIAA teams are ranked within each division using the same core model principles as the NCAA rankings — built around the question:{" "}
            <strong>which teams are best positioned to win in single-elimination tournament play?</strong>
          </p>
          <p style={{ marginBottom: 8, fontWeight: 600, color: "#1c1917" }}>
            BBMI rewards qualities that translate under tournament pressure:
          </p>
          {[
            { label: "Shooting efficiency", desc: "High conversion rates under pressure, particularly from three-point range and at the free throw line." },
            { label: "Defensive discipline", desc: "Limiting opponent scoring opportunities — turnover generation and shot quality conceded, not just points allowed." },
            { label: "Ball security", desc: "High assist-to-turnover ratio indicates a team that shares the ball and protects possessions in tight games." },
            { label: "Strength of schedule", desc: "Teams that have beaten quality WIAA opponents are more proven than those with inflated records against weak competition." },
          ].map(({ label, desc }) => (
            <p key={label} style={{ marginBottom: 10 }}>
              <strong>{label}</strong> — {desc}
            </p>
          ))}
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 8, borderTop: "1px solid #e7e5e4", paddingTop: 8 }}>
            Rankings are calculated independently per division. Only games against WIAA member schools are included in record calculations.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAARankingsPage() {
  const [division, setDivision] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortCol>("bbmi_rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [lastUpdated, setLastUpdated] = useState("");

  // Portal state
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const rankRef = useRef<HTMLTableCellElement>(null);
  const rankHeaderRef = useRef<HTMLTableCellElement>(null);
  const [rankWidth, setRankWidth] = useState(0);

  useEffect(() => {
    fetch("/data/wiaa-rankings/last_updated.txt")
      .then((res) => res.text())
      .then((txt) => setLastUpdated(txt.trim()))
      .catch(() => setLastUpdated("Unknown"));
  }, []);

  // JSON-LD
  useEffect(() => {
    const dateModified = lastUpdated || new Date().toISOString();
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI WIAA Boys Varsity Rankings",
      description: "Top 50 WIAA boys varsity basketball team rankings by division, powered by the Brantner Basketball Model Index.",
      url: "https://bbmihoops.com/wiaa-rankings",
      dateModified,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [lastUpdated]);

  const normalized = useMemo<WIAARow[]>(() => {
    const raw = wiaaData as any[];
    return raw.map((r) => ({
      division: Number(r.division),
      team: String(r.team ?? ""),
      record: String(r.record ?? ""),
      bbmi_rank: Number(r.bbmi_rank ?? r.ranking ?? 0),
      slug: String(r.slug ?? ""),
    }));
  }, []);

  const divisions = useMemo(() => {
    const set = new Set<number>();
    normalized.forEach((t) => { if (!Number.isNaN(t.division)) set.add(t.division); });
    return Array.from(set).sort((a, b) => a - b);
  }, [normalized]);

  const filtered = useMemo(
    () => normalized.filter((t) => t.division === division),
    [normalized, division]
  );

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortColumn === "bbmi_rank") return sortDirection === "asc" ? a.bbmi_rank - b.bbmi_rank : b.bbmi_rank - a.bbmi_rank;
      if (sortColumn === "team") return sortDirection === "asc" ? a.team.localeCompare(b.team) : b.team.localeCompare(a.team);
      return 0;
    });
  }, [filtered, sortColumn, sortDirection]);

  const top50 = useMemo(() => sorted.slice(0, 50), [sorted]);

  useEffect(() => {
    const measure = () => {
      const w1 = rankRef.current?.offsetWidth ?? 0;
      const w2 = rankHeaderRef.current?.offsetWidth ?? 0;
      setRankWidth(Math.max(w1, w2));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [top50]);

  const handleSort = (column: SortCol) => {
    if (column === sortColumn) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

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
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-3">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="wiaa" />
              <span> Boy's Varsity Top 50 Team Rankings</span>
            </h1>
            <p className="text-stone-500 text-sm text-center max-w-xl mt-2">
              Teams ranked by BBMI's predictive model within each division — built on efficiency, schedule strength, and tournament performance indicators.
              Click any column header label to learn what it means.
            </p>
            <div className="text-sm text-stone-500 tracking-tight mt-1">
              Updated as of{" "}
              {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Unknown"}
            </div>
          </div>

          {/* METHODOLOGY ACCORDION */}
          <div className="w-full max-w-2xl mx-auto mb-6">
            <WhyDifferentAccordion />
          </div>

          {/* DIVISION FILTER */}
          <div className="flex flex-col items-center gap-2 mb-4">
            <select
              value={division}
              onChange={(e) => setDivision(Number(e.target.value))}
              className="h-9 w-48 text-sm tracking-tight rounded-md border border-stone-300 bg-white text-stone-900 px-2"
            >
              {divisions.map((d) => (
                <option key={d} value={d}>Division {d}</option>
              ))}
            </select>
            <p className="text-xs text-stone-500 italic">
              * Record reflects games played only against WIAA member schools.
            </p>
          </div>

          {/* RANKINGS TABLE */}
          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader
                      label={<>BBMI<br />Rank</>}
                      columnKey="bbmi_rank"
                      tooltipId="bbmi_rank"
                      className="sticky left-0 z-30 text-center"
                      style={{ width: 70 }}
                      {...headerProps}
                    />
                    <SortableHeader
                      label="Team"
                      columnKey="team"
                      tooltipId="team"
                      className="sticky z-30"
                      style={{ left: rankWidth }}
                      {...headerProps}
                    />
                    {/* Record header — no sort split needed, plain th */}
                    <th className="px-3 py-2 text-right bg-[#0a1a2f] text-white">
                      <span
                        className="text-xs font-semibold tracking-wide"
                        style={{
                          cursor: "help",
                          textDecoration: "underline dotted",
                          textUnderlineOffset: 3,
                          textDecorationColor: "rgba(255,255,255,0.45)",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          openDesc("record_wiaa", rect);
                        }}
                      >
                        Record
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {top50.map((row, index) => (
                    <tr
                      key={`${row.team}-${row.bbmi_rank}`}
                      className={index % 2 === 0 ? "bg-stone-50/40" : "bg-white"}
                    >
                      <td
                        ref={index === 0 ? rankRef : null}
                        className="sticky left-0 z-20 bg-white px-3 py-2 font-mono text-sm text-center whitespace-nowrap"
                        style={{ width: 70 }}
                      >
                        {row.bbmi_rank}
                      </td>
                      <td
                        className="sticky z-20 bg-white px-3 py-2 font-medium text-stone-900 whitespace-nowrap"
                        style={{ left: rankWidth }}
                      >
                        <div className="flex items-center">
                          <div className="min-w-[48px] flex justify-center mr-2">
                            <TeamLogo slug={row.slug} size={28} />
                          </div>
                          <Link
                            href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                            className="hover:underline cursor-pointer"
                          >
                            {row.team}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right font-mono text-sm text-stone-700">
                        {row.record || "—"}
                      </td>
                    </tr>
                  ))}

                  {top50.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-stone-500">
                        No teams found for this division.
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
