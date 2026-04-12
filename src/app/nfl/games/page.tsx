"use client";

import { useMemo } from "react";
import Link from "next/link";
import NFLLogo from "@/components/NFLLogo";
import gamesData from "@/data/betting-lines/nfl-games.json";

const ACCENT = "#013369";

type NFLGame = {
  gameId: string;
  season: number;
  week: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeRating: number;
  awayRating: number;
  homeRank: number;
  awayRank: number;
  homeRecord: string;
  awayRecord: string;
  vegasSpread: number | null;
  vegasTotal: number | null;
  homeOffEpa: number;
  homeDefEpa: number;
  awayOffEpa: number;
  awayDefEpa: number;
  keyEdge: string;
  gameInsights?: string[];
  weather: { indoor: boolean; tempF?: number; windMph?: number; condition?: string };
  homeWinPct?: number;
  awayWinPct?: number;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  positionMatchups?: { offense: string; offGrade: string; offRank: number; defense: string; defGrade: string; defRank: number; text: string; gap: number }[];
  homeInjuries?: { player: string; position: string; status: string; injury: string; isKeyPlayer?: boolean; practiceStatus?: string }[];
  awayInjuries?: { player: string; position: string; status: string; injury: string; isKeyPlayer?: boolean; practiceStatus?: string }[];
};

const allGames = gamesData as NFLGame[];

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return n + "th";
  switch (n % 10) {
    case 1: return n + "st";
    case 2: return n + "nd";
    case 3: return n + "rd";
    default: return n + "th";
  }
}

function ratingBadge(rating: number) {
  const color = rating > 3 ? "#15803d" : rating > 0 ? "#65a30d" : rating > -3 ? "#d97706" : "#dc2626";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color }}>
      {rating > 0 ? "+" : ""}{rating.toFixed(1)}
    </span>
  );
}

