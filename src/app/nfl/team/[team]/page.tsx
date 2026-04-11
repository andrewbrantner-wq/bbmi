"use client";

import { use, useMemo } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import rankingsData from "@/data/rankings/nfl-rankings.json";
import gamesData from "@/data/betting-lines/nfl-games.json";
import { SPORT_ACCENT, OU_MIN_EDGE, OU_MAX_EDGE } from "@/config/nfl-thresholds";

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamRating = {
  rank: number; team: string; gp: number; record: string;
  wins: number; losses: number; bbmiScore: number;
  adjOff: number; adjDef: number; net: number; sos: number;
  adjYpp: number; adjOppYpp: number; toMargin: number;
};

type NFLGame = {
  gameId?: string; date: string; week?: number;
  homeTeam: string; awayTeam: string;
  bbmiTotal?: number | null; vegasTotal?: number | null;
  bbmiSpread?: number | null; vegasSpread?: number | null;
  ouPick?: string | null; ouEdge?: number | null;
  actualHomeScore?: number | null; actualAwayScore?: number | null;
  scheduleAdj?: number | null;
};

const accent = SPORT_ACCENT;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "";
  const [year, month, day] = d.split("-");
  return `${month}/${day}/${year}`;
}

function resultColor(r: string) {
  if (r === "W") return accent;
  if (r === "L") return "#dc2626";
  if (r === "T") return "#d97706";
  return "#78716c";
}

// ── Stat badge ────────────────────────────────────────────────────────────────

