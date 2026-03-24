"use client";

import React, { useMemo } from "react";
import NCAALogo from "@/components/NCAALogo";
import tournamentResultsRaw from "@/data/seeding/tournament-results.json";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BracketTeam = {
  name: string;
  seed: number;
  region: string;
  playIn?: boolean;
  bbmiScore: number;
};

export type BracketEntry = {
  userId: string;
  bracketName: string;
  email: string;
  picks: Record<string, string>;
  complete: boolean;
  updatedAt: unknown;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const R64_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

const ROUND_NAMES    = ["Play-In", "Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
const ROUND_POINTS   = [5, 10, 20, 40, 80, 160, 320];
const ROUND_PREFIXES = ["PlayIn|", "R64|", "R32|", "S16|", "E8|", "F4|", "CHAMP|"];

const LEFT_REGIONS  = ["East", "West"];
const RIGHT_REGIONS = ["South", "Midwest"];

const ACTUAL_RESULTS: Record<string, string> = (() => {
  const results: Record<string, string> = {};
  if (tournamentResultsRaw && typeof tournamentResultsRaw === "object") {
    for (const [k, v] of Object.entries(tournamentResultsRaw as Record<string, unknown>)) {
      if (k !== "_details" && typeof v === "string") results[k] = v;
    }
  }
  return results;
})();

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreEntry(picks: Record<string, string>): {
  total: number; byRound: number[]; correct: number; possible: number;
} {
  const byRound = ROUND_PREFIXES.map((prefix, ri) => {
    let s = 0;
    Object.entries(picks).forEach(([k, t]) => {
      if (!k.startsWith(prefix)) return;
      if (ACTUAL_RESULTS[k] && ACTUAL_RESULTS[k] === t) s += ROUND_POINTS[ri];
    });
    return s;
  });
  const total   = byRound.reduce((s, v) => s + v, 0);
  const correct = Object.entries(picks).filter(([k, t]) => ACTUAL_RESULTS[k] === t).length;
  const decided = new Set(Object.keys(ACTUAL_RESULTS));
  let possible  = total;
  Object.entries(picks).forEach(([k]) => {
    if (decided.has(k)) return;
    const ri = ROUND_PREFIXES.findIndex(p => k.startsWith(p));
    if (ri >= 0) possible += ROUND_POINTS[ri];
  });
  return { total, byRound, correct, possible };
}

// ── Layout constants ──────────────────────────────────────────────────────────

const SLOT_H   = 20;
const GAME_H   = SLOT_H * 2 + 1;
const PAIR_V   = 3;
const COL_W    = 143;
const COL_GAP  = 8;
const PLAYIN_W = 86;
const REGION_H = 8 * GAME_H + 7 * PAIR_V;

function gameTop(ri: number, gi: number): number {
  const spacing = (GAME_H + PAIR_V) * Math.pow(2, ri);
  const offset  = (spacing - GAME_H) / 2;
  return Math.round(offset + gi * spacing);
}

function gameMid(ri: number, gi: number): number {
  return gameTop(ri, gi) + GAME_H / 2;
}

// ── BracketMatchupSlot ────────────────────────────────────────────────────────

function BracketMatchupSlot({
  team, pickKey, pickedWinner, allTeams, isTop, eliminatedTeams,
}: {
  team: string | undefined;
  pickKey: string;
  pickedWinner: string | undefined;
  allTeams: BracketTeam[];
  isTop: boolean;
  eliminatedTeams: Map<string, string>;
}) {
  const isPicked   = !!(team && pickedWinner === team);
  const teamData   = team ? allTeams.find(t => t.name === team) : undefined;

  // New highlight rule: green if user's team in this position matches actual team in this position.
  // For R64: all seeded teams are correct (they're actually in R64), except wrong play-in picks.
  // For later rounds: the actual team in this slot is the winner of the feeder game.
  const currentRound = pickKey.split("|")[0];
  const region = pickKey.split("|")[1];
  const slot = parseInt(pickKey.split("|")[2] ?? "0");
  const ROUND_ORDER_LOCAL = ["PlayIn", "R64", "R32", "S16", "E8", "F4", "CHAMP"];
  const FEEDER_ROUND: Record<string, string> = { R32: "R64", S16: "R32", E8: "S16", F4: "E8", CHAMP: "F4" };

  let matchesActual = false;
  let isBusted = false;

  if (currentRound === "PlayIn") {
    const actual = ACTUAL_RESULTS[pickKey];
    matchesActual = !!(actual && team && actual === team);
    isBusted = !!(actual && team && actual !== team && isPicked);
  } else if (currentRound === "R64") {
    // Check play-in: if this seed had a play-in, verify the pick matches the actual play-in winner
    if (team && teamData?.playIn) {
      const piKey = `PlayIn|${region}|${teamData.seed}`;
      const piActual = ACTUAL_RESULTS[piKey];
      if (piActual) {
        matchesActual = team === piActual;
        isBusted = team !== piActual;
      } else {
        matchesActual = false; // play-in not decided yet
      }
    } else {
      matchesActual = !!team; // non-play-in teams are always correctly in R64
    }
  } else {
    // Later rounds: find the feeder game that produces this position
    // For R32: team in top/bottom slot came from R64 slot (i*2) or (i*2+1)
    // The pickKey for R32 is "R32|region|gameSlot" but team positions are feeder-based
    // We need to determine which feeder result placed this team here
    const feederRound = FEEDER_ROUND[currentRound];
    if (feederRound && team) {
      // The team is here because user picked them to win a prior game.
      // Check if the team actually won that prior game (i.e., actually reached this round)
      const elimRound = eliminatedTeams.get(team);
      const elimIdx = elimRound ? ROUND_ORDER_LOCAL.indexOf(elimRound) : -1;
      const currentIdx = ROUND_ORDER_LOCAL.indexOf(currentRound);
      if (elimIdx >= 0 && elimIdx < currentIdx) {
        // Team was eliminated before this round
        isBusted = true;
      } else {
        // Team has not been eliminated before this round
        // Check if feeder round is fully decided for this team
        // If the team is still alive or won through to this round, it matches
        const feederIdx = ROUND_ORDER_LOCAL.indexOf(feederRound);
        if (elimIdx === feederIdx) {
          // Team was eliminated IN the feeder round (lost the game that would advance them here)
          isBusted = true;
        } else if (elimIdx < 0) {
          // Team not eliminated at all — check if feeder round game has been played
          // If feeder game result exists and team won, they're correctly here
          // We can check: does ACTUAL_RESULTS have any key for feeder round where this team won?
          const feederKeys = Object.keys(ACTUAL_RESULTS).filter(k => k.startsWith(`${feederRound}|${region}|`));
          const teamWonFeeder = feederKeys.some(k => ACTUAL_RESULTS[k] === team);
          const feederDecided = feederKeys.length > 0;
          if (currentRound === "F4" || currentRound === "CHAMP") {
            // F4/CHAMP span regions, check all feeder results
            const allFeederKeys = Object.keys(ACTUAL_RESULTS).filter(k => k.startsWith(`${feederRound}|`));
            const wonAny = allFeederKeys.some(k => ACTUAL_RESULTS[k] === team);
            matchesActual = wonAny;
          } else if (teamWonFeeder) {
            matchesActual = true;
          } else if (!feederDecided) {
            // Feeder not played yet — no highlight
            matchesActual = false;
          }
        } else {
          // elimIdx > currentIdx: shouldn't happen, but treat as alive
          matchesActual = true;
        }
      }
    }
  }

  const isCorrect = matchesActual && !isBusted;
  const isWrong = isBusted;

  const bg = isCorrect    ? "rgba(22,163,74,0.09)"
           : isWrong      ? "rgba(220,38,38,0.07)"
           : isPicked     ? "rgba(59,130,246,0.08)"
           : "#fff";
  const fg = isCorrect    ? "#15803d"
           : isWrong      ? "#b91c1c"
           : isPicked     ? "#1d4ed8"
           : team         ? "#0f172a"
           : "#c4c9d4";
  const borderC = isCorrect ? "#86efac" : isWrong ? "#fca5a5" : isPicked ? "#93c5fd" : "#e2e8f0";
  const strikeThrough = isBusted;

  return (
    <div style={{
      height: SLOT_H, display: "flex", alignItems: "center", gap: 3,
      padding: "0 4px", backgroundColor: bg,
      borderTop:    isTop  ? `1px solid ${borderC}` : "none",
      borderBottom: !isTop ? `1px solid ${borderC}` : "none",
      overflow: "hidden",
    }}>
      {team ? (
        <>
          <span style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", minWidth: 12, textAlign: "right", flexShrink: 0 }}>
            {teamData?.seed ?? ""}
          </span>
          <NCAALogo teamName={team} size={11} />
          <span style={{ fontSize: 9.5, fontWeight: isPicked ? 700 : 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: strikeThrough ? "line-through" : "none" }}>
            {team}
          </span>
          {isCorrect && <span style={{ fontSize: 8, color: "#16a34a", flexShrink: 0 }}>✓</span>}
          {isWrong && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
          {isPicked && !isCorrect && !isWrong && <span style={{ fontSize: 7, color: "#3b82f6", flexShrink: 0 }}>●</span>}
        </>
      ) : (
        <span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic", paddingLeft: 2 }}>TBD</span>
      )}
    </div>
  );
}

// ── ConnectorSVG ──────────────────────────────────────────────────────────────

function ConnectorSVG({
  fromRi, fromCount, side,
}: {
  fromRi: number; fromCount: number; side: "left" | "right";
}) {
  const W = COL_GAP;
  const H = REGION_H;
  const midX = W / 2;
  const lines: React.ReactNode[] = [];

  for (let gi = 0; gi < fromCount; gi += 2) {
    const yTop  = gameMid(fromRi, gi);
    const yBot  = gameMid(fromRi, gi + 1);
    const yNext = gameMid(fromRi + 1, gi / 2);

    if (side === "left") {
      lines.push(
        <g key={gi} stroke="#d1d5db" strokeWidth={1} fill="none">
          <line x1={0}    y1={yTop}  x2={midX} y2={yTop} />
          <line x1={0}    y1={yBot}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yTop}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yNext} x2={W}    y2={yNext} />
        </g>
      );
    } else {
      lines.push(
        <g key={gi} stroke="#d1d5db" strokeWidth={1} fill="none">
          <line x1={W}    y1={yTop}  x2={midX} y2={yTop} />
          <line x1={W}    y1={yBot}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yTop}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yNext} x2={0}    y2={yNext} />
        </g>
      );
    }
  }

  return (
    <svg width={W} height={H} style={{ flexShrink: 0, display: "block", overflow: "visible" }}>
      {lines}
    </svg>
  );
}

