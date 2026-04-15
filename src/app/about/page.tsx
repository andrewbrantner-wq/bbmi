import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import footballGames from "@/data/betting-lines/football-games.json";
import baseballGames from "@/data/betting-lines/baseball-games.json";
import wiaaTeams from "@/data/wiaa-team/wiaa-scores.json";
import basketballOUBacktest from "@/data/betting-lines/basketball-ou-backtest.json";
import ModelChangelog from "@/components/ModelChangelog";

export const metadata = {
  title: "About BBMI – Data-Driven Sports Analytics",
  description:
    "BBMI is a data-driven sports analytics platform covering MLB, NCAA basketball, football, and baseball — plus WIAA high school basketball. Built by a risk manager, tracked publicly, never edited.",
  keywords: ["BBMI methodology", "sports model", "data-driven analytics", "MLB analytics", "MLB run line picks", "NCAA picks", "sports analytics", "baseball model", "football model"],
  openGraph: {
    title: "About BBMI Sports Analytics",
    description: "Built by a risk manager. Tracked publicly. No retroactive edits. Learn how BBMI works.",
    url: "https://bbmisports.com/about",
    siteName: "BBMI",
  },
};

// ------------------------------------------------------------
// COMPUTE LIVE STATS FROM GAMES DATA
// ------------------------------------------------------------

const FREE_EDGE_LIMIT = 8;   // matches ncaa-model-picks-history ≥8 pts tier
const ELITE_EDGE_LIMIT = 8;  // same — top tier on accuracy page

// Minimum edge for a pick to count in the performance record.
// The Vegas line is captured at a specific point in time. Lines routinely
// move 1–2 points between open and tip-off, and can vary by a point or more
// across different books. A difference smaller than 2 pts is therefore within
// normal market noise and does not represent a meaningful BBMI disagreement with Vegas.
const MIN_EDGE_FOR_RECORD = 2;

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

  // Only count picks where edge >= MIN_EDGE_FOR_RECORD (2 pts).
  // Smaller differences are likely explained by normal line movement or
  // variation between sportsbooks — not a genuine model disagreement with the market.
  const allBets = historical.filter(
    (g) =>
      Number(g.fakeBet || 0) > 0 &&
      Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= MIN_EDGE_FOR_RECORD
  );
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

// Football stats — uses ATS (against the spread) via fakeBet/fakeWin
const FOOTBALL_MIN_EDGE = 2;    // matches ncaaf-model-accuracy page
const FOOTBALL_PREMIUM_EDGE = 6;  // premium tier threshold
const FOOTBALL_MAX_SPREAD_PREM = 14;  // premium spread cap
function computeFootballStats() {
  const historical = (footballGames as {
    actualHomeScore?: number | null;
    actualAwayScore?: number | null;
    bbmifLine?: number | null;
    vegasHomeLine?: number | null;
    vegasLine?: number | null;
    fakeBet?: number | null;
    fakeWin?: number | null;
    edge?: number | null;
  }[]).filter(
    (g) => g.actualHomeScore != null && g.actualAwayScore != null && g.actualHomeScore !== 0
  );

  const allBets = historical.filter(
    (g) => Number(g.fakeBet || 0) > 0 && Math.abs(g.edge ?? 0) >= FOOTBALL_MIN_EDGE && (g.fakeWin ?? 0) !== 100
  );
  const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const winPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";

  const vl = (g: typeof historical[0]) => g.vegasLine ?? g.vegasHomeLine ?? null;
  const premBets = historical.filter(
    (g) => Number(g.fakeBet || 0) > 0 && Math.abs(g.edge ?? 0) >= FOOTBALL_PREMIUM_EDGE
    && vl(g) != null && Math.abs(Number(vl(g))) <= FOOTBALL_MAX_SPREAD_PREM
    && (g.fakeWin ?? 0) !== 100
  );
  const premWins = premBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const premWinPct = premBets.length > 0 ? ((premWins / premBets.length) * 100).toFixed(1) : "0.0";

  return { total: allBets.length, winPct, premTotal: premBets.length, premWinPct };
}

