"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import NCAALogo from "@/components/NCAALogo";
import { useAuth } from "./AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase-config";
import mlbGames from "@/data/betting-lines/mlb-games.json";
import { OU_MIN_EDGE as MLB_OU_MIN, OU_STRONG_EDGE as MLB_OU_PREMIUM } from "@/config/mlb-thresholds";
import { MIN_EDGE as BBALL_MIN_EDGE, FREE_EDGE_LIMIT as BBALL_PREMIUM } from "@/config/ncaa-basketball-thresholds";
import { MIN_EDGE as BASEBALL_MIN_EDGE, FREE_EDGE_LIMIT as BASEBALL_PREMIUM } from "@/config/ncaa-baseball-thresholds";
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

// ── Live Scores (MLB + ESPN) ──
type LiveScore = { awayScore: number | null; homeScore: number | null; status: "pre" | "in" | "post"; statusDisplay: string };

function normName(s: string): string { return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
function stripMascot(s: string): string { const w = s.trim().split(/\s+/); return w.length > 1 ? normName(w.slice(0, -1).join(" ")) : normName(s); }

async function fetchMLBScores(dateStr: string): Promise<Map<string, LiveScore>> {
  const map = new Map<string, LiveScore>();
  try {
    const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}&hydrate=linescore`, { cache: "no-store" });
    if (!res.ok) return map;
    const data = await res.json();
    for (const de of data.dates ?? []) {
      for (const game of de.games ?? []) {
        const sc = game.status?.statusCode ?? "S";
        const abs = game.status?.abstractGameState ?? "Preview";
        let status: "pre" | "in" | "post" = "pre";
        if (abs === "Live" || sc === "I" || sc === "MA" || sc === "MB") status = "in";
        else if (abs === "Final" || sc === "F" || sc === "O" || sc === "FR") status = "post";
        const inn = game.linescore?.currentInning ?? null;
        const half = game.linescore?.inningHalf ?? "";
        const halfLabel = half === "Top" ? "Top" : half === "Bottom" ? "Bot" : half === "Middle" ? "Mid" : "";
        let display = game.status?.detailedState ?? "";
        if (status === "in" && inn) display = `${halfLabel} ${inn}`.trim();
        else if (status === "post") display = inn && inn > 9 ? `F/${inn}` : "Final";
        const away = normName(game.teams?.away?.team?.name ?? "");
        const home = normName(game.teams?.home?.team?.name ?? "");
        const ls: LiveScore = { awayScore: game.teams?.away?.score ?? null, homeScore: game.teams?.home?.score ?? null, status, statusDisplay: display };
        map.set(`${away}|${home}`, ls);
      }
    }
  } catch { /* silent */ }
  return map;
}

async function fetchESPNScores(sportPath: string, groups?: number[]): Promise<Map<string, LiveScore>> {
  const map = new Map<string, LiveScore>();
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date()).replace(/-/g, "");
  const groupList = groups ?? [0];
  for (const grp of groupList) {
    try {
      const grpParam = grp > 0 ? `&groups=${grp}` : "";
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sportPath}/scoreboard?dates=${dateStr}${grpParam}&limit=200`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const event of data.events ?? []) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        const awayC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "away");
        const homeC = comp.competitors?.find((c: { homeAway: string }) => c.homeAway === "home");
        if (!awayC || !homeC) continue;
        const st = comp.status ?? event.status ?? {};
        const sid = st?.type?.id ?? "1";
        let status: "pre" | "in" | "post" = sid === "2" || sid === "22" || sid === "23" ? "in" : sid === "3" ? "post" : "pre";
        let display = st?.type?.shortDetail ?? st?.type?.description ?? "";
        if (status === "in") display = st?.displayClock ? `${st.displayClock}` : display;
        else if (status === "post") display = "Final";
        const awayScore = awayC.score != null ? parseInt(awayC.score, 10) : null;
        const homeScore = homeC.score != null ? parseInt(homeC.score, 10) : null;
        const ls: LiveScore = { awayScore: isNaN(awayScore!) ? null : awayScore, homeScore: isNaN(homeScore!) ? null : homeScore, status, statusDisplay: display };
        // Index by multiple name formats for matching
        const names = [
          [normName(awayC.team?.displayName ?? ""), normName(homeC.team?.displayName ?? "")],
          [stripMascot(awayC.team?.displayName ?? ""), stripMascot(homeC.team?.displayName ?? "")],
          [normName(awayC.team?.shortDisplayName ?? ""), normName(homeC.team?.shortDisplayName ?? "")],
        ];
        for (const [a, h] of names) { if (a && h) map.set(`${a}|${h}`, ls); }
      }
    } catch { /* silent */ }
  }
  return map;
}

