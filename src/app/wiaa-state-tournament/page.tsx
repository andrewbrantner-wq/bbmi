"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import d1 from "@/data/wiaa-seeding/wiaa-d1-bracket.json";
import d2 from "@/data/wiaa-seeding/wiaa-d2-bracket.json";
import d3 from "@/data/wiaa-seeding/wiaa-d3-bracket.json";
import d4 from "@/data/wiaa-seeding/wiaa-d4-bracket.json";
import d5 from "@/data/wiaa-seeding/wiaa-d5-bracket.json";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type BracketTeam = {
  Team: string;
  Division: string;
  Region: string;
  WIAASeed: number;
  BBMISeed: number;
  Seed: number;
  slug: string;
  RegionalSemis: number;
  RegionalChampion: number;
  SectionalSemiFinalist: number;
  SectionalFinalist: number;
  StateQualifier: number;
  StateFinalist: number;
  StateChampion: number;
};

type Division = "1" | "2" | "3" | "4" | "5";
type SortMetric = "StateChampion" | "StateQualifier" | "StateFinalist" | "SectionalFinalist";

const ALL_TEAMS: BracketTeam[] = [
  ...(d1 as BracketTeam[]),
  ...(d2 as BracketTeam[]),
  ...(d3 as BracketTeam[]),
  ...(d4 as BracketTeam[]),
  ...(d5 as BracketTeam[]),
];

const DIVISION_LABELS: Record<Division, string> = {
  "1": "Division 1",
  "2": "Division 2",
  "3": "Division 3",
  "4": "Division 4",
  "5": "Division 5",
};

const METRICS: { key: SortMetric; label: string; shortLabel: string; color: string }[] = [
  { key: "StateChampion",     label: "State Champion",       shortLabel: "Champion",   color: "#facc15" },
  { key: "StateQualifier",    label: "State Qualifier",      shortLabel: "Qualifier",  color: "#60a5fa" },
  { key: "StateFinalist",     label: "State Finalist",       shortLabel: "Finalist",   color: "#a78bfa" },
  { key: "SectionalFinalist", label: "Sectional Finalist",   shortLabel: "Sectional",  color: "#34d399" },
];

// ------------------------------------------------------------
// PROBABILITY BAR
// ------------------------------------------------------------

function ProbBar({ value, color, max }: { value: number; color: string; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3,
          width: `${pct}%`,
          backgroundColor: color,
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "ui-monospace, monospace", minWidth: 42, textAlign: "right" }}>
        {value < 0.001 ? "<0.1%" : `${(value * 100).toFixed(1)}%`}
      </span>
    </div>
  );
}

// ------------------------------------------------------------
// TEAM ROW
// ------------------------------------------------------------

function TeamRow({ team, rank, metric, maxVal }: {
  team: BracketTeam; rank: number; metric: SortMetric; maxVal: number;
}) {
  const metricDef = METRICS.find(m => m.key === metric)!;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 1fr 180px",
      alignItems: "center",
      gap: 12,
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      transition: "background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Rank */}
      <div style={{
        fontSize: rank <= 3 ? 15 : 13,
        fontWeight: 800,
        color: rank === 1 ? "#facc15" : "rgba(255,255,255,0.3)",
        textAlign: "center",
        fontFamily: "ui-monospace, monospace",
      }}>
        {rank === 1 ? "🥇" : rank}
      </div>

      {/* Team info */}
      <div>
        <Link
          href={`/wiaa-team/${team.slug}`}
          style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", textDecoration: "none" }}
          className="hover:underline"
        >
          {team.Team}
        </Link>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
          Region {team.Region} · WIAA #{team.WIAASeed} · BBMI #{team.BBMISeed}
        </div>
      </div>

      {/* Probability bar */}
      <ProbBar value={team[metric]} color={metricDef.color} max={maxVal} />
    </div>
  );
}

// ------------------------------------------------------------
// DIVISION PANEL
// ------------------------------------------------------------

