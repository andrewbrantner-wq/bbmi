"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";
import games from "@/data/betting-lines/football-games.json";

// ── Types ─────────────────────────────────────────────────────────────────────

type FootballGame = {
  gameDate: string;
  homeTeam: string;
  awayTeam: string;
  vegasLine: number | null;
  vegasHomeLine: number | null;
  bbmifLine: number | null;
  homeWinPct: number | null;
  awayWinPct: number | null;
  actualHomeScore: number | null;
  actualAwayScore: number | null;
  fakeBet: number;
  fakeWin: number;
};

// ── Win probability helpers ───────────────────────────────────────────────────

// STD_DEV for Vegas implied win probability (derived from point spread).
// This is the market standard for NFL/NCAAF spreads — separate from the
// pipeline's BBMI STD_DEV (10.75) which calibrates BBMI win probabilities.
// Do NOT change this to match the pipeline STD_DEV.
const STD_DEV = 14.0;

function normCdf(x: number, sigma = STD_DEV): number {
  const t = x / (sigma * Math.SQRT2);
  const absT = Math.abs(t);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const u = 1 / (1 + p * absT);
  const poly = u * (a1 + u * (a2 + u * (a3 + u * (a4 + u * a5))));
  const erfc = poly * Math.exp(-absT * absT);
  return t >= 0 ? 1 - 0.5 * erfc : 0.5 * erfc;
}

