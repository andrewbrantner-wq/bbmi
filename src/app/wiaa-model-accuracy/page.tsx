"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import wiaaTeams from "@/data/wiaa-team/WIAA-team.json";
import ncaaGames from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type RawGame = {
  team: string;
  teamDiv: string;
  date: string;
  opp: string;
  oppDiv: string;
  location: string;
  result: string;
  teamScore: number | string;
  oppScore: number | string;
  teamLine: number | null;
  teamWinPct: number | string;
};

type NcaaGame = {
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  vegaswinprob: number | null;
};

type CompletedGame = {
  home: string;
  away: string;
  homeDiv: number;
  homeWinProb: number;
  bbmiPick: string;
  actualHomeWon: boolean;
  bbmiCorrect: boolean;
};

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const normalizeDate = (d: string) => d?.split(" ")[0].split("T")[0] ?? "";

const sectionStyle: React.CSSProperties = {
  width: "fit-content",
  maxWidth: "100%",
  minWidth: "min(680px, 100%)",
  margin: "0 auto 2rem auto",
  overflow: "hidden",
  border: "1px solid #e7e5e4",
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.09)",
};

const sectionHeaderStyle: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "white",
  padding: "0.75rem 1rem",
  fontWeight: 600,
  fontSize: "0.875rem",
  textAlign: "center",
  letterSpacing: "0.05em",
};

// ------------------------------------------------------------
// TOOLTIPS + PORTAL
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  band: "Confidence band based on BBMI's predicted win probability for the favored team. Higher bands mean BBMI was more certain about the outcome.",
  games: "Number of completed games falling in this confidence band.",
  correct: "How often the team BBMI predicted to win actually won the game.",
  div: "WIAA division. Teams are grouped and ranked within their division.",
  divGames: "Number of completed games in this division where BBMI made a prediction.",
  divCorrect: "How often BBMI correctly predicted the winner in this division.",
};

function ColDescPortal({ tooltipId, anchorRect, onClose }: { tooltipId: string; anchorRect: DOMRect; onClose: () => void }) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (el.current && !el.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;
  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

function DescHeader({ label, tooltipId, descPortal, openDesc, closeDesc, align = "center" }: {
  label: string; tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
  align?: "center" | "left";
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId + "_wba";
  const descShowing = descPortal?.id === uid;
  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#fff", padding: "0.75rem 1rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, textAlign: align, whiteSpace: "nowrap" }}>
      <span
        onClick={(e) => { e.stopPropagation(); if (descShowing) closeDesc(); else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); } }}
        style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
      >{label}</span>
    </th>
  );
}

// ------------------------------------------------------------
// HOW TO USE ACCORDION
// ------------------------------------------------------------

function HowToUseAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "2rem" }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}
      >
        <span>📖 How do I use this page?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>
            This page tracks how accurately BBMI has predicted game winners across all completed WIAA games this season.
            Unlike the <Link href="/ncaa-model-picks-history" style={{ color: "#2563eb" }}>NCAA Picks page</Link>, WIAA games don't have Vegas lines —
            so this is purely BBMI's outright winner prediction measured against actual results.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>The Overall section</strong> shows BBMI's raw prediction accuracy across all completed games where a line was generated.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Accuracy by Confidence Band</strong> breaks results down by how confident BBMI was. When BBMI gives a team 80–90% win probability, it should be right more often than when it gives 50–60%. A well-calibrated model shows a clear upward trend as confidence increases.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Accuracy by Division</strong> shows whether the model performs consistently across all five WIAA divisions, or if it reads certain divisions better than others.
          </p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// PAGE
// ------------------------------------------------------------