function DivisionPanel({ division, metric }: { division: Division; metric: SortMetric }) {
  const teams = useMemo(() => {
    return ALL_TEAMS
      .filter(t => t.Division === division)
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 10);
  }, [division, metric]);

  const maxVal = teams[0]?.[metric] ?? 1;

  return (
    <div style={{
      background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      overflow: "hidden",
    }}>
      {/* Division header */}
      <div style={{
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {DIVISION_LABELS[division]}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {ALL_TEAMS.filter(t => t.Division === division).length} teams
        </div>
      </div>

      {/* Team rows */}
      {teams.map((team, i) => (
        <TeamRow key={team.slug} team={team} rank={i + 1} metric={metric} maxVal={maxVal} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAAStateTournamentPage() {
  const [activeDivision, setActiveDivision] = useState<Division | "all">("all");
  const [activeMetric, setActiveMetric] = useState<SortMetric>("StateChampion");

  const metricDef = METRICS.find(m => m.key === activeMetric)!;
  const divisions: Division[] = ["1", "2", "3", "4", "5"];
  const visibleDivisions = activeDivision === "all" ? divisions : [activeDivision];

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: "2rem", marginTop: "1.5rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "linear-gradient(90deg, #0a1a2f, #0d2440)",
            borderRadius: 999, padding: "0.35rem 1.1rem",
            fontSize: "0.75rem", fontWeight: 700, color: "#facc15",
            marginBottom: "1rem", letterSpacing: "0.04em",
            border: "1px solid rgba(250,204,21,0.3)",
          }}>
            🏆 WIAA State Tournament Model
          </div>
          <h1 style={{
            fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 800,
            letterSpacing: "-0.02em", color: "#0a1a2f", marginBottom: "0.6rem",
          }}>
            State Tournament Probabilities
          </h1>
          <p style={{ fontSize: "0.88rem", color: "#57534e", maxWidth: 500, margin: "0 auto 1.25rem" }}>
            BBMI&apos;s bracket simulation model — probability of each team advancing to Sectionals, qualifying for State, and winning the championship by division.
          </p>

          {/* RELATED LINKS */}
          <div style={{
            display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10,
            maxWidth: 640, margin: "0 auto",
          }}>
            <Link
              href="/wiaa-bracket-pulse"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                backgroundColor: "#ffffff", color: "#0a1a2f",
                border: "1px solid #d6d3d1", borderRadius: 7,
                padding: "0.4rem 0.9rem", fontSize: "0.78rem", fontWeight: 600,
                textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              🗂️ View Full State Brackets →
            </Link>
            <Link
              href="/wiaa-teams"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                backgroundColor: "#ffffff", color: "#0a1a2f",
                border: "1px solid #d6d3d1", borderRadius: 7,
                padding: "0.4rem 0.9rem", fontSize: "0.78rem", fontWeight: 600,
                textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              🏫 Browse Team Pages →
            </Link>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#a8a29e", marginTop: "0.6rem" }}>
            Full bracket probabilities by region are on the{" "}
            <Link href="/wiaa-bracket-pulse" style={{ color: "#2563eb", textDecoration: "underline" }}>
              State Brackets page
            </Link>
            {" "}· Each team&apos;s complete tournament odds are on their{" "}
            <Link href="/wiaa-teams" style={{ color: "#2563eb", textDecoration: "underline" }}>
              individual team page
            </Link>
          </p>
        </div>

        {/* METRIC SELECTOR */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              style={{
                padding: "0.45rem 1rem", borderRadius: 8, fontSize: "0.8rem", fontWeight: 700,
                cursor: "pointer", border: "2px solid",
                borderColor: activeMetric === m.key ? m.color : "transparent",
                backgroundColor: activeMetric === m.key ? "rgba(10,26,47,0.9)" : "#f5f5f4",
                color: activeMetric === m.key ? m.color : "#57534e",
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* DIVISION FILTER */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "2rem" }}>
          {(["all", "1", "2", "3", "4", "5"] as const).map(d => (
            <button
              key={d}
              onClick={() => setActiveDivision(d)}
              style={{
                padding: "0.35rem 0.85rem", borderRadius: 6, fontSize: "0.75rem", fontWeight: 700,
                cursor: "pointer", border: "1px solid",
                borderColor: activeDivision === d ? "#0a1a2f" : "#d6d3d1",
                backgroundColor: activeDivision === d ? "#0a1a2f" : "#ffffff",
                color: activeDivision === d ? "#ffffff" : "#57534e",
                transition: "all 0.15s",
              }}
            >
              {d === "all" ? "All Divisions" : `D${d}`}
            </button>
          ))}
        </div>

        {/* ACTIVE METRIC CALLOUT */}
        <div style={{
          maxWidth: 600, margin: "0 auto 1.75rem",
          background: "linear-gradient(135deg, #0a1a2f, #0d2440)",
          borderRadius: 10, padding: "0.85rem 1.25rem",
          display: "flex", alignItems: "center", gap: 12,
          border: `1px solid ${metricDef.color}40`,
        }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: metricDef.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: metricDef.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Showing: {metricDef.label} Probability
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
              Top 10 teams per division, ranked by BBMI simulation model
            </div>
          </div>
        </div>

        {/* DIVISION GRIDS */}
        <div style={{
          display: "grid",
          gridTemplateColumns: visibleDivisions.length === 1 ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "1.25rem",
          maxWidth: visibleDivisions.length === 1 ? 560 : undefined,
          margin: visibleDivisions.length === 1 ? "0 auto" : undefined,
        }}>
          {visibleDivisions.map(div => (
            <DivisionPanel key={div} division={div} metric={activeMetric} />
          ))}
        </div>

        {/* FOOTER NOTE */}
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <p style={{ fontSize: 11, color: "#a8a29e", fontStyle: "italic", marginBottom: "0.75rem" }}>
            Probabilities generated by BBMI bracket simulation using team efficiency ratings and seeding. Updated daily.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <Link
              href="/wiaa-bracket-pulse"
              style={{ fontSize: "0.75rem", color: "#2563eb", textDecoration: "underline" }}
            >
              Full bracket probabilities by region →
            </Link>
            <Link
              href="/wiaa-teams"
              style={{ fontSize: "0.75rem", color: "#2563eb", textDecoration: "underline" }}
            >
              Individual team tournament odds →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
