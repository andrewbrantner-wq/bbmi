import Link from "next/link";
import games from "@/data/betting-lines/games.json";

export const metadata = {
  title: "About BBMI – Actuarial Sports Analytics",
  description:
    "The Benchmark Basketball Model Index: built by an actuary, tracked publicly, never edited. Learn how the model works and why transparency is the whole point.",
  keywords: ["BBMI methodology", "basketball model", "actuarial analytics", "NCAA picks", "sports analytics"],
  openGraph: {
    title: "About BBMI Hoops",
    description: "Built by an actuary. Tracked publicly. No retroactive edits. Learn how BBMI works.",
    url: "https://bbmihoops.com/about",
    siteName: "BBMI Hoops",
  },
};

// ------------------------------------------------------------
// COMPUTE LIVE STATS FROM GAMES DATA
// ------------------------------------------------------------

const FREE_EDGE_LIMIT = 5;
const ELITE_EDGE_LIMIT = 8;

function computeStats() {
  const historical = (games as {
    date?: string | null;
    away?: string | number | null;
    home?: string | number | null;
    vegasHomeLine?: number | null;
    bbmiHomeLine?: number | null;
    actualHomeScore?: number | null;
    actualAwayScore?: number | null;
    fakeBet?: string | number | null;
    fakeWin?: number | null;
  }[]).filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  const allBets = historical.filter((g) => Number(g.fakeBet || 0) > 0);
  const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const overallWinPct = allBets.length > 0
    ? ((allWins / allBets.length) * 100).toFixed(1)
    : "0.0";

  const highEdge = allBets.filter(
    (g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT
  );
  const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const highEdgeWinPct = highEdge.length > 0
    ? ((highEdgeWins / highEdge.length) * 100).toFixed(1)
    : "0.0";
  const highEdgeWon = highEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const highEdgeRoi = highEdge.length > 0
    ? ((highEdgeWon / (highEdge.length * 100)) * 100 - 100).toFixed(1)
    : "0.0";

  const eliteEdge = allBets.filter(
    (g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= ELITE_EDGE_LIMIT
  );
  const eliteEdgeWins = eliteEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const eliteEdgeWinPct = eliteEdge.length > 0
    ? ((eliteEdgeWins / eliteEdge.length) * 100).toFixed(1)
    : "0.0";

  return {
    totalGames: allBets.length,
    overallWinPct,
    highEdgeWinPct,
    highEdgeRoi,
    eliteEdgeWinPct,
    highEdgeCount: highEdge.length,
  };
}

const STATS = computeStats();

// ------------------------------------------------------------
// SECTION CARD
// ------------------------------------------------------------
function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      overflow: "hidden", border: "1px solid #e5e7eb",
      borderRadius: 12, marginBottom: "2rem",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      <div style={{
        background: "#0a1a2f", color: "#ffffff",
        padding: "0.55rem 1.25rem", textAlign: "center",
        fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.1em", fontSize: "0.78rem",
      }}>
        {label}
      </div>
      <div style={{ backgroundColor: "#ffffff", padding: "2rem" }}>
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// STAT CHIP
// ------------------------------------------------------------
function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      backgroundColor: "#0a1a2f", borderRadius: 10,
      padding: "1rem 1.25rem", textAlign: "center", flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", marginTop: "0.35rem" }}>{label}</div>
    </div>
  );
}

