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
  lds_pct: number;
  lcs_pct: number;
  ws_pct: number;
  champion_pct: number;
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

type BracketSeed = {
  seeds: string[];
  clinched: boolean[];
  ws_pct: number[];
};

type PlayoffData = {
  updated_at: string;
  simulation_date: string;
  n_simulations: number;
  games_remaining: number;
  elapsed_seconds: number;
  results: Record<string, TeamResult>;
  bracket_snapshot?: Record<string, BracketSeed>;
};

const data = playoffDataRaw as PlayoffData;

// ── Short name lookup (disambiguates Red Sox / White Sox, etc.) ──

const SHORT_NAMES: Record<string, string> = {
  "Los Angeles Angels": "Angels",
  "Houston Astros": "Astros",
  "Oakland Athletics": "Athletics",
  "Toronto Blue Jays": "Blue Jays",
  "Atlanta Braves": "Braves",
  "Milwaukee Brewers": "Brewers",
  "St. Louis Cardinals": "Cardinals",
  "Chicago Cubs": "Cubs",
  "Arizona Diamondbacks": "D-backs",
  "Los Angeles Dodgers": "Dodgers",
  "San Francisco Giants": "Giants",
  "Cleveland Guardians": "Guardians",
  "Seattle Mariners": "Mariners",
  "Miami Marlins": "Marlins",
  "New York Mets": "Mets",
  "Washington Nationals": "Nationals",
  "Baltimore Orioles": "Orioles",
  "San Diego Padres": "Padres",
  "Philadelphia Phillies": "Phillies",
  "Pittsburgh Pirates": "Pirates",
  "Texas Rangers": "Rangers",
  "Tampa Bay Rays": "Rays",
  "Boston Red Sox": "Red Sox",
  "Cincinnati Reds": "Reds",
  "Colorado Rockies": "Rockies",
  "Kansas City Royals": "Royals",
  "Detroit Tigers": "Tigers",
  "Minnesota Twins": "Twins",
  "Chicago White Sox": "White Sox",
  "New York Yankees": "Yankees",
};

function shortName(fullName: string): string {
  return SHORT_NAMES[fullName] ?? fullName;
}

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

type SortKey = "playoff_pct" | "division_pct" | "record" | "projected_wins" | "ws_pct" | "lcs_pct" | "lds_pct";

function getPlayoffColor(pct: number, avgGamesPlayed: number = 162) {
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
  backgroundColor: "#1a6640", color: "#ffffff", padding: "10px 12px",
  textAlign: "center", whiteSpace: "nowrap", fontSize: "0.62rem", fontWeight: 700,
  letterSpacing: "0.08em", textTransform: "uppercase", position: "sticky", top: 0, zIndex: 20,
  borderBottom: "1px solid rgba(255,255,255,0.2)",
};

const TD: React.CSSProperties = {
  padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #ece9e2",
  whiteSpace: "nowrap", verticalAlign: "middle",
};

const TD_MONO: React.CSSProperties = {
  ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e",
};

// ════════════════════════════════════════════════════════════════
// PLAYOFF BRACKET VISUAL — Compact design
// ════════════════════════════════════════════════════════════════

function BracketRow({ seed, name, pct, results, isProjected, isTop }: {
  seed?: number; name: string | null; pct: number; results: Record<string, TeamResult>; isProjected?: boolean; isTop?: boolean;
}) {
  const r = name && results[name] ? results[name] : null;
  const label = r ? shortName(name!) : name ?? "";
  const bg = isTop ? "#ffffff" : "#f5f3ef";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "2px 6px", height: 22,
      background: bg,
    }}>
      {seed != null && <span style={{ fontSize: 9, fontWeight: 700, color: "#aaa", width: 11, flexShrink: 0 }}>{seed}</span>}
      {r && name && <MLBLogo teamName={name} size={14} />}
      <span style={{ flex: 1, fontSize: 11, fontWeight: r ? 600 : 400, color: r ? "#1a1a1a" : "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {pct > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#1a6640", flexShrink: 0 }}>{pct.toFixed(0)}%</span>}
    </div>
  );
}

