"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import BracketView, { scoreEntry, type BracketTeam, type BracketEntry } from "@/components/BracketView";
import seedingData from "@/data/seeding/seeding.json";
import rankingsData from "@/data/rankings/rankings.json";
import tournamentResultsRaw from "@/data/seeding/tournament-results.json";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/firebase-config";
import { useAuth } from "@/app/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = BracketTeam;

// ── BBMI probability engine ───────────────────────────────────────────────────

const BBMI_MULTIPLIER = 1.1;
const BBMI_STD_DEV    = 10.75;

function erfc(x: number): number {
  const a1=0.254829592, a2=-0.284496736, a3=1.421413741, a4=-1.453152027, a5=1.061405429, p=0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-ax*ax);
  return 1 - sign * y;
}

function winProb(scoreA: number, scoreB: number): number {
  if (!scoreA || !scoreB) return 0.5;
  const z = (scoreA - scoreB) * BBMI_MULTIPLIER / (BBMI_STD_DEV * Math.SQRT2);
  return 0.5 * erfc(-z);
}

// For each pick in a bracket, compute probability that the picked team
// actually reaches and wins that game, then multiply by point value.
// Returns the sum = expected score.
function bbmiExpectedScore(
  picks: Record<string, string>,
  allTeams: Team[],
): number {
  const teamByName = new Map(allTeams.map(t => [t.name, t]));

  // For a given team and round, compute P(team reaches this game AND wins it)
  // by chaining through all prior rounds.
  // roundKey format: "R64|East|3", "R32|East|1", "S16|East|0", "E8|East|0",
  //                  "F4|Semi|0", "CHAMP|Final|0"
  // We need P(team wins through round ri in their path).

  // Build region → ordered opponent list per round for a given team
  function pWinsThrough(teamName: string, targetKey: string): number {
    const team = teamByName.get(teamName);
    if (!team) return 0;

    const parts = targetKey.split("|");
    const prefix = parts[0];
    const region = parts[1];
    const slot   = parseInt(parts[2] ?? "0");

    // Determine round index
    const roundIdx = ["R64","R32","S16","E8","F4","CHAMP"].indexOf(prefix);
    if (roundIdx < 0) return 0;

    // For regional rounds (R64→E8): simulate game-by-game
    // For F4/CHAMP: use picks to find opponent
    let prob = 1.0;

    if (roundIdx <= 3) {
      // Regional path: simulate from R64 up to and including this round
      // Find opponent at each round
      for (let ri = 0; ri <= roundIdx; ri++) {
        const roundPrefix = ["R64","R32","S16","E8"][ri];
        // At round ri, team's game slot = slot >> (roundIdx - ri) * ... 
        // Actually: at R64 the bracket slot for a given E8 slot 0 is games 0-7.
        // For a team picked to win game `slot` at round `roundIdx`,
        // at earlier round ri their slot is: slot * 2^(roundIdx-ri) + offset within subtree.
        // Easier: find the opponent from the picks at each round.
        const gameSlot = Math.floor(slot / Math.pow(2, roundIdx - ri)) * Math.pow(2, roundIdx - ri)
          + (slot % Math.pow(2, roundIdx - ri)); // simplifies to slot for ri==roundIdx
        // At round ri, the game containing our team
        const gSlot = Math.floor(slot * Math.pow(2, 0) / Math.pow(2, roundIdx - ri));
        const pickKey = `${roundPrefix}|${region}|${gSlot}`;
        const opponentName = picks[pickKey] === teamName
          ? undefined  // this IS the pick for this game — find who they beat
          : picks[pickKey];

        // Find opponent: at ri < roundIdx, opponent is the OTHER winner feeding this game
        // at ri == roundIdx, opponent is whoever else is picked in the matchup
        // Since we only have winner picks (not loser), we infer opponent from seeding + prior picks
        // Simplified approach: find the other team that was picked to reach this game
        // For R64: opponent comes from R64_MATCHUPS seeding
        // For R32+: opponent is whoever won the adjacent R64/prior game
        let opponentScore = 0;
        if (ri === 0) {
          // R64: find seed matchup
          const matchupIdx = R64_MATCHUPS.findIndex(([s1, s2]) =>
            allTeams.some(t => t.name === teamName && t.region === region && (t.seed === s1 || t.seed === s2))
            && Math.floor(allTeams.findIndex(t => t.name === teamName) / 2) === Math.floor(R64_MATCHUPS.findIndex(([s1, s2]) => allTeams.some(t2 => t2.name === teamName && t2.region === region && (t2.seed === s1 || t2.seed === s2))) / 1)
          );
          // Simpler: just find the opponent seed from matchup
          const teamInRegion = allTeams.find(t => t.name === teamName && t.region === region);
          if (!teamInRegion) return 0;
          const mIdx = R64_MATCHUPS.findIndex(([s1, s2]) => s1 === teamInRegion.seed || s2 === teamInRegion.seed);
          if (mIdx < 0) return 0;
          const [s1, s2] = R64_MATCHUPS[mIdx];
          const oppSeed = teamInRegion.seed === s1 ? s2 : s1;
          const opp = allTeams.find(t => t.region === region && t.seed === oppSeed && !t.playIn);
          opponentScore = opp?.bbmiScore ?? 0;
        } else {
          // R32+: opponent is whoever was picked to win the adjacent bracket game
          const adjSlot = gSlot % 2 === 0 ? gSlot + 1 : gSlot - 1;
          const adjKey = `${roundPrefix}|${region}|${adjSlot}`;
          const adjWinner = picks[adjKey];
          opponentScore = adjWinner ? (teamByName.get(adjWinner)?.bbmiScore ?? 0) : 0;
        }

        if (opponentScore > 0) {
          prob *= winProb(team.bbmiScore, opponentScore);
        } else {
          prob *= 0.5; // unknown opponent → 50/50
        }
      }
    } else if (prefix === "F4") {
      // First win all regional games (E8)
      prob = pWinsThrough(teamName, `E8|${region}|0`);
      // Then beat the F4 opponent
      const adjSemi = slot === 0 ? "F4|Semi|1" : "F4|Semi|0";
      const opp = teamByName.get(picks[adjSemi]);
      prob *= opp ? winProb(team.bbmiScore, opp.bbmiScore) : 0.5;
    } else if (prefix === "CHAMP") {
      // Win both semis
      const f4region = Object.entries(picks).find(([k, v]) => k.startsWith("F4|") && v === teamName);
      const semiKey = f4region ? f4region[0] : "F4|Semi|0";
      prob = pWinsThrough(teamName, semiKey);
      const adjSemi = semiKey === "F4|Semi|0" ? "F4|Semi|1" : "F4|Semi|0";
      const opp = teamByName.get(picks[adjSemi]);
      prob *= opp ? winProb(team.bbmiScore, opp.bbmiScore) : 0.5;
    }

    return prob;
  }

  // Sum expected value across all picks
  let ev = 0;
  const roundPtsMap: Record<string, number> = {
    PlayIn: 5, R64: 10, R32: 20, S16: 40, E8: 80, F4: 160, CHAMP: 320,
  };
  Object.entries(picks).forEach(([key, teamName]) => {
    const prefix = key.split("|")[0];
    const pts = roundPtsMap[prefix] ?? 0;
    if (!pts) return;
    const p = pWinsThrough(teamName, key);
    ev += p * pts;
  });

  return Math.round(ev);
}

