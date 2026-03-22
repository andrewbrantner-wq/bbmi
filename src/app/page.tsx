export const metadata = {
  title: "BBMI – Data-Driven Sports Analytics",
  description:
    "Data-driven analytics for NCAA basketball, football, and baseball — plus WIAA high school basketball. Independent game lines, team rankings, and a fully public pick history. Analytics over instinct.",
  keywords: [
    "NCAA basketball analytics",
    "NCAA football model",
    "NCAA baseball analytics",
    "WIAA basketball predictions",
    "BBMI",
    "college sports model",
    "sports betting analytics",
  ],
  openGraph: {
    title: "BBMI – Data-Driven Sports Analytics",
    description:
      "Independent game lines for NCAA basketball, football, and baseball. Built by a risk manager, tracked publicly, never edited.",
    url: "https://bbmihoops.com",
    siteName: "BBMI",
  },
};

import React from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import SportCardGrid from "@/components/SportCardGrid";

// ------------------------------------------------------------
// SPORT CONFIGS
// ------------------------------------------------------------

const SPORTS = [
  {
    name: "Basketball",
    league: "ncaa" as const,
    subtitle: "NCAA",
    accent: "#3b82f6",
    accentBg: "rgba(59,130,246,0.12)",
    accentBorder: "rgba(59,130,246,0.25)",
    pages: [
      { label: "Today\u2019s Game Lines", href: "/ncaa-todays-picks", primary: true },
      { label: "Team Rankings", href: "/ncaa-rankings" },
      { label: "Model Accuracy", href: "/ncaa-model-picks-history" },
      { label: "BBMI vs Vegas", href: "/ncaa-model-vs-vegas" },
      { label: "Bracket Pulse", href: "/ncaa-bracket-pulse" },
      { label: "Tournament Odds", href: "/ncaa-tournament" },
      { label: "Bracket Challenge", href: "/bracket-challenge" },
    ],
  },
  {
    name: "Football",
    league: "ncaa-football" as const,
    subtitle: "NCAA",
    accent: "#16a34a",
    accentBg: "rgba(22,163,74,0.12)",
    accentBorder: "rgba(22,163,74,0.25)",
    note: "Model is currently being calibrated for the upcoming season.",
    gated: true,
    pages: [
      { label: "Today\u2019s Game Lines", href: "/ncaaf-picks", primary: true },
      { label: "Team Rankings", href: "/ncaaf-rankings" },
      { label: "Model Accuracy", href: "/ncaaf-model-accuracy" },
      { label: "BBMI vs Vegas", href: "/ncaaf-model-vs-vegas" },
    ],
  },
  {
    name: "Baseball",
    league: "ncaa-baseball" as const,
    subtitle: "NCAA",
    accent: "#dc2626",
    accentBg: "rgba(220,38,38,0.12)",
    accentBorder: "rgba(220,38,38,0.25)",
    note: "Model is currently being calibrated for the upcoming season.",
    gated: true,
    pages: [
      { label: "Today\u2019s Game Lines", href: "/baseball/picks", primary: true },
      { label: "Team Rankings", href: "/baseball/rankings" },
      { label: "Model Accuracy", href: "/baseball/accuracy" },
      { label: "BBMI vs Vegas", href: "/baseball/vs-vegas" },
      { label: "Over/Under", href: "/baseball/totals" },
    ],
  },
  {
    name: "Basketball",
    league: "wiaa" as const,
    subtitle: "WIAA",
    accent: "#f59e0b",
    accentBg: "rgba(245,158,11,0.12)",
    accentBorder: "rgba(245,158,11,0.25)",
    pages: [
      { label: "Today\u2019s Picks", href: "/wiaa-todays-picks", primary: true },
      { label: "Rankings", href: "/wiaa-rankings" },
      { label: "Bracket Pulse", href: "/wiaa-bracket-pulse" },
      { label: "Over/Under", href: "/wiaa-total-picks" },
      { label: "Winner Accuracy", href: "/wiaa-model-accuracy" },
      { label: "Line Accuracy", href: "/wiaa-line-accuracy" },
      { label: "Teams", href: "/wiaa-teams" },
    ],
  },
];

// ------------------------------------------------------------
// HOW IT WORKS
// ------------------------------------------------------------