function Matchup({ top, bot, results }: {
  top: { seed?: number; name: string | null; pct: number; isProjected?: boolean };
  bot: { seed?: number; name: string | null; pct: number; isProjected?: boolean };
  results: Record<string, TeamResult>;
}) {
  return (
    <div style={{ border: "1px solid #d4d2cc", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
      <BracketRow {...top} results={results} isTop />
      <div style={{ height: 1, background: "#d4d2cc" }} />
      <BracketRow {...bot} results={results} isTop={false} />
    </div>
  );
}

function PlayoffBracket({ bracketSnapshot, results }: {
  bracketSnapshot: Record<string, BracketSeed> | undefined;
  results: Record<string, TeamResult>;
}) {
  if (!bracketSnapshot) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto 24px", background: "#ffffff", borderRadius: 10, border: "1px solid #d4d2cc", padding: "32px", textAlign: "center", color: "#888", fontSize: 13 }}>
        Bracket projection available once the season begins.
      </div>
    );
  }

  const al = bracketSnapshot["AL"];
  const nl = bracketSnapshot["NL"];
  if (!al || !nl) return null;

  const likely = (a: string | null, b: string | null) => {
    if (!a || !b) return a ?? b;
    return (results[a]?.ws_pct ?? 0) >= (results[b]?.ws_pct ?? 0) ? a : b;
  };

  // AL path
  const alWcA = likely(al.seeds[2], al.seeds[5]);
  const alWcB = likely(al.seeds[3], al.seeds[4]);
  const alLds1W = likely(al.seeds[0], alWcA);
  const alLds2W = likely(al.seeds[1], alWcB);
  const alLcsW = likely(alLds1W, alLds2W);

  // NL path
  const nlWcA = likely(nl.seeds[2], nl.seeds[5]);
  const nlWcB = likely(nl.seeds[3], nl.seeds[4]);
  const nlLds1W = likely(nl.seeds[0], nlWcA);
  const nlLds2W = likely(nl.seeds[1], nlWcB);
  const nlLcsW = likely(nlLds1W, nlLds2W);

  // WS projected winner
  const wsWinner = likely(alLcsW, nlLcsW);
  const wsWinnerPct = wsWinner ? (results[wsWinner]?.champion_pct ?? 0) : 0;

  const pct = (name: string | null, key: keyof TeamResult) => name ? ((results[name]?.[key] as number) ?? 0) : 0;

  const HD: React.CSSProperties = { fontSize: 8, fontWeight: 700, color: "#999", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 3 };

  const renderLeague = (label: string, seeds: string[], wcA: string | null, wcB: string | null, lds1W: string | null, lds2W: string | null, lcsW: string | null) => (
    <div style={{ padding: "10px 12px 6px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#555", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
        {/* Wild Card */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={HD}>Wild Card</div>
          <Matchup
            top={{ seed: 3, name: seeds[2], pct: pct(seeds[2], "playoff_pct") }}
            bot={{ seed: 6, name: seeds[5], pct: pct(seeds[5], "playoff_pct") }}
            results={results}
          />
          <Matchup
            top={{ seed: 4, name: seeds[3], pct: pct(seeds[3], "playoff_pct") }}
            bot={{ seed: 5, name: seeds[4], pct: pct(seeds[4], "playoff_pct") }}
            results={results}
          />
        </div>
        <div style={{ width: 8, flexShrink: 0 }} />
        {/* Div Series */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={HD}>Div Series</div>
          <Matchup
            top={{ seed: 1, name: seeds[0], pct: pct(seeds[0], "lds_pct") }}
            bot={{ name: wcA, pct: pct(wcA, "lds_pct"), isProjected: true }}
            results={results}
          />
          <Matchup
            top={{ seed: 2, name: seeds[1], pct: pct(seeds[1], "lds_pct") }}
            bot={{ name: wcB, pct: pct(wcB, "lds_pct"), isProjected: true }}
            results={results}
          />
        </div>
        <div style={{ width: 8, flexShrink: 0 }} />
        {/* Champ Series — same 4-slot vertical structure, matchup in slots 2-3 */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={HD}>Champ Series</div>
          <div style={{ flex: 1 }} />
          <Matchup
            top={{ name: lds1W, pct: pct(lds1W, "lcs_pct"), isProjected: true }}
            bot={{ name: lds2W, pct: pct(lds2W, "lcs_pct"), isProjected: true }}
            results={results}
          />
          <div style={{ flex: 1 }} />
        </div>
        <div style={{ width: 8, flexShrink: 0 }} />
        {/* Pennant — vertically centered */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={HD}>Pennant</div>
          <div style={{ flex: 1 }} />
          <div style={{ border: "1px solid #1a6640", borderRadius: 4, overflow: "hidden" }}>
            <BracketRow name={lcsW} pct={pct(lcsW, "ws_pct")} results={results} isProjected isTop />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 24px", background: "#ffffff", borderRadius: 10, overflow: "hidden", border: "1px solid #d4d2cc" }}>
      {/* Title */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #d4d2cc" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
          Projected Postseason Bracket
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
          {data.n_simulations.toLocaleString()} simulations {"\u00B7"} probabilities show likelihood of reaching each round
        </div>
      </div>

      <div>
        {/* AL */}
        {renderLeague("American League", al.seeds, alWcA, alWcB, alLds1W, alLds2W, alLcsW)}

        {/* World Series — between AL and NL */}
        <div style={{ borderTop: "2px solid #1a6640", borderBottom: "2px solid #1a6640", background: "#1a6640", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase", flexShrink: 0 }}>
            World Series
          </div>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {wsWinner && <MLBLogo teamName={wsWinner} size={28} />}
            <span style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>{wsWinner ? shortName(wsWinner) : "TBD"}</span>
            {wsWinnerPct > 0 && (
              <span style={{ fontSize: 14, fontWeight: 800, color: "#ffffff", background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 999 }}>
                {wsWinnerPct.toFixed(1)}%
              </span>
            )}
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>to win it all</span>
          </div>
        </div>

        {/* NL */}
        {renderLeague("National League", nl.seeds, nlWcA, nlWcB, nlLds1W, nlLds2W, nlLcsW)}
      </div>
    </div>
  );
}

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

  const leagueDivisions = useMemo(() => {
    const divs = Object.entries(DIVISIONS).filter(([div]) => div.startsWith(league));
    return divs.map(([divName, teams]) => {
      const teamData = teams
        .map(t => ({ name: t, ...results[t] }))
        .filter(t => t.playoff_pct !== undefined);
      const leader = teamData.reduce((best, t) => t.current_wins > best.current_wins ? t : best, teamData[0]);
      return {
        divName,
        teams: teamData.map(t => ({ ...t, gb: computeGB(t, leader) })),
        leader,
      };
    });
  }, [league, results]);

  const flatSorted = useMemo(() => {
    const all = leagueDivisions.flatMap(d => d.teams);
    return [...all].sort((a, b) => {
      if (sortKey === "record") return (b.current_wins - b.current_losses) - (a.current_wins - a.current_losses);
      if (sortKey === "projected_wins") return b.projected_wins - a.projected_wins;
      if (sortKey === "division_pct") return b.division_pct - a.division_pct;
      if (sortKey === "lds_pct") return b.lds_pct - a.lds_pct;
      if (sortKey === "lcs_pct") return b.lcs_pct - a.lcs_pct;
      if (sortKey === "ws_pct") return b.ws_pct - a.ws_pct;
      return b.playoff_pct - a.playoff_pct;
    });
  }, [leagueDivisions, sortKey]);

  const useGrouped = true;

  const TeamRow = ({ t, rank, idx }: { t: typeof flatSorted[0]; rank: number; idx: number }) => {
    const pColor = getPlayoffColor(t.playoff_pct, avgGamesPlayed);
    const isClinched = t.playoff_pct >= 99.5 && t.games_remaining < 30;
    const isEliminated = t.playoff_pct === 0.0 && t.games_remaining < 30;
    const rowOpacity = isEliminated ? 0.45 : 1;

    return (
      <tr key={t.name} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8f7f4", opacity: rowOpacity }}>
        <td style={{ ...TD_MONO, fontWeight: 700, color: "#1a1a1a", width: 40 }}>{rank}</td>
        <td style={{ ...TD, textAlign: "left" }}>
          <Link href={`/mlb/team/${encodeURIComponent(t.name)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#1a1a1a", textDecoration: "none" }}>
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
        <td style={{ ...TD_MONO, color: "#0369a1", fontWeight: 500 }}>{(t.lds_pct ?? 0).toFixed(1)}%</td>
        <td style={{ ...TD_MONO, color: "#7c3aed", fontWeight: 500 }}>{(t.lcs_pct ?? 0).toFixed(1)}%</td>
        <td style={{ ...TD_MONO, fontWeight: 700, color: (t.ws_pct ?? 0) >= 10 ? "#92400e" : "#57534e",
          backgroundColor: (t.ws_pct ?? 0) >= 10 ? "#fef3c7" : "transparent" }}>
          {(t.ws_pct ?? 0).toFixed(1)}%
        </td>
        <td style={{ ...TD_MONO, color: "#57534e" }}>{Math.round(t.projected_wins)}-{162 - Math.round(t.projected_wins)}</td>
      </tr>
    );
  };

  const DivHeader = ({ divName }: { divName: string }) => (
    <tr>
      <td colSpan={11} style={{ padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#555555", backgroundColor: "#f5f3ef", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #d4d2cc" }}>
        {divName}
      </td>
    </tr>
  );

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9", minHeight: "100vh" }}>
      <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

        {/* ── HERO HEADER ─────────────────────────────────── */}
        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#1a6640", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            MLB {"\u00B7"} Playoff Probabilities
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
            Playoff Pulse
          </h1>
          <p style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
            Playoff probabilities updated daily {"\u00B7"} {data.n_simulations.toLocaleString()} season simulations
          </p>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 0 }}>
            Last updated: {updatedAt} {"\u00B7"} {data.games_remaining.toLocaleString()} games remaining
          </div>
        </div>

        {/* ── EARLY SEASON NOTICE ─────────────────────────── */}
        {(Object.values(results).reduce((s, r) => s + r.games_played, 0) / Object.values(results).length) < 30 && (
          <div style={{ maxWidth: 1100, margin: "0 auto 16px", backgroundColor: "#fffbeb", borderTop: "1px solid #fde68a", borderRight: "1px solid #fde68a", borderBottom: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 6, padding: "12px 16px 12px 18px", fontSize: "0.75rem", color: "#92400e", lineHeight: 1.6 }}>
            <strong>Early season:</strong> Teams have played fewer than 30 games. Probabilities are heavily influenced by prior expectations and will shift significantly as more games are played. The projected wins range reflects this uncertainty.
          </div>
        )}

        {/* ── PLAYOFF BRACKET ──────────────────────────────── */}
        <PlayoffBracket bracketSnapshot={data.bracket_snapshot} results={results} />

        {/* ── LEAGUE TOGGLE ───────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 20 }}>
          {(["AL", "NL"] as const).map(l => (
            <button key={l} onClick={() => setLeague(l)} style={{
              padding: "6px 24px", borderRadius: 999, fontSize: 13,
              border: league === l ? "none" : "1px solid #c0bdb5",
              backgroundColor: league === l ? "#1a6640" : "transparent",
              color: league === l ? "#ffffff" : "#555",
              fontWeight: league === l ? 500 : 400, cursor: "pointer",
            }}>
              {l === "AL" ? "American League" : "National League"}
            </button>
          ))}
        </div>

        {/* ── PROBABILITY TABLE ────────────────────────────── */}
        <div className="bracket-table-desktop" style={{ maxWidth: 1100, margin: "0 auto 24px", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1050 }}>
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
                  <th style={{ ...TH, cursor: "pointer", borderLeft: "1px solid rgba(255,255,255,0.08)", color: "#7dd3fc" }} onClick={() => setSortKey("lds_pct")}>
                    LDS % {sortKey === "lds_pct" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={{ ...TH, cursor: "pointer", color: "#c4b5fd" }} onClick={() => setSortKey("lcs_pct")}>
                    LCS % {sortKey === "lcs_pct" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={{ ...TH, cursor: "pointer", color: "#fcd34d" }} onClick={() => setSortKey("ws_pct")}>
                    WS % {sortKey === "ws_pct" ? "\u25BC" : <span style={{ opacity: 0.35 }}>{"\u21C5"}</span>}
                  </th>
                  <th style={{ ...TH, cursor: "pointer", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={() => setSortKey("projected_wins")}>
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
                        if (sortKey === "lds_pct") return (b.lds_pct ?? 0) - (a.lds_pct ?? 0);
                        if (sortKey === "lcs_pct") return (b.lcs_pct ?? 0) - (a.lcs_pct ?? 0);
                        if (sortKey === "ws_pct") return (b.ws_pct ?? 0) - (a.ws_pct ?? 0);
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
                if (sortKey === "lds_pct") return (b.lds_pct ?? 0) - (a.lds_pct ?? 0);
                if (sortKey === "lcs_pct") return (b.lcs_pct ?? 0) - (a.lcs_pct ?? 0);
                if (sortKey === "ws_pct") return (b.ws_pct ?? 0) - (a.ws_pct ?? 0);
                return b.playoff_pct - a.playoff_pct;
              }).map(t => {
                const pColor = getPlayoffColor(t.playoff_pct, avgGamesPlayed);
                return (
                  <div key={t.name} style={{ backgroundColor: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                    <MLBLogo teamName={t.name} size={32} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "#78716c", marginTop: 2 }}>
                        W-L: {t.current_wins}-{t.current_losses} {"\u00B7"} Proj: {Math.round(t.projected_wins)}-{162 - Math.round(t.projected_wins)}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                        LDS {(t.lds_pct ?? 0).toFixed(0)}% {"\u00B7"} LCS {(t.lcs_pct ?? 0).toFixed(0)}% {"\u00B7"} <span style={{ color: "#92400e", fontWeight: 600 }}>WS {(t.ws_pct ?? 0).toFixed(1)}%</span>
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
        <div style={{ maxWidth: 1100, margin: "0 auto 16px", backgroundColor: "#f0fdf4", borderTop: "1px solid #c6e0ce", borderRight: "1px solid #c6e0ce", borderBottom: "1px solid #c6e0ce", borderLeft: "4px solid #1a6640", borderRadius: 6, padding: "12px 16px 12px 18px", fontSize: "0.78rem", color: "#1a5c38", lineHeight: 1.6 }}>
          <strong>How BBMI simulates the season:</strong> Each remaining game is projected using Bayesian-shrunk team win rates that blend BBMI power rankings (60%) with prior-year Pythagorean records (40%), regressed 15% toward .500. Win probabilities use the log5 formula with a 54% home-field advantage. The simulation runs {data.n_simulations.toLocaleString()} Monte Carlo iterations {"\u2014"} each iteration simulates every remaining regular-season game, then runs the full postseason bracket: Wild Card (best-of-3), Division Series (best-of-5), Championship Series (best-of-7), and World Series (best-of-7) with correct MLB home-field patterns. As the season progresses, observed records gradually replace priors (k=50 shrinkage). Results update each morning after the prior day&apos;s games are final.
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
