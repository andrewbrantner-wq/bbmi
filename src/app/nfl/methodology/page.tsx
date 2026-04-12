import Link from "next/link";

export const metadata = {
  title: "NFL Methodology \u2014 BBMI Sports Analytics",
  description: "How BBMI's NFL analytics product works, what it measures, and why we don't offer NFL betting picks.",
};

const ACCENT = "#013369";

export default function NFLMethodologyPage() {
  return (
    <div style={{ backgroundColor: "#f0efe9", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: ACCENT, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NFL Analytics {"\u00B7"} Methodology
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: 0 }}>
            How NFL Analytics Works
          </h1>
        </div>

        {/* What the composite measures */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>
            The BBMI Composite Rating
          </h2>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            The BBMI Composite Rating is a single number representing how many points above or below
            average an NFL team is. It blends three independent rating systems, each capturing different
            information about team quality:
          </p>
          <ul style={{ color: "#374151", lineHeight: 1.8, paddingLeft: "1.25rem", marginBottom: "1rem" }}>
            <li><strong>Elo ratings (40%)</strong> {"\u2014"} from the open-source nfelo project. Score-based power
              ratings with QB adjustments, home field, and rest days. Captures who&apos;s winning and by how much.</li>
            <li><strong>EPA efficiency (40%)</strong> {"\u2014"} computed from nflverse play-by-play data. Expected Points
              Added per play measures the quality of each offensive and defensive snap. Captures how well
              a team plays, independent of the final score.</li>
            <li><strong>Opponent-adjusted box scores (20%)</strong> {"\u2014"} from Pro Football Reference game logs with
              iterative opponent quality adjustment. Captures schedule-adjusted performance.</li>
          </ul>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            Each source is normalized and weighted. The composite updates weekly during the NFL season.
          </p>
        </section>

        {/* What is EPA */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>
            What is EPA?
          </h2>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            EPA (Expected Points Added) measures the value of each play in terms of expected points.
            A first down on your own 20-yard line is worth about 0.5 expected points. A touchdown from
            the 5-yard line is worth about 6.3. Every play either adds or subtracts expected points
            based on the down, distance, yard line, and result.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            EPA/play tells you how efficient a team is per snap. A team with +0.10 offensive EPA/play
            gains about 0.10 expected points more than average on every play {"\u2014"} over 65 plays per game,
            that&apos;s about 6.5 points better than average. It&apos;s the most granular publicly available
            measure of team quality.
          </p>
        </section>

        {/* Why no picks */}
        <section style={{ marginBottom: "2.5rem" }}>
          <div style={{
            backgroundColor: "#fffbeb", border: "1px solid #fde68a",
            borderRadius: 10, padding: "1.5rem 2rem",
          }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#92400e", marginBottom: 12 }}>
              Why BBMI Doesn&apos;t Offer NFL Picks
            </h2>
            <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
              BBMI conducted an extensive investigation into NFL spread and total prediction during
              April 2026, testing 12 independent approaches across four seasons of data. We tested
              our own opponent-adjusted model, nfelo Elo ratings, calibrated EPA projections,
              three-source blending, ATS performance at high edge thresholds, conditional subsets
              by week and spread size, and weather effects on totals.
            </p>
            <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
              Every test confirmed that NFL closing lines are efficient against all publicly available
              models. No combination of Elo ratings, EPA metrics, or opponent-adjusted statistics could
              consistently beat the market. The NFL has 32 teams, enormous public attention, and the
              sharpest betting lines in sports {"\u2014"} the market already incorporates everything these
              models capture and more.
            </p>
            <p style={{ color: "#374151", lineHeight: 1.75, fontWeight: 600 }}>
              Rather than offer picks at coinflip accuracy, we provide analytical tools and data that
              inform your own football analysis. We believe this transparency is what sets BBMI apart.
            </p>
          </div>
        </section>

        {/* Data sources */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>
            Data Sources
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Source", "Data", "Update"].map(h => (
                  <th key={h} style={{
                    backgroundColor: ACCENT, color: "#fff", padding: "8px 12px",
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.06em", textAlign: "left",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["nflverse", "Play-by-play with EPA, CPOE, WPA", "Weekly"],
                ["nfelo", "Elo ratings with QB model", "Weekly"],
                ["Pro Football Reference", "Team game logs and box scores", "Weekly"],
                ["Odds API", "Vegas spreads and totals (display only)", "Pre-game"],
                ["Open-Meteo", "Game-day weather for outdoor stadiums", "Game-day"],
              ].map(([source, desc, cadence], i) => (
                <tr key={source} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                  <td style={{ padding: "8px 12px", fontSize: 13, fontWeight: 600, borderTop: "1px solid #e5e7eb" }}>{source}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: "#57534e", borderTop: "1px solid #e5e7eb" }}>{desc}</td>
                  <td style={{ padding: "8px 12px", fontSize: 13, color: "#78716c", borderTop: "1px solid #e5e7eb" }}>{cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Comparison to other sports */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>
            NFL vs. Our Other Sports
          </h2>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            BBMI&apos;s NCAA basketball, football, baseball, and MLB models generate validated betting
            picks because those markets have exploitable inefficiencies {"\u2014"} 130+ teams, thin markets,
            less sharp money, and information asymmetry the model can capture. The NFL is different:
            32 teams, massive public attention, and closing lines that already reflect all available
            information. Different markets require different honest assessments.
          </p>
        </section>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link href="/nfl/rankings" style={{
            display: "inline-block", padding: "10px 24px", backgroundColor: ACCENT,
            color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700,
            textDecoration: "none",
          }}>
            View Power Rankings
          </Link>
        </div>
      </div>
    </div>
  );
}
