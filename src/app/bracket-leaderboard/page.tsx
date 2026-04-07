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

const GAME_DETAILS: Record<string, { teams: [string, string]; scores: [number, number] }> = (() => {
  const raw = tournamentResultsRaw as Record<string, unknown>;
  if (raw && raw._details && typeof raw._details === "object") {
    return raw._details as Record<string, { teams: [string, string]; scores: [number, number] }>;
  }
  return {};
})();

const isTournamentComplete = Boolean(ACTUAL_RESULTS["CHAMP|Final|0"]);

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
  const [selectedYear, setSelectedYear] = useState(2026);
  const availableYears = [2026]; // Add new years here as they happen
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
    backgroundColor: "#4a6fa5", color: "#ffffff",
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
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1100px] mx-auto px-4 sm:px-6 py-8">

        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#4a6fa5", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NCAA Basketball {"\u00B7"} Bracket Leaderboard
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 10px" }}>
            Bracket Challenge Leaderboard
          </h1>
          <p style={{ color: "#666", fontSize: 13, textAlign: "center", maxWidth: 1100, margin: "0 auto", lineHeight: 1.6 }}>
            {ranked.length} bracket{ranked.length !== 1 ? "s" : ""} submitted.
            {ACTUAL_RESULTS["CHAMP|Final|0"]
              ? <> {gamesPlayed} games played. {"\ud83c\udfc6"} Final Results — 2026 Inaugural Challenge</>
              : hasResults
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
                  border: `1px solid ${sortMode === mode ? "#4a6fa5" : "#d6d3d1"}`,
                  backgroundColor: sortMode === mode ? "#4a6fa5" : "#fff",
                  color: sortMode === mode ? "#f0f4ff" : "#57534e",
                  cursor: "pointer",
                }}
              >
                {mode === "score" ? "📊 Actual Score" : "🤖 BBMI Expected"}
              </button>
            ))}
          </div>

          <div style={{
            border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden",
            backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
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
                            : i % 2 === 0 ? "#f8f7f4" : "#fff",
                        }}>
                          <td style={{ ...TD, fontWeight: 700, color: i < 3 ? "#b45309" : "#57534e" }}>
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </td>
                          <td style={{ ...TD, textAlign: "left", fontWeight: isMe ? 700 : 500 }}>
                            {entry.bracketName || "Anonymous"}
                            {isMe && <span style={{ fontSize: 10, color: "#3b82f6", marginLeft: 6 }}>(you)</span>}
                          </td>
                          <td style={TD}>{Object.keys(entry.picks).length}</td>
                          <td style={{ ...TD, fontWeight: 700, color: "#4a6fa5", fontSize: 15 }}>
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
                                background: "linear-gradient(90deg, #3a5f8f 0%, #6a9bcf 100%)",
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
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0c4a6e", marginBottom: 8 }}>{"\ud83d\udcca"} Scoring System</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "#0369a1" }}>
            {ROUND_NAMES.map((name, i) => (
              <React.Fragment key={name}>
                <span>{name}</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{ROUND_POINTS[i]} pts</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Season Wrap Section ─────────────────────────────────────────── */}
        {isTournamentComplete && ranked.length > 0 && (() => {
          // ── Computed values ──────────────────────────────────────────────
          const champion = ranked[0];
          const champPickMode = (() => {
            const counts: Record<string, number> = {};
            ranked.forEach(e => {
              const pick = e.picks["CHAMP|Final|0"];
              if (pick) counts[pick] = (counts[pick] ?? 0) + 1;
            });
            let best = ""; let max = 0;
            Object.entries(counts).forEach(([t, c]) => { if (c > max) { max = c; best = t; } });
            return { team: best, count: max };
          })();
          const avgScore = Math.round(ranked.reduce((s, e) => s + e.score.total, 0) / ranked.length);

          // Bracket Breaker: the game result that the most brackets got wrong
          const bracketBreaker = (() => {
            const ROUND_PTS: Record<string, number> = { "PlayIn": 5, "R64": 10, "R32": 20, "S16": 40, "E8": 80, "F4": 160, "CHAMP": 320 };
            let worstKey = ""; let worstWrong = 0; let worstWinner = ""; let worstLoser = ""; let worstPts = 0;
            Object.entries(ACTUAL_RESULTS).forEach(([key, winner]) => {
              const round = key.split("|")[0];
              const pts = ROUND_PTS[round] ?? 0;
              const wrong = ranked.filter(e => e.picks[key] && e.picks[key] !== winner).length;
              // Weight by wrong count * points (late-round misses hurt more)
              const damage = wrong * pts;
              if (damage > worstWrong * worstPts) {
                worstKey = key; worstWrong = wrong; worstWinner = winner; worstPts = pts;
                // Find who the field picked instead
                const fieldPicks: Record<string, number> = {};
                ranked.forEach(e => { const p = e.picks[key]; if (p && p !== winner) fieldPicks[p] = (fieldPicks[p] ?? 0) + 1; });
                const topWrongPick = Object.entries(fieldPicks).sort((a, b) => b[1] - a[1])[0];
                worstLoser = topWrongPick ? topWrongPick[0] : "";
              }
            });
            const roundLabel = worstKey.split("|")[0];
            const roundName = ({ "R64": "Round of 64", "R32": "Round of 32", "S16": "Sweet 16", "E8": "Elite 8", "F4": "Final Four", "CHAMP": "Championship" } as Record<string, string>)[roundLabel] ?? roundLabel;
            return { key: worstKey, winner: worstWinner, loser: worstLoser, wrong: worstWrong, total: ranked.length, pts: worstPts, round: roundName };
          })();
          const bestAccEntry = ranked.reduce((best, e) =>
            (e.score.correct / gamesPlayed) > (best.score.correct / gamesPlayed) ? e : best, ranked[0]);
          const bestAccPct = ((bestAccEntry.score.correct / gamesPlayed) * 100).toFixed(1);

          // Biggest surprise: largest |bbmiRank - actualRank|
          const biggestSurprise = (() => {
            // actualRank = index in ranked (sorted by score) + 1
            let maxDelta = 0; let entry = ranked[0]; let actualRank = 1;
            ranked.forEach((e, i) => {
              const delta = Math.abs(e.bbmiRank - (i + 1));
              if (delta > maxDelta) { maxDelta = delta; entry = e; actualRank = i + 1; }
            });
            return { entry, actualRank, delta: maxDelta };
          })();

          // Champion pick accuracy
          const actualChamp = ACTUAL_RESULTS["CHAMP|Final|0"];
          const champCorrectCount = ranked.filter(e => e.picks["CHAMP|Final|0"] === actualChamp).length;
          const champAccPct = ((champCorrectCount / ranked.length) * 100).toFixed(1);

          // Top 3 upsets correctly called by at least one bracket
          const topUpsets = (() => {
            const teamSeedMap = new Map(allTeams.map(t => [`${t.name}|${t.region}`, t.seed]));
            const teamSeedByName = new Map(allTeams.map(t => [t.name, t.seed]));

            type Upset = { key: string; winner: string; loser: string; winnerSeed: number; loserSeed: number; diff: number; calledBy: typeof ranked; total: number };

            // Build all upsets sorted by seed differential (biggest first)
            const allUpsets: Omit<Upset, "calledBy" | "total">[] = [];
            Object.entries(GAME_DETAILS).forEach(([key, detail]) => {
              const [teamA, teamB] = detail.teams;
              const [scoreA, scoreB] = detail.scores;
              const winner = scoreA > scoreB ? teamA : teamB;
              const loser = scoreA > scoreB ? teamB : teamA;
              const region = key.split("|")[1];
              const wSeed = teamSeedMap.get(`${winner}|${region}`) ?? teamSeedByName.get(winner) ?? 0;
              const lSeed = teamSeedMap.get(`${loser}|${region}`) ?? teamSeedByName.get(loser) ?? 0;
              if (wSeed > lSeed) {
                allUpsets.push({ key, winner, loser, winnerSeed: wSeed, loserSeed: lSeed, diff: wSeed - lSeed });
              }
            });
            allUpsets.sort((a, b) => b.diff - a.diff);

            // Take top 3 upsets that at least one bracket called
            const result: Upset[] = [];
            for (const u of allUpsets) {
              const calledIt = ranked.filter(e => e.picks[u.key] === u.winner);
              if (calledIt.length > 0) {
                result.push({ ...u, calledBy: calledIt, total: ranked.length });
                if (result.length >= 3) break;
              }
            }
            return result;
          })();

          // BBMI model bracket
          const bbmiPicks: Record<string, string> = {};
          Object.entries(GAME_DETAILS).forEach(([key, detail]) => {
            const [teamA, teamB] = detail.teams;
            const scoreA = allTeams.find(t => t.name === teamA)?.bbmiScore ?? 0;
            const scoreB = allTeams.find(t => t.name === teamB)?.bbmiScore ?? 0;
            bbmiPicks[key] = scoreA >= scoreB ? teamA : teamB;
          });
          const bbmiScore = scoreEntry(bbmiPicks);
          // Where would BBMI finish?
          const bbmiPosition = ranked.filter(e => e.score.total > bbmiScore.total).length + 1;
          const bbmiAccPct = ((bbmiScore.correct / gamesPlayed) * 100).toFixed(1);
          // BBMI round breakdown
          const ROUND_PREFIXES_WRAP = ["R64", "R32", "S16", "E8", "F4", "CHAMP"];
          const ROUND_LABELS_WRAP = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
          const bbmiRoundBreakdown = ROUND_PREFIXES_WRAP.map(prefix => {
            const total = Object.keys(ACTUAL_RESULTS).filter(k => k.startsWith(prefix)).length;
            const correct = Object.entries(bbmiPicks).filter(([k, t]) => k.startsWith(prefix) && ACTUAL_RESULTS[k] === t).length;
            return { total, correct };
          });

          // Tweet text
          const bbmiComparison = bbmiPosition <= Math.ceil(ranked.length / 2)
            ? `top ${Math.round((bbmiPosition / ranked.length) * 100)}% of the field`
            : `#${bbmiPosition} of ${ranked.length}`;
          const bbmiCalledChamp = bbmiPicks["CHAMP|Final|0"] === actualChamp;
          const tweetText = encodeURIComponent(
            `The BBMI model scored ${bbmiScore.total} pts in the 2026 Bracket Challenge — ${bbmiComparison}. ${bbmiScore.correct}/${gamesPlayed} correct (${bbmiAccPct}%). ${bbmiCalledChamp ? `${actualChamp} called.` : ""} \ud83c\udfc6`
          );

          const sectionHeader: React.CSSProperties = {
            backgroundColor: "#eae8e1", color: "#333", fontSize: 16, fontWeight: 700,
            padding: "12px 20px", borderRadius: "10px 10px 0 0", marginTop: 32,
          };

          return (
            <div style={{ marginTop: 40 }}>
              {/* Year selector + Section title */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                  {availableYears.map(y => (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      style={{
                        padding: "6px 20px", borderRadius: 999, fontSize: 13,
                        border: selectedYear === y ? "none" : "1px solid #c0bdb5",
                        backgroundColor: selectedYear === y ? "#4a6fa5" : "transparent",
                        color: selectedYear === y ? "#ffffff" : "#555",
                        fontWeight: selectedYear === y ? 600 : 400, cursor: "pointer",
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
                  {"\uD83C\uDFC0"} {selectedYear} Season Wrap
                </h2>
                <p style={{ color: "#666", fontSize: 13, marginTop: 6 }}>
                  {selectedYear === 2026 ? "A look back at the inaugural BBMI Bracket Challenge" : `${selectedYear} BBMI Bracket Challenge results`}
                </p>
              </div>

              {/* 2A — Champion Card */}
              <div style={{
                background: "linear-gradient(135deg, #4a6fa5 0%, #3a5c8f 100%)",
                borderRadius: 12, padding: "32px 28px", color: "#fff", textAlign: "center",
                marginBottom: 24, boxShadow: "0 4px 12px rgba(74,111,165,0.3)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.85, marginBottom: 8 }}>
                  {"\uD83C\uDFC6"} {selectedYear} {selectedYear === 2026 ? "Inaugural " : ""}Champion
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
                  {champion.bracketName || "Anonymous"}
                </div>
                <div style={{ fontSize: 15, opacity: 0.9, marginBottom: 6 }}>
                  {champion.score.total} pts {"\u00b7"} {champion.score.correct}/{gamesPlayed} correct
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, opacity: 0.8 }}>Champion pick:</span>
                  {(() => {
                    const champTeam = allTeams.find(t => t.name === champion.picks["CHAMP|Final|0"]);
                    return champTeam ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <NCAALogo teamName={champTeam.name} size={18} />
                        <span style={{ fontWeight: 700 }}>{champTeam.seed} {champTeam.name}</span>
                      </span>
                    ) : <span>{champion.picks["CHAMP|Final|0"]}</span>;
                  })()}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, fontStyle: "italic" }}>
                  First-ever BBMI Bracket Challenge champion
                </div>
              </div>

              {/* 2B — Summary Stat Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { label: "Participants", value: ranked.length },
                  { label: "Games Played", value: gamesPlayed },
                  { label: "Most Popular Champ Pick", value: `${champPickMode.team} (${champPickMode.count})` },
                  { label: "Average Score", value: `${avgScore} pts` },
                ].map(stat => (
                  <div key={stat.label} style={{
                    backgroundColor: "#fff", borderRadius: 10, padding: "18px 16px", textAlign: "center",
                    border: "1px solid #d4d2cc", borderTop: "4px solid #4a6fa5",
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4, fontWeight: 500 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* 2C — Past Champions Shelf (Top 3) */}
              <div style={sectionHeader}>Past Champions</div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16,
                padding: 20, backgroundColor: "#fff", border: "1px solid #d4d2cc", borderTop: "none",
                borderRadius: "0 0 10px 10px", marginBottom: 24,
              }}>
                {ranked.slice(0, 3).map((entry, i) => {
                  const trophyEmoji = ["\ud83e\udd47", "\ud83e\udd48", "\ud83e\udd49"][i];
                  const trophyColor = ["#d4a017", "#9ca3af", "#b87333"][i];
                  const champTeam = allTeams.find(t => t.name === entry.picks["CHAMP|Final|0"]);
                  return (
                    <div key={entry.userId} style={{
                      textAlign: "center", padding: "20px 16px",
                      border: `2px solid ${trophyColor}`, borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 32 }}>{trophyEmoji}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginTop: 6 }}>
                        {entry.bracketName || "Anonymous"}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#4a6fa5", marginTop: 4 }}>
                        {entry.score.total} pts
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                        Champion pick:{" "}
                        {champTeam && <NCAALogo teamName={champTeam.name} size={14} />}
                        <span style={{ fontWeight: 600 }}>{entry.picks["CHAMP|Final|0"]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 2D — Fun Stats Row */}
              <div style={sectionHeader}>Fun Stats</div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16,
                padding: 20, backgroundColor: "#fff", border: "1px solid #d4d2cc", borderTop: "none",
                borderRadius: "0 0 10px 10px", marginBottom: 24,
              }}>
                <div style={{ padding: 12, borderLeft: "3px solid #dc2626" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>Bracket Breaker</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", marginTop: 4 }}>{bracketBreaker.winner}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{bracketBreaker.round} — {bracketBreaker.wrong}/{bracketBreaker.total} got it wrong ({bracketBreaker.pts} pts each)</div>
                </div>
                <div style={{ padding: 12, borderLeft: "3px solid #4a6fa5" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Best Accuracy</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginTop: 4 }}>{bestAccPct}%</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{bestAccEntry.bracketName} ({bestAccEntry.score.correct}/{gamesPlayed})</div>
                </div>
                <div style={{ padding: 12, borderLeft: "3px solid #4a6fa5" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Biggest Surprise</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginTop: 4 }}>{biggestSurprise.entry.bracketName}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    BBMI #{biggestSurprise.entry.bbmiRank} {"\u2192"} Actual #{biggestSurprise.actualRank} ({biggestSurprise.delta} spot{biggestSurprise.delta !== 1 ? "s" : ""})
                  </div>
                </div>
                <div style={{ padding: 12, borderLeft: "3px solid #4a6fa5" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4a6fa5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Champion Pick Accuracy</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", marginTop: 4 }}>{champAccPct}%</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{champCorrectCount}/{ranked.length} picked {actualChamp}</div>
                </div>
              </div>

              {/* 2E — Top 3 Upsets Correctly Called */}
              {topUpsets.length > 0 && (
                <>
                  <div style={sectionHeader}>Top Upsets Correctly Called</div>
                  <div style={{
                    backgroundColor: "#fff", border: "1px solid #d4d2cc", borderTop: "none",
                    borderRadius: "0 0 10px 10px", marginBottom: 24,
                  }}>
                    {topUpsets.map((u, i) => (
                      <div key={u.key} style={{
                        padding: "16px 20px",
                        borderTop: i > 0 ? "1px solid #ece9e2" : "none",
                        display: "flex", alignItems: "flex-start", gap: 12,
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 800, color: "#fff",
                          backgroundColor: i === 0 ? "#4a6fa5" : i === 1 ? "#6b8dbd" : "#94a3b8",
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <NCAALogo teamName={u.winner} size={22} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
                              ({u.winnerSeed}) {u.winner} over ({u.loserSeed}) {u.loser}
                            </span>
                            <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>
                              {u.diff}-seed upset
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#4a6fa5", fontWeight: 600, marginTop: 6 }}>
                            {u.calledBy.map(e => e.bracketName).join(", ")} called it — {u.calledBy.length}/{u.total} brackets
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 2F — BBMI Model Performance */}
              <div style={sectionHeader}>BBMI Model Performance</div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0,
                backgroundColor: "#fff", border: "1px solid #d4d2cc", borderTop: "none",
                borderRadius: "0 0 10px 10px", marginBottom: 24,
              }}>
                {/* Left — Key stats */}
                <div style={{ padding: 20, borderRight: "1px solid #d4d2cc" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Key Stats</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 12, color: "#666" }}>Score</span>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#4a6fa5" }}>{bbmiScore.total} pts</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#666" }}>Correct Picks</span>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{bbmiScore.correct}/{gamesPlayed}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#666" }}>Accuracy</span>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>{bbmiAccPct}%</div>
                    </div>
                    <div>
                      <span style={{ fontSize: 12, color: "#666" }}>Would Have Finished</span>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#b45309" }}>#{bbmiPosition} of {ranked.length}</div>
                    </div>
                    <Link href="/bracket-validation" style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none", marginTop: 4 }}>
                      View Full Model Bracket {"\u2192"}
                    </Link>
                  </div>
                </div>
                {/* Right — Round accuracy */}
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", marginBottom: 12 }}>Round Accuracy</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", fontWeight: 600, color: "#666", paddingBottom: 8, fontSize: 11 }}>Round</th>
                        <th style={{ textAlign: "center", fontWeight: 600, color: "#666", paddingBottom: 8, fontSize: 11 }}>Correct</th>
                        <th style={{ textAlign: "center", fontWeight: 600, color: "#666", paddingBottom: 8, fontSize: 11 }}>Pct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bbmiRoundBreakdown.map((rd, i) => (
                        <tr key={ROUND_PREFIXES_WRAP[i]} style={{ borderTop: "1px solid #f0f0ef" }}>
                          <td style={{ padding: "6px 0", fontWeight: 500 }}>{ROUND_LABELS_WRAP[i]}</td>
                          <td style={{ textAlign: "center", color: "#4a6fa5", fontWeight: 600 }}>{rd.correct}/{rd.total}</td>
                          <td style={{ textAlign: "center", color: "#666" }}>
                            {rd.total > 0 ? `${((rd.correct / rd.total) * 100).toFixed(0)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          );
        })()}

      </div>
    </div>
  );
}