function useAllLiveScores() {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
      const [mlb, bball, baseball] = await Promise.all([
        fetchMLBScores(ctDate),
        fetchESPNScores("basketball/mens-college-basketball", [50, 55, 56, 98, 100, 104]),
        fetchESPNScores("baseball/college-baseball"),
      ]);
      const merged = new Map<string, LiveScore>();
      for (const m of [mlb, bball, baseball]) { for (const [k, v] of m) merged.set(k, v); }
      setScores(merged);
      const hasLive = Array.from(merged.values()).some(g => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch {
      timerRef.current = setTimeout(load, 120_000);
    }
  }, []);

  useEffect(() => { load(); return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, [load]);

  const getLive = useCallback((away: string, home: string): LiveScore | undefined => {
    const a = normName(away), h = normName(home);
    return scores.get(`${a}|${h}`) ?? scores.get(`${stripMascot(away)}|${stripMascot(home)}`);
  }, [scores]);

  return getLive;
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
  { sportLabel: "NCAA BASKETBALL", color: "#3060c0", value: "64.9%", metric: "Premium spread ATS", sub: "2,004 games · \u2212110 juice", freePct: "55.0%", premPct: "64.9%" },
  { sportLabel: "NCAA BASEBALL", color: "#1a7a8a", value: "66.5%", metric: "Premium O/U ATS", sub: "798 games · edge 3+", freePct: "54.8%", premPct: "66.5%" },
  { sportLabel: "NCAA FOOTBALL", color: "#6b7280", value: "61.7%", metric: "Premium spread ATS", sub: "719 games · \u2212110 juice", freePct: "56.2%", premPct: "61.7%" },
  { sportLabel: "MLB", color: "#1a6640", value: "57.5%", metric: "Filtered O/U ATS", sub: "548 games · walk-forward 2024\u20132025", freePct: "55.7%", premPct: "60.4%", note: "no openers · GP \u2265 20 · CCS-gated" },
  { sportLabel: "NFL", color: "#013369", value: "56.0%", metric: "Totals ATS (walk-forward)", sub: "366 games · 4 seasons (2022\u20132025)", freePct: "55.4%", premPct: "58.0%", note: "edge [2.5, 7.0] · opponent-adjusted" },
];

// ══════════════════════════════════════════════════════════════
// PICK CARD (Section 3 of spec)
// ══════════════════════════════════════════════════════════════
type MarketLine = {
  type: string;        // "Spread", "Run Line", "Under", "Over"
  vegasLine: string;   // e.g. "-3.5", "O/U 8.5"
  bbmiLine?: string;   // e.g. "-5.2", "7.8"
  pick?: string;       // e.g. "Duke -3.5", "Under"
  edge: number;
  isFree: boolean;
};

type GamePick = {
  gameKey: string;
  sport: string;
  sportColor: string;
  sportLabel: string;
  matchup: string;
  detail?: string;
  href: string;
  leftLogo: React.ReactNode;
  rightLogo: React.ReactNode;
  markets: MarketLine[];
  bestEdge: number;
  edgeMax: number;
  hasFree: boolean;
  awayTeam?: string;
  homeTeam?: string;
  liveScore?: LiveScore;
};

