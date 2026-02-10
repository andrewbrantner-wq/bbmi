"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import seedingData from "@/data/wiaa-seeding/wiaa-d4-bracket.json";

type Team = {
  Team: string;
  Division: string;
  Region: string;
  WIAASeed: number;
  BBMISeed: number;
  Seed: number;  // 1-8 for bracket matchups
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

export default function WIAABracketPulse() {
  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return seedingData as Team[];
  }, []);

  const [selectedDivision] = useState<string>("4");

  const divisionTeams = useMemo(() => {
    return teams.filter(t => t.Division === selectedDivision);
  }, [teams, selectedDivision]);

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

  // Standard bracket matchups: 1v8, 4v5, 3v6, 2v7 (NCAA format)
  const matchups = [
    [1, 8], [4, 5],
    [3, 6], [2, 7]
  ];

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
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <TeamLogo slug={team.slug} size={16} />
          <div>
            <strong style={{ marginRight: 2 }}>{team.Seed}</strong>
            {team.Team}
          </div>
        </Link>
        {showProb && prob !== undefined && prob > 0 && (
          <span style={{ color: '#555', fontSize: 12 }}>{fmtPct(prob)}</span>
        )}
      </div>
    );
  };

  const renderSectional = (sectionalName: string, regionAName: string, regionBName: string) => {
    const regionATeams = regions[regionAName] || [];
    const regionBTeams = regions[regionBName] || [];
    
    const getTeamBySeedA = (seed: number) => regionATeams.find(t => t.Seed === seed);
    const getTeamBySeedB = (seed: number) => regionBTeams.find(t => t.Seed === seed);

    // Calculate winners for Region A
    const rsWinnersA = matchups.map(([seed1, seed2]) => {
      const team1 = getTeamBySeedA(seed1);
      const team2 = getTeamBySeedA(seed2);
      if (team1 && team2) {
        return getProjectedWinner([team1, team2], 'RegionalSemis');
      }
      return team1 || team2;
    });

    const rfWinnersA = [
      getProjectedWinner([rsWinnersA[0], rsWinnersA[1]].filter(Boolean) as Team[], 'RegionalChampion'),
      getProjectedWinner([rsWinnersA[2], rsWinnersA[3]].filter(Boolean) as Team[], 'RegionalChampion'),
    ];

    // Regional Champ winners - recalculate using SectionalSemiFinalist
    const rcWinnersA = [
      getProjectedWinner([rsWinnersA[0], rsWinnersA[1]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
      getProjectedWinner([rsWinnersA[2], rsWinnersA[3]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
    ];

    const regionAWinner = getProjectedWinner(rcWinnersA.filter(Boolean) as Team[], 'SectionalFinalist');

    // Calculate winners for Region B
    const rsWinnersB = matchups.map(([seed1, seed2]) => {
      const team1 = getTeamBySeedB(seed1);
      const team2 = getTeamBySeedB(seed2);
      if (team1 && team2) {
        return getProjectedWinner([team1, team2], 'RegionalSemis');
      }
      return team1 || team2;
    });

    const rfWinnersB = [
      getProjectedWinner([rsWinnersB[0], rsWinnersB[1]].filter(Boolean) as Team[], 'RegionalChampion'),
      getProjectedWinner([rsWinnersB[2], rsWinnersB[3]].filter(Boolean) as Team[], 'RegionalChampion'),
    ];

    // Regional Champ winners - recalculate using SectionalSemiFinalist
    const rcWinnersB = [
      getProjectedWinner([rsWinnersB[0], rsWinnersB[1]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
      getProjectedWinner([rsWinnersB[2], rsWinnersB[3]].filter(Boolean) as Team[], 'SectionalSemiFinalist'),
    ];

    const regionBWinner = getProjectedWinner(rcWinnersB.filter(Boolean) as Team[], 'SectionalFinalist');

    // Sectional winner
    const sectionalWinner = getProjectedWinner([regionAWinner, regionBWinner].filter(Boolean) as Team[], 'SectionalFinalist');
    
    // State qualifier
    const stateQualifier = sectionalWinner;

    // Position calculations (exactly like NCAA)
    const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
    const r32Positions = matchups.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
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
          overflowX: 'auto'
        }}>
          <div style={{ 
            position: 'relative', 
            height: totalHeight,
            minWidth: TEAM_WIDTH * 5 + CONNECTOR_WIDTH * 4
          }}>
            
            {/* Regional Semis - Region A (top half) */}
            {matchups.flatMap(([seed1, seed2], matchupIdx) => {
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
            {matchups.map((_, i) => {
              const midY = r32Positions[i];
              return (
                <React.Fragment key={`conn-ra-rs-${i}`}>
                  <div style={{
                    position: 'absolute',
                    left: TEAM_WIDTH,
                    top: midY,
                    width: CONNECTOR_WIDTH,
                    borderTop: '1px solid #888'
                  }} />
                </React.Fragment>
              );
            })}

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
            {[0, 1].map((i) => {
              const midY = s16Positions[i];
              const leftStart = TEAM_WIDTH * 2 + CONNECTOR_WIDTH;
              return (
                <React.Fragment key={`conn-ra-rf-${i}`}>
                  <div style={{
                    position: 'absolute',
                    left: leftStart,
                    top: midY,
                    width: CONNECTOR_WIDTH,
                    borderTop: '1px solid #888'
                  }} />
                </React.Fragment>
              );
            })}

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
            {(() => {
              const midY = sectionalPos;
              const leftStart = TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2;
              return (
                <div style={{
                  position: 'absolute',
                  left: leftStart,
                  top: midY,
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              );
            })()}

            {/* Sectional Final - Region A */}
            <div style={{ 
              position: 'absolute', 
              top: sectionalPos - TEAM_HEIGHT / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
            }}>
              <TeamSlot team={regionAWinner} prob={regionAWinner?.SectionalFinalist} />
            </div>

            {/* Regional Semis - Region B (bottom half) */}
            {matchups.flatMap(([seed1, seed2], matchupIdx) => {
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
            {matchups.map((_, i) => {
              const midY = r32Positions[i] + totalHeight / 2;
              return (
                <React.Fragment key={`conn-rb-rs-${i}`}>
                  <div style={{
                    position: 'absolute',
                    left: TEAM_WIDTH,
                    top: midY,
                    width: CONNECTOR_WIDTH,
                    borderTop: '1px solid #888'
                  }} />
                </React.Fragment>
              );
            })}

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
            {[0, 1].map((i) => {
              const midY = s16Positions[i] + totalHeight / 2;
              const leftStart = TEAM_WIDTH * 2 + CONNECTOR_WIDTH;
              return (
                <React.Fragment key={`conn-rb-rf-${i}`}>
                  <div style={{
                    position: 'absolute',
                    left: leftStart,
                    top: midY,
                    width: CONNECTOR_WIDTH,
                    borderTop: '1px solid #888'
                  }} />
                </React.Fragment>
              );
            })}

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
            {(() => {
              const midY = sectionalPos + totalHeight / 2;
              const leftStart = TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2;
              return (
                <div style={{
                  position: 'absolute',
                  left: leftStart,
                  top: midY,
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              );
            })()}

            {/* Sectional Final - Region B */}
            <div style={{ 
              position: 'absolute', 
              top: sectionalPos - TEAM_HEIGHT / 2 + totalHeight / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
            }}>
              <TeamSlot team={regionBWinner} prob={regionBWinner?.SectionalFinalist} />
            </div>

            {/* Connector Sectional -> State Qualifier */}
            {(() => {
              const midY = totalHeight / 2;
              const leftStart = TEAM_WIDTH * 4 + CONNECTOR_WIDTH * 3;
              return (
                <div style={{
                  position: 'absolute',
                  left: leftStart,
                  top: midY,
                  width: CONNECTOR_WIDTH,
                  borderTop: '1px solid #888'
                }} />
              );
            })()}

            {/* State Qualifier */}
            <div style={{ 
              position: 'absolute', 
              top: totalHeight / 2 - TEAM_HEIGHT / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4
            }}>
              <TeamSlot team={stateQualifier} prob={stateQualifier?.StateQualifier} />
            </div>

          </div>
        </div>
      </div>
    );
  };

  // Get state qualifiers
  const getStateQualifiers = () => {
    return [
      { sectional: 'Sectional 1', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '1A' || t.Region === '1B'), 'StateQualifier') },
      { sectional: 'Sectional 2', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '2A' || t.Region === '2B'), 'StateQualifier') },
      { sectional: 'Sectional 3', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '3A' || t.Region === '3B'), 'StateQualifier') },
      { sectional: 'Sectional 4', winner: getProjectedWinner(divisionTeams.filter(t => t.Region === '4A' || t.Region === '4B'), 'StateQualifier') },
    ];
  };

  const stateQualifiers = getStateQualifiers();
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

      {renderSectional('Sectional 1', '1A', '1B')}
      {renderSectional('Sectional 2', '2A', '2B')}
      {renderSectional('Sectional 3', '3A', '3B')}
      {renderSectional('Sectional 4', '4A', '4B')}

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
                  <TeamSlot team={winner} prob={winner?.StateQualifier} style={{ width: 200 }} />
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
                  <TeamSlot team={winner} prob={winner?.StateQualifier} style={{ width: 200 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