function StatBadge({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #d4d2cc", borderTop: `4px solid ${accent}`,
      borderRadius: 10, padding: "14px 18px", minWidth: 120, flex: "1 1 120px", textAlign: "center",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: accent, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#78716c", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NFLTeamPage({ params }: { params: Promise<{ team: string }> }) {
  const { team } = use(params);
  const teamAbbr = decodeURIComponent(team).toUpperCase();

  const teamInfo = useMemo(() =>
    (rankingsData as TeamRating[]).find(t => t.team === teamAbbr),
  [teamAbbr]);

  if (!teamInfo) return notFound();

  const allGames = gamesData as NFLGame[];

  // Games where this team played (home or away)
  const teamGames = useMemo(() =>
    allGames.filter(g => g.homeTeam === teamAbbr || g.awayTeam === teamAbbr).map(g => {
      const isHome = g.homeTeam === teamAbbr;
      const opponent = isHome ? g.awayTeam : g.homeTeam;
      const teamScore = isHome ? g.actualHomeScore : g.actualAwayScore;
      const oppScore = isHome ? g.actualAwayScore : g.actualHomeScore;
      const result = teamScore != null && oppScore != null
        ? (teamScore > oppScore ? "W" : teamScore < oppScore ? "L" : "T")
        : null;

      // O/U result for this game
      const actual = g.actualHomeScore != null && g.actualAwayScore != null
        ? g.actualHomeScore + g.actualAwayScore : null;
      const ouResult = actual != null && g.vegasTotal != null && actual !== g.vegasTotal
        ? (actual > g.vegasTotal ? "OVER" : "UNDER") : null;
      const ouEdge = g.bbmiTotal != null && g.vegasTotal != null
        ? Math.abs(g.bbmiTotal - g.vegasTotal) : null;
      const ouCall = g.bbmiTotal != null && g.vegasTotal != null
        ? (g.bbmiTotal < g.vegasTotal ? "UNDER" : g.bbmiTotal > g.vegasTotal ? "OVER" : null) : null;
      const ouCorrect = ouCall != null && ouResult != null ? ouCall === ouResult : null;

      return {
        ...g, isHome, opponent, teamScore, oppScore, result,
        actual, ouResult, ouEdge, ouCall, ouCorrect,
      };
    }),
  [allGames, teamAbbr]);

  const playedGames = teamGames.filter(g => g.result !== null);
  const upcomingGames = teamGames.filter(g => g.result === null);

  // O/U ATS record for this team's games
  const ouRecord = useMemo(() => {
    const qualifying = playedGames.filter(g =>
      g.ouEdge != null && g.ouEdge >= OU_MIN_EDGE && g.ouEdge <= OU_MAX_EDGE && g.ouCorrect !== null
    );
    const w = qualifying.filter(g => g.ouCorrect === true).length;
    return { w, l: qualifying.length - w, total: qualifying.length };
  }, [playedGames]);

  // Table styles
  const TH: React.CSSProperties = {
    backgroundColor: accent, color: "#ffffff", padding: "8px 12px", fontSize: 10.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", whiteSpace: "nowrap",
    position: "sticky", top: 0, zIndex: 10,
  };
  const TD: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, borderTop: "1px solid #ece9e2", whiteSpace: "nowrap", verticalAlign: "middle",
  };
  const MONO: React.CSSProperties = {
    ...TD, fontFamily: "ui-monospace, monospace", textAlign: "center", color: "#57534e",
  };

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 16, marginBottom: 16 }}>
          <NFLLogo team={teamAbbr} size={100} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <div style={{ background: accent, borderRadius: 8, padding: "6px 14px", display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>BBMI</span>
              <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#ffffff" }}>#{teamInfo.rank}</span>
            </div>
          </div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 500, color: "#57534e", letterSpacing: "-0.01em", textAlign: "center", marginTop: 8 }}>
            {teamAbbr} | {teamInfo.record}
          </h1>
        </div>
        <div style={{ marginBottom: 24 }}>
          <Link href="/nfl/rankings" style={{ fontSize: 14, color: "#2563eb" }} className="hover:underline">
            {"\u2190"} Back to Rankings
          </Link>
        </div>

        {/* Stat badges */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <StatBadge label="BBMI Score" value={teamInfo.bbmiScore.toFixed(1)} />
          <StatBadge label="BBMI Rank" value={`#${teamInfo.rank}`} />
          <StatBadge label="Adj Off" value={teamInfo.adjOff.toFixed(1)} sub="PPG scored" />
          <StatBadge label="Adj Def" value={teamInfo.adjDef.toFixed(1)} sub="PPG allowed" />
          <StatBadge label="Net" value={`${teamInfo.net > 0 ? "+" : ""}${teamInfo.net.toFixed(1)}`} />
          <StatBadge label="SOS" value={`${teamInfo.sos > 0 ? "+" : ""}${teamInfo.sos.toFixed(1)}`} sub="Strength of sched" />
          <StatBadge label="YPP" value={teamInfo.adjYpp.toFixed(2)} sub="Yards per play" />
          <StatBadge label="TO Margin" value={`${teamInfo.toMargin > 0 ? "+" : ""}${teamInfo.toMargin.toFixed(2)}`} />
          {ouRecord.total > 0 && (
            <StatBadge label="O/U ATS" value={`${ouRecord.w}-${ouRecord.l}`}
              sub={`${Math.round((ouRecord.w / ouRecord.total) * 100)}% hit rate`} />
          )}
        </div>

        {/* Completed games */}
        {playedGames.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{"\uD83D\uDCCB"}</span> Completed Games
            </h2>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 750 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Date</th>
                      <th style={TH}>Wk</th>
                      <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                      <th style={TH}>Loc</th>
                      <th style={TH}>Result</th>
                      <th style={TH}>Score</th>
                      <th style={TH}>Vegas O/U</th>
                      <th style={TH}>BBMI Total</th>
                      <th style={TH}>Actual</th>
                      <th style={TH}>O/U</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...playedGames].sort((a, b) => b.date.localeCompare(a.date)).map((g, i) => (
                      <tr key={`${g.date}-${g.opponent}-${i}`} style={{ backgroundColor: i % 2 === 0 ? "#f5f3ef" : "#ffffff" }}>
                        <td style={{ ...TD, fontSize: 12, color: "#78716c" }}>{formatDate(g.date)}</td>
                        <td style={MONO}>{g.week ?? "\u2014"}</td>
                        <td style={TD}>
                          <Link href={`/nfl/team/${encodeURIComponent(g.opponent)}`} style={{ textDecoration: "none", color: "#1a1a1a", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            <NFLLogo team={g.opponent} size={20} />
                            <span>{g.opponent}</span>
                          </Link>
                        </td>
                        <td style={{ ...MONO, fontSize: 11 }}>{g.isHome ? "vs" : "@"}</td>
                        <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: resultColor(g.result!) }}>{g.result}</td>
                        <td style={MONO}>{g.teamScore != null ? `${g.teamScore}-${g.oppScore}` : "\u2014"}</td>
                        <td style={MONO}>{g.vegasTotal ?? "\u2014"}</td>
                        <td style={{ ...MONO, color: accent, fontWeight: 600 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                        <td style={MONO}>{g.actual ?? "\u2014"}</td>
                        <td style={{ ...TD, textAlign: "center", fontWeight: 700 }}>
                          {g.ouCorrect === null ? "\u2014"
                            : g.ouCorrect ? <span style={{ color: accent }}>{"\u2713"}</span>
                            : <span style={{ color: "#dc2626" }}>{"\u2717"}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming games */}
        {upcomingGames.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{"\uD83D\uDCC5"}</span> Upcoming Games
            </h2>
            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left" }}>Date</th>
                      <th style={TH}>Wk</th>
                      <th style={{ ...TH, textAlign: "left" }}>Opponent</th>
                      <th style={TH}>Loc</th>
                      <th style={TH}>Vegas O/U</th>
                      <th style={TH}>BBMI Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...upcomingGames].sort((a, b) => a.date.localeCompare(b.date)).map((g, i) => (
                      <tr key={`${g.date}-${g.opponent}-${i}`} style={{ backgroundColor: i % 2 === 0 ? "#f5f3ef" : "#ffffff" }}>
                        <td style={{ ...TD, fontSize: 12, color: "#78716c" }}>{formatDate(g.date)}</td>
                        <td style={MONO}>{g.week ?? "\u2014"}</td>
                        <td style={TD}>
                          <Link href={`/nfl/team/${encodeURIComponent(g.opponent)}`} style={{ textDecoration: "none", color: "#1a1a1a", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                            <NFLLogo team={g.opponent} size={20} />
                            <span>{g.opponent}</span>
                          </Link>
                        </td>
                        <td style={{ ...MONO, fontSize: 11 }}>{g.isHome ? "vs" : "@"}</td>
                        <td style={MONO}>{g.vegasTotal ?? "\u2014"}</td>
                        <td style={{ ...MONO, color: accent, fontWeight: 600 }}>{g.bbmiTotal != null ? g.bbmiTotal.toFixed(1) : "\u2014"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No games fallback */}
        {teamGames.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 14, fontStyle: "italic" }}>
            No game data available for {teamAbbr}. Data will populate when the 2026 NFL season begins.
          </div>
        )}

      </div>
    </div>
  );
}