// ── PlayInTeamRow ─────────────────────────────────────────────────────────────

function PlayInTeamRow({ team, winner, actual }: { team: BracketTeam; winner: string | undefined; actual: string | undefined }) {
  const isPicked  = winner === team.name;
  const isActual  = actual === team.name;
  const isCorrect = isPicked && isActual;
  const isWrong   = isPicked && !!actual && !isActual;
  const isElim    = !!actual && actual !== team.name;
  const bg = isCorrect ? "rgba(22,163,74,0.09)" : isWrong ? "rgba(220,38,38,0.07)" : isPicked ? "rgba(59,130,246,0.07)" : "#fff";
  const fg = isCorrect ? "#15803d" : isWrong ? "#b91c1c" : isPicked ? "#1d4ed8" : "#0f172a";
  return (
    <div style={{
      height: SLOT_H, display: "flex", alignItems: "center", gap: 3,
      padding: "0 4px", backgroundColor: bg, borderBottom: "1px solid #f1f5f9",
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", minWidth: 13, textAlign: "right", flexShrink: 0 }}>{team.seed}</span>
      <NCAALogo teamName={team.name} size={11} />
      <span style={{ fontSize: 9.5, fontWeight: isPicked ? 700 : 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {team.name}
      </span>
      {isCorrect && <span style={{ fontSize: 8, color: "#16a34a", flexShrink: 0 }}>✓</span>}
      {isWrong   && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
    </div>
  );
}

// ── RegionBracket ─────────────────────────────────────────────────────────────

const REGIONAL_ROUNDS = [
  { prefix: "R64", ri: 0, count: 8, pts: 10  },
  { prefix: "R32", ri: 1, count: 4, pts: 20  },
  { prefix: "S16", ri: 2, count: 2, pts: 40  },
  { prefix: "E8",  ri: 3, count: 1, pts: 80  },
];

const REGION_COLORS: Record<string, string> = {
  East: "#3b82f6", West: "#8b5cf6", South: "#ef4444", Midwest: "#f59e0b",
};

function RegionBracket({
  region, side, picks, allTeams, reservePlayIn = false, eliminatedTeams,
}: {
  region: string; side: "left" | "right"; picks: Record<string, string>; allTeams: BracketTeam[];
  reservePlayIn?: boolean; eliminatedTeams: Map<string, string>;
}) {
  const color = REGION_COLORS[region] ?? "#64748b";
  const cols = side === "left" ? REGIONAL_ROUNDS : [...REGIONAL_ROUNDS].reverse();

  const playInSeeds = [...new Set(
    allTeams.filter(t => t.region === region && t.playIn).map(t => t.seed)
  )];
  const playIns: { seed: number; feedsSlot: number }[] = playInSeeds.map(seed => {
    const slotIdx = R64_MATCHUPS.findIndex(([s1, s2]) => s1 === seed || s2 === seed);
    return { seed, feedsSlot: slotIdx >= 0 ? slotIdx : 0 };
  }).sort((a, b) => a.feedsSlot - b.feedsSlot);

  // Reserve play-in column space if this region has play-ins OR if another
  // region on the same side does (so columns stay aligned across regions).
  const showPlayInSpace = playIns.length > 0 || reservePlayIn;

  function pick(prefix: string, slotIdx: number) {
    return picks[`${prefix}|${region}|${slotIdx}`];
  }

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 4,
        color, display: "flex", alignItems: "center", gap: 5,
        flexDirection: side === "right" ? "row-reverse" : "row",
      }}>
        <span style={{ display: "inline-block", width: 3, height: 12, backgroundColor: color, borderRadius: 2 }} />
        {region}
      </div>

      <div style={{ display: "flex", flexDirection: "row", gap: 0, marginBottom: 2 }}>
        {side === "left" && showPlayInSpace && (
          <div style={{ width: PLAYIN_W + COL_GAP, flexShrink: 0 }} />
        )}
        {cols.map(({ prefix, pts }, ci) => (
          <React.Fragment key={prefix}>
            <div style={{
              width: COL_W, flexShrink: 0, textAlign: "center",
              fontSize: 8.5, fontWeight: 700, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {prefix} <span style={{ color: "#cbd5e1", fontWeight: 400 }}>{pts}pt</span>
            </div>
            {ci < cols.length - 1 && <div style={{ width: COL_GAP, flexShrink: 0 }} />}
          </React.Fragment>
        ))}
        {side === "right" && showPlayInSpace && (
          <div style={{ width: PLAYIN_W + COL_GAP, flexShrink: 0 }} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "row", gap: 0, position: "relative" }}>
        {side === "left" && showPlayInSpace && (
          playIns.length > 0 ? (
            <div style={{ position: "relative", width: PLAYIN_W + COL_GAP, height: REGION_H, flexShrink: 0 }}>
              {playIns.map(({ seed, feedsSlot }) => {
                const pickKey = `PlayIn|${region}|${seed}`;
                const winner  = picks[pickKey];
                const actual  = ACTUAL_RESULTS[pickKey];
                const piTeams = allTeams.filter(t => t.region === region && t.seed === seed && t.playIn);
                const yGame = gameTop(0, feedsSlot);
                const yMid  = yGame + GAME_H / 2;
                return (
                  <React.Fragment key={seed}>
                    <div style={{ position: "absolute", top: yGame, left: 0, width: PLAYIN_W }}>
                      <div style={{
                        border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
                        backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{
                          backgroundColor: "#7c2d12", borderBottom: "1px solid #e2e8f0",
                          fontSize: 7, fontWeight: 800, color: "#fff",
                          padding: "1px 4px", textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                          First Four · #{seed}
                        </div>
                        {piTeams.length >= 2
                          ? piTeams.map(t => <PlayInTeamRow key={t.name} team={t} winner={winner} actual={actual} />)
                          : <div style={{ height: SLOT_H, display: "flex", alignItems: "center", padding: "0 6px" }}><span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic" }}>TBD</span></div>
                        }
                      </div>
                      {winner && <div style={{ textAlign: "right", fontSize: 7, color: "#64748b", marginTop: 1, paddingRight: 4 }}>→ {winner}</div>}
                    </div>
                    <svg style={{ position: "absolute", top: 0, left: PLAYIN_W, pointerEvents: "none" }} width={COL_GAP} height={REGION_H} overflow="visible">
                      <line x1={0} y1={yMid} x2={COL_GAP} y2={yMid} stroke="#d1d5db" strokeWidth={1} />
                    </svg>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ width: PLAYIN_W + COL_GAP, flexShrink: 0 }} />
          )
        )}

        {cols.map(({ prefix, ri, count }, ci) => (
          <React.Fragment key={prefix}>
            {ci > 0 && count < (cols[ci - 1]?.count ?? count) && (
              <ConnectorSVG fromRi={cols[ci - 1].ri} fromCount={cols[ci - 1].count} side={side} />
            )}
            <div style={{ position: "relative", width: COL_W, height: REGION_H, flexShrink: 0 }}>
              {Array.from({ length: count }, (_, gi) => {
                let topTeamName: string | undefined;
                let botTeamName: string | undefined;
                const pickKey = `${prefix}|${region}|${gi}`;
                const pickedWinner = pick(prefix, gi);

                if (prefix === "R64") {
                  const [topSeed, botSeed] = R64_MATCHUPS[gi];
                  const topHasPlayIn = allTeams.some(t => t.region === region && t.seed === topSeed && t.playIn);
                  const botHasPlayIn = allTeams.some(t => t.region === region && t.seed === botSeed && t.playIn);
                  topTeamName = topHasPlayIn
                    ? (picks[`PlayIn|${region}|${topSeed}`] ?? undefined)
                    : allTeams.find(t => t.region === region && t.seed === topSeed && !t.playIn)?.name;
                  botTeamName = botHasPlayIn
                    ? (picks[`PlayIn|${region}|${botSeed}`] ?? undefined)
                    : allTeams.find(t => t.region === region && t.seed === botSeed && !t.playIn)?.name;
                } else {
                  const prevPrefix = prefix === "R32" ? "R64" : prefix === "S16" ? "R32" : "S16";
                  topTeamName = pick(prevPrefix, gi * 2);
                  botTeamName = pick(prevPrefix, gi * 2 + 1);
                }

                return (
                  <div key={gi} style={{
                    position: "absolute", top: gameTop(ri, gi), left: 0, width: COL_W,
                    border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
                    backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                  }}>
                    <BracketMatchupSlot team={topTeamName} pickKey={pickKey} pickedWinner={pickedWinner} allTeams={allTeams} isTop={true} eliminatedTeams={eliminatedTeams} />
                    <div style={{ height: 1, backgroundColor: "#f1f5f9" }} />
                    <BracketMatchupSlot team={botTeamName} pickKey={pickKey} pickedWinner={pickedWinner} allTeams={allTeams} isTop={false} eliminatedTeams={eliminatedTeams} />
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {side === "right" && showPlayInSpace && (
          playIns.length > 0 ? (
            <div style={{ position: "relative", width: PLAYIN_W + COL_GAP, height: REGION_H, flexShrink: 0 }}>
              {playIns.map(({ seed, feedsSlot }) => {
                const pickKey = `PlayIn|${region}|${seed}`;
                const winner  = picks[pickKey];
                const actual  = ACTUAL_RESULTS[pickKey];
                const piTeams = allTeams.filter(t => t.region === region && t.seed === seed && t.playIn);
                const yGame = gameTop(0, feedsSlot);
                const yMid  = yGame + GAME_H / 2;
                return (
                  <React.Fragment key={seed}>
                    <div style={{ position: "absolute", top: yGame, right: 0, width: PLAYIN_W }}>
                      <div style={{
                        border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
                        backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{
                          backgroundColor: "#7c2d12", borderBottom: "1px solid #e2e8f0",
                          fontSize: 7, fontWeight: 800, color: "#fff",
                          padding: "1px 4px", textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>
                          First Four · #{seed}
                        </div>
                        {piTeams.length >= 2
                          ? piTeams.map(t => <PlayInTeamRow key={t.name} team={t} winner={winner} actual={actual} />)
                          : <div style={{ height: SLOT_H, display: "flex", alignItems: "center", padding: "0 6px" }}><span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic" }}>TBD</span></div>
                        }
                      </div>
                      {winner && <div style={{ textAlign: "left", fontSize: 7, color: "#64748b", marginTop: 1, paddingLeft: 4 }}>→ {winner}</div>}
                    </div>
                    <svg style={{ position: "absolute", top: 0, right: PLAYIN_W, pointerEvents: "none" }} width={COL_GAP} height={REGION_H} overflow="visible">
                      <line x1={COL_GAP} y1={yMid} x2={0} y2={yMid} stroke="#d1d5db" strokeWidth={1} />
                    </svg>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ width: PLAYIN_W + COL_GAP, flexShrink: 0 }} />
          )
        )}
      </div>
    </div>
  );
}

// ── ChampSlot ─────────────────────────────────────────────────────────────────

function ChampSlot({ team, pickKey, allTeams, eliminatedTeams }: {
  team: string | undefined; pickKey: string; allTeams: BracketTeam[]; eliminatedTeams: Map<string, string>;
}) {
  const actual  = ACTUAL_RESULTS[pickKey];
  const correct = !!(actual && team && actual === team);
  const wrong   = !!(actual && team && actual !== team);
  const elimRound = team ? eliminatedTeams.get(team) : undefined;
  const ROUND_ORDER = ["PlayIn", "R64", "R32", "S16", "E8", "F4", "CHAMP"];
  const currentRound = pickKey.split("|")[0];
  const isBusted = !!(elimRound && ROUND_ORDER.indexOf(elimRound) < ROUND_ORDER.indexOf(currentRound));
  const td      = team ? allTeams.find(t => t.name === team) : undefined;
  const bg      = correct ? "rgba(22,163,74,0.09)" : (wrong || isBusted) ? "rgba(220,38,38,0.07)" : "#f8fafc";
  const borderC = correct ? "#86efac" : (wrong || isBusted) ? "#fca5a5" : "#e2e8f0";
  const fg      = correct ? "#15803d" : (wrong || isBusted) ? "#b91c1c" : team ? "#0f172a" : "#c4c9d4";
  return (
    <div style={{
      height: SLOT_H + 4, display: "flex", alignItems: "center", gap: 5,
      padding: "0 10px", backgroundColor: bg,
      border: `1px solid ${borderC}`, borderRadius: 5, minWidth: 140,
    }}>
      {team ? (
        <>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", minWidth: 13, textAlign: "right" }}>{td?.seed}</span>
          <NCAALogo teamName={team} size={13} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: fg, whiteSpace: "nowrap", textDecoration: isBusted ? "line-through" : "none" }}>{team}</span>
          {correct && <span style={{ fontSize: 9, color: "#16a34a" }}>✓</span>}
          {(wrong || isBusted) && <span style={{ fontSize: 9, color: "#dc2626" }}>✗</span>}
        </>
      ) : (
        <span style={{ fontSize: 10, color: "#d1d5db", fontStyle: "italic" }}>TBD</span>
      )}
    </div>
  );
}

// ── BracketView (exported) ────────────────────────────────────────────────────

export default function BracketView({
  entry, allTeams, hasResults,
}: {
  entry: { picks: Record<string, string>; bracketName?: string; score: ReturnType<typeof scoreEntry> };
  allTeams: BracketTeam[];
  hasResults: boolean;
}) {
  const picks = entry.picks;
  const f4a   = picks["F4|Semi|0"];
  const f4b   = picks["F4|Semi|1"];
  const champ = picks["CHAMP|Final|0"];

  // ── Build set of eliminated teams from actual results ──────────────────
  // Walk the bracket round by round, tracking actual winners per slot.
  // Any team that played and lost is eliminated and should be crossed out
  // in every future round where the user picked them.
  const eliminatedTeams = useMemo(() => {
    const elim = new Map<string, string>(); // team → round eliminated
    const setElim = (name: string, round: string) => { if (!elim.has(name)) elim.set(name, round); };
    const regions = ["East", "West", "South", "Midwest"];

    for (const region of regions) {
      // R64: competitors from seeding
      const actualR64Winners: (string | undefined)[] = [];
      for (let gi = 0; gi < 8; gi++) {
        const [topSeed, botSeed] = R64_MATCHUPS[gi];
        const topHasPI = allTeams.some(t => t.region === region && t.seed === topSeed && t.playIn);
        const botHasPI = allTeams.some(t => t.region === region && t.seed === botSeed && t.playIn);

        // Handle play-in losers
        if (topHasPI) {
          const piKey = `PlayIn|${region}|${topSeed}`;
          const piWinner = ACTUAL_RESULTS[piKey];
          if (piWinner) {
            allTeams.filter(t => t.region === region && t.seed === topSeed && t.playIn && t.name !== piWinner)
              .forEach(t => setElim(t.name, "PlayIn"));
          }
        }
        if (botHasPI) {
          const piKey = `PlayIn|${region}|${botSeed}`;
          const piWinner = ACTUAL_RESULTS[piKey];
          if (piWinner) {
            allTeams.filter(t => t.region === region && t.seed === botSeed && t.playIn && t.name !== piWinner)
              .forEach(t => setElim(t.name, "PlayIn"));
          }
        }

        const topTeam = topHasPI
          ? ACTUAL_RESULTS[`PlayIn|${region}|${topSeed}`]
          : allTeams.find(t => t.region === region && t.seed === topSeed && !t.playIn)?.name;
        const botTeam = botHasPI
          ? ACTUAL_RESULTS[`PlayIn|${region}|${botSeed}`]
          : allTeams.find(t => t.region === region && t.seed === botSeed && !t.playIn)?.name;

        const r64Key = `R64|${region}|${gi}`;
        const r64Winner = ACTUAL_RESULTS[r64Key];
        if (r64Winner) {
          if (topTeam && topTeam !== r64Winner) setElim(topTeam, "R64");
          if (botTeam && botTeam !== r64Winner) setElim(botTeam, "R64");
        }
        actualR64Winners.push(r64Winner);
      }

      // R32: competitors are adjacent R64 actual winners
      const actualR32Winners: (string | undefined)[] = [];
      for (let gi = 0; gi < 4; gi++) {
        const r32Key = `R32|${region}|${gi}`;
        const r32Winner = ACTUAL_RESULTS[r32Key];
        if (r32Winner) {
          const t1 = actualR64Winners[gi * 2];
          const t2 = actualR64Winners[gi * 2 + 1];
          if (t1 && t1 !== r32Winner) setElim(t1, "R32");
          if (t2 && t2 !== r32Winner) setElim(t2, "R32");
        }
        actualR32Winners.push(r32Winner);
      }

      // S16
      const actualS16Winners: (string | undefined)[] = [];
      for (let gi = 0; gi < 2; gi++) {
        const s16Key = `S16|${region}|${gi}`;
        const s16Winner = ACTUAL_RESULTS[s16Key];
        if (s16Winner) {
          const t1 = actualR32Winners[gi * 2];
          const t2 = actualR32Winners[gi * 2 + 1];
          if (t1 && t1 !== s16Winner) setElim(t1, "S16");
          if (t2 && t2 !== s16Winner) setElim(t2, "S16");
        }
        actualS16Winners.push(s16Winner);
      }

      // E8
      const e8Key = `E8|${region}|0`;
      const e8Winner = ACTUAL_RESULTS[e8Key];
      if (e8Winner) {
        if (actualS16Winners[0] && actualS16Winners[0] !== e8Winner) setElim(actualS16Winners[0], "E8");
        if (actualS16Winners[1] && actualS16Winners[1] !== e8Winner) setElim(actualS16Winners[1], "E8");
      }
    }

    // F4 Semi 0 & 1
    for (let si = 0; si < 2; si++) {
      const f4Key = `F4|Semi|${si}`;
      const f4Winner = ACTUAL_RESULTS[f4Key];
      if (f4Winner) {
        const pairedRegions = si === 0 ? ["East", "South"] : ["Midwest", "West"];
        pairedRegions.forEach(r => {
          const e8w = ACTUAL_RESULTS[`E8|${r}|0`];
          if (e8w && e8w !== f4Winner) setElim(e8w, "F4");
        });
      }
    }

    // Championship
    const champWinner = ACTUAL_RESULTS["CHAMP|Final|0"];
    if (champWinner) {
      const s0 = ACTUAL_RESULTS["F4|Semi|0"];
      const s1 = ACTUAL_RESULTS["F4|Semi|1"];
      if (s0 && s0 !== champWinner) setElim(s0, "CHAMP");
      if (s1 && s1 !== champWinner) setElim(s1, "CHAMP");
    }

    return elim;
  }, [allTeams]);

  // Check if ANY region on each side has play-in teams, so all regions
  // on the same side reserve consistent column space for alignment.
  const leftHasPlayIns  = LEFT_REGIONS.some(r => allTeams.some(t => t.region === r && t.playIn));
  const rightHasPlayIns = RIGHT_REGIONS.some(r => allTeams.some(t => t.region === r && t.playIn));

  return (
    <div style={{ backgroundColor: "#f1f5f9", overflowX: "auto" }}>

      {/* Score bar */}
      {hasResults && (
        <div style={{ display: "flex", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
          {ROUND_NAMES.map((name, i) => (
            <div key={name} style={{
              flex: 1, textAlign: "center", padding: "5px 4px",
              borderRight: i < ROUND_NAMES.length - 1 ? "1px solid #f1f5f9" : "none",
            }}>
              <div style={{ fontSize: 8.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>
                {["PI","R64","R32","S16","E8","F4","🏆"][i]}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: entry.score.byRound[i] > 0 ? "#16a34a" : "#d1d5db" }}>
                {entry.score.byRound[i]}
              </div>
            </div>
          ))}
          <div style={{ flex: 1.3, textAlign: "center", padding: "5px 4px", backgroundColor: "#0a1628" }}>
            <div style={{ fontSize: 8.5, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 1 }}>Total</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#f0f4ff" }}>{entry.score.total}</div>
          </div>
        </div>
      )}

      {/* Main bracket */}
      <div style={{ padding: "8px 0 12px", display: "inline-flex", alignItems: "flex-start", gap: 8, minWidth: "max-content" }}>

        {/* LEFT: East + West */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LEFT_REGIONS.map(r => (
            <RegionBracket key={r} region={r} side="left" picks={picks} allTeams={allTeams} reservePlayIn={leftHasPlayIns} eliminatedTeams={eliminatedTeams} />
          ))}
        </div>

        {/* CENTER: Final Four + Champion */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 6, alignSelf: "center",
          minWidth: 156, paddingTop: 12,
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
            Final Four <span style={{ color: "#cbd5e1", fontWeight: 400 }}>160pt</span>
          </div>
          <ChampSlot team={f4a} pickKey="F4|Semi|0" allTeams={allTeams} eliminatedTeams={eliminatedTeams} />
          <ChampSlot team={f4b} pickKey="F4|Semi|1" allTeams={allTeams} eliminatedTeams={eliminatedTeams} />

          <div style={{
            marginTop: 8,
            background: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 60%, #0a1628 100%)",
            border: "2px solid #c9a84c",
            borderRadius: 10, padding: "10px 14px",
            textAlign: "center", minWidth: 150,
            boxShadow: "0 4px 20px rgba(201,168,76,0.2)",
          }}>
            <div style={{ fontSize: 20, marginBottom: 3 }}>🏆</div>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
              Champion · 320pt
            </div>
            {champ ? (() => {
              const champActualWinner = ACTUAL_RESULTS["CHAMP|Final|0"];
              const isChampCorrect = champActualWinner === champ;
              const isChampWrong = !!champActualWinner && champActualWinner !== champ;
              const champElimRound = eliminatedTeams.get(champ);
              const isChampBusted = !!champElimRound;
              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <NCAALogo teamName={champ} size={22} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>
                      #{allTeams.find(t => t.name === champ)?.seed}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 800, whiteSpace: "nowrap",
                      color: (isChampWrong || isChampBusted) ? "#fca5a5" : "#f0f4ff",
                      textDecoration: isChampBusted ? "line-through" : "none",
                    }}>{champ}</div>
                  </div>
                  {isChampCorrect && <span style={{ fontSize: 14, color: "#c9a84c" }}>✓</span>}
                  {(isChampWrong || isChampBusted) && <span style={{ fontSize: 12, color: "#dc2626" }}>✗</span>}
                </div>
              );
            })() : (
              <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>TBD</div>
            )}
          </div>
        </div>

        {/* RIGHT: South + Midwest */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RIGHT_REGIONS.map(r => (
            <RegionBracket key={r} region={r} side="right" picks={picks} allTeams={allTeams} reservePlayIn={rightHasPlayIns} eliminatedTeams={eliminatedTeams} />
          ))}
        </div>

      </div>
    </div>
  );
}
