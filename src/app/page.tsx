export const metadata = {
  title: "BBMI Hoops – NCAA & WIAA Basketball Analytics",
  description:
    "Data-driven basketball analytics for NCAA and WIAA. Team efficiency rankings, game predictions, schedule strength, and historical model accuracy — analytics over instinct.",
  keywords: [
    "NCAA basketball analytics",
    "WIAA basketball predictions",
    "college basketball model",
    "BBMI",
    "basketball efficiency rankings",
    "March Madness analytics",
  ],
  openGraph: {
    title: "BBMI Hoops – NCAA & WIAA Basketball Analytics",
    description:
      "Data-driven basketball analytics for NCAA and WIAA. Efficiency rankings, game predictions, and fully public pick history — analytics over instinct.",
    url: "https://bbmihoops.com",
    siteName: "BBMI Hoops",
  },
};

import React from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import games from "@/data/betting-lines/games.json";
import rankings from "@/data/rankings/rankings.json";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import { ClickableCard } from "@/components/HomepageInteractive";
import LeagueNav from "@/components/LeagueNav";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  date: string; away: string; home: string;
  vegasHomeLine: number; bbmiHomeLine: number; bbmiWinProb: number;
  actualAwayScore: number | null; actualHomeScore: number | null;
  fakeBet: number; fakeWin: number; vegaswinprob: number;
};
type RankingRow = { team: string; conference: string; model_rank: number | string; record: string };

const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.model_rank)])
);
const getRank = (team: string): number | null => rankMap.get(team.toLowerCase()) ?? null;

// ------------------------------------------------------------
// UTILITIES
// ------------------------------------------------------------

function cleanGames(allGames: Game[]): Game[] {
  return allGames.filter(
    (g) => g.date && g.away && g.home && g.vegasHomeLine !== null && g.bbmiHomeLine !== null
  );
}

function getUpcomingGames(allGames: Game[]): Game[] {
  const cleaned = cleanGames(allGames);
  return cleaned.filter(
    (g) => g.actualHomeScore === 0 || g.actualHomeScore == null || g.actualAwayScore == null
  );
}

function getWIAAStats() {
  type RawGame = {
    team: string; location: string; result: string; teamLine: number | null;
    teamWinPct: number | string; date: string; opp: string; teamDiv: string;
  };
  const seen = new Set<string>();
  let total = 0, correct = 0;
  (wiaaTeams as RawGame[])
    .filter((g) => g.location === "Home" && g.result && g.result.trim() !== "" && g.teamLine !== null && g.teamLine !== 0)
    .forEach((g) => {
      const key = [g.team, g.opp].sort().join("|") + "|" + g.date.split(" ")[0].split("T")[0];
      if (seen.has(key)) return;
      seen.add(key);
      total++;
      const bbmiPickedHome = (g.teamLine as number) < 0;
      if (bbmiPickedHome === (g.result === "W")) correct++;
    });
  const winPct = total > 0 ? ((correct / total) * 100).toFixed(1) : "0";
  return { total, correct, winPct };
}

function getHistoricalStats() {
  const historicalGames = (games as Game[]).filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );
  const allBets = historicalGames.filter((g) => g.fakeBet > 0);
  const allWins = allBets.filter((g) => g.fakeWin > 0).length;
  const allWagered = allBets.length * 100;
  const allWon = allBets.reduce((sum, g) => sum + g.fakeWin, 0);
  const allRoi = allWagered > 0 ? (((allWon / allWagered) * 100) - 100).toFixed(1) : "0";
  const allWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0";
  const highEdgeGames = historicalGames.filter((g) => Math.abs(g.bbmiHomeLine - g.vegasHomeLine) >= 8);
  const highEdgeBets = highEdgeGames.filter((g) => g.fakeBet > 0);
  const highEdgeWins = highEdgeBets.filter((g) => g.fakeWin > 0).length;
  const highEdgeWinPct = highEdgeBets.length > 0 ? ((highEdgeWins / highEdgeBets.length) * 100).toFixed(1) : "0";
  return {
    allGames: { total: allBets.length, winPct: allWinPct, roi: allRoi },
    highEdge: { total: highEdgeBets.length, winPct: highEdgeWinPct },
  };
}

