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

const CARD_HEIGHT = 210;

function HomeCard({ title, href, description, logoLeague }: {
  title: string; href: string; description: string; logoLeague: "ncaa" | "wiaa";
}) {
  return (
    <Link href={href} className="block w-full">
      <div className="card rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
        style={{ minHeight: CARD_HEIGHT, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
        <div className="flex items-center gap-2 justify-center w-full mb-2">
          <div className="flex-none w-7 h-7 flex items-center justify-center">
            <LogoBadge league={logoLeague} size={32} alt={`${logoLeague.toUpperCase()} logo`} />
          </div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.2 }}>{title}</h2>
        </div>
        <p className="text-stone-600 line-clamp-3 mb-2" style={{ fontSize: "0.78rem" }}>{description}</p>
        <span style={{ fontSize: "0.82rem" }} className="text-blue-600 font-medium">Open →</span>
      </div>
    </Link>
  );
}

function PremiumHomeCard({ title, href, description, logoLeague, allGamesWinPct, highEdgeWinPct, stats }: {
  title: string; href: string; description: string; logoLeague: "ncaa" | "wiaa";
  allGamesWinPct: string; highEdgeWinPct: string; stats: NcaaStats;
}) {
  return (
    <Link href={href} className="block w-full">
      <div className="rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
        style={{ minHeight: CARD_HEIGHT, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0.75rem 1rem", textAlign: "center", background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)", border: "2px solid #3a6ea8" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
          <div style={{ backgroundColor: "#f59e0b", color: "#1a1a1a", fontSize: "0.58rem", fontWeight: 800, padding: "2px 7px", borderRadius: 999, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            🔒 PREMIUM
          </div>
          <span style={{ fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600, whiteSpace: "nowrap" }}>$15 trial · $49/mo</span>
        </div>
        <div className="flex items-center gap-2 justify-center w-full mb-1">
          <div className="flex-none w-6 h-6 flex items-center justify-center">
            <LogoBadge league={logoLeague} size={28} alt={`${logoLeague.toUpperCase()} logo`} />
          </div>
          <h2 style={{ fontSize: "0.9rem", fontWeight: 700, lineHeight: 1.2, color: "#ffffff" }}>{title}</h2>
        </div>
        <p style={{ fontSize: "0.73rem", color: "#94a3b8", marginBottom: "0.5rem", lineHeight: 1.3 }}>{description}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", width: "100%", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 6, padding: "0.4rem 0.5rem", marginBottom: "0.4rem" }}>
          <div style={{ display: "flex", justifyContent: "space-around", gap: "0.5rem" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>{allGamesWinPct}%</div>
              <div style={{ fontSize: "0.58rem", color: "#94a3b8", marginTop: 2, lineHeight: 1.2 }}>All games<br />({stats.allGames.total.toLocaleString()} tracked)</div>
            </div>
            <div style={{ width: 1, backgroundColor: "rgba(255,255,255,0.15)" }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
              <div style={{ fontSize: "0.58rem", color: "#94a3b8", marginTop: 2, lineHeight: 1.2 }}>High edge<br />(≥8 pts)</div>
            </div>
          </div>
        </div>
        <span style={{ fontSize: "0.82rem", color: "#60a5fa", fontWeight: 600 }}>Open →</span>
      </div>
    </Link>
  );
}

function StatCardGrid({ cards }: { cards: { value: string; label: string; sub: string; color: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
      {cards.map((card) => (
        <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, padding: "1rem 0.75rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: card.color, marginBottom: 3 }}>{card.value}</div>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", marginBottom: 4 }}>{card.label}</div>
          <div style={{ fontSize: "0.63rem", color: "#78716c", lineHeight: 1.35 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

function NavCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .nav-card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 2.5rem; }
        .nav-card-grid .premium-card-wrapper { grid-column: 1 / -1; }
        @media (min-width: 640px) {
          .nav-card-grid { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
          .nav-card-grid .premium-card-wrapper { grid-column: auto; }
        }
      `}</style>
      <div className="nav-card-grid">{children}</div>
    </>
  );
}

// ------------------------------------------------------------
// FREE PREVIEW LABEL for Today's Top Plays
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

export default function LeagueNav({
  stats, wiaaStats, topPlays, historicalWinPct,
}: {
  stats: NcaaStats; wiaaStats: WIAAStats; topPlays: GameWithEdge[]; historicalWinPct: string;
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
      {/* Toggle */}
      <div className="flex justify-center mb-6">
        <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #d6d3d1", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <button onClick={() => setLeague("ncaa")} style={{ padding: "10px 28px", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", border: "none", cursor: "pointer", backgroundColor: league === "ncaa" ? "#0a1a2f" : "#f5f5f4", color: league === "ncaa" ? "#ffffff" : "#78716c", transition: "all 0.15s" }}>
            🏀 NCAA
          </button>
          <button onClick={() => setLeague("wiaa")} style={{ padding: "10px 28px", fontWeight: 700, fontSize: 14, letterSpacing: "0.03em", border: "none", borderLeft: "1px solid #d6d3d1", cursor: "pointer", backgroundColor: league === "wiaa" ? "#0a1a2f" : "#f5f5f4", color: league === "wiaa" ? "#ffffff" : "#78716c", transition: "all 0.15s" }}>
            🏫 WIAA
          </button>
        </div>
      </div>

      {/* ── NCAA TAB ── */}
      {league === "ncaa" && (
        <>
          {/* Consolidated banner — no duplicate stat mention */}
          <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.82rem", color: "#0369a1" }}>
              👋 <strong>New here?</strong> BBMI is an actuarial-grade basketball model — transparent, documented, and independently tracked. See how it works before you subscribe.
            </span>
            <Link href="/about" style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", textDecoration: "underline" }}>
              How it works →
            </Link>
          </div>

          <StatCardGrid cards={ncaaCards} />

          {/* NCAA nav cards — Today's Picks FIRST */}
          <NavCardGrid>
            <div className="premium-card-wrapper">
              <PremiumHomeCard
                title="Today's Picks"
                href="/ncaa-todays-picks"
                description="Daily recommended plays based on model edges."
                logoLeague="ncaa"
                allGamesWinPct={stats.allGames.winPct}
                highEdgeWinPct={stats.highEdge.winPct}
                stats={stats}
              />
            </div>
            <HomeCard title="Team Rankings" href="/ncaa-rankings" description="Model-driven team ratings and efficiency metrics." logoLeague="ncaa" />
            <HomeCard title="Picks Model Accuracy" href="/ncaa-model-picks-history" description="Historical ROI and BBMI vs Vegas lines tracking." logoLeague="ncaa" />
            <HomeCard title="BBMI vs Vegas: Winner Accuracy" href="/ncaa-model-vs-vegas" description="Head-to-head comparison of BBMI and Vegas outright winner prediction accuracy." logoLeague="ncaa" />
            <HomeCard title="Bracket Pulse" href="/ncaa-bracket-pulse" description="Live March Madness tournament seeding projections and performance probabilities." logoLeague="ncaa" />
          </NavCardGrid>

          {/* Today's Top Plays — with free preview label */}
          {topPlays.length > 0 && (
            <div id="top-plays" className="mb-10" style={{ scrollMarginTop: "80px" }}>
              <h3 className="text-xl font-bold mb-2 text-stone-800 text-center">Today&apos;s Top Plays</h3>
              <div className="flex justify-center mb-4">
                <FreePreviewBadge />
              </div>
              <BestPlaysCard topPlays={topPlays} historicalWinPct={historicalWinPct} />
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
