export const metadata = {
  title: "BBMI Hoops – NCAA & WIAA Basketball Analytics",
  description:
    "Actuarial-grade basketball analytics for NCAA and WIAA. Team efficiency rankings, game predictions, schedule strength, and historical model accuracy — built and maintained by an actuary.",
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
      "Actuarial-grade basketball analytics for NCAA and WIAA. Efficiency rankings, game predictions, and fully public pick history.",
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
          {/* Scope badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "linear-gradient(90deg, #0a1a2f, #0d2440)",
            borderRadius: 999, padding: "0.35rem 1.1rem",
            fontSize: "0.78rem", fontWeight: 700, color: "#4ade80",
            marginBottom: "1.25rem", letterSpacing: "0.04em",
            boxShadow: "0 2px 8px rgba(10,26,47,0.35)",
            border: "1px solid rgba(74,222,128,0.3)",
          }}>
            <span>📡</span>
            {ncaaTeamCount} NCAA teams · {wiaaStats.total}+ WIAA games · Updated daily
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
            fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.15, marginBottom: "0.9rem", color: "#0a1a2f",
          }}>
            NCAA &amp; WIAA Basketball Analytics<br />
            <span style={{ color: "#2563eb" }}>Built by an Actuary.</span>
          </h1>

          <p style={{
            color: "#57534e", fontSize: "0.95rem", maxWidth: 520,
            margin: "0 auto 1.5rem", lineHeight: 1.65,
          }}>
            BBMI generates independent efficiency rankings, predictive spreads, and win
            probabilities for every game — covering both college and high school
            basketball with full transparency and no retroactive edits.
          </p>

          {/* CTAs */}
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
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem", margin: "2rem 0",
        }}>
          {[
            { value: `${stats.allGames.total.toLocaleString()}+`, label: "Games Modeled", sub: "NCAA & WIAA combined" },
            { value: `${ncaaTeamCount}`, label: "NCAA Teams Ranked", sub: "Efficiency-adjusted" },
            { value: `${wiaaStats.total}+`, label: "WIAA Games Tracked", sub: "WI high school basketball" },
            { value: `${stats.highEdge.winPct}%`, label: "High-Edge Win Rate", sub: `Over ${stats.highEdge.total}+ plays` },
            { value: "Daily", label: "Model Updates", sub: "Lines & probabilities" },
          ].map(({ value, label, sub }) => (
            <div
              key={label}
              style={{
                background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "1.1rem 1rem",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              <div style={{ fontSize: "1.65rem", fontWeight: 800, color: "#4ade80", letterSpacing: "-0.02em" }}>
                {value}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#ffffff", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginTop: 4 }}>
                {label}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 2 }}>{sub}</div>
            </div>
          ))}
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
              <div
                key={label}
                style={{
                  background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "1.25rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                }}
              >
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
              Built by a credentialed actuary — the same statistical discipline used in
              insurance and risk modeling, applied to basketball.
            </p>
            <Link
              href="/about"
              style={{
                display: "inline-block",
                fontSize: "0.78rem", color: "#0a1a2f", fontWeight: 700,
                backgroundColor: "#4ade80", borderRadius: 5,
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
                <span style={{ color: "#c9a227", fontWeight: 700 }}>{stats.highEdge.winPct}%</span> win rate
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
