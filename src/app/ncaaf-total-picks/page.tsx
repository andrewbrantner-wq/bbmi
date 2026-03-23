"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import gamesData from "@/data/betting-lines/football-games.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type FootballGame = {
  gameDate: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  vegasTotal: number | null;
  bbmiTotal: number | null;
  homePtsProj: number | null;
  awayPtsProj: number | null;
  totalEdge: number | null;
  totalPick: string | null;
  overOdds: number | null;
  underOdds: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  actualTotal: number | null;
  totalResult: string | null;
};

type SortableKey =
  | "awayTeam" | "homeTeam" | "vegasTotal" | "bbmiTotal"
  | "totalEdge" | "totalPick" | "overOdds" | "underOdds";

// Show all games — totals page is informational only (no bet recommendations)
const MIN_EDGE_FOR_RECORD = 0;

function decimalToAmerican(decimal: number): string {
  if (decimal >= 2.0) return `+${Math.round((decimal - 1) * 100)}`;
  return `${Math.round(-100 / (decimal - 1))}`;
}

// ── Live Scores — ESPN API ────────────────────────────────────────────────────

type GameStatus = "pre" | "in" | "post";

interface LiveGame {
  awayScore: number | null;
  homeScore: number | null;
  status: GameStatus;
  statusDisplay: string;
  startTime: string | null;
  espnAwayAbbrev: string;
  espnHomeAbbrev: string;
}

interface EspnCompetitor {
  homeAway: string;
  score?: string | null;
  team: { displayName: string; shortDisplayName: string; abbreviation: string };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function normalizeTeamName(name: string): string {
  return norm(name);
}

function getEspnUrl(): string {
  const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date()).replace(/-/g, "");
  return `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&dates=${ctDate}`;
}

