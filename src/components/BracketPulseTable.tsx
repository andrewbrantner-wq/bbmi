"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import seedingData from "@/data/seeding/seeding.json";
import tournamentResultsRaw from "@/data/seeding/tournament-results.json";

type Team = {
  name: string;
  seed: number;
  region: string;
  playIn: boolean;
  roundOf32: number;
  sweet16: number;
  elite8: number;
  final4: number;
  championship: number;
  winTitle: number;
};

type GameDetail = {
  teams: [string, string]; // [winner, loser]
  scores: [number, number]; // [winner score, loser score]
};

// Parse tournament results — winner strings + _details with scores
const tournamentResults: Record<string, string> = {};
const gameDetails: Record<string, GameDetail> = {};
if (tournamentResultsRaw && typeof tournamentResultsRaw === "object") {
  const raw = tournamentResultsRaw as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "_details" && v && typeof v === "object") {
      for (const [dk, dv] of Object.entries(v as Record<string, unknown>)) {
        gameDetails[dk] = dv as GameDetail;
      }
    } else if (typeof v === "string") {
      tournamentResults[k] = v;
    }
  }
}

function fmtPct(v: number | undefined) {
  if (v == null) return "";
  const pct = v > 1 ? v : v * 100;
  return `${pct.toFixed(1)}%`;
}

/** Detect upset status for the lower-seeded team in a matchup.
 *  Returns "possible" if the lower seed has ≥40% win prob (pre-game),
 *  or null if no upset alert applies. "actual" upsets would require
 *  game result data (not yet in seeding.json). */
function getUpsetAlert(
  teamA: Team | undefined,
  teamB: Team | undefined,
  probKey: keyof Team,
): { team: Team; alert: "possible" } | null {
  if (!teamA || !teamB) return null;
  const seedA = teamA.seed;
  const seedB = teamB.seed;
  if (seedA === seedB) return null; // same seed, no upset

  const lowerSeed = seedA > seedB ? teamA : teamB; // higher seed number = lower seed
  const lowerProb = typeof lowerSeed[probKey] === "number" ? (lowerSeed[probKey] as number) : 0;
  const normalizedProb = lowerProb > 1 ? lowerProb / 100 : lowerProb;

  // Only flag if lower seed has ≥40% chance AND seed difference is ≥ 3
  if (normalizedProb >= 0.40 && Math.abs(seedA - seedB) >= 3) {
    return { team: lowerSeed, alert: "possible" };
  }
  return null;
}

function getProjectedWinner(teams: (Team | undefined)[], probKey: keyof Team): Team | undefined {
  const valid = teams.filter(Boolean) as Team[];
  if (valid.length === 0) return undefined;
  return valid.reduce((best, current) => {
    const bestProb = typeof best[probKey] === "number" ? (best[probKey] as number) : 0;
    const currentProb = typeof current[probKey] === "number" ? (current[probKey] as number) : 0;
    return currentProb > bestProb ? current : best;
  });
}

// ── Layout constants ──────────────────────────────────────────────────────────
const TEAM_H   = 24;   // height of one team slot
const TEAM_W   = 165;  // width of each team slot
const CONN_W   = 20;   // horizontal connector gap between columns
const SLOT_GAP = 6;    // gap between the two teams within a matchup pair
const ROW_GAP  = 6;    // gap between matchup rows
const PAIR_H   = TEAM_H * 2 + SLOT_GAP;

// Standard NCAA bracket seed order (top→bottom per region)
const MATCHUPS: [number, number][] = [
  [1, 16], [8, 9],
  [5, 12], [4, 13],
  [6, 11], [3, 14],
  [7, 10], [2, 15],
];

// ── Final Four layout constants (outside component so sub-components can reference) ──
const FF_TEAM_H                = 28;
const FF_TEAM_W                = 200;
const FF_CONN_W                = 32;
const FF_BORDER                = "#c97a2a";
const FF_CONN                  = "#c97a2a";
const FF_SLOT_BG               = "#fffbf5";
const FF_SLOT_HIGHLIGHT_BG     = "#fff3e0";
const FF_SLOT_HIGHLIGHT_BORDER = "#e07b20";

// ── FfTeamSlot ────────────────────────────────────────────────────────────────
function FfTeamSlot({
  team, prob, isChamp = false,
}: {
  team: Team | undefined;
  prob?: number;
  isChamp?: boolean;
}) {
  const bg     = isChamp ? FF_SLOT_HIGHLIGHT_BG    : FF_SLOT_BG;
  const border = isChamp ? FF_SLOT_HIGHLIGHT_BORDER : FF_BORDER;
  const fw     = isChamp ? 700 : 500;
  if (!team) return (
    <div style={{
      height: FF_TEAM_H, width: FF_TEAM_W, border: `1px solid ${border}`, background: bg,
      display: "flex", alignItems: "center", paddingLeft: 6,
      fontSize: 13, color: "#a8a29e", boxSizing: "border-box",
    }}>
      <span style={{ fontStyle: "italic" }}>TBD</span>
    </div>
  );
  return (
    <div style={{
      height: FF_TEAM_H, width: FF_TEAM_W, border: `1px solid ${border}`, background: bg,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingLeft: 6, paddingRight: 8, fontSize: 13, fontWeight: fw, boxSizing: "border-box",
    }}>
      <Link
        href={`/ncaa-team/${encodeURIComponent(team.name)}`}
        style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 5, flex: 1, overflow: "hidden" }}
      >
        <NCAALogo teamName={team.name} size={16} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ marginRight: 3 }}>{team.seed}</strong>{team.name}
        </span>
      </Link>
      {prob !== undefined && prob > 0 && (
        <span style={{ color: isChamp ? "#b45309" : "#9a6a2a", fontSize: 12, marginLeft: 6, flexShrink: 0, fontWeight: 700 }}>
          {fmtPct(prob)}
        </span>
      )}
    </div>
  );
}

