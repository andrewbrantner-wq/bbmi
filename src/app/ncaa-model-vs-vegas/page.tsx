"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";

type Game = {
  date: string;
  away: string;
  home: string;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
  vegaswinprob: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: number;
  fakeWin: number;
};

const TOOLTIPS: Record<string, string> = {
  band: "Confidence band based on how strongly the favored team was picked. E.g. if BBMI gives 72% to any team, that game falls in the 70–80% band.",
  games: "Number of completed games in this confidence band with valid win probability data.",
  bbmiCorrect: "How often the team BBMI gave higher win probability to actually won the game outright.",
  vegasCorrect: "How often the team Vegas gave higher implied win probability to actually won the game outright.",
  edge_col: "BBMI accuracy minus Vegas accuracy in this band. Positive = BBMI outperformed Vegas.",
};

const sectionStyle: React.CSSProperties = {
  display: "block",
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

function DescHeader({ label, tooltipId, descPortal, openDesc, closeDesc }: {
  label: string; tooltipId: string;
  descPortal: { id: string; rect: DOMRect } | null;
  openDesc: (id: string, rect: DOMRect) => void;
  closeDesc: () => void;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const uid = tooltipId + "_mv";
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
  if (diff >= 5) return { text: "BBMI clearly better", color: "#16a34a" };
  if (diff >= 1) return { text: "BBMI slightly better", color: "#16a34a" };
  if (diff <= -5) return { text: "Vegas clearly better", color: "#dc2626" };
  return { text: "Vegas slightly better", color: "#dc2626" };
}

export default function ModelVsVegasPage() {
  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);
  const hp = { descPortal, openDesc, closeDesc };

  // Only games with final scores AND valid win probs (10%–90% range excludes
  // artifact values derived from large spreads rather than true money line data)
  const completedGames = useMemo(() => {
    return (games as Game[]).filter((g) => {
      if (!g.actualHomeScore || g.actualHomeScore === 0 || g.actualAwayScore === null) return false;
      const bp = g.bbmiWinProb;
      const vp = g.vegaswinprob;
      if (!bp || !vp) return false;
      if (bp < 0.1 || bp > 0.9) return false;
      if (vp < 0.1 || vp > 0.9) return false;
      return true;
    });
  }, []);

  const overall = useMemo(() => {
    let bbmiCorrect = 0, vegasCorrect = 0;
    completedGames.forEach((g) => {
      const homeWon = g.actualHomeScore! > g.actualAwayScore!;
      if ((g.bbmiWinProb! > 0.5) === homeWon) bbmiCorrect++;
      if ((g.vegaswinprob! > 0.5) === homeWon) vegasCorrect++;
    });
    const n = completedGames.length;
    const bbmiPct = n > 0 ? (bbmiCorrect / n) * 100 : 0;
    const vegasPct = n > 0 ? (vegasCorrect / n) * 100 : 0;
    return {
      games: n,
      bbmiPct: bbmiPct.toFixed(1),
      vegasPct: vegasPct.toFixed(1),
      diff: (bbmiPct - vegasPct).toFixed(1),
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
        const favored = Math.max(g.bbmiWinProb!, 1 - g.bbmiWinProb!);
        return favored >= band.min && favored < band.max;
      });
      const bbmiCorrect = bbmiGames.filter((g) => (g.bbmiWinProb! > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)).length;

      const vegasGames = completedGames.filter((g) => {
        const favored = Math.max(g.vegaswinprob!, 1 - g.vegaswinprob!);
        return favored >= band.min && favored < band.max;
      });
      const vegasCorrect = vegasGames.filter((g) => (g.vegaswinprob! > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)).length;

      const bbmiPct = bbmiGames.length > 0 ? (bbmiCorrect / bbmiGames.length) * 100 : null;
      const vegasPct = vegasGames.length > 0 ? (vegasCorrect / vegasGames.length) * 100 : null;
      const diff = bbmiPct !== null && vegasPct !== null ? bbmiPct - vegasPct : null;

      return {
        label: band.label,
        bbmiGames: bbmiGames.length,
        vegasGames: vegasGames.length,
        bbmiPct: bbmiPct !== null ? bbmiPct.toFixed(1) : "—",
        vegasPct: vegasPct !== null ? vegasPct.toFixed(1) : "—",
        diff: diff !== null ? diff.toFixed(1) : "—",
        diffNum: diff,
      };
    });
  }, [completedGames]);

  const { agreement, disagreement } = useMemo(() => {
    let agree = 0;
    completedGames.forEach((g) => { if ((g.bbmiWinProb! > 0.5) === (g.vegaswinprob! > 0.5)) agree++; });
    const agreeRate = completedGames.length > 0 ? ((agree / completedGames.length) * 100).toFixed(1) : "0";
    const disagreeGames = completedGames.filter((g) => (g.bbmiWinProb! > 0.5) !== (g.vegaswinprob! > 0.5));
    const bbmiRight = disagreeGames.filter((g) => (g.bbmiWinProb! > 0.5) === (g.actualHomeScore! > g.actualAwayScore!)).length;
    const vegasRight = disagreeGames.length - bbmiRight;
    const bbmiDisPct = disagreeGames.length > 0 ? (bbmiRight / disagreeGames.length) * 100 : 0;
    const vegasDisPct = disagreeGames.length > 0 ? (vegasRight / disagreeGames.length) * 100 : 0;
    return {
      agreement: agreeRate,
      disagreement: { total: disagreeGames.length, bbmiRight, vegasRight, bbmiPct: bbmiDisPct.toFixed(1), vegasPct: vegasDisPct.toFixed(1), verdict: getVerdict(bbmiDisPct, vegasDisPct) },
    };
  }, [completedGames]);

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full max-w-[900px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-8">
            <h1 className="flex items-center text-2xl sm:text-3xl font-bold tracking-tight leading-tight mb-3 text-center">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>BBMI vs Vegas: Winner Accuracy</span>
            </h1>
            <p className="text-stone-600 text-sm text-center max-w-xl">
              When BBMI gives a team &gt;50% win probability, how often does that team win?
              Head-to-head vs Vegas across <strong>{overall.games.toLocaleString()}</strong> completed games with valid win probability data.
            </p>
          </div>

          {/* CONTEXT NOTE */}
          <div style={{ backgroundColor: "#fefce8", border: "1px solid #fde68a", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "2rem" }}>
            <p style={{ fontSize: "0.8rem", color: "#78350f", margin: 0, lineHeight: 1.6 }}>
              <strong>📌 Note:</strong> This measures outright winner prediction (money line) — separate from against-the-spread (ATS) performance.
              Only games where both win probabilities fall between 10%–90% are included, filtering out values that appear to be rough estimates derived from large spreads rather than true money line data.
              The more actionable edge is on the{" "}
              <Link href="/ncaa-model-picks-history" style={{ color: "#92400e", textDecoration: "underline" }}>Picks Model Accuracy</Link> page.
            </p>
          </div>

          {/* OVERALL */}
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>OVERALL OUTRIGHT WINNER ACCURACY</div>
            <div style={{ backgroundColor: "white", padding: "1.25rem 1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
              {[
                { value: `${overall.bbmiPct}%`, label: "BBMI Accuracy", sub: `${overall.games.toLocaleString()} games`, color: "#0a1a2f" },
                { value: `${overall.vegasPct}%`, label: "Vegas Accuracy", sub: `${overall.games.toLocaleString()} games`, color: "#0a1a2f" },
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
                    <DescHeader label="Confidence" tooltipId="band" {...hp} />
                    <DescHeader label="BBMI Games" tooltipId="games" {...hp} />
                    <DescHeader label="BBMI Correct" tooltipId="bbmiCorrect" {...hp} />
                    <DescHeader label="Vegas Games" tooltipId="games" {...hp} />
                    <DescHeader label="Vegas Correct" tooltipId="vegasCorrect" {...hp} />
                    <DescHeader label="BBMI Edge" tooltipId="edge_col" {...hp} />
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
              Confidence band = favored team's win probability. BBMI and Vegas bands are calculated independently so game counts may differ.
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
                  { label: "BBMI Was Right", value: `${disagreement.bbmiRight}`, sub: `${disagreement.bbmiPct}% of disagreements`, color: "#0a1a2f", small: false },
                  { label: "Vegas Was Right", value: `${disagreement.vegasRight}`, sub: `${disagreement.vegasPct}% of disagreements`, color: "#0a1a2f", small: false },
                  { label: "Verdict", value: disagreement.verdict.text, sub: "when models split", color: disagreement.verdict.color, small: true },
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
                Check <Link href="/ncaa-todays-picks" style={{ color: "#2563eb" }}>Today's Picks</Link> for current high-edge games.
              </p>
            </div>
          </div>

          {/* FOOTER NAV */}
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <Link href="/ncaa-model-picks-history" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600, marginRight: "1.5rem" }}>
              ← Picks Model Accuracy (ATS)
            </Link>
            <Link href="/ncaa-todays-picks" style={{ fontSize: "0.875rem", color: "#2563eb", fontWeight: 600 }}>
              Today's Picks →
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
