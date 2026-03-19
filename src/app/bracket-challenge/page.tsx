"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import seedingData from "@/data/seeding/seeding.json";
import rankingsData from "@/data/rankings/rankings.json";
import tournamentResultsRaw from "@/data/seeding/tournament-results.json";

const ACTUAL_RESULTS: Record<string, string> = tournamentResultsRaw as Record<string, string>;
import { doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/firebase-config";
import { useAuth } from "@/app/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Team = {
  name: string;
  seed: number;
  region: string;
  playIn: boolean;
  bbmiScore: number;
  roundOf32: number;
  sweet16: number;
  elite8: number;
  final4: number;
  championship: number;
  winTitle: number;
};

type BracketPicks = Record<string, string>; // gameKey → team name

// ── BBMI Win Probability (neutral court) ──────────────────────────────────────
// Same formula as the pipeline tournament simulation:
//   P(A beats B) = 0.5 * erfc( -(bbmi_a - bbmi_b) * multiplier / (std_dev * sqrt(2)) )
const BBMI_MULTIPLIER = 1.1;   // tournament multiplier (from pipeline)
const BBMI_STD_DEV = 10.75;    // calibrated std dev

function headToHeadProb(teamA: Team | undefined, teamB: Team | undefined): { probA: number; probB: number } | null {
  if (!teamA || !teamB || !teamA.bbmiScore || !teamB.bbmiScore) return null;
  const rawLine = (teamA.bbmiScore - teamB.bbmiScore) * BBMI_MULTIPLIER;
  const z = rawLine / (BBMI_STD_DEV * Math.SQRT2);
  const probA = 0.5 * erfc(-z);
  return { probA: Math.round(probA * 100), probB: Math.round((1 - probA) * 100) };
}

/** Complementary error function approximation */
function erfc(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 1 - sign * y;
}

// ── Scoring engine ───────────────────────────────────────────────────────────

const ROUND_PREFIXES = ["R64|", "R32|", "S16|", "E8|", "F4|", "CHAMP|"];
const ROUND_POINTS_MAP: Record<string, number> = {
  R64: 10, R32: 20, S16: 40, E8: 80, F4: 160, CHAMP: 320,
};

function scoreEntry(picks: Record<string, string>): { total: number; correct: number } {
  let total = 0, correct = 0;
  Object.entries(picks).forEach(([k, t]) => {
    const actual = ACTUAL_RESULTS[k];
    if (actual && actual === t) {
      const prefix = k.split("|")[0];
      total += ROUND_POINTS_MAP[prefix] ?? 0;
      correct++;
    }
  });
  return { total, correct };
}

function winProb(scoreA: number, scoreB: number): number {
  if (!scoreA || !scoreB) return 0.5;
  const z = (scoreA - scoreB) * BBMI_MULTIPLIER / (BBMI_STD_DEV * Math.SQRT2);
  return 0.5 * erfc(-z);
}

function bbmiExpectedScore(
  picks: Record<string, string>,
  allTeams: Team[],
  matchups: [number, number][],
): number {
  const teamByName = new Map(allTeams.map(t => [t.name, t]));

  function pWinsThrough(teamName: string, targetKey: string): number {
    const team = teamByName.get(teamName);
    if (!team) return 0;
    const parts = targetKey.split("|");
    const prefix = parts[0];
    const region = parts[1];
    const slot   = parseInt(parts[2] ?? "0");
    const roundIdx = ["R64","R32","S16","E8","F4","CHAMP"].indexOf(prefix);
    if (roundIdx < 0) return 0;

    let prob = 1.0;

    if (roundIdx <= 3) {
      for (let ri = 0; ri <= roundIdx; ri++) {
        const rp = ["R64","R32","S16","E8"][ri];
        const gSlot = Math.floor(slot / Math.pow(2, roundIdx - ri));
        let opponentScore = 0;
        if (ri === 0) {
          const teamInRegion = allTeams.find(t => t.name === teamName && t.region === region);
          if (!teamInRegion) return 0;
          const mIdx = matchups.findIndex(([s1, s2]) => s1 === teamInRegion.seed || s2 === teamInRegion.seed);
          if (mIdx < 0) return 0;
          const [s1, s2] = matchups[mIdx];
          const oppSeed = teamInRegion.seed === s1 ? s2 : s1;
          const opp = allTeams.find(t => t.region === region && t.seed === oppSeed && !t.playIn);
          opponentScore = opp?.bbmiScore ?? 0;
        } else {
          const adjSlot = gSlot % 2 === 0 ? gSlot + 1 : gSlot - 1;
          const adjWinner = picks[`${rp}|${region}|${adjSlot}`];
          opponentScore = adjWinner ? (teamByName.get(adjWinner)?.bbmiScore ?? 0) : 0;
        }
        prob *= opponentScore > 0 ? winProb(team.bbmiScore, opponentScore) : 0.5;
      }
    } else if (prefix === "F4") {
      prob = pWinsThrough(teamName, `E8|${region}|0`);
      const adjSemi = slot === 0 ? "F4|Semi|1" : "F4|Semi|0";
      const opp = teamByName.get(picks[adjSemi]);
      prob *= opp ? winProb(team.bbmiScore, opp.bbmiScore) : 0.5;
    } else if (prefix === "CHAMP") {
      const f4entry = Object.entries(picks).find(([k, v]) => k.startsWith("F4|") && v === teamName);
      const semiKey = f4entry ? f4entry[0] : "F4|Semi|0";
      prob = pWinsThrough(teamName, semiKey);
      const adjSemi = semiKey === "F4|Semi|0" ? "F4|Semi|1" : "F4|Semi|0";
      const opp = teamByName.get(picks[adjSemi]);
      prob *= opp ? winProb(team.bbmiScore, opp.bbmiScore) : 0.5;
    }
    return prob;
  }

  let ev = 0;
  Object.entries(picks).forEach(([key, teamName]) => {
    const prefix = key.split("|")[0];
    const pts = ROUND_POINTS_MAP[prefix] ?? 0;
    if (!pts) return;
    ev += pWinsThrough(teamName, key) * pts;
  });
  return Math.round(ev);
}

