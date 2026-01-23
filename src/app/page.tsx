"use client";

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
  <h1 className="text-4xl font-bold tracking-tight mb-4">
    Brantner Basketball Model Index
  </h1>
  <p className="text-stone-700 text-lg max-w-xl mx-auto">
    A predictive analytics platform for NCAA and WIAA basketball — rankings, bracket science, and game lines powered by data.
  </p>
</section>


        {/* Quick Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">

          <HomeCard title="Rankings" href="/rankings" description="Model-driven team ratings and efficiency metrics." />
          <HomeCard title="Teams" href="/teams" description="Profiles, stats, and matchup insights for every team." />
          <HomeCard title="Betting Lines" href="/betting-lines" description="BBMI vs Vegas lines, win probabilities, and results." />
          <HomeCard title="Bracket Pulse" href="/bracket-pulse" description="Live tournament projections and bubble movement." />
          <HomeCard title="Model Picks" href="/model-picks" description="Daily recommended plays based on model edges." />
          <HomeCard title="Model Results" href="/model-results" description="Historical performance and ROI tracking." />

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
