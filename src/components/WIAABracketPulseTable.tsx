"use client";

/**
 * WIAABracketPulseTable
 *
 * Renders a bracket-style table for one WIAA division.
 * Bracket structure (RQ matchups, RS matchups, etc.) is driven entirely by
 * bracketTemplate.json so each sub-region renders correctly regardless of how
 * many teams play in each round.
 *
 * Drop bracketTemplate.json into src/data/wiaa-seeding/ alongside the bracket JSONs.
 */

import React, { useMemo } from "react";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";

import rankingsData from "@/data/wiaa-rankings/WIAArankings-with-slugs.json";
import d1Data from "@/data/wiaa-seeding/wiaa-d1-bracket.json";
import d2Data from "@/data/wiaa-seeding/wiaa-d2-bracket.json";
import d3Data from "@/data/wiaa-seeding/wiaa-d3-bracket.json";
import d4Data from "@/data/wiaa-seeding/wiaa-d4-bracket.json";
import d5Data from "@/data/wiaa-seeding/wiaa-d5-bracket.json";
import bracketTemplate from "@/data/wiaa-seeding/bracketTemplate.json";
import wiaaScores from "@/data/wiaa-team/wiaa-scores.json";

// ─── Slug lookup (team name → slug from rankings) ────────────────────────────
const _slugByName: Record<string, string> = {};
(rankingsData as { team: string; slug: string }[]).forEach(r => {
  _slugByName[r.team] = r.slug;
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Team = {
  Team: string;
  Division: string;
  Sectional: string;
  SubRegion: string;   // e.g. "1A", "1B"
  Region: string;
  WIAASeed: number;
  BBMISeed: number;
  Seed: number;        // bracket-position seed (1-16)
  slug: string;
  RegionalQuarter: number;
  RegionalSemis: number;
  RegionalFinals: number;
  SectionalSemi: number;
  SectionalFinal: number;
  StateQualifier: number;
  StateFinalist: number;
  StateChampion: number;
};

/** One region's parsed bracket template */
type RegionTemplate = {
  rq: [number[], number[]][];   // each entry is [[seedA], [seedB]]
  rs: [number[], number[]][];
  rf: [number[], number[]][];
  has_rq: boolean;
};

type WIAAGame = {
  team: string;
  teamDiv: string;
  date: string;
  opp: string;
  oppDiv: string;
  location: string;
  result: string;
  teamScore: number | null;
  oppScore: number | null;
};

type WIAABracketPulseTableProps = { division: string };

// ── Score lookup ──────────────────────────────────────────────────────────────

const SCORES = wiaaScores as WIAAGame[];

const _marchCounts: Record<string, number> = {};
SCORES.forEach(g => {
  if (g.date.slice(5, 7) === "03") {
    _marchCounts[g.date] = (_marchCounts[g.date] ?? 0) + 1;
  }
});
const _tourneyDates = Object.keys(_marchCounts)
  .filter(d => _marchCounts[d] >= 20)
  .sort();
const RQ_DATE = _tourneyDates[0] ?? "2026-03-03";
const RS_DATE = _tourneyDates[1] ?? "2026-03-06";
const RF_DATE = _tourneyDates[2] ?? "2026-03-07";
const SS_DATE = _tourneyDates[3] ?? "2026-03-12";

function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function findGameResult(
  teamA: Team | undefined,
  teamB: Team | undefined,
  afterDate?: string,
): { scoreA: number | null; scoreB: number | null; date: string | null; isScore: boolean } | null {
  if (!teamA || !teamB) return null;

  const allGames = SCORES.filter(g =>
    ((g.team === teamA.Team && g.opp === teamB.Team) ||
     (g.team === teamB.Team && g.opp === teamA.Team)) &&
    (!afterDate || g.date >= afterDate)
  );
  if (!allGames.length) return null;

  const upcoming = allGames.find(g => g.result === "");
  const sorted = [...allGames].sort((a, b) => b.date.localeCompare(a.date));
  const game = upcoming ?? sorted[0];

  if (!game) return null;

  if (game.result !== "" && game.teamScore !== null && game.oppScore !== null) {
    const aIsTeam = game.team === teamA.Team;
    return {
      scoreA: aIsTeam ? game.teamScore : game.oppScore,
      scoreB: aIsTeam ? game.oppScore : game.teamScore,
      date: null,
      isScore: true,
    };
  }
  if (game.result === "") {
    return { scoreA: null, scoreB: null, date: fmtDate(game.date), isScore: false };
  }
  return null;
}

function slotGameInfo(
  game: { scoreA: number | null; scoreB: number | null; date: string | null; isScore: boolean } | null,
  isTeamA: boolean,
): { label: string; isScore: boolean } | null {
  if (!game) return null;
  if (game.isScore) {
    const score = isTeamA ? game.scoreA : game.scoreB;
    return { label: score != null ? String(score) : "", isScore: true };
  }
  return { label: game.date ?? "", isScore: false };
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const SLOT_H   = 28;
const SLOT_GAP = 3;
const COL_W    = 188;
const COL_GAP  = 30;
const SUB_GAP  = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(v: number | undefined): string {
  if (!v) return "";
  if (v < 0.001) return "<0.1%";
  return `${(v * 100).toFixed(1)}%`;
}

function projectedWinner(
  seeds: number[],
  bySeed: Record<number, Team>,
  probKey: keyof Team,
  minDate: string = RQ_DATE,
): Team | undefined {
  const candidates = seeds.map(s => bySeed[s]).filter(Boolean) as Team[];
  if (!candidates.length) return undefined;
  if (candidates.length === 1) return candidates[0];

  const datesToTry = [minDate, RS_DATE, RF_DATE].filter(d => d >= minDate);
  for (const dateFloor of datesToTry) {
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i];
        const b = candidates[j];
        const game = SCORES.find(g =>
          ((g.team === a.Team && g.opp === b.Team) ||
           (g.team === b.Team && g.opp === a.Team)) &&
          g.result !== "" && g.date >= dateFloor
        );
        if (game) {
          const winner = (game.result === "W") ? game.team : game.opp;
          return winner === a.Team ? a : b;
        }
      }
    }
  }

  return candidates.reduce((best, t) =>
    (t[probKey] as number) > (best[probKey] as number) ? t : best
  );
}

// ─── Primitive components ─────────────────────────────────────────────────────

