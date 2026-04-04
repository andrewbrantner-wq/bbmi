"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import mlbGames from "@/data/betting-lines/mlb-games.json";
import ncaaGames from "@/data/betting-lines/games.json";
import baseballGames from "@/data/betting-lines/baseball-games.json";

// ── Types ──
type MLBGame = { date: string; homeTeam: string; awayTeam: string; bbmiTotal?: number | null; vegasTotal?: number | null; bbmiMargin?: number | null; vegasRunLine?: number | null; ouPick?: string | null; rlPick?: string | null; rlConfidenceTier?: number; gameTimeUTC?: string; ouEdge?: number | null; };
type NcaaGame = { date: string; home: string | number | null; away: string | number | null; bbmiHomeLine?: number | null; vegasHomeLine?: number | null; neutralSite?: boolean; };
type BaseballGame = { date: string; homeTeam: string; awayTeam: string; bbmiTotal?: number | null; vegasTotal?: number | null; bbmiLine?: number | null; vegasLine?: number | null; ouPick?: string | null; };

// ── Design tokens (from spec) ──
const C = {
  bg: "#f0efe9",
  surface: "#eae9e5",
  card: "#ffffff",
  border: "rgba(0,0,0,0.08)",
  textPrimary: "#1a1a1a",
  textSecondary: "#888888",
  textMuted: "#aaaaaa",
  accent: "#3b5bdb",
  mlb: "#2d6a4f",
  bball: "#4a6fa5",
  football: "#b5541a",
  baseball: "#2a7a72",
  wiaa: "#6b4fa5",
};

// ── Helpers ──
function getTodayCT() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