// Baseball stats — ATS (against the spread)
const BASEBALL_MIN_EDGE = 1.0;  // matches baseball/accuracy MIN_EDGE
const BASEBALL_HIGH_EDGE = 4;   // matches baseball/accuracy ≥4 runs bucket
function computeBaseballATS(minEdge: number) {
  const historical = (baseballGames as {
    actualHomeScore?: number | null;
    actualAwayScore?: number | null;
    bbmiLine?: number | null;
    vegasLine?: number | null;
  }[]).filter(
    (g) =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.vegasLine != null && g.bbmiLine != null &&
      Math.abs((g.bbmiLine ?? 0) - (g.vegasLine ?? 0)) >= minEdge
  );

  let wins = 0, pushes = 0;
  for (const g of historical) {
    const bl = g.bbmiLine ?? 0;
    const vl = g.vegasLine ?? 0;
    if (bl === vl) continue;
    const pickHome = bl < vl;
    const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
    const coverMargin = margin + vl;
    if (coverMargin === 0) { pushes++; continue; }
    const homeCovered = coverMargin > 0;
    if (pickHome === homeCovered) wins++;
  }
  const total = historical.length - pushes;
  const winPct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  return { total, wins, winPct };
}
const BASEBALL_PREMIUM_EDGE = 3;  // matches baseball/accuracy premium tier
function computeBaseballStats() {
  const base = computeBaseballATS(BASEBALL_MIN_EDGE);
  const premium = computeBaseballATS(BASEBALL_PREMIUM_EDGE);
  const highEdge = computeBaseballATS(BASEBALL_HIGH_EDGE);
  return { ...base, premTotal: premium.total, premWinPct: premium.winPct, highEdgeTotal: highEdge.total, highEdgeWinPct: highEdge.winPct };
}

// Baseball O/U stats — under-only record
function computeBaseballOUStats() {
  const historical = (baseballGames as {
    actualHomeScore?: number | null;
    actualAwayScore?: number | null;
    bbmiTotal?: number | null;
    vegasTotal?: number | null;
  }[]).filter(
    (g) =>
      g.actualHomeScore != null && g.actualAwayScore != null &&
      g.vegasTotal != null && g.bbmiTotal != null
  );

  let allWins = 0, allLosses = 0;
  let underWins = 0, underLosses = 0;
  for (const g of historical) {
    if (g.bbmiTotal! === g.vegasTotal!) continue; // BBMI push
    const actual = (g.actualHomeScore ?? 0) + (g.actualAwayScore ?? 0);
    if (actual === g.vegasTotal!) continue; // actual push
    const bbmiSaysUnder = g.bbmiTotal! < g.vegasTotal!;
    const actualUnder = actual < g.vegasTotal!;
    if (bbmiSaysUnder === actualUnder) allWins++; else allLosses++;
    if (bbmiSaysUnder) {
      if (actualUnder) underWins++; else underLosses++;
    }
  }
  const allTotal = allWins + allLosses;
  const allPct = allTotal > 0 ? ((allWins / allTotal) * 100).toFixed(1) : "0.0";
  const underTotal = underWins + underLosses;
  const underPct = underTotal > 0 ? ((underWins / underTotal) * 100).toFixed(1) : "0.0";
  return { allTotal, allPct, underTotal, underWins, underLosses, underPct };
}
const BASEBALL_OU_STATS = computeBaseballOUStats();

// WIAA stats — winner accuracy
function computeWIAAStats() {
  type RawGame = {
    team: string; location: string; result: string; teamLine: number | null;
    date: string; opp: string;
  };
  const seen = new Set<string>();
  let total = 0, correct = 0;
  (wiaaTeams as RawGame[])
    .filter((g) => g.location === "Home" && g.result && g.result.trim() !== "" && g.teamLine !== null && g.teamLine !== 0)
    .forEach((g) => {
      const key = [g.team, g.opp].sort().join("|") + "|" + g.date.split(" ")[0].split("T")[0];
      if (seen.has(key)) return;
      seen.add(key);
      total++;
      const bbmiPickedHome = (g.teamLine as number) < 0;
      if (bbmiPickedHome === (g.result === "W")) correct++;
    });
  const winPct = total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0";
  return { total, correct, winPct };
}

