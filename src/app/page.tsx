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

export default function HomePage() {
  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-10">

        {/* Hero */}
        <section className="text-center py-16 px-6 bg-white">
          <Image
            src="/logo-bbmi-navy-v4.png"
            alt="BBMI Logo"
            width={160}
            height={40}
            className="mx-auto mb-6"
          />

          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Brantner Basketball Model Index
          </h1>

          {/* ⭐ Scrolling Announcement Banner */}
<div className="overflow-hidden whitespace-nowrap mt-2">
  <div
    className="inline-block font-semibold text-sm animate-scroll"
    style={{ paddingLeft: "100%", color: "#b91c1c" }}
  >
    WIAA Data Now Live — Explore Team Pages, Rankings, and Win Probabilities
  </div>
</div>

<p className="text-stone-700 text-lg max-w-xl mx-auto mt-4">
  A predictive analytics platform for NCAA and WIAA basketball — rankings,
  bracket science, and game lines powered by data.
</p>
        </section>

        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">

          <HomeCard
            title="NCAA | Team Rankings"
            href="/ncaa-rankings"
            description="Model-driven team ratings and efficiency metrics."
          />

          <HomeCard
            title="NCAA | Today’s Picks"
            href="/ncaa-todays-picks"
            description="Daily recommended plays based on model edges."
          />

          <HomeCard
            title="NCAA | Picks Model Accuracy"
            href="/ncaa-model-picks-history"
            description="Historical ROI and BBMI vs Vegas lines tracking."
          />

          <HomeCard
            title="NCAA | Bracket Pulse"
            href="/ncaa-bracket-pulse"
            description="Live March Madness tournament seeding projections and performance probabilities."
          />

          <HomeCard
            title="WIAA | Team Rankings by Division"
            href="/wiaa-rankings"
            description="Model-driven team ratings and efficiency metrics."
          />

          <HomeCard
            title="WIAA | Boys Varsity Teams"
            href="/wiaa-teams"
            description="Team Pages detailing schedule, lines, and win probabilities."
          />

          {/* Hidden for now */}
          {/*
          <HomeCard
            title="WIAA | This Week's Games (Coming Soon)"
            href="/wiaa-games"
            description="Schedule and game lines for this week."
          />
          */}
        </div>

        {/* About Section */}
        <div className="rankings-table mt-16">
          <div className="summary-header">About the Model</div>
          <div className="bg-white p-6 rounded-b-md leading-relaxed text-stone-700">
            <p>
              The Brantner Basketball Model Index (BBMI) blends tempo-free efficiency metrics,
              opponent adjustments, and predictive simulations to evaluate team strength and
              forecast game outcomes. It is designed to be transparent, data-driven, and
              continuously improving throughout the season.
            </p>

            <Link
              href="/about"
              className="inline-block mt-4 text-blue-600 font-semibold hover:underline"
            >
              Learn more about the methodology →
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

/* Home Card Component */
function HomeCard({
  title,
  href,
  description,
}: {
  title: string;
  href: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card p-6 hover:shadow-lg transition-shadow duration-150 block"
    >
      <h2 className="text-xl font-bold tracking-tight mb-1">{title}</h2>
      <p className="text-stone-600 text-sm">{description}</p>
    </Link>
  );
}