function formatTime(utc: string) {
  try {
    return new Date(utc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

// ── Stat Cell ──
function StatCell({ value, label, color, isLast }: { value: string; label: string; color: string; isLast?: boolean }) {
  return (
    <div style={{
      padding: "12px 32px", textAlign: "center",
      borderRight: isLast ? "none" : `0.5px solid ${C.border}`,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 17, fontWeight: 500, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ── Pick Card ──
function PickCard({ sportColor, sportLabel, pickType, matchup, detail, edge, edgeMax, isFree, href, leftLogo, rightLogo }: {
  sportColor: string; sportLabel: string; pickType: string; matchup: string; detail?: string;
  edge: number; edgeMax?: number; isFree: boolean; href: string; leftLogo: React.ReactNode; rightLogo: React.ReactNode;
}) {
  const edgePct = Math.min(edge / (edgeMax ?? 8), 1);
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      <div style={{
        backgroundColor: C.card, border: `0.5px solid ${C.border}`, borderRadius: 10,
        padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between",
        width: "100%", height: "100%", boxSizing: "border-box", transition: "border-color 0.15s",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: sportColor, display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary }}>{sportLabel}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 500, color: C.textMuted }}>{pickType}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {leftLogo}
              <span style={{ fontSize: 10, color: C.textMuted }}>@</span>
              {rightLogo}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textPrimary, lineHeight: 1.3 }}>{matchup}</div>
              {detail && <div style={{ fontSize: 11, color: "#bbbbbb", lineHeight: 1.3 }}>{detail}</div>}
            </div>
          </div>
        </div>
        <div style={{ borderTop: `0.5px solid ${C.border}`, paddingTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 3, backgroundColor: "#eeeeee", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${edgePct * 100}%`, backgroundColor: sportColor, borderRadius: 2 }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: sportColor, flexShrink: 0 }}>+{edge.toFixed(1)}</span>
          <span style={{
            fontSize: 10, fontWeight: 500, borderRadius: 4, padding: "2px 6px", flexShrink: 0,
            color: isFree ? C.mlb : C.accent,
            backgroundColor: isFree ? "rgba(45,106,79,0.08)" : "rgba(59,91,219,0.08)",
          }}>{isFree ? "Free" : "Premium"}</span>
        </div>
      </div>
    </Link>
  );
}

// ── Main ──
export default function HomePageClient() {
  const today = getTodayCT();

  const featuredPicks = useMemo(() => {
    const picks: { sportColor: string; sportLabel: string; pickType: string; matchup: string; detail?: string; edge: number; edgeMax?: number; isFree: boolean; href: string; leftLogo: React.ReactNode; rightLogo: React.ReactNode }[] = [];

    // MLB picks
    (mlbGames as MLBGame[]).filter(g => g.date === today).forEach(g => {
      if (g.rlPick && g.bbmiMargin != null) {
        picks.push({
          sportColor: C.mlb, sportLabel: "MLB", pickType: "Run Line",
          matchup: g.rlPick, detail: g.gameTimeUTC ? formatTime(g.gameTimeUTC) : "",
          edge: Math.abs(g.bbmiMargin), edgeMax: 1.0, isFree: Math.abs(g.bbmiMargin) < 0.25,
          href: "/mlb/picks",
          leftLogo: <MLBLogo teamName={g.awayTeam} size={24} />,
          rightLogo: <MLBLogo teamName={g.homeTeam} size={24} />,
        });
      }
      if (g.ouPick === "UNDER" && g.ouEdge != null) {
        picks.push({
          sportColor: C.mlb, sportLabel: "MLB", pickType: "Under",
          matchup: `${g.awayTeam.split(" ").pop()} / ${g.homeTeam.split(" ").pop()} U${g.vegasTotal}`,
          detail: g.gameTimeUTC ? formatTime(g.gameTimeUTC) : "",
          edge: Math.abs(g.ouEdge), edgeMax: 3.0, isFree: Math.abs(g.ouEdge) < 1.25,
          href: "/mlb/picks?mode=ou",
          leftLogo: <MLBLogo teamName={g.awayTeam} size={24} />,
          rightLogo: <MLBLogo teamName={g.homeTeam} size={24} />,
        });
      }
    });

    // NCAA Basketball picks
    (ncaaGames as NcaaGame[]).filter(g => g.date === today).forEach(g => {
      const home = String(g.home ?? "");
      const away = String(g.away ?? "");
      if (!g.vegasHomeLine || !g.bbmiHomeLine) return;
      const edge = Math.abs(g.bbmiHomeLine - g.vegasHomeLine);
      if (edge < 2) return;
      const pick = g.bbmiHomeLine < g.vegasHomeLine ? home : away;
      const spread = g.bbmiHomeLine < g.vegasHomeLine ? g.vegasHomeLine : -g.vegasHomeLine;
      picks.push({
        sportColor: C.bball, sportLabel: "NCAA Basketball", pickType: "Spread",
        matchup: `${pick} ${spread > 0 ? "+" : ""}${spread}`,
        detail: g.neutralSite ? "Neutral" : `vs ${g.bbmiHomeLine < g.vegasHomeLine ? away : home}`,
        edge, edgeMax: 10, isFree: edge < 6,
        href: "/ncaa-todays-picks",
        leftLogo: <NCAALogo teamName={away} size={24} />,
        rightLogo: <NCAALogo teamName={home} size={24} />,
      });
    });

    return picks.sort((a, b) => b.edge - a.edge).slice(0, 2);
  }, [today]);

  const totalPicksToday = useMemo(() => {
    let count = 0;
    (mlbGames as MLBGame[]).filter(g => g.date === today).forEach(g => {
      if (g.rlPick) count++;
      if (g.ouPick === "UNDER") count++;
    });
    (ncaaGames as NcaaGame[]).filter(g => g.date === today).forEach(g => {
      if (g.vegasHomeLine && g.bbmiHomeLine && Math.abs(g.bbmiHomeLine - g.vegasHomeLine) >= 2) count++;
    });
    (baseballGames as BaseballGame[]).filter(g => g.date === today).forEach(g => {
      if (g.ouPick) count++;
      if (g.vegasLine && g.bbmiLine && Math.abs(g.bbmiLine - g.vegasLine) >= 2) count++;
    });
    return count;
  }, [today]);

  const remainingPicks = Math.max(0, totalPicksToday - featuredPicks.length);

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>
      <div style={{ padding: "0 28px" }}>

        {/* ── HERO ── */}
        <section style={{ textAlign: "center", padding: "36px 0 28px", borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#2952cc", color: "#ffffff", borderRadius: 999,
            padding: "5px 14px", fontSize: 11, fontWeight: 500,
            marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#ffffff", display: "inline-block" }} />
            5 sports &middot; Updated daily
          </div>

          <h1 style={{
            fontSize: 32, fontWeight: 500, letterSpacing: "-0.025em",
            color: C.textPrimary, marginBottom: 10, lineHeight: 1.2,
          }}>
            We show our <span style={{ color: "#2952cc" }}>work.</span>
          </h1>

          <p style={{
            fontSize: 14, color: C.textSecondary, maxWidth: 440,
            margin: "0 auto 24px", lineHeight: 1.6,
          }}>
            Independent game lines built by a risk manager.
            Every pick logged before tip-off, tracked publicly, never edited.
          </p>

          {/* ── STAT STRIP ── */}
          <div style={{
            display: "inline-flex", border: `0.5px solid ${C.border}`,
            borderRadius: 0, overflow: "hidden", backgroundColor: C.surface,
          }}>
            <StatCell value="58.8%" label="MLB Under" color="#1a6640" />
            <StatCell value="57.0%" label="Hoops ATS" color="#3060c0" />
            <StatCell value="56.8%" label="Football ATS" color="#a84a10" />
            <StatCell value="5,300+" label="Games validated" color="#222222" isLast />
          </div>
        </section>

        {/* ── TODAY'S FREE PICKS ── */}
        {featuredPicks.length > 0 && (
          <section style={{ marginTop: 24, paddingBottom: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary, margin: 0 }}>
                Today&apos;s free picks <span style={{ color: C.textMuted, fontWeight: 400 }}>
                  &middot; {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </h2>
              <Link href="/mlb/picks" style={{ fontSize: 12, fontWeight: 500, color: C.accent, textDecoration: "none" }}>
                See all picks &rarr;
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%", alignItems: "stretch" }}>
              {featuredPicks.map((pick, i) => (
                <PickCard key={i} {...pick} />
              ))}

              {/* Locked card */}
              <div style={{
                border: `1px dashed rgba(0,0,0,0.10)`, borderRadius: 10,
                padding: 14, backgroundColor: C.surface,
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 10,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {[C.baseball, C.football, C.wiaa].map((color, i) => (
                    <span key={i} style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: color, display: "inline-block" }} />
                  ))}
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", margin: 0 }}>
                  {remainingPicks > 0 ? `${remainingPicks} more picks today` : "More picks today"}
                </p>
                <p style={{ fontSize: 10, color: C.textMuted, margin: 0 }}>
                  NCAA Baseball &middot; Football &middot; WIAA
                </p>
                <Link href="/subscribe" style={{
                  fontSize: 11, fontWeight: 500, color: "#ffffff",
                  backgroundColor: C.accent, borderRadius: 6,
                  padding: "6px 14px", textDecoration: "none",
                }}>
                  Unlock with Pro &rarr;
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── TRUST FOOTER ── */}
        {/* ── TRUST BAR ── */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
          padding: "12px 20px",
          borderTop: "0.5px solid rgba(0,0,0,0.07)",
          backgroundColor: "#e6e4dc",
          margin: "0 -28px",
        }}>
          {[
            "Picks logged pre-game",
            "Never edited",
            "Public track record since 2024",
          ].map(t => (
            <span key={t} style={{ fontSize: 11, color: "#999999", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#1a6640" }} />
              {t}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