// ── FfConn ────────────────────────────────────────────────────────────────────
function FfConn({ x, topY, botY }: { x: number; topY: number; botY: number }) {
  const midY  = (topY + botY) / 2;
  const stubW = FF_CONN_W / 2;
  const s: React.CSSProperties = { position: "absolute", backgroundColor: FF_CONN };
  return (
    <>
      <div style={{ ...s, top: topY, left: x,          width: stubW, height: 1 }} />
      <div style={{ ...s, top: topY, left: x + stubW,  width: 1, height: botY - topY + 1 }} />
      <div style={{ ...s, top: botY, left: x,          width: stubW, height: 1 }} />
      <div style={{ ...s, top: midY, left: x + stubW,  width: stubW, height: 1 }} />
    </>
  );
}

// ── Helpers: look up actual tournament results + scores ───────────────────────
function getActualWinnerName(resultKey: string): string | null {
  return tournamentResults[resultKey] ?? null;
}
function getScoreForTeam(resultKey: string, teamName: string): number | null {
  const detail = gameDetails[resultKey];
  if (!detail) return null;
  if (detail.teams[0] === teamName) return detail.scores[0];
  if (detail.teams[1] === teamName) return detail.scores[1];
  return null;
}

// ── TeamSlot ──────────────────────────────────────────────────────────────────
function TeamSlot({
  team, seed, prob, showProb = true, highlight = false, upsetAlert,
  score, isEliminated = false, style = {},
}: {
  team: Team | undefined;
  seed?: number;
  prob?: number;
  showProb?: boolean;
  highlight?: boolean;
  upsetAlert?: "possible" | "actual" | null;
  score?: number | null;
  isEliminated?: boolean;
  style?: React.CSSProperties;
}) {
  const isUpset = upsetAlert === "actual";
  const isPossible = upsetAlert === "possible";
  const hasScore = score != null;
  const borderColor = isUpset ? "#dc2626" : isPossible ? "#d97706" : highlight ? "#f07d20" : "#d6d3d1";
  const bgColor     = isUpset ? "#fef2f2" : isPossible ? "#fffbeb" : isEliminated ? "#f5f5f4" : highlight ? "#fff7ed" : "white";

  if (!team) {
    return (
      <div style={{
        height: TEAM_H, width: TEAM_W,
        border: `1px solid ${borderColor}`, background: "#fafaf9",
        display: "flex", alignItems: "center", paddingLeft: 4,
        fontSize: 12, color: "#a8a29e", boxSizing: "border-box", ...style,
      }}>
        {seed !== undefined && <strong style={{ marginRight: 3 }}>{seed}</strong>}
        <span style={{ fontStyle: "italic" }}>TBD</span>
      </div>
    );
  }

  return (
    <div style={{
      height: TEAM_H, width: TEAM_W,
      border: `1px solid ${borderColor}`, background: bgColor,
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 4, paddingRight: 6,
      fontSize: 12, boxSizing: "border-box",
      opacity: isEliminated ? 0.5 : 1,
      ...style,
    }}>
      <Link
        href={`/ncaa-team/${encodeURIComponent(team.name)}`}
        style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}
      >
        <NCAALogo teamName={team.name} size={14} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <strong style={{ marginRight: 2 }}>{team.seed}</strong>
          {team.name}
        </span>
      </Link>
      {isUpset && (
        <span style={{
          fontSize: 7.5, fontWeight: 800, color: "#dc2626",
          backgroundColor: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 3, padding: "0px 3px", flexShrink: 0, marginLeft: 2,
          letterSpacing: "0.04em", textTransform: "uppercase", lineHeight: "14px",
        }}>
          UPSET
        </span>
      )}
      {isPossible && !hasScore && (
        <span style={{
          fontSize: 7.5, fontWeight: 800, color: "#d97706",
          backgroundColor: "#fef3c7", border: "1px solid #fde68a",
          borderRadius: 3, padding: "0px 3px", flexShrink: 0, marginLeft: 2,
          letterSpacing: "0.04em", lineHeight: "14px",
        }}>
          ⚡
        </span>
      )}
      {hasScore ? (
        <span style={{
          fontSize: 12, fontWeight: 700, marginLeft: 4, flexShrink: 0,
          color: isEliminated ? "#a8a29e" : highlight ? "#c2410c" : "#1e293b",
        }}>
          {score}
        </span>
      ) : (
        showProb && prob !== undefined && prob > 0 && (
          <span style={{ color: isUpset ? "#dc2626" : isPossible ? "#d97706" : highlight ? "#c2410c" : "#78716c", fontSize: 11, marginLeft: 4, flexShrink: 0 }}>
            {fmtPct(prob)}
          </span>
        )
      )}
    </div>
  );
}

