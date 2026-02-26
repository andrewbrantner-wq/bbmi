"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import seedingData from "@/data/seeding/seeding.json";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type SeedingTeam = {
  Team: string;
  Region: string;
  CurrentSeed: number | string;
  RoundOf32Pct: number | string;
  Sweet16Pct: number | string;
  Elite8Pct: number | string;
  FinalFourPct: number | string;
  ChampionshipPct: number | string;
  WinTitlePct: number | string;
};

type SortMetric =
  | "WinTitlePct"
  | "ChampionshipPct"
  | "FinalFourPct"
  | "Elite8Pct"
  | "Sweet16Pct"
  | "RoundOf32Pct";

type Region = string;

const METRICS: {
  key: SortMetric;
  label: string;
  shortLabel: string;
  color: string;
}[] = [
  { key: "WinTitlePct",      label: "Win Championship", shortLabel: "Champion",  color: "#facc15" },
  { key: "ChampionshipPct",  label: "Reach Title Game", shortLabel: "Title Game",color: "#fb923c" },
  { key: "FinalFourPct",     label: "Final Four",       shortLabel: "Final Four",color: "#a78bfa" },
  { key: "Elite8Pct",        label: "Elite Eight",      shortLabel: "Elite 8",   color: "#60a5fa" },
  { key: "Sweet16Pct",       label: "Sweet Sixteen",    shortLabel: "Sweet 16",  color: "#34d399" },
  { key: "RoundOf32Pct",     label: "Round of 32",      shortLabel: "Rd of 32",  color: "#94a3b8" },
];

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const parseProb = (val: number | string | undefined): number => {
  if (val == null) return 0;
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n; // normalize to 0–1
};

const ALL_TEAMS: SeedingTeam[] = (seedingData as SeedingTeam[]).filter(
  (t) => t.Team && t.Region
);

const ALL_REGIONS: Region[] = Array.from(
  new Set(ALL_TEAMS.map((t) => t.Region))
).sort();

// ------------------------------------------------------------
// PROBABILITY BAR
// ------------------------------------------------------------

function ProbBar({
  value,
  color,
  max,
}: {
  value: number;
  color: string;
  max: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: 6,
          backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            width: `${pct}%`,
            backgroundColor: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          fontFamily: "ui-monospace, monospace",
          minWidth: 46,
          textAlign: "right",
        }}
      >
        {value < 0.001 ? "<0.1%" : `${(value * 100).toFixed(1)}%`}
      </span>
    </div>
  );
}

// ------------------------------------------------------------
// TEAM ROW
// ------------------------------------------------------------