function PickCard({ sportColor, sportLabel, matchup, detail, href, leftLogo, rightLogo, markets, bestEdge, edgeMax, hasFree, liveScore, isPremiumUser }: GamePick & { isPremiumUser?: boolean }) {
  const edgePct = Math.min(bestEdge / (edgeMax ?? 8), 1);
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
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: "#666" }}>{sportLabel}</span>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {markets.map(m => (
              <span key={m.type} style={{ fontSize: 10, color: "#666", fontWeight: 500, background: "#ece9e2", padding: "2px 6px", borderRadius: 4 }}>
                {(m.isFree || isPremiumUser) ? m.type : (m.type === "Run Line" || m.type === "Spread" ? m.type : "O/U")}
              </span>
            ))}
          </div>
        </div>
        {/* Matchup */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {leftLogo}<span style={{ fontSize: 10, color: "#999" }}>@</span>{rightLogo}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111", lineHeight: 1.3 }}>{matchup}</div>
            {detail && <div style={{ fontSize: 11, color: "#999", marginTop: 1 }}>{detail}</div>}
          </div>
          {liveScore && liveScore.status !== "pre" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>
                {liveScore.awayScore}{"\u2013"}{liveScore.homeScore}
              </div>
              <div style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                color: liveScore.status === "in" ? sportColor : "#888",
              }}>
                {liveScore.status === "in" && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", backgroundColor: sportColor, marginRight: 3, verticalAlign: "middle" }} />}
                {liveScore.statusDisplay}
              </div>
            </div>
          )}
        </div>
        {/* Market lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {markets.map(m => {
            const unlocked = m.isFree || isPremiumUser;
            return (
              <div key={m.type} style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ color: "#777", fontWeight: 500 }}>Vegas</span>
                  <span style={{ fontWeight: 600, color: "#444", fontFamily: "ui-monospace, monospace" }}>{m.vegasLine}</span>
                </div>
                {unlocked && m.bbmiLine && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#777", fontWeight: 500 }}>BBMI</span>
                    <span style={{ fontWeight: 600, color: sportColor, fontFamily: "ui-monospace, monospace" }}>{m.bbmiLine}</span>
                  </div>
                )}
                {unlocked && m.pick && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ color: "#777", fontWeight: 500 }}>Pick</span>
                    <span style={{ fontWeight: 700, color: sportColor }}>{m.pick}</span>
                  </div>
                )}
                {!unlocked && (
                  <span style={{ fontSize: 11, color: "#888", fontWeight: 500 }}>{"\uD83D\uDD12"} Premium</span>
                )}
                <span style={{ fontSize: 11, fontWeight: 500, color: sportColor, marginLeft: "auto" }}>+{m.edge.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
          <div style={{ flex: 1, height: 3, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: 3, borderRadius: 2, width: `${edgePct * 100}%`, background: sportColor }} />
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "2px 7px", flexShrink: 0,
            color: (hasFree || isPremiumUser) ? "#1a5c38" : "#ffffff",
            background: (hasFree || isPremiumUser) ? "rgba(26,102,64,0.1)" : "#2e3347",
          }}>{hasFree ? "Free" : isPremiumUser ? "Pro" : "\uD83D\uDD12 Premium"}</span>
        </div>
      </div>
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
export default function HomePageClient() {
  const getLive = useAllLiveScores();
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [today, setToday] = useState("");
  const [sportFilter, setSportFilter] = useState<string>("all");
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    setToday(getTodayCT());
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!user) { setIsPremium(false); return; }
    getDoc(doc(db, "users", user.uid)).then(d => {
      setIsPremium(d.exists() && d.data()?.premium === true);
    }).catch(() => setIsPremium(false));
  }, [user]);

  // Build featured picks — grouped by game, with multiple markets per card
  const gamePicks = useMemo(() => {
    const gameMap: Record<string, GamePick> = {};

    const addMarket = (key: string, base: Omit<GamePick, "markets" | "bestEdge" | "hasFree">, market: MarketLine) => {
      if (!gameMap[key]) {
        gameMap[key] = { ...base, markets: [], bestEdge: 0, edgeMax: base.edgeMax, hasFree: false };
      }
      gameMap[key].markets.push(market);
      if (market.edge > gameMap[key].bestEdge) gameMap[key].bestEdge = market.edge;
      if (market.isFree) gameMap[key].hasFree = true;
    };

    // MLB: Run Line + O/U
    (mlbGames as MLBGame[]).filter(g => g.date === today).forEach(g => {
      const key = `mlb_${g.awayTeam}_${g.homeTeam}`;
      const base = { gameKey: key, sport: "mlb", sportColor: C.mlb, sportLabel: "MLB", matchup: `${g.awayTeam.split(" ").pop()} @ ${g.homeTeam.split(" ").pop()}`, detail: g.gameTimeUTC ? formatTime(g.gameTimeUTC) : "", href: "/mlb/picks", leftLogo: <MLBLogo teamName={g.awayTeam} size={30} />, rightLogo: <MLBLogo teamName={g.homeTeam} size={30} />, edgeMax: 3.0, awayTeam: g.awayTeam, homeTeam: g.homeTeam };

      if (g.rlPick && g.bbmiMargin != null) {
        const edge = Math.abs(g.bbmiMargin);
        addMarket(key, base, { type: "Run Line", vegasLine: g.vegasRunLine != null ? `${g.vegasRunLine > 0 ? "+" : ""}${g.vegasRunLine}` : "\u2014", bbmiLine: `${g.bbmiMargin > 0 ? "+" : ""}${g.bbmiMargin.toFixed(2)}`, pick: g.rlPick ?? undefined, edge, isFree: (g.rlConfidenceTier ?? 0) <= 1 });
      }
      if (g.bbmiTotal != null && g.vegasTotal != null) {
        const ouEdge = Math.abs(g.bbmiTotal - g.vegasTotal);
        if (g.bbmiTotal < g.vegasTotal && ouEdge >= MLB_OU_MIN) {
          addMarket(key, { ...base, href: "/mlb/picks?mode=ou" }, { type: "Under", vegasLine: `O/U ${g.vegasTotal}`, bbmiLine: `${g.bbmiTotal.toFixed(1)}`, pick: "Under", edge: ouEdge, isFree: ouEdge < MLB_OU_PREMIUM });
        }
        if (g.bbmiTotal > g.vegasTotal && ouEdge >= MLB_OU_PREMIUM) {
          addMarket(key, { ...base, href: "/mlb/picks?mode=ou" }, { type: "Over", vegasLine: `O/U ${g.vegasTotal}`, bbmiLine: `${g.bbmiTotal.toFixed(1)}`, pick: "Over", edge: ouEdge, isFree: false });
        }
      }
    });

    // NCAA Basketball: Spread + O/U
    (ncaaGames as NcaaGame[]).filter(g => g.date === today).forEach(g => {
      const home = String(g.home ?? ""), away = String(g.away ?? "");
      const key = `bball_${away}_${home}`;
      const base = { gameKey: key, sport: "ncaa-bball", sportColor: C.bball, sportLabel: "NCAA Basketball", matchup: `${away} @ ${home}`, detail: g.neutralSite ? "Neutral" : "", href: "/ncaa-todays-picks", leftLogo: <NCAALogo teamName={away} size={30} />, rightLogo: <NCAALogo teamName={home} size={30} />, edgeMax: 10, awayTeam: away, homeTeam: home };

      if (g.vegasHomeLine && g.bbmiHomeLine) {
        const edge = Math.abs(g.bbmiHomeLine - g.vegasHomeLine);
        if (edge >= BBALL_MIN_EDGE) {
          const pick = g.bbmiHomeLine < g.vegasHomeLine ? home : away;
          const spread = g.bbmiHomeLine < g.vegasHomeLine ? g.vegasHomeLine : -g.vegasHomeLine;
          addMarket(key, base, { type: "Spread", vegasLine: `${g.vegasHomeLine > 0 ? "+" : ""}${g.vegasHomeLine}`, bbmiLine: `${g.bbmiHomeLine > 0 ? "+" : ""}${g.bbmiHomeLine.toFixed(1)}`, pick: `${pick} ${spread > 0 ? "+" : ""}${spread}`, edge, isFree: edge < BBALL_PREMIUM });
        }
      }
      const ncaaVT = (g as Record<string, unknown>).vegasTotal as number | null;
      const ncaaBT = (g as Record<string, unknown>).bbmiTotal as number | null;
      if (ncaaVT && ncaaBT) {
        const ouEdge = Math.abs(ncaaBT - ncaaVT);
        if (ouEdge >= 2) {
          const ouPick = ncaaBT < ncaaVT ? "Under" : "Over";
          addMarket(key, { ...base, href: "/ncaa-todays-picks?mode=ou" }, { type: ouPick, vegasLine: `O/U ${ncaaVT}`, bbmiLine: `${ncaaBT.toFixed(1)}`, pick: ouPick, edge: ouEdge, isFree: ouEdge < 6 });
        }
      }
    });

    // NCAA Baseball: O/U
    (baseballGames as BaseballGame[]).filter(g => g.date === today).forEach(g => {
      if (g.ouPick && g.vegasTotal && g.bbmiTotal) {
        const edge = Math.abs(g.bbmiTotal - g.vegasTotal);
        if (edge >= BASEBALL_MIN_EDGE) {
          const key = `baseball_${g.awayTeam}_${g.homeTeam}`;
          const base = { gameKey: key, sport: "ncaa-baseball", sportColor: C.baseball, sportLabel: "NCAA Baseball", matchup: `${g.awayTeam.split(" ").pop()} @ ${g.homeTeam.split(" ").pop()}`, detail: "", href: "/baseball/picks?mode=ou", leftLogo: <NCAALogo teamName={g.awayTeam} size={30} />, rightLogo: <NCAALogo teamName={g.homeTeam} size={30} />, edgeMax: 6, awayTeam: g.awayTeam, homeTeam: g.homeTeam };
          addMarket(key, base, { type: g.ouPick, vegasLine: `O/U ${g.vegasTotal}`, bbmiLine: `${g.bbmiTotal.toFixed(1)}`, pick: g.ouPick, edge, isFree: edge < BASEBALL_PREMIUM });
        }
      }
    });

    return Object.values(gameMap).sort((a, b) => b.bestEdge - a.bestEdge);
  }, [today]);

  // Attach live scores to all picks
  const gamePicksWithScores = useMemo(() =>
    gamePicks.map(p => {
      if (p.awayTeam && p.homeTeam) {
        const ls = getLive(p.awayTeam, p.homeTeam);
        return ls ? { ...p, liveScore: ls } : p;
      }
      return p;
    }),
  [gamePicks, getLive]);

  const filteredPicks = sportFilter === "all" ? gamePicksWithScores : gamePicksWithScores.filter(p => p.sport === sportFilter);
  const freePicks = filteredPicks.filter(p => p.hasFree).slice(0, 6);
  const lockedPicks = filteredPicks.filter(p => !p.hasFree);

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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 500, color: "#111", margin: 0, whiteSpace: "nowrap" }}>
              Today&apos;s free picks
            </h2>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {[
                { key: "all", label: "All", color: "#2952cc" },
                { key: "mlb", label: "MLB", color: C.mlb },
                { key: "ncaa-bball", label: "Basketball", color: C.bball },
                { key: "ncaa-baseball", label: "Baseball", color: C.baseball },
              ].map(s => {
                const active = sportFilter === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSportFilter(s.key)}
                    style={{
                      fontSize: 11, fontWeight: active ? 600 : 400,
                      padding: "3px 10px", borderRadius: 999,
                      border: `1px solid ${active ? s.color : "rgba(0,0,0,0.12)"}`,
                      backgroundColor: active ? s.color : "transparent",
                      color: active ? "#ffffff" : "#888888",
                      cursor: "pointer", transition: "all 0.12s",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: "#bbb", fontWeight: 400 }}>
              {"\u00B7"} {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>

          {/* Pick cards grid — free + premium */}
          {(() => {
            const allPicks = [...freePicks, ...lockedPicks.slice(0, 9 - freePicks.length)];
            const cols = isDesktop ? Math.min(allPicks.length || 1, 3) : 1;
            return (
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? `repeat(${cols}, 1fr)` : "1fr", gap: 10 }}>
                {allPicks.map((pick) => (
                  <PickCard key={pick.gameKey} {...pick} isPremiumUser={isPremium} />
                ))}
                {allPicks.length === 0 && (
                  <div style={{ padding: 40, textAlign: "center", color: "#aaa", fontSize: 13 }}>
                    No picks available yet today. Check back after the pipeline runs.
                  </div>
                )}
              </div>
            );
          })()}
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