// ------------------------------------------------------------
// COMPARISON ROW
// ------------------------------------------------------------
function CompRow({ aspect, bbmi, typical }: { aspect: string; bbmi: string; typical: string }) {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#374151", width: "30%" }}>{aspect}</td>
      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#15803d", fontWeight: 600, width: "35%" }}>
        <span style={{ marginRight: 6 }}>✓</span>{bbmi}
      </td>
      <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#9ca3af", width: "35%" }}>
        <span style={{ marginRight: 6 }}>✗</span>{typical}
      </td>
    </tr>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------
export default function AboutPage() {
  return (
    <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* HERO */}
        <div style={{ textAlign: "center", marginTop: "3rem", marginBottom: "3rem" }}>
          <div style={{
            display: "inline-block", backgroundColor: "rgba(250,204,21,0.15)",
            border: "1px solid rgba(250,204,21,0.4)", borderRadius: 999,
            padding: "0.3rem 0.9rem", fontSize: "0.72rem", fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.1em", color: "#92400e",
            marginBottom: "1rem",
          }}>
            Built by an actuary · Tracked publicly · Never edited
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 900, color: "#0a1a2f", lineHeight: 1.15, margin: "0 0 1rem" }}>
            About BBMI Hoops
          </h1>
          <p style={{ fontSize: "1rem", color: "#6b7280", maxWidth: 580, margin: "0 auto", lineHeight: 1.65 }}>
            The Benchmark Basketball Model Index is a college and high school basketball
            analytics project built on the same principles used in professional actuarial forecasting —
            and documented publicly from day one.
          </p>
        </div>

        {/* STATS STRIP — computed live from games.json */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2.5rem", justifyContent: "center" }}>
          <StatChip value={`${STATS.overallWinPct}%`} label="Overall vs Vegas" />
          <StatChip value={`${STATS.highEdgeWinPct}%`} label={`Edge ≥ ${FREE_EDGE_LIMIT} pts`} />
          <StatChip value={`${STATS.eliteEdgeWinPct}%`} label={`Edge ≥ ${ELITE_EDGE_LIMIT} pts`} />
          <StatChip value={`${STATS.totalGames.toLocaleString()}+`} label="Games tracked" />
        </div>

        {/* ORIGIN STORY */}
        <Card label="Origin Story">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            It started with a family NCAA bracket challenge. I built a quick model to get an edge,
            the model worked better than expected, and I got nerd-sniped into something more serious.
            What began as a fun experiment became a genuine forecasting project — one that now covers{" "}
            {STATS.totalGames.toLocaleString()}+ documented NCAA games and an entire WIAA high school basketball season.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            I&apos;ve spent decades as an actuary building predictive models for healthcare costs and
            revenue forecasting. The core disciplines — data quality, variable selection, calibration,
            and out-of-sample validation — translate surprisingly well to sports. Once I noticed the
            model&apos;s projected game lines were consistently closer to actual outcomes than several
            publicly available Vegas models, the logical next step was to track it rigorously and
            see if the edge was real.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            The goal has always been simple: publish the picks before the games, record every result
            publicly, and let the cumulative record speak for itself. No cherry-picking. No retroactive
            adjustments. If the model is good, the numbers will show it over time.
          </p>
        </Card>

        {/* METHODOLOGY */}
        <Card label="How the Model Works">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            The BBMI generates its own predicted point spread for every game — independently of
            what Vegas has set. The gap between the BBMI line and the Vegas line is what we call
            the <strong>&quot;edge.&quot;</strong> The bigger the edge, the more strongly the model disagrees
            with the sportsbooks.
          </p>

          <div style={{
            backgroundColor: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 8, padding: "1.25rem 1.5rem", marginBottom: "1.25rem",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0369a1", marginBottom: "0.5rem" }}>
              Edge = |BBMI Line − Vegas Line|
            </div>
            <p style={{ fontSize: "0.85rem", color: "#0c4a6e", margin: 0, lineHeight: 1.6 }}>
              When the model strongly disagrees with Vegas, it&apos;s typically because it&apos;s detected
              something the market hasn&apos;t fully priced in — an efficiency gap, a strength-of-schedule
              discrepancy, or a situational factor. These are the picks worth paying attention to.
            </p>
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            Team strength is evaluated using a blend of scoring efficiency, opponent quality,
            historical performance, and situational factors. These inputs are weighted and
            transformed into a projected spread and win probability for each matchup.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            Rather than relying on any single metric, the model uses a layered approach — each
            component contributes a small but meaningful signal. The goal isn&apos;t perfection on
            any one game. It&apos;s consistent, repeatable accuracy across a large sample.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            The WIAA model applies the same framework to high school basketball, with the
            acknowledgment that self-reported team statistics introduce more noise. The model
            is directionally useful but naturally less precise than its NCAA counterpart.
          </p>
        </Card>

        {/* TRANSPARENCY PHILOSOPHY */}
        <Card label="The Transparency Philosophy">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Every pick BBMI has ever made is logged publicly at{" "}
            <Link href="/ncaa-model-picks-history" style={{ color: "#2563eb", fontWeight: 600 }}>
              ncaa-model-picks-history
            </Link>
            . Wins, losses, dates, spreads, simulated returns — all of it, from the first pick of
            the season, unedited.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
            {[
              { icon: "📋", title: "Full pick log", desc: "Every game picked, every result recorded. No gaps, no selective omissions." },
              { icon: "🔒", title: "No retroactive edits", desc: "Picks are published before games tip off. The record cannot be adjusted afterward." },
              { icon: "📊", title: "Edge breakdown", desc: `Performance is shown by edge tier — ${STATS.highEdgeWinPct}% accuracy at ≥${FREE_EDGE_LIMIT} pts, ${STATS.eliteEdgeWinPct}% at ≥${ELITE_EDGE_LIMIT} pts.` },
              { icon: "📅", title: "Weekly summaries", desc: "Performance by week so you can verify it's not just a lucky streak." },
            ].map((item) => (
              <div key={item.title} style={{ backgroundColor: "#f9fafb", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontSize: "1.25rem", marginBottom: "0.4rem" }}>{item.icon}</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0a1a2f", marginBottom: "0.3rem" }}>{item.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            This approach is borrowed directly from actuarial practice: a model that can&apos;t be
            validated against out-of-sample data isn&apos;t worth trusting. The public log isn&apos;t a
            marketing tactic — it&apos;s the only honest way to evaluate whether the model actually works.
          </p>
        </Card>

        {/* BBMI VS TOUTS */}
        <Card label="How BBMI Differs From Typical Tout Services">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.5rem" }}>
            The sports betting information industry is full of services selling picks with no
            verifiable track record. BBMI was built specifically to be the opposite of that.
          </p>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>Aspect</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#15803d" }}>BBMI</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>Typical Tout</th>
                </tr>
              </thead>
              <tbody>
                <CompRow aspect="Track record" bbmi="Public, unedited, full history" typical="Cherry-picked wins, no losses shown" />
                <CompRow aspect="Methodology" bbmi="Documented actuarial approach" typical="Vague claims, no explanation" />
                <CompRow aspect="Confidence tiers" bbmi="Edge scores show conviction level" typical="Everything is a 'lock'" />
                <CompRow aspect="Bad weeks" bbmi="Logged and visible" typical="Quietly buried" />
                <CompRow aspect="Pricing" bbmi="$15 trial / $49 monthly" typical="$99–$299+ per month" />
                <CompRow aspect="Background" bbmi="Professional actuary" typical="Unknown / unverifiable" />
              </tbody>
            </table>
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75, marginTop: "1.25rem", fontSize: "0.88rem" }}>
            The honest version of our pitch: the model has a documented{" "}
            <strong>{STATS.overallWinPct}%</strong> overall record and{" "}
            <strong>{STATS.highEdgeWinPct}%</strong> on high-edge picks across{" "}
            <strong>{STATS.totalGames.toLocaleString()}+</strong> games. That&apos;s real, verifiable, and not perfect.
            We&apos;d rather you evaluate the actual record than take our word for it.
          </p>
        </Card>

        {/* CTA */}
        <div style={{
          backgroundColor: "#0a1a2f", borderRadius: 12,
          padding: "2rem", textAlign: "center", marginBottom: "2rem",
        }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 0.75rem" }}>
            See the record for yourself
          </h2>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
            Every pick logged publicly. Filter by edge size. Judge it yourself.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/ncaa-model-picks-history" style={{
              display: "inline-block", backgroundColor: "#facc15", color: "#0a1a2f",
              padding: "0.6rem 1.25rem", borderRadius: 8, fontWeight: 800,
              fontSize: "0.85rem", textDecoration: "none",
            }}>
              View full pick history →
            </Link>
            <Link href="/ncaa-todays-picks" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              Today&apos;s picks
            </Link>
            <Link href="/feedback" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              Get in touch
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