const PILLARS = [
  {
    icon: "\u{1F4CA}",
    label: "Independent Lines",
    desc: "BBMI generates its own spread for every game — independent of Vegas. The gap between the two is the edge signal.",
  },
  {
    icon: "\u2699\uFE0F",
    label: "Sport-Specific Models",
    desc: "Basketball uses efficiency and tempo. Football uses yards per play and margin. Baseball adds pitcher adjustments and park factors.",
  },
  {
    icon: "\u{1F512}",
    label: "Full Transparency",
    desc: "Every pick published before tip-off, first pitch, or kickoff. Every result logged. No retroactive edits — ever.",
  },
];

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function HomePage() {
  return (
    <div className="section-wrapper">
      <style>{`
        .sport-link {
          display: block;
          padding: 0.55rem 0.85rem;
          font-size: 0.84rem;
          font-weight: 500;
          color: #cbd5e1;
          background-color: rgba(255,255,255,0.05);
          border-radius: 6px;
          text-decoration: none;
          transition: background-color 0.15s, color 0.15s;
        }
        .sport-link:hover {
          background-color: rgba(250,204,21,0.15);
          color: #facc15;
        }
        .sport-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .sport-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
        }
        .primary-cta {
          display: inline-block;
          padding: 0.55rem 1.2rem;
          font-size: 0.82rem;
          font-weight: 700;
          border-radius: 6px;
          text-decoration: none;
          letter-spacing: 0.02em;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .primary-cta:hover {
          transform: translateY(-1px);
        }
        .pillar-card {
          transition: transform 0.18s, box-shadow 0.18s;
        }
        .pillar-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(10,26,47,0.4);
        }
      `}</style>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── HERO ── */}
        <section style={{
          textAlign: "center",
          padding: "3rem 1rem 2.5rem",
          background: "linear-gradient(180deg, rgba(10,26,47,0.03) 0%, transparent 100%)",
          borderRadius: 16,
          marginBottom: "0.5rem",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            background: "linear-gradient(90deg, #0a1a2f, #0d2440)",
            borderRadius: 999, padding: "0.35rem 1.1rem",
            fontSize: "0.78rem", fontWeight: 700, color: "#facc15",
            marginBottom: "1.25rem", letterSpacing: "0.04em",
            boxShadow: "0 2px 8px rgba(10,26,47,0.35)",
            border: "1px solid rgba(250,204,21,0.3)",
          }}>
            Basketball &middot; Football &middot; Baseball &middot; Updated daily
          </div>

          <h1 style={{
            fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
            fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.15, marginBottom: "0.9rem", color: "#0a1a2f",
          }}>
            Data-Driven Sports Analytics<br />
            <span style={{ color: "#2563eb" }}>We Show Our Work.</span>
          </h1>

          <p style={{
            color: "#57534e", fontSize: "0.95rem", maxWidth: 560,
            margin: "0 auto 0", lineHeight: 1.65,
          }}>
            BBMI generates independent game lines, team rankings, and win probabilities
            for NCAA basketball, football, and baseball. Built by a risk manager, tracked publicly,
            never edited.
          </p>
        </section>

        {/* ── SPORT GRID ── */}
        <SportCardGrid sports={SPORTS} />

        {/* ── HOW IT WORKS ── */}
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{
            fontSize: "1.15rem", fontWeight: 700, color: "#0a1a2f",
            textAlign: "center", marginBottom: "1.25rem", letterSpacing: "-0.01em",
          }}>
            How BBMI Works
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "1rem",
          }}>
            {PILLARS.map(({ icon, label, desc }) => (
              <div key={label} className="pillar-card" style={{
                background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10, padding: "1.25rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ffffff", marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: "0.82rem", color: "#94a3b8", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── METHODOLOGY FOOTER ── */}
        <section style={{
          background: "linear-gradient(135deg, #0a1a2f 0%, #0d2440 100%)",
          borderRadius: 12, padding: "2rem 1.75rem",
          marginBottom: "2rem",
          textAlign: "center",
          border: "1px solid rgba(250,204,21,0.15)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
            About the Model
          </h3>
          <p style={{
            fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.65,
            margin: "0 auto 1rem", maxWidth: 540,
          }}>
            Built by a risk manager using professional forecasting principles — data quality,
            variable selection, calibration, and out-of-sample validation. Each sport has its own model,
            all tracked publicly from day one.
          </p>
          <Link
            href="/about"
            style={{
              display: "inline-block", padding: "0.55rem 1.3rem",
              backgroundColor: "#facc15", color: "#0a1a2f",
              borderRadius: 8, fontWeight: 800, fontSize: "0.82rem",
              textDecoration: "none", letterSpacing: "0.02em",
              boxShadow: "0 3px 10px rgba(250,204,21,0.3)",
            }}
          >
            Read the methodology &rarr;
          </Link>
        </section>

      </div>
    </div>
  );
}
