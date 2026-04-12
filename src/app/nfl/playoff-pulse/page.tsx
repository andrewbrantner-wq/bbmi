"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import seasonData from "@/data/nfl-season.json";
import rankingsData from "@/data/rankings/nfl-rankings.json";

const ACCENT = "#013369";

type TeamStanding = {
  team: string; teamName: string; wins: number; losses: number;
  pct: number; bbmiRating: number; playoffPct: number; projectedWins: number;
};

type TeamRanking = {
  team: string; teamName: string; record: string; bbmiRating: number;
  rank: number; elo: number; playoffPct: number; divisionWinPct: number;
  projectedWins: number; conference: string; division: string;
  vsVegas: number; preseasonWinTotal: number;
};

type PlayoffGame = { home: string; away: string; homeScore: number; awayScore: number };
type ConfBracket = {
  champion: string;
  confChampionship: PlayoffGame;
  divisional: PlayoffGame[];
  wildCard: PlayoffGame[];
};
type PlayoffBracket = {
  champion: string; championName: string;
  superBowl: PlayoffGame;
  afc: ConfBracket; nfc: ConfBracket;
};

type SeasonData = {
  season: number; week: number;
  standings: Record<string, Record<string, TeamStanding[]>>;
  storylines: { type: string; text: string }[];
  playoffBracket?: PlayoffBracket | null;
};

const season = seasonData as SeasonData;
const rankings = (rankingsData as { teams: TeamRanking[] }).teams;

function playoffColor(pct: number) {
  if (pct >= 95) return { bg: "#fefce8", text: "#92400e", label: "Clinched" };
  if (pct >= 75) return { bg: "#f0fdf4", text: "#166534", label: "Likely" };
  if (pct >= 50) return { bg: "#f0fdf4", text: "#15803d", label: "In position" };
  if (pct >= 25) return { bg: "#fffbeb", text: "#d97706", label: "Bubble" };
  if (pct >= 5) return { bg: "#fef2f2", text: "#dc2626", label: "Long shot" };
  return { bg: "#fef2f2", text: "#991b1b", label: "Eliminated" };
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
  switch (n % 10) {
    case 1: return n + "st"; case 2: return n + "nd"; case 3: return n + "rd";
    default: return n + "th";
  }
}

type SortKey = "playoffPct" | "projectedWins" | "divisionWinPct" | "record" | "bbmiRating";

function parseWinPct(record: string): number {
  const parts = record.split("-").map(Number);
  const w = parts[0] || 0;
  const l = parts[1] || 0;
  const t = parts[2] || 0;
  const total = w + l + t;
  return total > 0 ? (w + t * 0.5) / total : 0;
}

