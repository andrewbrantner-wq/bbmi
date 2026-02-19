"use client";

import React, { useState } from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import BestPlaysCard from "@/components/BestPlaysCard";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type NcaaStats = {
  allGames: { total: number; winPct: string; roi: string };
  highEdge: { total: number; winPct: string };
};

type WIAAStats = {
  total: number;
  correct: number;
  winPct: string;
};

type TopPlay = {
  away: string; home: string;
  vegasHomeLine: number; bbmiHomeLine: number;
  edge: number; awayRank: number | null; homeRank: number | null;
  [key: string]: any;
};

// ------------------------------------------------------------
// CARD COMPONENTS
// ------------------------------------------------------------

const CARD_HEIGHT = 220;

function HomeCard({ title, href, description, logoLeague }: {
  title: string; href: string; description: string; logoLeague: "ncaa" | "wiaa";
}) {
  return (
    <Link href={href} className="block w-full">
      <div
        className="card rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
        style={{ height: CARD_HEIGHT, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.25rem", textAlign: "center" }}
      >
        <div className="flex items-center gap-2 justify-center w-full mb-2">
          <div className="flex-none w-7 h-7 flex items-center justify-center">
            <LogoBadge league={logoLeague} size={36} alt={`${logoLeague.toUpperCase()} logo`} />
          </div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2 }}>{title}</h2>
        </div>
        <p className="text-stone-600 text-sm line-clamp-2 mb-2">{description}</p>
        <span className="text-sm text-blue-600 font-medium">Open →</span>
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
      <div
        className="rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02]"
        style={{ height: CARD_HEIGHT, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem 1.25rem 1.25rem", textAlign: "center", background: "linear-gradient(135deg, #0a1a2f 0%, #1e3a5f 100%)", border: "2px solid #3a6ea8" }}
      >
        {/* Premium badge — inline, not absolute */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem", alignSelf: "flex-end" }}>
          <span style={{ fontSize: "0.72rem", color: "#fcd34d", fontWeight: 600 }}>$15 trial · $49/mo</span>
          <div style={{ backgroundColor: "#f59e0b", color: "#1a1a1a", fontSize: "0.6rem", fontWeight: 800, padding: "2px 8px", borderRadius: 999, letterSpacing: "0.08em" }}>
            PREMIUM
          </div>
        </div>
        <div className="flex items-center gap-2 justify-center w-full mb-1">
          <div className="flex-none w-7 h-7 flex items-center justify-center">
            <LogoBadge league={logoLeague} size={36} alt={`${logoLeague.toUpperCase()} logo`} />
          </div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.2, color: "#ffffff" }}>{title}</h2>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.4rem", lineHeight: 1.3 }}>{description}</p>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.4rem", fontSize: "0.75rem" }}>
          <span style={{ color: "#94a3b8" }}>All games: <strong style={{ color: "#4ade80" }}>{allGamesWinPct}%</strong></span>
          <span style={{ color: "#94a3b8" }}>High edge: <strong style={{ color: "#4ade80" }}>{highEdgeWinPct}%</strong></span>
        </div>
        <span style={{ fontSize: "0.85rem", color: "#60a5fa", fontWeight: 600 }}>Open →</span>
      </div>
    </Link>
  );
}

// ------------------------------------------------------------
// STAT CARD GRID
// ------------------------------------------------------------

