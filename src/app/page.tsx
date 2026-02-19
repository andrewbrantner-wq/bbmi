export const metadata = {
  title: "BBMI Hoops – NCAA Basketball Analytics & Predictive Modeling",
  description:
    "Advanced NCAA basketball analytics powered by the Brantner Basketball Model Index. Live rankings, seeding forecasts, team profiles, and predictive insights.",
  keywords: [
    "NCAA basketball",
    "college basketball analytics",
    "BBMI",
    "basketball predictions",
    "March Madness",
    "NET rankings",
  ],
  openGraph: {
    title: "BBMI Hoops – NCAA Basketball Analytics",
    description:
      "Live NCAA basketball analytics, rankings, and predictive modeling powered by BBMI.",
    url: "https://bbmihoops.com",
    siteName: "BBMI Hoops",
  },
};

import React from "react";
import Link from "next/link";
import Image from "next/image";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import games from "@/data/betting-lines/games.json";
import rankings from "@/data/rankings/rankings.json";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import LeagueNav from "@/components/LeagueNav";


// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type Game = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number;
  bbmiHomeLine: number;
  bbmiWinProb: number;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: number;
  fakeWin: number;
  vegaswinprob: number;
};

type GameWithEdge = Game & {
  edge: number;
};

type RankingRow = {
  team: string;
  conference: string;
  model_rank: number | string;
  record: string;
};

// Build rank lookup map
const rankMap = new Map(
  (rankings as RankingRow[]).map((r) => [r.team.toLowerCase(), Number(r.model_rank)])
);

const getRank = (team: string): number | null => {
  return rankMap.get(team.toLowerCase()) ?? null;
};

// ------------------------------------------------------------
// UTILITIES
// ------------------------------------------------------------

function cleanGames(allGames: Game[]): Game[] {
  return allGames.filter(
    (g) =>
      g.date &&
      g.away &&
      g.home &&
      g.vegasHomeLine !== null &&
      g.bbmiHomeLine !== null
  );
}

function getUpcomingGames(allGames: Game[]): Game[] {
  const cleaned = cleanGames(allGames);
  return cleaned.filter(
    (g) =>
      g.actualHomeScore === 0 ||
      g.actualHomeScore == null ||
      g.actualAwayScore == null
  );
}

function getTopEdges(games: Game[], count = 5): GameWithEdge[] {
  return games
    .map((g) => ({
      ...g,
      edge: Math.abs(g.bbmiHomeLine - g.vegasHomeLine),
    }))
    .sort((a, b) => b.edge - a.edge)
    .slice(0, count);
}

// Calculate WIAA prediction accuracy stats for homepage
function getWIAAStats() {
  type RawGame = { team: string; location: string; result: string; teamLine: number | null; teamWinPct: number | string; date: string; opp: string; teamDiv: string; };
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

// Calculate historical performance stats
function getHistoricalStats() {
  const historicalGames = (games as Game[]).filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  const allBets = historicalGames.filter((g) => g.fakeBet > 0);
  const allWins = allBets.filter((g) => g.fakeWin > 0).length;
  const allWagered = allBets.length * 100;
  const allWon = allBets.reduce((sum, g) => sum + g.fakeWin, 0);
  const allRoi = allWagered > 0 ? (((allWon / allWagered) * 100) - 100).toFixed(1) : "0";
  const allWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0";

  const highEdgeGames = historicalGames.filter((g) => {
    const edge = Math.abs(g.bbmiHomeLine - g.vegasHomeLine);
    return edge >= 8;
  });
  const highEdgeBets = highEdgeGames.filter((g) => g.fakeBet > 0);
  const highEdgeWins = highEdgeBets.filter((g) => g.fakeWin > 0).length;
  const highEdgeWinPct = highEdgeBets.length > 0 ? ((highEdgeWins / highEdgeBets.length) * 100).toFixed(1) : "0";

  return {
    allGames: {
      total: allBets.length,
      winPct: allWinPct,
      roi: allRoi,
    },
    highEdge: {
      total: highEdgeBets.length,
      winPct: highEdgeWinPct,
    },
  };
}

// ------------------------------------------------------------
// STAT CARDS — server rendered, pure HTML
// ------------------------------------------------------------

function StatCards({ stats }: { stats: ReturnType<typeof getHistoricalStats> }) {
  const cards = [
    {
      value: `${stats.allGames.winPct}%`,
      label: "Beat Vegas",
      sub: `Documented across ${stats.allGames.total.toLocaleString()} tracked picks`,
      color: "#16a34a",
    },
    {
      value: `${stats.allGames.roi}%`,
      label: "ROI",
      sub: "Flat $100/game model — not cherry-picked",
      color: "#16a34a",
    },
    {
      value: stats.allGames.total.toLocaleString(),
      label: "Games Tracked",
      sub: "Every result logged publicly. No retroactive edits.",
      color: "#0a1a2f",
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e7e5e4',
            borderRadius: 10,
            padding: '1.25rem 1rem',
            textAlign: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 800,
              lineHeight: 1,
              color: card.color,
              marginBottom: 4,
            }}
          >
            {card.value}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#0a1a2f',
              marginBottom: 6,
            }}
          >
            {card.label}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#78716c', lineHeight: 1.4 }}>
            {card.sub}
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// NEW HERE BANNER — server rendered, static
// ------------------------------------------------------------