function getBestPlaysData() {
  const upcoming = getUpcomingGames(games as Game[]);
  const allTopPlays = upcoming
    .map((g) => ({ ...g, edge: Math.abs(g.bbmiHomeLine - g.vegasHomeLine) }))
    .sort((a, b) => b.edge - a.edge);
  const topPlays = allTopPlays
    .filter((g) => g.edge > 6.0)
    .map((g) => ({ ...g, awayRank: getRank(g.away), homeRank: getRank(g.home) }));
  const historicalGames = (games as Game[]).filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );
  const edgeFiltered = historicalGames.filter((g) => Math.abs(g.bbmiHomeLine - g.vegasHomeLine) >= 6.5);
  const bets = edgeFiltered.filter((g) => g.fakeBet > 0);
  const wins = bets.filter((g) => g.fakeWin > 0).length;
  const historicalWinPct = bets.length > 0 ? ((wins / bets.length) * 100).toFixed(1) : "0";
  const historicalWins = wins;
  const historicalTotal = bets.length;
  return { topPlays, historicalWinPct, historicalWins, historicalTotal };
}

// ------------------------------------------------------------
// WHAT THE MODEL MEASURES — static explainer cards
// ------------------------------------------------------------

const MODEL_PILLARS = [
  {
    icon: "📐",
    label: "Tempo-Free Efficiency",
    desc: "Offensive and defensive efficiency per 100 possessions, adjusted for pace — isolating true team quality from schedule variation.",
  },
  {
    icon: "🗓️",
    label: "Strength of Schedule",
    desc: "Every win and loss is weighted by opponent quality. A 20-win team in a weak conference isn't the same as one battle-tested in a power league.",
  },
  {
    icon: "🎯",
    label: "Shooting & Ball Security",
    desc: "Three-point rate, free throw efficiency, and assist-to-turnover ratio — the stats that separate good teams from dangerous tournament teams.",
  },
  {
    icon: "📊",
    label: "Predictive Line Generation",
    desc: "BBMI generates its own spread for every game, independent of Vegas. The gap between the two lines is the model's edge signal.",
  },
];

// ------------------------------------------------------------
// COVERAGE STATS — illustrates breadth of the model
// ------------------------------------------------------------