function TeamSlot({
  team,
  prob,
  gameInfo,
  isBye = false,
  highlight = false,
  style = {},
  overrideSeed,
}: {
  team: Team | undefined;
  prob?: number;
  gameInfo?: { label: string; isScore: boolean } | null;
  isBye?: boolean;
  highlight?: boolean;
  style?: React.CSSProperties;
  overrideSeed?: number;
}) {
  const borderColor  = highlight ? "#f07d20" : isBye ? "#93c5fd" : "#e2e8f0";
  const bgColor      = highlight ? "#fff7ed" : isBye ? "#eff6ff" : "#ffffff";
  const seedColor    = highlight ? "#c2410c" : "#0a1628";

  const base: React.CSSProperties = {
    height: SLOT_H,
    width: COL_W,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 7,
    paddingRight: 8,
    fontSize: 11.5,
    border: `1px solid ${borderColor}`,
    borderRadius: 4,
    backgroundColor: bgColor,
    gap: 4,
    boxSizing: "border-box",
    transition: "box-shadow 0.15s",
    ...style,
  };

  if (!team) {
    return (
      <div style={{ ...base, color: "#cbd5e1", fontStyle: "italic", fontSize: 11, justifyContent: "center" }}>
        —
      </div>
    );
  }

  const rightEl = gameInfo
    ? (
      <span style={{
        fontSize: 10.5,
        fontWeight: gameInfo.isScore ? 700 : 500,
        color: gameInfo.isScore ? (highlight ? "#c2410c" : "#1e293b") : "#94a3b8",
        flexShrink: 0,
        letterSpacing: "-0.01em",
        fontStyle: gameInfo.isScore ? "normal" : "italic",
      }}>
        {gameInfo.label}
      </span>
    )
    : prob != null && prob > 0 && !isBye
    ? (
      <span style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: highlight ? "#c2410c" : "#64748b",
        flexShrink: 0,
        letterSpacing: "-0.01em",
      }}>
        {fmtPct(prob)}
      </span>
    )
    : null;

  return (
    <div style={base}>
      <Link
        href={`/wiaa-team/${encodeURIComponent(team.Team)}`}
        style={{
          textDecoration: "none",
          color: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 5,
          overflow: "hidden",
          flex: 1,
          minWidth: 0,
        }}
        className="group"
      >
        <TeamLogo slug={team.slug} size={16} />
        <strong style={{ fontSize: 10.5, flexShrink: 0, color: seedColor, minWidth: 18 }}>
          #{overrideSeed ?? team.WIAASeed}
        </strong>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "#1e293b",
            fontWeight: 500,
          }}
          className="group-hover:underline"
        >
          {team.Team}
        </span>
        {isBye && (
          <span style={{
            fontSize: 8.5,
            fontWeight: 700,
            color: "#0369a1",
            backgroundColor: "#dbeafe",
            borderRadius: 3,
            padding: "1px 4px",
            flexShrink: 0,
            marginLeft: 2,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}>
            BYE
          </span>
        )}
      </Link>
      {rightEl}
    </div>
  );
}

function BracketConn({
  x, topY, botY, color = "#cbd5e1", noStub = false,
}: {
  x: number; topY: number; botY: number; color?: string; noStub?: boolean;
}) {
  const midY  = (topY + botY) / 2;
  const stubW = COL_GAP / 2;
  const s: React.CSSProperties = { position: "absolute", backgroundColor: color };
  return (
    <>
      <div style={{ ...s, top: topY, left: x,           width: stubW, height: 1 }} />
      <div style={{ ...s, top: topY, left: x + stubW,   width: 1, height: botY - topY + 1 }} />
      <div style={{ ...s, top: botY, left: x,           width: stubW, height: 1 }} />
      {!noStub && <div style={{ ...s, top: midY, left: x + stubW, width: stubW, height: 1 }} />}
    </>
  );
}

function HStub({ x, y, color = "#cbd5e1" }: { x: number; y: number; color?: string }) {
  return (
    <div style={{
      position: "absolute",
      top: y,
      left: x,
      width: COL_GAP,
      height: 1,
      backgroundColor: color,
    }} />
  );
}

/** RQ→RS connector.
 *
 * The RQ pair is always positioned so that one of its two slots aligns exactly
 * with the RS slot it feeds into:
 *  - feedsIntoBot=true:  rqTop aligns with RS bottom slot → rsSlotMidY == rqTopMidY
 *  - feedsIntoBot=false: rqTop aligns with RS top slot    → rsSlotMidY == rqTopMidY
 *
 * In both cases the connection point is rqTopMidY. The vertical bar spans only
 * the two RQ slots (rqTopMidY → rqBotMidY). The horizontal stub exits at
 * rsSlotMidY. No extra vertical extension is ever needed.
 */
function RQConn({
  x, rqTopMidY, rqBotMidY, rsSlotMidY, color = "#cbd5e1",
}: {
  x: number; rqTopMidY: number; rqBotMidY: number; rsSlotMidY: number; color?: string;
}) {
  const stubW = COL_GAP / 2;
  const s: React.CSSProperties = { position: "absolute", backgroundColor: color };

  // Vertical bar must span: both RQ slot mids AND the rsSlotMidY target,
  // so the horizontal stub always has a vertical bar to connect from.
  const barTop = Math.min(rqTopMidY, rqBotMidY, rsSlotMidY);
  const barBot = Math.max(rqTopMidY, rqBotMidY, rsSlotMidY);

  return (
    <>
      {/* left stub from top RQ slot */}
      <div style={{ ...s, top: rqTopMidY, left: x, width: stubW, height: 1 }} />
      {/* left stub from bottom RQ slot */}
      <div style={{ ...s, top: rqBotMidY, left: x, width: stubW, height: 1 }} />
      {/* vertical bar spanning RQ slots and reaching rsSlotMidY */}
      <div style={{ ...s, top: barTop, left: x + stubW, width: 1, height: barBot - barTop + 1 }} />
      {/* horizontal stub rightward at exactly the RS slot center */}
      <div style={{ ...s, top: rsSlotMidY, left: x + stubW, width: stubW, height: 1 }} />
    </>
  );
}

// ─── Column headers ───────────────────────────────────────────────────────────

const RQ_HEADER  = "Regional Quarter";
const RS_HEADER  = "Regional Semis";
const RF_HEADER  = "Regional Finals";
const SS_HEADER  = "Sectional Semi";
const SF_HEADER  = "Sectional Final";
const SQ_HEADER  = "State Qualifier";

function ColHeader({ label }: { label: string }) {
  return (
    <div style={{
      width: COL_W,
      flexShrink: 0,
      textAlign: "center",
      fontSize: 9.5,
      fontWeight: 800,
      textTransform: "uppercase",
      letterSpacing: "0.09em",
      color: "#f8fafc",
      backgroundColor: "#0a1628",
      padding: "5px 6px",
      borderRadius: 4,
    }}>
      {label}
    </div>
  );
}

