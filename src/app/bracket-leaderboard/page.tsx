"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import seedingData from "@/data/seeding/seeding.json";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/app/firebase-config";
import { useAuth } from "@/app/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = {
  name: string;
  seed: number;
  region: string;
  playIn?: boolean;
};

// Standard NCAA bracket matchups per region (game index → [topSeed, bottomSeed])
const R64_MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

type BracketEntry = {
  userId: string;
  bracketName: string;
  email: string;
  picks: Record<string, string>;
  complete: boolean;
  updatedAt: unknown;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ROUND_NAMES    = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
const ROUND_POINTS   = [10, 20, 40, 80, 160, 320];
const ROUND_PREFIXES = ["R64|", "R32|", "S16|", "E8|", "F4|", "CHAMP|"];

// Left side: R64 on far-left, E8 nearest center
// Right side: R64 on far-right, E8 nearest center (mirrored)
const LEFT_REGIONS  = ["East", "South"];
const RIGHT_REGIONS = ["West", "Midwest"];

// Play-in slot lookup: for a given seed, which R64_MATCHUPS slot index does it appear in?
// Derived at runtime from R64_MATCHUPS rather than hardcoded.

import tournamentResultsRaw from "@/data/seeding/tournament-results.json";
const ACTUAL_RESULTS: Record<string, string> = tournamentResultsRaw as Record<string, string>;

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreEntry(picks: Record<string, string>): {
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

const SLOT_H   = 24;               // height of one team row px
const GAME_H   = SLOT_H * 2 + 1;  // two rows + 1px divider = 49px
const PAIR_V   = 5;                // vertical gap between consecutive games
const COL_W    = 132;              // width of each round column
const COL_GAP  = 14;               // gap between columns (SVG connector space)
const PLAYIN_W = 100;              // width of play-in column

// Total region height: 8 games × GAME_H + 7 gaps
const REGION_H = 8 * GAME_H + 7 * PAIR_V;

// Vertical top of game gi in round ri (0-indexed)
function gameTop(ri: number, gi: number): number {
  const spacing = (GAME_H + PAIR_V) * Math.pow(2, ri);
  const offset  = (spacing - GAME_H) / 2;
  return Math.round(offset + gi * spacing);
}

// Midpoint of a game's full height
function gameMid(ri: number, gi: number): number {
  return gameTop(ri, gi) + GAME_H / 2;
}

// ── BracketSlot ───────────────────────────────────────────────────────────────

function BracketSlot({
  pickKey, team, allTeams, isTop, dimmed = false,
}: {
  pickKey: string; team: string | undefined; allTeams: Team[]; isTop: boolean; dimmed?: boolean;
}) {
  const actual    = ACTUAL_RESULTS[pickKey];
  const isCorrect = !!(actual && team && actual === team);
  const isWrong   = !!(actual && team && actual !== team);
  const teamData  = team ? allTeams.find(t => t.name === team) : undefined;

  const bg      = isCorrect ? "rgba(22,163,74,0.09)"  : isWrong ? "rgba(220,38,38,0.07)" : team ? "#fff" : "#f8fafc";
  const fg      = isCorrect ? "#15803d" : isWrong ? "#b91c1c" : team ? (dimmed ? "#94a3b8" : "#0f172a") : "#c4c9d4";
  const borderC = isCorrect ? "#86efac" : isWrong ? "#fca5a5" : "#e2e8f0";

  return (
    <div style={{
      height: SLOT_H,
      display: "flex", alignItems: "center", gap: 3,
      padding: "0 4px",
      backgroundColor: bg,
      borderTop:    isTop  ? `1px solid ${borderC}` : "none",
      borderBottom: !isTop ? `1px solid ${borderC}` : "none",
      overflow: "hidden",
    }}>
      {team ? (
        <>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", minWidth: 13, textAlign: "right", flexShrink: 0 }}>
            {teamData?.seed ?? ""}
          </span>
          <NCAALogo teamName={team} size={12} />
          <span style={{ fontSize: 10.5, fontWeight: 600, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {team}
          </span>
          {isCorrect && <span style={{ fontSize: 8, color: "#16a34a", flexShrink: 0 }}>✓</span>}
          {isWrong   && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
        </>
      ) : (
        <span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic", paddingLeft: 2 }}>TBD</span>
      )}
    </div>
  );
}

// ── BracketMatchupSlot ────────────────────────────────────────────────────────
// Shows one team in a matchup. pickKey holds the winner; highlights the picked
// winner in blue, dims the loser, colors correct/wrong once results are in.

function BracketMatchupSlot({
  team, pickKey, pickedWinner, allTeams, isTop,
}: {
  team: string | undefined;       // this team's name
  pickKey: string;                // e.g. "R64|South|3" — stores the winner
  pickedWinner: string | undefined; // what the user picked for this game
  allTeams: Team[];
  isTop: boolean;
}) {
  const actual     = ACTUAL_RESULTS[pickKey];          // actual winner of this game
  const isPicked   = !!(team && pickedWinner === team); // user picked this team
  const isActualWinner = !!(actual && team && actual === team);
  const isCorrect  = isPicked && isActualWinner;
  const isWrong    = isPicked && !!actual && !isActualWinner;
  const isEliminated = !!(actual && team && actual !== team); // game decided, this team lost
  const teamData   = team ? allTeams.find(t => t.name === team) : undefined;

  const bg = isCorrect  ? "rgba(22,163,74,0.09)"
           : isWrong    ? "rgba(220,38,38,0.07)"
           : isPicked   ? "rgba(59,130,246,0.08)"
           : "#fff";
  const fg = isCorrect    ? "#15803d"
           : isWrong      ? "#b91c1c"
           : isPicked     ? "#1d4ed8"
           : isEliminated ? "#c4c9d4"   // grey out loser
           : team         ? "#0f172a"
           : "#c4c9d4";
  const borderC = isCorrect ? "#86efac" : isWrong ? "#fca5a5" : isPicked ? "#93c5fd" : "#e2e8f0";

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
          <span style={{ fontSize: 9, fontWeight: 700, color: isEliminated && !isPicked ? "#d1d5db" : "#94a3b8", minWidth: 13, textAlign: "right", flexShrink: 0 }}>
            {teamData?.seed ?? ""}
          </span>
          <NCAALogo teamName={team} size={12} />
          <span style={{ fontSize: 10.5, fontWeight: isPicked ? 700 : 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: isEliminated && !isPicked ? "line-through" : "none" }}>
            {team}
          </span>
          {isCorrect && <span style={{ fontSize: 8, color: "#16a34a", flexShrink: 0 }}>✓</span>}
          {isWrong   && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
          {isPicked && !actual && <span style={{ fontSize: 7, color: "#3b82f6", flexShrink: 0 }}>●</span>}
        </>
      ) : (
        <span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic", paddingLeft: 2 }}>TBD</span>
      )}
    </div>
  );
}

// ── ConnectorSVG ──────────────────────────────────────────────────────────────
// Draws bracket lines between two adjacent round-columns.
// side="left"  → stub exits right edge of left-col, enters left edge of right-col
// side="right" → stub exits left edge of right-col, enters right edge of left-col (mirrored)

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
      // stubs go right → vertical bar → output stub right
      lines.push(
        <g key={gi} stroke="#d1d5db" strokeWidth={1} fill="none">
          <line x1={0}    y1={yTop}  x2={midX} y2={yTop} />
          <line x1={0}    y1={yBot}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yTop}  x2={midX} y2={yBot} />
          <line x1={midX} y1={yNext} x2={W}    y2={yNext} />
        </g>
      );
    } else {
      // mirrored: stubs go left → vertical bar → output stub left
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

// ── PlayInCol ─────────────────────────────────────────────────────────────────
// Renders play-in games and their connector line to R64

function PlayInTeamRow({ team, winner, actual }: { team: Team; winner: string | undefined; actual: string | undefined }) {
  const isPicked  = winner === team.name;
  const isActual  = actual === team.name;
  const isCorrect = isPicked && isActual;
  const isWrong   = isPicked && !!actual && !isActual;
  const isElim    = !!actual && actual !== team.name;
  const bg = isCorrect ? "rgba(22,163,74,0.09)" : isWrong ? "rgba(220,38,38,0.07)" : isPicked ? "rgba(59,130,246,0.07)" : "#fff";
  const fg = isCorrect ? "#15803d" : isWrong ? "#b91c1c" : isPicked ? "#1d4ed8" : isElim ? "#c4c9d4" : "#0f172a";
  return (
    <div style={{
      height: SLOT_H, display: "flex", alignItems: "center", gap: 3,
      padding: "0 4px", backgroundColor: bg, borderBottom: "1px solid #f1f5f9",
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", minWidth: 13, textAlign: "right", flexShrink: 0 }}>{team.seed}</span>
      <NCAALogo teamName={team.name} size={11} />
      <span style={{ fontSize: 9.5, fontWeight: isPicked ? 700 : 500, color: fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textDecoration: isElim && !isPicked ? "line-through" : "none" }}>
        {team.name}
      </span>
      {isCorrect && <span style={{ fontSize: 8, color: "#16a34a", flexShrink: 0 }}>✓</span>}
      {isWrong   && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
    </div>
  );
}

function PlayInCol({
  region, side, picks, allTeams, seed, feedsSlot,
}: {
  region: string; side: "left" | "right"; picks: Record<string, string>;
  allTeams: Team[]; seed: number; feedsSlot: number;
}) {
  const pickKey = `PlayIn|${region}|${seed}`;
  const winner  = picks[pickKey];
  const actual  = ACTUAL_RESULTS[pickKey];
  const connW   = COL_GAP;

  const piTeams = allTeams.filter(t => t.region === region && t.seed === seed && t.playIn);

  const yGame = gameTop(0, feedsSlot);
  const yMid  = yGame + GAME_H / 2;

  return (
    <div style={{ display: "flex", alignItems: "flex-start", height: REGION_H, position: "relative" }}>
      {/* Play-in card — vertically centered on the R64 slot it feeds */}
      <div style={{ position: "absolute", top: yGame, width: PLAYIN_W }}>
        <div style={{
          border: "1px solid #e2e8f0", borderRadius: 4, overflow: "hidden",
          backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            backgroundColor: "#7c2d12", borderBottom: "1px solid #e2e8f0",
            fontSize: 7.5, fontWeight: 800, color: "#fff",
            padding: "2px 5px", textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            First Four · #{seed}
          </div>
          {piTeams.length >= 2
            ? piTeams.map(t => <PlayInTeamRow key={t.name} team={t} winner={winner} actual={actual} />)
            : (
              <div style={{ height: SLOT_H, display: "flex", alignItems: "center", padding: "0 6px" }}>
                <span style={{ fontSize: 9, color: "#d1d5db", fontStyle: "italic" }}>TBD</span>
              </div>
            )
          }
        </div>
        {/* Arrow label */}
        {winner && (
          <div style={{ textAlign: side === "left" ? "right" : "left", fontSize: 8, color: "#64748b", marginTop: 2, paddingRight: 4 }}>
            → {winner}
          </div>
        )}
      </div>

      {/* Connector line from play-in card to R64 slot */}
      <svg
        style={{ position: "absolute", top: 0, [side === "left" ? "left" : "right"]: PLAYIN_W, pointerEvents: "none" }}
        width={connW} height={REGION_H} overflow="visible"
      >
        <line
          x1={side === "left" ? 0 : connW} y1={yMid}
          x2={side === "left" ? connW : 0}  y2={yMid}
          stroke="#d1d5db" strokeWidth={1}
        />
      </svg>
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
  region, side, picks, allTeams,
}: {
  region: string; side: "left" | "right"; picks: Record<string, string>; allTeams: Team[];
}) {
  const color = REGION_COLORS[region] ?? "#64748b";

  // For left side: columns ordered R64 → R32 → S16 → E8 (left to right)
  // For right side: columns ordered E8 → S16 → R32 → R64 (left to right, so R64 is far-right)
  const cols = side === "left" ? REGIONAL_ROUNDS : [...REGIONAL_ROUNDS].reverse();

  // Derive play-in games dynamically from seeding data — no hardcoding needed.
  // Find all seeds that have play-in teams in this region, then look up which
  // R64_MATCHUPS slot that seed appears in (top or bottom) to know vertical alignment.
  const playInSeeds = [...new Set(
    allTeams
      .filter(t => t.region === region && t.playIn)
      .map(t => t.seed)
  )];
  const playIns: { seed: number; feedsSlot: number }[] = playInSeeds.map(seed => {
    // Find which game slot (0-7) this seed appears in within R64_MATCHUPS
    const slotIdx = R64_MATCHUPS.findIndex(([s1, s2]) => s1 === seed || s2 === seed);
    return { seed, feedsSlot: slotIdx >= 0 ? slotIdx : 0 };
  }).sort((a, b) => a.feedsSlot - b.feedsSlot);

  function pick(prefix: string, slotIdx: number) {
    return picks[`${prefix}|${region}|${slotIdx}`];
  }

  return (
    <div>
      {/* Region label */}
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 8,
        color, display: "flex", alignItems: "center", gap: 5,
        flexDirection: side === "right" ? "row-reverse" : "row",
      }}>
        <span style={{ display: "inline-block", width: 3, height: 12, backgroundColor: color, borderRadius: 2 }} />
        {region}
      </div>

      {/* Round header row */}
      <div style={{ display: "flex", flexDirection: "row", gap: 0, marginBottom: 4 }}>
        {/* Play-in header spacer (left side only) */}
        {side === "left" && playIns.length > 0 && (
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
        {/* Play-in header spacer (right side only) */}
        {side === "right" && playIns.length > 0 && (
          <div style={{ width: PLAYIN_W + COL_GAP, flexShrink: 0 }} />
        )}
      </div>

      {/* Columns row */}
      <div style={{ display: "flex", flexDirection: "row", gap: 0, position: "relative" }}>

        {/* LEFT SIDE PLAY-IN: goes before R64 */}
        {side === "left" && playIns.length > 0 && (
          <div style={{ display: "flex", gap: 0 }}>
            {playIns.map(({ seed, feedsSlot }) => (
              <div key={seed} style={{ position: "relative", width: PLAYIN_W + COL_GAP }}>
                <PlayInCol region={region} side={side} picks={picks} allTeams={allTeams} seed={seed} feedsSlot={feedsSlot} />
              </div>
            ))}
          </div>
        )}

        {/* Round columns with connectors between them */}
        {cols.map(({ prefix, ri, count }, ci) => (
          <React.Fragment key={prefix}>
            {/* Connector between previous col and this one */}
            {ci > 0 && count < (cols[ci - 1]?.count ?? count) && (
              <ConnectorSVG fromRi={cols[ci - 1].ri} fromCount={cols[ci - 1].count} side={side} />
            )}

            {/* Game column */}
            <div style={{ position: "relative", width: COL_W, height: REGION_H, flexShrink: 0 }}>
              {Array.from({ length: count }, (_, gi) => {
                // R64: each pick key stores the *winner* of that game (one per matchup).
                // We derive the two competitors from seeding data using R64_MATCHUPS.
                // R32+: each pick key stores the winner; competitors come from the two
                // preceding R64 winners feeding into this slot.
                let topTeamName: string | undefined;
                let botTeamName: string | undefined;
                const pickKey = `${prefix}|${region}|${gi}`;
                const pickedWinner = pick(prefix, gi);

                if (prefix === "R64") {
                  const [topSeed, botSeed] = R64_MATCHUPS[gi];
                  // If play-in teams exist for this seed, that slot uses the play-in winner.
                  // A non-play-in team should only appear if there are NO play-in teams for that seed.
                  const topHasPlayIn = allTeams.some(t => t.region === region && t.seed === topSeed && t.playIn);
                  const botHasPlayIn = allTeams.some(t => t.region === region && t.seed === botSeed && t.playIn);
                  topTeamName = topHasPlayIn
                    ? (picks[`PlayIn|${region}|${topSeed}`] ?? undefined)  // play-in winner or TBD
                    : allTeams.find(t => t.region === region && t.seed === topSeed && !t.playIn)?.name;
                  botTeamName = botHasPlayIn
                    ? (picks[`PlayIn|${region}|${botSeed}`] ?? undefined)
                    : allTeams.find(t => t.region === region && t.seed === botSeed && !t.playIn)?.name;
                } else {
                  // R32+: top = winner of game gi*2 in prev round, bot = winner of game gi*2+1
                  const prevPrefix = prefix === "R32" ? "R64" : prefix === "S16" ? "R32" : "S16";
                  topTeamName = pick(prevPrefix, gi * 2);
                  botTeamName = pick(prevPrefix, gi * 2 + 1);
                }

                // For display: show both teams, highlight the picked winner
                const topActual = ACTUAL_RESULTS[pickKey];
                const botActual = topActual; // same key, winner is one of the two

                return (
                  <div
                    key={gi}
                    style={{
                      position: "absolute",
                      top: gameTop(ri, gi),
                      left: 0, width: COL_W,
                      border: "1px solid #e2e8f0",
                      borderRadius: 4, overflow: "hidden",
                      backgroundColor: "#fff",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    <BracketMatchupSlot
                      team={topTeamName} pickKey={pickKey} pickedWinner={pickedWinner}
                      allTeams={allTeams} isTop={true}
                    />
                    <div style={{ height: 1, backgroundColor: "#f1f5f9" }} />
                    <BracketMatchupSlot
                      team={botTeamName} pickKey={pickKey} pickedWinner={pickedWinner}
                      allTeams={allTeams} isTop={false}
                    />
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {/* RIGHT SIDE PLAY-IN: goes after R64 (far right) */}
        {side === "right" && playIns.length > 0 && (
          <div style={{ display: "flex", gap: 0 }}>
            {playIns.map(({ seed, feedsSlot }) => (
              <div key={seed} style={{ position: "relative", width: PLAYIN_W + COL_GAP }}>
                <PlayInCol region={region} side={side} picks={picks} allTeams={allTeams} seed={seed} feedsSlot={feedsSlot} />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

// ── ChampSlot ─────────────────────────────────────────────────────────────────

function ChampSlot({ team, pickKey, allTeams }: {
  team: string | undefined; pickKey: string; allTeams: Team[];
}) {
  const actual  = ACTUAL_RESULTS[pickKey];
  const correct = !!(actual && team && actual === team);
  const wrong   = !!(actual && team && actual !== team);
  const td      = team ? allTeams.find(t => t.name === team) : undefined;
  const bg      = correct ? "rgba(22,163,74,0.09)" : wrong ? "rgba(220,38,38,0.07)" : "#f8fafc";
  const borderC = correct ? "#86efac" : wrong ? "#fca5a5" : "#e2e8f0";
  const fg      = correct ? "#15803d" : wrong ? "#b91c1c" : team ? "#0f172a" : "#c4c9d4";
  return (
    <div style={{
      height: SLOT_H + 4, display: "flex", alignItems: "center", gap: 5,
      padding: "0 10px", backgroundColor: bg,
      border: `1px solid ${borderC}`, borderRadius: 5, minWidth: 160,
    }}>
      {team ? (
        <>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", minWidth: 13, textAlign: "right" }}>{td?.seed}</span>
          <NCAALogo teamName={team} size={13} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: fg, whiteSpace: "nowrap" }}>{team}</span>
          {correct && <span style={{ fontSize: 9, color: "#16a34a" }}>✓</span>}
          {wrong   && <span style={{ fontSize: 9, color: "#dc2626" }}>✗</span>}
        </>
      ) : (
        <span style={{ fontSize: 10, color: "#d1d5db", fontStyle: "italic" }}>TBD</span>
      )}
    </div>
  );
}

// ── BracketView ───────────────────────────────────────────────────────────────

function BracketView({
  entry, allTeams, hasResults,
}: {
  entry: BracketEntry & { score: ReturnType<typeof scoreEntry> };
  allTeams: Team[];
  hasResults: boolean;
}) {
  const picks = entry.picks;
  const f4a   = picks["F4|Semi|0"];
  const f4b   = picks["F4|Semi|1"];
  const champ = picks["CHAMP|Final|0"];

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
                {["R64","R32","S16","E8","F4","🏆"][i]}
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
      <div style={{ padding: "20px 16px 24px", display: "inline-flex", alignItems: "flex-start", gap: 20, minWidth: "max-content" }}>

        {/* LEFT: East + West */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {LEFT_REGIONS.map(r => (
            <RegionBracket key={r} region={r} side="left" picks={picks} allTeams={allTeams} />
          ))}
        </div>

        {/* CENTER: Final Four + Champion */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 10, alignSelf: "center",
          minWidth: 180, paddingTop: 20,
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
            Final Four <span style={{ color: "#cbd5e1", fontWeight: 400 }}>160pt</span>
          </div>
          <ChampSlot team={f4a} pickKey="F4|Semi|0" allTeams={allTeams} />
          <ChampSlot team={f4b} pickKey="F4|Semi|1" allTeams={allTeams} />

          <div style={{
            marginTop: 8,
            background: "linear-gradient(135deg, #0a1628 0%, #1e3a5f 60%, #0a1628 100%)",
            border: "2px solid #c9a84c",
            borderRadius: 10, padding: "12px 18px",
            textAlign: "center", minWidth: 170,
            boxShadow: "0 4px 20px rgba(201,168,76,0.2)",
          }}>
            <div style={{ fontSize: 20, marginBottom: 3 }}>🏆</div>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: "#c9a84c", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
              Champion · 320pt
            </div>
            {champ ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <NCAALogo teamName={champ} size={22} />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700 }}>
                    #{allTeams.find(t => t.name === champ)?.seed}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#f0f4ff", whiteSpace: "nowrap" }}>{champ}</div>
                </div>
                {ACTUAL_RESULTS["CHAMP|Final|0"] === champ && <span style={{ fontSize: 14, color: "#c9a84c" }}>✓</span>}
                {ACTUAL_RESULTS["CHAMP|Final|0"] && ACTUAL_RESULTS["CHAMP|Final|0"] !== champ && <span style={{ fontSize: 12, color: "#dc2626" }}>✗</span>}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#475569", fontStyle: "italic" }}>TBD</div>
            )}
          </div>
        </div>

        {/* RIGHT: South + Midwest */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {RIGHT_REGIONS.map(r => (
            <RegionBracket key={r} region={r} side="right" picks={picks} allTeams={allTeams} />
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { user }   = useAuth();
  const [entries, setEntries]   = useState<BracketEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const allTeams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return (seedingData as Record<string, unknown>[]).map(r => ({
      name:   String(r.Team   ?? r.team   ?? ""),
      seed:   Number(r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? 0),
      region: String(r.Region ?? r.region ?? ""),
      playIn: Boolean(r.PlayIn ?? r.playIn ?? false),
    }));
  }, []);

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

  const ranked = useMemo(() => {
    return entries
      .map(entry => ({ ...entry, score: scoreEntry(entry.picks) }))
      .sort((a, b) => b.score.total - a.score.total || b.score.possible - a.score.possible);
  }, [entries]);

  const hasResults    = Object.keys(ACTUAL_RESULTS).length > 0;

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
            {hasResults ? " Scores update as games are completed." : " Scores will populate once games begin."}
          </p>
          <Link href="/bracket-challenge" style={{ marginTop: 10, fontSize: 13, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
            ← Edit your bracket
          </Link>
        </div>

        {/* Standings table */}
        {ranked.length > 0 && (
          <div style={{
            border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden",
            backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 32,
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH, width: 50 }}>#</th>
                    <th style={{ ...TH, textAlign: "left" }}>Bracket</th>
                    <th style={TH}>Picks</th>
                    {hasResults && (
                      <>
                        <th style={TH}>Score</th>
                        <th style={TH}>Correct</th>
                        <th style={TH}>Max Possible</th>
                      </>
                    )}
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
                          {hasResults && (
                            <>
                              <td style={{ ...TD, fontWeight: 700, color: "#0a1a2f", fontSize: 15 }}>{entry.score.total}</td>
                              <td style={TD}>{entry.score.correct}</td>
                              <td style={{ ...TD, color: "#64748b" }}>{entry.score.possible}</td>
                            </>
                          )}
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
                            <td colSpan={hasResults ? 8 : 5} style={{ padding: 0, borderTop: "2px solid #3b82f6" }}>
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