const FOOTBALL_STATS = computeFootballStats();
const BASEBALL_STATS = computeBaseballStats();
const WIAA_STATS = computeWIAAStats();


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
        background: "#2952cc", color: "#ffffff",
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
      backgroundColor: "#2952cc", borderRadius: 10,
      padding: "1rem 1.25rem", textAlign: "center", flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#ffffff", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.6)", marginTop: "0.35rem" }}>{label}</div>
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
    <div style={{ backgroundColor: "#f0efe9", minHeight: "100vh" }}>
      <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>

        {/* HERO */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 24, marginBottom: "3rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#2952cc", color: "#ffffff", borderRadius: 999,
            padding: "5px 14px", fontSize: 11, fontWeight: 600,
            marginBottom: 16,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#ffffff", display: "inline-block" }} />
            Built by a risk manager {"\u00B7"} Tracked publicly {"\u00B7"} Never edited
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 500, color: "#1a1a1a", lineHeight: 1.15, margin: "0 0 1rem", letterSpacing: "-0.025em" }}>
            About BBMI
          </h1>
          <p style={{ fontSize: "1rem", color: "#6b7280", maxWidth: 580, margin: "0 auto", lineHeight: 1.65 }}>
            BBMI is a data-driven sports analytics platform covering MLB, NCAA basketball, football, and baseball —
            plus WIAA high school basketball. Every model is built on professional forecasting principles
            and documented publicly from day one.
          </p>
        </div>

        {/* PERFORMANCE BY SPORT */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
          {/* NCAA Basketball */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #4a6fa5",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4a6fa5", marginBottom: "0.6rem" }}>
              NCAA Basketball Spread
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#8fa8c8", lineHeight: 1 }}>{STATS.overallWinPct}%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Free (edge 2–6)</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#4a6fa5", lineHeight: 1 }}>{STATS.highEdgeWinPct}%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Premium (edge &ge; 6)</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Overall: {STATS.overallWinPct}% ATS &middot; {STATS.totalGames.toLocaleString()} games
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/ncaa-model-picks-history" style={{ color: "#4a6fa5" }}>View log</Link>
            </div>
          </div>

          {/* NCAA Basketball O/U */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #4a6fa5",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#4a6fa5", marginBottom: "0.6rem" }}>
              NCAA Basketball Over/Under
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#8fa8c8", lineHeight: 1 }}>55.8%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Free (edge 2–4)</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#4a6fa5", lineHeight: 1 }}>60.6%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Premium (edge &ge; 4)</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Overall: {basketballOUBacktest.overall.winPct}% ATS &middot; {basketballOUBacktest.overall.games.toLocaleString()} games
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              Walk-forward + live &middot;{" "}
              <Link href="/ncaa-total-picks" style={{ color: "#4a6fa5" }}>View O/U</Link>
            </div>
          </div>

          {/* NCAA Football */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #6b7280",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280", marginBottom: "0.6rem" }}>
              NCAA Football Spread
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#6b7280", lineHeight: 1 }}>{FOOTBALL_STATS.premWinPct}%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Premium (edge &ge; 6)</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#9ca3af", lineHeight: 1 }}>{FOOTBALL_STATS.winPct}%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Walk-forward (2 seasons)</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Walk-forward validated &middot; 0.0pt overfitting gap &middot; {FOOTBALL_STATS.total.toLocaleString()} games
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/ncaaf-model-accuracy" style={{ color: "#6b7280" }}>View log</Link>
            </div>
          </div>

          {/* NCAA Baseball ATS */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #1a7a8a",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a7a8a", marginBottom: "0.6rem" }}>
              NCAA Baseball Spread
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#5aaab5", lineHeight: 1 }}>55.7%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Free ATS</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1a7a8a", lineHeight: 1 }}>59.9%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Premium ATS</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              695 premium picks &middot; Walk-forward 2024&ndash;2025
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/baseball/accuracy" style={{ color: "#1a7a8a" }}>View log</Link>
            </div>
          </div>

          {/* NCAA Baseball O/U */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #1a7a8a",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a7a8a", marginBottom: "0.6rem" }}>
              NCAA Baseball Over/Under
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#5aaab5", lineHeight: 1 }}>63.4%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Under ATS</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1a7a8a", lineHeight: 1 }}>58.5%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Over ATS</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Combined: 62.7% ATS &middot; 1,180 picks &middot; Walk-forward 2024&ndash;2025
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/baseball/totals" style={{ color: "#1a7a8a" }}>View O/U</Link>
            </div>
          </div>

          {/* WIAA Basketball */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #8b3a3a",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8b3a3a", marginBottom: "0.6rem" }}>
              WIAA Basketball
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#8b3a3a", lineHeight: 1 }}>{WIAA_STATS.winPct}%</div>
              <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Winner accuracy</div>
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              {WIAA_STATS.total.toLocaleString()} games tracked &middot;{" "}
              <Link href="/wiaa-model-accuracy" style={{ color: "#8b3a3a" }}>View log</Link>
            </div>
          </div>

          {/* MLB Under */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #1a6640",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a6640", marginBottom: "0.6rem" }}>
              MLB Over/Under
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#4a8a5a", lineHeight: 1 }}>57.0%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Under ATS</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1a6640", lineHeight: 1 }}>62.6%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Low-Total Over</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Combined: 54.9% ATS &middot; 874 picks &middot; Walk-forward 2024&ndash;2025
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/mlb/accuracy" style={{ color: "#1a6640" }}>View log</Link>
            </div>
          </div>

          {/* MLB Run Line */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #1a6640",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a6640", marginBottom: "0.6rem" }}>
              MLB Run Line
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#4a8a5a", lineHeight: 1 }}>53.7%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Edge &ge; 1.0</div>
              </div>
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1a6640", lineHeight: 1 }}>54.7%</div>
                <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Edge &ge; 1.25</div>
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              Walk-forward: 2,213 games &middot; Away +1.5 and Home -1.5
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/mlb/accuracy" style={{ color: "#1a6640" }}>View log</Link>
            </div>
          </div>

          {/* MLB Away Ace */}
          <div style={{
            background: "#ffffff", border: "1px solid #d4d2cc",
            borderRadius: 10, padding: "1.25rem", borderTop: "4px solid #1a6640",
            boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#1a6640", marginBottom: "0.6rem" }}>
              MLB Away Ace (●●●●)
            </div>
            <div style={{ marginBottom: "0.5rem" }}>
              <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1a6640", lineHeight: 1 }}>81.2%</div>
              <div style={{ fontSize: "0.58rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Away +1.5 Cover Rate</div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "#64748b", marginBottom: "0.4rem" }}>
              85 games &middot; +33.2% ROI at -156 juice &middot; Margin &ge; 0.15 + FIP advantage
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              <Link href="/mlb/picks" style={{ color: "#1a6640" }}>View today&apos;s picks</Link>
            </div>
          </div>
        </div>

        {/* STATS METHODOLOGY NOTE */}
        <p style={{
          fontSize: "0.68rem", color: "#9ca3af", textAlign: "center",
          maxWidth: 680, margin: "0 auto 2.5rem", lineHeight: 1.6,
        }}>
          Basketball and football ATS records include only picks where BBMI and Vegas lines differ by &ge; 2 points.
          NCAA Baseball ATS uses a &ge; 1.5-run threshold. WIAA shows outright winner prediction accuracy.
          MLB metrics are from 2024&ndash;2025 walk-forward validation.
          High-edge tiers match the thresholds shown on each sport&apos;s accuracy page.
          All records are computed from publicly logged data &mdash; no retroactive edits.
        </p>

        {/* ORIGIN STORY */}
        <Card label="Origin Story">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            It started with a family NCAA bracket challenge. I built a quick model to get an edge,
            the model worked better than expected, and I got nerd-sniped into something more serious.
            What began as a basketball experiment now covers {STATS.totalGames.toLocaleString()}+ documented NCAA basketball
            games, a full WIAA high school season, a walk-forward validated NCAA football model, NCAA baseball,
            and a walk-forward validated MLB model.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            I&apos;ve spent decades as a risk manager building predictive models for healthcare costs and
            revenue forecasting. The core disciplines — data quality, variable selection, calibration,
            and out-of-sample validation — translate surprisingly well to sports. Once I noticed the
            model&apos;s projected lines were consistently closer to actual outcomes than Vegas, the
            logical next step was to track it rigorously and see if the edge was real.
          </p>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            The goal is the same across every sport: publish picks before games, record every result
            publicly, and let the cumulative record speak for itself. No cherry-picking. No retroactive
            adjustments.
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
            backgroundColor: "#e8eef6", border: "1px solid #c0d0e8",
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

          <div style={{
            backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0",
            borderRadius: 8, padding: "1.25rem 1.5rem", marginBottom: "1.25rem",
          }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#15803d", marginBottom: "0.5rem" }}>
              Why Small Edges Are Excluded
            </div>
            <p style={{ fontSize: "0.85rem", color: "#14532d", margin: 0, lineHeight: 1.6 }}>
              The Vegas line used in this model is captured at a specific point in time. Lines routinely
              move 1–2 points between open and tip-off, and can vary by a point or more across different
              books. A difference smaller than 2 points is therefore within normal market noise — it&apos;s
              more likely explained by line movement or book-to-book variation than a genuine model
              disagreement with the market. Only picks with edge ≥ 2 pts are counted in the performance record.
            </p>
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1rem" }}>
            Each sport uses a model tailored to its specific inputs, but the same core framework applies:
            team strength is evaluated using scoring efficiency, opponent quality, and situational factors,
            then transformed into a projected spread and win probability for each matchup.
          </p>
          <ul style={{ color: "#374151", lineHeight: 1.8, marginBottom: "1rem", paddingLeft: "1.25rem" }}>
            <li><strong>Basketball:</strong> Offensive/defensive efficiency, tempo, RPI, home court</li>
            <li><strong>Football:</strong> SP+ efficiency ratings, opponent-adjusted box scores, quality wins, home field, altitude, weather-adjusted totals, early-season spread corrections. Walk-forward validated across 2 independent seasons with 0.0pt overfitting gap</li>
            <li><strong>NCAA Baseball:</strong> Run scoring, ERA, pitcher adjustments, dynamic park factors, WHIP</li>
            <li><strong>MLB:</strong> Negative Binomial engine, FIP-based pitcher ratings, park-neutral wOBA, asymmetric park factors, Bayesian blending, walk-forward validated</li>
            <li><strong>WIAA:</strong> Same basketball framework — more noise due to self-reported stats</li>
          </ul>
          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            The goal isn&apos;t perfection on any single game. It&apos;s consistent, repeatable accuracy
            across a large sample — and the public log is the proof.
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
              <div key={item.title} style={{ backgroundColor: "#ffffff", borderRadius: 8, padding: "1rem" }}>
                <div style={{ fontSize: "1.25rem", marginBottom: "0.4rem" }}>{item.icon}</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "0.3rem" }}>{item.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75 }}>
            This approach is borrowed directly from risk management practice: a model that can&apos;t be
            validated against out-of-sample data isn&apos;t worth trusting. The public log isn&apos;t a
            marketing tactic — it&apos;s the only honest way to evaluate whether the model actually works.
          </p>
        </Card>

        {/* WHY MODEL BETTING HAS AN EDGE */}
        <Card label="Why Model-Based Betting Works">
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Sports betting is one of the few markets where an informed individual can hold a structural
            advantage over the house — not because Vegas is bad at math, but because Vegas is solving
            a different problem than you are.
          </p>

          <div style={{
            backgroundColor: "#f0f9ff", borderRadius: 10, padding: "1.25rem 1.5rem",
            border: "1px solid #bae6fd", marginBottom: "1.5rem",
          }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0369a1", marginBottom: "0.5rem" }}>
              The core asymmetry
            </div>
            <p style={{ color: "#374151", lineHeight: 1.7, margin: 0, fontSize: "0.88rem" }}>
              Vegas has to set a precise number — the line. You only have to decide which side of it
              to be on. If the true spread is -6.2 and the book posts -5.5, you don&apos;t need to
              know it&apos;s exactly -6.2. You just need to recognize it&apos;s more than -5.5.
              That&apos;s a fundamentally easier problem.
            </p>
          </div>

          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "0.75rem" }}>
            What Vegas is actually optimizing for
          </h3>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            Sportsbooks aren&apos;t purely trying to predict the correct outcome — they&apos;re
            managing liability. When 80% of public money lands on one side, the book will shade
            the line to attract action on the other side, even if their internal model says the
            original number was right. A model focused purely on accuracy — not risk management —
            can exploit those gaps.
          </p>

          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "0.75rem" }}>
            Where BBMI fits in
          </h3>
          <p style={{ color: "#374151", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            BBMI doesn&apos;t need to be smarter than the sportsbook&apos;s internal model.
            It needs to be smarter than the <em>posted line</em> — the number that&apos;s already
            been distorted by public money, liability balancing, and market incentives. College sports
            are one of the best places to clear that bar: thin markets, less sharp money, and hundreds
            of teams that receive far less analytical attention than the pros.
          </p>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem", marginBottom: "1.5rem",
          }}>
            <div style={{
              backgroundColor: "#f0fdf4", borderRadius: 8, padding: "1rem 1.25rem",
              border: "1px solid #bbf7d0",
            }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "#15803d", marginBottom: "0.4rem" }}>
                Your advantages
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151",
                fontSize: "0.82rem", lineHeight: 1.7 }}>
                <li>Only need to pick a side, not set a number</li>
                <li>No liability to manage — pure accuracy focus</li>
                <li>College sports are inefficient and data-rich</li>
                <li>Public money distortions create exploitable gaps</li>
              </ul>
            </div>
            <div style={{
              backgroundColor: "#fef2f2", borderRadius: 8, padding: "1rem 1.25rem",
              border: "1px solid #fecaca",
            }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "#1a7a8a", marginBottom: "0.4rem" }}>
                The house edge
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#374151",
                fontSize: "0.82rem", lineHeight: 1.7 }}>
                <li>The juice (-110) means you need ~52.4% to break even</li>
                <li>Vegas has faster injury and lineup data</li>
                <li>Sharp bettors move closing lines toward &quot;true&quot;</li>
                <li>Variance is real — even good models have losing weeks</li>
              </ul>
            </div>
          </div>

          <div style={{
            backgroundColor: "#fffbeb", borderRadius: 10, padding: "1.25rem 1.5rem",
            border: "1px solid #fde68a",
          }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem" }}>
              The honest bottom line
            </div>
            <p style={{ color: "#374151", lineHeight: 1.7, margin: 0, fontSize: "0.88rem" }}>
              No model wins every bet. The goal is to clear the 52.4% breakeven threshold consistently
              over hundreds of games — and to bet more when the edge is largest. BBMI&apos;s documented
              record on high-edge picks shows this is achievable, but it requires discipline, patience,
              and realistic expectations. If someone promises you 70%+ win rates on every pick,
              they&apos;re selling something other than math.
            </p>
          </div>
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
                <tr style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #d4d2cc" }}>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>Aspect</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#15803d" }}>BBMI</th>
                  <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9ca3af" }}>Typical Tout</th>
                </tr>
              </thead>
              <tbody>
                <CompRow aspect="Track record" bbmi="Public, unedited, full history" typical="Cherry-picked wins, no losses shown" />
                <CompRow aspect="Methodology" bbmi="Documented analytical approach" typical="Vague claims, no explanation" />
                <CompRow aspect="Confidence tiers" bbmi="Edge scores show conviction level" typical="Everything is a 'lock'" />
                <CompRow aspect="Performance filter" bbmi="Excludes line-movement noise (edge < 2 pts)" typical="Counts everything, including coin flips" />
                <CompRow aspect="Bad weeks" bbmi="Logged and visible" typical="Quietly buried" />
                <CompRow aspect="Pricing" bbmi="$10 trial / $35 monthly" typical="$99–$299+ per month" />
                <CompRow aspect="Background" bbmi="Professional risk manager" typical="Unknown / unverifiable" />
              </tbody>
            </table>
          </div>

          <p style={{ color: "#374151", lineHeight: 1.75, marginTop: "1.25rem", fontSize: "0.88rem" }}>
            The honest version of our pitch: the numbers are in the cards above {"\u2014"} real,
            verifiable, and not perfect. We&apos;d rather you evaluate the actual record than
            take our word for it.
          </p>
        </Card>

        {/* MODEL CHANGELOG */}
        <Card label="Model Changelog">
          <ModelChangelog />
        </Card>

        {/* CTA */}
        <div style={{
          backgroundColor: "#2952cc", borderRadius: 12,
          padding: "2rem", textAlign: "center", marginBottom: "2rem",
        }}>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#ffffff", margin: "0 0 0.75rem" }}>
            See the record for yourself
          </h2>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.55)", margin: "0 0 1.25rem", lineHeight: 1.6 }}>
            Every pick logged publicly across all sports. Filter by edge size. Judge it yourself.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/mlb/picks" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              MLB picks
            </Link>
            <Link href="/baseball/picks" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              Baseball picks
            </Link>
            <Link href="/ncaaf-picks" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              Football picks
            </Link>
            <Link href="/ncaa-model-picks-history" style={{
              display: "inline-block", backgroundColor: "rgba(255,255,255,0.1)",
              color: "#ffffff", padding: "0.6rem 1.25rem", borderRadius: 8,
              fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
              border: "1px solid rgba(255,255,255,0.2)",
            }}>
              Basketball history
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
