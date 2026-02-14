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

import Link from "next/link";
import Image from "next/image";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import games from "@/data/betting-lines/games.json";
import rankings from "@/data/rankings/rankings.json";

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
  model_rank: number | string;  // Can be either
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
// UTILITIES (MATCH NCAA TODAY'S PICKS LOGIC)
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

// Calculate historical performance stats
function getHistoricalStats() {
  const historicalGames = (games as Game[]).filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  // All games
  const allBets = historicalGames.filter((g) => g.fakeBet > 0);
  const allWins = allBets.filter((g) => g.fakeWin > 0).length;
  const allWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0";

  // Edge >= 8
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
      winPct: allWinPct
    },
    highEdge: {
      total: highEdgeBets.length,
      winPct: highEdgeWinPct
    }
  };
}

// ------------------------------------------------------------
// BEST PLAYS CARD (ABOVE ABOUT SECTION)
// ------------------------------------------------------------

function BestPlaysCard() {
  const upcoming = getUpcomingGames(games as Game[]);
  const allTopPlays = getTopEdges(upcoming, 100); // Get more games initially
  
  // Filter to only games with edge > 6.0
  const topPlays = allTopPlays.filter(g => g.edge > 6.0);

  // If no games qualify, return null to hide the entire section
  if (topPlays.length === 0) return null;

  // Calculate historical win percentage at edge ≥ 6.5
  const historicalGames = (games as Game[]).filter(
    (g) =>
      g.actualHomeScore !== null &&
      g.actualAwayScore !== null &&
      g.actualHomeScore !== 0
  );

  const edgeFilteredHistorical = historicalGames.filter((g) => {
    const edge = Math.abs(g.bbmiHomeLine - g.vegasHomeLine);
    return edge >= 6.5;
  });

  const bets = edgeFilteredHistorical.filter((g) => g.fakeBet > 0);
  const wins = bets.filter((g) => g.fakeWin > 0).length;
  const historicalWinPct = bets.length > 0 ? ((wins / bets.length) * 100).toFixed(1) : "0";

  // Helper function to determine BBMI pick
  const getBBMIPick = (game: GameWithEdge): string => {
    const vegasLine = game.vegasHomeLine;
    const bbmiLine = game.bbmiHomeLine;
    
    // If BBMI line is lower than Vegas line, BBMI favors home team more
    // If BBMI line is higher than Vegas line, BBMI favors away team more
    if (bbmiLine < vegasLine) {
      return game.home;
    } else if (bbmiLine > vegasLine) {
      return game.away;
    } else {
      return ""; // No pick if lines are equal
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
        <div className="rankings-scroll">
          <table>
            <thead>
              <tr>
                <th>Away</th>
                <th>Home</th>
                <th>Vegas</th>
                <th>BBMI</th>
                <th>Edge</th>
                <th>BBMI Pick</th>
              </tr>
            </thead>

            <tbody>
              {topPlays.map((g, i) => {
                const awayRank = getRank(g.away);
                const homeRank = getRank(g.home);
                const pickTeam = getBBMIPick(g);
                const pickRank = pickTeam ? getRank(pickTeam) : null;

                return (
                  <tr key={i}>
                    <td style={{ textAlign: 'left' }}>
                      <Link
                        href={`/ncaa-team/${encodeURIComponent(g.away)}`}
                        className="hover:underline cursor-pointer flex items-center gap-2"
                      >
                        <NCAALogo teamName={g.away} size={24} />
                        <span>
                          {g.away}
                          {awayRank !== null && (
                            <span 
                              className="ml-1"
                              style={{ 
                                fontSize: '0.65rem',
                                fontStyle: 'italic',
                                fontWeight: awayRank <= 25 ? 'bold' : 'normal',
                                color: awayRank <= 25 ? '#dc2626' : '#78716c'
                              }}
                            >
                              (#{awayRank})
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      <Link
                        href={`/ncaa-team/${encodeURIComponent(g.home)}`}
                        className="hover:underline cursor-pointer flex items-center gap-2"
                      >
                        <NCAALogo teamName={g.home} size={24} />
                        <span>
                          {g.home}
                          {homeRank !== null && (
                            <span 
                              className="ml-1"
                              style={{ 
                                fontSize: '0.65rem',
                                fontStyle: 'italic',
                                fontWeight: homeRank <= 25 ? 'bold' : 'normal',
                                color: homeRank <= 25 ? '#dc2626' : '#78716c'
                              }}
                            >
                              (#{homeRank})
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td>{g.vegasHomeLine}</td>
                    <td>{g.bbmiHomeLine}</td>
                    <td style={{ fontWeight: 600 }}>
                      {g.edge.toFixed(1)}
                    </td>
                    <td style={{ fontWeight: 600, textAlign: 'left' }}>
                      {pickTeam && (
                        <Link
                          href={`/ncaa-team/${encodeURIComponent(pickTeam)}`}
                          className="hover:underline cursor-pointer flex items-center gap-2"
                        >
                          <NCAALogo teamName={pickTeam} size={20} />
                          <span>
                            {pickTeam}
                            {pickRank !== null && (
                              <span 
                                className="ml-1"
                                style={{ 
                                  fontSize: '0.65rem',
                                  fontStyle: 'italic',
                                  fontWeight: pickRank <= 25 ? 'bold' : 'normal',
                                  color: pickRank <= 25 ? '#dc2626' : '#78716c'
                                }}
                              >
                                (#{pickRank})
                              </span>
                            )}
                          </span>
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-xs text-stone-600 mt-3 text-center italic">
        Note: The probability of beating Vegas odds increases to {historicalWinPct}% when the BBMI line varies from the Vegas line by more than 6.5 points. Past results are not indicative of future performance.
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function HomePage() {
  const stats = getHistoricalStats();

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
                🏀 New: Added Best/Worst Performing Teams on NCAA Model Picks History Tab, WIAA Tournament Bracket predictions now live for all divisions!  State playoff predictions also included on WIAA team page.
            </div>
          </div>

          <p className="text-stone-700 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed">
            A predictive analytics platform for NCAA and WIAA basketball — rankings,
            bracket science, and game lines powered by data.
          </p>
        </section>

        {/* WHITE PANEL */}
        <section className="bg-white rounded-xl shadow-md px-5 sm:px-6 pt-8 pb-10">


          {/* NAVIGATION CARDS - TWO COLUMN LAYOUT */}
          <div 
            className="mb-10"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))',
              gap: '2rem',
              width: '100%'
            }}
          >
            {/* NCAA COLUMN */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-stone-800">NCAA Basketball</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <HomeCard
                  title="Team Rankings"
                  href="/ncaa-rankings"
                  description="Model-driven team ratings and efficiency metrics."
                  logoLeague="ncaa"
                />

                <PremiumHomeCard
                  title="Today's Picks"
                  href="/ncaa-todays-picks"
                  description="Daily recommended plays based on model edges."
                  logoLeague="ncaa"
                  allGamesWinPct={stats.allGames.winPct}
                  highEdgeWinPct={stats.highEdge.winPct}
                />

                <HomeCard
                  title="Picks Model Accuracy"
                  href="/ncaa-model-picks-history"
                  description="Historical ROI and BBMI vs Vegas lines tracking."
                  logoLeague="ncaa"
                />

                <HomeCard
                  title="Bracket Pulse"
                  href="/ncaa-bracket-pulse"
                  description="Live March Madness tournament seeding projections and performance probabilities."
                  logoLeague="ncaa"
                />
              </div>
            </div>

            {/* WIAA COLUMN */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-stone-800">WIAA Basketball</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <HomeCard
                  title="Team Rankings by Division"
                  href="/wiaa-rankings"
                  description="Model-driven team ratings and efficiency metrics."
                  logoLeague="wiaa"
                />

                <HomeCard
                  title="Today's Picks"
                  href="/wiaa-todays-picks"
                  description="Today's games and win probabilities."
                  logoLeague="wiaa"
                />
                
                <HomeCard
                  title="Bracket Pulse"
                  href="/wiaa-bracket-pulse"
                  description="Live WIAA tournament seeding projections and performance probabilities."
                  logoLeague="wiaa"
                />
                
                <HomeCard
                  title="Boys Varsity Teams"
                  href="/wiaa-teams"
                  description="Team Pages detailing schedule, lines, and win probabilities."
                  logoLeague="wiaa"
                />
              </div>
            </div>
          </div>

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
// PREMIUM HOMECARD (NCAA TODAY'S PICKS)
// ------------------------------------------------------------

type PremiumHomeCardProps = {
  title: string;
  href: string;
  description: string;
  logoLeague: "ncaa" | "wiaa";
  allGamesWinPct: string;
  highEdgeWinPct: string;
};

function PremiumHomeCard({
  title,
  href,
  description,
  logoLeague,
  allGamesWinPct,
  highEdgeWinPct,
}: PremiumHomeCardProps) {
  return (
    <Link href={href} className="block w-full">
      <div
        className="relative p-5 overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
          border: '2px solid #1e3a8a',
          borderRadius: '0.5rem',
          minHeight: '200px'
        }}
        role="group"
      >
        {/* Premium Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div 
            className="rounded-full text-xs font-bold whitespace-nowrap"
            style={{
              background: '#fbbf24',
              color: '#78350f',
              padding: '0.375rem 0.5rem'
            }}
          >
            🔒 PREMIUM
          </div>
          <div 
            className="text-xs font-semibold whitespace-nowrap"
            style={{
              color: '#fef3c7',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}
          >
            Free • Registration Required
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 w-full text-white" style={{ marginTop: '2rem' }}>
          {/* Title Row */}
          <div className="flex items-center gap-3 justify-center w-full">
            {logoLeague && (
              <div className="flex-none w-8 h-8 flex items-center justify-center">
                <LogoBadge
                  league={logoLeague}
                  size={40}
                  alt={`${logoLeague.toUpperCase()} logo`}
                />
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-bold tracking-tight leading-tight">
              {title}
            </h2>
          </div>

          {/* Description */}
          <p className="text-blue-100 text-sm">
            {description}
          </p>

          {/* Performance Stats */}
          <div className="w-full bg-white/10 rounded-lg p-3 mt-1">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <div className="text-2xl font-bold text-white">{allGamesWinPct}%</div>
                <div className="text-xs text-blue-100 mt-1">BBMI Picks Beat Vegas (1,400+ Games)</div>
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

type HomeCardProps = {
  title: string;
  href: string;
  description: string;
  logoLeague: "ncaa" | "wiaa";
};

function HomeCard({
  title,
  href,
  description,
  logoLeague,
}: HomeCardProps) {
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
                <LogoBadge
                  league={logoLeague}
                  size={40}
                  alt={`${logoLeague.toUpperCase()} logo`}
                />
              </div>
            )}

            <h2 className="text-lg sm:text-xl font-semibold tracking-tight leading-tight">
              {title}
            </h2>
          </div>

          <p className="text-stone-600 text-sm line-clamp-2">
            {description}
          </p>

          <span className="text-sm text-blue-600 font-medium mt-1">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}
