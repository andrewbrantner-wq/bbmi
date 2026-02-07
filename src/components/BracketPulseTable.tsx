"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import seedingData from "@/data/seeding/seeding.json";

type Team = {
  name: string;
  seed: number;
  region: string;
  roundOf32: number;
  sweet16: number;
  elite8: number;
  final4: number;
  championship: number;
  winTitle: number;
};

function fmtPct(v: number | undefined) {
  if (v == null) return "";
  if (v > 0 && v <= 1) return `${(v * 100).toFixed(1)}%`;
  if (v > 1 && v <= 100) return `${v.toFixed(1)}%`;
  return "";
}

export default function TournamentBracket() {
  const teams: Team[] = useMemo(() => {
    if (!Array.isArray(seedingData)) return [];
    return seedingData.map((r: any) => ({
      name: String(r.Team ?? r.team ?? ""),
      seed: Number(r.CurrentSeed ?? r.currentSeed ?? r.Seed ?? 0),
      region: String(r.Region ?? r.region ?? ""),
      roundOf32: Number(r.RoundOf32Pct ?? r.roundOf32Pct ?? 0),
      sweet16: r.Sweet16Pct ?? r.sweet16Pct ?? r.R16 ?? 0,
      elite8: r.Elite8Pct ?? r.elite8Pct ?? r.R8 ?? 0,
      final4: r.FinalFourPct ?? r.finalFourPct ?? r.R4 ?? 0,
      championship: r.ChampionshipPct ?? r.championshipPct ?? r.Final ?? 0,
      winTitle: r.WinTitlePct ?? r.winTitlePct ?? r.WinPct ?? 0,
    }));
  }, []);

  const regions = useMemo(() => {
    const regionMap: { [key: string]: Team[] } = {};
    teams.forEach((team) => {
      if (!regionMap[team.region]) {
        regionMap[team.region] = [];
      }
      regionMap[team.region].push(team);
    });
    Object.keys(regionMap).forEach((region) => {
      regionMap[region].sort((a, b) => a.seed - b.seed);
    });
    return regionMap;
  }, [teams]);

  const matchups = [
    [1, 16], [8, 9],
    [5, 12], [4, 13],
    [6, 11], [3, 14],
    [7, 10], [2, 15]
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
    // Show placeholder for missing team with seed number
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
          href={`/ncaa-team/${encodeURIComponent(team.name)}`}
          className="hover:underline cursor-pointer flex-1"
          style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <NCAALogo teamName={team.name} size={16} />
          <div>
            <strong style={{ marginRight: 2 }}>{team.seed}</strong>
            {team.name}
          </div>
        </Link>
        {showProb && prob !== undefined && prob > 0 && (
          <span style={{ color: '#555', fontSize: 12 }}>{fmtPct(prob)}</span>
        )}
      </div>
    );
  };

  const renderRegion = (regionName: string, regionTeams: Team[]) => {
    const getTeamBySeed = (seed: number) => regionTeams.find(t => t.seed === seed);

    // Calculate winners for each round
    const r32Winners = matchups.map(([seed1, seed2]) => {
      const team1 = getTeamBySeed(seed1);
      const team2 = getTeamBySeed(seed2);
      if (team1 && team2) {
        return getProjectedWinner([team1, team2], 'roundOf32');
      }
      return team1 || team2;
    });

    const s16Winners = [
      getProjectedWinner([r32Winners[0], r32Winners[1]].filter(Boolean) as Team[], 'sweet16'),
      getProjectedWinner([r32Winners[2], r32Winners[3]].filter(Boolean) as Team[], 'sweet16'),
      getProjectedWinner([r32Winners[4], r32Winners[5]].filter(Boolean) as Team[], 'sweet16'),
      getProjectedWinner([r32Winners[6], r32Winners[7]].filter(Boolean) as Team[], 'sweet16'),
    ];

    const e8Winners = [
      getProjectedWinner([s16Winners[0], s16Winners[1]].filter(Boolean) as Team[], 'elite8'),
      getProjectedWinner([s16Winners[2], s16Winners[3]].filter(Boolean) as Team[], 'elite8'),
    ];

    const regionWinner = getProjectedWinner(e8Winners.filter(Boolean) as Team[], 'final4');

    // Position calculations
    const r64Positions = Array.from({ length: 16 }, (_, i) => i * TEAM_HEIGHT);
    const r32Positions = matchups.map((_, i) => r64Positions[i * 2] + TEAM_HEIGHT / 2);
    const s16Positions = [0, 1, 2, 3].map(i => (r32Positions[i * 2] + r32Positions[i * 2 + 1]) / 2);
    const e8Positions = [0, 1].map(i => (s16Positions[i * 2] + s16Positions[i * 2 + 1]) / 2);
    const f4Position = (e8Positions[0] + e8Positions[1]) / 2;

    const totalHeight = 16 * TEAM_HEIGHT;

    return (
      <div className="mb-10 overflow-hidden border border-stone-300 rounded-lg shadow-lg">
        {/* Region Header */}
        <div style={{ 
          background: 'hsl(210 30% 12%)',
          color: 'white',
          textAlign: 'center',
          padding: '12px 16px',
          fontSize: 20,
          fontWeight: 600
        }}>
          {regionName} Region
        </div>
        
        {/* Column Headers */}
        <div style={{ 
          display: 'flex', 
          background: 'hsl(210 30% 18%)',
          color: 'white',
          fontSize: 14,
          fontWeight: 600
        }}>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Round of 64</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Round of 32</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Sweet 16</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0' }}>Elite 8</div>
          <div style={{ width: CONNECTOR_WIDTH }}></div>
          <div style={{ width: TEAM_WIDTH, textAlign: 'center', padding: '8px 0', background: 'hsl(210 30% 25%)' }}>Final Four</div>
        </div>

        {/* Bracket Content */}
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
            
            {/* Round of 64 */}
            {matchups.flatMap(([seed1, seed2], matchupIdx) => {
              const team1 = getTeamBySeed(seed1);
              const team2 = getTeamBySeed(seed2);
              const idx1 = matchupIdx * 2;
              const idx2 = matchupIdx * 2 + 1;
              return [
                <div key={`r64-${idx1}`} style={{ position: 'absolute', top: r64Positions[idx1], left: 0 }}>
                  <TeamSlot team={team1} seed={seed1} showProb={false} />
                </div>,
                <div key={`r64-${idx2}`} style={{ position: 'absolute', top: r64Positions[idx2], left: 0 }}>
                  <TeamSlot team={team2} seed={seed2} showProb={false} />
                </div>
              ];
            })}

            {/* Connectors R64 -> R32 - simplified horizontal lines only */}
            {matchups.map((_, i) => {
              const top1 = r64Positions[i * 2] + TEAM_HEIGHT - 1;
              const top2 = r64Positions[i * 2 + 1];
              const midY = r32Positions[i];
              return (
                <React.Fragment key={`conn-r64-${i}`}>
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

            {/* Round of 32 */}
            {r32Winners.map((winner, i) => (
              <div key={`r32-${i}`} style={{ 
                position: 'absolute', 
                top: r32Positions[i] - TEAM_HEIGHT / 2, 
                left: TEAM_WIDTH + CONNECTOR_WIDTH 
              }}>
                <TeamSlot team={winner} prob={winner?.roundOf32} />
              </div>
            ))}

            {/* Connectors R32 -> S16 */}
            {[0, 1, 2, 3].map((i) => {
              const midY = s16Positions[i];
              const leftStart = TEAM_WIDTH * 2 + CONNECTOR_WIDTH;
              return (
                <React.Fragment key={`conn-r32-${i}`}>
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

            {/* Sweet 16 */}
            {s16Winners.map((winner, i) => (
              <div key={`s16-${i}`} style={{ 
                position: 'absolute', 
                top: s16Positions[i] - TEAM_HEIGHT / 2, 
                left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 2
              }}>
                <TeamSlot team={winner} prob={winner?.sweet16} />
              </div>
            ))}

            {/* Connectors S16 -> E8 */}
            {[0, 1].map((i) => {
              const midY = e8Positions[i];
              const leftStart = TEAM_WIDTH * 3 + CONNECTOR_WIDTH * 2;
              return (
                <React.Fragment key={`conn-s16-${i}`}>
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

            {/* Elite 8 */}
            {e8Winners.map((winner, i) => (
              <div key={`e8-${i}`} style={{ 
                position: 'absolute', 
                top: e8Positions[i] - TEAM_HEIGHT / 2, 
                left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 3
              }}>
                <TeamSlot team={winner} prob={winner?.elite8} />
              </div>
            ))}

            {/* Connector E8 -> F4 */}
            {(() => {
              const midY = f4Position;
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

            {/* Final Four */}
            <div style={{ 
              position: 'absolute', 
              top: f4Position - TEAM_HEIGHT / 2, 
              left: (TEAM_WIDTH + CONNECTOR_WIDTH) * 4
            }}>
              <TeamSlot team={regionWinner} prob={regionWinner?.final4} />
            </div>

          </div>
        </div>
      </div>
    );
  };

  // Final Four summary
  const getFinal4Teams = () => {
    return Object.keys(regions).sort().map(regionName => {
      const regionTeams = regions[regionName];
      const getTeamBySeed = (seed: number) => regionTeams.find(t => t.seed === seed);
      
      const r32Winners = matchups.map(([seed1, seed2]) => {
        const team1 = getTeamBySeed(seed1);
        const team2 = getTeamBySeed(seed2);
        if (team1 && team2) {
          return getProjectedWinner([team1, team2], 'roundOf32');
        }
        return team1 || team2;
      });

      const s16Winners = [
        getProjectedWinner([r32Winners[0], r32Winners[1]].filter(Boolean) as Team[], 'sweet16'),
        getProjectedWinner([r32Winners[2], r32Winners[3]].filter(Boolean) as Team[], 'sweet16'),
        getProjectedWinner([r32Winners[4], r32Winners[5]].filter(Boolean) as Team[], 'sweet16'),
        getProjectedWinner([r32Winners[6], r32Winners[7]].filter(Boolean) as Team[], 'sweet16'),
      ];

      const e8Winners = [
        getProjectedWinner([s16Winners[0], s16Winners[1]].filter(Boolean) as Team[], 'elite8'),
        getProjectedWinner([s16Winners[2], s16Winners[3]].filter(Boolean) as Team[], 'elite8'),
      ];

      return {
        region: regionName,
        winner: getProjectedWinner(e8Winners.filter(Boolean) as Team[], 'final4')
      };
    });
  };

  const final4Teams = getFinal4Teams();
  const allTeams = Object.values(regions).flat();
  const champion = allTeams.length > 0 ? allTeams.reduce((best, current) => {
    const bestProb = typeof best.winTitle === 'number' ? best.winTitle : 0;
    const currentProb = typeof current.winTitle === 'number' ? current.winTitle : 0;
    return currentProb > bestProb ? current : best;
  }) : null;

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* Methodology Note */}
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

      {Object.keys(regions).sort().map((regionName) => (
        <div key={regionName}>
          {renderRegion(regionName, regions[regionName])}
        </div>
      ))}

      {/* Final Four Summary */}
      <div className="overflow-hidden border border-stone-300 rounded-lg shadow-lg">
        <div style={{ 
          background: 'hsl(210 30% 12%)',
          color: 'white',
          textAlign: 'center',
          padding: '12px 16px',
          fontSize: 20,
          fontWeight: 600
        }}>
          Final Four & Championship
        </div>
        
        <div style={{ background: 'white', padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {final4Teams.slice(0, 2).map(({ region, winner }) => (
                <div key={region} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{region}</div>
                  <TeamSlot team={winner} prob={winner?.final4} style={{ width: 200 }} />
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
                    href={`/ncaa-team/${encodeURIComponent(champion.name)}`}
                    className="hover:underline cursor-pointer flex-1"
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <NCAALogo teamName={champion.name} size={20} />
                    <div>
                      <strong style={{ marginRight: 4 }}>{champion.seed}</strong>{champion.name}
                    </div>
                  </Link>
                  <span style={{ color: '#b45309', fontWeight: 700 }}>{fmtPct(champion.winTitle)}</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {final4Teams.slice(2, 4).map(({ region, winner }) => (
                <div key={region} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 4 }}>{region}</div>
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
