"use client";

import { useState } from "react";
import changelogData from "@/data/model-changelog.json";

type ChangelogEntry = {
  sport: string;
  date: string;
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
};

const SPORT_COLORS: Record<string, string> = {
  NFL: "#013369",
  MLB: "#1a6640",
  "NCAA Basketball": "#4a6fa5",
  "NCAA Baseball": "#1a7a8a",
  "NCAA Football": "#6b7280",
  "All Sports": "#2952cc",
  All: "#2952cc",
};

const IMPACT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: "#fef2f2", color: "#dc2626", label: "High" },
  medium: { bg: "#eff6ff", color: "#2563eb", label: "Medium" },
  low: { bg: "#f3f4f6", color: "#6b7280", label: "Low" },
};

const SPORTS = ["All", "NFL", "MLB", "NCAA Basketball", "NCAA Baseball", "NCAA Football"];

// Sort by date descending (April 2026 before March 2026, etc.)
function dateSort(a: ChangelogEntry, b: ChangelogEntry): number {
  const months: Record<string, number> = {
    January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
    July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
  };
  const parseDate = (d: string) => {
    const parts = d.split(" ");
    return { month: months[parts[0]] ?? 0, year: parseInt(parts[1] ?? "0", 10) };
  };
  const da = parseDate(a.date);
  const db = parseDate(b.date);
  if (db.year !== da.year) return db.year - da.year;
  return db.month - da.month;
}

export default function ModelChangelog() {
  const [sportFilter, setSportFilter] = useState("All");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const entries = (changelogData as ChangelogEntry[]).slice().sort(dateSort);

  const filtered =
    sportFilter === "All"
      ? entries
      : entries.filter((e) => e.sport === sportFilter);

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div>
      <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
        Major model updates are logged here as they happen. Because picks are frozen before games tip off,
        any methodology change only affects future picks — never historical results.
      </p>

      {/* Sport filter pills */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        {SPORTS.map((sport) => {
          const active = sportFilter === sport;
          const accent = SPORT_COLORS[sport] ?? "#2952cc";
          return (
            <button
              key={sport}
              onClick={() => setSportFilter(sport)}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: 999,
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                cursor: "pointer",
                border: `1px solid ${active ? accent : "#d4d2cc"}`,
                backgroundColor: active ? accent : "#ffffff",
                color: active ? "#ffffff" : "#6b7280",
                transition: "all 0.15s ease",
              }}
            >
              {sport}
            </button>
          );
        })}
      </div>

      {/* Entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filtered.map((entry, i) => {
          const globalIdx = entries.indexOf(entry);
          const isOpen = expanded.has(globalIdx);
          const impact = IMPACT_STYLES[entry.impact] ?? IMPACT_STYLES.low;
          const sportColor = SPORT_COLORS[entry.sport] ?? "#2952cc";

          return (
            <div
              key={globalIdx}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #d4d2cc",
                borderRadius: 8,
                borderLeft: `3px solid ${sportColor}`,
                overflow: "hidden",
              }}
            >
              {/* Collapsed header row */}
              <button
                onClick={() => toggle(globalIdx)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.7rem 1rem",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* Impact badge */}
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.62rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "0.15rem 0.5rem",
                    borderRadius: 4,
                    backgroundColor: impact.bg,
                    color: impact.color,
                    flexShrink: 0,
                    minWidth: 52,
                    textAlign: "center",
                  }}
                >
                  {impact.label}
                </span>

                {/* Title */}
                <span
                  style={{
                    flex: 1,
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#1a1a1a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.title}
                </span>

                {/* Date */}
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "#9ca3af",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.date}
                </span>

                {/* Chevron */}
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                    flexShrink: 0,
                    transition: "transform 0.15s ease",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  ▼
                </span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div
                  style={{
                    padding: "0 1rem 0.85rem 1rem",
                    borderTop: "1px solid #f3f4f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.65rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: sportColor,
                      }}
                    >
                      {entry.sport}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: "0.78rem",
                      color: "#6b7280",
                      lineHeight: 1.65,
                      margin: 0,
                    }}
                  >
                    {entry.detail}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p
        style={{
          fontSize: "0.72rem",
          color: "#9ca3af",
          fontStyle: "italic",
          marginTop: "1rem",
          marginBottom: 0,
        }}
      >
        Future updates will be logged here as they are deployed.
      </p>
    </div>
  );
}
