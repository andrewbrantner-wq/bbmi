"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import seedingData from "@/data/seeding/seeding.json";

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

// ── Shared card styles ────────────────────────────────────────────────────────
// ── TeamSlot ──────────────────────────────────────────────────────────────────
function TeamSlot({
  team, seed, prob, showProb = true, highlight = false, upsetAlert, style = {},
}: {
  team: Team | undefined;
  seed?: number;
  prob?: number;
  showProb?: boolean;
  highlight?: boolean;
  upsetAlert?: "possible" | "actual" | null;
  style?: React.CSSProperties;
}) {
  const isUpset = upsetAlert === "actual";
  const isPossible = upsetAlert === "possible";
  const borderColor = isUpset ? "#dc2626" : isPossible ? "#d97706" : highlight ? "#f07d20" : "#d6d3d1";
  const bgColor     = isUpset ? "#fef2f2" : isPossible ? "#fffbeb" : highlight ? "#fff7ed" : "white";

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
      fontSize: 12, boxSizing: "border-box", ...style,
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
      {isPossible && (
        <span style={{
          fontSize: 7.5, fontWeight: 800, color: "#d97706",
          backgroundColor: "#fef3c7", border: "1px solid #fde68a",
          borderRadius: 3, padding: "0px 3px", flexShrink: 0, marginLeft: 2,
          letterSpacing: "0.04em", lineHeight: "14px",
        }}>
          ⚡
        </span>
      )}
      {showProb && prob !== undefined && prob > 0 && (
        <span style={{ color: isUpset ? "#dc2626" : isPossible ? "#d97706" : highlight ? "#c2410c" : "#78716c", fontSize: 11, marginLeft: 4, flexShrink: 0 }}>
          {fmtPct(prob)}
        </span>
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

  // For a seed, return play-in winner (projected) or the direct team
  const getTeam = (seed: number): Team | undefined => {
    const pi = playInBySeed[seed];
    if (pi?.length > 0) return getProjectedWinner(pi, "sweet16");
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

  // ── R32 ───────────────────────────────────────────────────────────────────
  const r32Winners = MATCHUPS.map(([s1, s2]) =>
    getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16")
  );
  const r32MidYs = MATCHUPS.map((_, i) =>
    (r64MidYs[i].top + r64MidYs[i].bot) / 2
  );
  const r32SlotTops = r32MidYs.map(y => y - TEAM_H / 2);

  // ── S16 ───────────────────────────────────────────────────────────────────
  const s16Winners = [0, 1, 2, 3].map(i =>
    getProjectedWinner([r32Winners[i * 2], r32Winners[i * 2 + 1]], "elite8")
  );
  const s16MidYs = [0, 1, 2, 3].map(i =>
    (r32MidYs[i * 2] + r32MidYs[i * 2 + 1]) / 2
  );
  const s16SlotTops = s16MidYs.map(y => y - TEAM_H / 2);

  // ── E8 ────────────────────────────────────────────────────────────────────
  const e8Winners = [0, 1].map(i =>
    getProjectedWinner([s16Winners[i * 2], s16Winners[i * 2 + 1]], "final4")
  );
  const e8MidYs = [0, 1].map(i =>
    (s16MidYs[i * 2] + s16MidYs[i * 2 + 1]) / 2
  );
  const e8SlotTops = e8MidYs.map(y => y - TEAM_H / 2);

  // ── F4 ────────────────────────────────────────────────────────────────────
  const regionWinner = getProjectedWinner(e8Winners, "championship");
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
          <TeamSlot team={piTeams[0]} showProb={false} />
        </div>,
        <div key={`pi-${mi}-${si}-b`} style={{ position: "absolute", top: piPairTop + TEAM_H + SLOT_GAP, left: PI_X }}>
          <TeamSlot team={piTeams[1]} showProb={false} />
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
    const upset = getUpsetAlert(teamA, teamB, "roundOf32");
    nodes.push(
      <div key={`r64-${mi}-a`} style={{ position: "absolute", top: r64SlotTops[mi].top, left: R64_X }}>
        <TeamSlot team={teamA} seed={s1} showProb={false} upsetAlert={upset?.team === teamA ? upset?.alert : null} />
      </div>,
      <div key={`r64-${mi}-b`} style={{ position: "absolute", top: r64SlotTops[mi].bot, left: R64_X }}>
        <TeamSlot team={teamB} seed={s2} showProb={false} upsetAlert={upset?.team === teamB ? upset?.alert : null} />
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
  r32Winners.forEach((winner, i) => {
    // Check if this R32 winner is a lower seed than its R64 opponent
    const [s1, s2] = MATCHUPS[i];
    const opponent = winner === getTeam(s1) ? getTeam(s2) : getTeam(s1);
    const r32Upset = getUpsetAlert(winner, opponent, "roundOf32");
    nodes.push(
      <div key={`r32-${i}`} style={{ position: "absolute", top: r32SlotTops[i], left: R32_X }}>
        <TeamSlot team={winner} prob={winner?.roundOf32} upsetAlert={r32Upset?.team === winner ? r32Upset?.alert : null} />
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
  s16Winners.forEach((winner, i) => {
    nodes.push(
      <div key={`s16-${i}`} style={{ position: "absolute", top: s16SlotTops[i], left: S16_X }}>
        <TeamSlot team={winner} prob={winner?.sweet16} />
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
  e8Winners.forEach((winner, i) => {
    nodes.push(
      <div key={`e8-${i}`} style={{ position: "absolute", top: e8SlotTops[i], left: E8_X }}>
        <TeamSlot team={winner} prob={winner?.elite8} />
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
  nodes.push(
    <div key="f4" style={{ position: "absolute", top: f4SlotTop, left: F4_X }}>
      <TeamSlot team={regionWinner} prob={regionWinner?.final4} highlight />
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

  const final4Teams = useMemo(() => {
    return Object.keys(regions).sort().map((regionName) => {
      const regionTeams = regions[regionName];
      const playInBySeed: Record<number, Team[]> = {};
      regionTeams.filter(t => t.playIn).forEach(t => {
        if (!playInBySeed[t.seed]) playInBySeed[t.seed] = [];
        playInBySeed[t.seed].push(t);
      });
      const getTeam = (seed: number): Team | undefined => {
        const pi = playInBySeed[seed];
        if (pi?.length > 0) return getProjectedWinner(pi, "sweet16");
        return regionTeams.find(t => t.seed === seed && !t.playIn);
      };
      const r32Winners = MATCHUPS.map(([s1, s2]) =>
        getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16")
      );
      const s16Winners = [0,1,2,3].map(i =>
        getProjectedWinner([r32Winners[i*2], r32Winners[i*2+1]], "elite8")
      );
      const e8Winners = [0,1].map(i =>
        getProjectedWinner([s16Winners[i*2], s16Winners[i*2+1]], "final4")
      );
      return { region: regionName, winner: getProjectedWinner(e8Winners, "championship") };
    });
  }, [regions]);

  const allTeams = useMemo(() => Object.values(regions).flat(), [regions]);
  const champion = useMemo(() =>
    allTeams.length > 0
      ? allTeams.reduce((best, cur) => (cur.winTitle > best.winTitle ? cur : best))
      : null,
    [allTeams]
  );

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

  const semiFinals = [
    getProjectedWinner([final4Teams[0]?.winner, final4Teams[1]?.winner], "championship"),
    getProjectedWinner([final4Teams[2]?.winner, final4Teams[3]?.winner], "championship"),
  ];

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