async function fetchEspnScores(): Promise<Map<string, LiveGame>> {
  const res = await fetch(getEspnUrl(), { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  const data = await res.json();
  const map = new Map<string, LiveGame>();

  const todayLocal = new Date().toLocaleDateString("en-CA");
  const todayUTC = new Date().toISOString().slice(0, 10);
  const tomorrowUTC = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  for (const event of data.events ?? []) {
    const gameDate = (event.date ?? "").slice(0, 10);
    if (gameDate !== todayLocal && gameDate !== todayUTC && gameDate !== tomorrowUTC) continue;
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const awayC = (comp.competitors as EspnCompetitor[]).find((c) => c.homeAway === "away");
    const homeC = (comp.competitors as EspnCompetitor[]).find((c) => c.homeAway === "home");
    if (!awayC || !homeC) continue;

    const st = comp.status ?? event.status;
    const sid = st.type.id;
    const isLive = sid === "2" || sid === "23";
    const status: GameStatus = isLive ? "in" : sid === "3" ? "post" : "pre";

    let statusDisplay = st.type.description;
    if (sid === "2") {
      const p = st.period ?? 1;
      const quarter = p <= 4 ? `Q${p}` : `OT${p - 4}`;
      statusDisplay = st.displayClock ? `${quarter} ${st.displayClock}` : quarter;
    } else if (sid === "23") {
      statusDisplay = "Halftime";
    }

    const awayScore = awayC.score != null ? parseInt(awayC.score, 10) : null;
    const homeScore = homeC.score != null ? parseInt(homeC.score, 10) : null;

    const liveGame: LiveGame = {
      awayScore: Number.isNaN(awayScore) ? null : awayScore,
      homeScore: Number.isNaN(homeScore) ? null : homeScore,
      status, statusDisplay,
      startTime: event.date ?? null,
      espnAwayAbbrev: awayC.team.abbreviation ?? awayC.team.shortDisplayName,
      espnHomeAbbrev: homeC.team.abbreviation ?? homeC.team.shortDisplayName,
    };

    const nameVariants = (c: EspnCompetitor) => [
      normalizeTeamName(c.team.displayName),
      normalizeTeamName(c.team.shortDisplayName),
      normalizeTeamName(c.team.abbreviation),
    ];

    const awayVariants = nameVariants(awayC);
    const homeVariants = nameVariants(homeC);
    for (const a of awayVariants) {
      for (const h of homeVariants) map.set(`${a}|${h}`, liveGame);
      map.set(`away:${a}`, liveGame);
    }
    for (const h of homeVariants) map.set(`home:${h}`, liveGame);
  }
  return map;
}

function useLiveScores() {
  const [liveScores, setLiveScores] = useState<Map<string, LiveGame>>(new Map());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const map = await fetchEspnScores();
      setLiveScores(map);
      setLastUpdated(new Date());
      const hasLive = Array.from(map.values()).some((g) => g.status === "in");
      timerRef.current = setTimeout(load, hasLive ? 30_000 : 120_000);
    } catch {
      timerRef.current = setTimeout(load, 120_000);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [load]);

  const getLiveGame = useCallback(
    (away: string, home: string): LiveGame | undefined => {
      const aN = normalizeTeamName(away);
      const hN = normalizeTeamName(home);
      return liveScores.get(`${aN}|${hN}`) ??
        liveScores.get(`away:${aN}`) ??
        liveScores.get(`home:${hN}`);
    },
    [liveScores]
  );

  return { getLiveGame, lastUpdated, liveLoading };
}

// ── Live Total Badge ──────────────────────────────────────────────────────────

function LiveTotalBadge({ liveGame, vegasTotal, bbmiPick }: {
  liveGame: LiveGame | undefined;
  vegasTotal: number | null;
  bbmiPick: string | null;
}) {
  if (!liveGame || liveGame.status === "pre") return null;
  const { awayScore, homeScore, status, statusDisplay } = liveGame;
  const hasScores = awayScore != null && homeScore != null;
  const currentTotal = hasScores ? awayScore! + homeScore! : null;
  const isLive = status === "in";
  const isPost = status === "post";

  let bbmiCorrect: boolean | null = null;
  if (currentTotal != null && vegasTotal != null && bbmiPick) {
    if (currentTotal === vegasTotal) bbmiCorrect = null;
    else if (bbmiPick === "over") bbmiCorrect = currentTotal > vegasTotal;
    else bbmiCorrect = currentTotal < vegasTotal;
  }

  const bgColor    = bbmiCorrect === true ? "#f0fdf4" : bbmiCorrect === false ? "#fef2f2" : "#f8fafc";
  const borderColor = bbmiCorrect === true ? "#86efac" : bbmiCorrect === false ? "#fca5a5" : "#e2e8f0";
  const dotColor   = bbmiCorrect === true ? "#16a34a" : bbmiCorrect === false ? "#dc2626" : "#94a3b8";
  const statusColor = bbmiCorrect === true ? "#15803d" : bbmiCorrect === false ? "#b91c1c" : "#64748b";

  return (
    <div style={{
      borderRadius: 6, padding: "4px 8px",
      display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
      backgroundColor: bgColor, border: `1px solid ${borderColor}`,
      width: 160, minHeight: 42,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {isLive && (
          <span className="live-dot" style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", backgroundColor: dotColor }} />
        )}
        <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: statusColor }}>
          {statusDisplay}
        </span>
      </div>
      {hasScores && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "ui-monospace, monospace", fontWeight: 700, fontSize: "0.75rem" }}>
          <span style={{ color: "#1e293b" }}>{liveGame.espnAwayAbbrev} {awayScore}</span>
          <span style={{ color: "#94a3b8" }}>–</span>
          <span style={{ color: "#1e293b" }}>{homeScore} {liveGame.espnHomeAbbrev}</span>
        </div>
      )}
      {isPost && bbmiCorrect !== null && (
        <div style={{ borderRadius: 4, padding: "1px 6px", fontSize: "0.58rem", fontWeight: 800, textAlign: "center", letterSpacing: "0.05em", color: "#ffffff", backgroundColor: bbmiCorrect ? "#16a34a" : "#dc2626" }}>
          BBMI {bbmiCorrect ? "✓ WIN" : "✗ LOSS"}
        </div>
      )}
    </div>
  );
}

