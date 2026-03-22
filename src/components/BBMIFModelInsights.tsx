"use client";

import React, { useState } from "react";

/**
 * BBMIModelInsights — drop into any football page to show:
 *   1. Recommended betting filters (spread ≤ 14, edge ≥ 6)
 *   2. Caution weeks warning (Wk 4–7)
 *   3. Performance breakdown by filter
 *
 * Usage:
 *   <BBMIModelInsights games={gamesData} />
 *
 * Where gamesData is the football-games.json array.
 */

type Game = {
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  vegasLine?: number | null;
  bbmifLine?: number | null;
  bbmifPick?: string | null;
  homeTeam?: string;
  awayTeam?: string;
  edge?: number | null;
  week?: number | null;
  cautionWeek?: boolean;
  largeSpread?: boolean;
  recommendedBet?: boolean;
  neutralSite?: boolean;
};

function computeFilteredATS(games: Game[]) {
  const completed = games.filter(
    (g) =>
      g.actualHomeScore != null &&
      g.actualAwayScore != null &&
      g.vegasLine != null &&
      g.bbmifLine != null &&
      g.bbmifPick
  );

  function calcATS(
    subset: Game[]
  ): { wins: number; total: number; pct: string } {
    let wins = 0,
      total = 0;
    for (const g of subset) {
      const bl = g.bbmifLine!;
      const vl = g.vegasLine!;
      let pick: "home" | "away";
      if (bl < vl) pick = "home";
      else if (bl > vl) pick = "away";
      else continue;

      const am = g.actualAwayScore! - g.actualHomeScore!;
      if (am === vl) continue; // push

      const covered =
        pick === "home" ? am < vl : am > vl;
      total++;
      if (covered) wins++;
    }
    return {
      wins,
      total,
      pct: total > 0 ? ((wins / total) * 100).toFixed(1) : "—",
    };
  }

  const all = calcATS(completed);

  const filtered = calcATS(
    completed.filter(
      (g) =>
        Math.abs(g.vegasLine!) <= 14 &&
        (g.edge != null ? Math.abs(g.edge) >= 6 : false)
    )
  );

  const cautionWks = calcATS(
    completed.filter((g) => g.week != null && g.week >= 4 && g.week <= 7)
  );

  const nonCautionWks = calcATS(
    completed.filter(
      (g) => g.week != null && (g.week < 4 || g.week > 7)
    )
  );

  const largeSpread = calcATS(
    completed.filter((g) => Math.abs(g.vegasLine!) > 14)
  );

  const smallSpread = calcATS(
    completed.filter((g) => Math.abs(g.vegasLine!) <= 14)
  );

  return { all, filtered, cautionWks, nonCautionWks, largeSpread, smallSpread };
}

export default function BBMIModelInsights({ games }: { games: Game[] }) {
  const [expanded, setExpanded] = useState(false);
  const stats = computeFilteredATS(games);

  if (stats.all.total === 0) return null;

  return (
    <div
      style={{
        backgroundColor: "#fefce8",
        border: "1px solid #fde68a",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 24,
        fontSize: 13,
        lineHeight: 1.7,
        color: "#374151",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: expanded ? 12 : 0,
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ fontWeight: 700, fontSize: 14, color: "#92400e" }}>
          ⚠️ BBMI Betting Strategy — What the data shows
        </div>
        <span
          style={{
            fontSize: 12,
            color: "#a16207",
            fontWeight: 600,
            userSelect: "none",
          }}
        >
          {expanded ? "▲ Collapse" : "▼ Expand"}
        </span>
      </div>

      {expanded && (
        <>
          {/* Key insight */}
          <p style={{ margin: "0 0 12px 0" }}>
            After analyzing {stats.all.total} completed games, two filters
            dramatically improve BBMI&apos;s ATS performance:
          </p>

          {/* Filter cards */}
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            {/* Spread filter */}
            <div
              style={{
                flex: "1 1 200px",
                backgroundColor: "#ffffff",
                border: "1px solid #d6d3d1",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#78716c",
                  marginBottom: 4,
                }}
              >
                Skip blowouts
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1917" }}>
                Vegas spread ≤ 14 points
              </div>
              <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                Spread ≤ 14:{" "}
                <strong style={{ color: "#16a34a" }}>
                  {stats.smallSpread.pct}%
                </strong>{" "}
                ({stats.smallSpread.wins}/{stats.smallSpread.total}) vs Spread
                &gt;14:{" "}
                <strong style={{ color: "#dc2626" }}>
                  {stats.largeSpread.pct}%
                </strong>{" "}
                ({stats.largeSpread.wins}/{stats.largeSpread.total})
              </div>
            </div>

            {/* Edge filter */}
            <div
              style={{
                flex: "1 1 200px",
                backgroundColor: "#ffffff",
                border: "1px solid #d6d3d1",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#78716c",
                  marginBottom: 4,
                }}
              >
                Require conviction
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1917" }}>
                Model edge ≥ 6 points
              </div>
              <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                Combined (≤14 spread + ≥6 edge):{" "}
                <strong style={{ color: "#16a34a" }}>
                  {stats.filtered.pct}%
                </strong>{" "}
                ({stats.filtered.wins}/{stats.filtered.total})
              </div>
            </div>
          </div>

          {/* Caution weeks */}
          <div
            style={{
              backgroundColor: "#fff7ed",
              border: "1px solid #fdba74",
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#c2410c",
                marginBottom: 4,
              }}
            >
              📅 Weeks 4–7: Proceed with caution
            </div>
            <p style={{ margin: 0, fontSize: 12.5, color: "#44403c" }}>
              College football models face a structural disadvantage in weeks 4–7.
              With only 3–6 games per team, statistical data is too thin to
              reliably override Vegas lines — which already reflect insider
              knowledge, recruiting data, and preseason assessments the model
              can&apos;t access. The model performs significantly better once teams
              have 8+ games of data.
            </p>
            <div
              style={{
                fontSize: 12,
                color: "#78716c",
                marginTop: 6,
              }}
            >
              Wk 4–7:{" "}
              <strong style={{ color: "#dc2626" }}>
                {stats.cautionWks.pct}%
              </strong>{" "}
              ({stats.cautionWks.wins}/{stats.cautionWks.total}) vs All other
              weeks:{" "}
              <strong style={{ color: "#16a34a" }}>
                {stats.nonCautionWks.pct}%
              </strong>{" "}
              ({stats.nonCautionWks.wins}/{stats.nonCautionWks.total})
            </div>
          </div>

          {/* Honest disclosure */}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#78716c",
              fontStyle: "italic",
            }}
          >
            These filters are derived from one season of data (2025). Use them
            as guidance, not guarantees. All picks — including filtered-out
            games — remain logged publicly for full transparency.
          </p>
        </>
      )}
    </div>
  );
}