// Standard NCAA bracket matchups per region (game index → [topSeed, bottomSeed])
const R64_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUND_NAMES    = ["Play-In", "Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
const ROUND_POINTS   = [5, 10, 20, 40, 80, 160, 320];

const ACTUAL_RESULTS: Record<string, string> = (() => {
  const results: Record<string, string> = {};
  if (tournamentResultsRaw && typeof tournamentResultsRaw === "object") {
    for (const [k, v] of Object.entries(tournamentResultsRaw as Record<string, unknown>)) {
      if (k !== "_details" && typeof v === "string") results[k] = v;
    }
  }
  return results;
})();

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { user }   = useAuth();
  const [entries, setEntries]   = useState<BracketEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const bbmiScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(rankingsData)) {
      (rankingsData as Record<string, unknown>[]).forEach(r => {
        const name  = String(r.team ?? r.my_name ?? "");
        const score = Number(r.bbmi ?? r.bbmi_score ?? 0);
        if (name && score) map[name] = score;
      });
    }
    return map;
  }, []);

  const allTeams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return (seedingData as Record<string, unknown>[]).map(r => {
      const name = String(r.Team ?? r.team ?? "");
      return {
        name,
        seed:      Number(r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? 0),
        region:    String(r.Region ?? r.region ?? ""),
        playIn:    Boolean(r.PlayIn ?? r.playIn ?? false),
        bbmiScore: bbmiScoreMap[name] ?? 0,
      };
    });
  }, [bbmiScoreMap]);

  // Gate fetch on auth resolving — firing getDocs while user===null causes
  // a permissions error when Firestore rules require request.auth != null.
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAuthReady(true), 400);
    if (user !== undefined) { clearTimeout(timer); setAuthReady(true); }
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!authReady) return;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "bracketChallenge"));
        const data: BracketEntry[] = [];
        snap.forEach(doc => { data.push(doc.data() as BracketEntry); });
        setEntries(data);
      } catch (e) {
        console.error("Failed to load leaderboard:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [authReady]);

  const [sortMode, setSortMode] = useState<"score" | "bbmi">("score");
  // Once we know hasResults, flip the default — but only on first load
  const gamesPlayed = Object.keys(ACTUAL_RESULTS).length;
  const hasResults = gamesPlayed > 0;
  useEffect(() => {
    setSortMode(hasResults ? "score" : "bbmi");
  }, [hasResults]);

  const ranked = useMemo(() => {
    const withScores = entries.map(entry => ({
      ...entry,
      score: scoreEntry(entry.picks),
      bbmiEV: bbmiExpectedScore(entry.picks, allTeams),
    }));
    // Compute bbmiRank separately (always by bbmiEV desc, independent of current sort)
    const byBbmi = [...withScores].sort((a, b) => b.bbmiEV - a.bbmiEV);
    const bbmiRankMap = new Map(byBbmi.map((e, i) => [e.userId, i + 1]));
    return withScores
      .map(e => ({ ...e, bbmiRank: bbmiRankMap.get(e.userId) ?? 0 }))
      .sort((a, b) => {
        if (sortMode === "bbmi") return a.bbmiRank - b.bbmiRank;
        return b.score.total - a.score.total || b.score.possible - a.score.possible;
      });
  }, [entries, allTeams, sortMode]);

  const TH: React.CSSProperties = {
    backgroundColor: "#0a1a2f", color: "#ffffff",
    padding: "8px 12px", fontSize: 10.5, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center",
    whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13, borderTop: "1px solid #f0f0ef",
    textAlign: "center", verticalAlign: "middle",
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading leaderboard…</div>;
  }

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-8">

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            🏆 Bracket Challenge Leaderboard
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 500, marginTop: 8 }}>
            {ranked.length} bracket{ranked.length !== 1 ? "s" : ""} submitted.
            {hasResults
              ? <> {gamesPlayed} game{gamesPlayed !== 1 ? "s" : ""} played. Scores update as games are completed.</>
              : " Scores will populate once games begin."}
          </p>
          <Link href="/bracket-challenge" style={{ marginTop: 10, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            {hasResults ? "← View your bracket" : "← Edit your bracket"}
          </Link>
        </div>

        {/* Standings table */}
        {ranked.length > 0 && (
          <div style={{ marginBottom: 32 }}>

          {/* Sort toggle */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10, gap: 6 }}>
            <span style={{ fontSize: 12, color: "#78716c", alignSelf: "center", marginRight: 4 }}>Sort by:</span>
            {(["score", "bbmi"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 6,
                  border: `1px solid ${sortMode === mode ? "#0a1628" : "#d6d3d1"}`,
                  backgroundColor: sortMode === mode ? "#0a1628" : "#fff",
                  color: sortMode === mode ? "#f0f4ff" : "#57534e",
                  cursor: "pointer",
                }}
              >
                {mode === "score" ? "📊 Actual Score" : "🤖 BBMI Expected"}
              </button>
            ))}
          </div>

          <div style={{
            border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden",
            backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 50 }}>#</th>
                    <th style={{ ...TH, textAlign: "left" }}>Bracket</th>
                    <th style={TH}>Picks</th>
                    <th style={TH}>Score</th>
                    <th style={TH}>Correct</th>
                    <th style={TH}>Max Possible</th>
                    <th style={{ ...TH, color: "#c9a84c" }}>
                      <span title="Pre-tournament ranking based on BBMI win probabilities. Not updated once the tournament starts.">
                        BBMI Exp. ⓘ
                      </span>
                    </th>
                    <th style={TH}>Champion Pick</th>
                    <th style={{ ...TH, width: 80 }}>View</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((entry, i) => {
                    const champPick = entry.picks["CHAMP|Final|0"];
                    const champTeam = champPick ? allTeams.find(t => t.name === champPick) : undefined;
                    const isMe       = user?.uid === entry.userId;
                    const isSelected = selectedUserId === entry.userId;
                    return (
                      <React.Fragment key={entry.userId}>
                        <tr style={{
                          backgroundColor: isSelected
                            ? "rgba(59,130,246,0.07)"
                            : isMe ? "rgba(59,130,246,0.04)"
                            : i % 2 === 0 ? "#fafaf9" : "#fff",
                        }}>
                          <td style={{ ...TD, fontWeight: 700, color: i < 3 ? "#b45309" : "#57534e" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </td>
                          <td style={{ ...TD, textAlign: "left", fontWeight: isMe ? 700 : 500 }}>
                            {entry.bracketName || "Anonymous"}
                            {isMe && <span style={{ fontSize: 10, color: "#3b82f6", marginLeft: 6 }}>(you)</span>}
                          </td>
                          <td style={TD}>{Object.keys(entry.picks).length}</td>
                          <td style={{ ...TD, fontWeight: 700, color: "#0a1a2f", fontSize: 15 }}>
                            {hasResults ? entry.score.total : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={TD}>
                            {hasResults ? <>{entry.score.correct} <span style={{ color: "#a8a29e" }}>/ {gamesPlayed}</span></> : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...TD, color: "#64748b" }}>
                            {hasResults ? entry.score.possible : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={{ ...TD, fontWeight: 700, color: "#b45309", fontSize: 13 }}>
                            {entry.bbmiRank > 0
                              ? `#${entry.bbmiRank}`
                              : <span style={{ color: "#d1d5db" }}>—</span>}
                          </td>
                          <td style={TD}>
                            {champTeam ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center" }}>
                                <NCAALogo teamName={champTeam.name} size={16} />
                                <span style={{ fontSize: 12, fontWeight: 600 }}>{champTeam.seed} {champTeam.name}</span>
                              </div>
                            ) : <span style={{ color: "#a8a29e" }}>—</span>}
                          </td>
                          <td style={TD}>
                            <button
                              onClick={() => setSelectedUserId(isSelected ? null : entry.userId)}
                              style={{
                                fontSize: 11, fontWeight: 600,
                                color: isSelected ? "#fff" : "#3b82f6",
                                background: isSelected ? "#1d4ed8" : "none",
                                border: isSelected ? "1px solid #1d4ed8" : "1px solid #bfdbfe",
                                borderRadius: 4, padding: "2px 8px", cursor: "pointer",
                              }}
                            >
                              {isSelected ? "Hide" : "View"}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded bracket row */}
                        {isSelected && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0, borderTop: "2px solid #3b82f6" }}>
                              <div style={{
                                background: "linear-gradient(90deg, #0a1628 0%, #1e3a5f 100%)",
                                color: "#fff", padding: "9px 18px",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                              }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>
                                  {entry.bracketName}&apos;s Bracket
                                </span>
                                <span style={{ fontSize: 11, color: "#64748b" }}>
                                  ← scroll to view full bracket →
                                </span>
                              </div>
                              <BracketView entry={entry} allTeams={allTeams} hasResults={hasResults} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {ranked.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontStyle: "italic" }}>
            No brackets submitted yet.{" "}
            <Link href="/bracket-challenge" style={{ color: "#3b82f6" }}>Be the first!</Link>
          </div>
        )}

        {/* Scoring key */}
        <div style={{
          maxWidth: 400, margin: "0 auto 40px",
          backgroundColor: "#f0f9ff", border: "1px solid #bae6fd",
          borderRadius: 10, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0c4a6e", marginBottom: 8 }}>📊 Scoring System</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "#0369a1" }}>
            {ROUND_NAMES.map((name, i) => (
              <React.Fragment key={name}>
                <span>{name}</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{ROUND_POINTS[i]} pts</span>
              </React.Fragment>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