export default function PlayoffPulsePage() {
  const [confFilter, setConfFilter] = useState<"ALL" | "AFC" | "NFC">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("playoffPct");

  const hasData = rankings.length > 0 && season.week > 0;

  const filtered = useMemo(() => {
    let teams = [...rankings];
    if (confFilter !== "ALL") teams = teams.filter(t => t.conference === confFilter);
    teams.sort((a, b) => {
      if (sortKey === "record") {
        return parseWinPct(b.record) - parseWinPct(a.record);
      }
      return (b[sortKey] as number) - (a[sortKey] as number);
    });
    return teams;
  }, [confFilter, sortKey]);

  // Compute seeds per conference
  const seeds = useMemo(() => {
    const result: Record<string, TeamRanking[]> = { AFC: [], NFC: [] };
    for (const conf of ["AFC", "NFC"]) {
      const confTeams = rankings.filter(t => t.conference === conf);
      const divisions = ["East", "North", "South", "West"];

      // Division winners (1-4 seeds)
      const divWinners: TeamRanking[] = [];
      for (const div of divisions) {
        const divTeams = confTeams.filter(t => t.division === div);
        divTeams.sort((a, b) => parseWinPct(b.record) - parseWinPct(a.record));
        if (divTeams[0]) divWinners.push(divTeams[0]);
      }
      divWinners.sort((a, b) => parseWinPct(b.record) - parseWinPct(a.record));

      // Wild cards (5-7 seeds)
      const divWinnerTeams = new Set(divWinners.map(t => t.team));
      const wildcards = confTeams
        .filter(t => !divWinnerTeams.has(t.team))
        .sort((a, b) => parseWinPct(b.record) - parseWinPct(a.record))
        .slice(0, 3);

      result[conf] = [...divWinners, ...wildcards];
    }
    return result;
  }, []);

  const TH: React.CSSProperties = {
    backgroundColor: ACCENT, color: "#fff", padding: "8px 10px",
    fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", textAlign: "center", cursor: "pointer",
    userSelect: "none",
  };
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #ece9e2", fontSize: 12, verticalAlign: "middle" };
  const TD_N: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[1100px] mx-auto px-6 py-8">

        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: ACCENT, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NFL Analytics {"\u00B7"} Playoff Pulse
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
            Playoff Pulse
          </h1>
          <p style={{ fontSize: "0.8rem", color: "#78716c", margin: 0 }}>
            Monte Carlo playoff projections {"\u00B7"} Week {season.week} {"\u00B7"} {season.season} Season
          </p>
        </div>

        {!hasData ? (
          <div style={{ background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12, padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\uD83C\uDFC8"}</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>Playoff Pulse Available Week 4</h2>
            <p style={{ color: "#78716c", fontSize: "0.85rem" }}>Projections update weekly once the 2026 NFL season begins.</p>
          </div>
        ) : (
          <>
            {/* Current Bracket Seeds */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              {["AFC", "NFC"].map(conf => (
                <div key={conf} style={{ flex: "1 1 400px", background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ backgroundColor: ACCENT, color: "#fff", padding: "8px 14px", fontSize: 12, fontWeight: 700 }}>
                    {conf} Playoff Picture
                  </div>
                  <div style={{ padding: "8px 0" }}>
                    {(seeds[conf] || []).map((t, i) => {
                      const isDivWinner = i < 4;
                      const pc = playoffColor(t.playoffPct);
                      return (
                        <div key={t.team} style={{
                          display: "flex", alignItems: "center", gap: 8, padding: "6px 14px",
                          backgroundColor: i === 0 ? "#fefce8" : isDivWinner ? "#f0fdf4" : i < 7 ? "#f9fafb" : "transparent",
                          borderTop: i === 4 ? "2px dashed #d4d2cc" : undefined,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 16 }}>{i + 1}</span>
                          <NFLLogo team={t.team} size={20} />
                          <Link href={`/nfl/teams/${t.team}`} style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1c1917", textDecoration: "none" }} className="hover:underline">
                            {t.teamName}
                          </Link>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#57534e" }}>{t.record}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                            backgroundColor: pc.bg, color: pc.text,
                          }}>
                            {t.playoffPct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                    {/* Bubble teams */}
                    {(() => {
                      const inSeeds = new Set((seeds[conf] || []).map(t => t.team));
                      const bubble = rankings
                        .filter(t => t.conference === conf && !inSeeds.has(t.team) && t.playoffPct > 0)
                        .sort((a, b) => b.playoffPct - a.playoffPct)
                        .slice(0, 3);
                      if (bubble.length === 0) return null;
                      return (
                        <>
                          <div style={{ padding: "4px 14px", fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", borderTop: "1px solid #e5e7eb", marginTop: 4 }}>
                            On the outside
                          </div>
                          {bubble.map(t => (
                            <div key={t.team} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px", opacity: 0.6 }}>
                              <span style={{ width: 16 }} />
                              <NFLLogo team={t.team} size={18} />
                              <span style={{ flex: 1, fontSize: 11, color: "#78716c" }}>{t.teamName}</span>
                              <span style={{ fontSize: 11, color: "#78716c" }}>{t.record}</span>
                              <span style={{ fontSize: 10, color: "#dc2626" }}>{t.playoffPct.toFixed(0)}%</span>
                            </div>
                          ))}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {/* Playoff Bracket */}
            {(() => {
              const bracket = season.playoffBracket;

              function GameResult({ game, round }: { game: PlayoffGame; round: string }) {
                const homeWon = game.homeScore > game.awayScore;
                return (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", backgroundColor: homeWon ? "#f0fdf4" : "#fff" }}>
                      <NFLLogo team={game.home} size={14} />
                      <span style={{ fontSize: 10, fontWeight: homeWon ? 800 : 500, flex: 1, color: homeWon ? "#15803d" : "#78716c" }}>{game.home}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: homeWon ? "#15803d" : "#78716c" }}>{game.homeScore}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", backgroundColor: !homeWon ? "#f0fdf4" : "#fff" }}>
                      <NFLLogo team={game.away} size={14} />
                      <span style={{ fontSize: 10, fontWeight: !homeWon ? 800 : 500, flex: 1, color: !homeWon ? "#15803d" : "#78716c" }}>{game.away}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: !homeWon ? "#15803d" : "#78716c" }}>{game.awayScore}</span>
                    </div>
                  </div>
                );
              }

              if (bracket) {
                // Actual completed bracket
                return (
                  <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10, padding: "16px", marginBottom: 24, overflowX: "auto" }}>
                    {/* Champion banner */}
                    <div style={{ textAlign: "center", marginBottom: 16, padding: "12px", backgroundColor: "#fefce8", borderRadius: 8, border: "1px solid #fde68a" }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{"\uD83C\uDFC6"}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <NFLLogo team={bracket.champion} size={32} />
                        <span style={{ fontSize: 18, fontWeight: 900, color: "#92400e" }}>{bracket.championName}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>
                        Super Bowl Champions {"\u00B7"} {bracket.superBowl.home} {bracket.superBowl.homeScore}, {bracket.superBowl.away} {bracket.superBowl.awayScore}
                      </div>
                    </div>

                    {/* Conference brackets */}
                    {(["afc", "nfc"] as const).map(confKey => {
                      const cb = bracket[confKey];
                      const confLabel = confKey.toUpperCase();
                      return (
                        <div key={confKey} style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                            {confLabel} Bracket {"\u00B7"} Champion: <span style={{ color: "#15803d" }}>{cb.champion}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "nowrap", minWidth: 600 }}>
                            {/* Wild Card */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 155 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>Wild Card</div>
                              {cb.wildCard.map((g, i) => <GameResult key={i} game={g} round="WC" />)}
                            </div>

                            <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>

                            {/* Divisional */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 155 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>Divisional</div>
                              {cb.divisional.map((g, i) => <GameResult key={i} game={g} round="DIV" />)}
                            </div>

                            <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>

                            {/* Conference Championship */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 155 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>{confLabel} Championship</div>
                              <GameResult game={cb.confChampionship} round="CONF" />
                            </div>

                            {confKey === "afc" && (
                              <>
                                <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 155 }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: "#d97706", textTransform: "uppercase", textAlign: "center" }}>Super Bowl</div>
                                  <GameResult game={bracket.superBowl} round="SB" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Projected bracket (during season, no results yet)
              return (
                <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 10, padding: "16px", marginBottom: 24, overflowX: "auto" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 12, textAlign: "center" }}>
                    Projected Playoff Bracket
                  </div>
                  {["AFC", "NFC"].map(conf => {
                    const s = seeds[conf] || [];
                    if (s.length < 7) return null;
                    const wc = [
                      { higher: s[1], lower: s[6] },
                      { higher: s[2], lower: s[5] },
                      { higher: s[3], lower: s[4] },
                    ];
                    return (
                      <div key={conf} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          {conf} Bracket
                        </div>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "nowrap", minWidth: 600 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 130 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>Bye (1 seed)</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", backgroundColor: "#fefce8", borderRadius: 6, border: "1px solid #fde68a" }}>
                              <NFLLogo team={s[0].team} size={18} />
                              <span style={{ fontSize: 11, fontWeight: 700, flex: 1 }}>{s[0].team}</span>
                              <span style={{ fontSize: 10, color: "#78716c" }}>{s[0].record}</span>
                            </div>
                          </div>
                          <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 155 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>Wild Card</div>
                            {wc.map((m, mi) => (
                              <div key={mi} style={{ border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px", backgroundColor: "#f9fafb" }}>
                                  <NFLLogo team={m.higher.team} size={14} />
                                  <span style={{ fontSize: 10, fontWeight: 700, flex: 1 }}>{m.higher.team}</span>
                                  <span style={{ fontSize: 9, color: "#78716c" }}>{m.higher.record}</span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 6px" }}>
                                  <NFLLogo team={m.lower.team} size={14} />
                                  <span style={{ fontSize: 10, fontWeight: 600, flex: 1, color: "#78716c" }}>{m.lower.team}</span>
                                  <span style={{ fontSize: 9, color: "#9ca3af" }}>{m.lower.record}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 130 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>Divisional</div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px", backgroundColor: "#f9fafb", textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: "#78716c" }}>TBD</div>
                            </div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px", backgroundColor: "#f9fafb", textAlign: "center" }}>
                              <div style={{ fontSize: 10, color: "#78716c" }}>TBD</div>
                            </div>
                          </div>
                          <div style={{ color: "#d4d2cc", fontSize: 16, alignSelf: "center" }}>{"\u25B6"}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 120 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: "center" }}>{conf} Championship</div>
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "12px 8px", backgroundColor: "#f0fdf4", textAlign: "center" }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d" }}>TBD</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Full Table */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
              {(["ALL", "AFC", "NFC"] as const).map(c => (
                <button key={c} onClick={() => setConfFilter(c)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d4d2cc", backgroundColor: confFilter === c ? ACCENT : "#fff", color: confFilter === c ? "#fff" : "#57534e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", marginBottom: "1.5rem" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, textAlign: "left", minWidth: 180 }}>Team</th>
                      <th style={TH} onClick={() => setSortKey("record")}>Record{sortKey === "record" ? " \u25BC" : ""}</th>
                      <th style={TH} onClick={() => setSortKey("bbmiRating")}>Rating{sortKey === "bbmiRating" ? " \u25BC" : ""}</th>
                      <th style={TH} onClick={() => setSortKey("playoffPct")}>Playoff %{sortKey === "playoffPct" ? " \u25BC" : ""}</th>
                      <th style={TH} onClick={() => setSortKey("divisionWinPct")}>Division %{sortKey === "divisionWinPct" ? " \u25BC" : ""}</th>
                      <th style={TH} onClick={() => setSortKey("projectedWins")}>Proj Rec{sortKey === "projectedWins" ? " \u25BC" : ""}</th>
                      <th style={TH}>vs O/U</th>
                      <th style={TH}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t, i) => {
                      const pc = playoffColor(t.playoffPct);
                      const ratingColor = t.bbmiRating > 3 ? "#15803d" : t.bbmiRating > 0 ? "#65a30d" : t.bbmiRating > -3 ? "#d97706" : "#dc2626";
                      return (
                        <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafaf8" }}>
                          <td style={TD}>
                            <Link href={`/nfl/teams/${t.team}`} style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none", color: "#1c1917" }} className="hover:underline">
                              <NFLLogo team={t.team} size={22} />
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 12 }}>{t.teamName}</span>
                                <span style={{ fontSize: 9, color: "#9ca3af", marginLeft: 4 }}>{t.conference} {t.division}</span>
                              </div>
                            </Link>
                          </td>
                          <td style={{ ...TD_N, fontWeight: 600 }}>{t.record}</td>
                          <td style={{ ...TD_N, fontWeight: 700, color: ratingColor }}>{t.bbmiRating > 0 ? "+" : ""}{t.bbmiRating.toFixed(1)}</td>
                          <td style={{ ...TD_N, fontWeight: 800, fontSize: 14 }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 4,
                              backgroundColor: pc.bg, color: pc.text,
                            }}>
                              {t.playoffPct.toFixed(0)}%
                            </span>
                          </td>
                          <td style={{ ...TD_N, fontWeight: 600 }}>{t.divisionWinPct.toFixed(0)}%</td>
                          <td style={{ ...TD_N, fontWeight: 600 }}>{Math.round(t.projectedWins)}-{17 - Math.round(t.projectedWins)}</td>
                          <td style={{ ...TD_N, color: t.vsVegas > 0 ? "#15803d" : t.vsVegas < 0 ? "#dc2626" : "#78716c", fontWeight: 600 }}>
                            {t.vsVegas > 0 ? "+" : ""}{t.vsVegas.toFixed(1)}
                          </td>
                          <td style={{ ...TD_N, fontSize: 10, fontWeight: 700, color: pc.text }}>{pc.label}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6 }}>
              Projections based on 10,000 Monte Carlo simulations using BBMI Composite Ratings.
              Playoff % reflects probability of reaching the postseason. Division % reflects probability of winning the division title.
              Updated weekly.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