function ColHeaders({ hasRQ, totalW }: { hasRQ: boolean; totalW: number }) {
  const RQ_X  = 0;
  const RS_X  = hasRQ ? COL_W + COL_GAP : 0;
  const RF_X  = RS_X + COL_W + COL_GAP;
  const SS_X  = RF_X + COL_W + COL_GAP;
  const SF_X  = SS_X + COL_W + COL_GAP;
  const SQ_X  = SF_X + COL_W + COL_GAP;

  const cols: { label: string; x: number }[] = [
    ...(hasRQ ? [{ label: RQ_HEADER, x: RQ_X }] : []),
    { label: RS_HEADER, x: RS_X },
    { label: RF_HEADER, x: RF_X },
    { label: SS_HEADER, x: SS_X },
    { label: SF_HEADER, x: SF_X },
    { label: SQ_HEADER, x: SQ_X },
  ];

  return (
    <div style={{ position: "relative", width: totalW, marginBottom: 14, height: 26 }}>
      {cols.map(({ label, x }) => (
        <div key={label} style={{ position: "absolute", left: x, width: COL_W }}>
          <ColHeader label={label} />
        </div>
      ))}
    </div>
  );
}

// ─── Sub-region renderer ──────────────────────────────────────────────────────

type SubResult = {
  nodes: React.ReactNode[];
  height: number;
  rfWinnerMidYs: number[];
};

