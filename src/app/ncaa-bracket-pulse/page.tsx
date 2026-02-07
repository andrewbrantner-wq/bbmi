import Link from "next/link";
import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import BracketPulseTable from "@/components/BracketPulseTable";
import bubblewatch from "@/data/ncaa-bracket/bubblewatch.json";

// Process bubble watch data
function getBubbleTeams() {
  // Skip header row, filter by status
  const data = bubblewatch.slice(1); // Remove header row
  
  const lastFourIn = data
    .filter((row) => row[1] === "in")
    .map((row) => row[0]);
  
  const firstFourOut = data
    .filter((row) => row[1] === "out")
    .map((row) => row[0]);
  
  return { lastFourIn, firstFourOut };
}

export default function SeedingPage() {
  const { lastFourIn, firstFourOut } = getBubbleTeams();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI Bracket Pulse – NCAA Tournament Seeding Forecast",
    description:
      "Live NCAA tournament seeding projections powered by the Brantner Basketball Model Index.",
    url: "https://bbmihoops.com/ncaa-bracket-pulse",
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
          <BBMILogo />

          <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight mb-8">
            <LogoBadge league="ncaa" className="h-8 mr-3" />
            <span>Men's Tournament Seed and Result Probabilities</span>
          </h1>

          {/* BUBBLE WATCH TABLE - SINGLE TABLE WITH TWO COLUMNS */}
          {(lastFourIn.length > 0 || firstFourOut.length > 0) && (
            <div className="bubble-watch-container w-full px-4" style={{ marginBottom: '3rem' }}>
              <div 
                style={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  maxWidth: '480px',
                  margin: '0 auto'
                }}
              >
                <div style={{ width: '480px', maxWidth: '480px' }}>
                  <div className="rankings-table overflow-hidden border border-stone-200 rounded-md shadow-sm" style={{ width: '100%' }}>
                    <div className="rankings-scroll">
                      <table style={{ width: '100%', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            <th className="text-center" style={{ width: '50%' }}>
                              Last Four In
                            </th>
                            <th className="text-center" style={{ width: '50%' }}>
                              First Four Out
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({ length: Math.max(lastFourIn.length, firstFourOut.length) }).map((_, idx) => (
                            <tr key={idx}>
                              <td className="text-left px-4 py-2" style={{ width: '50%' }}>
                                {lastFourIn[idx] ? (
                                  <Link
                                    href={`/ncaa-team/${encodeURIComponent(lastFourIn[idx])}`}
                                    className="hover:underline cursor-pointer flex items-center gap-2"
                                  >
                                    <NCAALogo teamName={lastFourIn[idx]} size={20} />
                                    <span>{lastFourIn[idx]}</span>
                                  </Link>
                                ) : ''}
                              </td>
                              <td className="text-left px-4 py-2" style={{ width: '50%' }}>
                                {firstFourOut[idx] ? (
                                  <Link
                                    href={`/ncaa-team/${encodeURIComponent(firstFourOut[idx])}`}
                                    className="hover:underline cursor-pointer flex items-center gap-2"
                                  >
                                    <NCAALogo teamName={firstFourOut[idx]} size={20} />
                                    <span>{firstFourOut[idx]}</span>
                                  </Link>
                                ) : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MAIN PROBABILITIES TABLE */}
          <section className="w-full mt-12">
            <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
              <BracketPulseTable />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