function vegasHomeWinProb(vegasLine: number): number {
  return normCdf(-vegasLine);
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const TOOLTIPS: Record<string, string> = {
  band: "Confidence band based on how strongly the favored team was picked. E.g. if BBMI gives 72% to any team, that game falls in the 70–80% band.",
  games: "Number of completed games in this confidence band with valid win probability data.",
  bbmiCorrect: "How often the team BBMI gave higher win probability to actually won the game outright.",
  vegasCorrect: "How often the team Vegas gave higher implied win probability to actually won the game outright.",
  edge_col: "Difference between BBMI win-pick accuracy and Vegas win-pick accuracy in this band. Positive = BBMI outperformed Vegas.",
};

const sectionStyle: React.CSSProperties = {
  display: "block",
  width: "fit-content",
  maxWidth: "100%",
  minWidth: "min(680px, 100%)",
  margin: "0 auto 2rem auto",
  overflow: "hidden",
  border: "1px solid #e7e5e4",
  borderRadius: 0,
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

// ── Tooltip portal ────────────────────────────────────────────────────────────

function ColDescPortal({ tooltipId, anchorRect, onClose }: {
  tooltipId: string; anchorRect: DOMRect; onClose: () => void;
}) {
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

function DescHeader({ label, tooltipId, descPortal, openDesc, closeDesc }: {
  label: string; tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ?? null;
  const descShowing = descPortal?.id === uid;
  return (
    <th ref={thRef} style={{ backgroundColor: "#0a1a2f", color: "#fff", padding: "0.75rem 1rem", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>
      <span
        onClick={(e) => { e.stopPropagation(); if (descShowing) { closeDesc(); } else { const rect = thRef.current?.getBoundingClientRect(); if (rect) openDesc(uid, rect); } }}
        style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
      >{label}</span>
    </th>
  );
}

function getVerdict(bbmi: number, vegas: number): { text: string; color: string } {
  const diff = bbmi - vegas;
  if (Math.abs(diff) < 1) return { text: "Roughly equal", color: "#78716c" };
  if (diff >= 5)  return { text: "BBMI clearly better",  color: "#16a34a" };
  if (diff >= 1)  return { text: "BBMI slightly better", color: "#16a34a" };
  if (diff <= -5) return { text: "Vegas clearly better",  color: "#dc2626" };
  return { text: "Vegas slightly better", color: "#dc2626" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NCAAFModelVsVegasPage() {
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const hp = { descPortal, openDesc, closeDesc };

  // Completed games with valid win probs.
  // homeWinPct is stored as 0–100 scale; vegasWinProb is derived from the spread.
  const completedGames = useMemo(() => {
    return (games as unknown as FootballGame[])
      .filter((g) => {
        if (g.actualHomeScore == null || g.actualAwayScore == null) return false;
        const line = g.vegasLine ?? g.vegasHomeLine;
        if (line == null || g.homeWinPct == null) return false;
        return true;
      })
      .map((g) => ({
        ...g,
        _bbmiProb:  g.homeWinPct! / 100,
        _vegasProb: vegasHomeWinProb(g.vegasLine ?? g.vegasHomeLine ?? 0),
      }));
  }, []);

  // ATS record (computed from game data, not hardcoded)
  const atsRecord = useMemo(() => {
    const MIN_EDGE = 2;
    const decided = (games as unknown as FootballGame[]).filter(g => {
      const vl = g.vegasLine ?? g.vegasHomeLine;
      const bl = g.bbmifLine;
      return vl != null && bl != null && g.actualHomeScore != null && g.actualAwayScore != null
        && Math.abs((bl ?? 0) - (vl ?? 0)) >= MIN_EDGE;
    });
    let wins = 0;
    decided.forEach(g => {
      const vl = (g.vegasLine ?? g.vegasHomeLine ?? 0) as number;
      const bl = (g.bbmifLine ?? 0) as number;
      const margin = (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0);
      const coverMargin = margin + vl;
      const pickHome = bl < vl;
      const homeCovered = coverMargin > 0;
      if ((pickHome && homeCovered) || (!pickHome && !homeCovered)) wins++;
    });
    const total = decided.length;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
    return { wins, total, pct };
  }, []);

  const overall = useMemo(() => {
    let bbmiCorrect = 0, vegasCorrect = 0;
    completedGames.forEach((g) => {
      const homeWon = g.actualHomeScore! > g.actualAwayScore!;
      if ((g._bbmiProb  > 0.5) === homeWon) bbmiCorrect++;
      if ((g._vegasProb > 0.5) === homeWon) vegasCorrect++;
    });
    const n = completedGames.length;
    const bbmiPct  = n > 0 ? (bbmiCorrect  / n) * 100 : 0;
    const vegasPct = n > 0 ? (vegasCorrect / n) * 100 : 0;
    return {
      games:   n,
      bbmiPct: bbmiPct.toFixed(1),
      vegasPct: vegasPct.toFixed(1),
      diff:    (bbmiPct - vegasPct).toFixed(1),
      diffNum: bbmiPct - vegasPct,
      verdict: getVerdict(bbmiPct, vegasPct),
    };
  }, [completedGames]);

  const bands = useMemo(() => {
    const defs = [
      { label: "50–60%", min: 0.50, max: 0.60 },
      { label: "60–70%", min: 0.60, max: 0.70 },
      { label: "70–80%", min: 0.70, max: 0.80 },
      { label: "80–90%", min: 0.80, max: 0.90 },
    ];
    return defs.map((band) => {
      const bbmiGames = completedGames.filter((g) => {
        const favored = Math.max(g._bbmiProb, 1 - g._bbmiProb);
        return favored >= band.min && favored < band.max;
      });
      const bbmiCorrect = bbmiGames.filter(
        (g) => (g._bbmiProb > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)
      ).length;

      const vegasGames = completedGames.filter((g) => {
        const favored = Math.max(g._vegasProb, 1 - g._vegasProb);
        return favored >= band.min && favored < band.max;
      });
      const vegasCorrect = vegasGames.filter(
        (g) => (g._vegasProb > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)
      ).length;

      const bbmiPct  = bbmiGames.length  > 0 ? (bbmiCorrect  / bbmiGames.length)  * 100 : null;
      const vegasPct = vegasGames.length > 0 ? (vegasCorrect / vegasGames.length) * 100 : null;
      const diff     = bbmiPct !== null && vegasPct !== null ? bbmiPct - vegasPct : null;

      return {
        label:      band.label,
        bbmiGames:  bbmiGames.length,
        vegasGames: vegasGames.length,
        bbmiPct:    bbmiPct  !== null ? bbmiPct.toFixed(1)  : "—",
        vegasPct:   vegasPct !== null ? vegasPct.toFixed(1) : "—",
        diff:       diff     !== null ? diff.toFixed(1)     : "—",
        diffNum:    diff,
      };
    });
  }, [completedGames]);

  const { agreement, disagreement } = useMemo(() => {
    let agree = 0;
    completedGames.forEach((g) => {
      if ((g._bbmiProb > 0.5) === (g._vegasProb > 0.5)) agree++;
    });
    const agreeRate = completedGames.length > 0
      ? ((agree / completedGames.length) * 100).toFixed(1) : "0";
    const disagreeGames = completedGames.filter(
      (g) => (g._bbmiProb > 0.5) !== (g._vegasProb > 0.5)
    );
    const bbmiRight  = disagreeGames.filter(
      (g) => (g._bbmiProb > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)
    ).length;
    const vegasRight  = disagreeGames.length - bbmiRight;
    const bbmiDisPct  = disagreeGames.length > 0 ? (bbmiRight  / disagreeGames.length) * 100 : 0;
    const vegasDisPct = disagreeGames.length > 0 ? (vegasRight / disagreeGames.length) * 100 : 0;
    return {
      agreement: agreeRate,
      disagreement: {
        total:    disagreeGames.length,
        bbmiRight, vegasRight,
        bbmiPct:  bbmiDisPct.toFixed(1),
        vegasPct: vegasDisPct.toFixed(1),
        verdict:  getVerdict(bbmiDisPct, vegasDisPct),
      },
    };
  }, [completedGames]);

  return (
    <>
      {descPortal && (
        <ColDescPortal
          tooltipId={descPortal.id}
          anchorRect={descPortal.rect}
          onClose={closeDesc}
        />
      )}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa-football" size={120} />
              <span style={{ marginLeft: 12 }}>BBMI vs Vegas: Winner Accuracy</span>
            </h1>
            <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>
              When BBMI gives a team &gt;50% win probability, how often does that team win outright?
              Head-to-head vs Vegas across{" "}
              <strong>{overall.games.toLocaleString()}</strong> completed games.
            </p>
          </div>

          {/* ATS CALLOUT */}
          <div style={{ backgroundColor: "#0a1a2f", borderRadius: 8, padding: "1rem 1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 4 }}>
                The Real Edge: Against the Spread (ATS)
              </div>
              <div style={{ color: "white", fontSize: "0.875rem", lineHeight: 1.5 }}>
                BBMI is not designed to predict outright winners — it&apos;s designed to find games where Vegas has the line wrong.
                The honest track record is <strong style={{ color: "#c9a84c" }}>{atsRecord.pct}% ATS on {atsRecord.total.toLocaleString()} picks</strong> vs the 52.4% breakeven.
              </div>
            </div>
            <Link href="/ncaaf-model-accuracy" style={{ backgroundColor: "#c9a84c", color: "#0a1a2f", fontWeight: 700, fontSize: "0.8rem", padding: "0.5rem 1rem", borderRadius: 6, textDecoration: "none", whiteSpace: "nowrap" }}>
              View ATS Results →
            </Link>
          </div>

          {/* CONTEXT NOTE */}
          <div style={{ backgroundColor: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "2rem" }}>
            <p style={{ fontSize: "0.8rem", color: "#78350f", margin: 0, lineHeight: 1.6 }}>
              <strong>📌 Note:</strong> Outright winner accuracy measures something different from ATS performance.
              Vegas has a structural advantage here — it incorporates sharp money, injury reports, and line movement
              that public models can&apos;t access. BBMI&apos;s edge is in identifying <em>when</em> the Vegas line is off,
              not predicting who wins outright. Both BBMI and Vegas win probabilities use σ={STD_DEV} for a fair comparison.
            </p>
          </div>

          {/* OVERALL */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>OVERALL OUTRIGHT WINNER ACCURACY</div>
            <div style={{ backgroundColor: "white", padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                {[
                  { value: `${overall.bbmiPct}%`,  label: "BBMI Accuracy", sub: `${overall.games.toLocaleString()} games`, color: "#0a1a2f" },
                  { value: `${overall.vegasPct}%`, label: "Vegas Accuracy",  sub: `${overall.games.toLocaleString()} games`, color: "#0a1a2f" },
                  { value: `${overall.diffNum > 0 ? "+" : ""}${overall.diff}%`, label: "BBMI vs Vegas", sub: overall.verdict.text, color: overall.verdict.color },
                ].map((card) => (
                  <div key={card.label} style={{ padding: "1.5rem 1rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e7e5e4" }}>
                    <div style={{ fontSize: "2rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "5px 0 3px" }}>{card.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "#78716c" }}>{card.sub}</div>
                  </div>
                ))}
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
                    <DescHeader label="Confidence"    tooltipId="band"         {...hp} />
                    <DescHeader label="BBMI Games"   tooltipId="games"        {...hp} />
                    <DescHeader label="BBMI Correct" tooltipId="bbmiCorrect"  {...hp} />
                    <DescHeader label="Vegas Games"   tooltipId="games"        {...hp} />
                    <DescHeader label="Vegas Correct" tooltipId="vegasCorrect" {...hp} />
                    <DescHeader label="BBMI Diff"    tooltipId="edge_col"     {...hp} />
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", backgroundColor: idx % 2 === 0 ? "white" : "#f8fafc" }}>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 600, color: "#374151" }}>{band.label}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "0.9rem" }}>{band.bbmiGames.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "1.1rem", color: band.bbmiPct !== "—" && Number(band.bbmiPct) >= 50 ? "#16a34a" : "#dc2626" }}>
                        {band.bbmiPct}{band.bbmiPct !== "—" ? "%" : ""}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", color: "#6b7280", fontSize: "0.9rem" }}>{band.vegasGames.toLocaleString()}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, fontSize: "1.1rem", color: band.vegasPct !== "—" && Number(band.vegasPct) >= 50 ? "#16a34a" : "#dc2626" }}>
                        {band.vegasPct}{band.vegasPct !== "—" ? "%" : ""}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontWeight: 700, color: band.diffNum === null ? "#78716c" : band.diffNum > 0 ? "#16a34a" : band.diffNum < 0 ? "#dc2626" : "#78716c" }}>
                        {band.diff !== "—" ? `${Number(band.diff) > 0 ? "+" : ""}${band.diff}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ backgroundColor: "#f8fafc", padding: "0.625rem 1rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280", borderTop: "1px solid #e7e5e4" }}>
              Confidence band = favored team&apos;s win probability. BBMI and Vegas bands calculated independently so game counts may differ.
              Vegas win probability derived from point spread (σ={STD_DEV}).
            </div>
          </div>

          {/* WHEN THEY DISAGREE */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>WHEN BBMI AND VEGAS DISAGREE</div>
            <div style={{ backgroundColor: "white", padding: "1.5rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#374151", textAlign: "center", marginBottom: "1.5rem" }}>
                Out of {overall.games.toLocaleString()} games, BBMI and Vegas picked the same team{" "}
                <strong>{agreement}%</strong> of the time. In the remaining{" "}
                <strong>{disagreement.total.toLocaleString()} games</strong> where they disagreed:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                {[
                  { label: "BBMI Was Right", value: `${disagreement.bbmiRight}`,  sub: `${disagreement.bbmiPct}% of disagreements`,  color: "#0a1a2f", small: false },
                  { label: "Vegas Was Right",  value: `${disagreement.vegasRight}`, sub: `${disagreement.vegasPct}% of disagreements`, color: "#0a1a2f", small: false },
                  { label: "Verdict",          value: disagreement.verdict.text,    sub: "when models split",                          color: disagreement.verdict.color, small: true },
                ].map((card) => (
                  <div key={card.label} style={{ padding: "1.25rem 1rem", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid #e7e5e4" }}>
                    <div style={{ fontSize: card.small ? "1rem" : "1.75rem", fontWeight: 800, color: card.color, lineHeight: 1.2 }}>{card.value}</div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "5px 0 3px" }}>{card.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "#78716c" }}>{card.sub}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "0.75rem", color: "#6b7280", textAlign: "center", marginTop: "1rem", fontStyle: "italic" }}>
                When BBMI and Vegas diverge on the outright winner, that often corresponds to a high-edge spread pick.
                Check <Link href="/ncaaf-picks" style={{ color: "#2563eb" }}>Weekly Picks</Link> for current high-edge games.
              </p>
            </div>
          </div>

          {/* FOOTER NAV */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <Link href="/ncaaf-model-accuracy" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600, marginRight: "1.5rem" }}>
              ← Model Accuracy (ATS)
            </Link>
            <Link href="/ncaaf-picks" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600 }}>
              Weekly Picks →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