function renderSubRegion(
  subKey: string,
  teams: Team[],
  tmpl: RegionTemplate,
  yOffset: number,
  hasRQ: boolean,
): SubResult {
  const bySeed: Record<number, Team> = {};
  teams.forEach(t => { bySeed[t.Seed] = t; });

  const nodes: React.ReactNode[] = [];

  const RQ_X  = 0;
  const RS_X  = hasRQ ? COL_W + COL_GAP : 0;
  const RF_X  = RS_X + COL_W + COL_GAP;

  const RS_PAIR_H   = SLOT_H * 2 + SLOT_GAP;
  const RS_PAIR_GAP = 8;
  const numRS = tmpl.rs.length;

  const rsPairTops: number[] = [];
  let cursor = 0;
  for (let i = 0; i < numRS; i++) {
    rsPairTops.push(cursor);
    const [rsA, rsB] = tmpl.rs[i];
    // bothMulti: two stacked RQ pairs need extra height; all other rows use standard RS_PAIR_H
    const rowIsBothMulti = rsA.length > 1 && rsB.length > 1;
    cursor += rowIsBothMulti ? RS_PAIR_H + SLOT_GAP + RS_PAIR_H + RS_PAIR_GAP : RS_PAIR_H + RS_PAIR_GAP;
  }
  const subHeight = Math.max(cursor - RS_PAIR_GAP, SLOT_H);

  // ── RQ games ───────────────────────────────────────────────────────────────
  tmpl.rq.forEach(([seedsA, seedsB]) => {
    const s1 = seedsA[0];
    const s2 = seedsB[0];

    let rsMi = -1;
    let feedsIntoBot = false;

    for (let i = 0; i < tmpl.rs.length; i++) {
      const [sideA, sideB] = tmpl.rs[i];
      const rqInA = sideA.includes(s1) || sideA.includes(s2);
      const rqInB = sideB.includes(s1) || sideB.includes(s2);
      if (!rqInA && !rqInB) continue;

      rsMi = i;

      // Replicate the EXACT same top/bot slot-assignment logic used in RS rendering.
      const aIsSingle = sideA.length === 1;
      const bIsSingle = sideB.length === 1;
      let rqSideIsTop: boolean;

      if (aIsSingle && bIsSingle) {
        rqSideIsTop = rqInA ? (sideA[0] < sideB[0]) : (sideB[0] < sideA[0]);
      } else if (aIsSingle) {
        // sideA = bye/single, sideB = multi (RQ winner group)
        const byeIsTop = sideA[0] < Math.min(...sideB);
        rqSideIsTop = rqInA ? byeIsTop : !byeIsTop;
      } else if (bIsSingle) {
        // sideB = bye/single, sideA = multi (RQ winner group)
        const byeIsTop = sideB[0] < Math.min(...sideA);
        rqSideIsTop = rqInA ? !byeIsTop : byeIsTop;
      } else {
        // Both multi — lower-min group on top
        const aIsTop = Math.min(...sideA) < Math.min(...sideB);
        rqSideIsTop = rqInA ? aIsTop : !aIsTop;
      }

      feedsIntoBot = !rqSideIsTop;
      break;
    }
    if (rsMi === -1) return;

    const rsTop = rsPairTops[rsMi];

    // When both sides of an RS matchup are multi-seed, two RQ pairs feed into it.
    // They can't both sit at rsTop / rsTop+SLOT_H+SLOT_GAP — they'd overlap.
    // Instead, stack them: the top-slot feeder sits at rsTop, the bottom-slot feeder
    // sits at rsTop + RS_PAIR_H + SLOT_GAP (i.e. a full pair-height below).
    const rsSideA = tmpl.rs[rsMi]?.[0] ?? [];
    const rsSideB = tmpl.rs[rsMi]?.[1] ?? [];
    const bothRSsidesMulti = rsSideA.length > 1 && rsSideB.length > 1;
    const RS_PAIR_H = SLOT_H * 2 + SLOT_GAP;

    let rqTop: number;
    if (bothRSsidesMulti) {
      // Stack the two RQ pairs: top feeder at rsTop, bottom feeder at rsTop+RS_PAIR_H+SLOT_GAP
      rqTop = feedsIntoBot ? rsTop + RS_PAIR_H + SLOT_GAP : rsTop;
    } else {
      // Center RQ pair alongside RS pair — top slot aligns with RS top, bot with RS bot.
      // feedsIntoTop: rqTop=rsTop (top RQ slot connects to RS top slot)
      // feedsIntoBot: rqTop=rsTop (bot RQ slot = rsTop+SLOT_H+SLOT_GAP = RS bot slot)
      // Either way, rqTop = rsTop — no offset needed, no gap created.
      rqTop = rsTop;
    }

    const t1 = bySeed[s1];
    const t2 = bySeed[s2];
    const rqGame = findGameResult(t1, t2, RQ_DATE);

    nodes.push(
      <div key={`rq-${subKey}-${s1}-a`} style={{ position: "absolute", top: yOffset + rqTop, left: RQ_X }}>
        <TeamSlot team={t1} prob={t1?.RegionalQuarter} gameInfo={slotGameInfo(rqGame, true)} />
      </div>,
      <div key={`rq-${subKey}-${s1}-b`} style={{ position: "absolute", top: yOffset + rqTop + SLOT_H + SLOT_GAP, left: RQ_X }}>
        <TeamSlot team={t2} prob={t2?.RegionalQuarter} gameInfo={slotGameInfo(rqGame, false)} />
      </div>,
    );

    // rsSlotMidY: the vertical center of the RS slot this RQ winner feeds into.
    // For the stacked both-multi case, each pair's top slot midY aligns with its RS slot midY.
    // For normal case, rqTop aligns with the RS slot, so rsSlotMidY = rqTop + SLOT_H/2.
    const rsSlotMidY = bothRSsidesMulti
      ? (feedsIntoBot
          ? yOffset + rsTop + SLOT_H + SLOT_GAP + SLOT_H / 2  // RS bot slot mid
          : yOffset + rsTop + SLOT_H / 2)                      // RS top slot mid
      : feedsIntoBot
        ? yOffset + rsTop + SLOT_H + SLOT_GAP + SLOT_H / 2    // RS bot slot mid
        : yOffset + rsTop + SLOT_H / 2;                        // RS top slot mid

    nodes.push(
      <RQConn
        key={`rq-conn-${subKey}-${s1}`}
        x={RQ_X + COL_W}
        rqTopMidY={yOffset + rqTop + SLOT_H / 2}
        rqBotMidY={yOffset + rqTop + SLOT_H + SLOT_GAP + SLOT_H / 2}
        rsSlotMidY={rsSlotMidY}
      />
    );
  });

  // ── RS matchups ────────────────────────────────────────────────────────────
  const rsSlotMids: number[] = [];

  tmpl.rs.forEach(([sideA, sideB], mi) => {
    const pairTop = rsPairTops[mi];

    const aIsSingle = sideA.length === 1;
    const bIsSingle = sideB.length === 1;

    let topSeeds: number[], botSeeds: number[];
    let topIsBye: boolean, botIsBye: boolean;

    if (aIsSingle && bIsSingle) {
      topSeeds = sideA[0] < sideB[0] ? sideA : sideB;
      botSeeds = sideA[0] < sideB[0] ? sideB : sideA;
      topIsBye = false;
      botIsBye = false;
    } else if (aIsSingle) {
      const byeSeed   = sideA[0];
      const otherMin  = Math.min(...sideB);
      if (byeSeed < otherMin) {
        topSeeds = sideA; topIsBye = true;
        botSeeds = sideB; botIsBye = false;
      } else {
        topSeeds = sideB; topIsBye = false;
        botSeeds = sideA; botIsBye = true;
      }
    } else if (bIsSingle) {
      const byeSeed  = sideB[0];
      const otherMin = Math.min(...sideA);
      if (byeSeed < otherMin) {
        topSeeds = sideB; topIsBye = true;
        botSeeds = sideA; botIsBye = false;
      } else {
        topSeeds = sideA; topIsBye = false;
        botSeeds = sideB; botIsBye = true;
      }
    } else {
      topSeeds = Math.min(...sideA) < Math.min(...sideB) ? sideA : sideB;
      botSeeds = Math.min(...sideA) < Math.min(...sideB) ? sideB : sideA;
      topIsBye = false; botIsBye = false;
    }

    const topTeam = topSeeds.length === 1
      ? bySeed[topSeeds[0]]
      : projectedWinner(topSeeds, bySeed, "RegionalSemis");
    const botTeam = botSeeds.length === 1
      ? bySeed[botSeeds[0]]
      : projectedWinner(botSeeds, bySeed, "RegionalSemis");

    const topY = yOffset + pairTop;
    const botY = yOffset + pairTop + SLOT_H + SLOT_GAP;

    const rsGame = findGameResult(topTeam, botTeam, RS_DATE);
    nodes.push(
      <div key={`rs-${subKey}-${mi}-top`} style={{ position: "absolute", top: topY, left: RS_X }}>
        <TeamSlot team={topTeam} prob={topTeam?.RegionalSemis} gameInfo={slotGameInfo(rsGame, true)} isBye={topIsBye} />
      </div>,
      <div key={`rs-${subKey}-${mi}-bot`} style={{ position: "absolute", top: botY, left: RS_X }}>
        <TeamSlot team={botTeam} prob={botTeam?.RegionalSemis} gameInfo={slotGameInfo(rsGame, false)} isBye={botIsBye} />
      </div>,
    );

    const rsPairInternalMid = yOffset + pairTop + SLOT_H + SLOT_GAP / 2;
    nodes.push(
      <BracketConn
        key={`rs-conn-${subKey}-${mi}`}
        x={RS_X + COL_W}
        topY={topY + SLOT_H / 2}
        botY={botY + SLOT_H / 2}
        noStub
      />
    );
    nodes.push(
      <HStub
        key={`rs-stub-${subKey}-${mi}`}
        x={RS_X + COL_W + COL_GAP / 2}
        y={rsPairInternalMid}
      />
    );

    rsSlotMids.push(yOffset + pairTop + SLOT_H + SLOT_GAP / 2);
  });

  // ── RF matchups ────────────────────────────────────────────────────────────
  const rfWinnerMidYs: number[] = [];

  // FIX: prefix unused destructured vars with _ to satisfy eslint
  tmpl.rf.forEach(([_sideA, _sideB], ri) => {
    const rsMiA = ri * 2;
    const rsMiB = ri * 2 + 1;

    const rsTopA = rsPairTops[rsMiA] ?? 0;
    const rsTopB = rsPairTops[rsMiB] ?? rsPairTops[rsPairTops.length - 1];
    const rsMidA = rsTopA + SLOT_H + SLOT_GAP / 2;
    const rsMidB = rsTopB + SLOT_H + SLOT_GAP / 2;
    const rfSlotTopA = rsMidA - SLOT_H / 2;
    const rfSlotTopB = rsMidB - SLOT_H / 2;

    const allRsSeedsA = [...(tmpl.rs[rsMiA]?.[0] ?? []), ...(tmpl.rs[rsMiA]?.[1] ?? [])];
    const allRsSeedsB = [...(tmpl.rs[rsMiB]?.[0] ?? []), ...(tmpl.rs[rsMiB]?.[1] ?? [])];

    const teamA = projectedWinner(allRsSeedsA, bySeed, "RegionalFinals", RS_DATE);
    const teamB = projectedWinner(allRsSeedsB, bySeed, "RegionalFinals", RS_DATE);
    const rfGame = findGameResult(teamA, teamB, RF_DATE);

    nodes.push(
      <div key={`rf-${subKey}-${ri}-a`} style={{ position: "absolute", top: yOffset + rfSlotTopA, left: RF_X }}>
        <TeamSlot team={teamA} prob={teamA?.RegionalFinals} gameInfo={slotGameInfo(rfGame, true)} />
      </div>,
      <div key={`rf-${subKey}-${ri}-b`} style={{ position: "absolute", top: yOffset + rfSlotTopB, left: RF_X }}>
        <TeamSlot team={teamB} prob={teamB?.RegionalFinals} gameInfo={slotGameInfo(rfGame, false)} />
      </div>,
    );

    nodes.push(
      <BracketConn
        key={`rf-conn-${subKey}-${ri}`}
        x={RF_X + COL_W}
        topY={yOffset + rfSlotTopA + SLOT_H / 2}
        botY={yOffset + rfSlotTopB + SLOT_H / 2}
      />
    );

    rfWinnerMidYs.push(yOffset + (rfSlotTopA + rfSlotTopB) / 2 + SLOT_H / 2);
  });

  return { nodes, height: subHeight, rfWinnerMidYs };
}