function NewHereBanner() {
  return (
    <div
      style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: 8,
        padding: '0.75rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: '#0369a1' }}>
        👋 <strong>New to BBMI?</strong> Our model has documented {/* populated at render */}
        <span style={{ fontWeight: 700 }}> 59%+ picks beating Vegas</span> over 1,500+ games.
      </span>
      <Link
        href="/about"
        style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#0369a1',
          whiteSpace: 'nowrap',
          textDecoration: 'underline',
        }}
      >
        Here's how it works →
      </Link>
    </div>
  );
}

// ------------------------------------------------------------
// BEST PLAYS CARD — client component with portal tooltips
// ------------------------------------------------------------

import BestPlaysCard from "@/components/BestPlaysCard";

// Helper to compute BestPlaysCard props server-side
function getBestPlaysData() {
  const upcoming = getUpcomingGames(games as Game[]);
  const allTopPlays = upcoming
    .map((g) => ({ ...g, edge: Math.abs(g.bbmiHomeLine - g.vegasHomeLine) }))
    .sort((a, b) => b.edge - a.edge);

  const topPlays = allTopPlays
    .filter((g) => g.edge > 6.0)
    .map((g) => ({
      ...g,
      awayRank: getRank(g.away),
      homeRank: getRank(g.home),
    }));

  const historicalGames = (games as Game[]).filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );
  const edgeFiltered = historicalGames.filter(
    (g) => Math.abs(g.bbmiHomeLine - g.vegasHomeLine) >= 6.5
  );
  const bets = edgeFiltered.filter((g) => g.fakeBet > 0);
  const wins = bets.filter((g) => g.fakeWin > 0).length;
  const historicalWinPct =
    bets.length > 0 ? ((wins / bets.length) * 100).toFixed(1) : "0";

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

        {/* HERO */}
        <section className="text-center py-8 sm:py-12 px-4 mt-10">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Brantner Basketball Model Index
          </h1>

          <div className="overflow-hidden whitespace-nowrap mt-2">
            <div
              className="inline-block font-bold text-base animate-scroll"
              style={{ paddingLeft: "100%", color: "#b91c1c" }}
            >
              🏀 New: Added Best/Worst Performing Teams on NCAA Model Picks History Tab, WIAA Tournament Bracket predictions now live for all divisions! State playoff predictions also included on WIAA team page.
            </div>
          </div>

          <p className="text-stone-700 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed">
            A predictive analytics platform for NCAA and WIAA basketball — rankings,
            bracket science, and game lines powered by data.
          </p>
        </section>

        {/* WHITE PANEL */}
        <section className="bg-white rounded-xl shadow-md px-5 sm:px-6 pt-8 pb-10">

          {/* LEAGUE NAV — handles banner, stat cards, nav cards, top plays per tab */}
          <LeagueNav
            stats={stats}
            wiaaStats={wiaaStats}
            topPlays={topPlays}
            historicalWinPct={historicalWinPct}
          />

          {/* ABOUT SECTION */}
          <div className="leading-relaxed text-stone-700 text-center px-2">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4">
              About the Model
            </h2>
            <p className="text-sm sm:text-base">
              The Brantner Basketball Model Index (BBMI) blends tempo-free efficiency
              metrics, opponent adjustments, and predictive simulations to evaluate team
              strength and forecast game outcomes. It is designed to be transparent,
              data-driven, and continuously improving throughout the season.
            </p>
            <Link
              href="/about"
              className="inline-block mt-6 text-blue-600 font-semibold hover:underline"
            >
              Learn more about the methodology →
            </Link>
          </div>

        </section>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// PREMIUM HOMECARD
