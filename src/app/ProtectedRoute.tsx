"use client";

import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase-config";
import gamesData from "@/data/betting-lines/games.json";

// ------------------------------------------------------------
// COMPUTE REAL STATS FROM GAMES DATA
// ------------------------------------------------------------

type RawGame = {
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  fakeBet: number;
  fakeWin: number;
  bbmiHomeLine: number | null;
  vegasHomeLine: number | null;
};

function computeStats() {
  const historical = (gamesData as RawGame[]).filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );
  const allBets = historical.filter((g) => Number(g.fakeBet || 0) > 0);
  const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const allWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";
  const allWagered = allBets.length * 100;
  const allWon = allBets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const allRoi = allWagered > 0 ? (((allWon / allWagered) * 100) - 100).toFixed(1) : "0.0";

  // High edge bucket: edge >= 6
  const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= 6);
  const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
  const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
  const highEdgeWagered = highEdge.length * 100;
  const highEdgeWon = highEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const highEdgeRoi = highEdgeWagered > 0 ? (((highEdgeWon / highEdgeWagered) * 100) - 100).toFixed(1) : "0.0";

  return {
    total: allBets.length,
    winPct: allWinPct,
    roi: allRoi,
    highEdge: {
      total: highEdge.length,
      winPct: highEdgeWinPct,
      roi: highEdgeRoi,
    },
  };
}

const STATS = computeStats();

// ------------------------------------------------------------
// FAKE TEASER DATA — realistic-looking picks for the blur preview
// ------------------------------------------------------------

const TEASER_GAMES = [
  { date: "Feb 19", away: "Duke", home: "North Carolina", vegas: "-3.5", bbmi: "-9.5", edge: "6.0", pick: "Duke", bbmiProb: "61.2%", vegasProb: "44.1%" },
  { date: "Feb 19", away: "Kansas", home: "Baylor", vegas: "-1.5", bbmi: "5.5", edge: "7.0", pick: "Kansas", bbmiProb: "54.8%", vegasProb: "47.3%" },
  { date: "Feb 19", away: "Gonzaga", home: "Saint Mary's", vegas: "-4.0", bbmi: "-12.0", edge: "8.0", pick: "Gonzaga", bbmiProb: "67.4%", vegasProb: "39.2%" },
  { date: "Feb 19", away: "Auburn", home: "Alabama", vegas: "-2.5", bbmi: "3.5", edge: "6.0", pick: "Auburn", bbmiProb: "58.1%", vegasProb: "45.8%" },
  { date: "Feb 19", away: "Houston", home: "Tennessee", vegas: "-5.5", bbmi: "-14.5", edge: "9.0", pick: "Houston", bbmiProb: "71.3%", vegasProb: "38.6%" },
  { date: "Feb 19", away: "Marquette", home: "UConn", vegas: "-6.0", bbmi: "1.0", edge: "7.0", pick: "Marquette", bbmiProb: "55.9%", vegasProb: "41.2%" },
];

// ------------------------------------------------------------
// TEASER TABLE — blurred picks preview
// ------------------------------------------------------------