// ── Sortable Header ───────────────────────────────────────────────────────────

function SortableHeader({ label, columnKey, sortConfig, handleSort, align = "center" }: {
  label: string; columnKey: SortableKey;
  sortConfig: { key: SortableKey; direction: "asc" | "desc" };
  handleSort: (key: SortableKey) => void;
  align?: "left" | "center" | "right";
}) {
  const isActive = sortConfig.key === columnKey;
  return (
    <th style={{
      backgroundColor: "#0a1a2f", color: "#ffffff",
      padding: "6px 7px", textAlign: align,
      whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
      borderBottom: "2px solid rgba(255,255,255,0.1)",
      fontSize: "0.72rem", fontWeight: 700,
      letterSpacing: "0.06em", textTransform: "uppercase",
      verticalAlign: "middle", userSelect: "none",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span>{label}</span>
        <span onClick={(e) => { e.stopPropagation(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ── Report Card ───────────────────────────────────────────────────────────────

function TotalsReportCard({ games: todayGames, getLiveGame }: {
  games: FootballGame[];
  getLiveGame: (away: string, home: string) => LiveGame | undefined;
}) {
  const results = todayGames.reduce(
    (acc, g) => {
      if (!g.totalPick || g.vegasTotal == null) return acc;
      const live = getLiveGame(String(g.awayTeam), String(g.homeTeam));
      if (!live || live.status === "pre") return acc;
      const { awayScore, homeScore, status } = live;
      if (awayScore == null || homeScore == null) return acc;
      const actualTotal = awayScore + homeScore;
      const edge = Math.abs(g.totalEdge ?? 0);
      if (edge < MIN_EDGE_FOR_RECORD) return acc;
      if (actualTotal === g.vegasTotal) { acc.push++; return acc; }
      const correct = g.totalPick === "over" ? actualTotal > g.vegasTotal : actualTotal < g.vegasTotal;
      if (status === "in") { if (correct) acc.winning++; else acc.losing++; acc.live++; }
      else if (status === "post") { if (correct) acc.wins++; else acc.losses++; acc.final++; }
      return acc;
    },
    { wins: 0, losses: 0, winning: 0, losing: 0, push: 0, live: 0, final: 0 }
  );

  const totalSettled = results.wins + results.losses;
  const totalCombined = results.wins + results.losses + results.winning + results.losing;
  const combinedWins = results.wins + results.winning;
  const totalTracked = totalSettled + results.live;
  if (totalTracked === 0 && results.push === 0) return null;

  const winColor = "#16a34a", lossColor = "#dc2626", liveColor = "#f59e0b";

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.25rem", backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden" }}>
      <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>📋 Today&apos;s O/U Report Card</span>
        {results.live > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.65rem", color: "#fcd34d", fontWeight: 600 }}>
            <span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fcd34d", display: "inline-block" }} />
            {results.live} game{results.live !== 1 ? "s" : ""} live
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: totalSettled === 0 ? "#94a3b8" : results.wins >= results.losses ? winColor : lossColor }}>
            {results.wins}–{results.losses}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>O/U Record</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{totalSettled} final{results.push > 0 ? ` · ${results.push} push` : ""}</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center", borderRight: "1px solid #f5f5f4" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: results.live === 0 ? "#94a3b8" : liveColor }}>
            {results.winning}–{results.losing}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Currently Hitting</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{results.live} game{results.live !== 1 ? "s" : ""} in progress</div>
        </div>
        <div style={{ flex: 1, padding: "14px 12px", textAlign: "center" }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 800, lineHeight: 1, color: totalCombined === 0 ? "#94a3b8" : combinedWins / totalCombined >= 0.5 ? winColor : lossColor }}>
            {totalCombined === 0 ? "—" : `${((combinedWins / totalCombined) * 100).toFixed(0)}%`}
          </div>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#78716c", marginTop: 4 }}>Today&apos;s Win Rate</div>
          <div style={{ fontSize: "0.6rem", color: "#a8a29e", marginTop: 2 }}>{totalCombined === 0 ? "no games yet" : `${combinedWins} of ${totalCombined} picks (incl. live)`}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function TotalsPageContent() {
  const { getLiveGame, lastUpdated, liveLoading } = useLiveScores();

  const allGames = gamesData as unknown as FootballGame[];
  const cleanedGames = allGames.filter((g) => g.awayTeam && g.homeTeam);
  const today = new Date().toLocaleDateString("en-CA");

  const upcomingGames = cleanedGames.filter((g) => {
    const gameDate = g.gameDate ? String(g.gameDate).split("T")[0] : "";
    return gameDate === today && g.vegasTotal != null && g.bbmiTotal != null;
  });

  const historicalGames = cleanedGames.filter(
    (g) => g.actualTotal != null && g.totalResult != null && g.vegasTotal != null && g.bbmiTotal != null
  );

  // Historical performance stats
  const historicalStats = useMemo(() => {
    const qualified = historicalGames.filter(
      (g) => Math.abs(g.totalEdge ?? 0) >= MIN_EDGE_FOR_RECORD && g.totalResult !== "push"
    );
    const wins = qualified.filter((g) => g.totalResult === g.totalPick).length;
    const losses = qualified.length - wins;
    const total = wins + losses;
    return {
      total,
      wins,
      losses,
      winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "—",
    };
  }, [historicalGames]);

  // Edge bucket performance
  const edgeBucketStats = useMemo(() => {
    const buckets = [
      { name: "0–2 pts", min: 0, max: 2 },
      { name: "2–4 pts", min: 2, max: 4 },
      { name: "4–6 pts", min: 4, max: 6 },
      { name: "6–8 pts", min: 6, max: 8 },
      { name: "≥ 8 pts", min: 8, max: Infinity },
    ];
    return buckets.map((b) => {
      const inBucket = historicalGames.filter((g) => {
        const edge = Math.abs(g.totalEdge ?? 0);
        return edge >= b.min && edge < b.max && g.totalResult !== "push";
      });
      const wins = inBucket.filter((g) => g.totalResult === g.totalPick).length;
      const total = inBucket.length;
      return {
        name: b.name, total, wins,
        winPct: total > 0 ? ((wins / total) * 100).toFixed(1) : "—",
      };
    });
  }, [historicalGames]);

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: SortableKey; direction: "asc" | "desc" }>({ key: "totalEdge", direction: "desc" });
  const handleSort = (columnKey: SortableKey) =>
    setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedGames = useMemo(() => {
    return [...upcomingGames].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof FootballGame];
      const bVal = b[sortConfig.key as keyof FootballGame];
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      return sortConfig.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [upcomingGames, sortConfig]);

  const hasLiveGames = sortedGames.some((g) => {
    const live = getLiveGame(String(g.awayTeam), String(g.homeTeam));
    return live?.status === "in";
  });

  const TD: React.CSSProperties = { padding: "6px 7px", borderTop: "1px solid #f5f5f4", fontSize: 12, verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" };

  return (
    <>
      <style>{`
        @keyframes livepulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        .live-dot { animation: livepulse 1.5s ease-in-out infinite; }
      `}</style>

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa-football" size={120} />
              <span>Game Totals (O/U) Tracker</span>
            </h1>
            <p style={{ fontSize: "0.78rem", color: "#78716c", marginTop: 6 }}>
              Internal tracking page — not linked publicly
            </p>
          </div>

          {/* HEADLINE STATS */}
          {historicalStats.total > 0 && (
            <div style={{ maxWidth: 500, margin: "0 auto 1.75rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: Number(historicalStats.winPct) >= 50 ? "#16a34a" : "#dc2626", lineHeight: 1 }}>{historicalStats.winPct}%</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>O/U Record</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>all games</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0a1a2f", lineHeight: 1 }}>{historicalStats.wins}–{historicalStats.losses}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>W–L</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>all games</div>
              </div>
              <div style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0a1a2f", lineHeight: 1 }}>{historicalStats.total}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>Games</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>tracked</div>
              </div>
            </div>
          )}

          {/* MODEL STATUS DISCLAIMER */}
          <div style={{ maxWidth: 560, margin: "0 auto 1.5rem" }}>
            <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>&#9888;&#65039;</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 4 }}>Totals Model — Informational Only</div>
                  <p style={{ fontSize: 12, color: "#78716c", margin: 0, lineHeight: 1.6 }}>
                    The BBMI totals model is displayed for transparency and informational purposes. <strong>We do not currently recommend wagering on over/under picks.</strong> Walk-forward validation across two unseen seasons produced 53.0% O/U ATS — above breakeven (52.4%) but not yet at the confidence level required for bet recommendations. We are monitoring through the 2026 season to build a third year of validation data before enabling totals wagering guidance.
                  </p>
                  <p style={{ fontSize: 11, color: "#a8a29e", margin: "6px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
                    The spread model (56&ndash;58% walk-forward ATS) remains our primary product. See the <a href="/ncaaf-model-accuracy" style={{ color: "#2563eb", textDecoration: "underline" }}>Model Accuracy</a> page for validated results.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* EDGE BUCKET TABLE */}
          {historicalStats.total > 0 && (
            <div style={{ maxWidth: 480, margin: "0 auto 2rem" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  O/U Performance by Edge Size
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {["Edge Size", "Games", "W–L", "Win %"].map((h) => (
                        <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {edgeBucketStats.map((stat, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.total}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, textAlign: "center", color: "#57534e" }}>{stat.wins}–{stat.total - stat.wins}</td>
                        <td style={{ padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 15, textAlign: "center", fontWeight: 700, color: stat.winPct !== "—" && Number(stat.winPct) > 50 ? "#16a34a" : stat.winPct !== "—" ? "#dc2626" : "#94a3b8" }}>
                          {stat.winPct === "—" ? "—" : `${stat.winPct}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* REPORT CARD */}
          <TotalsReportCard games={sortedGames} getLiveGame={getLiveGame} />

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 8 }}>Today&apos;s O/U Picks</h2>
          {upcomingGames.length === 0 && (
            <p style={{ fontSize: "0.72rem", color: "#78716c", textAlign: "center", margin: "0 auto 16px" }}>
              No totals picks for today yet. Games will appear once the pipeline runs.
            </p>
          )}

          {/* LIVE SCORES STATUS PILL */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1rem", display: "flex", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, backgroundColor: hasLiveGames ? "#f0fdf4" : "#f8fafc", border: `1px solid ${hasLiveGames ? "#86efac" : "#e2e8f0"}`, borderRadius: 999, padding: "4px 14px", fontSize: "0.72rem", color: hasLiveGames ? "#15803d" : "#64748b", fontWeight: 600 }}>
              {liveLoading ? (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              ) : hasLiveGames ? (
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#16a34a", display: "inline-block" }} />
              ) : (
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#94a3b8", display: "inline-block" }} />
              )}
              {liveLoading ? "Loading live scores…" : hasLiveGames
                ? `Live scores updating · ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? ""}`
                : `Scores via ESPN · Updated ${lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "—"}`
              }
            </div>
          </div>

          {/* PICKS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", minWidth: 1050 }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "6px 7px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle", userSelect: "none", width: 160, minWidth: 160 }}>
                        Score
                      </th>
                      <SortableHeader label="Away"       columnKey="awayTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" />
                      <SortableHeader label="Home"       columnKey="homeTeam"   sortConfig={sortConfig} handleSort={handleSort} align="left" />
                      <SortableHeader label="Vegas O/U"  columnKey="vegasTotal" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="BBMI Total" columnKey="bbmiTotal"  sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Edge"       columnKey="totalEdge"  sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Pick"       columnKey="totalPick"  sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Over Odds"  columnKey="overOdds"   sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader label="Under Odds" columnKey="underOdds"  sortConfig={sortConfig} handleSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedGames.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No totals picks available for today.</td></tr>
                    )}
                    {sortedGames.map((g, i) => {
                      const awayStr = String(g.awayTeam);
                      const homeStr = String(g.homeTeam);
                      const liveGame = getLiveGame(awayStr, homeStr);
                      const edge = Math.abs(g.totalEdge ?? 0);
                      const isBelowMinEdge = edge < MIN_EDGE_FOR_RECORD;
                      const rowBg = isBelowMinEdge
                        ? (i % 2 === 0 ? "rgba(248,248,247,0.5)" : "rgba(252,252,252,0.5)")
                        : (i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff");
                      const pickColor = g.totalPick === "over" ? "#dc2626" : "#2563eb";

                      return (
                        <tr key={i} style={{ backgroundColor: rowBg, opacity: isBelowMinEdge ? 0.55 : 1, color: isBelowMinEdge ? "#9ca3af" : undefined }}>
                          <td style={{ ...TD, textAlign: "center", width: 160, minWidth: 160, paddingRight: 12 }}>
                            {!liveGame || liveGame.status === "pre" ? (
                              <div style={{ width: 148, minHeight: 36, borderRadius: 6, border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                                  {liveGame?.startTime
                                    ? new Date(liveGame.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
                                    : g.gameDate}
                                </span>
                              </div>
                            ) : (
                              <LiveTotalBadge liveGame={liveGame} vegasTotal={g.vegasTotal} bbmiPick={g.totalPick} />
                            )}
                          </td>
                          <td style={{ ...TD, paddingLeft: 16 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{g.awayTeam}</span>
                            {g.awayPtsProj != null && (
                              <div style={{ fontSize: 10, color: "#78716c" }}>Proj: {g.awayPtsProj}</div>
                            )}
                          </td>
                          <td style={TD}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{g.homeTeam}</span>
                            {g.homePtsProj != null && (
                              <div style={{ fontSize: 10, color: "#78716c" }}>Proj: {g.homePtsProj}</div>
                            )}
                          </td>
                          <td style={TD_RIGHT}>{g.vegasTotal}</td>
                          <td style={TD_RIGHT}>{g.bbmiTotal}</td>
                          <td style={{ ...TD_RIGHT, color: isBelowMinEdge ? "#9ca3af" : edge >= 6 ? "#16a34a" : "#374151", fontWeight: edge >= 6 ? 800 : 600 }}>
                            {isBelowMinEdge ? "~" : ""}{edge.toFixed(1)}
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: isBelowMinEdge ? "#9ca3af" : pickColor, textTransform: "uppercase", fontSize: 13 }}>
                            {g.totalPick === "over" ? "⬆ Over" : "⬇ Under"}
                          </td>
                          <td style={TD_RIGHT}>{g.overOdds ? decimalToAmerican(g.overOdds) : "—"}</td>
                          <td style={TD_RIGHT}>{g.underOdds ? decimalToAmerican(g.underOdds) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ maxWidth: 600, margin: "0 auto 2rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.68rem", color: "#78716c", lineHeight: 1.6 }}>
              This page is for internal tracking only and is not linked from the public site.
              Totals predictions are derived from the BBMI model&apos;s SP+ offense/defense ratings.
              Historical results will accumulate as games complete and the pipeline records outcomes.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}

export default function NCAAFTotalsPage() {
  return <TotalsPageContent />;
}
