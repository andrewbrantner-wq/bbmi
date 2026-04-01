"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import MLBLogo from "@/components/MLBLogo";
import playoffDataRaw from "@/data/mlb-playoff-probs.json";

// ── Types ────────────────────────────────────────────────────────

type TeamResult = {
  playoff_pct: number;
  division_pct: number;
  wildcard_pct: number;
  current_wins: number;
  current_losses: number;
  games_played: number;
  games_remaining: number;
  projected_wins: number;
  projected_wins_10th: number;
  projected_wins_90th: number;
  projected_wins_range: string;
  division: string;
  league: string;
};

type PlayoffData = {
  updated_at: string;
  simulation_date: string;
  n_simulations: number;
  games_remaining: number;
  elapsed_seconds: number;
  results: Record<string, TeamResult>;
};

const data = playoffDataRaw as PlayoffData;

// ── Division structure ───────────────────────────────────────────

const DIVISIONS: Record<string, string[]> = {
  "AL East": ["New York Yankees", "Boston Red Sox", "Toronto Blue Jays", "Baltimore Orioles", "Tampa Bay Rays"],
  "AL Central": ["Cleveland Guardians", "Minnesota Twins", "Chicago White Sox", "Detroit Tigers", "Kansas City Royals"],
  "AL West": ["Houston Astros", "Texas Rangers", "Seattle Mariners", "Los Angeles Angels", "Oakland Athletics"],
  "NL East": ["Philadelphia Phillies", "New York Mets", "Atlanta Braves", "Washington Nationals", "Miami Marlins"],
  "NL Central": ["Chicago Cubs", "Milwaukee Brewers", "St. Louis Cardinals", "Cincinnati Reds", "Pittsburgh Pirates"],
  "NL West": ["Los Angeles Dodgers", "San Diego Padres", "San Francisco Giants", "Arizona Diamondbacks", "Colorado Rockies"],
};

// ── Helpers ──────────────────────────────────────────────────────

type SortKey = "playoff_pct" | "division_pct" | "record" | "projected_wins";

function getPlayoffColor(pct: number, avgGamesPlayed: number = 162) {
  // Scale thresholds with season progress
  const redThreshold = avgGamesPlayed < 30 ? 2 : avgGamesPlayed < 100 ? 5 : 10;
  if (pct >= 90) return { bg: "#fefce8", text: "#92400e" };
  if (pct >= 60) return { bg: "#f0fdf4", text: "#166534" };
  if (pct >= 30) return { bg: "transparent", text: "#374151" };
  if (pct >= redThreshold) return { bg: "transparent", text: "#6b7280" };
  return { bg: "#fef2f2", text: "#dc2626" };
}

function computeGB(team: TeamResult, divLeader: TeamResult): string {
  const gb = ((divLeader.current_wins - team.current_wins) + (team.current_losses - divLeader.current_losses)) / 2;
  if (gb <= 0) return "\u2014";
  return gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1);
}

// ── Styles ───────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  backgroundColor: "#0a1628", color: "#94a3b8", padding: "10px 12px",
  textAlign: "center", whiteSpace: "nowrap", fontSize: "0.62rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", position: "sticky", top: 0, zIndex: 20,
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};

const TD: React.CSSProperties = {
  padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #f1f5f9",
  whiteSpace: "nowrap", verticalAlign: "middle",
};

const TD_MONO: React.CSSProperties = {
  ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e",
};

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════