function TeaserTable() {
  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.13)" }}>
      {/* Blurred table */}
      <div style={{ filter: "blur(4px)", userSelect: "none", pointerEvents: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem", backgroundColor: "#fff" }}>
          <thead>
            <tr style={{ backgroundColor: "#0a1a2f", color: "#fff" }}>
              {["Date", "Away", "Home", "Vegas Line", "BBMI Line", "Edge", "BBMI Pick", "BBMI%", "Vegas%"].map((h) => (
                <th key={h} style={{ padding: "0.5rem 0.75rem", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", textAlign: "center" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TEASER_GAMES.map((g, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", textAlign: "center", color: "#6b7280" }}>{g.date}</td>
                <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", fontWeight: 500 }}>{g.away}</td>
                <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap", fontWeight: 500 }}>{g.home}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#374151" }}>{g.vegas}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#374151" }}>{g.bbmi}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#0a1a2f" }}>{g.edge}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 700, color: "#16a34a" }}>{g.pick}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#16a34a", fontWeight: 600 }}>{g.bbmiProb}</td>
                <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", color: "#6b7280" }}>{g.vegasProb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gradient fade at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
        background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.97) 100%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ------------------------------------------------------------
// PREMIUM UPGRADE WALL — shown to logged-in non-premium users
// ------------------------------------------------------------

function PremiumUpgradeWall({ email }: { email: string | null | undefined }) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", paddingBottom: "4rem" }}>

      {/* Top banner */}
      <div style={{
        background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)",
        padding: "2rem 1rem 2.5rem",
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          backgroundColor: "#f59e0b", color: "#1a1a1a",
          borderRadius: 999, padding: "0.3rem 1rem",
          fontSize: "0.72rem", fontWeight: 800,
          letterSpacing: "0.08em", marginBottom: "1rem",
        }}>
          🔒 PREMIUM CONTENT
        </div>
        <h1 style={{ color: "#ffffff", fontSize: "1.6rem", fontWeight: 800, margin: "0 0 0.5rem", lineHeight: 1.2 }}>
          Today's BBMI Picks
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "0.88rem", margin: 0 }}>
          {TEASER_GAMES.length} games available today — subscribe to unlock full access
        </p>
      </div>

      {/* Stats strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 0, maxWidth: 600, margin: "0 auto",
        backgroundColor: "#0f2a4a", borderBottom: "3px solid #1e3a5f",
      }}>
        {[
          { value: `${STATS.winPct}%`, label: "Beat Vegas", sub: "all picks" },
          { value: `${STATS.roi}%`, label: "ROI", sub: "flat $100/game" },
          { value: STATS.total.toLocaleString(), label: "Games Tracked", sub: "public log" },
        ].map((s, i) => (
          <div key={i} style={{
            padding: "0.75rem 0.5rem", textAlign: "center",
            borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none",
          }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* HIGH EDGE HERO CALLOUT */}
      <div style={{
        maxWidth: 600, margin: "0 auto",
        backgroundColor: "#0a1a2f",
        borderBottom: "3px solid #facc15",
        padding: "1rem 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "0.75rem",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>
              {STATS.highEdge.winPct}%
            </span>
            <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
              win rate
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.4 }}>
            on the <strong style={{ color: "#facc15" }}>{STATS.highEdge.total} picks</strong> where BBMI edge ≥ 6 pts
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>
            vs {STATS.winPct}% overall
          </div>
          <div style={{
            display: "inline-block",
            backgroundColor: "#facc15", color: "#0a1a2f",
            fontSize: "0.7rem", fontWeight: 800,
            padding: "0.2rem 0.6rem", borderRadius: 999,
          }}>
            +{(Number(STATS.highEdge.winPct) - Number(STATS.winPct)).toFixed(1)}pts better
          </div>
          <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            {STATS.highEdge.roi}% ROI on high-edge picks
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1rem 0" }}>

        {/* Blurred table preview */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem",
          }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>
              Today's Picks Preview
            </h2>
            <span style={{
              fontSize: "0.7rem", backgroundColor: "#fef3c7",
              border: "1px solid #f59e0b", borderRadius: 999,
              padding: "0.2rem 0.6rem", color: "#92400e", fontWeight: 600,
            }}>
              Subscribe to unlock full table
            </span>
          </div>
          <TeaserTable />
        </div>

        {/* Pricing cards */}
        <div style={{
          backgroundColor: "#ffffff", borderRadius: 14,
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          padding: "1.75rem 1.5rem",
          textAlign: "center",
        }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.35rem" }}>
            Unlock Full Access
          </h3>
          <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: "0 0 1.5rem" }}>
            Get every pick, edge score, and win probability — updated daily
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1.25rem",
          }}>
            {/* 7-day trial */}
            <div style={{
              border: "2px solid #16a34a", borderRadius: 12,
              padding: "1.25rem 1rem", backgroundColor: "#f0fdf4",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#15803d", marginBottom: "0.4rem" }}>
                Try it first
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$15</div>
              <div style={{ fontSize: "0.8rem", color: "#166534", margin: "0.35rem 0 0.2rem", fontWeight: 600 }}>7-Day Trial</div>
              <div style={{ fontSize: "0.7rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.6rem", marginBottom: "1rem", fontWeight: 600 }}>
                One-time · No auto-renewal
              </div>
              <a
                href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02"
                style={{
                  display: "block", width: "100%", boxSizing: "border-box",
                  backgroundColor: "#16a34a", color: "#ffffff",
                  padding: "0.65rem 1rem", borderRadius: 8,
                  fontWeight: 700, fontSize: "0.85rem",
                  textDecoration: "none", textAlign: "center",
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#15803d"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "#16a34a"; }}
              >
                Try 7 Days →
              </a>
            </div>

            {/* Monthly */}
            <div style={{
              border: "2px solid #2563eb", borderRadius: 12,
              padding: "1.25rem 1rem", backgroundColor: "#eff6ff",
              display: "flex", flexDirection: "column", alignItems: "center",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -12,
                backgroundColor: "#2563eb", color: "#ffffff",
                fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.08em",
                padding: "0.2rem 0.75rem", borderRadius: 999,
                textTransform: "uppercase",
              }}>
                Most Popular
              </div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8", marginBottom: "0.4rem" }}>
                Full access
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$49</div>
              <div style={{ fontSize: "0.8rem", color: "#1e40af", margin: "0.35rem 0 0.2rem", fontWeight: 600 }}>Per Month</div>
              <div style={{ fontSize: "0.7rem", color: "#3b82f6", backgroundColor: "#dbeafe", borderRadius: 999, padding: "0.15rem 0.6rem", marginBottom: "1rem", fontWeight: 600 }}>
                Auto-renews · Cancel anytime
              </div>
              <a
                href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01"
                style={{
                  display: "block", width: "100%", boxSizing: "border-box",
                  background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)",
                  color: "#ffffff",
                  padding: "0.65rem 1rem", borderRadius: 8,
                  fontWeight: 700, fontSize: "0.85rem",
                  textDecoration: "none", textAlign: "center",
                  boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                Subscribe Now →
              </a>
            </div>
          </div>

          {/* High edge callout inside card */}
          <div style={{
            backgroundColor: "#fffbeb", border: "1px solid #fcd34d",
            borderRadius: 8, padding: "0.75rem 1rem",
            marginBottom: "1rem", textAlign: "center",
          }}>
            <span style={{ fontSize: "0.8rem", color: "#92400e", fontWeight: 700 }}>
              🎯 Subscribers who focus on <strong>edge ≥ 6 picks</strong> have seen{" "}
              <span style={{ color: "#d97706" }}>{STATS.highEdge.winPct}% wins</span>{" "}
              across {STATS.highEdge.total} documented games — vs {STATS.winPct}% overall
            </span>
          </div>

          {/* Trust signals */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "1.5rem",
            flexWrap: "wrap", marginBottom: "1rem",
          }}>
            {["✓ Every pick logged publicly", "✓ No retroactive edits", "✓ Actuarial-grade model"].map((s) => (
              <span key={s} style={{ fontSize: "0.72rem", color: "#16a34a", fontWeight: 600 }}>{s}</span>
            ))}
          </div>

          <p style={{ fontSize: "0.72rem", color: "#9ca3af", margin: "0.5rem 0 0" }}>
            Logged in as <strong>{email}</strong> · Account activated within 24 hours of subscribing
          </p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// PROTECTED ROUTE
// ------------------------------------------------------------

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [user, loading, router]);

  useEffect(() => {
    async function checkPremiumStatus() {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          console.log("User doc exists:", userDoc.exists());
          console.log("User data:", userDoc.data());
          console.log("Premium value:", userDoc.data()?.premium);
          console.log("Premium type:", typeof userDoc.data()?.premium);
          setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
        } catch (error) {
          console.error("Error checking premium status:", error);
          setIsPremium(false);
        }
      }
      setCheckingPremium(false);
    }
    if (user) checkPremiumStatus();
  }, [user]);

  // Loading
  if (loading || checkingPremium) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0a1a2f 0%, #1e293b 100%)",
      }}>
        <div style={{ color: "white", fontSize: "1.25rem" }}>Loading...</div>
      </div>
    );
  }

  // Not logged in
  if (!user) return null;

  // Logged in but not premium — show teaser
  if (isPremium === false) {
    return <PremiumUpgradeWall email={user.email} />;
  }

  // Premium — show content
  return <>{children}</>;
}