function GamesContent() {

  const currentWeek = allGames.length > 0 ? allGames[0].week : 0;
  const hasData = allGames.length > 0;

  // Sort: highest combined rating first (best matchups up top)
  const sorted = useMemo(() =>
    [...allGames].sort((a, b) => (b.homeRating + b.awayRating) - (a.homeRating + a.awayRating)),
  []);

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#f0efe9" }}>
      <div className="w-full max-w-[900px] mx-auto px-6 py-8">

        <div style={{ textAlign: "center", borderBottom: "1px solid #d4d2cc", paddingBottom: 20, marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: ACCENT, color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 600, marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#fff", display: "inline-block" }} />
            NFL Analytics {"\u00B7"} Weekly Preview
          </div>
          <h1 style={{ fontSize: "1.625rem", fontWeight: 500, letterSpacing: "-0.025em", color: "#1a1a1a", margin: "0 0 8px" }}>
            {hasData ? `Week ${currentWeek} Games` : "This Week's Games"}
          </h1>
          <p style={{ fontSize: "0.8rem", color: "#78716c", margin: 0 }}>
            Matchup analytics and team ratings {"\u2014"} not picks
          </p>
        </div>

        {!hasData ? (
          <div style={{ background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12, padding: "3rem 2rem", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{"\uD83C\uDFC8"}</div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>Games Available During Season</h2>
            <p style={{ color: "#78716c", fontSize: "0.85rem" }}>Weekly game previews will appear once the 2026 NFL season begins.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {sorted.map(g => {
              const completed = g.actualHomeScore != null;
              return (
                <div key={g.gameId} style={{
                  background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12,
                  overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  opacity: completed ? 0.7 : 1,
                }}>
                  {/* Teams row */}
                  <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 12 }}>
                    {/* Away */}
                    <div style={{ flex: 1 }}>
                      <Link href={`/nfl/teams/${g.awayTeam}`} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#1c1917" }} className="hover:underline">
                        <NFLLogo team={g.awayTeam} size={32} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.awayTeam}</div>
                          <div style={{ fontSize: 11, color: "#78716c" }}>{g.awayRecord}</div>
                        </div>
                      </Link>
                      {(
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginLeft: 40 }}>
                          {ordinal(g.awayRank)} {"\u00B7"} {ratingBadge(g.awayRating)}
                        </div>
                      )}
                    </div>

                    {/* @ */}
                    <div style={{ fontSize: 14, color: "#9ca3af", fontWeight: 600 }}>@</div>

                    {/* Home */}
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <Link href={`/nfl/teams/${g.homeTeam}`} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", textDecoration: "none", color: "#1c1917" }} className="hover:underline">
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{g.homeTeam}</div>
                          <div style={{ fontSize: 11, color: "#78716c" }}>{g.homeRecord}</div>
                        </div>
                        <NFLLogo team={g.homeTeam} size={32} />
                      </Link>
                      {(
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4, marginRight: 40 }}>
                          {ratingBadge(g.homeRating)} {"\u00B7"} {ordinal(g.homeRank)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Win probability bar */}
                  {g.homeWinPct != null && g.awayWinPct != null && (
                    <div style={{ padding: "6px 20px 8px", borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: g.awayWinPct > 50 ? ACCENT : "#9ca3af" }}>{g.awayTeam} {g.awayWinPct.toFixed(0)}%</span>
                        <span style={{ fontSize: 9, color: "#9ca3af" }}>Win Probability</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: g.homeWinPct > 50 ? ACCENT : "#9ca3af" }}>{g.homeWinPct.toFixed(0)}% {g.homeTeam}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, backgroundColor: "#e5e7eb", overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${g.awayWinPct}%`, height: "100%", backgroundColor: g.awayWinPct > 50 ? ACCENT : "#9ca3af", borderRadius: "4px 0 0 4px" }} />
                        <div style={{ width: `${g.homeWinPct}%`, height: "100%", backgroundColor: g.homeWinPct > 50 ? ACCENT : "#9ca3af", borderRadius: "0 4px 4px 0" }} />
                      </div>
                    </div>
                  )}

                  {/* Game insights + position matchups */}
                  {((g.gameInsights && g.gameInsights.length > 0) || (g.positionMatchups && g.positionMatchups.length > 0)) && (
                    <div style={{ padding: "8px 20px 10px", borderTop: "1px solid #f3f4f6" }}>
                      {g.gameInsights && g.gameInsights.length > 0 && (
                        <div style={{ marginBottom: g.positionMatchups?.length ? 8 : 0 }}>
                          {g.gameInsights.map((insight, idx) => (
                            <div key={idx} style={{ fontSize: 12, color: "#57534e", lineHeight: 1.6, marginBottom: 3 }}>
                              <span style={{ color: ACCENT, marginRight: 4 }}>{idx === 0 ? "\u25C6" : "\u25CB"}</span>
                              {insight}
                            </div>
                          ))}
                        </div>
                      )}
                      {g.positionMatchups && g.positionMatchups.length > 0 && (
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {g.positionMatchups.map((m, mi) => {
                            const advantage = m.gap > 0;
                            return (
                              <div key={mi} style={{ fontSize: 10, color: "#57534e", display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontWeight: 700, color: advantage ? "#15803d" : "#dc2626" }}>{m.offGrade}</span>
                                <span>{m.offense}</span>
                                <span style={{ color: "#9ca3af" }}>vs</span>
                                <span>{m.defense}</span>
                                <span style={{ fontWeight: 700, color: !advantage ? "#15803d" : "#dc2626" }}>{m.defGrade}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Injuries */}
                  {((g.homeInjuries && g.homeInjuries.length > 0) || (g.awayInjuries && g.awayInjuries.length > 0)) && (
                    <div style={{ padding: "6px 20px 8px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 20, flexWrap: "wrap" }}>
                      {g.awayInjuries && g.awayInjuries.length > 0 && (
                        <div style={{ flex: "1 1 200px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                            {g.awayTeam} Injuries
                          </div>
                          {g.awayInjuries.slice(0, 4).map((inj, j) => (
                            <div key={j} style={{ fontSize: 10, color: "#57534e", lineHeight: 1.5 }}>
                              <strong style={{ color: inj.isKeyPlayer ? "#1c1917" : "#57534e" }}>{inj.isKeyPlayer ? "\u2605 " : ""}{inj.player}</strong>{" "}
                              <span style={{ color: "#9ca3af" }}>{inj.position}</span> {"\u2014"}{" "}
                              <span style={{ color: inj.status === "Out" ? "#dc2626" : inj.status === "Doubtful" ? "#dc2626" : "#d97706", fontWeight: 600 }}>{inj.status}</span>
                              {inj.injury && <span style={{ color: "#9ca3af" }}> ({inj.injury})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                      {g.homeInjuries && g.homeInjuries.length > 0 && (
                        <div style={{ flex: "1 1 200px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                            {g.homeTeam} Injuries
                          </div>
                          {g.homeInjuries.slice(0, 4).map((inj, j) => (
                            <div key={j} style={{ fontSize: 10, color: "#57534e", lineHeight: 1.5 }}>
                              <strong style={{ color: inj.isKeyPlayer ? "#1c1917" : "#57534e" }}>{inj.isKeyPlayer ? "\u2605 " : ""}{inj.player}</strong>{" "}
                              <span style={{ color: "#9ca3af" }}>{inj.position}</span> {"\u2014"}{" "}
                              <span style={{ color: inj.status === "Out" ? "#dc2626" : inj.status === "Doubtful" ? "#dc2626" : "#d97706", fontWeight: 600 }}>{inj.status}</span>
                              {inj.injury && <span style={{ color: "#9ca3af" }}> ({inj.injury})</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom bar */}
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 20px", backgroundColor: "#f9fafb", borderTop: "1px solid #f3f4f6",
                    fontSize: 11, color: "#78716c",
                  }}>
                    <div>
                      {g.vegasSpread != null && (
                        <span>Spread: <strong style={{ color: "#57534e" }}>{g.vegasSpread > 0 ? `${g.homeTeam} +${g.vegasSpread}` : `${g.homeTeam} ${g.vegasSpread}`}</strong></span>
                      )}
                      {g.vegasTotal != null && (
                        <span style={{ marginLeft: 16 }}>Total: <strong style={{ color: "#57534e" }}>{g.vegasTotal}</strong></span>
                      )}
                    </div>
                    <div>
                      {g.weather.indoor ? (
                        <span>Indoor</span>
                      ) : g.weather.tempF != null ? (
                        <span>{Math.round(g.weather.tempF)}{"\u00B0"}F{g.weather.windMph ? ` ${Math.round(g.weather.windMph)}mph` : ""}</span>
                      ) : null}
                      {completed && (
                        <span style={{ marginLeft: 12, fontWeight: 700, color: "#1c1917" }}>
                          Final: {g.actualAwayScore}-{g.actualHomeScore}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ fontSize: "0.68rem", color: "#9ca3af", textAlign: "center", lineHeight: 1.6, marginTop: "2rem" }}>
          Vegas lines shown for context only {"\u2014"} BBMI does not make NFL betting recommendations.{" "}
          <Link href="/nfl/methodology" style={{ color: ACCENT }}>Learn why</Link>
        </div>
      </div>
    </div>
  );
}

export default function NFLGamesPage() {
  return <GamesContent />;
}
