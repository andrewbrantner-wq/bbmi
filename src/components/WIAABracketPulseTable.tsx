"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";

// Import all division bracket files
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

type WIAABracketPulseTableProps = {
  division: string;
};

export default function WIAABracketPulseTable({ division }: WIAABracketPulseTableProps) {
  // Select the appropriate data based on division
  const seedingData = useMemo(() => {
    switch(division) {
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

  const divisionTeams = useMemo(() => {
    return teams.filter(t => t.Division === division);
  }, [teams, division]);

  const regions = useMemo(() => {
    const regionMap: { [key: string]: Team[] } = {};
    divisionTeams.forEach((team) => {
      if (!regionMap[team.Region]) {
        regionMap[team.Region] = [];
      }
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
      const bestProb = typeof best[probKey] === 'number' ? best[probKey] as number : 0;
      const currentProb = typeof current[probKey] === 'number' ? current[probKey] as number : 0;
      return currentProb > bestProb ? current : best;
    });
  };

  // Constants for layout
  const TEAM_HEIGHT = 24;
  const TEAM_WIDTH = 180;
  const CONNECTOR_WIDTH = 20;

  const TeamSlot = ({ 
    team, 
    seed,
    prob, 
    showProb = true,
    style = {}
  }: { 
    team: Team | undefined; 
    seed?: number;
    prob?: number;
    showProb?: boolean;
    style?: React.CSSProperties;
  }) => {
    if (!team) {
      return (
        <div 
          style={{ 
            height: TEAM_HEIGHT, 
            width: TEAM_WIDTH, 
            border: '1px solid #ccc',
            background: '#fafafa',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 4,
            fontSize: 13,
            color: '#999',
            ...style
          }}
        >
          {seed !== undefined && <strong style={{ marginRight: 2 }}>{seed}</strong>}
          <span style={{ fontStyle: 'italic' }}>TBD</span>
        </div>
      );
    }
    
    return (
      <div 
        style={{ 
          height: TEAM_HEIGHT, 
          width: TEAM_WIDTH, 
          border: '1px solid #999',
          background: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 4,
          paddingRight: 8,
          fontSize: 13,
          ...style
        }}
      >
        <Link
          href={`/wiaa-team/${encodeURIComponent(team.Team)}`}
          className="hover:underline cursor-pointer flex-1"
          style={{ 
            textDecoration: 'none', 
            color: 'inherit', 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <TeamLogo slug={team.slug} size={16} />
          <div style={{ 
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0
          }}>
            <strong style={{ marginRight: 2 }}>{team.Seed}</strong>
            {team.Team}
          </div>
        </Link>
        {showProb && prob !== undefined && prob > 0 && (
          <span style={{ color: '#555', fontSize: 12, flexShrink: 0 }}>{fmtPct(prob)}</span>
        )}
      </div>
    );
  };

  // Render Division 1 (NCAA style - single region, 16 teams)
  if (division === "1") {
    // D1: NCAA bracket - 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
    const matchupsD1 = [[1,16], [8,9], [5,12], [4,13], [6,11], [3,14], [7,10], [2,15]];
    
    const renderD1Region = (regionName: string, regionNum: string) => {
      const regionTeams = regions[regionNum] || [];
      const getTeamBySeed = (seed: number) => regionTeams.find(t => t.Seed === seed);
      
      // Round 1: 8 matchups (16 teams)
      const r1Winners = matchupsD1.map(([seed1, seed2]) => {
        const team1 = getTeamBySeed(seed1);
        const team2 = getTeamBySeed(seed2);
        if (team1 && team2) {
          return getProjectedWinner([team1, team2], 'RegionalSemis');
        }
        return team1 || team2;
      });

      // Round 2: 4 matchups (8 teams)
      const r2Winners = [
        getProjectedWinner([r1Winners[0], r1Winners[1]].filter(Boolean) as Team[], 'RegionalChampion'),
        getProjectedWinner([r1Winners[2], r1Winners[3]].filter(Boolean) as Team[], 'RegionalChampion'),
        getProjectedWinner([r1Winners[4], r1Winners[5]].filter(Boolean) as Team[], 'RegionalChampion'),
        getProjectedWinner([r1Winners[6], r1Winners[7]].filter(Boolean) as Team[], 'RegionalChampion'),
      ];

      // Round 3: 2 matchups (4 teams - Sweet 16)
      const r3Winners = [
        getProjectedWinner([r2Winners[0], r2Winners[1]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
        getProjectedWinner([r2Winners[2], r2Winners[3]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
      ];

      // Round 4: 1 matchup (2 teams - Elite 8)
      const regionWinner = getProjectedWinner(r3Winners.filter(Boolean) as Team[], 'SectionalFinalist');

      // Position calculations
      const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
      const r32Positions = matchupsD1.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
      const r16Positions = [0, 1, 2, 3].map(i => (r32Positions[i * 2] + r32Positions[i * 2 + 1]) / 2);
      const r8Positions = [0, 1].map(i => (r16Positions[i * 2] + r16Positions[i * 2 + 1]) / 2);
      const finalPos = (r8Positions[0] + r8Positions[1]) / 2;
      const totalHeight = 16 * TEAM_HEIGHT;
      
      return (
        <div className="mb-6 overflow-hidden border border-stone-300 rounded-lg shadow-lg">
          <div style={{ 
            background: 'hsl(210 30% 12%)',
            color: 'white',
            textAlign: 'center',
            padding: '12px 16px',
            fontSize: 20,
            fontWeight: 600
          }}>
            {regionName}
          </div>
          
          <div style={{ 
            display: 'flex', 
            background: 'hsl(210 30% 18%)',
            color: 'white',
            fontSize: 14,
            fontWeight: 600
          }}>
            <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Regional Semis</div>
            <div style={{ width: CONNECTOR_WIDTH }}></div>
            <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Regional Finals</div>
            <div style={{ width: CONNECTOR_WIDTH }}></div>
            <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Sectional Semi</div>
            <div style={{ width: CONNECTOR_WIDTH }}></div>
            <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Sectional Final</div>
            <div style={{ width: CONNECTOR_WIDTH }}></div>
            <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0', background: 'hsl(210 30% 25%)' }}>State Qualifier</div>
          </div>

          <div style={{ 
            background: 'white', 
            padding: '20px',
            overflowX: 'auto',
            minHeight: '400px'
          }}>
            <div style={{ 
              position: 'relative', 
              height: totalHeight,
              minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4
            }}>
              
              {/* Round 1 - All 16 teams */}
              {matchupsD1.flatMap(([seed1, seed2], matchupIdx) => {
                const team1 = getTeamBySeed(seed1);
                const team2 = getTeamBySeed(seed2);
                const idx1 = matchupIdx * 2;
                const idx2 = matchupIdx * 2 + 1;
                return [
                  <div key={`r1-${idx1}`} style={{ position: 'absolute', top: r64Positions[idx1], left: 0 }}>
                    <TeamSlot team={team1} seed={seed1} prob={team1?.RegionalSemis} />
                  </div>,
                  <div key={`r1-${idx2}`} style={{ position: 'absolute', top: r64Positions[idx2], left: 0 }}>
                    <TeamSlot team={team2} seed={seed2} prob={team2?.RegionalSemis} />
                  </div>
                ];
              })}

              {/* Connectors R1 -> R2 */}
              {matchupsD1.map((_, i) => (
                <div key={`conn-r1-${i}`} style={{
                  position: 'absolute',
                  left: TEAM_WIDTH,
                  top: r32Positions[i],
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              ))}

              {/* Round 2 - 8 teams */}
              {r1Winners.map((winner, i) => (
                <div key={`r2-${i}`} style={{ 
                  position: 'absolute', 
                  top: r32Positions[i] - TEAM_HEIGHT / 2, 
                  left: TEAM_WIDTH + CONNECTOR_WIDTH 
                }}>
                  <TeamSlot team={winner} prob={winner?.RegionalChampion} />
                </div>
              ))}

              {/* Connectors R2 -> R3 */}
              {[0, 1, 2, 3].map((i) => (
                <div key={`conn-r2-${i}`} style={{
                  position: 'absolute',
                  left: TEAM_WIDTH * 2 + CONNECTOR_WIDTH,
                  top: r16Positions[i],
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              ))}

              {/* Round 3 - Sweet 16 (4 teams) */}
              {r2Winners.map((winner, i) => (
                <div key={`r3-${i}`} style={{ 
                  position: 'absolute', 
                  top: r16Positions[i] - TEAM_HEIGHT / 2, 
                  left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2
                }}>
                  <TeamSlot team={winner} prob={winner?.SectionalSemiFinalist} />
                </div>
              ))}

              {/* Connectors R3 -> R4 */}
              {[0, 1].map((i) => (
                <div key={`conn-r3-${i}`} style={{
                  position: 'absolute',
                  left: TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2,
                  top: r8Positions[i],
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              ))}

              {/* Round 4 - Elite 8 (2 teams) */}
              {r3Winners.map((winner, i) => (
                <div key={`r4-${i}`} style={{ 
                  position: 'absolute', 
                  top: r8Positions[i] - TEAM_HEIGHT / 2, 
                  left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
                }}>
                  <TeamSlot team={winner} prob={winner?.SectionalFinalist} />
                </div>
              ))}

              {/* Connector R4 -> Final */}
              <div style={{
                position: 'absolute',
                left: TEAM_WIDTH * 4 + CONNECTOR_WIDTH * 3,
                top: finalPos,
                width: CONNECTOR_WIDTH,
                borderTop: '1px solid #888'
              }} />

              {/* Final 4 Winner */}
              <div style={{ 
                position: 'absolute', 
                top: finalPos - TEAM_HEIGHT / 2, 
                left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4
              }}>
                <TeamSlot team={regionWinner} prob={regionWinner?.StateQualifier} />
              </div>

            </div>
          </div>
        </div>
      );
    };

    // Get state qualifiers for D1
    const stateQualifiers = [
      { sectional: 'Region 1', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '1'), 'StateQualifier') },
      { sectional: 'Region 2', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '2'), 'StateQualifier') },
      { sectional: 'Region 3', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '3'), 'StateQualifier') },
      { sectional: 'Region 4', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '4'), 'StateQualifier') },
    ];

    const champion = divisionTeams.length > 0 ? divisionTeams.reduce((best, current) => {
      const bestProb = typeof best.StateChampion === 'number' ? best.StateChampion : 0;
      const currentProb = typeof current.StateChampion === 'number' ? current.StateChampion : 0;
      return currentProb > bestProb ? current : best;
    }) : null;

    return (
      <div className="w-full max-w-7xl mx-auto p-4">
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 24,
          fontSize: 14,
          color: '#475569',
          lineHeight: 1.5
        }}>
          <strong style={{ color: '#1e293b' }}>Methodology:</strong> Seedings are based on BBMI rankings. Probabilities represent the likelihood that the team makes it to that round of the tournament using Monte Carlo simulation.
        </div>

        {renderD1Region('Region 1', '1')}
        {renderD1Region('Region 2', '2')}
        {renderD1Region('Region 3', '3')}
        {renderD1Region('Region 4', '4')}

        {/* State Championship */}
        <div className="overflow-hidden border border-stone-300 rounded-lg shadow-lg">
          <div style={{ 
            background: 'hsl(210 30% 12%)',
            color: 'white',
            textAlign: 'center',
            padding: '12px 16px',
            fontSize: 20,
            fontWeight: 600
          }}>
            State Championship
          </div>
          
          <div style={{ background: 'white', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {stateQualifiers.slice(0, 2).map(({ sectional, winner }) => (
                  <div key={sectional} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{sectional}</div>
                    <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                  </div>
                ))}
              </div>

              {champion && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>CHAMPION</div>
                  <div style={{ 
                    height: 36,
                    width: 240,
                    border: '2px solid #333',
                    background: '#fffbeb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: 8,
                    paddingRight: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 4
                  }}>
                    <Link
                      href={`/wiaa-team/${encodeURIComponent(champion.Team)}`}
                      className="hover:underline cursor-pointer flex-1"
                      style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <TeamLogo slug={champion.slug} size={20} />
                      <div>
                        <strong style={{ marginRight: 4 }}>{champion.Seed}</strong>{champion.Team}
                      </div>
                    </Link>
                    <span style={{ color: '#b45309', fontWeight: 700 }}>{fmtPct(champion.StateChampion)}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {stateQualifiers.slice(2, 4).map(({ sectional, winner }) => (
                  <div key={sectional} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{sectional}</div>
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

  // Render Divisions 2-5 (WIAA style - paired regions, 8 teams each)
  // D2-D5: WIAA bracket - 1v8, 4v5, 3v6, 2v7
  const matchupsWIAA = [[1,8], [4,5], [3,6], [2,7]];

  const renderSectionalWIAA = (sectionalName: string, regionAName: string, regionBName: string) => {
    const regionATeams = regions[regionAName] || [];
    const regionBTeams = regions[regionBName] || [];
    
    const getTeamBySeedA = (seed: number) => regionATeams.find(t => t.Seed === seed);
    const getTeamBySeedB = (seed: number) => regionBTeams.find(t => t.Seed === seed);

    // Calculate winners for Region A
    const rsWinnersA = matchupsWIAA.map(([seed1, seed2]) => {
      const team1 = getTeamBySeedA(seed1);
      const team2 = getTeamBySeedA(seed2);
      if (team1 && team2) {
        return getProjectedWinner([team1, team2], 'RegionalSemis');
      }
      return team1 || team2;
    });

    const rcWinnersA = [
      getProjectedWinner([rsWinnersA[0], rsWinnersA[1]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
      getProjectedWinner([rsWinnersA[2], rsWinnersA[3]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
    ];

    const regionAWinner = getProjectedWinner(rcWinnersA.filter(Boolean) as Team[], 'SectionalFinalist');

    // Calculate winners for Region B
    const rsWinnersB = matchupsWIAA.map(([seed1, seed2]) => {
      const team1 = getTeamBySeedB(seed1);
      const team2 = getTeamBySeedB(seed2);
      if (team1 && team2) {
        return getProjectedWinner([team1, team2], 'RegionalSemis');
      }
      return team1 || team2;
    });

    const rcWinnersB = [
      getProjectedWinner([rsWinnersB[0], rsWinnersB[1]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
      getProjectedWinner([rsWinnersB[2], rsWinnersB[3]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
    ];

    const regionBWinner = getProjectedWinner(rcWinnersB.filter(Boolean) as Team[], 'SectionalFinalist');
    const stateQualifier = getProjectedWinner([regionAWinner, regionBWinner].filter(Boolean) as Team[], 'SectionalFinalist');

    // Position calculations - 16 total positions (8 for each region)
    const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
    const r32Positions = matchupsWIAA.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
    const s16Positions = [0, 1].map(i => (r32Positions[i * 2] + r32Positions[i * 2 + 1]) / 2);
    const sectionalPos = (s16Positions[0] + s16Positions[1]) / 2;
    const totalHeight = 16 * TEAM_HEIGHT;

    return (
      <div className="mb-10 overflow-hidden border border-stone-300 rounded-lg shadow-lg">
        <div style={{ 
          background: 'hsl(210 30% 12%)',
          color: 'white',
          textAlign: 'center',
          padding: '12px 16px',
          fontSize: 20,
          fontWeight: 600
        }}>
          {sectionalName}
        </div>
        
        <div style={{ 
          display: 'flex', 
          background: 'hsl(210 30% 18%)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600
        }}>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Regional Semis</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Regional Finals</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Sectional Semi</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Sectional Final</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0', background: 'hsl(210 30% 25%)' }}>State Qualifier</div>
        </div>

        <div style={{ 
          background: 'white', 
          padding: '20px',
          overflowX: 'auto',
          minHeight: '400px'
        }}>
          <div style={{ 
            position: 'relative', 
            height: totalHeight,
            minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4
          }}>
            
            {/* Regional Semis - Region A (rows 0-7) */}
            {matchupsWIAA.flatMap(([seed1, seed2], matchupIdx) => {
              const team1 = getTeamBySeedA(seed1);
              const team2 = getTeamBySeedA(seed2);
              const idx1 = matchupIdx * 2;
              const idx2 = matchupIdx * 2 + 1;
              return [
                <div key={`ra-rs-${idx1}`} style={{ position: 'absolute', top: r64Positions[idx1], left: 0 }}>
                  <TeamSlot team={team1} seed={seed1} prob={team1?.RegionalSemis} />
                </div>,
                <div key={`ra-rs-${idx2}`} style={{ position: 'absolute', top: r64Positions[idx2], left: 0 }}>
                  <TeamSlot team={team2} seed={seed2} prob={team2?.RegionalSemis} />
                </div>
              ];
            })}

            {/* Connectors RS -> RF (Region A) */}
            {matchupsWIAA.map((_, i) => (
              <div key={`conn-ra-rs-${i}`} style={{
                position: 'absolute',
                left: TEAM_WIDTH,
                top: r32Positions[i],
                width: CONNECTOR_WIDTH,
                borderTop: '1px solid #888'
              }} />
            ))}

            {/* Regional Finals - Region A */}
            {rsWinnersA.map((winner, i) => (
              <div key={`ra-rf-${i}`} style={{ 
                position: 'absolute', 
                top: r32Positions[i] - TEAM_HEIGHT / 2, 
                left: TEAM_WIDTH + CONNECTOR_WIDTH 
              }}>
                <TeamSlot team={winner} prob={winner?.RegionalChampion} />
              </div>
            ))}

            {/* Connectors RF -> RC (Region A) */}
            {[0, 1].map((i) => (
              <div key={`conn-ra-rf-${i}`} style={{
                position: 'absolute',
                left: TEAM_WIDTH * 2 + CONNECTOR_WIDTH,
                top: s16Positions[i],
                width: CONNECTOR_WIDTH,
                borderTop: '1px solid #888'
              }} />
            ))}

            {/* Sectional Semi - Region A */}
            {rcWinnersA.map((winner, i) => (
              <div key={`ra-rc-${i}`} style={{ 
                position: 'absolute', 
                top: s16Positions[i] - TEAM_HEIGHT / 2, 
                left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2
              }}>
                <TeamSlot team={winner} prob={winner?.SectionalSemiFinalist} />
              </div>
            ))}

            {/* Connector RC -> Sectional Final (Region A) */}
            <div style={{
              position: 'absolute',
              left: TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2,
              top: sectionalPos,
              width: CONNECTOR_WIDTH,
              borderTop: '1px solid #888'
            }} />

            {/* Sectional Final - Region A */}
            <div style={{ 
              position: 'absolute', 
              top: sectionalPos - TEAM_HEIGHT / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
            }}>
              <TeamSlot team={regionAWinner} prob={regionAWinner?.SectionalFinalist} />
            </div>

            {/* Regional Semis - Region B (rows 8-15) */}
            {matchupsWIAA.flatMap(([seed1, seed2], matchupIdx) => {
              const team1 = getTeamBySeedB(seed1);
              const team2 = getTeamBySeedB(seed2);
              const idx1 = matchupIdx * 2 + 8;
              const idx2 = matchupIdx * 2 + 9;
              return [
                <div key={`rb-rs-${idx1}`} style={{ position: 'absolute', top: r64Positions[idx1], left: 0 }}>
                  <TeamSlot team={team1} seed={seed1} prob={team1?.RegionalSemis} />
                </div>,
                <div key={`rb-rs-${idx2}`} style={{ position: 'absolute', top: r64Positions[idx2], left: 0 }}>
                  <TeamSlot team={team2} seed={seed2} prob={team2?.RegionalSemis} />
                </div>
              ];
            })}

            {/* Connectors RS -> RF (Region B) */}
            {matchupsWIAA.map((_, i) => (
              <div key={`conn-rb-rs-${i}`} style={{
                position: 'absolute',
                left: TEAM_WIDTH,
                top: r32Positions[i] + totalHeight / 2,
                width: CONNECTOR_WIDTH,
                borderTop: '1px solid #888'
              }} />
            ))}

            {/* Regional Finals - Region B */}
            {rsWinnersB.map((winner, i) => (
              <div key={`rb-rf-${i}`} style={{ 
                position: 'absolute', 
                top: r32Positions[i] - TEAM_HEIGHT / 2 + totalHeight / 2, 
                left: TEAM_WIDTH + CONNECTOR_WIDTH 
              }}>
                <TeamSlot team={winner} prob={winner?.RegionalChampion} />
              </div>
            ))}

            {/* Connectors RF -> RC (Region B) */}
            {[0, 1].map((i) => (
              <div key={`conn-rb-rf-${i}`} style={{
                position: 'absolute',
                left: TEAM_WIDTH * 2 + CONNECTOR_WIDTH,
                top: s16Positions[i] + totalHeight / 2,
                width: CONNECTOR_WIDTH,
                borderTop: '1px solid #888'
              }} />
            ))}

            {/* Sectional Semi - Region B */}
            {rcWinnersB.map((winner, i) => (
              <div key={`rb-rc-${i}`} style={{ 
                position: 'absolute', 
                top: s16Positions[i] - TEAM_HEIGHT / 2 + totalHeight / 2, 
                left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2
              }}>
                <TeamSlot team={winner} prob={winner?.SectionalSemiFinalist} />
              </div>
            ))}

            {/* Connector RC -> Sectional Final (Region B) */}
            <div style={{
              position: 'absolute',
              left: TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2,
              top: sectionalPos + totalHeight / 2,
              width: CONNECTOR_WIDTH,
              borderTop: '1px solid #888'
            }} />

            {/* Sectional Final - Region B */}
            <div style={{ 
              position: 'absolute', 
              top: sectionalPos - TEAM_HEIGHT / 2 + totalHeight / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
            }}>
              <TeamSlot team={regionBWinner} prob={regionBWinner?.SectionalFinalist} />
            </div>

            {/* Connector Sectional -> State Qualifier */}
            <div style={{
              position: 'absolute',
              left: TEAM_WIDTH * 4 + CONNECTOR_WIDTH * 3,
              top: (totalHeight / 2),
              width: CONNECTOR_WIDTH,
              borderTop: '1px solid #888'
            }} />

            {/* State Qualifier */}
            <div style={{ 
              position: 'absolute', 
              top: (totalHeight / 2) - (TEAM_HEIGHT / 2), 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4
            }}>
              <TeamSlot team={stateQualifier} prob={stateQualifier?.StateQualifier} />
            </div>

          </div>
        </div>
      </div>
    );
  };

  // Get state qualifiers for D2-D5
  const stateQualifiers = [
    { sectional: 'Sectional 1', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '1A' || t.Region === '1B'), 'StateQualifier') },
    { sectional: 'Sectional 2', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '2A' || t.Region === '2B'), 'StateQualifier') },
    { sectional: 'Sectional 3', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '3A' || t.Region === '3B'), 'StateQualifier') },
    { sectional: 'Sectional 4', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '4A' || t.Region === '4B'), 'StateQualifier') },
  ];

  const champion = divisionTeams.length > 0 ? divisionTeams.reduce((best, current) => {
    const bestProb = typeof best.StateChampion === 'number' ? best.StateChampion : 0;
    const currentProb = typeof current.StateChampion === 'number' ? current.StateChampion : 0;
    return currentProb > bestProb ? current : best;
  }) : null;

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 24,
        fontSize: 14,
        color: '#475569',
        lineHeight: 1.5
      }}>
        <strong style={{ color: '#1e293b' }}>Methodology:</strong> Seedings are based on BBMI rankings. Probabilities represent the likelihood that the team makes it to that round of the tournament using Monte Carlo simulation.
      </div>

      {renderSectionalWIAA('Sectional 1', '1A', '1B')}
      {renderSectionalWIAA('Sectional 2', '2A', '2B')}
      {renderSectionalWIAA('Sectional 3', '3A', '3B')}
      {renderSectionalWIAA('Sectional 4', '4A', '4B')}

      {/* State Championship */}
      <div className="overflow-hidden border border-stone-300 rounded-lg shadow-lg">
        <div style={{ 
          background: 'hsl(210 30% 12%)',
          color: 'white',
          textAlign: 'center',
          padding: '12px 16px',
          fontSize: 20,
          fontWeight: 600
        }}>
          State Championship
        </div>
        
        <div style={{ background: 'white', padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {stateQualifiers.slice(0, 2).map(({ sectional, winner }) => (
                <div key={sectional} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{sectional}</div>
                  <TeamSlot team={winner} prob={winner?.StateFinalist} style={{ width: 200 }} />
                </div>
              ))}
            </div>

            {champion && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>CHAMPION</div>
                <div style={{ 
                  height: 36,
                  width: 240,
                  border: '2px solid #333',
                  background: '#fffbeb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 8,
                  paddingRight: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 4
                }}>
                  <Link
                    href={`/wiaa-team/${encodeURIComponent(champion.Team)}`}
                    className="hover:underline cursor-pointer flex-1"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <TeamLogo slug={champion.slug} size={20} />
                    <div>
                      <strong style={{ marginRight: 4 }}>{champion.Seed}</strong>{champion.Team}
                    </div>
                  </Link>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{fmtPct(champion.StateChampion)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {stateQualifiers.slice(2, 4).map(({ sectional, winner }) => (
                <div key={sectional} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{sectional}</div>
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