// ------------------------------------------------------------

type PremiumHomeCardProps = {
  title: string;
  href: string;
  description: string;
  logoLeague: "ncaa" | "wiaa";
  allGamesWinPct: string;
  highEdgeWinPct: string;
  stats: {
    allGames: { total: number; winPct: string };
    highEdge: { total: number; winPct: string };
  };
};

function PremiumHomeCard({
  title,
  href,
  description,
  logoLeague,
  allGamesWinPct,
  highEdgeWinPct,
  stats,
}: PremiumHomeCardProps) {
  return (
    <Link href={href} className="block w-full">
      <div
        className="relative p-5 overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          border: '2px solid #1e3a8a',
          borderRadius: '0.5rem',
          minHeight: '200px',
        }}
        role="group"
      >
        {/* Premium Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className="rounded-full text-xs font-bold whitespace-nowrap"
            style={{ background: '#fbbf24', color: '#78350f', padding: '0.375rem 0.5rem' }}
          >
            🔒 PREMIUM
          </div>
          <div
            className="text-xs font-semibold whitespace-nowrap"
            style={{ color: '#fef3c7', textShadow: '2px 4px rgba(0,0,0,0.5)' }}
          >
            $15 (7-day trial) or $49/month
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full text-white" style={{ marginTop: '2rem' }}>
          <div className="flex items-center gap-3 justify-center w-full">
            {logoLeague && (
              <div className="flex-none w-8 h-8 flex items-center justify-center">
                <LogoBadge league={logoLeague} size={40} alt={`${logoLeague.toUpperCase()} logo`} />
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
              {title}
            </h2>
          </div>

          <p className="text-blue-100 text-sm">{description}</p>

          <div className="w-full bg-white/10 rounded-lg p-3 mt-1">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{allGamesWinPct}%</div>
                <div className="text-xs text-blue-100 mt-1">
                  BBMI Picks Beat Vegas ({stats.allGames.total.toLocaleString()} Games)
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-300">{highEdgeWinPct}%</div>
                <div className="text-xs text-blue-100 mt-1">BBMI Picks Beat Vegas When EDGE ≥ 8</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------
// HOMECARD
// ------------------------------------------------------------

// ------------------------------------------------------------
// HOME CARD
// ------------------------------------------------------------

type HomeCardProps = {
  title: string;
  href: string;
  description: string;
  logoLeague: "ncaa" | "wiaa";
};

function HomeCard({ title, href, description, logoLeague }: HomeCardProps) {
  return (
    <Link href={href} className="block w-full">
      <div
        className="card p-5 rounded-lg text-center flex items-center justify-center overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
        style={{ minHeight: '210px' }}
        role="group"
      >
        <div className="flex flex-col items-center gap-2 w-full">
          <div className="flex items-center gap-3 justify-center w-full">
            {logoLeague && (
              <div className="flex-none w-8 h-8 flex items-center justify-center">
                <LogoBadge league={logoLeague} size={40} alt={`${logoLeague.toUpperCase()} logo`} />
              </div>
            )}
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight leading-tight">
              {title}
            </h2>
          </div>
          <p className="text-stone-600 text-sm line-clamp-2">{description}</p>
          <span className="text-sm text-blue-600 font-medium mt-1">Open →</span>
        </div>
      </div>
    </Link>
  );
}
