import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import BracketPulseTable from "@/components/BracketPulseTable";
import bubblewatch from "@/data/ncaa-bracket/bubblewatch.json";
import seedingData from "@/data/seeding/seeding.json";

function getBubbleTeams() {
  const data = bubblewatch as { team: string; bubble: string }[];
  const lastFourIn = data.filter((row) => row.bubble === "in").map((row) => row.team);
  const firstFourOut = data.filter((row) => row.bubble === "out").map((row) => row.team);
  return { lastFourIn, firstFourOut };
}

function isOfficialBracket(): boolean {
  if (!Array.isArray(seedingData) || seedingData.length === 0) return false;
  return seedingData.length >= 68;
}

const TH: React.CSSProperties = {
  backgroundColor: "#4a6fa5",
  color: "#ffffff",
  padding: "8px 12px",
  textAlign: "center",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(255,255,255,0.2)",
};

const TD: React.CSSProperties = {
  padding: "7px 12px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  verticalAlign: "middle",
};

export default function SeedingPage() {
  const { lastFourIn, firstFourOut } = getBubbleTeams();
  const officialBracket = isOfficialBracket();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "BBMI Playoff Pulse – NCAA Tournament Seeding Forecast",
    description: "Live NCAA tournament seeding projections powered by the Benchmark Basketball Model Index.",
    url: "https://bbmisports.com/ncaa-bracket-pulse",
    dateModified: new Date().toISOString(),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
        <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#4a6fa5", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
              NCAA Basketball {"\u00B7"} Playoff Pulse
            </div>
            <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
              Tournament Seed and Result Probabilities
            </h1>

            {officialBracket && (
              <div style={{
                marginTop: 12,
                backgroundColor: "#e8eef6", border: "1px solid #c0d0e8",
                borderRadius: 8, padding: "8px 16px",
                fontSize: 13, color: "#2e5080", fontWeight: 600, textAlign: "center",
              }}>
                <span style={{ color: "#4a6fa5", fontSize: 15 }}>{"\u2714"}</span> Official 2026 NCAA Tournament bracket loaded {"\u2014"} probabilities reflect actual matchups via 10,000 simulations.
              </div>
            )}
          </div>

          {/* BUBBLE WATCH TABLE */}
          {!officialBracket && (lastFourIn.length > 0 || firstFourOut.length > 0) && (
            <div style={{ maxWidth: 1100, margin: "0 auto 48px" }}>
              <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
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
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                        <td style={TD}>
                          {lastFourIn[idx] ? (
                            <Link
                              href={`/ncaa-team/${encodeURIComponent(lastFourIn[idx])}`}
                              style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a", fontWeight: 500 }}
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
                              style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a", fontWeight: 500 }}
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

          {/* TOURNAMENT LINKS */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <Link
              href="/bracket-validation"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#4a6fa5",
                color: "#ffffff", border: "none",
                borderRadius: 8, padding: "0.55rem 1.25rem",
                fontSize: "0.82rem", fontWeight: 700, textDecoration: "none",
                letterSpacing: "0.03em",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {"\uD83D\uDCCA"} BBMI Bracket Results {"\u2014"} Live {"\u2192"}
            </Link>
          </div>

          {/* MAIN PROBABILITIES TABLE */}
          <section style={{ width: "100%", marginTop: officialBracket ? 24 : 48 }}>
            <BracketPulseTable />
          </section>

        </div>
      </div>
    </>
  );
}