export default function WIAAModelAccuracyPage() {
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const hp = { descPortal, openDesc, closeDesc };

  // Build deduplicated completed games with BBMI predictions
  const completedGames = useMemo<CompletedGame[]>(() => {
    const seen = new Set<string>();
    const result: CompletedGame[] = [];

    (wiaaTeams as RawGame[])
      .filter((g) =>
        g.location === "Home" &&
        g.result && g.result.trim() !== "" &&
        g.teamLine !== null && g.teamLine !== 0 &&
        g.teamWinPct !== null && g.teamWinPct !== ""
      )
      .forEach((g) => {
        const key = [g.team, g.opp].sort().join("|") + "|" + normalizeDate(g.date);
        if (seen.has(key)) return;
        seen.add(key);

        const bbmiPick = (g.teamLine as number) < 0 ? g.team : g.opp;
        const homeWon = g.result === "W";
        const bbmiPickedHome = bbmiPick === g.team;
        const bbmiCorrect = bbmiPickedHome === homeWon;
        const homeWinProb = Number(g.teamWinPct);

        result.push({
          home: g.team,
          away: g.opp,
          homeDiv: Number(g.teamDiv),
          homeWinProb,
          bbmiPick,
          actualHomeWon: homeWon,
          bbmiCorrect,
        });
      });

    return result;
  }, []);

  // Overall stats
  const overall = useMemo(() => {
    const n = completedGames.length;
    const correct = completedGames.filter((g) => g.bbmiCorrect).length;
    const pct = n > 0 ? (correct / n) * 100 : 0;
    return { games: n, correct, pct: pct.toFixed(1) };
  }, [completedGames]);

  // Confidence bands
  const bands = useMemo(() => {
    const defs = [
      { label: "50–60%", min: 0.50, max: 0.60 },
      { label: "60–70%", min: 0.60, max: 0.70 },
      { label: "70–80%", min: 0.70, max: 0.80 },
      { label: "80–90%", min: 0.80, max: 0.90 },
      { label: "90–100%", min: 0.90, max: 1.01 },
    ];
    return defs.map((band) => {
      // Use the favored team's probability for banding
      const inBand = completedGames.filter((g) => {
        const favored = Math.max(g.homeWinProb, 1 - g.homeWinProb);
        return favored >= band.min && favored < band.max;
      });
      const correct = inBand.filter((g) => g.bbmiCorrect).length;
      const pct = inBand.length > 0 ? (correct / inBand.length) * 100 : null;
      return { label: band.label, games: inBand.length, correct, pct };
    });
  }, [completedGames]);

  // By division
  const byDivision = useMemo(() => {
    const divMap: Record<number, { games: number; correct: number }> = {};
    completedGames.forEach((g) => {
      if (!divMap[g.homeDiv]) divMap[g.homeDiv] = { games: 0, correct: 0 };
      divMap[g.homeDiv].games++;
      if (g.bbmiCorrect) divMap[g.homeDiv].correct++;
    });
    return Object.entries(divMap)
      .map(([div, s]) => ({ div: Number(div), games: s.games, correct: s.correct, pct: (s.correct / s.games) * 100 }))
      .sort((a, b) => a.div - b.div);
  }, [completedGames]);

  // Vegas NCAA reference accuracy (computed live from same dataset used on BBMI vs Vegas page)
  const vegasNcaaRef = useMemo(() => {
    const valid = (ncaaGames as NcaaGame[]).filter((g) => {
      if (!g.actualHomeScore || g.actualHomeScore === 0 || g.actualAwayScore === null) return false;
      const vp = g.vegaswinprob;
      if (!vp || vp < 0.1 || vp > 0.9) return false;
      return true;
    });
    const correct = valid.filter((g) => (g.vegaswinprob! > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)).length;
    const pct = valid.length > 0 ? (correct / valid.length) * 100 : 0;
    return { games: valid.length, pct: pct.toFixed(1) };
  }, []);

  const pctColor = (pct: number) => pct >= 60 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.replace("_wba", "")} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full mx-auto px-6 py-8" style={{ maxWidth: "720px" }}>

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-2xl sm:text-3xl font-bold tracking-tight leading-tight mb-3 text-center">
              <LogoBadge league="wiaa" />
              <span className="ml-3">WIAA Prediction Accuracy</span>
            </h1>
            <p className="text-stone-600 text-sm text-center max-w-xl">
              How often does BBMI correctly predict the winner of WIAA games?
              Across <strong>{overall.games.toLocaleString()}</strong> completed games this season where a model line was generated.
              Click any column header to learn what it means.
            </p>
          </div>

          {/* HOW TO USE */}
          <HowToUseAccordion />

          {/* OVERALL SUMMARY */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>OVERALL PREDICTION ACCURACY</div>
            <div style={{ backgroundColor: "white", padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                {[
                  { value: `${overall.pct}%`, label: "Win Prediction %", sub: `${overall.games.toLocaleString()} games`, color: pctColor(Number(overall.pct)) },
                  { value: overall.correct.toLocaleString(), label: "Correct Picks", sub: "outright winner predicted", color: "#0a1a2f" },
                  { value: (overall.games - overall.correct).toLocaleString(), label: "Incorrect Picks", sub: "actual winner differed", color: "#0a1a2f" },
                ].map((card) => (
                  <div key={card.label} style={{ padding: "1.5rem 1rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e7e5e4" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "5px 0 3px" }}>{card.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "#78716c" }}>{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* VEGAS NCAA REFERENCE NOTE */}
              <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: "0.8rem", color: "#14532d", lineHeight: 1.6 }}>
                <strong>🏆 How impressive is 81%?</strong> For context, Vegas — with access to enormous amounts of data and betting market signals — correctly predicts NCAA outright winners only{" "}
                <strong>{vegasNcaaRef.pct}%</strong> of the time across {vegasNcaaRef.games.toLocaleString()} completed games.
                BBMI's WIAA prediction accuracy runs more than <strong>{(Number(overall.pct) - Number(vegasNcaaRef.pct)).toFixed(0)} percentage points ahead</strong> of that benchmark — a meaningful gap that reflects how well the model has learned to read WIAA matchups.
                See the{" "}
                <Link href="/ncaa-model-vs-vegas" style={{ color: "#166534", fontWeight: 600 }}>BBMI vs Vegas page</Link>{" "}
                for the full NCAA comparison.
              </div>
            </div>
          </div>

          {/* CONFIDENCE BANDS */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>ACCURACY BY CONFIDENCE BAND</div>
            <div style={{ backgroundColor: "white", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <DescHeader label="Confidence Band" tooltipId="band" align="left" {...hp} />
                    <DescHeader label="Games" tooltipId="games" {...hp} />
                    <DescHeader label="Correct" tooltipId="correct" {...hp} />
                    <DescHeader label="Win %" tooltipId="correct" {...hp} />
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band, idx) => (
                    <tr key={band.label} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#374151" }}>{band.label}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280" }}>{band.games.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280" }}>{band.correct.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "1.05rem", color: band.pct === null ? "#78716c" : pctColor(band.pct) }}>
                        {band.pct === null ? "—" : `${band.pct.toFixed(1)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "0.625rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #e7e5e4" }}>
              Confidence band = the favored team's BBMI win probability. A well-calibrated model should show higher accuracy in higher bands.
            </div>
          </div>

          {/* BY DIVISION */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>ACCURACY BY DIVISION</div>
            <div style={{ backgroundColor: "white", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <DescHeader label="Division" tooltipId="div" align="left" {...hp} />
                    <DescHeader label="Games" tooltipId="divGames" {...hp} />
                    <DescHeader label="Correct" tooltipId="divCorrect" {...hp} />
                    <DescHeader label="Win %" tooltipId="divCorrect" {...hp} />
                  </tr>
                </thead>
                <tbody>
                  {byDivision.map((row, idx) => (
                    <tr key={row.div} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ padding: "0.75rem 1rem", fontWeight: 600, color: "#374151" }}>Division {row.div}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280" }}>{row.games.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280" }}>{row.correct.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "1.05rem", color: pctColor(row.pct) }}>
                        {row.pct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "0.625rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #e7e5e4" }}>
              Only games where BBMI generated a model line are included. Divisions with fewer games may show more variance.
            </div>
          </div>

          {/* FOOTER NAV */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <Link href="/wiaa-todays-picks" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600, marginRight: "1.5rem" }}>
              ← Today's Picks
            </Link>
            <Link href="/wiaa-rankings" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600 }}>
              WIAA Rankings →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