// ─── Sectional renderer ───────────────────────────────────────────────────────

function SectionalBracket({
  sectName,
  subA, subB,
  teamsA, teamsB,
  tmplA, tmplB,
}: {
  sectName: string;
  subA: string; subB: string;
  teamsA: Team[]; teamsB: Team[];
  tmplA: RegionTemplate; tmplB: RegionTemplate;
}) {
  const hasRQ = tmplA.has_rq || tmplB.has_rq;

  const RF_X  = (hasRQ ? COL_W + COL_GAP : 0) + COL_W + COL_GAP;
  const SS_X  = RF_X + COL_W + COL_GAP;
  const SF_X  = SS_X + COL_W + COL_GAP;
  const SQ_X  = SF_X + COL_W + COL_GAP;
  const TOTAL_W = SQ_X + COL_W;

  const resultA = renderSubRegion(subA, teamsA, tmplA, 0, hasRQ);
  const subBTop = resultA.height + SUB_GAP;
  const resultB = renderSubRegion(subB, teamsB, tmplB, subBTop, hasRQ);

  const totalH = subBTop + resultB.height + 16;

  const allTeamsA = teamsA;
  const allTeamsB = teamsB;

  const ssNodes: React.ReactNode[] = [];

  function makeBySeed(teams: Team[]): Record<number, Team> {
    const m: Record<number, Team> = {};
    teams.forEach(t => { m[t.Seed] = t; });
    return m;
  }

  const bySeedA = makeBySeed(allTeamsA);
  const bySeedB = makeBySeed(allTeamsB);

  function rfWinner(tmpl: RegionTemplate, bySeed: Record<number,Team>, ri: number): Team | undefined {
    const rsMiA = ri * 2;
    const rsMiB = ri * 2 + 1;
    const allSeedsA = [...(tmpl.rs[rsMiA]?.[0] ?? []), ...(tmpl.rs[rsMiA]?.[1] ?? [])];
    const allSeedsB = [...(tmpl.rs[rsMiB]?.[0] ?? []), ...(tmpl.rs[rsMiB]?.[1] ?? [])];
    const tA = projectedWinner(allSeedsA, bySeed, "SectionalSemi", RF_DATE);
    const tB = projectedWinner(allSeedsB, bySeed, "SectionalSemi", RF_DATE);
    const rfGame = findGameResult(tA, tB, RF_DATE);
    if (rfGame?.isScore && rfGame.scoreA != null && rfGame.scoreB != null) {
      return rfGame.scoreA > rfGame.scoreB ? tA : tB;
    }
    if (!tA) return tB;
    if (!tB) return tA;
    return (tA.SectionalSemi >= tB.SectionalSemi) ? tA : tB;
  }

  const ssTeamsA = tmplA.rf.map((_, ri) => rfWinner(tmplA, bySeedA, ri));
  const ssMidYsA = resultA.rfWinnerMidYs;

  for (let i = 0; i < ssMidYsA.length; i += 2) {
    const teamTop = ssTeamsA[i];
    const teamBot = ssTeamsA[i + 1];
    const ssGame = findGameResult(teamTop, teamBot, SS_DATE);
    [teamTop, teamBot].forEach((team, j) => {
      const midY = ssMidYsA[i + j];
      if (midY == null) return;
      ssNodes.push(
        <div key={`ss-a-${i}-${j}`} style={{ position: "absolute", top: midY - SLOT_H / 2, left: SS_X }}>
          <TeamSlot team={team} prob={team?.SectionalSemi} gameInfo={slotGameInfo(ssGame, j === 0)} highlight />
        </div>
      );
    });
  }
  if (ssMidYsA.length >= 2) {
    ssNodes.push(
      <BracketConn key="ss-conn-a" x={SS_X + COL_W}
        topY={ssMidYsA[0]} botY={ssMidYsA[ssMidYsA.length - 1]} color="#f07d20" />
    );
  } else if (ssMidYsA.length === 1) {
    ssNodes.push(<HStub key="ss-stub-a" x={SS_X + COL_W} y={ssMidYsA[0]} color="#f07d20" />);
  }
  const sfMidA = ssMidYsA.length > 0
    ? (ssMidYsA[0] + ssMidYsA[ssMidYsA.length - 1]) / 2
    : resultA.rfWinnerMidYs[0] ?? 0;

  const ssTeamsB = tmplB.rf.map((_, ri) => rfWinner(tmplB, bySeedB, ri));
  const ssMidYsB = resultB.rfWinnerMidYs;

  for (let i = 0; i < ssMidYsB.length; i += 2) {
    const teamTop = ssTeamsB[i];
    const teamBot = ssTeamsB[i + 1];
    const ssGame = findGameResult(teamTop, teamBot, SS_DATE);
    [teamTop, teamBot].forEach((team, j) => {
      const midY = ssMidYsB[i + j];
      if (midY == null) return;
      ssNodes.push(
        <div key={`ss-b-${i}-${j}`} style={{ position: "absolute", top: midY - SLOT_H / 2, left: SS_X }}>
          <TeamSlot team={team} prob={team?.SectionalSemi} gameInfo={slotGameInfo(ssGame, j === 0)} highlight />
        </div>
      );
    });
  }
  if (ssMidYsB.length >= 2) {
    ssNodes.push(
      <BracketConn key="ss-conn-b" x={SS_X + COL_W}
        topY={ssMidYsB[0]} botY={ssMidYsB[ssMidYsB.length - 1]} color="#f07d20" />
    );
  } else if (ssMidYsB.length === 1) {
    ssNodes.push(<HStub key="ss-stub-b" x={SS_X + COL_W} y={ssMidYsB[0]} color="#f07d20" />);
  }
  const sfMidB = ssMidYsB.length > 0
    ? (ssMidYsB[0] + ssMidYsB[ssMidYsB.length - 1]) / 2
    : resultB.rfWinnerMidYs[0] ?? 0;

  function ssWinner(ssTeams: (Team|undefined)[], bySeed: Record<number,Team>, allTeams: Team[]): Team | undefined {
    if (ssTeams.length === 0) return allTeams.reduce<Team|undefined>((b,t) => !b||t.SectionalFinal>b.SectionalFinal?t:b, undefined);
    if (ssTeams.length === 1) return ssTeams[0];
    const tA = ssTeams[0]; const tB = ssTeams[1];
    const game = findGameResult(tA, tB, SS_DATE);
    if (game?.isScore && game.scoreA != null && game.scoreB != null) {
      return game.scoreA > game.scoreB ? tA : tB;
    }
    if (!tA) return tB; if (!tB) return tA;
    return tA.SectionalFinal >= tB.SectionalFinal ? tA : tB;
  }
  const sfWinnerA = ssWinner(ssTeamsA, bySeedA, allTeamsA);
  const sfWinnerB = ssWinner(ssTeamsB, bySeedB, allTeamsB);
  const sfGame = findGameResult(sfWinnerA, sfWinnerB, SS_DATE);
  ssNodes.push(
    <div key="sf-a" style={{ position: "absolute", top: sfMidA - SLOT_H / 2, left: SF_X }}>
      <TeamSlot team={sfWinnerA} prob={sfWinnerA?.SectionalFinal} gameInfo={slotGameInfo(sfGame, true)} highlight />
    </div>,
    <div key="sf-b" style={{ position: "absolute", top: sfMidB - SLOT_H / 2, left: SF_X }}>
      <TeamSlot team={sfWinnerB} prob={sfWinnerB?.SectionalFinal} gameInfo={slotGameInfo(sfGame, false)} highlight />
    </div>,
  );
  ssNodes.push(
    <BracketConn key="sf-conn" x={SF_X + COL_W}
      topY={sfMidA} botY={sfMidB} color="#f07d20" />
  );

  const sqMidY = (sfMidA + sfMidB) / 2;
  const sqWinner = [sfWinnerA, sfWinnerB].filter(Boolean).reduce<Team | undefined>((b,t) =>
    !b || (t!.StateQualifier > b.StateQualifier) ? t : b, undefined) ??
    [...allTeamsA, ...allTeamsB].reduce<Team | undefined>((b,t) =>
    !b || t.StateQualifier > b.StateQualifier ? t : b, undefined);
  ssNodes.push(
    <div key="sq" style={{ position: "absolute", top: sqMidY - SLOT_H / 2, left: SQ_X }}>
      <TeamSlot team={sqWinner} prob={sqWinner?.StateQualifier} highlight />
    </div>
  );

  return (
    <div style={{ marginBottom: 32, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
      <div style={{
        background: "linear-gradient(90deg, #0a1628 0%, #1e3a5f 100%)",
        color: "#ffffff",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "#f07d20",
        }}>Sectional</span>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.01em" }}>{sectName}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 500,
        }}>
          {subA} &amp; {subB}
        </span>
      </div>

      <div style={{ padding: "16px 20px 24px", overflowX: "auto", backgroundColor: "#f8fafc" }}>
        <ColHeaders hasRQ={hasRQ} totalW={TOTAL_W} />
        <div style={{ position: "relative", height: totalH, width: TOTAL_W, minWidth: TOTAL_W }}>
          {resultA.nodes}
          {resultB.nodes}
          {ssNodes}
        </div>
      </div>
    </div>
  );
}