// ── BracketConn: vertical bar + left stubs + optional right stub at midpoint ──
function BracketConn({
  x, topY, botY, color = "#a8a29e", noRightStub = false,
}: {
  x: number; topY: number; botY: number; color?: string; noRightStub?: boolean;
}) {
  const midY  = (topY + botY) / 2;
  const stubW = CONN_W / 2;
  const s: React.CSSProperties = { position: "absolute", backgroundColor: color };
  return (
    <>
      {/* left stub at top */}
      <div style={{ ...s, top: topY, left: x, width: stubW, height: 1 }} />
      {/* vertical bar */}
      <div style={{ ...s, top: topY, left: x + stubW, width: 1, height: botY - topY + 1 }} />
      {/* left stub at bottom */}
      <div style={{ ...s, top: botY, left: x, width: stubW, height: 1 }} />
      {/* right stub at midpoint → next column */}
      {!noRightStub && <div style={{ ...s, top: midY, left: x + stubW, width: stubW, height: 1 }} />}
    </>
  );
}

// ── PlayInConn: mirrors WIAA RQConn — stubs from each play-in slot + vertical bar reaching RS slot ──
function PlayInConn({
  x, topMidY, botMidY, targetMidY, color = "#a8a29e",
}: {
  x: number; topMidY: number; botMidY: number; targetMidY: number; color?: string;
}) {
  const stubW = CONN_W / 2;
  const barTop = Math.min(topMidY, botMidY, targetMidY);
  const barBot = Math.max(topMidY, botMidY, targetMidY);
  const s: React.CSSProperties = { position: "absolute", backgroundColor: color };
  return (
    <>
      <div style={{ ...s, top: topMidY,    left: x,          width: stubW, height: 1 }} />
      <div style={{ ...s, top: botMidY,    left: x,          width: stubW, height: 1 }} />
      <div style={{ ...s, top: barTop,     left: x + stubW,  width: 1, height: barBot - barTop + 1 }} />
      <div style={{ ...s, top: targetMidY, left: x + stubW,  width: stubW, height: 1 }} />
    </>
  );
}

