"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";

import d1Data from "@/data/wiaa-seeding/wiaa-d1-bracket.json";
import d2Data from "@/data/wiaa-seeding/wiaa-d2-bracket.json";
import d3Data from "@/data/wiaa-seeding/wiaa-d3-bracket.json";
import d4Data from "@/data/wiaa-seeding/wiaa-d4-bracket.json";
import d5Data from "@/data/wiaa-seeding/wiaa-d5-bracket.json";

type Team = {
  Team: string;
  Division: string;
  Region: string;
  WIAASeed: number;
  BBMISeed: number;
  Seed: number;
  slug: string;
  RegionalSemis: number;
  RegionalChampion: number;
  SectionalSemiFinalist: number;
  SectionalFinalist: number;
  StateQualifier: number;
  StateFinalist: number;
  StateChampion: number;
};

function fmtPct(v: number | undefined) {
  if (v == null || v === 0) return "";
  if (v > 0 && v < 0.001) return "<0.1%";
  return `${(v * 100).toFixed(1)}%`;
}

// Shared card styles — matches NCAA bracket component
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

type WIAABracketPulseTableProps = {
  division: string;
};

export default function WIAABracketPulseTable({ division }: WIAABracketPulseTableProps) {
  const seedingData = useMemo(() => {
    switch (division) {
      case "1": return d1Data;
      case "2": return d2Data;
      case "3": return d3Data;
      case "4": return d4Data;
      case "5": return d5Data;
      default: return [];
    }
  }, [division]);

  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return seedingData as Team[];
  }, [seedingData]);

  const divisionTeams = useMemo(() => teams.filter((t) => t.Division === division), [teams, division]);

  const regions = useMemo(() => {
    const regionMap: { [key: string]: Team[] } = {};
    divisionTeams.forEach((team) => {
      if (!regionMap[team.Region]) regionMap[team.Region] = [];
      regionMap[team.Region].push(team);
    });
    Object.keys(regionMap).forEach((region) => {
      regionMap[region].sort((a, b) => a.Seed - b.Seed);
    });
    return regionMap;
  }, [divisionTeams]);

  const getProjectedWinner = (teams: Team[], probKey: keyof Team): Team | undefined => {
    if (teams.length === 0) return undefined;
    return teams.reduce((best, current) => {
      const bestProb = typeof best[probKey] === "number" ? (best[probKey] as number) : 0;
      const currentProb = typeof current[probKey] === "number" ? (current[probKey] as number) : 0;
      return currentProb > bestProb ? current : best;
    });
  };

  const TEAM_HEIGHT = 24;
  const TEAM_WIDTH = 180;
  const CONNECTOR_WIDTH = 20;

  const TeamSlot = ({ team, seed, prob, showProb = true, style = {} }: {
    team: Team | undefined; seed?: number; prob?: number; showProb?: boolean; style?: React.CSSProperties;
  }) => {
    if (!team) {
      return (
        <div style={{ height: TEAM_HEIGHT, width: TEAM_WIDTH, border: "1px solid #d6d3d1", background: "#fafaf9", display: "flex", alignItems: "center", paddingLeft: 4, fontSize: 13, color: "#a8a29e", ...style }}>
          {seed !== undefined && <strong style={{ marginRight: 2 }}>{seed}</strong>}
          <span style={{ fontStyle: "italic" }}>TBD</span>
        </div>
      );
    }
    return (
      <div style={{ height: TEAM_HEIGHT, width: TEAM_WIDTH, border: "1px solid #d6d3d1", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, paddingRight: 8, fontSize: 13, ...style }}>
        <Link href={`/wiaa-team/${encodeURIComponent(team.Team)}`} className="hover:underline"
          style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden", minWidth: 0 }}>
          <TeamLogo slug={team.slug} size={16} />
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            <strong style={{ marginRight: 2 }}>{team.Seed}</strong>{team.Team}
          </div>
        </Link>
        {showProb && prob !== undefined && prob > 0 && (
          <span style={{ color: "#78716c", fontSize: 12, flexShrink: 0 }}>{fmtPct(prob)}</span>
        )}
      </div>
    );
  };

  const colLabels = ["Regional Semis", "Regional Finals", "Sectional Semi", "Sectional Final", "State Qualifier"];

  // ------------------------------------------------------------
  // DIVISION 1 — 16-team NCAA-style bracket
  // ------------------------------------------------------------
  if (division === "1") {
    const matchupsD1 = [[1,16],[8,9],[5,12],[4,13],[6,11],[3,14],[7,10],[2,15]];

    const renderD1Region = (regionName: string, regionNum: string) => {
      const regionTeams = regions[regionNum] || [];
      const getTeamBySeed = (seed: number) => regionTeams.find((t) => t.Seed === seed);

      const r1Winners = matchupsD1.map(([s1, s2]) => {
        const t1 = getTeamBySeed(s1), t2 = getTeamBySeed(s2);
        return (t1 && t2) ? getProjectedWinner([t1, t2], "RegionalSemis") : t1 || t2;
      });
      const r2Winners = [
        getProjectedWinner([r1Winners[0], r1Winners[1]].filter(Boolean) as Team[], "RegionalChampion"),
        getProjectedWinner([r1Winners[2], r1Winners[3]].filter(Boolean) as Team[], "RegionalChampion"),
        getProjectedWinner([r1Winners[4], r1Winners[5]].filter(Boolean) as Team[], "RegionalChampion"),
        getProjectedWinner([r1Winners[6], r1Winners[7]].filter(Boolean) as Team[], "RegionalChampion"),
      ];
      const r3Winners = [
        getProjectedWinner([r2Winners[0], r2Winners[1]].filter(Boolean) as Team[], "SectionalSemiFinalist"),
        getProjectedWinner([r2Winners[2], r2Winners[3]].filter(Boolean) as Team[], "SectionalSemiFinalist"),
      ];
      const regionWinner = getProjectedWinner(r3Winners.filter(Boolean) as Team[], "SectionalFinalist");

      const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
      const r32Positions = matchupsD1.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
      const r16Positions = [0,1,2,3].map((i) => (r32Positions[i * 2] + r32Positions[i * 2 + 1]) / 2);
      const r8Positions = [0,1].map((i) => (r16Positions[i * 2] + r16Positions[i * 2 + 1]) / 2);
      const finalPos = (r8Positions[0] + r8Positions[1]) / 2;
      const totalHeight = 16 * TEAM_HEIGHT;

      return (
        <div key={regionName} style={CARD_STYLE}>
          <div style={CARD_HEADER}>{regionName}</div>
          <div style={COL_HEADER_ROW}>
            {colLabels.map((label, i) => (
              <div key={label} style={{ width: i === 4 ? TEAM_WIDTH : TEAM_WIDTH + CONNECTOR_WIDTH, textAlign: "center", padding: "7px 0", borderRight: i < 4 ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
                {label}
              </div>
            ))}
          </div>
          <div style={{ background: "white", padding: 20, overflowX: "auto" }}>
            <div style={{ position: "relative", height: totalHeight, minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4 }}>
              {matchupsD1.flatMap(([s1, s2], mi) => {
                const i1 = mi * 2, i2 = mi * 2 + 1;
                return [
                  <div key={`r1-${i1}`} style={{ position: "absolute", top: r64Positions[i1], left: 0 }}><TeamSlot team={getTeamBySeed(s1)} seed={s1} prob={getTeamBySeed(s1)?.RegionalSemis} /></div>,
                  <div key={`r1-${i2}`} style={{ position: "absolute", top: r64Positions[i2], left: 0 }}><TeamSlot team={getTeamBySeed(s2)} seed={s2} prob={getTeamBySeed(s2)?.RegionalSemis} /></div>,
                ];
              })}
              {matchupsD1.map((_, i) => <div key={`c1-${i}`} style={{ position: "absolute", left: TEAM_WIDTH, top: r32Positions[i], width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
              {r1Winners.map((w, i) => <div key={`r2-${i}`} style={{ position: "absolute", top: r32Positions[i] - TEAM_HEIGHT / 2, left: TEAM_WIDTH + CONNECTOR_WIDTH }}><TeamSlot team={w} prob={w?.RegionalChampion} /></div>)}
              {[0,1,2,3].map((i) => <div key={`c2-${i}`} style={{ position: "absolute", left: TEAM_WIDTH * 2 + CONNECTOR_WIDTH, top: r16Positions[i], width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
              {r2Winners.map((w, i) => <div key={`r3-${i}`} style={{ position: "absolute", top: r16Positions[i] - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2 }}><TeamSlot team={w} prob={w?.SectionalSemiFinalist} /></div>)}
              {[0,1].map((i) => <div key={`c3-${i}`} style={{ position: "absolute", left: TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2, top: r8Positions[i], width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
              {r3Winners.map((w, i) => <div key={`r4-${i}`} style={{ position: "absolute", top: r8Positions[i] - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3 }}><TeamSlot team={w} prob={w?.SectionalFinalist} /></div>)}
              <div style={{ position: "absolute", left: TEAM_WIDTH * 4 + CONNECTOR_WIDTH * 3, top: finalPos, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />
              <div style={{ position: "absolute", top: finalPos - TEAM_HEIGHT / 2, left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4 }}><TeamSlot team={regionWinner} prob={regionWinner?.StateQualifier} /></div>
            </div>
          </div>
        </div>
      );
    };

    const stateQualifiers = ["1","2","3","4"].map((r) => ({
      sectional: `Region ${r}`,
      winner: getProjectedWinner(divisionTeams.filter((t) => t.Region === r), "StateQualifier"),
    }));
    const champion = divisionTeams.length > 0 ? divisionTeams.reduce((best, cur) => (cur.StateChampion > best.StateChampion ? cur : best)) : null;

    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 16px", marginBottom: 24, fontSize: 13, color: "#0369a1", lineHeight: 1.5 }}>
          <strong style={{ color: "#0c4a6e" }}>Methodology:</strong> Seedings are based on BBMI rankings. Probabilities represent the likelihood of advancing to each round using Monte Carlo simulation.
        </div>
        {["1","2","3","4"].map((r) => renderD1Region(`Region ${r}`, r))}
        <div style={{ ...CARD_STYLE, marginBottom: 0 }}>
          <div style={CARD_HEADER}>State Championship</div>
          <div style={{ backgroundColor: "#ffffff", padding: 32 }}>
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {stateQualifiers.slice(0, 2).map(({ sectional, winner }) => (
                  <div key={sectional} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{sectional}</div>
                    <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                  </div>
                ))}
              </div>
              {champion && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Champion</div>
                  <div style={{ height: 36, width: 240, border: "2px solid #0a1a2f", background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 8, paddingRight: 12, fontSize: 15, fontWeight: 600, borderRadius: 6 }}>
                    <Link href={`/wiaa-team/${encodeURIComponent(champion.Team)}`} className="hover:underline" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <TeamLogo slug={champion.slug} size={20} />
                      <div><strong style={{ marginRight: 4 }}>{champion.Seed}</strong>{champion.Team}</div>
                    </Link>
                    <span style={{ color: "#b45309", fontWeight: 700 }}>{fmtPct(champion.StateChampion)}</span>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {stateQualifiers.slice(2, 4).map(({ sectional, winner }) => (
                  <div key={sectional} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{sectional}</div>
                    <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // DIVISIONS 2–5 — paired regions, 8 teams each
  // ------------------------------------------------------------
  const matchupsWIAA = [[1,8],[4,5],[3,6],[2,7]];

  const renderSectional = (sectionalName: string, regionAName: string, regionBName: string) => {
    const regionATeams = regions[regionAName] || [];
    const regionBTeams = regions[regionBName] || [];
    const getA = (seed: number) => regionATeams.find((t) => t.Seed === seed);
    const getB = (seed: number) => regionBTeams.find((t) => t.Seed === seed);

    const rsA = matchupsWIAA.map(([s1, s2]) => { const t1 = getA(s1), t2 = getA(s2); return (t1 && t2) ? getProjectedWinner([t1, t2], "RegionalSemis") : t1 || t2; });
    const rcA = [getProjectedWinner([rsA[0], rsA[1]].filter(Boolean) as Team[], "SectionalSemiFinalist"), getProjectedWinner([rsA[2], rsA[3]].filter(Boolean) as Team[], "SectionalSemiFinalist")];
    const winnerA = getProjectedWinner(rcA.filter(Boolean) as Team[], "SectionalFinalist");

    const rsB = matchupsWIAA.map(([s1, s2]) => { const t1 = getB(s1), t2 = getB(s2); return (t1 && t2) ? getProjectedWinner([t1, t2], "RegionalSemis") : t1 || t2; });
    const rcB = [getProjectedWinner([rsB[0], rsB[1]].filter(Boolean) as Team[], "SectionalSemiFinalist"), getProjectedWinner([rsB[2], rsB[3]].filter(Boolean) as Team[], "SectionalSemiFinalist")];
    const winnerB = getProjectedWinner(rcB.filter(Boolean) as Team[], "SectionalFinalist");

    const stateQ = getProjectedWinner([winnerA, winnerB].filter(Boolean) as Team[], "SectionalFinalist");

    const r64 = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
    const r32 = matchupsWIAA.map((_, i) => r64[i * 2] + TEAM_HEIGHT / 2);
    const s16 = [0,1].map((i) => (r32[i * 2] + r32[i * 2 + 1]) / 2);
    const sectPos = (s16[0] + s16[1]) / 2;
    const totalH = 16 * TEAM_HEIGHT;
    const half = totalH / 2;

    return (
      <div key={sectionalName} style={CARD_STYLE}>
        <div style={CARD_HEADER}>{sectionalName}</div>
        <div style={COL_HEADER_ROW}>
          {colLabels.map((label, i) => (
            <div key={label} style={{ width: i === 4 ? TEAM_WIDTH : TEAM_WIDTH + CONNECTOR_WIDTH, textAlign: "center", padding: "7px 0", borderRight: i < 4 ? "1px solid rgba(255,255,255,0.08)" : undefined }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ background: "white", padding: 20, overflowX: "auto" }}>
          <div style={{ position: "relative", height: totalH, minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4 }}>

            {/* Region A */}
            {matchupsWIAA.flatMap(([s1, s2], mi) => [
              <div key={`ra-${mi*2}`} style={{ position: "absolute", top: r64[mi*2], left: 0 }}><TeamSlot team={getA(s1)} seed={s1} prob={getA(s1)?.RegionalSemis} /></div>,
              <div key={`ra-${mi*2+1}`} style={{ position: "absolute", top: r64[mi*2+1], left: 0 }}><TeamSlot team={getA(s2)} seed={s2} prob={getA(s2)?.RegionalSemis} /></div>,
            ])}
            {matchupsWIAA.map((_, i) => <div key={`ca1-${i}`} style={{ position: "absolute", left: TEAM_WIDTH, top: r32[i], width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
            {rsA.map((w, i) => <div key={`rfa-${i}`} style={{ position: "absolute", top: r32[i] - TEAM_HEIGHT/2, left: TEAM_WIDTH + CONNECTOR_WIDTH }}><TeamSlot team={w} prob={w?.RegionalChampion} /></div>)}
            {[0,1].map((i) => <div key={`ca2-${i}`} style={{ position: "absolute", left: TEAM_WIDTH*2+CONNECTOR_WIDTH, top: s16[i], width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
            {rcA.map((w, i) => <div key={`ssa-${i}`} style={{ position: "absolute", top: s16[i] - TEAM_HEIGHT/2, left: (TEAM_WIDTH+CONNECTOR_WIDTH)*2 }}><TeamSlot team={w} prob={w?.SectionalSemiFinalist} /></div>)}
            <div style={{ position: "absolute", left: TEAM_WIDTH*3+CONNECTOR_WIDTH*2, top: sectPos, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />
            <div style={{ position: "absolute", top: sectPos - TEAM_HEIGHT/2, left: (TEAM_WIDTH+CONNECTOR_WIDTH)*3 }}><TeamSlot team={winnerA} prob={winnerA?.SectionalFinalist} /></div>

            {/* Region B */}
            {matchupsWIAA.flatMap(([s1, s2], mi) => [
              <div key={`rb-${mi*2}`} style={{ position: "absolute", top: r64[mi*2] + half, left: 0 }}><TeamSlot team={getB(s1)} seed={s1} prob={getB(s1)?.RegionalSemis} /></div>,
              <div key={`rb-${mi*2+1}`} style={{ position: "absolute", top: r64[mi*2+1] + half, left: 0 }}><TeamSlot team={getB(s2)} seed={s2} prob={getB(s2)?.RegionalSemis} /></div>,
            ])}
            {matchupsWIAA.map((_, i) => <div key={`cb1-${i}`} style={{ position: "absolute", left: TEAM_WIDTH, top: r32[i] + half, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
            {rsB.map((w, i) => <div key={`rfb-${i}`} style={{ position: "absolute", top: r32[i] - TEAM_HEIGHT/2 + half, left: TEAM_WIDTH + CONNECTOR_WIDTH }}><TeamSlot team={w} prob={w?.RegionalChampion} /></div>)}
            {[0,1].map((i) => <div key={`cb2-${i}`} style={{ position: "absolute", left: TEAM_WIDTH*2+CONNECTOR_WIDTH, top: s16[i] + half, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />)}
            {rcB.map((w, i) => <div key={`ssb-${i}`} style={{ position: "absolute", top: s16[i] - TEAM_HEIGHT/2 + half, left: (TEAM_WIDTH+CONNECTOR_WIDTH)*2 }}><TeamSlot team={w} prob={w?.SectionalSemiFinalist} /></div>)}
            <div style={{ position: "absolute", left: TEAM_WIDTH*3+CONNECTOR_WIDTH*2, top: sectPos + half, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />
            <div style={{ position: "absolute", top: sectPos - TEAM_HEIGHT/2 + half, left: (TEAM_WIDTH+CONNECTOR_WIDTH)*3 }}><TeamSlot team={winnerB} prob={winnerB?.SectionalFinalist} /></div>

            {/* State Qualifier */}
            <div style={{ position: "absolute", left: TEAM_WIDTH*4+CONNECTOR_WIDTH*3, top: half, width: CONNECTOR_WIDTH, borderTop: "1px solid #a8a29e" }} />
            <div style={{ position: "absolute", top: half - TEAM_HEIGHT/2, left: (TEAM_WIDTH+CONNECTOR_WIDTH)*4 }}><TeamSlot team={stateQ} prob={stateQ?.StateQualifier} /></div>
          </div>
        </div>
      </div>
    );
  };

  const stateQualifiers = ["1","2","3","4"].map((n) => ({
    sectional: `Sectional ${n}`,
    winner: getProjectedWinner(divisionTeams.filter((t) => t.Region === `${n}A` || t.Region === `${n}B`), "StateQualifier"),
  }));
  const champion = divisionTeams.length > 0 ? divisionTeams.reduce((best, cur) => (cur.StateChampion > best.StateChampion ? cur : best)) : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ backgroundColor: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 16px", marginBottom: 24, fontSize: 13, color: "#0369a1", lineHeight: 1.5 }}>
        <strong style={{ color: "#0c4a6e" }}>Methodology:</strong> Seedings are based on BBMI rankings. Probabilities represent the likelihood of advancing to each round using Monte Carlo simulation.
      </div>

      {renderSectional("Sectional 1", "1A", "1B")}
      {renderSectional("Sectional 2", "2A", "2B")}
      {renderSectional("Sectional 3", "3A", "3B")}
      {renderSectional("Sectional 4", "4A", "4B")}

      <div style={{ ...CARD_STYLE, marginBottom: 0 }}>
        <div style={CARD_HEADER}>State Championship</div>
        <div style={{ backgroundColor: "#ffffff", padding: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {stateQualifiers.slice(0, 2).map(({ sectional, winner }) => (
                <div key={sectional} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{sectional}</div>
                  <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                </div>
              ))}
            </div>
            {champion && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Champion</div>
                <div style={{ height: 36, width: 240, border: "2px solid #0a1a2f", background: "#fffbeb", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 8, paddingRight: 12, fontSize: 15, fontWeight: 600, borderRadius: 6 }}>
                  <Link href={`/wiaa-team/${encodeURIComponent(champion.Team)}`} className="hover:underline" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                    <TeamLogo slug={champion.slug} size={20} />
                    <div><strong style={{ marginRight: 4 }}>{champion.Seed}</strong>{champion.Team}</div>
                  </Link>
                  <span style={{ color: "#b45309", fontWeight: 700 }}>{fmtPct(champion.StateChampion)}</span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {stateQualifiers.slice(2, 4).map(({ sectional, winner }) => (
                <div key={sectional} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{sectional}</div>
                  <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