function StatCardGrid({ cards }: { cards: { value: string; label: string; sub: string; color: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
      {cards.map((card) => (
        <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, padding: "1.25rem 1rem", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: "2rem", fontWeight: 800, lineHeight: 1, color: card.color, marginBottom: 4 }}>{card.value}</div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#0a1a2f", marginBottom: 6 }}>{card.label}</div>
          <div style={{ fontSize: "0.72rem", color: "#78716c", lineHeight: 1.4 }}>{card.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// LEAGUE NAV
// ------------------------------------------------------------

export default function LeagueNav({
  stats, wiaaStats, topPlays, historicalWinPct,
}: {
  stats: NcaaStats;
  wiaaStats: WIAAStats;
  topPlays: TopPlay[];
  historicalWinPct: string;
}) {
  const [league, setLeague] = useState<"ncaa" | "wiaa">("ncaa");

  const ncaaCards = [
    { value: `${stats.allGames.winPct}%`, label: "Beat Vegas", sub: `Documented across ${stats.allGames.total.toLocaleString()} tracked picks`, color: "#16a34a" },
    { value: `${stats.allGames.roi}%`, label: "ROI", sub: "Flat $100/game model — not cherry-picked", color: "#16a34a" },
    { value: stats.allGames.total.toLocaleString(), label: "Games Tracked", sub: "Every result logged publicly. No retroactive edits.", color: "#0a1a2f" },
  ];

  const wiaaCards = [
    { value: `${wiaaStats.winPct}%`, label: "Winner Accuracy", sub: `${wiaaStats.correct.toLocaleString()} correct of ${wiaaStats.total.toLocaleString()} predictions`, color: "#16a34a" },
    { value: wiaaStats.total.toLocaleString(), label: "Games Tracked", sub: "All completed WIAA games this season", color: "#0a1a2f" },
    { value: "~65%", label: "Vegas NCAA Benchmark", sub: "BBMI's WIAA accuracy runs 16+ points ahead", color: "#16a34a" },
  ];

  return (
    <div className="mb-4">
      {/* Toggle */}
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
          {/* NCAA banner */}
          <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "0.75rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.875rem", color: "#0369a1" }}>
              👋 <strong>New to BBMI?</strong> Our model has documented <strong>59%+ picks beating Vegas</strong> over 1,500+ games.
            </span>
            <Link href="/about" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0369a1", whiteSpace: "nowrap", textDecoration: "underline" }}>
              Here's how it works →
            </Link>
          </div>

          {/* NCAA stat cards */}
          <StatCardGrid cards={ncaaCards} />

          {/* NCAA nav cards */}
          <div className="mb-10" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
            <HomeCard title="Team Rankings" href="/ncaa-rankings" description="Model-driven team ratings and efficiency metrics." logoLeague="ncaa" />
            <PremiumHomeCard title="Today's Picks" href="/ncaa-todays-picks" description="Daily recommended plays based on model edges." logoLeague="ncaa" allGamesWinPct={stats.allGames.winPct} highEdgeWinPct={stats.highEdge.winPct} stats={stats} />
            <HomeCard title="Picks Model Accuracy" href="/ncaa-model-picks-history" description="Historical ROI and BBMI vs Vegas lines tracking." logoLeague="ncaa" />
            <HomeCard title="BBMI vs Vegas: Winner Accuracy" href="/ncaa-model-vs-vegas" description="Head-to-head comparison of BBMI and Vegas outright winner prediction accuracy." logoLeague="ncaa" />
            <HomeCard title="Bracket Pulse" href="/ncaa-bracket-pulse" description="Live March Madness tournament seeding projections and performance probabilities." logoLeague="ncaa" />
          </div>

          {/* Today's Top Plays */}
          {topPlays.length > 0 && (
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4 text-stone-800 text-center">Today&apos;s Top Plays</h3>
              <BestPlaysCard topPlays={topPlays} historicalWinPct={historicalWinPct} />
            </div>
          )}
        </>
      )}

      {/* ── WIAA TAB ── */}
      {league === "wiaa" && (
        <>
          {/* WIAA banner */}
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "0.75rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.875rem", color: "#15803d" }}>
              🏫 <strong>WIAA Basketball</strong> — BBMI correctly predicts WIAA winners <strong>{wiaaStats.winPct}%</strong> of the time across {wiaaStats.total.toLocaleString()}+ games. Vegas predicts NCAA winners ~65%.
            </span>
            <Link href="/wiaa-model-accuracy" style={{ fontSize: "0.8rem", fontWeight: 700, color: "#15803d", whiteSpace: "nowrap", textDecoration: "underline" }}>
              See full accuracy breakdown →
            </Link>
          </div>

          {/* WIAA stat cards */}
          <StatCardGrid cards={wiaaCards} />

          {/* WIAA nav cards - 2 rows of 3 */}
          <div className="mb-10" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
            <HomeCard title="Team Rankings by Division" href="/wiaa-rankings" description="Model-driven team ratings and efficiency metrics." logoLeague="wiaa" />
            <HomeCard title="Today's Picks" href="/wiaa-todays-picks" description="Today's games and win probabilities." logoLeague="wiaa" />
            <HomeCard title="Bracket Pulse" href="/wiaa-bracket-pulse" description="Live WIAA tournament seeding projections and performance probabilities." logoLeague="wiaa" />
            <HomeCard title="WIAA Winner Accuracy" href="/wiaa-model-accuracy" description="How often BBMI correctly predicts WIAA winners — overall, by confidence band, and by division." logoLeague="wiaa" />
            <HomeCard title="Line Accuracy" href="/wiaa-line-accuracy" description="How close BBMI's predicted spreads are to actual margins — with Vegas NCAA lines as a benchmark." logoLeague="wiaa" />
            <HomeCard title="Boys Varsity Teams" href="/wiaa-teams" description="Team Pages detailing schedule, lines, and win probabilities." logoLeague="wiaa" />
          </div>
        </>
      )}
    </div>
  );
}
