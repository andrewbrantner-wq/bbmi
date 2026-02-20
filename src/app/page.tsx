export const metadata = {
  title: "BBMI Hoops – NCAA Basketball Analytics & Predictive Modeling",
  description: "Advanced NCAA basketball analytics powered by the Benchmark Basketball Model Index. Live rankings, seeding forecasts, team profiles, and predictive insights.",
  keywords: ["NCAA basketball", "college basketball analytics", "BBMI", "basketball predictions", "March Madness", "NET rankings"],
  openGraph: {
    title: "BBMI Hoops – NCAA Basketball Analytics",
    description: "Live NCAA basketball analytics, rankings, and predictive modeling powered by BBMI.",
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
import LeagueNav from "@/components/LeagueNav";
import HowItWorks from "@/components/HowItWorks";

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
  type RawGame = { team: string; location: string; result: string; teamLine: number | null; teamWinPct: number | string; date: string; opp: string; teamDiv: string };
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
  return { topPlays, historicalWinPct };
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function HomePage() {
  const stats = getHistoricalStats();
  const wiaaStats = getWIAAStats();
  const { topPlays, historicalWinPct } = getBestPlaysData();

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── HERO ── */}
        <section className="text-center py-6 sm:py-10 px-4 mt-6">
          {/* Trust badge — replaces scrolling ticker */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            backgroundColor: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 999, padding: "0.3rem 1rem",
            fontSize: "0.78rem", fontWeight: 700, color: "#15803d",
            marginBottom: "1rem", letterSpacing: "0.02em",
          }}>
            <span style={{ color: "#16a34a", fontSize: "1rem" }}>✓</span>
            {stats.allGames.winPct}% of picks beat Vegas · {stats.allGames.roi}% ROI · {stats.allGames.total.toLocaleString()}+ games tracked
          </div>

          {/* Outcome-first headline */}
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-3" style={{ lineHeight: 1.2 }}>
            Beat Vegas more often.<br />
            <span style={{ color: "#0a1a2f" }}>Documented. Transparent. Actuarial.</span>
          </h1>

          <p className="text-stone-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ marginBottom: "0.5rem" }}>
            BBMI is an independent basketball analytics model built by an actuary —
            covering NCAA and WIAA with a fully public pick history and no retroactive edits.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.25rem" }}>
            <Link
              href="/ncaa-todays-picks"
              style={{
                display: "inline-block", padding: "0.6rem 1.4rem",
                backgroundColor: "#0a1a2f", color: "#ffffff",
                borderRadius: 8, fontWeight: 700, fontSize: "0.88rem",
                textDecoration: "none", letterSpacing: "0.02em",
              }}
            >
              🎯 See Today&apos;s Picks
            </Link>
            <Link
              href="/about"
              style={{
                display: "inline-block", padding: "0.6rem 1.4rem",
                backgroundColor: "#ffffff", color: "#0a1a2f",
                border: "1.5px solid #d6d3d1",
                borderRadius: 8, fontWeight: 700, fontSize: "0.88rem",
                textDecoration: "none", letterSpacing: "0.02em",
              }}
            >
              How it works →
            </Link>
          </div>
        </section>

        {/* ── HOW IT WORKS — 3-step onboarding ── */}
        <HowItWorks
          winPct={stats.allGames.winPct}
          roi={stats.allGames.roi}
          gamesTracked={stats.allGames.total.toLocaleString()}
        />

        {/* ── WHITE PANEL ── */}
        <section className="bg-white rounded-xl shadow-md px-5 sm:px-6 pt-8 pb-10">
          <LeagueNav
            stats={stats}
            wiaaStats={wiaaStats}
            topPlays={topPlays}
            historicalWinPct={historicalWinPct}
          />

          {/* About */}
          <div className="leading-relaxed text-stone-700 text-center px-2 mt-4">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">About the Model</h2>
            <p className="text-sm sm:text-base">
              The Benchmark Basketball Model Index (BBMI) blends tempo-free efficiency
              metrics, opponent adjustments, and predictive simulations to evaluate team
              strength and forecast game outcomes. It is designed to be transparent,
              data-driven, and continuously improving throughout the season.
            </p>
            <Link href="/about" className="inline-block mt-6 text-blue-600 font-semibold hover:underline">
              Learn more about the methodology →
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
