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
import games from "@/data/betting-lines/games.json";

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

// ------------------------------------------------------------
// BEST PLAYS CARD (ABOVE ABOUT SECTION)
// ------------------------------------------------------------

function BestPlaysCard() {
  const upcoming = getUpcomingGames(games as Game[]);
  const allTopPlays = getTopEdges(upcoming, 100); // Get more games initially
  
  // Filter to only games with edge > 4.5
  const topPlays = allTopPlays.filter(g => g.edge > 4.5);

  // If no games qualify, return null to hide the entire section
  if (topPlays.length === 0) return null;

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
                <th>Matchup</th>
                <th>Vegas</th>
                <th>BBMI</th>
                <th>Edge</th>
                <th>BBMI Pick</th>
              </tr>
            </thead>

            <tbody>
              {topPlays.map((g, i) => (
                <tr key={i}>
                  <td style={{ textAlign: 'left' }}>
                    {g.away} @ {g.home}
                  </td>
                  <td>{g.vegasHomeLine}</td>
                  <td>{g.bbmiHomeLine}</td>
                  <td style={{ fontWeight: 600 }}>
                    {g.edge.toFixed(1)}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {getBBMIPick(g)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-xs text-stone-600 mt-3 text-center italic">
        Note: The probability of beating Vegas odds increases to 75% when the BBMI line varies from the Vegas line by more than 7.5 points. Past results are not indicative of future performance.
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* HERO */}
        <section className="text-center py-8 sm:py-12 px-4 mt-10">
          <Image
            src="/logo-bbmi-navy-v5.svg"
            alt="BBMI Logo"
            width={140}
            height={140}
            className="mx-auto mt-6 mb-4 sm:mt-10 sm:mb-6"
          />

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Brantner Basketball Model Index
          </h1>

          <div className="overflow-hidden whitespace-nowrap mt-2">
            <div
              className="inline-block font-semibold text-sm animate-scroll"
              style={{ paddingLeft: "100%", color: "#b91c1c" }}
            >
              WIAA Data Now Live — Explore Team Pages, Rankings, and Win Probabilities
            </div>
          </div>

          <p className="text-stone-700 text-base sm:text-lg max-w-xl mx-auto mt-4 leading-relaxed">
            A predictive analytics platform for NCAA and WIAA basketball — rankings,
            bracket science, and game lines powered by data.
          </p>
        </section>

        {/* WHITE PANEL */}
        <section className="bg-white rounded-xl shadow-md px-5 sm:px-6 pt-8 pb-10">

          {/* NAVIGATION CARDS */}
          <div className="space-y-5 mb-10">
            <HomeCard
              title="Team Rankings"
              href="/ncaa-rankings"
              description="Model-driven team ratings and efficiency metrics."
              logoLeague="ncaa"
            />

            <HomeCard
              title="Today's Picks"
              href="/ncaa-todays-picks"
              description="Daily recommended plays based on model edges."
              logoLeague="ncaa"
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
              title="Boys Varsity Teams"
              href="/wiaa-teams"
              description="Team Pages detailing schedule, lines, and win probabilities."
              logoLeague="wiaa"
            />
          </div>

          {/* BEST PLAYS TABLE - ABOVE ABOUT SECTION (only if games with edge > 4.5 exist) */}
          {(() => {
            const upcoming = getUpcomingGames(games as Game[]);
            const hasQualifyingGames = upcoming.some((g: Game) => Math.abs(g.bbmiHomeLine - g.vegasHomeLine) > 4.5);
            
            return hasQualifyingGames ? (
              <div className="mb-10">
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-center">
                  Best Plays of the Day
                </h2>
                <BestPlaysCard />
              </div>
            ) : null;
          })()}

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
// HOMECARD
// ------------------------------------------------------------

type HomeCardProps = {
  title: string;
  href: string;
  description: string;
  logoLeague: string;
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
