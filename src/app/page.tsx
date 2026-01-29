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

export default function HomePage() {
  return (
    <div className="section-wrapper">
      {/* Main column: hero stays on gray; cards + about share one big white panel */}
      <div className="w-full max-w-[1400px] mx-auto px-6 py-10">
        
        {/* Hero on gray background */}
        <section className="text-center py-12 px-4 mt-16">
          <Image
            src="/logo-bbmi-navy-v5.svg"
            alt="BBMI Logo"
            width={160}
            height={160}
            className="mx-auto mt-10 mb-6"
          />

          <h1 className="text-3xl font-bold tracking-tight mb-2">
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

          <p className="text-stone-700 text-lg max-w-xl mx-auto mt-4">
            A predictive analytics platform for NCAA and WIAA basketball — rankings, bracket
            science, and game lines powered by data.
          </p>
        </section>

        {/* ONE white panel that contains both the cards and the About section */}
        <section className="bg-white rounded-xl shadow-md px-6 pt-10 pb-10">
          {/* Cards grid */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-1 gap-6 mb-10 justify-items-center">
            <HomeCard
              title="Team Rankings"
              href="/ncaa-rankings"
              description="Model-driven team ratings and efficiency metrics."
              logoLeague="ncaa"
            />
            <HomeCard
              title="Today’s Picks"
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

          {/* Divider inside the same white panel */}
          <div className="border-t border-stone-200 my-6" />

          {/* About Section (still on the same white background) */}
          <div className="max-w-[1020px] mx-auto leading-relaxed text-stone-700 text-center">
            <h2 className="text-2xl font-semibold mb-4">
              About the Model
            </h2>

            <p>
              The Brantner Basketball Model Index (BBMI) blends tempo-free efficiency metrics,
              opponent adjustments, and predictive simulations to evaluate team strength and
              forecast game outcomes. It is designed to be transparent, data-driven, and
              continuously improving throughout the season.
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

function HomeCard({
  title,
  href,
  description,
  logoLeague,
}: {
  title: string;
  href: string;
  description: string;
  logoLeague?: "ncaa" | "wiaa";
}) {
  return (
    <Link href={href} className="block w-full max-w-[480px] box-border">
      <div
        className="bbmi-card mx-auto p-4 rounded-lg text-center flex items-center justify-center box-border overflow-hidden"
        role="group"
      >
        <div className="flex flex-col items-center gap-2 flex-none w-full min-w-0">
          <div className="flex items-center gap-3 justify-center w-full px-3 min-w-0">
            {logoLeague && (
              <div className="flex-none w-8 h-8 flex items-center justify-center">
                <LogoBadge
                  league={logoLeague}
                  size={40}
                  alt={`${logoLeague.toUpperCase()} logo`}
                />
              </div>
            )}

            <h2
              className="text-xl font-semibold tracking-tight leading-tight max-w-full truncate min-w-0"
              style={{ wordBreak: "break-word", hyphens: "auto" }}
            >
              {title}
            </h2>
          </div>

          <p
            className="text-stone-600 text-sm max-w-full mx-auto line-clamp-2 overflow-hidden"
            style={{ wordBreak: "break-word", hyphens: "auto" }}
          >
            {description}
          </p>

          <div className="mt-1">
            <span className="text-sm text-blue-600 font-medium">Open →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
