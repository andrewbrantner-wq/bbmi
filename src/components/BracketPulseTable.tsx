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

function getProjectedWinner(teams: (Team | undefined)[], probKey: keyof Team): Team | undefined {
  const valid = teams.filter(Boolean) as Team[];
  if (valid.length === 0) return undefined;
  return valid.reduce((best, current) => {
    const bestProb = typeof best[probKey] === "number" ? (best[probKey] as number) : 0;
    const currentProb = typeof current[probKey] === "number" ? (current[probKey] as number) : 0;
    return currentProb > bestProb ? current : best;
  });
}

const CARD_STYLE: React.CSSProperties = {
  border: "1px solid #e7e5e4",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  marginBottom: 40,
};

const CARD_HEADER: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  textAlign: "center",
  padding: "12px 16px",
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "0.02em",
};

const COL_HEADER_ROW: React.CSSProperties = {
  display: "flex",
  backgroundColor: "#1e3a5f",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

const TEAM_HEIGHT = 24;
const TEAM_WIDTH = 185;
const CONNECTOR_WIDTH = 20;

const MATCHUPS = [
  [1, 16], [8, 9],
  [5, 12], [4, 13],
  [6, 11], [3, 14],
  [7, 10], [2, 15],
] as [number, number][];

function TeamSlot({
  team,
  seed,
  prob,
  showProb = true,
  style = {},
}: {
  team: Team | undefined;
  seed?: number;
  prob?: number;
  showProb?: boolean;
  style?: React.CSSProperties;
}) {
  if (!team) {
    return (
      <div style={{
        height: TEAM_HEIGHT, width: TEAM_WIDTH,
        border: "1px solid #d6d3d1", background: "#fafaf9",
        display: "flex", alignItems: "center", paddingLeft: 4,
        fontSize: 12, color: "#a8a29e", ...style,
      }}>
        {seed !== undefined && <strong style={{ marginRight: 3 }}>{seed}</strong>}
        <span style={{ fontStyle: "italic" }}>TBD</span>
      </div>
    );
  }

  return (
    <div style={{
      height: TEAM_HEIGHT, width: TEAM_WIDTH,
      border: "1px solid #d6d3d1", background: "white",
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 4, paddingRight: 6, fontSize: 12, ...style,
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
      {showProb && prob !== undefined && prob > 0 && (
        <span style={{ color: "#78716c", fontSize: 11, marginLeft: 4, flexShrink: 0 }}>
          {fmtPct(prob)}
        </span>
      )}
    </div>
  );
}

function renderRegion(regionName: string, regionTeams: Team[]) {
  // For play-in seeds, pick the projected winner (highest sweet16 prob)
  const getTeam = (seed: number): Team | undefined => {
    const candidates = regionTeams.filter((t) => t.seed === seed);
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0];
    return getProjectedWinner(candidates, "sweet16");
  };

  // Round of 64 → Round of 32: advance whoever has higher sweet16 prob
  const r32Winners = MATCHUPS.map(([s1, s2]) =>
    getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16")
  );

  // Round of 32 → Sweet 16: advance whoever has higher elite8 prob
  const s16Winners = [
    getProjectedWinner([r32Winners[0], r32Winners[1]], "elite8"),
    getProjectedWinner([r32Winners[2], r32Winners[3]], "elite8"),
    getProjectedWinner([r32Winners[4], r32Winners[5]], "elite8"),
    getProjectedWinner([r32Winners[6], r32Winners[7]], "elite8"),
  ];

  // Sweet 16 → Elite 8: advance whoever has higher final4 prob
  const e8Winners = [
    getProjectedWinner([s16Winners[0], s16Winners[1]], "final4"),
    getProjectedWinner([s16Winners[2], s16Winners[3]], "final4"),
  ];

  // Elite 8 → Final Four: advance whoever has higher championship prob
  const regionWinner = getProjectedWinner(e8Winners, "championship");

  // Vertical positions
  const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
  const r32Positions = MATCHUPS.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
  const s16Positions = [0, 1, 2, 3].map((i) => (r32Positions[i * 2] + r32Positions[i * 2 + 1]) / 2);
  const e8Positions  = [0, 1].map((i) => (s16Positions[i * 2] + s16Positions[i * 2 + 1]) / 2);
  const f4Position   = (e8Positions[0] + e8Positions[1]) / 2;
  const totalHeight  = 16 * TEAM_HEIGHT;

  const roundLabels = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four"];

  return (
    <div key={regionName} style={CARD_STYLE}>
      <div style={CARD_HEADER}>{regionName} Region</div>
      <div style={COL_HEADER_ROW}>
        {roundLabels.map((label, i) => (
          <div key={label} style={{
            width: i === 4 ? TEAM_WIDTH : TEAM_WIDTH + CONNECTOR_WIDTH,
            textAlign: "center",
            padding: "7px 0",
            borderRight: i < 4 ? "1px solid rgba(255,255,255,0.08)" : undefined,
          }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ background: "white", padding: 20, overflowX: "auto" }}>
        <div style={{ position: "relative", height: totalHeight, minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4 }}>

          {/* Round of 64 */}
          {MATCHUPS.flatMap(([s1, s2], mi) => [
            <div key={`r64-${mi}-a`} style={{ position: "absolute", top: r64Positions[mi * 2], left: 0 }}>
              <TeamSlot team={getTeam(s1)} seed={s1} showProb={false} />
            </div>,
            <div key={`r64-${mi}-b`} style={{ position: "absolute", top: r64Positions[mi * 2 + 1], left: 0 }}>
              <TeamSlot team={getTeam(s2)} seed={s2} showProb={false} />
            </div>,
          ])}

          {/* Connectors R64 → R32 */}
          {MATCHUPS.map((_, i) => (
            <div key={`conn-r64-${i}`} style={{
              position: "absolute", left: TEAM_WIDTH, top: r32Positions[i],
              width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e",
            }} />
          ))}

          {/* Round of 32 — show roundOf32 probability */}
          {r32Winners.map((winner, i) => (
            <div key={`r32-${i}`} style={{ position: "absolute", top: r32Positions[i] - TEAM_HEIGHT / 2, left: TEAM_WIDTH + CONNECTOR_WIDTH }}>
              <TeamSlot team={winner} prob={winner?.roundOf32} />
            </div>
          ))}

          {/* Connectors R32 → S16 */}
          {[0, 1, 2, 3].map((i) => (
            <div key={`conn-r32-${i}`} style={{
              position: "absolute", left: TEAM_WIDTH * 2 + CONNECTOR_WIDTH, top: s16Positions[i],
              width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e",
            }} />
          ))}

          {/* Sweet 16 — show sweet16 probability */}
          {s16Winners.map((winner, i) => (
            <div key={`s16-${i}`} style={{ position: "absolute", top: s16Positions[i] - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2 }}>
              <TeamSlot team={winner} prob={winner?.sweet16} />
            </div>
          ))}

          {/* Connectors S16 → E8 */}
          {[0, 1].map((i) => (
            <div key={`conn-s16-${i}`} style={{
              position: "absolute", left: TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2, top: e8Positions[i],
              width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e",
            }} />
          ))}

          {/* Elite 8 — show elite8 probability */}
          {e8Winners.map((winner, i) => (
            <div key={`e8-${i}`} style={{ position: "absolute", top: e8Positions[i] - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3 }}>
              <TeamSlot team={winner} prob={winner?.elite8} />
            </div>
          ))}

          {/* Connector E8 → F4 */}
          <div style={{
            position: "absolute", left: TEAM_WIDTH * 4 + CONNECTOR_WIDTH * 3, top: f4Position,
            width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e",
          }} />

          {/* Final Four — show final4 probability */}
          <div style={{ position: "absolute", top: f4Position - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4 }}>
            <TeamSlot team={regionWinner} prob={regionWinner?.final4} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default function TournamentBracket() {
  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return (seedingData as any[]).map((r) => ({
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

  // Include ALL teams (including play-in) in regions
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

  // Final Four: get region winner from each region
  const final4Teams = useMemo(() => {
    return Object.keys(regions).sort().map((regionName) => {
      const regionTeams = regions[regionName];

      const getTeam = (seed: number): Team | undefined => {
        const candidates = regionTeams.filter((t) => t.seed === seed);
        if (candidates.length === 0) return undefined;
        if (candidates.length === 1) return candidates[0];
        return getProjectedWinner(candidates, "sweet16");
      };

      const r32Winners = MATCHUPS.map(([s1, s2]) =>
        getProjectedWinner([getTeam(s1), getTeam(s2)], "sweet16")
      );
      const s16Winners = [
        getProjectedWinner([r32Winners[0], r32Winners[1]], "elite8"),
        getProjectedWinner([r32Winners[2], r32Winners[3]], "elite8"),
        getProjectedWinner([r32Winners[4], r32Winners[5]], "elite8"),
        getProjectedWinner([r32Winners[6], r32Winners[7]], "elite8"),
      ];
      const e8Winners = [
        getProjectedWinner([s16Winners[0], s16Winners[1]], "final4"),
        getProjectedWinner([s16Winners[2], s16Winners[3]], "final4"),
      ];
      const winner = getProjectedWinner(e8Winners, "championship");
      return { region: regionName, winner };
    });
  }, [regions]);

  // Champion: team with highest winTitle across all teams
  const allTeams = useMemo(() => Object.values(regions).flat(), [regions]);
  const champion = useMemo(() =>
    allTeams.length > 0
      ? allTeams.reduce((best, cur) => (cur.winTitle > best.winTitle ? cur : best))
      : null,
    [allTeams]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>

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
      </div>

      {/* Region brackets */}
      {Object.keys(regions).sort().map((regionName) =>
        renderRegion(regionName, regions[regionName])
      )}

      {/* Final Four & Championship */}
      <div style={{ ...CARD_STYLE, marginBottom: 0 }}>
        <div style={CARD_HEADER}>Final Four &amp; Championship</div>
        <div style={{ backgroundColor: "#ffffff", padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, flexWrap: "wrap" }}>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {final4Teams.slice(0, 2).map(({ region, winner }) => (
                <div key={region} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    {region}
                  </div>
                  <TeamSlot team={winner} prob={winner?.final4} style={{ width: 200 }} />
                </div>
              ))}
            </div>

            {champion && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                  Champion
                </div>
                <div style={{
                  height: 36, width: 240,
                  border: "2px solid #0a1a2f", background: "#fffbeb",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  paddingLeft: 8, paddingRight: 12, fontSize: 15, fontWeight: 600, borderRadius: 6,
                }}>
                  <Link
                    href={`/ncaa-team/${encodeURIComponent(champion.name)}`}
                    style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 6, flex: 1 }}
                  >
                    <NCAALogo teamName={champion.name} size={20} />
                    <div><strong style={{ marginRight: 4 }}>{champion.seed}</strong>{champion.name}</div>
                  </Link>
                  <span style={{ color: "#b45309", fontWeight: 700 }}>{fmtPct(champion.winTitle)}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {final4Teams.slice(2, 4).map(({ region, winner }) => (
                <div key={region} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    {region}
                  </div>
                  <TeamSlot team={winner} prob={winner?.final4} style={{ width: 200 }} />
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
