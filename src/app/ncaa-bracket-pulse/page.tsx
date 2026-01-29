import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";
import BracketPulseTable from "@/components/BracketPulseTable";

export default function SeedingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI Bracket Pulse – NCAA Tournament Seeding Forecast",
    description:
      "Live NCAA tournament seeding projections powered by the Brantner Basketball Model Index.",
    url: "https://bbmihoops.com/ncaa-bracket-pulse",
    dateModified: new Date().toISOString(), // SAFE on server
  };

  return (
    <>
      {/* JSON-LD (server-rendered, hydration-safe) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="section-wrapper">
        <div className="mt-10 flex flex-col items-center mb-6">
          <BBMILogo />

          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
            <LogoBadge league="ncaa" className="h-8 mr-3" />
            <span>Men's Tournament Seed and Result Probabilities</span>
          </h1>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* LEFT SIDE — TABLE */}
            <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
              <BracketPulseTable />
            </div>

            {/* RIGHT SIDE — Notes */}
            <aside className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-medium mb-2">Notes</h3>
              <ul className="text-sm space-y-1">
                <li>Click any column header to sort.</li>
                <li>Percent values are displayed as percentages.</li>
              </ul>
            </aside>
          </section>
        </div>
      </div>
    </>
  );
}