"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import NCAALogo from "@/components/NCAALogo";
import mlbGames from "@/data/betting-lines/mlb-games.json";
import ncaaGames from "@/data/betting-lines/games.json";
import baseballGames from "@/data/betting-lines/baseball-games.json";

// ── Types ──
type MLBGame = { date: string; homeTeam: string; awayTeam: string; bbmiTotal?: number | null; vegasTotal?: number | null; bbmiMargin?: number | null; vegasRunLine?: number | null; ouPick?: string | null; rlPick?: string | null; rlConfidenceTier?: number; gameTimeUTC?: string; ouEdge?: number | null; };
type NcaaGame = { date: string; home: string | number | null; away: string | number | null; bbmiHomeLine?: number | null; vegasHomeLine?: number | null; neutralSite?: boolean; };
type BaseballGame = { date: string; homeTeam: string; awayTeam: string; bbmiTotal?: number | null; vegasTotal?: number | null; bbmiLine?: number | null; vegasLine?: number | null; ouPick?: string | null; };

// ── Design tokens ──
const C = {
  bg: "#f0efe9", surface: "#eae9e5", card: "#ffffff",
  border: "rgba(0,0,0,0.08)", textPrimary: "#1a1a1a",
  textSecondary: "#888888", textMuted: "#aaaaaa", accent: "#2952cc",
  mlb: "#1a6640", bball: "#3060c0", football: "#6b7280",
  baseball: "#1a7a8a", wiaa: "#8b3a3a",
};

const SPORT_COLORS: Record<string, string> = {
  "ncaa-bball": "#3060c0", "ncaa-baseball": "#1a7a8a",
  "ncaa-football": "#6b7280", mlb: "#1a6640",
};
const SPORT_LABELS: Record<string, string> = {
  "ncaa-bball": "NCAA Basketball", "ncaa-baseball": "NCAA Baseball",
  "ncaa-football": "NCAA Football", mlb: "MLB",
};

