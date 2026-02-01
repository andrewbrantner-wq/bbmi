import BBMILogo from "@/components/BBMILogo";
import LogoBadge from "@/components/LogoBadge";
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
            <span>BBMI Bracket Projections and Bubble Watch</span>
          </h1>

          {/* BUBBLE WATCH TABLES - SIDE BY SIDE */}
          {(lastFourIn.length > 0 || firstFourOut.length > 0) && (
            <div className="bubble-watch-container w-full px-4" style={{ marginBottom: '3rem' }}>
              <div 
                style={{ 
                  display: 'flex !important',
                  flexDirection: 'row',
                  gap: '3rem',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  maxWidth: '750px',
                  margin: '0 auto'
                }}
              >
                
                {/* LAST FOUR IN */}
                {lastFourIn.length > 0 && (
                  <div style={{ width: '300px', maxWidth: '300px', minWidth: '300px', flexShrink: 0 }}>
                    <div className="rankings-table overflow-hidden border border-stone-200 rounded-md shadow-sm" style={{ width: '100%', maxWidth: '300px' }}>
                      <div className="rankings-scroll">
                        <table style={{ width: '100%', minWidth: 'auto', tableLayout: 'fixed' }}>
                          <thead>
                            <tr>
                              <th className="text-center" style={{ width: '100%' }}>
                                Last Four In
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {lastFourIn.map((team, idx) => (
                              <tr key={idx}>
                                <td className="text-left px-4 py-2">{team}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* FIRST FOUR OUT */}
                {firstFourOut.length > 0 && (
                  <div style={{ width: '300px', maxWidth: '300px', minWidth: '300px', flexShrink: 0 }}>
                    <div className="rankings-table overflow-hidden border border-stone-200 rounded-md shadow-sm" style={{ width: '100%', maxWidth: '300px' }}>
                      <div className="rankings-scroll">
                        <table style={{ width: '100%', minWidth: 'auto', tableLayout: 'fixed' }}>
                          <thead>
                            <tr>
                              <th className="text-center" style={{ width: '100%' }}>
                                First Four Out
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {firstFourOut.map((team, idx) => (
                              <tr key={idx}>
                                <td className="text-left px-4 py-2">{team}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
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