// ── renderRegion ──────────────────────────────────────────────────────────────
function renderRegion(regionName: string, regionTeams: Team[]) {
  const playInBySeed: Record<number, Team[]> = {};
  regionTeams.filter(t => t.playIn).forEach(t => {
    if (!playInBySeed[t.seed]) playInBySeed[t.seed] = [];
    playInBySeed[t.seed].push(t);
  });

  // Helper: find Team object by name in this region
  const findTeam = (name: string): Team | undefined =>
    regionTeams.find(t => t.name === name);

  // For a seed, return play-in actual/projected winner or the direct team
  const getTeam = (seed: number): Team | undefined => {
    const pi = playInBySeed[seed];
    if (pi?.length > 0) {
      const actualName = getActualWinnerName(`PlayIn|${regionName}|${seed}`);
      if (actualName) return findTeam(actualName) ?? getProjectedWinner(pi, "sweet16");
      return getProjectedWinner(pi, "sweet16");
    }
    return regionTeams.find(t => t.seed === seed && !t.playIn);
  };

  // ── Compute R64 row tops ─────────────────────────────────────────────────
  const r64PairTops: number[] = [];
  let cursor = 0;
  MATCHUPS.forEach(() => {
    r64PairTops.push(cursor);
    cursor += PAIR_H + ROW_GAP;
  });
  const totalHeight = cursor - ROW_GAP;

  // ── Column X positions — Play-In column always present ───────────────────
  const PI_X  = 0;
  const R64_X = TEAM_W + CONN_W;
  const R32_X = R64_X + TEAM_W + CONN_W;
  const S16_X = R32_X + TEAM_W + CONN_W;
  const E8_X  = S16_X + TEAM_W + CONN_W;
  const F4_X  = E8_X  + TEAM_W + CONN_W;
  const TOTAL_W = F4_X + TEAM_W;

  // ── R64 slot tops ─────────────────────────────────────────────────────────
  const r64SlotTops = MATCHUPS.map((_, i) => ({
    top: r64PairTops[i],
    bot: r64PairTops[i] + TEAM_H + SLOT_GAP,
  }));

  // ── Mid-Y of each R64 slot ────────────────────────────────────────────────
  const r64MidYs = r64SlotTops.map(({ top, bot }) => ({
    top: top + TEAM_H / 2,
    bot: bot + TEAM_H / 2,
  }));

  // ── R32 winners (actual results take priority) ────────────────────────────
  const r32Winners = MATCHUPS.map(([s1, s2], slot) => {
    const rkey = `R64|${regionName}|${slot}`;
    const actualName = getActualWinnerName(rkey);
    if (actualName) return findTeam(actualName) ?? getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16");
    return getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16");
  });
  // Track which R64 slots have actual results
  const r64Actual = MATCHUPS.map((_, slot) => !!getActualWinnerName(`R64|${regionName}|${slot}`));
  const r32MidYs = MATCHUPS.map((_, i) =>
    (r64MidYs[i].top + r64MidYs[i].bot) / 2
  );
  const r32SlotTops = r32MidYs.map(y => y - TEAM_H / 2);

  // ── S16 winners (actual results take priority) ─────────────────────────────
  const s16Winners = [0, 1, 2, 3].map(slot => {
    const rkey = `R32|${regionName}|${slot}`;
    const actualName = getActualWinnerName(rkey);
    if (actualName) return findTeam(actualName) ?? getProjectedWinner([r32Winners[slot * 2], r32Winners[slot * 2 + 1]], "elite8");
    return getProjectedWinner([r32Winners[slot * 2], r32Winners[slot * 2 + 1]], "elite8");
  });
  const r32Actual = [0, 1, 2, 3].map(slot => !!getActualWinnerName(`R32|${regionName}|${slot}`));
  const s16MidYs = [0, 1, 2, 3].map(i =>
    (r32MidYs[i * 2] + r32MidYs[i * 2 + 1]) / 2
  );
  const s16SlotTops = s16MidYs.map(y => y - TEAM_H / 2);

  // ── E8 winners (actual results take priority) ─────────────────────────────
  const e8Winners = [0, 1].map(slot => {
    const rkey = `S16|${regionName}|${slot}`;
    const actualName = getActualWinnerName(rkey);
    if (actualName) return findTeam(actualName) ?? getProjectedWinner([s16Winners[slot * 2], s16Winners[slot * 2 + 1]], "final4");
    return getProjectedWinner([s16Winners[slot * 2], s16Winners[slot * 2 + 1]], "final4");
  });
  const s16Actual = [0, 1].map(slot => !!getActualWinnerName(`S16|${regionName}|${slot}`));
  const e8MidYs = [0, 1].map(i =>
    (s16MidYs[i * 2] + s16MidYs[i * 2 + 1]) / 2
  );
  const e8SlotTops = e8MidYs.map(y => y - TEAM_H / 2);

  // ── F4 (region winner — actual result takes priority) ─────────────────────
  const e8Actual = !!getActualWinnerName(`E8|${regionName}|0`);
  const regionWinnerActualName = getActualWinnerName(`E8|${regionName}|0`);
  const regionWinner = regionWinnerActualName
    ? (findTeam(regionWinnerActualName) ?? getProjectedWinner(e8Winners, "championship"))
    : getProjectedWinner(e8Winners, "championship");
  const f4MidY = (e8MidYs[0] + e8MidYs[1]) / 2;
  const f4SlotTop = f4MidY - TEAM_H / 2;

  const nodes: React.ReactNode[] = [];

  // ── Play-in games ─────────────────────────────────────────────────────────
  MATCHUPS.forEach(([s1, s2], mi) => {
    ([s1, s2] as number[]).forEach((seed, si) => {
      const piTeams = playInBySeed[seed];
      if (!piTeams || piTeams.length < 2) return;

      const r64SlotTop = si === 0 ? r64SlotTops[mi].top : r64SlotTops[mi].bot;
      const r64SlotMidY = r64SlotTop + TEAM_H / 2;

      const piPairTop = r64SlotTop;
      const piTopMidY = piPairTop + TEAM_H / 2;
      const piBotMidY = piPairTop + TEAM_H + SLOT_GAP + TEAM_H / 2;

      nodes.push(
        <div key={`pi-${mi}-${si}-a`} style={{ position: "absolute", top: piPairTop, left: PI_X }}>
          <TeamSlot team={piTeams[0]} showProb={false}
            score={getScoreForTeam(`PlayIn|${regionName}|${seed}`, piTeams[0]?.name ?? "")}
            isEliminated={!!getActualWinnerName(`PlayIn|${regionName}|${seed}`) && getActualWinnerName(`PlayIn|${regionName}|${seed}`) !== piTeams[0]?.name}
          />
        </div>,
        <div key={`pi-${mi}-${si}-b`} style={{ position: "absolute", top: piPairTop + TEAM_H + SLOT_GAP, left: PI_X }}>
          <TeamSlot team={piTeams[1]} showProb={false}
            score={getScoreForTeam(`PlayIn|${regionName}|${seed}`, piTeams[1]?.name ?? "")}
            isEliminated={!!getActualWinnerName(`PlayIn|${regionName}|${seed}`) && getActualWinnerName(`PlayIn|${regionName}|${seed}`) !== piTeams[1]?.name}
          />
        </div>,
        <PlayInConn
          key={`pi-conn-${mi}-${si}`}
          x={PI_X + TEAM_W}
          topMidY={piTopMidY}
          botMidY={piBotMidY}
          targetMidY={r64SlotMidY}
        />,
      );
    });
  });

  // ── Round of 64 ───────────────────────────────────────────────────────────
  MATCHUPS.forEach(([s1, s2], mi) => {
    const teamA = getTeam(s1);
    const teamB = getTeam(s2);
    const rkey = `R64|${regionName}|${mi}`;
    const hasResult = r64Actual[mi];
    const actualWinnerName = getActualWinnerName(rkey);
    const upset = hasResult ? null : getUpsetAlert(teamA, teamB, "roundOf32");
    nodes.push(
      <div key={`r64-${mi}-a`} style={{ position: "absolute", top: r64SlotTops[mi].top, left: R64_X }}>
        <TeamSlot team={teamA} seed={s1} showProb={false}
          upsetAlert={!hasResult && upset?.team === teamA ? upset?.alert : null}
          score={getScoreForTeam(rkey, teamA?.name ?? "")}
          isEliminated={hasResult && actualWinnerName !== teamA?.name}
        />
      </div>,
      <div key={`r64-${mi}-b`} style={{ position: "absolute", top: r64SlotTops[mi].bot, left: R64_X }}>
        <TeamSlot team={teamB} seed={s2} showProb={false}
          upsetAlert={!hasResult && upset?.team === teamB ? upset?.alert : null}
          score={getScoreForTeam(rkey, teamB?.name ?? "")}
          isEliminated={hasResult && actualWinnerName !== teamB?.name}
        />
      </div>,
    );
    nodes.push(
      <BracketConn
        key={`conn-r64-${mi}`}
        x={R64_X + TEAM_W}
        topY={r64MidYs[mi].top}
        botY={r64MidYs[mi].bot}
        noRightStub
      />,
      <div key={`stub-r64-${mi}`} style={{
        position: "absolute",
        top: r32MidYs[mi],
        left: R64_X + TEAM_W + CONN_W / 2,
        width: CONN_W / 2,
        height: 1,
        backgroundColor: "#a8a29e",
      }} />,
    );
  });

  // ── Round of 32 ───────────────────────────────────────────────────────────
  // Each R32 slot (index i) shows the R64 winner. The score to display is
  // from the R32 game this team plays IN, not the R64 game they already won.
  // R32 game slot = floor(i/2): winners from R64 slots i*2 and i*2+1 play each other.
  r32Winners.forEach((winner, i) => {
    const r32GameKey = `R32|${regionName}|${Math.floor(i / 2)}`;
    const isActual = r64Actual[i];
    const [s1, s2] = MATCHUPS[i];
    const opponent = winner === getTeam(s1) ? getTeam(s2) : getTeam(s1);
    const r32Upset = isActual
      ? (winner && opponent && winner.seed > opponent.seed && Math.abs(winner.seed - opponent.seed) >= 3 ? { team: winner, alert: "actual" as const } : null)
      : getUpsetAlert(winner, opponent, "roundOf32");
    nodes.push(
      <div key={`r32-${i}`} style={{ position: "absolute", top: r32SlotTops[i], left: R32_X }}>
        <TeamSlot
          team={winner}
          prob={isActual ? undefined : winner?.roundOf32}
          score={getScoreForTeam(r32GameKey, winner?.name ?? "")}
          upsetAlert={r32Upset?.team === winner ? r32Upset?.alert : null}
        />
      </div>,
    );
  });

  [0, 1, 2, 3].forEach(i => {
    nodes.push(
      <BracketConn
        key={`conn-r32-${i}`}
        x={R32_X + TEAM_W}
        topY={r32MidYs[i * 2]}
        botY={r32MidYs[i * 2 + 1]}
        noRightStub
      />,
      <div key={`stub-r32-${i}`} style={{
        position: "absolute",
        top: s16MidYs[i],
        left: R32_X + TEAM_W + CONN_W / 2,
        width: CONN_W / 2,
        height: 1,
        backgroundColor: "#a8a29e",
      }} />,
    );
  });

  // ── Sweet 16 ──────────────────────────────────────────────────────────────
  // Each S16 slot (index i) shows the R32 winner. Score is from the S16 game.
  s16Winners.forEach((winner, i) => {
    const s16GameKey = `S16|${regionName}|${Math.floor(i / 2)}`;
    const isActual = r32Actual[i];
    nodes.push(
      <div key={`s16-${i}`} style={{ position: "absolute", top: s16SlotTops[i], left: S16_X }}>
        <TeamSlot team={winner}
          prob={isActual ? undefined : winner?.sweet16}
          score={getScoreForTeam(s16GameKey, winner?.name ?? "")}
        />
      </div>,
    );
  });

  [0, 1].forEach(i => {
    nodes.push(
      <BracketConn
        key={`conn-s16-${i}`}
        x={S16_X + TEAM_W}
        topY={s16MidYs[i * 2]}
        botY={s16MidYs[i * 2 + 1]}
        noRightStub
      />,
      <div key={`stub-s16-${i}`} style={{
        position: "absolute",
        top: e8MidYs[i],
        left: S16_X + TEAM_W + CONN_W / 2,
        width: CONN_W / 2,
        height: 1,
        backgroundColor: "#a8a29e",
      }} />,
    );
  });

  // ── Elite 8 ───────────────────────────────────────────────────────────────
  // Each E8 slot (index i) shows the S16 winner. Score is from the E8 game.
  e8Winners.forEach((winner, i) => {
    const e8GameKey = `E8|${regionName}|0`;
    const isActual = s16Actual[i];
    nodes.push(
      <div key={`e8-${i}`} style={{ position: "absolute", top: e8SlotTops[i], left: E8_X }}>
        <TeamSlot team={winner}
          prob={isActual ? undefined : winner?.elite8}
          score={getScoreForTeam(e8GameKey, winner?.name ?? "")}
        />
      </div>,
    );
  });

  nodes.push(
    <BracketConn
      key="conn-e8"
      x={E8_X + TEAM_W}
      topY={e8MidYs[0]}
      botY={e8MidYs[1]}
      noRightStub
    />,
    <div key="stub-e8" style={{
      position: "absolute",
      top: f4MidY,
      left: E8_X + TEAM_W + CONN_W / 2,
      width: CONN_W / 2,
      height: 1,
      backgroundColor: "#a8a29e",
    }} />,
  );

  // ── Final Four slot ───────────────────────────────────────────────────────
  // This slot shows who advances to the Final Four. No game is played here
  // at the regional level, so no score — just probability or actual lock-in.
  nodes.push(
    <div key="f4" style={{ position: "absolute", top: f4SlotTop, left: F4_X }}>
      <TeamSlot team={regionWinner}
        prob={e8Actual ? undefined : regionWinner?.final4}
        highlight
      />
    </div>,
  );

  // ── Column headers ────────────────────────────────────────────────────────
  const roundLabels = [
    { label: "Play-In",     w: TEAM_W + CONN_W },
    { label: "Round of 64", w: TEAM_W + CONN_W },
    { label: "Round of 32", w: TEAM_W + CONN_W },
    { label: "Sweet 16",    w: TEAM_W + CONN_W },
    { label: "Elite 8",     w: TEAM_W + CONN_W },
    { label: "Final Four",  w: TEAM_W },
  ];

  return (
    <div key={regionName} style={{
      border: "1px solid #1e3a5f",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(10,26,47,0.18)",
      marginBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(90deg, #0a1a2f 0%, #1e3a5f 100%)",
        color: "#ffffff",
        textAlign: "center",
        padding: "12px 16px",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}>
        {regionName} Region
      </div>
      {/* Column headers */}
      <div style={{ display: "flex", backgroundColor: "#1e3a5f" }}>
        {roundLabels.map(({ label, w }, i) => (
          <div key={label} style={{
            width: w,
            flexShrink: 0,
            flexGrow: i === roundLabels.length - 1 ? 1 : 0,
            textAlign: "center",
            padding: "7px 0",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase" as const,
            letterSpacing: "0.07em",
            color: "#a8c4e0",
            borderRight: i < roundLabels.length - 1 ? "1px solid rgba(255,255,255,0.1)" : undefined,
          }}>
            {label}
          </div>
        ))}
      </div>
      {/* Bracket canvas */}
      <div style={{ background: "#f8fafc", padding: "16px 20px 24px", overflowX: "auto" }}>
        <div style={{ position: "relative", height: totalHeight, width: TOTAL_W, minWidth: TOTAL_W }}>
          {nodes}
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function TournamentBracket() {
  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return (seedingData as Record<string, unknown>[]).map((r) => ({
      name:         String(r.Team ?? r.team ?? ""),
      seed:         Number(r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? 0),
      region:       String(r.Region ?? r.region ?? ""),
      playIn:       Boolean(r.PlayIn ?? r.playIn ?? false),
      roundOf32:    Number(r.RoundOf32Pct ?? r.roundOf32Pct ?? 0),
      sweet16:      Number(r.Sweet16Pct ?? r.sweet16Pct ?? 0),
      elite8:       Number(r.Elite8Pct ?? r.elite8Pct ?? 0),
      final4:       Number(r.FinalFourPct ?? r.finalFourPct ?? 0),
      championship: Number(r.ChampionshipPct ?? r.championshipPct ?? 0),
      winTitle:     Number(r.WinTitlePct ?? r.winTitlePct ?? 0),
    }));
  }, []);

  const regions = useMemo(() => {
    const map: Record<string, Team[]> = {};
    teams.forEach((team) => {
      if (!team.region) return;
      if (!map[team.region]) map[team.region] = [];
      map[team.region].push(team);
    });
    Object.keys(map).forEach((r) => map[r].sort((a, b) => a.seed - b.seed));
    return map;
  }, [teams]);

  // Region order determines Final Four semi pairings (adjacent pairs play):
  //   East vs South  |  Midwest vs West
  const FF_REGION_ORDER = ["East", "South", "Midwest", "West"];

  const final4Teams = useMemo(() => {
    return FF_REGION_ORDER.filter(r => regions[r]).map((regionName) => {
      const regionTeams = regions[regionName];
      const findTeam = (name: string) => regionTeams.find(t => t.name === name);
      const playInBySeed: Record<number, Team[]> = {};
      regionTeams.filter(t => t.playIn).forEach(t => {
        if (!playInBySeed[t.seed]) playInBySeed[t.seed] = [];
        playInBySeed[t.seed].push(t);
      });
      const getTeam = (seed: number): Team | undefined => {
        const pi = playInBySeed[seed];
        if (pi?.length > 0) {
          const actual = getActualWinnerName(`PlayIn|${regionName}|${seed}`);
          if (actual) return findTeam(actual) ?? getProjectedWinner(pi, "sweet16");
          return getProjectedWinner(pi, "sweet16");
        }
        return regionTeams.find(t => t.seed === seed && !t.playIn);
      };
      // R64 → R32 winners
      const r32Winners = MATCHUPS.map(([s1, s2], slot) => {
        const actual = getActualWinnerName(`R64|${regionName}|${slot}`);
        if (actual) return findTeam(actual) ?? getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16");
        return getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16");
      });
      // R32 → S16 winners
      const s16Winners = [0,1,2,3].map(slot => {
        const actual = getActualWinnerName(`R32|${regionName}|${slot}`);
        if (actual) return findTeam(actual) ?? getProjectedWinner([r32Winners[slot*2], r32Winners[slot*2+1]], "elite8");
        return getProjectedWinner([r32Winners[slot*2], r32Winners[slot*2+1]], "elite8");
      });
      // S16 → E8 winners
      const e8Winners = [0,1].map(slot => {
        const actual = getActualWinnerName(`S16|${regionName}|${slot}`);
        if (actual) return findTeam(actual) ?? getProjectedWinner([s16Winners[slot*2], s16Winners[slot*2+1]], "final4");
        return getProjectedWinner([s16Winners[slot*2], s16Winners[slot*2+1]], "final4");
      });
      // E8 → region winner
      const actualRegionWinner = getActualWinnerName(`E8|${regionName}|0`);
      const winner = actualRegionWinner
        ? (findTeam(actualRegionWinner) ?? getProjectedWinner(e8Winners, "championship"))
        : getProjectedWinner(e8Winners, "championship");
      return { region: regionName, winner };
    });
  }, [regions]);

  // ── Final Four bracket layout ─────────────────────────────────────────────
  const FF_SLOT_GAP = 10;
  const FF_PAIR_GAP = 28;
  const FF_LABEL_H  = 16;
  const FF_PAIR_H   = FF_LABEL_H + FF_TEAM_H * 2 + FF_SLOT_GAP;

  const ffQualLabelTops = [
    0,
    FF_LABEL_H + FF_TEAM_H + FF_SLOT_GAP,
    FF_PAIR_H + FF_PAIR_GAP,
    FF_PAIR_H + FF_PAIR_GAP + FF_LABEL_H + FF_TEAM_H + FF_SLOT_GAP,
  ];
  const ffQualTops = ffQualLabelTops.map(y => y + FF_LABEL_H);
  const ffSemiMidYs = [
    (ffQualTops[0] + FF_TEAM_H / 2 + ffQualTops[1] + FF_TEAM_H / 2) / 2,
    (ffQualTops[2] + FF_TEAM_H / 2 + ffQualTops[3] + FF_TEAM_H / 2) / 2,
  ];
  const ffChampMidY = (ffSemiMidYs[0] + ffSemiMidYs[1]) / 2;
  const ffTotalH = ffQualTops[3] + FF_TEAM_H;

  const FF_QUAL_X  = 0;
  const FF_SEMI_X  = FF_TEAM_W + FF_CONN_W;
  const FF_CHAMP_X = FF_SEMI_X + FF_TEAM_W + FF_CONN_W;
  const FF_TOTAL_W = FF_CHAMP_X + FF_TEAM_W;

  const FF_BG = "#fdf6ee";

  const semiFinals = (() => {
    const allTeams = Object.values(regions).flat();
    const findAnyTeam = (name: string) => allTeams.find(t => t.name === name);
    // Semi 0: East vs South (final4Teams[0] vs [1])
    const semi0Actual = getActualWinnerName("F4|Semi|0");
    const semi0 = semi0Actual
      ? (findAnyTeam(semi0Actual) ?? getProjectedWinner([final4Teams[0]?.winner, final4Teams[1]?.winner], "championship"))
      : getProjectedWinner([final4Teams[0]?.winner, final4Teams[1]?.winner], "championship");
    // Semi 1: Midwest vs West (final4Teams[2] vs [3])
    const semi1Actual = getActualWinnerName("F4|Semi|1");
    const semi1 = semi1Actual
      ? (findAnyTeam(semi1Actual) ?? getProjectedWinner([final4Teams[2]?.winner, final4Teams[3]?.winner], "championship"))
      : getProjectedWinner([final4Teams[2]?.winner, final4Teams[3]?.winner], "championship");
    return [semi0, semi1];
  })();

  // Champion: actual result or highest winTitle
  const champion = (() => {
    const champActual = getActualWinnerName("CHAMP|Final|0");
    if (champActual) {
      const allTeams = Object.values(regions).flat();
      return allTeams.find(t => t.name === champActual) ?? null;
    }
    const all = Object.values(regions).flat();
    return all.length > 0 ? all.reduce((best, cur) => (cur.winTitle > best.winTitle ? cur : best)) : null;
  })();

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>

      {/* Methodology note */}
      <div style={{
        backgroundColor: "#f0f9ff", border: "1px solid #bae6fd",
        borderRadius: 8, padding: "10px 16px", marginBottom: 24,
        fontSize: 13, color: "#0369a1", lineHeight: 1.5,
      }}>
        <strong style={{ color: "#0c4a6e" }}>Methodology:</strong>{" "}
        Seedings are projected using NET rankings. Probabilities show the likelihood each team
        reaches that round, based on 10,000 Monte Carlo simulations using BBMI win probabilities.
        Bracket lines show the most likely team to advance at each stage.
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12, marginLeft: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{
              fontSize: 7.5, fontWeight: 800, color: "#d97706",
              backgroundColor: "#fef3c7", border: "1px solid #fde68a",
              borderRadius: 3, padding: "0px 3px", lineHeight: "14px",
            }}>⚡</span>
            <span style={{ fontSize: 12, color: "#92400e" }}>Upset alert (≥40% win prob, 3+ seed diff)</span>
          </span>
        </span>
      </div>

      {/* ── Final Four & Champion card ── */}
      <div style={{
        border: `1px solid ${FF_BORDER}`,
        borderRadius: 10, overflow: "hidden",
        boxShadow: "0 1px 6px rgba(180,83,9,0.13)",
        marginBottom: 40,
      }}>
        {/* Header bar */}
        <div style={{
          background: "linear-gradient(90deg, #7c2d12 0%, #b45309 100%)",
          color: "#fff", padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em" }}>
            🏆 Final Four &amp; Champion
          </span>
          <span style={{ fontSize: 12, opacity: 0.8, letterSpacing: "0.05em" }}>
            Semifinal → Finalist → Champion
          </span>
        </div>

        {/* Column headers */}
        <div style={{ display: "flex", backgroundColor: "#92400e" }}>
          {[
            { label: "Final Four", w: FF_TEAM_W + FF_CONN_W },
            { label: "Championship Game",  w: FF_TEAM_W + FF_CONN_W },
            { label: "Champion",  w: FF_TEAM_W },
          ].map(({ label, w }, i, arr) => (
            <div key={label} style={{
              width: w, textAlign: "center", padding: "6px 0",
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.07em", color: "#fde68a",
              borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.15)" : undefined,
              flexShrink: 0,
            }}>
              {label}
            </div>
          ))}
        </div>

        {/* Bracket canvas */}
        <div style={{ background: FF_BG, padding: "20px 24px 24px", overflowX: "auto" }}>
          <div style={{ position: "relative", height: ffTotalH, width: FF_TOTAL_W, minWidth: FF_TOTAL_W }}>

            {/* Qualifier slots */}
            {final4Teams.map(({ region, winner }, i) => (
              <React.Fragment key={region}>
                <div style={{
                  position: "absolute", top: ffQualLabelTops[i], left: FF_QUAL_X,
                  fontSize: 9, fontWeight: 700, color: "#9a6a2a", textTransform: "uppercase",
                  letterSpacing: "0.07em", lineHeight: "14px",
                }}>
                  {region}
                </div>
                <div style={{ position: "absolute", top: ffQualTops[i], left: FF_QUAL_X }}>
                  <FfTeamSlot team={winner} prob={winner?.final4} />
                </div>
              </React.Fragment>
            ))}

            {/* Qual → Semi connectors */}
            {[0, 1].map(i => (
              <FfConn
                key={`ff-conn-${i}`}
                x={FF_QUAL_X + FF_TEAM_W}
                topY={ffQualTops[i * 2]     + FF_TEAM_H / 2}
                botY={ffQualTops[i * 2 + 1] + FF_TEAM_H / 2}
              />
            ))}

            {/* Semi slots */}
            {semiFinals.map((team, i) => (
              <div key={`semi-${i}`} style={{ position: "absolute", top: ffSemiMidYs[i] - FF_TEAM_H / 2, left: FF_SEMI_X }}>
                <FfTeamSlot team={team} prob={team?.championship} />
              </div>
            ))}

            {/* Semi → Champ connector */}
            <FfConn
              x={FF_SEMI_X + FF_TEAM_W}
              topY={ffSemiMidYs[0]}
              botY={ffSemiMidYs[1]}
            />

            {/* Champion slot */}
            <div style={{ position: "absolute", top: ffChampMidY - FF_TEAM_H / 2, left: FF_CHAMP_X }}>
              <FfTeamSlot team={champion ?? undefined} prob={champion?.winTitle} isChamp />
            </div>

          </div>
        </div>
      </div>

      {/* Region brackets */}
      {Object.keys(regions).sort().map((regionName) =>
        renderRegion(regionName, regions[regionName])
      )}

    </div>
  );
}