const ncaaTeamCount = new Set((rankings as RankingRow[]).map((r) => r.team)).size;
const wiaaGameCount = (() => {
  type RawGame = { team: string; location: string; result: string; teamLine: number | null; date: string; opp: string };
  const seen = new Set<string>();
  (wiaaTeams as RawGame[])
    .filter((g) => g.location === "Home")
    .forEach((g) => {
      const key = [g.team, g.opp].sort().join("|") + "|" + g.date.split(" ")[0].split("T")[0];
      seen.add(key);
    });
  return seen.size;
})();

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function HomePage() {
  const stats = getHistoricalStats();
  const wiaaStats = getWIAAStats();
  const { topPlays, historicalWinPct, historicalWins, historicalTotal } = getBestPlaysData();

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── HERO ── */}
        <section style={{ textAlign: "center", padding: "2rem 1rem 1.5rem", marginTop: "1.5rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "linear-gradient(90deg, #0a1a2f, #0d2440)",
            borderRadius: 999, padding: "0.35rem 1.1rem",
            fontSize: "0.78rem", fontWeight: 700, color: "#facc15",
            marginBottom: "1.25rem", letterSpacing: "0.04em",
            boxShadow: "0 2px 8px rgba(10,26,47,0.35)",
            border: "1px solid rgba(250,204,21,0.3)",
          }}>
            <span>📡</span>
            {ncaaTeamCount} NCAA teams · {wiaaStats.total}+ WIAA games · Updated daily
          </div>

          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
            fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.15, marginBottom: "0.9rem", color: "#0a1a2f",
          }}>
            NCAA &amp; WIAA Basketball Forecasts<br />
            <span style={{ color: "#2563eb" }}>Analytics Over Instinct.</span>
          </h1>

          <p style={{
            color: "#57534e", fontSize: "0.95rem", maxWidth: 520,
            margin: "0 auto 1.5rem", lineHeight: 1.65,
          }}>
            BBMI generates independent efficiency rankings, predictive spreads, and win
            probabilities for every game — no gut feelings, no hot takes, no retroactive
            edits. Just the model.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/ncaa-rankings"
              style={{
                display: "inline-block", padding: "0.65rem 1.5rem",
                background: "linear-gradient(135deg, #0a1a2f, #1e3a5f)",
                color: "#ffffff", borderRadius: 8, fontWeight: 700, fontSize: "0.88rem",
                textDecoration: "none", letterSpacing: "0.02em",
                boxShadow: "0 3px 10px rgba(10,26,47,0.3)",
              }}
            >
              📊 Explore Team Rankings
            </Link>
            <Link
              href="/ncaa-model-picks-history"
              style={{
                display: "inline-block", padding: "0.65rem 1.5rem",
                backgroundColor: "#ffffff", color: "#0a1a2f",
                border: "1.5px solid #d6d3d1",
                borderRadius: 8, fontWeight: 700, fontSize: "0.88rem",
                textDecoration: "none", letterSpacing: "0.02em",
                boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
              }}
            >
              View full pick history →
            </Link>
          </div>
        </section>

        {/* ── COVERAGE STATS ROW ── */}
        

        {/* ── WIAA STATE TOURNAMENT CALLOUT ── */}
        <section style={{
          margin: "0 0 2rem",
          background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
          borderRadius: 12, padding: "1.5rem 2rem",
          border: "1px solid rgba(250,204,21,0.3)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "1.25rem",
        }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              backgroundColor: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.4)",
              borderRadius: 999, padding: "0.2rem 0.75rem",
              fontSize: "0.68rem", fontWeight: 700, color: "#facc15",
              letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.6rem",
            }}>
              🏆 New Feature
            </div>
            <h2 style={{
              fontSize: "clamp(1.1rem, 2.5vw, 1.4rem)", fontWeight: 800,
              color: "#ffffff", margin: "0 0 0.4rem", letterSpacing: "-0.02em",
            }}>
              WIAA State Tournament Probabilities
            </h2>
            <p style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.55)", margin: 0, maxWidth: 480, lineHeight: 1.6 }}>
              BBMI&apos;s bracket simulation model now shows every team&apos;s probability of reaching
              Sectionals, qualifying for State, and winning a State Championship — by division.  This reflects WIAA seedings released 2/22/26.
            </p>
          </div>
          <Link
            href="/wiaa-state-tournament"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              backgroundColor: "#facc15", color: "#0a1a2f",
              borderRadius: 8, padding: "0.65rem 1.4rem",
              fontSize: "0.88rem", fontWeight: 800, textDecoration: "none",
              letterSpacing: "0.02em", whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(250,204,21,0.35)",
              flexShrink: 0,
            }}
          >
            View State Odds →
          </Link>
        </section>

        {/* ── WHAT THE MODEL MEASURES ── */}
        <section style={{ margin: "0 0 2.5rem" }}>
          <h2 style={{
            fontSize: "1.15rem", fontWeight: 700, color: "#0a1a2f",
            textAlign: "center", marginBottom: "1.25rem", letterSpacing: "-0.01em",
          }}>
            What BBMI Measures
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}>
            {MODEL_PILLARS.map(({ icon, label, desc }) => (
              <div key={label} style={{
                background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "1.25rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── MAIN CONTENT PANEL ── */}
        <section style={{
          backgroundColor: "#ffffff", borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          border: "1px solid #e2e0de",
          padding: "2rem 1.5rem 2.5rem",
          marginBottom: "2rem",
        }}>
          <LeagueNav
            stats={stats}
            wiaaStats={wiaaStats}
            topPlays={topPlays}
            historicalWinPct={historicalWinPct}
            historicalWins={historicalWins}
            historicalTotal={historicalTotal}
          />
        </section>

        {/* ── METHODOLOGY + PICKS ── */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2rem",
        }}>
          {/* Methodology — informational */}
          <div style={{
            background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
              About the Model
            </h3>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.65, marginBottom: 14 }}>
              BBMI blends tempo-free efficiency metrics, opponent adjustments, and
              predictive simulations to evaluate team strength and forecast game outcomes.
              Built on quantitative methods, not intuition — efficiency metrics, opponent
              adjustments, and predictive simulations that don&apos;t care who the talking heads favor.
            </p>
            <Link
              href="/about"
              style={{
                display: "inline-block",
                fontSize: "0.78rem", color: "#0a1a2f", fontWeight: 700,
                backgroundColor: "#facc15", borderRadius: 5,
                padding: "4px 12px", textDecoration: "none", letterSpacing: "0.03em",
              }}
            >
              Read the methodology →
            </Link>
          </div>

          {/* Today's Picks — clickable client component */}
          <ClickableCard
            href="/ncaa-todays-picks"
            title="Today's Picks"
            description={
              <>
                Daily game picks from BBMI&apos;s edge model — BBMI spread vs. Vegas with win
                probabilities for every game.{" "}
                <span style={{ color: "#facc15", fontWeight: 700 }}>{stats.highEdge.winPct}%</span> win rate
                on high-edge plays across {stats.highEdge.total}+ tracked games.
              </>
            }
            ctaLabel="See today's picks →"
          />
        </section>

      </div>
    </div>
  );
}