// Standard NCAA bracket seed matchups per region
const MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];

const ROUND_NAMES = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"];
const ROUND_POINTS = [10, 20, 40, 80, 160, 320];

// ── Layout ────────────────────────────────────────────────────────────────────

const TEAM_H = 28;
const TEAM_W = 175;
const SLOT_GAP = 4;
const PAIR_H = TEAM_H * 2 + SLOT_GAP;
const ROW_GAP = 6;
const CONN_W = 16;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPct(v: number | undefined) {
  if (v == null || v === 0) return "";
  const pct = v > 1 ? v : v * 100;
  return `${pct.toFixed(0)}%`;
}

function gameKey(round: string, region: string, slot: number): string {
  return `${round}|${region}|${slot}`;
}

// ── Clickable Team Slot ───────────────────────────────────────────────────────

function PickSlot({
  team,
  h2hProb,
  isSelected,
  isLocked,
  onClick,
}: {
  team: Team | undefined;
  h2hProb?: number; // head-to-head win % (0-100)
  isSelected: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  if (!team) {
    return (
      <div style={{
        height: TEAM_H, width: TEAM_W,
        border: "1px dashed #d6d3d1", background: "#fafaf9",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, color: "#a8a29e", borderRadius: 3,
      }}>
        —
      </div>
    );
  }

  const bg = isSelected ? "#dbeafe" : "white";
  const border = isSelected ? "#3b82f6" : "#d6d3d1";
  const probColor = h2hProb != null && h2hProb >= 60 ? "#16a34a" : h2hProb != null && h2hProb <= 40 ? "#dc2626" : "#64748b";

  return (
    <div
      onClick={isLocked ? undefined : onClick}
      style={{
        height: TEAM_H, width: TEAM_W,
        border: `1.5px solid ${border}`,
        background: bg,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: 5, paddingRight: 6,
        fontSize: 12, borderRadius: 3,
        cursor: isLocked ? "default" : "pointer",
        transition: "all 0.15s",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}>
        <NCAALogo teamName={team.name} size={14} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ marginRight: 2 }}>{team.seed}</strong>
          {team.name}
        </span>
      </div>
      {h2hProb != null && (
        <span style={{
          fontSize: 10, color: probColor, flexShrink: 0, marginLeft: 3,
          fontWeight: 600,
        }}>
          {h2hProb}%
        </span>
      )}
      {isSelected && (
        <span style={{
          fontSize: 8, fontWeight: 800, color: "#2563eb",
          backgroundColor: "#bfdbfe", borderRadius: 2,
          padding: "0 3px", flexShrink: 0, marginLeft: 2,
          lineHeight: "13px",
        }}>
          ✓
        </span>
      )}
    </div>
  );
}

// ── Region Bracket ────────────────────────────────────────────────────────────

