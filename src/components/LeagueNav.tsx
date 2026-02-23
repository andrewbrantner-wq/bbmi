"use client";

import React, { useState } from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import BestPlaysCard from "@/components/BestPlaysCard";

type NcaaStats = {
  allGames: { total: number; winPct: string; roi: string };
  highEdge: { total: number; winPct: string };
};
type WIAAStats = { total: number; correct: number; winPct: string };
type Game = {
  date: string; away: string; home: string;
  vegasHomeLine: number; bbmiHomeLine: number; bbmiWinProb: number;
  actualAwayScore: number | null; actualHomeScore: number | null;
  fakeBet: number; fakeWin: number; vegaswinprob: number;
};
type GameWithEdge = Game & { edge: number; awayRank: number | null; homeRank: number | null };

const CARD_BG = "#f5f5f4";
const CARD_BORDER = "#e2e0de";
const CARD_SHADOW = "0 2px 6px rgba(0,0,0,0.07)";
const CARD_HEIGHT = 210;

// ------------------------------------------------------------
// STANDARD HOME CARD
// ------------------------------------------------------------

function HomeCard({ title, href, description, logoLeague }: {
  title: string; href: string; description: string; logoLeague: "ncaa" | "wiaa";
}) {
  return (
    <Link href={href} className="block w-full" style={{ cursor: "pointer" }}>
      <div
        style={{
          minHeight: CARD_HEIGHT, boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "1rem", textAlign: "center",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e0de",
          borderBottom: "3px solid #0a1a2f",
          borderRadius: 10, boxShadow: "0 2px 6px rgba(0,0,0,0.07)",
          transition: "box-shadow 0.18s, transform 0.18s, border-bottom-color 0.18s",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = "0 6px 20px rgba(10,26,47,0.15)";
          el.style.transform = "translateY(-2px)";
          el.style.borderBottomColor = "#facc15";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.07)";
          el.style.transform = "translateY(0)";
          el.style.borderBottomColor = "#0a1a2f";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%", marginBottom: 8 }}>
          <div style={{ flexShrink: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogoBadge league={logoLeague} size={32} alt={`${logoLeague.toUpperCase()} logo`} />
          </div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.2, color: "#0a1a2f" }}>{title}</h2>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#57534e", marginBottom: 10, lineHeight: 1.5 }}>{description}</p>
        <span style={{
          fontSize: "0.75rem", color: "#ffffff", fontWeight: 700,
          background: "linear-gradient(135deg, #0a1a2f, #0d2440)",
          borderRadius: 5, padding: "3px 10px", letterSpacing: "0.03em",
        }}>
          Open →
        </span>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------
// STAT CARD GRID
// ------------------------------------------------------------

function StatCardGrid({ cards }: { cards: { value: string; label: string; sub: string; color: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "1rem 0.75rem",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: "#facc15", marginBottom: 3 }}>{card.value}</div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#ffffff", marginBottom: 4 }}>{card.label}</div>
          <div style={{ fontSize: "0.63rem", color: "#94a3b8", lineHeight: 1.35 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// NAV CARD GRID
// ------------------------------------------------------------

function NavCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .nav-card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 2.5rem; }
        @media (min-width: 640px) {
          .nav-card-grid { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
        }
      `}</style>
      <div className="nav-card-grid">{children}</div>
    </>
  );
}

// ------------------------------------------------------------
// FREE PREVIEW BADGE
// ------------------------------------------------------------

function FreePreviewBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "0.4rem",
      backgroundColor: "#f0fdf4", border: "1px solid #86efac",
      borderRadius: 999, padding: "0.25rem 0.75rem",
      fontSize: "0.72rem", fontWeight: 600, color: "#15803d",
      marginBottom: "0.5rem",
    }}>
      <span style={{ fontSize: "0.8rem" }}>✓</span>
      Free preview — subscribers see all picks with full edge analysis
    </div>
  );
}

// ------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------

export default function LeagueNav({
  stats, wiaaStats, topPlays, historicalWinPct, historicalWins, historicalTotal,
}: {
  stats: NcaaStats;
  wiaaStats: WIAAStats;
  topPlays: GameWithEdge[];
  historicalWinPct: string;
  historicalWins: number;
  historicalTotal: number;
}) {
  const [league, setLeague] = useState<"ncaa" | "wiaa">("ncaa");

  const ncaaCards = [
    { value: `${stats.allGames.winPct}%`, label: "Beat Vegas", sub: `Across ${stats.allGames.total.toLocaleString()} picks`, color: "#16a34a" },
    { value: `${stats.allGames.roi}%`, label: "ROI", sub: "Flat $100/game — not cherry-picked", color: "#16a34a" },
    { value: stats.allGames.total.toLocaleString(), label: "Tracked", sub: "Public log. No retroactive edits.", color: "#0a1a2f" },
  ];

  const wiaaCards = [
    { value: `${wiaaStats.winPct}%`, label: "Winner Accuracy", sub: `${wiaaStats.correct.toLocaleString()} of ${wiaaStats.total.toLocaleString()} picks`, color: "#16a34a" },
    { value: wiaaStats.total.toLocaleString(), label: "Games Tracked", sub: "All completed WIAA games", color: "#0a1a2f" },
    { value: "~65%", label: "Vegas Benchmark", sub: "BBMI runs 16+ pts ahead", color: "#16a34a" },
  ];

  return (
    <div className="mb-4">
      {/* ── TOGGLE ── */}
      <div className="flex justify-center mb-6">
        <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #d6d3d1", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <button
            onClick={() => setLeague("ncaa")}
            style={{ padding: "10px 28px", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", border: "none", cursor: "pointer", backgroundColor: league === "ncaa" ? "#0a1a2f" : "#f5f5f4", color: league === "ncaa" ? "#ffffff" : "#78716c", transition: "all 0.15s" }}
          >
            🏀 NCAA
          </button>
          <button
            onClick={() => setLeague("wiaa")}
            style={{ padding: "10px 28px", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", border: "none", borderLeft: "1px solid #d6d3d1", cursor: "pointer", backgroundColor: league === "wiaa" ? "#0a1a2f" : "#f5f5f4", color: league === "wiaa" ? "#ffffff" : "#78716c", transition: "all 0.15s" }}
          >
            🏫 WIAA
          </button>
        </div>
      </div>

      {/* ── NCAA TAB ── */}
      {league === "ncaa" && (
        <>
          {/* Info banner */}
          <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "#0369a1" }}>
              👋 <strong>New here?</strong> BBMI is a data-driven basketball model — transparent, documented, and independently tracked. See how it works before you subscribe.
            </span>
            <Link href="/about" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", textDecoration: "underline" }}>
              How it works →
            </Link>
          </div>

          <StatCardGrid cards={ncaaCards} />

          <NavCardGrid>
            {/* Today's Picks — same style as all other cards */}
            <HomeCard
              title="Today's Picks"
              href="/ncaa-todays-picks"
              description={`Daily game picks with BBMI vs Vegas line comparison and win probabilities. ${stats.highEdge.winPct}% win rate on high-edge plays.`}
              logoLeague="ncaa"
            />
            <HomeCard title="Team Rankings" href="/ncaa-rankings" description="Model-driven team ratings and efficiency metrics." logoLeague="ncaa" />
            <HomeCard title="Picks Model Accuracy" href="/ncaa-model-picks-history" description="Historical ROI and BBMI vs Vegas lines tracking." logoLeague="ncaa" />
            <HomeCard title="BBMI vs Vegas: Winner Accuracy" href="/ncaa-model-vs-vegas" description="Head-to-head comparison of BBMI and Vegas outright winner prediction accuracy." logoLeague="ncaa" />
            <HomeCard title="Bracket Pulse" href="/ncaa-bracket-pulse" description="Live March Madness tournament seeding projections and performance probabilities." logoLeague="ncaa" />
          </NavCardGrid>

          {/* Today's Top Plays */}
          {topPlays.length > 0 && (
            <div id="top-plays" className="mb-10" style={{ scrollMarginTop: "80px" }}>
              <h3 className="text-xl font-bold mb-2 text-stone-800 text-center">Today&apos;s Top Plays</h3>
              <div className="flex justify-center mb-4">
                <FreePreviewBadge />
              </div>
              <BestPlaysCard
                topPlays={topPlays}
                historicalWinPct={historicalWinPct}
                historicalWins={historicalWins}
                historicalTotal={historicalTotal}
              />
              <p style={{ textAlign: "center", fontSize: "0.75rem", color: "#78716c", marginTop: "0.75rem" }}>
                Showing highest-edge game only.{" "}
                <Link href="/ncaa-todays-picks" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}>
                  Subscribe to see all picks →
                </Link>
              </p>
            </div>
          )}
        </>
      )}

      {/* ── WIAA TAB ── */}
      {league === "wiaa" && (
        <>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "#15803d" }}>
              🏫 <strong>WIAA Basketball</strong> — BBMI correctly predicts WIAA winners <strong>{wiaaStats.winPct}%</strong> of the time across {wiaaStats.total.toLocaleString()}+ games. Vegas predicts NCAA winners ~65%.
            </span>
            <Link href="/wiaa-model-accuracy" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#15803d", whiteSpace: "nowrap", textDecoration: "underline" }}>
              See full accuracy breakdown →
            </Link>
          </div>

          <StatCardGrid cards={wiaaCards} />

          <NavCardGrid>
            <HomeCard title="Team Rankings by Division" href="/wiaa-rankings" description="Model-driven team ratings and efficiency metrics." logoLeague="wiaa" />
            <HomeCard title="Today's Picks" href="/wiaa-todays-picks" description="Today's games and win probabilities." logoLeague="wiaa" />
            <HomeCard title="Bracket Pulse" href="/wiaa-bracket-pulse" description="Live WIAA tournament seeding projections and performance probabilities." logoLeague="wiaa" />
            <HomeCard title="WIAA Winner Accuracy" href="/wiaa-model-accuracy" description="How often BBMI correctly predicts WIAA winners — overall, by confidence band, and by division." logoLeague="wiaa" />
            <HomeCard title="Line Accuracy" href="/wiaa-line-accuracy" description="How close BBMI's predicted spreads are to actual margins." logoLeague="wiaa" />
            <HomeCard title="Boys Varsity Teams" href="/wiaa-teams" description="Team Pages detailing schedule, lines, and win probabilities." logoLeague="wiaa" />
          </NavCardGrid>
        </>
      )}
    </div>
  );
}
