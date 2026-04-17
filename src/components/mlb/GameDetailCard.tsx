"use client";

import React from "react";
import MLBLogo from "@/components/MLBLogo";
import boxscoreData from "@/data/mlb-boxscores.json";

// ── Types ────────────────────────────────────────────────────
type GameData = {
  date: string;
  gameTimeUTC: string;
  homeTeam: string;
  awayTeam: string;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  bbmiMargin: number | null;
  bbmiTotal: number | null;
  bbmiHomeProj?: number | null;
  bbmiAwayProj?: number | null;
  vegasTotal: number | null;
  vegasRunLine: number | null;
  homeRLJuice?: number | null;
  rlPick: string | null;
  rlConfidenceTier: number;
  ouPick: string | null;
  homePitcher: string;
  awayPitcher: string;
  gameId: string;
};

type PitcherLine = {
  name: string;
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  k: number;
  decision: string | null;
  decisionDetail: string | null;
  isStarter: boolean;
};

type BatterLine = {
  name: string;
  pos: string;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
};

type InningScore = { home: number; away: number };

type BoxScoreEntry = {
  homePitchers: PitcherLine[];
  awayPitchers: PitcherLine[];
  homeTopBatters?: BatterLine[];
  awayTopBatters?: BatterLine[];
  innings?: InningScore[];
  homeHits?: number;
  awayHits?: number;
  homeErrors?: number;
  awayErrors?: number;
};

const allBoxscores = boxscoreData as Record<string, BoxScoreEntry>;

// ── Styling ──────────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: "#f5f3ef", border: "1px solid #d4d2cc", borderRadius: 12,
  padding: "1.25rem", margin: "0 0 2px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
};
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "#78716c", letterSpacing: "0.04em",
  textTransform: "uppercase" as const, marginBottom: 8, paddingTop: 12,
  borderTop: "1px solid #e8e6e0",
};
const LS_TD: React.CSSProperties = {
  padding: "4px 8px", textAlign: "center" as const, fontSize: 12,
  borderBottom: "1px solid #f0efe9", fontFamily: "ui-monospace, monospace",
};
const LS_TH: React.CSSProperties = {
  ...LS_TD, fontWeight: 700, color: "#78716c", fontSize: 10,
  textTransform: "uppercase" as const,
};
const P_TD: React.CSSProperties = {
  padding: "3px 6px", textAlign: "right" as const, fontFamily: "ui-monospace, monospace", fontSize: 11,
};

function formatIP(ip: number): string {
  const full = Math.floor(ip);
  const frac = Math.round((ip - full) * 3);
  return frac === 0 ? `${full}.0` : `${full}.${frac}`;
}

// ── Decision Badge ───────────────────────────────────────────
function DecisionBadge({ decision, detail }: { decision: string; detail?: string | null }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    W: { bg: "#f0fdf4", fg: "#16a34a" },
    L: { bg: "#fef2f2", fg: "#dc2626" },
    SV: { bg: "#eff6ff", fg: "#2563eb" },
    H: { bg: "#fffbeb", fg: "#d97706" },
  };
  const c = colors[decision] ?? { bg: "#f5f5f5", fg: "#666" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 4,
      marginLeft: 6, backgroundColor: c.bg, color: c.fg,
    }}>
      {decision}{detail ? ` ${detail}` : ""}
    </span>
  );
}

function TierDots({ tier }: { tier: number }) {
  if (tier <= 0) return null;
  const isAce = tier === 2 || tier === 4;
  const dots = isAce ? 2 : 1;
  return (
    <span style={{ display: "inline-flex", gap: 2, marginLeft: 4, alignItems: "center" }}>
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#f0c040", display: "inline-block" }} />
      ))}
      {isAce && <span style={{ fontSize: 8, marginLeft: 2, color: "#f0c040", fontWeight: 700 }}>ACE</span>}
    </span>
  );
}