function RegionBracket({
  regionName,
  teams,
  picks,
  onPick,
  isLocked,
}: {
  regionName: string;
  teams: Team[];
  picks: BracketPicks;
  onPick: (key: string, team: string) => void;
  isLocked: boolean;
}) {
  const playInBySeed: Record<number, Team[]> = {};
  teams.filter(t => t.playIn).forEach(t => {
    if (!playInBySeed[t.seed]) playInBySeed[t.seed] = [];
    playInBySeed[t.seed].push(t);
  });

  const getTeam = (seed: number): Team | undefined => {
    const pi = playInBySeed[seed];
    if (pi?.length >= 2) {
      const piKey = gameKey("PlayIn", regionName, seed);
      const picked = picks[piKey];
      if (picked) return pi.find(t => t.name === picked);
      return undefined; // must pick play-in winner first
    }
    return teams.find(t => t.seed === seed && !t.playIn);
  };

  // Build rounds
  const r64Teams = MATCHUPS.map(([s1, s2]) => [getTeam(s1), getTeam(s2)] as [Team | undefined, Team | undefined]);

  const getWinner = (round: string, slot: number): Team | undefined => {
    const key = gameKey(round, regionName, slot);
    const name = picks[key];
    if (!name) return undefined;
    return teams.find(t => t.name === name);
  };

  const r32Teams: [Team | undefined, Team | undefined][] = [];
  for (let i = 0; i < 4; i++) {
    r32Teams.push([getWinner("R64", i * 2), getWinner("R64", i * 2 + 1)]);
  }

  const s16Teams: [Team | undefined, Team | undefined][] = [];
  for (let i = 0; i < 2; i++) {
    s16Teams.push([getWinner("R32", i * 2), getWinner("R32", i * 2 + 1)]);
  }

  const e8Teams: [Team | undefined, Team | undefined] = [getWinner("S16", 0), getWinner("S16", 1)];
  const regionWinner = getWinner("E8", 0);


  function renderMatchup(
    round: string,
    slot: number,
    teamA: Team | undefined,
    teamB: Team | undefined,
    colX: number,
    topY: number,
  ) {
    const key = gameKey(round, regionName, slot);
    const currentPick = picks[key];
    const h2h = headToHeadProb(teamA, teamB);

    return (
      <React.Fragment key={`${round}-${slot}`}>
        <div style={{ position: "absolute", top: topY, left: colX }}>
          <PickSlot
            team={teamA}
            h2hProb={h2h?.probA}
            isSelected={currentPick === teamA?.name}
            isLocked={isLocked || !teamA}
            onClick={() => teamA && onPick(key, teamA.name)}
          />
        </div>
        <div style={{ position: "absolute", top: topY + TEAM_H + SLOT_GAP, left: colX }}>
          <PickSlot
            team={teamB}
            h2hProb={h2h?.probB}
            isSelected={currentPick === teamB?.name}
            isLocked={isLocked || !teamB}
            onClick={() => teamB && onPick(key, teamB.name)}
          />
        </div>
      </React.Fragment>
    );
  }

  // Column positions
  const R64_X = 0;
  const R32_X = TEAM_W + CONN_W;
  const S16_X = R32_X + TEAM_W + CONN_W;
  const E8_X = S16_X + TEAM_W + CONN_W;
  const F4_X = E8_X + TEAM_W + CONN_W;
  const TOTAL_W = F4_X + TEAM_W;

  // R64 row positions
  const r64PairTops: number[] = [];
  let cursor = 0;
  MATCHUPS.forEach(() => { r64PairTops.push(cursor); cursor += PAIR_H + ROW_GAP; });
  const totalH = cursor - ROW_GAP;

  // Play-in matchups
  const playInNodes: React.ReactNode[] = [];
  MATCHUPS.forEach(([s1, s2], mi) => {
    [s1, s2].forEach((seed, si) => {
      const piTeams = playInBySeed[seed];
      if (!piTeams || piTeams.length < 2) return;
      const piKey = gameKey("PlayIn", regionName, seed);
      const piPick = picks[piKey];
      const r64SlotTop = r64PairTops[mi] + (si === 0 ? 0 : TEAM_H + SLOT_GAP);

      const piH2h = piTeams.length >= 2 ? headToHeadProb(piTeams[0], piTeams[1]) : null;

      playInNodes.push(
        <div key={`pi-${seed}`} style={{
          position: "absolute", top: r64SlotTop, left: 0,
          display: "flex", flexDirection: "column", gap: 2,
        }}>
          {piTeams.map((t, idx) => {
            const prob = piH2h ? (idx === 0 ? piH2h.probA : piH2h.probB) : null;
            const probColor = prob != null && prob >= 60 ? "#16a34a" : prob != null && prob <= 40 ? "#dc2626" : "#64748b";
            return (
              <div
                key={t.name}
                onClick={isLocked ? undefined : () => onPick(piKey, t.name)}
                style={{
                  height: TEAM_H, width: TEAM_W - 10,
                  border: `1.5px solid ${piPick === t.name ? "#3b82f6" : "#d6d3d1"}`,
                  background: piPick === t.name ? "#dbeafe" : "#ffffff",
                  display: "flex", alignItems: "center", gap: 3,
                  paddingLeft: 5, paddingRight: 5, fontSize: 11, borderRadius: 3,
                  cursor: isLocked ? "default" : "pointer",
                  justifyContent: "space-between",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 3, flex: 1, overflow: "hidden" }}>
                  <NCAALogo teamName={t.name} size={13} />
                  <strong style={{ marginRight: 2 }}>{t.seed}</strong>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                </div>
                {prob != null && (
                  <span style={{ fontSize: 10, color: probColor, fontWeight: 600, flexShrink: 0, marginLeft: 3 }}>
                    {prob}%
                  </span>
                )}
                {piPick === t.name && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, color: "#2563eb",
                    backgroundColor: "#bfdbfe", borderRadius: 2,
                    padding: "0 3px", flexShrink: 0, lineHeight: "13px",
                  }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      );

      // Connector from play-in to R64 slot
      if (piPick) {
        const piMidY = r64SlotTop + 10 + TEAM_H; // approximate midpoint of the two play-in slots
        const r64MidY = r64SlotTop + TEAM_H / 2;
        playInNodes.push(
          <div key={`pi-conn-${seed}`} style={{
            position: "absolute",
            top: r64MidY,
            left: TEAM_W - 10,
            width: CONN_W + 10,
            height: 1,
            backgroundColor: "#94a3b8",
          }} />
        );
      }
    });
  });

  // R32 positions
  const r32Tops = r64PairTops.map((_, i) => {
    const mid = r64PairTops[i] + PAIR_H / 2;
    return mid - TEAM_H / 2;
  });

  // S16 positions
  const s16Tops = [0, 1, 2, 3].map(i => {
    const mid = (r32Tops[i * 2] + TEAM_H / 2 + r32Tops[i * 2 + 1] + TEAM_H / 2) / 2;
    return mid - TEAM_H / 2;
  });

  // E8 positions
  const e8Tops = [0, 1].map(i => {
    const mid = (s16Tops[i * 2] + TEAM_H / 2 + s16Tops[i * 2 + 1] + TEAM_H / 2) / 2;
    return mid - TEAM_H / 2;
  });

  // F4 position
  const f4Top = ((e8Tops[0] + TEAM_H / 2) + (e8Tops[1] + TEAM_H / 2)) / 2 - TEAM_H / 2;

  const hasPlayIns = Object.keys(playInBySeed).length > 0;
  const offsetX = hasPlayIns ? TEAM_W + CONN_W : 0;

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        background: "linear-gradient(90deg, #0a1628 0%, #1e3a5f 100%)",
        color: "#fff", padding: "10px 18px", borderRadius: "10px 10px 0 0",
        fontWeight: 700, fontSize: 16,
      }}>
        {regionName} Region
      </div>
      <div style={{
        padding: "16px 20px", overflowX: "auto", backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px",
      }}>
        {/* Round headers */}
        <div style={{ display: "flex", gap: CONN_W, marginBottom: 10 }}>
          {hasPlayIns && (
            <div style={{
              width: TEAM_W - 10, textAlign: "center", fontSize: 9.5, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.08em", color: "#f8fafc",
              backgroundColor: "#7c2d12", padding: "4px 6px", borderRadius: 4,
              marginRight: CONN_W + 10,
            }}>
              First Four
            </div>
          )}
          {ROUND_NAMES.slice(0, 5).map(label => (
            <div key={label} style={{
              width: TEAM_W, textAlign: "center", fontSize: 9.5, fontWeight: 800,
              textTransform: "uppercase", letterSpacing: "0.08em", color: "#f8fafc",
              backgroundColor: "#0a1628", padding: "4px 6px", borderRadius: 4,
            }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ position: "relative", height: totalH, width: TOTAL_W + offsetX, minWidth: TOTAL_W + offsetX }}>
          {playInNodes}

          {/* R64 */}
          {r64Teams.map(([tA, tB], i) => renderMatchup("R64", i, tA, tB, R64_X + offsetX, r64PairTops[i]))}

          {/* R32 */}
          {r32Teams.map(([tA, tB], i) => {
            const key = gameKey("R32", regionName, i);
            const currentPick = picks[key];
            const h2h = headToHeadProb(tA, tB);
            return (
              <React.Fragment key={`r32-${i}`}>
                <div style={{ position: "absolute", top: r32Tops[i * 2], left: R32_X + offsetX }}>
                  <PickSlot team={tA} h2hProb={h2h?.probA} isSelected={currentPick === tA?.name} isLocked={isLocked || !tA} onClick={() => tA && onPick(key, tA.name)} />
                </div>
                <div style={{ position: "absolute", top: r32Tops[i * 2 + 1], left: R32_X + offsetX }}>
                  <PickSlot team={tB} h2hProb={h2h?.probB} isSelected={currentPick === tB?.name} isLocked={isLocked || !tB} onClick={() => tB && onPick(key, tB.name)} />
                </div>
              </React.Fragment>
            );
          })}

          {/* S16 */}
          {s16Teams.map(([tA, tB], i) => {
            const key = gameKey("S16", regionName, i);
            const currentPick = picks[key];
            const h2h = headToHeadProb(tA, tB);
            return (
              <React.Fragment key={`s16-${i}`}>
                <div style={{ position: "absolute", top: s16Tops[i * 2], left: S16_X + offsetX }}>
                  <PickSlot team={tA} h2hProb={h2h?.probA} isSelected={currentPick === tA?.name} isLocked={isLocked || !tA} onClick={() => tA && onPick(key, tA.name)} />
                </div>
                <div style={{ position: "absolute", top: s16Tops[i * 2 + 1], left: S16_X + offsetX }}>
                  <PickSlot team={tB} h2hProb={h2h?.probB} isSelected={currentPick === tB?.name} isLocked={isLocked || !tB} onClick={() => tB && onPick(key, tB.name)} />
                </div>
              </React.Fragment>
            );
          })}

          {/* E8 */}
          {(() => {
            const key = gameKey("E8", regionName, 0);
            const currentPick = picks[key];
            const h2h = headToHeadProb(e8Teams[0], e8Teams[1]);
            return (
              <>
                <div style={{ position: "absolute", top: e8Tops[0], left: E8_X + offsetX }}>
                  <PickSlot team={e8Teams[0]} h2hProb={h2h?.probA} isSelected={currentPick === e8Teams[0]?.name} isLocked={isLocked || !e8Teams[0]} onClick={() => e8Teams[0] && onPick(key, e8Teams[0].name)} />
                </div>
                <div style={{ position: "absolute", top: e8Tops[1], left: E8_X + offsetX }}>
                  <PickSlot team={e8Teams[1]} h2hProb={h2h?.probB} isSelected={currentPick === e8Teams[1]?.name} isLocked={isLocked || !e8Teams[1]} onClick={() => e8Teams[1] && onPick(key, e8Teams[1].name)} />
                </div>
              </>
            );
          })()}

          {/* Region Winner */}
          <div style={{ position: "absolute", top: f4Top, left: F4_X + offsetX }}>
            <PickSlot
              team={regionWinner}
              isSelected={!!regionWinner}
              isLocked={true}
              onClick={() => {}}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Final Four Picker ─────────────────────────────────────────────────────────

function FinalFourPicker({
  regionWinners,
  picks,
  onPick,
  isLocked,
  allTeams,
}: {
  regionWinners: { region: string; winner: Team | undefined }[];
  picks: BracketPicks;
  onPick: (key: string, team: string) => void;
  isLocked: boolean;
  allTeams: Team[];
}) {
  const semi1Key = gameKey("F4", "Semi", 0);
  const semi2Key = gameKey("F4", "Semi", 1);
  const champKey = gameKey("CHAMP", "Final", 0);

  const semi1Pick = picks[semi1Key];
  const semi2Pick = picks[semi2Key];
  const champPick = picks[champKey];

  const getTeamByName = (name: string | undefined) => name ? allTeams.find(t => t.name === name) : undefined;

  const semi1Winner = getTeamByName(semi1Pick);
  const semi2Winner = getTeamByName(semi2Pick);

  // H2H for semifinal matchups
  // NCAA bracket: East vs South, West vs Midwest
  const semi1TeamA = regionWinners[0]?.winner; // East
  const semi1TeamB = regionWinners[1]?.winner; // South
  const semi1H2h = headToHeadProb(semi1TeamA, semi1TeamB);

  const semi2TeamA = regionWinners[2]?.winner; // West
  const semi2TeamB = regionWinners[3]?.winner; // Midwest
  const semi2H2h = headToHeadProb(semi2TeamA, semi2TeamB);

  // H2H for championship
  const champH2h = headToHeadProb(semi1Winner, semi2Winner);

  return (
    <div style={{
      border: "2px solid #b45309", borderRadius: 12, overflow: "hidden",
      marginBottom: 32, background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
    }}>
      <div style={{
        background: "linear-gradient(90deg, #7c2d12 0%, #b45309 100%)",
        color: "#fff", padding: "12px 20px", fontWeight: 800, fontSize: 18,
        textAlign: "center",
      }}>
        🏆 Final Four & Championship
      </div>
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>

          {/* Semi 1 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>
              East vs South
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[regionWinners[0], regionWinners[1]].map((rw, idx) => (
                <div key={rw?.region ?? idx} onClick={() => rw?.winner && !isLocked && onPick(semi1Key, rw.winner.name)} style={{ cursor: isLocked || !rw?.winner ? "default" : "pointer" }}>
                  <PickSlot
                    team={rw?.winner}
                    h2hProb={semi1H2h ? (idx === 0 ? semi1H2h.probA : semi1H2h.probB) : undefined}
                    isSelected={semi1Pick === rw?.winner?.name}
                    isLocked={isLocked || !rw?.winner}
                    onClick={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Champion */}
          <div style={{ textAlign: "center", alignSelf: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", textTransform: "uppercase", marginBottom: 6 }}>
              🏆 Champion
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[semi1Winner, semi2Winner].filter(Boolean).map((t, idx) => (
                <div key={`champ-${idx}-${t!.name}`} onClick={() => !isLocked && onPick(champKey, t!.name)} style={{ cursor: isLocked ? "default" : "pointer" }}>
                  <PickSlot
                    team={t}
                    h2hProb={champH2h ? (idx === 0 ? champH2h.probA : champH2h.probB) : undefined}
                    isSelected={champPick === t?.name}
                    isLocked={isLocked}
                    onClick={() => {}}
                  />
                </div>
              ))}
              {!semi1Winner && !semi2Winner && (
                <div style={{ color: "#a8a29e", fontSize: 12, fontStyle: "italic", padding: 8 }}>
                  Pick semifinal winners first
                </div>
              )}
            </div>
          </div>

          {/* Semi 2 */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>
              West vs Midwest
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[regionWinners[2], regionWinners[3]].map((rw, idx) => (
                <div key={rw?.region ?? idx} onClick={() => rw?.winner && !isLocked && onPick(semi2Key, rw.winner.name)} style={{ cursor: isLocked || !rw?.winner ? "default" : "pointer" }}>
                  <PickSlot
                    team={rw?.winner}
                    h2hProb={semi2H2h ? (idx === 0 ? semi2H2h.probA : semi2H2h.probB) : undefined}
                    isSelected={semi2Pick === rw?.winner?.name}
                    isLocked={isLocked || !rw?.winner}
                    onClick={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ picks, totalGames }: { picks: BracketPicks; totalGames: number }) {
  const filled = Object.keys(picks).length;
  const pct = totalGames > 0 ? Math.round((filled / totalGames) * 100) : 0;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#57534e", marginBottom: 4 }}>
        <span>{filled} of {totalGames} picks made</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 8, backgroundColor: "#e7e5e4", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          backgroundColor: pct === 100 ? "#16a34a" : "#3b82f6",
          borderRadius: 4, transition: "width 0.3s",
        }} />
      </div>
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────────

export default function BracketChallenge() {
  const { user } = useAuth();
  const [picks, setPicks] = useState<BracketPicks>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bracketName, setBracketName] = useState("");
  const [leaderboardInfo, setLeaderboardInfo] = useState<{ rank: number; total: number } | null>(null);
  const [isExistingBracket, setIsExistingBracket] = useState(false);

  // Region brackets locked at First Four tip-off
  const REGION_DEADLINE = new Date("2026-03-19T11:00:00-05:00");
  // Final Four / Championship unlocked until midnight CDT tonight for semifinal fix
  const F4_DEADLINE = new Date("2026-03-20T00:00:00-05:00");
  // New users can submit a full bracket until 2 PM CDT today
  const NEW_USER_DEADLINE = new Date("2026-03-19T14:00:00-05:00");
  const now = new Date();
  const isNewUserWindow = !isExistingBracket && now <= NEW_USER_DEADLINE;
  const isRegionLocked = isNewUserWindow ? false : now > REGION_DEADLINE;
  const isF4Locked = isNewUserWindow ? false : now > F4_DEADLINE;
  const isLocked = isRegionLocked;

  // Build BBMI score lookup from rankings.json
  const bbmiScoreMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(rankingsData)) {
      (rankingsData as Record<string, unknown>[]).forEach(r => {
        const name = String(r.team ?? r.my_name ?? "");
        const score = Number(r.bbmi ?? r.bbmi_score ?? 0);
        if (name && score) map[name] = score;
      });
    }
    return map;
  }, []);

  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return (seedingData as Record<string, unknown>[]).map((r) => {
      const name = String(r.Team ?? r.team ?? "");
      return {
        name,
        seed:         Number(r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? 0),
        region:       String(r.Region ?? r.region ?? ""),
        playIn:       Boolean(r.PlayIn ?? r.playIn ?? false),
        bbmiScore:    bbmiScoreMap[name] ?? 0,
        roundOf32:    Number(r.RoundOf32Pct ?? r.roundOf32Pct ?? 0),
        sweet16:      Number(r.Sweet16Pct ?? r.sweet16Pct ?? 0),
        elite8:       Number(r.Elite8Pct ?? r.elite8Pct ?? 0),
        final4:       Number(r.FinalFourPct ?? r.finalFourPct ?? 0),
        championship: Number(r.ChampionshipPct ?? r.championshipPct ?? 0),
        winTitle:     Number(r.WinTitlePct ?? r.winTitlePct ?? 0),
      };
    });
  }, [bbmiScoreMap]);

  const regions = useMemo(() => {
    const map: Record<string, Team[]> = {};
    teams.forEach(t => {
      if (!t.region) return;
      if (!map[t.region]) map[t.region] = [];
      map[t.region].push(t);
    });
    Object.keys(map).forEach(r => map[r].sort((a, b) => a.seed - b.seed));
    return map;
  }, [teams]);

  // Fixed region order: East (top-left), South (bottom-left), West (top-right), Midwest (bottom-right)
  // Semi1 = East vs South, Semi2 = West vs Midwest (standard NCAA bracket)
  const REGION_ORDER = ["East", "South", "West", "Midwest"];
  const regionNames = useMemo(
    () => REGION_ORDER.filter(r => regions[r]),
    [regions]  // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Total games: 63 main + play-in games
  const playInCount = useMemo(() => {
    let count = 0;
    Object.values(regions).forEach(rTeams => {
      const piSeeds = new Set<number>();
      rTeams.filter(t => t.playIn).forEach(t => piSeeds.add(t.seed));
      count += piSeeds.size;
    });
    return count;
  }, [regions]);
  const totalGames = 63 + playInCount;

  // Load saved bracket from Firestore
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const ref = doc(db, "bracketChallenge", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setPicks(data.picks || {});
          setBracketName(data.bracketName || "");
          setSaved(true);
          setIsExistingBracket(true);
        }
        // Fetch leaderboard rank — BBMI expected pre-tournament, actual score once games start
        const allSnap = await getDocs(collection(db, "bracketChallenge"));
        const hasResults = Object.keys(ACTUAL_RESULTS).length > 0;
        const allEntries: { userId: string; sortVal: number }[] = [];
        allSnap.forEach(d => {
          const data = d.data();
          const entryPicks: Record<string, string> = data.picks || {};
          const sortVal = hasResults
            ? scoreEntry(entryPicks).total
            : bbmiExpectedScore(entryPicks, teams, MATCHUPS);
          allEntries.push({ userId: data.userId, sortVal });
        });
        allEntries.sort((a, b) => b.sortVal - a.sortVal);
        const myIdx = allEntries.findIndex(e => e.userId === user.uid);
        if (myIdx >= 0) {
          setLeaderboardInfo({ rank: myIdx + 1, total: allEntries.length });
        }
      } catch (e) {
        console.error("Failed to load bracket:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, teams]);

  const handlePick = useCallback((key: string, team: string) => {
    setPicks(prev => {
      const next = { ...prev };
      if (next[key] === team) {
        delete next[key];
        // If clearing a semifinal, also clear the champion
        if (key === "F4|Semi|0" || key === "F4|Semi|1") {
          delete next["CHAMP|Final|0"];
        }
      } else {
        next[key] = team;
        // If changing a semifinal pick, clear the champion so it doesn't
        // show a stale team that may no longer be in the final
        if (key === "F4|Semi|0" || key === "F4|Semi|1") {
          delete next["CHAMP|Final|0"];
        }
      }
      return next;
    });
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const ref = doc(db, "bracketChallenge", user.uid);
      await setDoc(ref, {
        picks,
        bracketName: bracketName || user.displayName || user.email?.split("@")[0] || "Anonymous",
        userId: user.uid,
        email: user.email,
        updatedAt: serverTimestamp(),
        complete: Object.keys(picks).length >= 63,
      }, { merge: true });
      setSaved(true);
    } catch (e) {
      console.error("Failed to save bracket:", e);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Region winners for Final Four
  const regionWinners = useMemo(() => {
    return regionNames.map(region => {
      const key = gameKey("E8", region, 0);
      const winnerName = picks[key];
      const winner = winnerName ? teams.find(t => t.name === winnerName) : undefined;
      return { region, winner };
    });
  }, [regionNames, picks, teams]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
        Loading bracket...
      </div>
    );
  }

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-0.02em", textAlign: "center" }}>
            🏀 BBMI Bracket Challenge
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
            Pick your winners for every game. BBMI head-to-head win probabilities shown for each matchup
            (<span style={{ color: "#16a34a" }}>green</span> = favored, <span style={{ color: "#dc2626" }}>red</span> = underdog).
            Brackets locked at First Four tip-off on March 17.
          </p>

          {isNewUserWindow && (
            <div style={{
              marginTop: 12, backgroundColor: "#f0fdf4", border: "1px solid #86efac",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#166534", fontWeight: 600,
            }}>
              🏀 New bracket! All picks are open until 2:00 PM CDT today.
            </div>
          )}
          {!isNewUserWindow && isRegionLocked && !isF4Locked && (
            <div style={{
              marginTop: 12, backgroundColor: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#92400e", fontWeight: 600,
            }}>
              🔒 Region brackets are locked — Final Four &amp; Championship picks open until midnight tonight.
            </div>
          )}
          {!isNewUserWindow && isRegionLocked && isF4Locked && (
            <div style={{
              marginTop: 12, backgroundColor: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#b91c1c", fontWeight: 600,
            }}>
              🔒 Brackets are locked — no further changes can be made.
            </div>
          )}
        </div>

        {/* Bracket name + save */}
        {user && (!isLocked || !isF4Locked) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={bracketName}
              onChange={e => setBracketName(e.target.value)}
              placeholder="Your bracket name..."
              style={{
                height: 38, border: "1.5px solid #d6d3d1", borderRadius: 8,
                padding: "0 14px", fontSize: 13, width: 220, backgroundColor: "#fff",
              }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                height: 38, padding: "0 20px", borderRadius: 8, border: "none",
                backgroundColor: saved ? "#16a34a" : "#3b82f6", color: "#fff",
                fontWeight: 700, fontSize: 13, cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving ? "Saving..." : saved ? "✓ Saved" : "Save Bracket"}
            </button>
          </div>
        )}

        {!user && (!isLocked || !isF4Locked) && (
          <div style={{
            textAlign: "center", marginBottom: 20, padding: "12px 16px",
            backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
            fontSize: 13, color: "#92400e",
          }}>
            <Link href="/auth" style={{ color: "#b45309", fontWeight: 700 }}>Sign in</Link> to save your bracket picks.
          </div>
        )}

        <ProgressBar picks={picks} totalGames={totalGames} />

        {/* Leaderboard rank */}
        {leaderboardInfo && saved && (
          <div style={{
            maxWidth: 500, margin: "0 auto 20px", textAlign: "center",
            backgroundColor: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 8, padding: "8px 16px", fontSize: 13,
          }}>
            <span style={{ color: "#0369a1" }}>
              📊 You are ranked <strong style={{ color: "#0c4a6e", fontSize: 15 }}>#{leaderboardInfo.rank}</strong> of {leaderboardInfo.total} bracket{leaderboardInfo.total !== 1 ? "s" : ""}
            </span>
            {" · "}
            <Link href="/bracket-leaderboard" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
              View Full Leaderboard →
            </Link>
          </div>
        )}

        {/* Final Four */}
        <FinalFourPicker
          regionWinners={regionWinners}
          picks={picks}
          onPick={handlePick}
          isLocked={isF4Locked}
          allTeams={teams}
        />

        {/* Region brackets */}
        {regionNames.map(region => (
          <RegionBracket
            key={region}
            regionName={region}
            teams={regions[region]}
            picks={picks}
            onPick={handlePick}
            isLocked={isLocked}
          />
        ))}

        {/* Back to top */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 22px", borderRadius: 8,
              backgroundColor: "#0a1628", color: "#f0f4ff",
              border: "none", fontSize: 13, fontWeight: 700,
              cursor: "pointer", letterSpacing: "0.03em",
            }}
          >
            ↑ Back to Top
          </button>
        </div>

        {/* Scoring info */}
        <div style={{
          maxWidth: 500, margin: "0 auto 40px",
          backgroundColor: "#f0f9ff", border: "1px solid #bae6fd",
          borderRadius: 10, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0c4a6e", marginBottom: 8 }}>📊 Scoring</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "#0369a1" }}>
            {ROUND_NAMES.map((name, i) => (
              <React.Fragment key={name}>
                <span>{name}</span>
                <span style={{ fontWeight: 700, textAlign: "right" }}>{ROUND_POINTS[i]} pts</span>
              </React.Fragment>
            ))}
            <span style={{ fontWeight: 700, borderTop: "1px solid #bae6fd", paddingTop: 4 }}>Max Possible</span>
            <span style={{ fontWeight: 700, textAlign: "right", borderTop: "1px solid #bae6fd", paddingTop: 4 }}>
              {ROUND_POINTS.reduce((sum, pts, i) => sum + pts * (i < 4 ? Math.pow(2, 4 - i) : i === 4 ? 2 : 1), 0)} pts
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