export default function BracketPulsePage() {
  const [league, setLeague] = useState<"AL" | "NL">("AL");
  const [sortKey, setSortKey] = useState<SortKey>("playoff_pct");

  const results = data.results;
  const updatedAt = data.updated_at ? new Date(data.updated_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "\u2014";
  const avgGamesPlayed = useMemo(() => {
    const vals = Object.values(results).map(r => r.games_played);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  }, [results]);

  // Get teams for selected league, grouped by division
  const leagueDivisions = useMemo(() => {
    const divs = Object.entries(DIVISIONS).filter(([div]) => div.startsWith(league));
    return divs.map(([divName, teams]) => {
      const teamData = teams
        .map(t => ({ name: t, ...results[t] }))
        .filter(t => t.playoff_pct !== undefined);

      // Find division leader for GB calc
      const leader = teamData.reduce((best, t) => t.current_wins > best.current_wins ? t : best, teamData[0]);

      return {
        divName,
        teams: teamData.map(t => ({
          ...t,
          gb: computeGB(t, leader),
        })),
        leader,
      };
    });
  }, [league, results]);

  // Flat sorted list (when sorting by non-default)
  const flatSorted = useMemo(() => {
    const all = leagueDivisions.flatMap(d => d.teams);
    return [...all].sort((a, b) => {
      if (sortKey === "record") return (b.current_wins - b.current_losses) - (a.current_wins - a.current_losses);
      if (sortKey === "projected_wins") return b.projected_wins - a.projected_wins;
      if (sortKey === "division_pct") return b.division_pct - a.division_pct;
      return b.playoff_pct - a.playoff_pct;
    });
  }, [leagueDivisions, sortKey]);

  // Always show division grouping regardless of sort
  const useGrouped = true;

  // Render a team row — rank is passed in, not derived from idx
  const TeamRow = ({ t, rank, idx }: { t: typeof flatSorted[0]; rank: number; idx: number }) => {
    const pColor = getPlayoffColor(t.playoff_pct, avgGamesPlayed);
    const isClinched = t.playoff_pct >= 99.5 && t.games_remaining < 30;
    const isEliminated = t.playoff_pct === 0.0 && t.games_remaining < 30;
    const rowOpacity = isEliminated ? 0.45 : 1;

    return (
      <tr key={t.name} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc", opacity: rowOpacity }}>
        <td style={{ ...TD_MONO, fontWeight: 700, color: "#0a1628", width: 40 }}>{rank}</td>
        <td style={{ ...TD, textAlign: "left" }}>
          <Link href={`/mlb/team/${encodeURIComponent(t.name)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1628", textDecoration: "none" }}>
            <MLBLogo teamName={t.name} size={24} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
          </Link>
        </td>
        <td style={TD_MONO}>{t.current_wins}-{t.current_losses}</td>
        <td style={{ ...TD_MONO, color: "#94a3b8" }}>{t.gb}</td>
        <td style={{ ...TD_MONO, fontWeight: 800, fontSize: 15, backgroundColor: pColor.bg, color: pColor.text }}>
          {isClinched ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", backgroundColor: "#fef3c7", border: "1px solid #f0c040", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em" }}>CLINCHED</span>
          ) : isEliminated ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 4, padding: "2px 8px", letterSpacing: "0.04em", textDecoration: "line-through" }}>ELIM</span>
          ) : (
            `${t.playoff_pct.toFixed(1)}%`
          )}
        </td>
        <td style={{ ...TD_MONO, color: "#78716c" }}>{t.division_pct.toFixed(1)}%</td>
        <td style={{ ...TD_MONO, color: "#78716c" }}>{t.wildcard_pct.toFixed(1)}%</td>
        <td style={{ ...TD_MONO, color: "#57534e" }}>{Math.round(t.projected_wins)}-{162 - Math.round(t.projected_wins)}</td>
      </tr>
    );
  };

  // Division divider row
  const DivHeader = ({ divName }: { divName: string }) => (
    <tr>
      <td colSpan={8} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#78716c", backgroundColor: "#f1f5f9", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
        {divName}
      </td>
    </tr>
  );

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#fafaf9", minHeight: "100vh" }}>
      <div className="w-full max-w-[1200px] mx-auto px-6 py-8">

        {/* ── HERO HEADER ─────────────────────────────────── */}
        <div style={{ background: "#0a1628", borderRadius: 12, padding: "32px 24px", marginBottom: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff", margin: 0 }}>
            <img src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg" alt="MLB" style={{ width: 48, height: 48, marginRight: 12 }} />
            <span>Playoff Pulse</span>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8, marginBottom: 0 }}>
            Playoff probabilities updated daily {"\u00B7"} {data.n_simulations.toLocaleString()} season simulations
          </p>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#64748b" }}>
            <span>Last updated: {updatedAt}</span>
            <span>{"\u00B7"}</span>
            <span>{data.games_remaining.toLocaleString()} games remaining</span>
          </div>

          {/* League toggle */}
          <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
            {(["AL", "NL"] as const).map(l => (
              <button key={l} onClick={() => setLeague(l)} style={{
                padding: "6px 24px", borderRadius: 999, fontSize: 14, fontWeight: league === l ? 700 : 500,
                border: league === l ? "none" : "1px solid #475569",
                backgroundColor: league === l ? "#ffffff" : "transparent",
                color: league === l ? "#0a1628" : "#94a3b8", cursor: "pointer",
              }}>
                {l === "AL" ? "American League" : "National League"}
              </button>
            ))}
          </div>

        </div>

        {/* ── EARLY SEASON NOTICE ─────────────────────────── */}
        {(Object.values(results).reduce((s, r) => s + r.games_played, 0) / Object.values(results).length) < 30 && (
          <div style={{ maxWidth: 1200, margin: "0 auto 16px", backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 6, padding: "12px 16px 12px 18px", fontSize: "0.75rem", color: "#92400e", lineHeight: 1.6 }}>
            <strong>Early season:</strong> Teams have played fewer than 30 games. Probabilities are heavily influenced by prior expectations and will shift significantly as more games are played. The projected wins range reflects this uncertainty.
          </div>
        )}

        {/* ── PROBABILITY TABLE ────────────────────────────── */}
        <div className="bracket-table-desktop" style={{ maxWidth: 900, margin: "0 auto 24px", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={TH}>#</th>
                  <th style={{ ...TH, textAlign: "left" }}>Team</th>
                  <th style={{ ...TH, cursor: "pointer" }} onClick={() => setSortKey("record")}>
                    W-L {sortKey === "record" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={TH}>GB</th>
                  <th style={{ ...TH, cursor: "pointer" }} onClick={() => setSortKey("playoff_pct")}>
                    Playoff % {sortKey === "playoff_pct" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={{ ...TH, cursor: "pointer" }} onClick={() => setSortKey("division_pct")}>
                    Div % {sortKey === "division_pct" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={TH}>WC %</th>
                  <th style={{ ...TH, cursor: "pointer" }} onClick={() => setSortKey("projected_wins")}>
                    Proj Record {sortKey === "projected_wins" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                </tr>
              </thead>
              <tbody>
                {useGrouped ? (
                  (() => {
                    let leagueRank = 0;
                    return leagueDivisions.map(({ divName, teams }) => {
                      const sorted = [...teams].sort((a, b) => {
                        if (sortKey === "record") return (b.current_wins - b.current_losses) - (a.current_wins - a.current_losses);
                        if (sortKey === "projected_wins") return b.projected_wins - a.projected_wins;
                        if (sortKey === "division_pct") return b.division_pct - a.division_pct;
                        return b.playoff_pct - a.playoff_pct;
                      });
                      return (
                        <React.Fragment key={divName}>
                          <DivHeader divName={divName} />
                          {sorted.map((t, idx) => {
                            leagueRank++;
                            return <TeamRow key={t.name} t={t} rank={leagueRank} idx={idx} />;
                          })}
                        </React.Fragment>
                      );
                    });
                  })()
                ) : (
                  flatSorted.map((t, idx) => <TeamRow key={t.name} t={t} rank={idx + 1} idx={idx} />)
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MOBILE CARD VIEW ─────────────────────────────── */}
        <div className="bracket-cards-mobile" style={{ display: "none", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {leagueDivisions.map(({ divName, teams }) => (
            <div key={divName}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{divName}</div>
              {[...teams].sort((a, b) => {
                if (sortKey === "record") return (b.current_wins - b.current_losses) - (a.current_wins - a.current_losses);
                if (sortKey === "projected_wins") return b.projected_wins - a.projected_wins;
                if (sortKey === "division_pct") return b.division_pct - a.division_pct;
                return b.playoff_pct - a.playoff_pct;
              }).map(t => {
                const pColor = getPlayoffColor(t.playoff_pct, avgGamesPlayed);
                return (
                  <div key={t.name} style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <MLBLogo teamName={t.name} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#0a1628" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                        W-L: {t.current_wins}-{t.current_losses} {"\u00B7"} Proj: {Math.round(t.projected_wins)}-{162 - Math.round(t.projected_wins)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: pColor.text }}>{t.playoff_pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>Div {t.division_pct.toFixed(0)}% {"\u00B7"} WC {t.wildcard_pct.toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── DISCLOSURE ──────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: "0 auto 16px", backgroundColor: "#eff6ff", borderTop: "1px solid #bfdbfe", borderRight: "1px solid #bfdbfe", borderBottom: "1px solid #bfdbfe", borderLeft: "4px solid #2563eb", borderRadius: 6, padding: "12px 16px 12px 18px", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.6 }}>
          <strong>How BBMI simulates the season:</strong> Each remaining game is projected using team power ratings derived from the BBMI model. The simulation runs {data.n_simulations.toLocaleString()} times with random outcomes drawn from each game&apos;s win probability. Results update nightly after all games are final. Early-season probabilities (before 30 games played) reflect wide uncertainty {"\u2014"} the projected wins range shows this uncertainty explicitly.
        </div>

        {/* ── FOOTER ──────────────────────────────────────── */}
        <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 24 }}>
          <p>Simulation uses Bayesian-shrunk team win rates with home field advantage. {data.n_simulations.toLocaleString()} Monte Carlo iterations per update.</p>
          <p style={{ marginTop: 8 }}>
            <Link href="/mlb/picks" style={{ color: "#3b82f6", textDecoration: "underline" }}>View today&apos;s picks {"\u2192"}</Link>
          </p>
        </div>

      </div>

      {/* ── RESPONSIVE CSS ────────────────────────────────── */}
      <style>{`
        @media (max-width: 768px) {
          .bracket-table-desktop { display: none !important; }
          .bracket-cards-mobile { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