function getTodayCT() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}
function formatTime(utc: string) {
  try { return new Date(utc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}

// ══════════════════════════════════════════════════════════════
// STAT CARD (Section 1+2 of spec)
// ══════════════════════════════════════════════════════════════
type StatCardData = {
  sportLabel: string; color: string; value: string; metric: string;
  sub: string; freePct?: string; premPct?: string; note?: string; noUpgrade?: boolean; noteOnly?: string;
};

function StatCard({ d }: { d: StatCardData }) {
  return (
    <div style={{
      background: C.card, borderRadius: 10, borderTop: `4px solid ${d.color}`,
      border: `0.5px solid ${C.border}`, borderTopWidth: 4, borderTopColor: d.color, borderTopStyle: "solid",
      padding: "15px 14px 13px", display: "flex", flexDirection: "column", justifyContent: "space-between",
      height: "100%", boxSizing: "border-box",
    }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#bbb", marginBottom: 6 }}>{d.sportLabel}</div>
        <div style={{ fontSize: 24, fontWeight: 500, color: d.color, lineHeight: 1.1 }}>{d.value}</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#444", marginTop: 4 }}>{d.metric}</div>
        <div style={{ fontSize: 10, color: "#aaa", lineHeight: 1.4, marginTop: 2, marginBottom: 10 }}>{d.sub}</div>
      </div>
      <div style={{ paddingTop: 9, borderTop: "0.5px solid rgba(0,0,0,0.07)" }}>
        {d.freePct && d.premPct && (
          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#bbb" }}>{d.freePct} free</span>
            <span style={{ fontSize: 10, color: "#ccc" }}>{"\u203A"}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: d.color }}>{d.premPct} premium</span>
          </div>
        )}
        {d.note && <div style={{ fontSize: 9, color: "#bbb", fontStyle: "italic", marginTop: 3 }}>{d.note}</div>}
        {d.noteOnly && <div style={{ fontSize: 9, color: "#aaa" }}>{d.noteOnly}</div>}
      </div>
    </div>
  );
}

const STAT_CARDS: StatCardData[] = [
  { sportLabel: "NCAA BASKETBALL", color: "#3060c0", value: "65.6%", metric: "Premium spread ATS", sub: "1,999 games · \u2212110 juice", freePct: "55.0%", premPct: "65.6%" },
  { sportLabel: "NCAA BASEBALL", color: "#1a7a8a", value: "72.2%", metric: "Premium O/U ATS", sub: "781 games · edge 4+", freePct: "57.3%", premPct: "72.2%" },
  { sportLabel: "NCAA FOOTBALL", color: "#6b7280", value: "64.5%", metric: "Premium spread ATS", sub: "714 games · \u2212110 juice", freePct: "56.6%", premPct: "64.5%" },
  { sportLabel: "MLB", color: "#1a6640", value: "72.3%", metric: "Premium run line ATS", sub: "1,897 games · walk-forward", freePct: "69.4%", premPct: "72.3%", note: "avg \u2212156 juice · away +1.5" },
  { sportLabel: "ALL SPORTS · WALK-FORWARD", color: "#555555", value: "9,200+", metric: "Games validated", sub: "NCAA basketball, baseball, football + MLB", noteOnly: "Real predictions, not retrofitted results" },
];

// ══════════════════════════════════════════════════════════════
// PICK CARD (Section 3 of spec)
// ══════════════════════════════════════════════════════════════
function PickCard({ sportColor, sportLabel, pickType, matchup, detail, edge, edgeMax, isFree, href, leftLogo, rightLogo, vegasLine, bbmiLine, pickedTeam }: {
  sportColor: string; sportLabel: string; pickType: string; matchup: string; detail?: string;
  edge: number; edgeMax?: number; isFree: boolean; href: string; leftLogo: React.ReactNode; rightLogo: React.ReactNode;
  vegasLine?: string; bbmiLine?: string; pickedTeam?: string;
}) {
  const edgePct = Math.min(edge / (edgeMax ?? 8), 1);
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}>
      <div style={{
        background: C.card, borderRadius: 10, border: `0.5px solid ${C.border}`,
        padding: "14px 15px", display: "flex", flexDirection: "column", gap: 8,
        height: "100%", boxSizing: "border-box",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: sportColor, display: "inline-block" }} />
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888" }}>{sportLabel}</span>
          </div>
          <span style={{ fontSize: 10, color: "#999", background: "#f2f1ee", padding: "2px 6px", borderRadius: 4 }}>{pickType}</span>
        </div>
        {/* Matchup */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {leftLogo}<span style={{ fontSize: 10, color: "#ccc" }}>@</span>{rightLogo}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>{matchup}</div>
            {detail && <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>{detail}</div>}
          </div>
        </div>
        {/* Lines + Pick */}
        {(vegasLine || bbmiLine || pickedTeam) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
            {vegasLine && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#aaa", fontWeight: 500 }}>Vegas</span>
                <span style={{ fontWeight: 600, color: "#555", fontFamily: "ui-monospace, monospace" }}>{vegasLine}</span>
              </div>
            )}
            {bbmiLine && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#aaa", fontWeight: 500 }}>BBMI</span>
                <span style={{ fontWeight: 600, color: sportColor, fontFamily: "ui-monospace, monospace" }}>{bbmiLine}</span>
              </div>
            )}
            {pickedTeam && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#aaa", fontWeight: 500 }}>Pick</span>
                <span style={{ fontWeight: 700, color: sportColor }}>{pickedTeam}</span>
              </div>
            )}
          </div>
        )}
        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
          <div style={{ flex: 1, height: 3, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 3, borderRadius: 2, width: `${edgePct * 100}%`, background: sportColor }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: sportColor, flexShrink: 0 }}>+{edge.toFixed(1)}</span>
          <span style={{
            fontSize: 10, fontWeight: 500, borderRadius: 4, padding: "2px 7px", flexShrink: 0,
            color: isFree ? "#1a5c38" : C.accent,
            background: isFree ? "rgba(26,102,64,0.1)" : "rgba(41,82,204,0.1)",
          }}>{isFree ? "Free" : "Premium"}</span>
        </div>
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function HomePageClient() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [today, setToday] = useState("");
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    setToday(getTodayCT());
    return () => window.removeEventListener("resize", check);
  }, []);

  // Build featured picks
  const featuredPicks = useMemo(() => {
    const picks: { sport: string; sportColor: string; sportLabel: string; pickType: string; matchup: string; detail?: string; edge: number; edgeMax?: number; isFree: boolean; href: string; leftLogo: React.ReactNode; rightLogo: React.ReactNode; vegasLine?: string; bbmiLine?: string; pickedTeam?: string }[] = [];

    (mlbGames as MLBGame[]).filter(g => g.date === today).forEach(g => {
      if (g.rlPick && g.bbmiMargin != null) {
        picks.push({ sport: "mlb", sportColor: C.mlb, sportLabel: "MLB", pickType: "Run Line", matchup: `${g.awayTeam.split(" ").pop()} @ ${g.homeTeam.split(" ").pop()}`, detail: g.gameTimeUTC ? formatTime(g.gameTimeUTC) : "", edge: Math.abs(g.bbmiMargin), edgeMax: 1.0, isFree: Math.abs(g.bbmiMargin) < 0.25, href: "/mlb/picks", leftLogo: <MLBLogo teamName={g.awayTeam} size={30} />, rightLogo: <MLBLogo teamName={g.homeTeam} size={30} />, vegasLine: g.vegasRunLine != null ? `${g.vegasRunLine > 0 ? "+" : ""}${g.vegasRunLine}` : undefined, bbmiLine: g.bbmiMargin != null ? `${g.bbmiMargin > 0 ? "+" : ""}${g.bbmiMargin.toFixed(2)}` : undefined, pickedTeam: g.rlPick ?? undefined });
      }
      if (g.ouPick === "UNDER" && g.ouEdge != null) {
        picks.push({ sport: "mlb", sportColor: C.mlb, sportLabel: "MLB", pickType: "Under", matchup: `${g.awayTeam.split(" ").pop()} @ ${g.homeTeam.split(" ").pop()}`, detail: g.gameTimeUTC ? formatTime(g.gameTimeUTC) : "", edge: Math.abs(g.ouEdge), edgeMax: 3.0, isFree: Math.abs(g.ouEdge) < 1.25, href: "/mlb/picks?mode=ou", leftLogo: <MLBLogo teamName={g.awayTeam} size={30} />, rightLogo: <MLBLogo teamName={g.homeTeam} size={30} />, vegasLine: g.vegasTotal != null ? `O/U ${g.vegasTotal}` : undefined, bbmiLine: g.bbmiTotal != null ? `${g.bbmiTotal.toFixed(1)}` : undefined, pickedTeam: "Under" });
      }
    });

    (ncaaGames as NcaaGame[]).filter(g => g.date === today).forEach(g => {
      const home = String(g.home ?? ""), away = String(g.away ?? "");
      if (!g.vegasHomeLine || !g.bbmiHomeLine) return;
      const edge = Math.abs(g.bbmiHomeLine - g.vegasHomeLine);
      if (edge < 2) return;
      const pick = g.bbmiHomeLine < g.vegasHomeLine ? home : away;
      const spread = g.bbmiHomeLine < g.vegasHomeLine ? g.vegasHomeLine : -g.vegasHomeLine;
      picks.push({ sport: "ncaa-bball", sportColor: C.bball, sportLabel: "NCAA Basketball", pickType: "Spread", matchup: `${away} @ ${home}`, detail: g.neutralSite ? "Neutral" : "", edge, edgeMax: 10, isFree: edge < 6, href: "/ncaa-todays-picks", leftLogo: <NCAALogo teamName={away} size={30} />, rightLogo: <NCAALogo teamName={home} size={30} />, vegasLine: `${g.vegasHomeLine > 0 ? "+" : ""}${g.vegasHomeLine}`, bbmiLine: `${g.bbmiHomeLine > 0 ? "+" : ""}${g.bbmiHomeLine.toFixed(1)}`, pickedTeam: `${pick} ${spread > 0 ? "+" : ""}${spread}` });
    });

    (baseballGames as BaseballGame[]).filter(g => g.date === today).forEach(g => {
      if (g.ouPick && g.vegasTotal && g.bbmiTotal) {
        const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
        if (edge >= 2.5) {
          picks.push({ sport: "ncaa-baseball", sportColor: C.baseball, sportLabel: "NCAA Baseball", pickType: g.ouPick, matchup: `${g.awayTeam.split(" ").pop()} @ ${g.homeTeam.split(" ").pop()}`, detail: "", edge, edgeMax: 6, isFree: true, href: "/baseball/picks?mode=ou", leftLogo: <NCAALogo teamName={g.awayTeam} size={30} />, rightLogo: <NCAALogo teamName={g.homeTeam} size={30} />, vegasLine: g.vegasTotal != null ? `O/U ${g.vegasTotal}` : undefined, bbmiLine: g.bbmiTotal != null ? `${g.bbmiTotal.toFixed(1)}` : undefined, pickedTeam: g.ouPick });
        }
      }
    });

    return picks.sort((a, b) => b.edge - a.edge);
  }, [today]);

  const freePicks = featuredPicks.filter(p => p.isFree).slice(0, 3);
  const lockedPicks = featuredPicks.filter(p => !p.isFree);

  // Count locked picks by sport
  const lockedBySport = useMemo(() => {
    const map: Record<string, number> = {};
    lockedPicks.forEach(p => { map[p.sport] = (map[p.sport] ?? 0) + 1; });
    return map;
  }, [lockedPicks]);

  const totalLocked = lockedPicks.length;

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>
      <div style={{ padding: "0 28px" }}>

        {/* ── HERO ── */}
        <section className="px-4 sm:px-7 pt-6 sm:pt-8 pb-5 sm:pb-6" style={{ textAlign: "center", borderBottom: `0.5px solid ${C.border}` }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#2952cc", color: "#ffffff", borderRadius: 999,
            padding: "5px 14px", fontSize: 11, fontWeight: 500, marginBottom: 20,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#ffffff", display: "inline-block" }} />
            3 sports &middot; 5 leagues &middot; Updated daily
          </div>

          <h1 className="text-2xl sm:text-[28px] font-medium" style={{ letterSpacing: "-0.025em", color: C.textPrimary, marginBottom: 10, lineHeight: 1.2 }}>
            We show our <span style={{ color: "#2952cc" }}>work.</span>
          </h1>

          <p className="text-[13px] max-w-full sm:max-w-[420px] mx-auto" style={{ color: C.textSecondary, marginBottom: 28, lineHeight: 1.6 }}>
            Independent game lines built by a risk manager. Every pick logged before tip-off, tracked publicly, never edited.
          </p>

          {/* ── STAT CARDS (5-column grid) ── */}
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(200px, 1fr))", gap: 10, minWidth: 900, maxWidth: 1100, margin: "0 auto", alignItems: "stretch", textAlign: "left" }}>
            {STAT_CARDS.map((d, i) => <StatCard key={i} d={d} />)}
          </div>
          </div>
        </section>

        {/* ── PICKS SECTION ── */}
        <section style={{ padding: "22px 0 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: "#111", margin: 0 }}>
              Today&apos;s free picks
              <span style={{ fontSize: 12, color: "#bbb", fontWeight: 400, marginLeft: 6 }}>
                &middot; {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </h2>
            <Link href="/mlb/picks" style={{ fontSize: 12, color: "#2952cc", textDecoration: "none" }}>
              See all picks &rarr;
            </Link>
          </div>

          {/* 2-column: picks left + sidebar right */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "1fr 240px" : "1fr",
            gap: 10,
          }}>
            {/* Left: pick cards — 1 col mobile, N cols desktop */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? `repeat(${Math.max(freePicks.length, 1)}, 1fr)` : "1fr",
              gap: 10,
            }}>
              {freePicks.map((pick, i) => (
                <PickCard key={i} {...pick} />
              ))}
              {freePicks.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                  No free picks available yet today. Check back after the pipeline runs.
                </div>
              )}
            </div>

            {/* Sidebar: full width on mobile, 240px on desktop */}
            <div style={{
              background: "#2e3347", borderRadius: 10, border: "0.5px solid rgba(255,255,255,0.06)",
              padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "center",
              gap: 12, alignSelf: "start",
            }}>
              {/* Top */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                  PRO PICKS TODAY
                </div>
                {totalLocked > 0 ? (
                  <>
                    <div style={{ fontSize: 36, fontWeight: 500, color: "#fff", lineHeight: 1 }}>{totalLocked}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 3, marginBottom: 14 }}>picks locked</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {Object.entries(lockedBySport).map(([sport, count]) => (
                        <div key={sport} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: SPORT_COLORS[sport] ?? "#888", display: "inline-block" }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                            <strong style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{SPORT_LABELS[sport] ?? sport}</strong> &middot; {count} pick{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
                    Picks update daily
                  </div>
                )}
              </div>

              {/* Bottom CTA */}
              <div>
                <Link href="/subscribe" style={{
                  display: "block", background: "#2952cc", color: "#fff",
                  fontSize: 12, fontWeight: 500, padding: "10px 16px",
                  borderRadius: 7, textAlign: "center", textDecoration: "none", cursor: "pointer",
                }}>
                  Unlock with Pro &rarr;
                </Link>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 5 }}>
                  $10/week or $35/month
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── TRUST BAR ── */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap",
          padding: "12px 20px", borderTop: "0.5px solid rgba(0,0,0,0.07)",
          backgroundColor: "#e6e4dc", margin: "24px -28px 0",
        }}>
          {["Picks logged pre-game", "Never edited", "Public track record since 2024"].map(t => (
            <span key={t} style={{ fontSize: 11, color: "#999", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "#1a6640" }} />
              {t}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
