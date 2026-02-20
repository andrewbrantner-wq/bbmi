import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import BracketPulseTable from "@/components/BracketPulseTable";
import bubblewatch from "@/data/ncaa-bracket/bubblewatch.json";

function getBubbleTeams() {
  const data = bubblewatch.slice(1);
  const lastFourIn = data.filter((row) => row[1] === "in").map((row) => row[0]);
  const firstFourOut = data.filter((row) => row[1] === "out").map((row) => row[0]);
  return { lastFourIn, firstFourOut };
}

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 12px",
  textAlign: "center",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "2px solid rgba(255,255,255,0.1)",
};

const TD: React.CSSProperties = {
  padding: "7px 12px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  verticalAlign: "middle",
};

export default function SeedingPage() {
  const { lastFourIn, firstFourOut } = getBubbleTeams();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI Bracket Pulse – NCAA Tournament Seeding Forecast",
    description: "Live NCAA tournament seeding projections powered by the Benchmark Basketball Model Index.",
    url: "https://bbmihoops.com/ncaa-bracket-pulse",
    dateModified: new Date().toISOString(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>Men&apos;s Tournament Seed and Result Probabilities</span>
            </h1>
          </div>

          {/* BUBBLE WATCH TABLE */}
          {(lastFourIn.length > 0 || firstFourOut.length > 0) && (
            <div style={{ maxWidth: 480, margin: "0 auto 48px" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                  <colgroup>
                    <col style={{ width: "50%" }} />
                    <col style={{ width: "50%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={TH}>Last Four In</th>
                      <th style={{ ...TH, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>First Four Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.max(lastFourIn.length, firstFourOut.length) }).map((_, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={TD}>
                          {lastFourIn[idx] ? (
                            <Link
                              href={`/ncaa-team/${encodeURIComponent(lastFourIn[idx])}`}
                              style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", fontWeight: 500 }}
                              className="hover:underline"
                            >
                              <NCAALogo teamName={lastFourIn[idx]} size={20} />
                              <span>{lastFourIn[idx]}</span>
                            </Link>
                          ) : null}
                        </td>
                        <td style={{ ...TD, borderLeft: "1px solid #f5f5f4" }}>
                          {firstFourOut[idx] ? (
                            <Link
                              href={`/ncaa-team/${encodeURIComponent(firstFourOut[idx])}`}
                              style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", fontWeight: 500 }}
                              className="hover:underline"
                            >
                              <NCAALogo teamName={firstFourOut[idx]} size={20} />
                              <span>{firstFourOut[idx]}</span>
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MAIN PROBABILITIES TABLE */}
          <section style={{ width: "100%", marginTop: 48 }}>
            <BracketPulseTable />
          </section>

        </div>
      </div>
    </>
  );
}
