import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import WIAABracketPulseTable from "@/components/WIAABracketPulseTable";

export default function WIAABracketPulsePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI WIAA Bracket Pulse – State Tournament Seeding Forecast",
    description:
      "Live WIAA tournament projections powered by the Brantner Basketball Model Index.",
    url: "https://bbmihoops.com/wiaa-bracket-pulse",
    dateModified: new Date().toISOString(),
  };

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="section-wrapper">
        <div className="mt-10 flex flex-col items-center mb-6">
          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight mb-8">
            <LogoBadge league="wiaa" className="h-8 mr-3" />
            <span>WIAA Tournament Seed and Result Probabilities</span>
          </h1>

          {/* MAIN BRACKET TABLE */}
          <section className="w-full mt-12">
            <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
              <WIAABracketPulseTable />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
