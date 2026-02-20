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
// SORTABLE HEADER
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
  align = "center",
  stickyLeft,
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
  align?: "left" | "center";
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
            ? sortDirection === "asc"
              ? <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />
              : <ChevronDown style={{ width: 12, height: 12, display: "inline" }} />
            : <ChevronUp style={{ width: 12, height: 12, display: "inline" }} />}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// METHODOLOGY ACCORDION
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

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  useEffect(() => {
    fetch("/data/wiaa-rankings/last_updated.txt")
      .then((res) => res.text())
      .then((txt) => setLastUpdated(txt.trim()))
      .catch(() => setLastUpdated("Unknown"));
  }, []);

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

  const handleSort = (column: SortCol) => {
    if (column === sortColumn) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortColumn(column); setSortDirection("asc"); }
  };

  const headerProps = { sortColumn, sortDirection, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

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
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 12 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="wiaa" />
              <span> Boy&apos;s Varsity Top 50 Team Rankings</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              Teams ranked by BBMI&apos;s predictive model within each division — built on efficiency, schedule strength, and tournament performance indicators.
              Click any column header label to learn what it means.
            </p>
            <div style={{ fontSize: 13, color: "#78716c", marginTop: 4 }}>
              Updated as of{" "}
              {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Unknown"}
            </div>
          </div>

          {/* METHODOLOGY ACCORDION */}
          <div style={{ maxWidth: 560, margin: "0 auto 24px" }}>
            <WhyDifferentAccordion />
          </div>

          {/* DIVISION FILTER */}
          <div style={{ maxWidth: 560, margin: "0 auto 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <select
              value={division}
              onChange={(e) => setDivision(Number(e.target.value))}
              style={{ height: 36, width: 180, fontSize: 14, borderRadius: 6, border: "1px solid #d6d3d1", backgroundColor: "#ffffff", color: "#1c1917", padding: "0 8px" }}
            >
              {divisions.map((d) => (
                <option key={d} value={d}>Division {d}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic", margin: 0 }}>
              * Record reflects games played only against WIAA member schools.
            </p>
          </div>

          {/* TABLE — narrow, centered, data-fitted */}
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>

              <div style={{ overflowX: "auto", maxHeight: 640, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: 64 }} />
                    <col />
                    <col style={{ width: 80 }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <SortableHeader
                        label="Rank"
                        columnKey="bbmi_rank"
                        tooltipId="bbmi_rank"
                        align="center"
                        {...headerProps}
                      />
                      <SortableHeader
                        label="Team"
                        columnKey="team"
                        tooltipId="team"
                        align="left"
                        {...headerProps}
                      />
                      {/* Record — no sort, plain th */}
                      <th
                        style={{
                          backgroundColor: "#0a1a2f", color: "#ffffff",
                          padding: "8px 10px", textAlign: "center",
                          whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
                          borderBottom: "2px solid rgba(255,255,255,0.1)",
                          fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        <span
                          style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
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
                        style={{ backgroundColor: index % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}
                      >
                        {/* Rank */}
                        <td style={{
                          padding: "8px 10px", textAlign: "center",
                          fontFamily: "ui-monospace, monospace", fontSize: 13,
                          fontWeight: 600, whiteSpace: "nowrap",
                          borderTop: "1px solid #f5f5f4",
                        }}>
                          {row.bbmi_rank}
                        </td>

                        {/* Team */}
                        <td style={{
                          padding: "8px 10px",
                          borderTop: "1px solid #f5f5f4",
                          overflow: "hidden",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 28, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                              <TeamLogo slug={row.slug} size={26} />
                            </div>
                            <Link
                              href={`/wiaa-team/${encodeURIComponent(row.team)}`}
                              style={{ fontSize: 13, fontWeight: 600, color: "#0a1a2f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                              className="hover:underline"
                            >
                              {row.team}
                            </Link>
                          </div>
                        </td>

                        {/* Record */}
                        <td style={{
                          padding: "8px 10px", textAlign: "center",
                          fontFamily: "ui-monospace, monospace", fontSize: 13,
                          color: "#57534e", whiteSpace: "nowrap",
                          borderTop: "1px solid #f5f5f4",
                        }}>
                          {row.record || "—"}
                        </td>
                      </tr>
                    ))}

                    {top50.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>
                          No teams found for this division.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
          {/* end table */}

        </div>
      </div>
    </>
  );
}