function BattingLine({ b }: { b: BatterLine }) {
  const extras: string[] = [];
  if (b.doubles > 0) extras.push(b.doubles > 1 ? `${b.doubles} 2B` : "2B");
  if (b.triples > 0) extras.push(b.triples > 1 ? `${b.triples} 3B` : "3B");
  if (b.hr > 0) extras.push(b.hr > 1 ? `${b.hr} HR` : "HR");
  if (b.rbi > 0) extras.push(`${b.rbi} RBI`);
  if (b.bb > 0) extras.push(b.bb > 1 ? `${b.bb} BB` : "BB");
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "2px 0", fontSize: 12 }}>
      <span style={{ fontWeight: 500, minWidth: 110 }}>{b.name}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 24 }}>{b.pos}</span>
      <span style={{ fontWeight: 600 }}>{b.h}-{b.ab}</span>
      {extras.length > 0 && <span style={{ color: "#78716c", fontSize: 11 }}>{extras.join(", ")}</span>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function GameDetailCard({ game }: { game: GameData }) {
  const key = `${game.date}|${game.homeTeam}`;
  const bs = allBoxscores[key] ?? null;

  const homeScore = game.actualHomeScore ?? 0;
  const awayScore = game.actualAwayScore ?? 0;
  const homeWon = homeScore > awayScore;

  let gameTime = "";
  try {
    const d = new Date(game.gameTimeUTC);
    gameTime = d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: "America/Chicago" });
  } catch { gameTime = game.date; }

  return (
    <div style={CARD}>
      {/* ── Score Header ─────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <MLBLogo teamName={game.awayTeam} size={36} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>{game.awayTeam}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: !homeWon ? "#1a6640" : "#78716c", marginLeft: "auto" }}>{awayScore}</div>
        </div>
        <div style={{ padding: "0 16px", fontSize: 13, color: "#78716c", fontWeight: 500 }}>@</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: homeWon ? "#1a6640" : "#78716c" }}>{homeScore}</div>
          <div style={{ marginLeft: "auto", textAlign: "right", fontWeight: 700, fontSize: 15 }}>{game.homeTeam}</div>
          <MLBLogo teamName={game.homeTeam} size={36} />
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>{gameTime}</div>

      {/* ── Line Score ────────────────────────────── */}
      {bs?.innings && bs.innings.length > 0 && (
        <>
          <div style={SECTION_LABEL}>Line Score</div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 400 }}>
              <thead>
                <tr>
                  <th style={{ ...LS_TH, textAlign: "left", minWidth: 60 }}></th>
                  {bs.innings.map((_, i) => <th key={i} style={LS_TH}>{i + 1}</th>)}
                  <th style={{ ...LS_TH, borderLeft: "2px solid #d4d2cc", fontWeight: 900 }}>R</th>
                  <th style={LS_TH}>H</th>
                  <th style={LS_TH}>E</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...LS_TD, textAlign: "left", fontWeight: 600, fontSize: 11 }}>{game.awayTeam.split(" ").pop()}</td>
                  {bs.innings.map((inn, i) => <td key={i} style={LS_TD}>{inn.away}</td>)}
                  <td style={{ ...LS_TD, borderLeft: "2px solid #d4d2cc", fontWeight: 900 }}>{awayScore}</td>
                  <td style={LS_TD}>{bs.awayHits ?? 0}</td>
                  <td style={LS_TD}>{bs.awayErrors ?? 0}</td>
                </tr>
                <tr>
                  <td style={{ ...LS_TD, textAlign: "left", fontWeight: 600, fontSize: 11 }}>{game.homeTeam.split(" ").pop()}</td>
                  {bs.innings.map((inn, i) => <td key={i} style={LS_TD}>{inn.home}</td>)}
                  <td style={{ ...LS_TD, borderLeft: "2px solid #d4d2cc", fontWeight: 900 }}>{homeScore}</td>
                  <td style={LS_TD}>{bs.homeHits ?? 0}</td>
                  <td style={LS_TD}>{bs.homeErrors ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Pitching ──────────────────────────────── */}
      {bs && (bs.awayPitchers.length > 0 || bs.homePitchers.length > 0) && (
        <>
          <div style={SECTION_LABEL}>Pitching</div>
          {[
            { label: game.awayTeam, pitchers: bs.awayPitchers },
            { label: game.homeTeam, pitchers: bs.homePitchers },
          ].map(team => team.pitchers.length > 0 && (
            <div key={team.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#44403c", padding: "4px 0", borderBottom: "1px solid #f0efe9" }}>{team.label}</div>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr style={{ color: "#94a3b8", fontSize: 10 }}>
                    <th style={{ padding: "2px 6px", textAlign: "left", fontWeight: 600 }}>Pitcher</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>IP</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>H</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>R</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>ER</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>BB</th>
                    <th style={{ ...P_TD, fontWeight: 600 }}>K</th>
                  </tr>
                </thead>
                <tbody>
                  {team.pitchers.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f8f6f2" }}>
                      <td style={{ padding: "3px 6px", fontWeight: 500 }}>
                        {p.name}
                        {p.decision && <DecisionBadge decision={p.decision} detail={p.decisionDetail} />}
                      </td>
                      <td style={P_TD}>{formatIP(p.ip)}</td>
                      <td style={P_TD}>{p.h}</td>
                      <td style={P_TD}>{p.r}</td>
                      <td style={P_TD}>{p.er}</td>
                      <td style={P_TD}>{p.bb}</td>
                      <td style={P_TD}>{p.k}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      {/* ── Top Hitters ───────────────────────────── */}
      {bs && (bs.awayTopBatters || bs.homeTopBatters) && (
        <>
          <div style={SECTION_LABEL}>Top Hitters</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#44403c", marginBottom: 4 }}>{game.awayTeam}</div>
              {(bs.awayTopBatters ?? []).map((b, i) => <BattingLine key={i} b={b} />)}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#44403c", marginBottom: 4 }}>{game.homeTeam}</div>
              {(bs.homeTopBatters ?? []).map((b, i) => <BattingLine key={i} b={b} />)}
            </div>
          </div>
        </>
      )}

      {/* ── No box score fallback ─────────────────── */}
      {!bs && (
        <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
          Detailed box score not available for this game.
        </div>
      )}

      {/* ── BBMI Prediction ───────────────────────── */}
      {(game.rlPick || game.ouPick) && (
        <>
          <div style={SECTION_LABEL}>BBMI Prediction</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12 }}>
            {game.rlPick && (
              <div style={{ flex: "1 1 200px" }}>
                <div style={{ fontWeight: 600, color: "#44403c", marginBottom: 2 }}>
                  {game.rlPick}
                  <TierDots tier={game.rlConfidenceTier} />
                </div>
                <div style={{ color: "#78716c", fontSize: 11 }}>
                  Edge: {Math.abs(game.bbmiMargin ?? 0).toFixed(3)}
                  {game.bbmiMargin != null && (
                    <> &middot; Proj: {game.awayTeam.split(" ").pop()} {(game.bbmiAwayProj ?? 0).toFixed(1)} &ndash; {(game.bbmiHomeProj ?? 0).toFixed(1)} {game.homeTeam.split(" ").pop()}</>
                  )}
                </div>
              </div>
            )}
            {game.vegasRunLine != null && (
              <div style={{ flex: "1 1 140px" }}>
                <div style={{ fontWeight: 600, color: "#44403c", marginBottom: 2 }}>Vegas</div>
                <div style={{ color: "#78716c", fontSize: 11 }}>
                  RL: {game.vegasRunLine > 0 ? "+" : ""}{game.vegasRunLine}
                  {game.homeRLJuice != null && ` (${game.homeRLJuice > 0 ? "+" : ""}${game.homeRLJuice})`}
                  {game.vegasTotal != null && <> &middot; O/U: {game.vegasTotal}</>}
                </div>
              </div>
            )}
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontWeight: 600, color: "#44403c", marginBottom: 2 }}>Result</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {game.rlPick && (() => {
                  const homeLeadBy = homeScore - awayScore;
                  const covers = game.rlPick.includes("-1.5") ? homeLeadBy >= 2 : homeLeadBy <= 1;
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      backgroundColor: covers ? "#f0fdf4" : "#fef2f2",
                      color: covers ? "#16a34a" : "#dc2626",
                    }}>
                      +1.5 {covers ? "covers \u2713" : "miss \u2717"}
                    </span>
                  );
                })()}
                {game.ouPick && game.vegasTotal != null && (() => {
                  const actual = homeScore + awayScore;
                  const isPush = actual === game.vegasTotal;
                  const went = actual > game.vegasTotal ? "OVER" : "UNDER";
                  const correct = !isPush && went === game.ouPick;
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                      backgroundColor: isPush ? "#f5f5f5" : correct ? "#f0fdf4" : "#fef2f2",
                      color: isPush ? "#666" : correct ? "#16a34a" : "#dc2626",
                    }}>
                      {isPush ? "Push" : `${game.ouPick} ${correct ? "\u2713" : "\u2717"}`}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