// ─── D1 sectional bracket ─────────────────────────────────────────────────────

function D1SectionalBracket({
  sectName,
  teams,
  tmpl,
}: {
  sectName: string;
  teams: Team[];
  tmpl: RegionTemplate;
}) {
  const hasRQ  = tmpl.has_rq;

  const RS_X   = hasRQ ? COL_W + COL_GAP : 0;
  const RF_X   = RS_X + COL_W + COL_GAP;
  const SS_X   = RF_X + COL_W + COL_GAP;
  const SF_X   = SS_X + COL_W + COL_GAP;
  const SQ_X   = SF_X + COL_W + COL_GAP;
  const TOTAL_W = SQ_X + COL_W;

  const { nodes, height, rfWinnerMidYs } = renderSubRegion(
    sectName, teams, tmpl, 0, hasRQ
  );

  const totalH = height + 16;

  const bySeed: Record<number, Team> = {};
  teams.forEach(t => { bySeed[t.Seed] = t; });

  function rfWinnerD1(ri: number): Team | undefined {
    const rsMiA = ri * 2;
    const rsMiB = ri * 2 + 1;
    const allSeedsA = [...(tmpl.rs[rsMiA]?.[0] ?? []), ...(tmpl.rs[rsMiA]?.[1] ?? [])];
    const allSeedsB = [...(tmpl.rs[rsMiB]?.[0] ?? []), ...(tmpl.rs[rsMiB]?.[1] ?? [])];
    const tA = projectedWinner(allSeedsA, bySeed, "SectionalSemi", RF_DATE);
    const tB = projectedWinner(allSeedsB, bySeed, "SectionalSemi", RF_DATE);
    const rfGame = findGameResult(tA, tB, RF_DATE);
    if (rfGame?.isScore && rfGame.scoreA != null && rfGame.scoreB != null) {
      return rfGame.scoreA > rfGame.scoreB ? tA : tB;
    }
    if (!tA) return tB; if (!tB) return tA;
    return tA.SectionalSemi >= tB.SectionalSemi ? tA : tB;
  }

  const ssTeams = tmpl.rf.map((_, ri) => rfWinnerD1(ri));

  const ssGame0 = findGameResult(ssTeams[0], ssTeams[1], SS_DATE);
  const ssGame1 = findGameResult(ssTeams[2], ssTeams[3], SS_DATE);

  function pickWinner(tA: Team|undefined, tB: Team|undefined, game: ReturnType<typeof findGameResult>, probKey: keyof Team): Team|undefined {
    if (game?.isScore && game.scoreA != null && game.scoreB != null) {
      return game.scoreA > game.scoreB ? tA : tB;
    }
    if (!tA) return tB; if (!tB) return tA;
    return (tA[probKey] as number) >= (tB[probKey] as number) ? tA : tB;
  }

  const sfWinnerTop = pickWinner(ssTeams[0], ssTeams[1], ssGame0, "SectionalFinal");
  const sfWinnerBot = pickWinner(ssTeams[2], ssTeams[3], ssGame1, "SectionalFinal");
  const sfGame = findGameResult(sfWinnerTop, sfWinnerBot, SS_DATE);
  const sqWinner = pickWinner(sfWinnerTop, sfWinnerBot, sfGame, "StateQualifier");

  const ssMid0 = rfWinnerMidYs[0] ?? 0;
  const ssMid1 = rfWinnerMidYs[1] ?? ssMid0;
  const ssMid2 = rfWinnerMidYs[2] ?? 0;
  const ssMid3 = rfWinnerMidYs[3] ?? ssMid2;
  const sfMidTop = (ssMid0 + ssMid1) / 2;
  const sfMidBot = (ssMid2 + ssMid3) / 2;
  const sqMidY   = (sfMidTop + sfMidBot) / 2;

  const ORANGE = "#f07d20";

  const postNodes: React.ReactNode[] = [
    <div key="ss-0" style={{ position: "absolute", top: ssMid0 - SLOT_H/2, left: SS_X }}>
      <TeamSlot team={ssTeams[0]} prob={ssTeams[0]?.SectionalSemi} gameInfo={slotGameInfo(ssGame0, true)} highlight />
    </div>,
    <div key="ss-1" style={{ position: "absolute", top: ssMid1 - SLOT_H/2, left: SS_X }}>
      <TeamSlot team={ssTeams[1]} prob={ssTeams[1]?.SectionalSemi} gameInfo={slotGameInfo(ssGame0, false)} highlight />
    </div>,
    <BracketConn key="ss-conn-top" x={SS_X + COL_W} topY={ssMid0} botY={ssMid1} color={ORANGE} />,
    <div key="ss-2" style={{ position: "absolute", top: ssMid2 - SLOT_H/2, left: SS_X }}>
      <TeamSlot team={ssTeams[2]} prob={ssTeams[2]?.SectionalSemi} gameInfo={slotGameInfo(ssGame1, true)} highlight />
    </div>,
    <div key="ss-3" style={{ position: "absolute", top: ssMid3 - SLOT_H/2, left: SS_X }}>
      <TeamSlot team={ssTeams[3]} prob={ssTeams[3]?.SectionalSemi} gameInfo={slotGameInfo(ssGame1, false)} highlight />
    </div>,
    <BracketConn key="ss-conn-bot" x={SS_X + COL_W} topY={ssMid2} botY={ssMid3} color={ORANGE} />,
    <div key="sf-top" style={{ position: "absolute", top: sfMidTop - SLOT_H/2, left: SF_X }}>
      <TeamSlot team={sfWinnerTop} prob={sfWinnerTop?.SectionalFinal} gameInfo={slotGameInfo(sfGame, true)} highlight />
    </div>,
    <div key="sf-bot" style={{ position: "absolute", top: sfMidBot - SLOT_H/2, left: SF_X }}>
      <TeamSlot team={sfWinnerBot} prob={sfWinnerBot?.SectionalFinal} gameInfo={slotGameInfo(sfGame, false)} highlight />
    </div>,
    <BracketConn key="sf-conn" x={SF_X + COL_W} topY={sfMidTop} botY={sfMidBot} color={ORANGE} />,
    <div key="sq" style={{ position: "absolute", top: sqMidY - SLOT_H/2, left: SQ_X }}>
      <TeamSlot team={sqWinner} prob={sqWinner?.StateQualifier} highlight />
    </div>,
  ];

  const colLabels = [
    ...(hasRQ ? [{ label: RQ_HEADER, x: 0 }] : []),
    { label: RS_HEADER, x: RS_X },
    { label: RF_HEADER, x: RF_X },
    { label: SS_HEADER, x: SS_X },
    { label: SF_HEADER, x: SF_X },
    { label: SQ_HEADER, x: SQ_X },
  ];

  return (
    <div style={{ marginBottom: 32, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
      <div style={{ background: "linear-gradient(90deg, #0a1628 0%, #1e3a5f 100%)", color: "#fff", padding: "10px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#f07d20" }}>Sectional</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{sectName}</span>
      </div>
      <div style={{ padding: "16px 20px 24px", overflowX: "auto", backgroundColor: "#f8fafc" }}>
        <div style={{ position: "relative", width: TOTAL_W, minWidth: TOTAL_W, height: 26, marginBottom: 14 }}>
          {colLabels.map(({ label, x }) => (
            <div key={label} style={{
              position: "absolute", left: x, top: 0,
              width: COL_W, textAlign: "center",
              fontSize: 9.5, fontWeight: 800, textTransform: "uppercase",
              letterSpacing: "0.09em", color: "#f8fafc",
              backgroundColor: "#0a1628", padding: "5px 6px",
              borderRadius: 4, boxSizing: "border-box",
            }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ position: "relative", height: totalH, width: TOTAL_W, minWidth: TOTAL_W }}>
          {nodes}
          {postNodes}
        </div>
      </div>
    </div>
  );
}

// ─── State bracket ────────────────────────────────────────────────────────────

function StateBracket({ qualifiers }: { qualifiers: Team[] }) {
  if (qualifiers.length < 2) return null;

  const sorted = [...qualifiers].sort((a, b) => a.BBMISeed - b.BBMISeed).slice(0, 4);
  const sq = [sorted[0], sorted[3], sorted[1], sorted[2]].filter(Boolean) as Team[];

  const SQ_X    = 0;
  const SF_X    = COL_W + COL_GAP;
  const CH_X    = SF_X + COL_W + COL_GAP;
  const TOTAL_W = CH_X + COL_W;
  const PAIR_H  = SLOT_H * 2 + SLOT_GAP;
  const PAIR_GAP = 32;

  const HEADER_H = 26;
  const sqTop1 = 0;
  const sqTop2 = PAIR_H + PAIR_GAP;
  const totalH = sqTop2 + PAIR_H + 16;

  const sf1 = [sq[0], sq[1]].filter(Boolean).reduce<Team | undefined>(
    (b, t) => !b || t!.StateFinalist > b.StateFinalist ? t : b, undefined
  );
  const sf2 = [sq[2], sq[3]].filter(Boolean).reduce<Team | undefined>(
    (b, t) => !b || t!.StateFinalist > b.StateFinalist ? t : b, undefined
  );
  const champion = [sf1, sf2].filter(Boolean).reduce<Team | undefined>(
    (b, t) => !b || t!.StateChampion > b.StateChampion ? t : b, undefined
  );

  const sf1MidY  = sqTop1 + SLOT_H + SLOT_GAP / 2;
  const sf2MidY  = sqTop2 + SLOT_H + SLOT_GAP / 2;
  const champTop = (sf1MidY + sf2MidY) / 2 - SLOT_H / 2;
  const ORANGE   = "#f07d20";

  return (
    <div style={{
      marginBottom: 32,
      border: "1px solid #fed7aa",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        background: "linear-gradient(90deg, #7c2d12 0%, #c2410c 100%)",
        color: "#ffffff",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>🏆 State Bracket</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#fed7aa", fontWeight: 500 }}>
          State Qualifier → Finalist → Champion
        </span>
      </div>

      <div style={{ padding: "16px 20px 24px", overflowX: "auto", backgroundColor: "#fff7ed" }}>
        <div style={{ position: "relative", width: TOTAL_W, minWidth: TOTAL_W, height: HEADER_H, marginBottom: 14 }}>
          {([
            { label: "State Qualifier", x: SQ_X },
            { label: "State Finalist",  x: SF_X },
            { label: "State Champion",  x: CH_X },
          ] as { label: string; x: number }[]).map(({ label, x }) => (
            <div key={label} style={{
              position: "absolute", left: x, top: 0,
              width: COL_W, textAlign: "center",
              fontSize: 9.5, fontWeight: 800, textTransform: "uppercase",
              letterSpacing: "0.09em", color: "#fff7ed",
              backgroundColor: "#7c2d12", padding: "5px 6px", borderRadius: 4,
              boxSizing: "border-box",
            }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ position: "relative", height: totalH, width: TOTAL_W, minWidth: TOTAL_W }}>
          <div style={{ position: "absolute", top: sqTop1, left: SQ_X }}>
            <TeamSlot team={sq[0]} prob={sq[0]?.StateQualifier} highlight overrideSeed={1} />
          </div>
          <div style={{ position: "absolute", top: sqTop1 + SLOT_H + SLOT_GAP, left: SQ_X }}>
            <TeamSlot team={sq[1]} prob={sq[1]?.StateQualifier} highlight overrideSeed={4} />
          </div>
          <BracketConn x={SQ_X + COL_W} topY={sqTop1 + SLOT_H / 2} botY={sqTop1 + SLOT_H + SLOT_GAP + SLOT_H / 2} color={ORANGE} />

          <div style={{ position: "absolute", top: sqTop2, left: SQ_X }}>
            <TeamSlot team={sq[2]} prob={sq[2]?.StateQualifier} highlight overrideSeed={2} />
          </div>
          <div style={{ position: "absolute", top: sqTop2 + SLOT_H + SLOT_GAP, left: SQ_X }}>
            <TeamSlot team={sq[3]} prob={sq[3]?.StateQualifier} highlight overrideSeed={3} />
          </div>
          <BracketConn x={SQ_X + COL_W} topY={sqTop2 + SLOT_H / 2} botY={sqTop2 + SLOT_H + SLOT_GAP + SLOT_H / 2} color={ORANGE} />

          <div style={{ position: "absolute", top: sf1MidY - SLOT_H / 2, left: SF_X }}>
            <TeamSlot team={sf1} prob={sf1?.StateFinalist} highlight />
          </div>
          <div style={{ position: "absolute", top: sf2MidY - SLOT_H / 2, left: SF_X }}>
            <TeamSlot team={sf2} prob={sf2?.StateFinalist} highlight />
          </div>
          <BracketConn x={SF_X + COL_W} topY={sf1MidY} botY={sf2MidY} color={ORANGE} />

          <div style={{ position: "absolute", top: champTop, left: CH_X }}>
            <TeamSlot team={champion} prob={champion?.StateChampion} highlight />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function WIAABracketPulseTable({ division }: WIAABracketPulseTableProps) {
  const rawData = useMemo(() => {
    let data: Team[];
    switch (division) {
      case "1": data = d1Data as unknown as Team[]; break;
      case "2": data = d2Data as unknown as Team[]; break;
      case "3": data = d3Data as unknown as Team[]; break;
      case "4": data = d4Data as unknown as Team[]; break;
      case "5": data = d5Data as unknown as Team[]; break;
      default:  return [] as Team[];
    }
    // Patch in the correct slug from rankings (overrides whatever slug is in the bracket JSON)
    return data.map(t => ({ ...t, slug: _slugByName[t.Team] ?? t.slug }));
  }, [division]);

  const divTemplates = useMemo(
    () => ((bracketTemplate as unknown) as Record<string, Record<string, RegionTemplate>>)[division] ?? {},
    [division]
  );

  const bySectional = useMemo(() => {
    const map: Record<string, Record<string, Team[]>> = {};
    rawData.forEach(t => {
      if (!map[t.Sectional]) map[t.Sectional] = {};
      if (!map[t.Sectional][t.SubRegion]) map[t.Sectional][t.SubRegion] = [];
      map[t.Sectional][t.SubRegion].push(t);
    });
    Object.values(map).forEach(subs =>
      Object.values(subs).forEach(arr => arr.sort((a, b) => a.Seed - b.Seed))
    );
    return map;
  }, [rawData]);

  const sectionals = useMemo(() => Object.keys(bySectional).sort(), [bySectional]);

  // FIX: stateQualifiers useMemo must come BEFORE the early return
  const stateQualifiers = useMemo(() => {
    return sectionals.map(sectName => {
      const allTeams = Object.values(bySectional[sectName]).flat();
      return allTeams.reduce<Team | undefined>(
        (b, t) => !b || t.StateQualifier > b.StateQualifier ? t : b, undefined
      );
    }).filter((t): t is Team => t !== undefined);
  }, [sectionals, bySectional]);

  if (!sectionals.length) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
        No bracket data available for Division {division}.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <StateBracket qualifiers={stateQualifiers} />
      {sectionals.map(sectName => {
        const subMap    = bySectional[sectName];
        const subKeys   = Object.keys(subMap).sort();

        if (subKeys.length < 2) {
          const allTeams  = Object.values(subMap).flat();
          const regionKey = allTeams[0]?.Region ?? sectName;
          const tmpl      = divTemplates[regionKey];
          if (!tmpl) return null;
          return <D1SectionalBracket key={sectName} sectName={sectName} teams={allTeams} tmpl={tmpl} />;
        }

        const [subA, subB] = subKeys;

        const regionKeyA = subMap[subA]?.[0]?.Region ?? subA;
        const regionKeyB = subMap[subB]?.[0]?.Region ?? subB;

        const tmplA = divTemplates[regionKeyA];
        const tmplB = divTemplates[regionKeyB];
        if (!tmplA || !tmplB) return null;

        return (
          <SectionalBracket
            key={sectName}
            sectName={sectName}
            subA={regionKeyA} subB={regionKeyB}
            teamsA={subMap[subA]} teamsB={subMap[subB]}
            tmplA={tmplA} tmplB={tmplB}
          />
        );
      })}
    </div>
  );
}