function TeamRow({
  team,
  rank,
  metric,
  maxVal,
}: {
  team: SeedingTeam;
  rank: number;
  metric: SortMetric;
  maxVal: number;
}) {
  const metricDef = METRICS.find((m) => m.key === metric)!;
  const prob = parseProb(team[metric]);
  const seed = Number(team.CurrentSeed);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr 180px",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      {/* Rank */}
      <div
        style={{
          fontSize: rank <= 3 ? 15 : 13,
          fontWeight: 800,
          color:
            rank === 1 ? "#facc15" : "rgba(255,255,255,0.3)",
          textAlign: "center",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {rank === 1 ? "🥇" : rank}
      </div>

      {/* Team info */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <NCAALogo teamName={team.Team} size={22} />
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/ncaa-team/${encodeURIComponent(team.Team)}`}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#ffffff",
              textDecoration: "none",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            className="hover:underline"
          >
            {team.Team}
          </Link>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
            {team.Region} · Seed {isNaN(seed) ? "—" : `#${seed}`}
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <ProbBar value={prob} color={metricDef.color} max={maxVal} />
    </div>
  );
}

// ------------------------------------------------------------
// REGION PANEL
// ------------------------------------------------------------

function RegionPanel({
  region,
  metric,
}: {
  region: Region;
  metric: SortMetric;
}) {
  const teams = useMemo(() => {
    return ALL_TEAMS.filter((t) => t.Region === region)
      .map((t) => ({ ...t, _prob: parseProb(t[metric]) }))
      .sort((a, b) => b._prob - a._prob)
      .slice(0, 10);
  }, [region, metric]);

  const maxVal = teams[0]?._prob ?? 1;
  const totalInRegion = ALL_TEAMS.filter((t) => t.Region === region).length;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Region header */}
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {region} Region
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {totalInRegion} teams
        </div>
      </div>

      {/* Team rows */}
      {teams.map((team, i) => (
        <TeamRow
          key={team.Team}
          team={team}
          rank={i + 1}
          metric={metric}
          maxVal={maxVal}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// ALL TEAMS PANEL (when "All Regions" selected)
// ------------------------------------------------------------

function AllTeamsPanel({ metric }: { metric: SortMetric }) {
  const teams = useMemo(() => {
    return ALL_TEAMS.map((t) => ({ ...t, _prob: parseProb(t[metric]) }))
      .sort((a, b) => b._prob - a._prob)
      .slice(0, 25);
  }, [metric]);

  const maxVal = teams[0]?._prob ?? 1;
  const metricDef = METRICS.find((m) => m.key === metric)!;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
        maxWidth: 560,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Top 25 — {metricDef.label}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          All regions
        </div>
      </div>
      {teams.map((team, i) => (
        <TeamRow
          key={team.Team}
          team={team}
          rank={i + 1}
          metric={metric}
          maxVal={maxVal}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function NCAAStateTournamentPage() {
  const [activeRegion, setActiveRegion] = useState<Region | "all">("all");
  const [activeMetric, setActiveMetric] = useState<SortMetric>("WinTitlePct");

  const metricDef = METRICS.find((m) => m.key === activeMetric)!;
  const visibleRegions =
    activeRegion === "all" ? ALL_REGIONS : [activeRegion];

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: "2rem", marginTop: "1.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "linear-gradient(90deg, #0a1a2f, #0d2440)",
              borderRadius: 999,
              padding: "0.35rem 1.1rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#facc15",
              marginBottom: "1rem",
              letterSpacing: "0.04em",
              border: "1px solid rgba(250,204,21,0.3)",
            }}
          >
            🏆 NCAA Tournament Model
          </div>
          <h1
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#0a1a2f",
              marginBottom: "0.6rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <LogoBadge league="ncaa" />
            NCAA Tournament Probabilities
          </h1>
          <p
            style={{
              fontSize: "0.88rem",
              color: "#57534e",
              maxWidth: 500,
              margin: "0 auto 1.25rem",
            }}
          >
            BBMI&apos;s bracket simulation model — probability of each team
            advancing through each round by region.
          </p>

          {/* RELATED LINKS */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: 10,
              maxWidth: 640,
              margin: "0 auto",
            }}
          >
            <Link
              href="/ncaa-bracket-pulse"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#ffffff",
                color: "#0a1a2f",
                border: "1px solid #d6d3d1",
                borderRadius: 7,
                padding: "0.4rem 0.9rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              🗂️ View Full Bracket →
            </Link>
            <Link
              href="/ncaa-todays-picks"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#ffffff",
                color: "#0a1a2f",
                border: "1px solid #d6d3d1",
                borderRadius: 7,
                padding: "0.4rem 0.9rem",
                fontSize: "0.78rem",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
            >
              🏀 Today&apos;s Picks →
            </Link>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#a8a29e", marginTop: "0.6rem" }}>
            Full bracket probabilities are on the{" "}
            <Link
              href="/ncaa-bracket-pulse"
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              Bracket Pulse page
            </Link>
            {" "}· Each team&apos;s complete odds are on their{" "}
            <Link
              href="/ncaa-rankings"
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              team page
            </Link>
          </p>
        </div>

        {/* METRIC SELECTOR */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: "1.5rem",
          }}
        >
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: 8,
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                border: "2px solid",
                borderColor:
                  activeMetric === m.key ? m.color : "transparent",
                backgroundColor:
                  activeMetric === m.key
                    ? "rgba(10,26,47,0.9)"
                    : "#f5f5f4",
                color: activeMetric === m.key ? m.color : "#57534e",
                transition: "all 0.15s",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* REGION FILTER */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 6,
            marginBottom: "2rem",
            flexWrap: "wrap",
          }}
        >
          {(["all", ...ALL_REGIONS] as const).map((r) => (
            <button
              key={r}
              onClick={() => setActiveRegion(r)}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: 6,
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                border: "1px solid",
                borderColor:
                  activeRegion === r ? "#0a1a2f" : "#d6d3d1",
                backgroundColor:
                  activeRegion === r ? "#0a1a2f" : "#ffffff",
                color: activeRegion === r ? "#ffffff" : "#57534e",
                transition: "all 0.15s",
              }}
            >
              {r === "all" ? "All Regions" : r}
            </button>
          ))}
        </div>

        {/* ACTIVE METRIC CALLOUT */}
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto 1.75rem",
            background: "linear-gradient(135deg, #0a1a2f, #0d2440)",
            borderRadius: 10,
            padding: "0.85rem 1.25rem",
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: `1px solid ${metricDef.color}40`,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: metricDef.color,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: metricDef.color,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Showing: {metricDef.label} Probability
            </div>
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              Top 10 teams per region, ranked by BBMI Monte Carlo simulation
            </div>
          </div>
        </div>

        {/* PANELS */}
        {activeRegion === "all" ? (
          <AllTeamsPanel metric={activeMetric} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                visibleRegions.length === 1
                  ? "1fr"
                  : "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "1.25rem",
              maxWidth: visibleRegions.length === 1 ? 560 : undefined,
              margin: visibleRegions.length === 1 ? "0 auto" : undefined,
            }}
          >
            {visibleRegions.map((region) => (
              <RegionPanel key={region} region={region} metric={activeMetric} />
            ))}
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <p
            style={{
              fontSize: 11,
              color: "#a8a29e",
              fontStyle: "italic",
              marginBottom: "0.75rem",
            }}
          >
            Probabilities generated by BBMI Monte Carlo simulation using team
            efficiency ratings and seeding. Updated daily.
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/ncaa-bracket-pulse"
              style={{
                fontSize: "0.75rem",
                color: "#2563eb",
                textDecoration: "underline",
              }}
            >
              Full bracket probabilities by region →
            </Link>
            <Link
              href="/ncaa-todays-picks"
              style={{
                fontSize: "0.75rem",
                color: "#2563eb",
                textDecoration: "underline",
              }}
            >
              Today&apos;s picks →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
