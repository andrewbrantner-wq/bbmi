"use client";

import React, { useMemo, useState } from "react";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import preSeeding from "@/data/pre_tournament_snapshots/ncaa/seeding-20260315.json";
import curSeeding from "@/data/seeding/seeding.json";
import rankingsData from "@/data/pre_tournament_snapshots/ncaa/rankings-20260315.json";
import tournamentResultsRaw from "@/data/seeding/tournament-results.json";

/* ── Tournament results ────────────────────────────────────── */
const ACTUAL_RESULTS: Record<string, string> = {};
const GAME_DETAILS: Record<string, { teams: [string, string]; scores: [number, number] }> = {};
if (tournamentResultsRaw && typeof tournamentResultsRaw === "object") {
  const raw = tournamentResultsRaw as Record<string, unknown>;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "_details" && v && typeof v === "object") {
      for (const [dk, dv] of Object.entries(v as Record<string, unknown>))
        GAME_DETAILS[dk] = dv as { teams: [string, string]; scores: [number, number] };
    } else if (typeof v === "string") {
      ACTUAL_RESULTS[k] = v;
    }
  }
}

function getActualScore(resultKey: string, teamName: string): number | null {
  const detail = GAME_DETAILS[resultKey];
  if (!detail) return null;
  if (detail.teams[0] === teamName) return detail.scores[0];
  if (detail.teams[1] === teamName) return detail.scores[1];
  return null;
}

/* ── BBMI win probability (same formula as bracket-challenge) ─ */
const BBMI_MULTIPLIER = 1.1;
const BBMI_STD_DEV = 10.75;

function erfc(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1.0 / (1.0 + p * ax);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 1 - sign * y;
}

function h2hProb(scoreA: number, scoreB: number): number {
  if (!scoreA || !scoreB) return 0.5;
  const z = (scoreA - scoreB) * BBMI_MULTIPLIER / (BBMI_STD_DEV * Math.SQRT2);
  return 0.5 * erfc(-z);
}

/* ── Bracket layout constants (matching bracket-challenge) ──── */
const TEAM_H = 28;
const TEAM_W = 175;
const SLOT_GAP = 4;
const PAIR_H = TEAM_H * 2 + SLOT_GAP;
const ROW_GAP = 6;
const CONN_W = 16;
const MATCHUPS: [number, number][] = [
  [1, 16], [8, 9], [5, 12], [4, 13],
  [6, 11], [3, 14], [7, 10], [2, 15],
];
const ROUND_ORDER = ["PlayIn", "R64", "R32", "S16", "E8", "F4", "CHAMP"];

type BTeam = { name: string; seed: number; region: string; playIn: boolean; bbmi: number };

/* ── Bracket slot (read-only) ──────────────────────────────── */
function BracketSlot({ team, isPicked, isCorrect, isIncorrect, isBusted, score, winPct }: {
  team: BTeam | undefined;
  isPicked: boolean;
  isCorrect: boolean;
  isIncorrect: boolean;
  isBusted: boolean;
  score: number | null;
  winPct: number | null;
}) {
  if (!team) return (
    <div style={{ height: TEAM_H, width: TEAM_W, border: "1px dashed #d6d3d1", background: "#fafaf9",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#a8a29e", borderRadius: 3 }}>—</div>
  );

  const isElim = isBusted || (isIncorrect && !isPicked);
  const bg = isCorrect ? "#dcfce7" : isIncorrect ? "#fee2e2" : isBusted ? "#fee2e2" : isPicked ? "#dbeafe" : isElim ? "#f5f5f4" : "white";
  const border = isCorrect ? "#16a34a" : isIncorrect ? "#ef4444" : isBusted ? "#fca5a5" : isPicked ? "#3b82f6" : "#d6d3d1";

  return (
    <div style={{
      height: TEAM_H, width: TEAM_W, border: `1.5px solid ${border}`, background: bg,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      paddingLeft: 5, paddingRight: 6, fontSize: 12, borderRadius: 3,
      boxSizing: "border-box", opacity: isElim ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, overflow: "hidden" }}>
        <NCAALogo teamName={team.name} size={14} />
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textDecoration: isBusted ? "line-through" : "none" }}>
          <strong style={{ marginRight: 2 }}>{team.seed}</strong>{team.name}
        </span>
      </div>
      {isBusted && <span style={{ fontSize: 8, color: "#dc2626", flexShrink: 0 }}>✗</span>}
      {score != null && !isBusted && (
        <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, marginLeft: 3, color: isElim ? "#a8a29e" : "#1e293b" }}>{score}</span>
      )}
      {score == null && winPct != null && (
        <span style={{ fontSize: 10, flexShrink: 0, marginLeft: 3, fontWeight: 600,
          color: winPct >= 60 ? "#16a34a" : winPct <= 40 ? "#dc2626" : "#64748b" }}>{winPct}%</span>
      )}
      {isCorrect && <span style={{ fontSize: 8, fontWeight: 800, color: "#16a34a", backgroundColor: "#bbf7d0", borderRadius: 2, padding: "0 3px", flexShrink: 0, marginLeft: 2, lineHeight: "13px" }}>✓</span>}
      {isIncorrect && isPicked && <span style={{ fontSize: 8, fontWeight: 800, color: "#dc2626", backgroundColor: "#fecaca", borderRadius: 2, padding: "0 3px", flexShrink: 0, marginLeft: 2, lineHeight: "13px" }}>✗</span>}
      {isPicked && !isCorrect && !isIncorrect && <span style={{ fontSize: 8, fontWeight: 800, color: "#2563eb", backgroundColor: "#bfdbfe", borderRadius: 2, padding: "0 3px", flexShrink: 0, marginLeft: 2, lineHeight: "13px" }}>✓</span>}
    </div>
  );
}

/* ── types ─────────────────────────────────────────────────── */
interface SeedRow {
  Team: string;
  Region: string;
  CurrentSeed: number;
  PlayIn: boolean;
  RoundOf32Pct: string | number;
  Sweet16Pct: number;
  Elite8Pct: number;
  FinalFourPct: number;
  ChampionshipPct: number;
  WinTitlePct: number;
}

const ROUNDS = [
  { key: "RoundOf32Pct", label: "Rd of 32", short: "R32" },
  { key: "Sweet16Pct", label: "Sweet 16", short: "S16" },
  { key: "Elite8Pct", label: "Elite 8", short: "E8" },
  { key: "FinalFourPct", label: "Final Four", short: "F4" },
  { key: "ChampionshipPct", label: "Championship", short: "CG" },
  { key: "WinTitlePct", label: "Champion", short: "W" },
] as const;

type RoundKey = (typeof ROUNDS)[number]["key"];

interface TeamRow {
  team: string;
  region: string;
  seed: number;
  advancedTo: string;
  eliminatedRound: string;
  rounds: {
    key: string;
    short: string;
    predicted: number;
    result: "advanced" | "eliminated" | "tbd";
  }[];
}

/* ── helpers ───────────────────────────────────────────────── */
function prob(val: string | number): number {
  return typeof val === "string" ? parseFloat(val) : val;
}

function pct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

function getResult(cur: SeedRow, roundKey: RoundKey, roundIdx: number): "advanced" | "eliminated" | "tbd" {
  const val = prob(cur[roundKey] as string | number);
  if (val === 1.0) return "advanced";
  if (val === 0.0) {
    // Check if eliminated in a prior round
    if (roundIdx === 0) return "eliminated";
    for (let i = 0; i < roundIdx; i++) {
      const priorVal = prob(cur[ROUNDS[i].key] as string | number);
      if (priorVal === 0.0) return "eliminated";
    }
    // Check if any team has 1.0 for this round (round started)
    const anyDecided = (curSeeding as SeedRow[]).some(
      (t) => prob(t[roundKey] as string | number) === 1.0
    );
    return anyDecided ? "eliminated" : "tbd";
  }
  return "tbd";
}

function brierScore(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0) return 0;
  const sum = predictions.reduce((acc, p, i) => acc + (p - actuals[i]) ** 2, 0);
  return sum / predictions.length;
}

/* ── styles ────────────────────────────────────────────────── */
const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "center",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  borderBottom: "2px solid rgba(255,255,255,0.1)",
  position: "sticky",
  top: 0,
  zIndex: 20,
};

const TD: React.CSSProperties = {
  padding: "6px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  verticalAlign: "middle",
  textAlign: "center",
};

const CARD: React.CSSProperties = {
  border: "1px solid #e7e5e4",
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: "#f9fafb",
  boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
};

/* ── component ─────────────────────────────────────────────── */
export default function BracketValidationPage() {
  const [regionFilter, setRegionFilter] = useState<string>("All");
  const [sortCol, setSortCol] = useState<string>("seed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const preMap = useMemo(() => {
    const m: Record<string, SeedRow> = {};
    for (const t of preSeeding as SeedRow[]) m[t.Team] = t;
    return m;
  }, []);

  const regions = useMemo(() => {
    const r = new Set((curSeeding as SeedRow[]).map((t) => t.Region));
    return ["All", ...Array.from(r).sort()];
  }, []);

  /* ── round-level stats ────────────────────────────────────── */
  const roundStats = useMemo(() => {
    return ROUNDS.map((round, roundIdx) => {
      let total = 0;
      let advanced = 0;
      let eliminated = 0;
      let tbd = 0;
      const preds: number[] = [];
      const acts: number[] = [];
      let predSumForAdvanced = 0;
      let expectedAdvanced = 0;

      for (const cur of curSeeding as SeedRow[]) {
        const pre = preMap[cur.Team];
        if (!pre) continue;
        const predProb = prob(pre[round.key] as string | number);
        const result = getResult(cur, round.key, roundIdx);

        if (result === "tbd") {
          tbd++;
          continue;
        }

        const actual = result === "advanced" ? 1 : 0;
        total++;
        preds.push(predProb);
        acts.push(actual);
        expectedAdvanced += predProb;

        if (actual === 1) {
          advanced++;
          predSumForAdvanced += predProb;
        } else {
          eliminated++;
        }
      }

      return {
        ...round,
        total,
        advanced,
        eliminated,
        tbd,
        expectedAdvanced,
        brier: brierScore(preds, acts),
        avgPredForAdvanced: advanced > 0 ? predSumForAdvanced / advanced : 0,
      };
    });
  }, [preMap]);

  /* ── calibration buckets (all rounds combined) ──────────── */
  const calibrationBuckets = useMemo(() => {
    const buckets: Record<string, { label: string; min: number; max: number; predicted: number[]; actual: number[] }> = {
      "0-10":   { label: "0-10%",   min: 0,    max: 0.10, predicted: [], actual: [] },
      "10-20":  { label: "10-20%",  min: 0.10, max: 0.20, predicted: [], actual: [] },
      "20-30":  { label: "20-30%",  min: 0.20, max: 0.30, predicted: [], actual: [] },
      "30-40":  { label: "30-40%",  min: 0.30, max: 0.40, predicted: [], actual: [] },
      "40-50":  { label: "40-50%",  min: 0.40, max: 0.50, predicted: [], actual: [] },
      "50-60":  { label: "50-60%",  min: 0.50, max: 0.60, predicted: [], actual: [] },
      "60-70":  { label: "60-70%",  min: 0.60, max: 0.70, predicted: [], actual: [] },
      "70-80":  { label: "70-80%",  min: 0.70, max: 0.80, predicted: [], actual: [] },
      "80-90":  { label: "80-90%",  min: 0.80, max: 0.90, predicted: [], actual: [] },
      "90-100": { label: "90-100%", min: 0.90, max: 1.01, predicted: [], actual: [] },
    };

    for (const cur of curSeeding as SeedRow[]) {
      const pre = preMap[cur.Team];
      if (!pre) continue;

      for (let ri = 0; ri < ROUNDS.length; ri++) {
        const round = ROUNDS[ri];
        const predProb = prob(pre[round.key] as string | number);
        const result = getResult(cur, round.key, ri);
        if (result === "tbd") continue;

        const actual = result === "advanced" ? 1 : 0;
        for (const b of Object.values(buckets)) {
          if (predProb >= b.min && predProb < b.max) {
            b.predicted.push(predProb);
            b.actual.push(actual);
            break;
          }
        }
      }
    }

    return Object.values(buckets).map((b) => {
      const n = b.predicted.length;
      const avgPred = n > 0 ? b.predicted.reduce((a, v) => a + v, 0) / n : 0;
      const actualRate = n > 0 ? b.actual.reduce((a, v) => a + v, 0) / n : 0;
      return { label: b.label, n, avgPred, actualRate };
    });
  }, [preMap]);

  /* ── team-level data ───────────────────────────────────────── */
  const teamRows: TeamRow[] = useMemo(() => {
    const rows: TeamRow[] = [];
    for (const cur of curSeeding as SeedRow[]) {
      if (regionFilter !== "All" && cur.Region !== regionFilter) continue;
      const pre = preMap[cur.Team];
      if (!pre) continue;

        // Determine how far team actually went
        let eliminatedRound = "";
        let advancedTo = "";
        for (let i = ROUNDS.length - 1; i >= 0; i--) {
          const result = getResult(cur, ROUNDS[i].key, i);
          if (result === "advanced") {
            advancedTo = ROUNDS[i].short;
            break;
          }
        }
        if (!advancedTo) {
          // Check if eliminated in R64
          const r32Result = getResult(cur, "RoundOf32Pct", 0);
          if (r32Result === "eliminated") eliminatedRound = "R64";
        }

        // Find where they were eliminated (first round with 0.0 after advancing)
        if (!eliminatedRound && advancedTo) {
          for (let i = 0; i < ROUNDS.length; i++) {
            const result = getResult(cur, ROUNDS[i].key, i);
            if (result === "eliminated") {
              eliminatedRound = ROUNDS[i].short;
              break;
            }
            if (result === "tbd") {
              eliminatedRound = "alive";
              break;
            }
          }
        }

      rows.push({
          team: cur.Team,
          region: cur.Region,
          seed: cur.CurrentSeed,
          advancedTo,
          eliminatedRound,
          rounds: ROUNDS.map((round, roundIdx) => ({
            key: round.key,
            short: round.short,
            predicted: prob(pre[round.key] as string | number),
            result: getResult(cur, round.key, roundIdx),
          })),
        });
    }
    return rows;
  }, [preMap, regionFilter]);

  const sorted = useMemo(() => {
    return [...teamRows].sort((a, b) => {
      let va: number, vb: number;
      if (sortCol === "seed") {
        va = a.seed;
        vb = b.seed;
      } else if (sortCol === "team") {
        return sortDir === "asc" ? a.team.localeCompare(b.team) : b.team.localeCompare(a.team);
      } else {
        const ri = ROUNDS.findIndex((r) => r.key === sortCol);
        va = a.rounds[ri]?.predicted ?? 0;
        vb = b.rounds[ri]?.predicted ?? 0;
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [teamRows, sortCol, sortDir]);

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "seed" ? "asc" : "desc");
    }
  }

  const arrow = (col: string) => (sortCol === col ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">
        {/* HEADER */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em", textAlign: "center" }}>
            <LogoBadge league="ncaa" />
            <span style={{ marginLeft: 12 }}>Bracket Prediction Validation</span>
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#78716c", textAlign: "center", maxWidth: 600 }}>
            Pre-tournament predictions (March 15) vs actual tournament results.
            <br />
            How well did the BBMI model forecast the 2026 NCAA Tournament?
          </p>
        </div>

        {/* ── BRACKET VISUALIZATION ──────────────────────────── */}
        <BbmiBracket />

        {/* ── ROUND SUMMARY ─────────────────────────────────── */}
        <section style={{ maxWidth: 900, margin: "0 auto 40px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12, color: "#0a1a2f" }}>
            Round-by-Round Summary
          </h2>
          <div style={CARD}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Round</th>
                  <th style={TH}>Expected Adv</th>
                  <th style={TH}>Actual Adv</th>
                  <th style={TH}>Diff</th>
                  <th style={TH}>Avg Pred (Adv)</th>
                  <th style={TH}>Brier Score</th>
                </tr>
              </thead>
              <tbody>
                {roundStats.filter((r) => r.tbd === 0).map((r, i) => {
                  const diff = r.advanced - r.expectedAdvanced;
                  return (
                    <tr key={r.key} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={{ ...TD, textAlign: "left", fontWeight: 600 }}>{r.label}</td>
                      <td style={TD}>{r.total > 0 ? r.expectedAdvanced.toFixed(1) : "—"}</td>
                      <td style={TD}>{r.advanced}</td>
                      <td style={{
                        ...TD,
                        fontWeight: 600,
                        color: r.total === 0 ? "#a8a29e"
                          : Math.abs(diff) <= 1 ? "#16a34a"
                          : Math.abs(diff) <= 3 ? "#ca8a04"
                          : "#dc2626",
                      }}>
                        {r.total > 0 ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}` : "—"}
                      </td>
                      <td style={TD}>{r.advanced > 0 ? pct(r.avgPredForAdvanced) : "—"}</td>
                      <td style={TD}>
                        {r.total > 0 ? (
                          <span style={{
                            fontWeight: 600,
                            color: r.brier <= 0.12 ? "#16a34a" : r.brier <= 0.18 ? "#ca8a04" : "#dc2626",
                          }}>
                            {r.brier.toFixed(4)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "#a8a29e", marginTop: 6 }}>
            Expected Adv = sum of all predicted probabilities for that round.
            Brier Score: 0 = perfect, 0.25 = coin flip. Lower is better.
          </p>
        </section>

        {/* ── CALIBRATION ─────────────────────────────────────── */}
        <section style={{ maxWidth: 900, margin: "0 auto 40px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, color: "#0a1a2f" }}>
            Calibration: Predicted vs Actual Advance Rate
          </h2>
          <p style={{ fontSize: 13, color: "#78716c", marginBottom: 12 }}>
            When we give a team a 30% chance, do ~30% of those teams actually advance?
            A well-calibrated model tracks close to the diagonal.
          </p>
          <div style={CARD}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left" }}>Predicted Range</th>
                  <th style={TH}>Count</th>
                  <th style={TH}>Avg Predicted</th>
                  <th style={TH}>Actual Rate</th>
                  <th style={TH}>Diff</th>
                  <th style={{ ...TH, minWidth: 200 }}>Visual</th>
                </tr>
              </thead>
              <tbody>
                {calibrationBuckets.map((b, i) => {
                  if (b.n === 0) return null;
                  const diff = b.actualRate - b.avgPred;
                  const barMaxWidth = 160;
                  return (
                    <tr key={b.label} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={{ ...TD, textAlign: "left", fontWeight: 600 }}>{b.label}</td>
                      <td style={TD}>{b.n}</td>
                      <td style={TD}>{pct(b.avgPred)}</td>
                      <td style={{
                        ...TD,
                        fontWeight: 700,
                        color: Math.abs(diff) <= 0.08 ? "#16a34a" : Math.abs(diff) <= 0.15 ? "#ca8a04" : "#dc2626",
                      }}>
                        {pct(b.actualRate)}
                      </td>
                      <td style={{
                        ...TD,
                        fontWeight: 600,
                        fontSize: 12,
                        color: Math.abs(diff) <= 0.08 ? "#16a34a" : Math.abs(diff) <= 0.15 ? "#ca8a04" : "#dc2626",
                      }}>
                        {diff > 0 ? "+" : ""}{(diff * 100).toFixed(1)}pp
                      </td>
                      <td style={{ ...TD, paddingLeft: 12 }}>
                        <div style={{ position: "relative", height: 18, width: barMaxWidth }}>
                          {/* predicted bar */}
                          <div style={{
                            position: "absolute", top: 0, left: 0, height: 8,
                            width: barMaxWidth * b.avgPred,
                            backgroundColor: "#cbd5e1", borderRadius: 3,
                          }} />
                          {/* actual bar */}
                          <div style={{
                            position: "absolute", top: 10, left: 0, height: 8,
                            width: barMaxWidth * b.actualRate,
                            backgroundColor: Math.abs(diff) <= 0.08 ? "#22c55e" : Math.abs(diff) <= 0.15 ? "#eab308" : "#ef4444",
                            borderRadius: 3,
                          }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#78716c" }}>
            <span><span style={{ display: "inline-block", width: 14, height: 8, backgroundColor: "#cbd5e1", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Predicted</span>
            <span><span style={{ display: "inline-block", width: 14, height: 8, backgroundColor: "#22c55e", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Actual</span>
            <span>All rounds combined (decided games only)</span>
          </div>
        </section>

        {/* ── TEAM-BY-TEAM TABLE ─────────────────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 12, color: "#0a1a2f" }}>
            Team-by-Team: Pre-Tournament Prediction vs Result
          </h2>

          {/* Region filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {regions.map((r) => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: regionFilter === r ? "2px solid #0a1a2f" : "1px solid #d6d3d1",
                  backgroundColor: regionFilter === r ? "#0a1a2f" : "#fff",
                  color: regionFilter === r ? "#facc15" : "#44403c",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <div style={{ ...CARD, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, textAlign: "left", cursor: "pointer" }} onClick={() => handleSort("seed")}>
                    Seed{arrow("seed")}
                  </th>
                  <th style={{ ...TH, textAlign: "left", cursor: "pointer", minWidth: 160 }} onClick={() => handleSort("team")}>
                    Team{arrow("team")}
                  </th>
                  <th style={{ ...TH, minWidth: 60 }}>Region</th>
                  <th style={{ ...TH, minWidth: 60 }}>Status</th>
                  {ROUNDS.map((r) => (
                    <th
                      key={r.key}
                      style={{ ...TH, cursor: "pointer", minWidth: 70 }}
                      onClick={() => handleSort(r.key)}
                    >
                      {r.short}{arrow(r.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((t, i) => {
                  const isAlive = t.eliminatedRound === "alive";
                  return (
                    <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={{ ...TD, fontWeight: 700, textAlign: "left" }}>#{t.seed}</td>
                      <td style={{ ...TD, textAlign: "left" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <NCAALogo teamName={t.team} size={20} />
                          <span style={{ fontWeight: 500 }}>{t.team}</span>
                        </span>
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "#78716c" }}>{t.region}</td>
                      <td style={{
                        ...TD,
                        fontSize: 12,
                        fontWeight: 600,
                        color: isAlive ? "#16a34a" : "#dc2626",
                      }}>
                        {isAlive ? "Alive" : `Out ${t.eliminatedRound}`}
                      </td>
                      {t.rounds.map((r) => {
                        let bg = "transparent";
                        let color = "#44403c";
                        let fontWeight: number = 400;

                        if (r.result === "advanced") {
                          bg = r.predicted >= 0.5 ? "#dcfce7" : "#fef9c3"; // green if predicted, yellow if upset
                          color = r.predicted >= 0.5 ? "#166534" : "#854d0e";
                          fontWeight = 600;
                        } else if (r.result === "eliminated") {
                          bg = r.predicted >= 0.5 ? "#fee2e2" : "transparent"; // red if we were wrong
                          color = r.predicted >= 0.5 ? "#991b1b" : "#a8a29e";
                          fontWeight = r.predicted >= 0.5 ? 600 : 400;
                        } else {
                          color = "#6366f1";
                        }

                        return (
                          <td key={r.key} style={{ ...TD, backgroundColor: bg, color, fontWeight }}>
                            {pct(r.predicted)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#78716c", flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: "#dcfce7", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Correctly predicted advance</span>
            <span><span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: "#fef9c3", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Upset (advanced, predicted &lt;50%)</span>
            <span><span style={{ display: "inline-block", width: 14, height: 14, backgroundColor: "#fee2e2", borderRadius: 3, verticalAlign: "middle", marginRight: 4 }} /> Missed (eliminated, predicted &gt;50%)</span>
          </div>
        </section>

      </div>
    </div>
  );
}

/* ================================================================
   BBMI Model Bracket — auto-picks from pre-tournament BBMI scores
   Same highlight / cross-out rules as bracket-challenge
   ================================================================ */

function BbmiBracket() {
  const bbmiScoreMap = useMemo(() => {
    const m: Record<string, number> = {};
    if (Array.isArray(rankingsData)) {
      for (const r of rankingsData as Record<string, unknown>[]) {
        const name = String(r.team ?? r.my_name ?? "");
        const score = Number(r.bbmi ?? r.bbmi_score ?? 0);
        if (name && score) m[name] = score;
      }
    }
    return m;
  }, []);

  // Build team objects from pre-tournament seeding
  const teams: BTeam[] = useMemo(() => {
    return (preSeeding as SeedRow[]).map((r) => ({
      name: r.Team,
      seed: r.CurrentSeed,
      region: r.Region,
      playIn: r.PlayIn,
      bbmi: bbmiScoreMap[r.Team] ?? 0,
    }));
  }, [bbmiScoreMap]);

  const regionMap = useMemo(() => {
    const m: Record<string, BTeam[]> = {};
    for (const t of teams) {
      if (!m[t.region]) m[t.region] = [];
      m[t.region].push(t);
    }
    for (const r of Object.keys(m)) m[r].sort((a, b) => a.seed - b.seed);
    return m;
  }, [teams]);

  // Auto-generate BBMI picks: at each matchup, pick the team with higher BBMI score
  const bbmiPicks = useMemo(() => {
    const picks: Record<string, string> = {};
    const teamByName = new Map(teams.map(t => [t.name, t]));

    for (const regionName of Object.keys(regionMap)) {
      const rTeams = regionMap[regionName];
      const getTeam = (seed: number) => rTeams.find(t => t.seed === seed && !t.playIn);

      // Play-ins: pick higher BBMI
      const piSeeds = new Set<number>();
      rTeams.filter(t => t.playIn).forEach(t => piSeeds.add(t.seed));
      for (const seed of piSeeds) {
        const piTeams = rTeams.filter(t => t.playIn && t.seed === seed);
        if (piTeams.length >= 2) {
          const winner = piTeams[0].bbmi >= piTeams[1].bbmi ? piTeams[0] : piTeams[1];
          picks[`PlayIn|${regionName}|${seed}`] = winner.name;
        }
      }

      // R64
      for (let i = 0; i < MATCHUPS.length; i++) {
        const [s1, s2] = MATCHUPS[i];
        let t1 = getTeam(s1);
        let t2 = getTeam(s2);
        // Check play-in winners
        if (!t1) { const piW = picks[`PlayIn|${regionName}|${s1}`]; if (piW) t1 = teamByName.get(piW); }
        if (!t2) { const piW = picks[`PlayIn|${regionName}|${s2}`]; if (piW) t2 = teamByName.get(piW); }
        if (t1 && t2) {
          picks[`R64|${regionName}|${i}`] = (t1.bbmi >= t2.bbmi ? t1 : t2).name;
        } else if (t1) {
          picks[`R64|${regionName}|${i}`] = t1.name;
        }
      }

      // R32
      for (let i = 0; i < 4; i++) {
        const a = teamByName.get(picks[`R64|${regionName}|${i * 2}`]);
        const b = teamByName.get(picks[`R64|${regionName}|${i * 2 + 1}`]);
        if (a && b) picks[`R32|${regionName}|${i}`] = (a.bbmi >= b.bbmi ? a : b).name;
        else if (a) picks[`R32|${regionName}|${i}`] = a.name;
      }

      // S16
      for (let i = 0; i < 2; i++) {
        const a = teamByName.get(picks[`R32|${regionName}|${i * 2}`]);
        const b = teamByName.get(picks[`R32|${regionName}|${i * 2 + 1}`]);
        if (a && b) picks[`S16|${regionName}|${i}`] = (a.bbmi >= b.bbmi ? a : b).name;
        else if (a) picks[`S16|${regionName}|${i}`] = a.name;
      }

      // E8
      const a = teamByName.get(picks[`S16|${regionName}|0`]);
      const b = teamByName.get(picks[`S16|${regionName}|1`]);
      if (a && b) picks[`E8|${regionName}|0`] = (a.bbmi >= b.bbmi ? a : b).name;
      else if (a) picks[`E8|${regionName}|0`] = a.name;
    }

    // Final Four: East vs South, West vs Midwest
    const teamByName2 = new Map(teams.map(t => [t.name, t]));
    const regionOrder = ["East", "South", "West", "Midwest"];
    const rw = regionOrder.map(r => teamByName2.get(picks[`E8|${r}|0`]));

    // Semi 1: East vs South
    if (rw[0] && rw[1]) picks["F4|Semi|0"] = (rw[0].bbmi >= rw[1].bbmi ? rw[0] : rw[1]).name;
    // Semi 2: West vs Midwest
    if (rw[2] && rw[3]) picks["F4|Semi|1"] = (rw[2].bbmi >= rw[3].bbmi ? rw[2] : rw[3]).name;

    // Championship
    const s1w = teamByName2.get(picks["F4|Semi|0"]);
    const s2w = teamByName2.get(picks["F4|Semi|1"]);
    if (s1w && s2w) picks["CHAMP|Final|0"] = (s1w.bbmi >= s2w.bbmi ? s1w : s2w).name;

    return picks;
  }, [teams, regionMap]);

  // Elimination tracking (same logic as bracket-challenge)
  const eliminatedIn = useMemo(() => {
    const elim = new Map<string, string>();
    for (const [k, winner] of Object.entries(ACTUAL_RESULTS)) {
      if (k === "_details") continue;
      const details = GAME_DETAILS[k];
      if (details) {
        for (const t of details.teams) {
          if (t !== winner && !elim.has(t)) {
            const round = k.split("|")[0];
            elim.set(t, round);
          }
        }
      }
    }
    return elim;
  }, []);

  const isBusted = (name: string | undefined, round: string) => {
    if (!name) return false;
    const elimRound = eliminatedIn.get(name);
    if (!elimRound) return false;
    return ROUND_ORDER.indexOf(elimRound) < ROUND_ORDER.indexOf(round);
  };

  // Scoring
  const ROUND_POINTS: Record<string, number> = { PlayIn: 5, R64: 10, R32: 20, S16: 40, E8: 80, F4: 160, CHAMP: 320 };
  const { totalPts, correctPicks, totalDecided, possiblePts } = useMemo(() => {
    let total = 0, correct = 0, decided = 0, possible = 0;
    for (const [k, pick] of Object.entries(bbmiPicks)) {
      const prefix = k.split("|")[0];
      const pts = ROUND_POINTS[prefix] ?? 0;
      if (!pts) continue;
      const actual = ACTUAL_RESULTS[k];
      if (actual) {
        decided++;
        if (actual === pick) { total += pts; correct++; possible += pts; }
      } else {
        // Game not played yet — still earnable if team hasn't been eliminated
        if (!eliminatedIn.has(pick)) possible += pts;
      }
    }
    return { totalPts: total, correctPicks: correct, totalDecided: decided, possiblePts: possible };
  }, [bbmiPicks, eliminatedIn]);

  const teamByName = useMemo(() => new Map(teams.map(t => [t.name, t])), [teams]);
  const REGION_ORDER = ["East", "South", "West", "Midwest"];
  const ROUND_LABELS = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Region Winner"];

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 4, color: "#0a1a2f" }}>
        BBMI Model Bracket (Pre-Tournament Picks)
      </h2>
      <p style={{ fontSize: 13, color: "#78716c", marginBottom: 16 }}>
        Auto-generated bracket: at every matchup the model picks the team with the higher BBMI score.
        Highlight and cross-out rules match the Bracket Challenge format.
      </p>

      {/* Score summary */}
      <div style={{ display: "flex", gap: 24, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Score", value: `${totalPts} pts` },
          { label: "Correct", value: `${correctPicks}/${totalDecided}` },
          { label: "Accuracy", value: totalDecided > 0 ? `${(correctPicks / totalDecided * 100).toFixed(1)}%` : "—" },
          { label: "Max Possible", value: `${possiblePts} pts` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: "10px 20px", borderRadius: 8,
            border: "1px solid #e7e5e4", backgroundColor: "#f9fafb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 11, color: "#78716c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0a1a2f" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Region brackets */}
      {REGION_ORDER.filter(r => regionMap[r]).map((regionName) => {
        const rTeams = regionMap[regionName];
        const getTeam = (seed: number) => rTeams.find(t => t.seed === seed && !t.playIn);

        const r64PairTops: number[] = [];
        let cursor = 0;
        MATCHUPS.forEach(() => { r64PairTops.push(cursor); cursor += PAIR_H + ROW_GAP; });
        const totalH = cursor - ROW_GAP;

        const R64_X = 0;
        const R32_X = TEAM_W + CONN_W;
        const S16_X = R32_X + TEAM_W + CONN_W;
        const E8_X = S16_X + TEAM_W + CONN_W;
        const F4_X = E8_X + TEAM_W + CONN_W;
        const TOTAL_W = F4_X + TEAM_W;

        const r32Tops = Array.from({ length: 8 }, (_, i) => r64PairTops[i] + PAIR_H / 2 - TEAM_H / 2);
        const s16Tops = Array.from({ length: 4 }, (_, i) => (r32Tops[i * 2] + TEAM_H / 2 + r32Tops[i * 2 + 1] + TEAM_H / 2) / 2 - TEAM_H / 2);
        const e8Tops = Array.from({ length: 2 }, (_, i) => (s16Tops[i * 2] + TEAM_H / 2 + s16Tops[i * 2 + 1] + TEAM_H / 2) / 2 - TEAM_H / 2);
        const f4Top = ((e8Tops[0] + TEAM_H / 2) + (e8Tops[1] + TEAM_H / 2)) / 2 - TEAM_H / 2;

        // What team is ACTUALLY in this position?
        // R64: teams are from seeding — always the seeded team
        // R32 pos N: winner of R64 slot N
        // S16 pos N: winner of R32 slot N
        // E8 pos N: winner of S16 slot N
        // Region Winner: winner of E8 slot 0
        function actualTeamInSlot(round: string, posSlot: number): string | null {
          if (round === "R64") return null; // means "always matches" — seeded teams are always correct
          if (round === "R32") return ACTUAL_RESULTS[`R64|${regionName}|${posSlot}`] ?? null;
          if (round === "S16") return ACTUAL_RESULTS[`R32|${regionName}|${posSlot}`] ?? null;
          if (round === "E8") return ACTUAL_RESULTS[`S16|${regionName}|${posSlot}`] ?? null;
          if (round === "F4") return ACTUAL_RESULTS[`E8|${regionName}|0`] ?? null;
          return null;
        }

        // Render a slot showing the MODEL's team, highlighted based on whether it matches actual
        function renderModelSlot(
          team: BTeam | undefined,
          round: string,
          gameKey: string,   // game key for scores
          posSlot: number,
          topY: number,
          leftX: number,
        ) {
          const sc = team ? getActualScore(gameKey, team.name) : null;

          let isCorrect = false;
          let busted = false;

          if (round === "R64") {
            // R64: check if this team actually made it to R64
            // For play-in seeds, verify the model's play-in pick matches the actual play-in winner
            const piKey = `PlayIn|${regionName}|${team?.seed}`;
            const piActual = ACTUAL_RESULTS[piKey];
            if (piActual) {
              // This seed had a play-in game
              isCorrect = team?.name === piActual;
              busted = !!team && team.name !== piActual;
            } else {
              // No play-in for this seed — team is always correctly in R64
              isCorrect = !!team;
            }
          } else {
            const actualHere = actualTeamInSlot(round, posSlot);
            if (actualHere !== null) {
              // We know who actually reached this position
              if (team?.name === actualHere) {
                isCorrect = true;  // model's team matches reality
              } else {
                busted = true;     // model has the wrong team here
              }
            }
            // actualHere === null means feeder game not played yet — no highlight
          }

          return (
            <div key={`${round}-${posSlot}-${team?.name ?? "empty"}`} style={{ position: "absolute", top: topY, left: leftX }}>
              <BracketSlot team={team} isPicked={true} isCorrect={isCorrect} isIncorrect={false}
                isBusted={busted} score={sc} winPct={null} />
            </div>
          );
        }

        return (
          <div key={regionName} style={{ marginBottom: 32 }}>
            <div style={{
              background: "linear-gradient(90deg, #0a1628 0%, #1e3a5f 100%)",
              color: "#fff", padding: "10px 18px", borderRadius: "10px 10px 0 0",
              fontWeight: 700, fontSize: 16,
            }}>
              {regionName} Region
            </div>
            <div style={{
              padding: "16px 20px", overflowX: "auto", backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 10px 10px",
            }}>
              {/* Round headers */}
              <div style={{ display: "flex", gap: CONN_W, marginBottom: 10 }}>
                {ROUND_LABELS.map(label => (
                  <div key={label} style={{
                    width: TEAM_W, textAlign: "center", fontSize: 9.5, fontWeight: 800,
                    textTransform: "uppercase", letterSpacing: "0.08em", color: "#f8fafc",
                    backgroundColor: "#0a1628", padding: "4px 6px", borderRadius: 4,
                  }}>
                    {label}
                  </div>
                ))}
              </div>

              <div style={{ position: "relative", height: totalH, width: TOTAL_W, minWidth: TOTAL_W }}>
                {/* R64 — all seeded teams, all green (they're all correctly in R64) */}
                {MATCHUPS.map(([s1, s2], i) => {
                  let t1 = getTeam(s1);
                  let t2 = getTeam(s2);
                  const piW1 = bbmiPicks[`PlayIn|${regionName}|${s1}`];
                  const piW2 = bbmiPicks[`PlayIn|${regionName}|${s2}`];
                  if (!t1 && piW1) t1 = teamByName.get(piW1);
                  if (!t2 && piW2) t2 = teamByName.get(piW2);
                  const gameKey = `R64|${regionName}|${i}`;
                  return (
                    <React.Fragment key={`r64-${i}`}>
                      {renderModelSlot(t1, "R64", gameKey, i, r64PairTops[i], R64_X)}
                      {renderModelSlot(t2, "R64", gameKey, i, r64PairTops[i] + TEAM_H + SLOT_GAP, R64_X)}
                    </React.Fragment>
                  );
                })}

                {/* R32 — model's R64 picks. Green if that team actually won R64. */}
                {Array.from({ length: 4 }, (_, i) => {
                  const a = teamByName.get(bbmiPicks[`R64|${regionName}|${i * 2}`]);
                  const b = teamByName.get(bbmiPicks[`R64|${regionName}|${i * 2 + 1}`]);
                  const gameKey = `R32|${regionName}|${i}`;
                  return (
                    <React.Fragment key={`r32-${i}`}>
                      {renderModelSlot(a, "R32", gameKey, i * 2, r32Tops[i * 2], R32_X)}
                      {renderModelSlot(b, "R32", gameKey, i * 2 + 1, r32Tops[i * 2 + 1], R32_X)}
                    </React.Fragment>
                  );
                })}

                {/* S16 — model's R32 picks. Green if that team actually won R32. */}
                {Array.from({ length: 2 }, (_, i) => {
                  const a = teamByName.get(bbmiPicks[`R32|${regionName}|${i * 2}`]);
                  const b = teamByName.get(bbmiPicks[`R32|${regionName}|${i * 2 + 1}`]);
                  const gameKey = `S16|${regionName}|${i}`;
                  return (
                    <React.Fragment key={`s16-${i}`}>
                      {renderModelSlot(a, "S16", gameKey, i * 2, s16Tops[i * 2], S16_X)}
                      {renderModelSlot(b, "S16", gameKey, i * 2 + 1, s16Tops[i * 2 + 1], S16_X)}
                    </React.Fragment>
                  );
                })}

                {/* E8 — model's S16 picks. Green if that team actually won S16. */}
                {(() => {
                  const a = teamByName.get(bbmiPicks[`S16|${regionName}|0`]);
                  const b = teamByName.get(bbmiPicks[`S16|${regionName}|1`]);
                  const gameKey = `E8|${regionName}|0`;
                  return (
                    <>
                      {renderModelSlot(a, "E8", gameKey, 0, e8Tops[0], E8_X)}
                      {renderModelSlot(b, "E8", gameKey, 1, e8Tops[1], E8_X)}
                    </>
                  );
                })()}

                {/* Region Winner — model's E8 pick */}
                {(() => {
                  const winner = teamByName.get(bbmiPicks[`E8|${regionName}|0`]);
                  const actualE8Winner = ACTUAL_RESULTS[`E8|${regionName}|0`];
                  const busted = winner ? isBusted(winner.name, "F4") : false;
                  const matchesActual = !!actualE8Winner && winner?.name === actualE8Winner;
                  return (
                    <div style={{ position: "absolute", top: f4Top, left: F4_X }}>
                      <BracketSlot team={winner} isPicked={true}
                        isCorrect={matchesActual} isIncorrect={false}
                        isBusted={busted && !matchesActual}
                        score={null} winPct={null} />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })}

      {/* Final Four */}
      <div style={{
        border: "2px solid #b45309", borderRadius: 12, overflow: "hidden",
        marginBottom: 32, background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
      }}>
        <div style={{
          background: "linear-gradient(90deg, #7c2d12 0%, #b45309 100%)",
          color: "#fff", padding: "12px 20px", fontWeight: 800, fontSize: 18, textAlign: "center",
        }}>
          Final Four & Championship
        </div>
        <div style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            {/* Semi 1: East vs South */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>East vs South</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["East", "South"].map(region => {
                  const team = teamByName.get(bbmiPicks[`E8|${region}|0`]);
                  const key = "F4|Semi|0";
                  // Does this team actually belong here? Check if they won E8
                  const actualE8Winner = ACTUAL_RESULTS[`E8|${region}|0`];
                  const matchesActual = !!actualE8Winner && team?.name === actualE8Winner;
                  const busted = !!actualE8Winner && team?.name !== actualE8Winner;
                  return (
                    <BracketSlot key={region} team={team} isPicked={true}
                      isCorrect={matchesActual}
                      isIncorrect={false}
                      isBusted={busted}
                      score={team ? getActualScore(key, team.name) : null} winPct={null} />
                  );
                })}
              </div>
            </div>

            {/* Champion */}
            <div style={{ textAlign: "center", alignSelf: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", textTransform: "uppercase", marginBottom: 6 }}>Champion</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[bbmiPicks["F4|Semi|0"], bbmiPicks["F4|Semi|1"]].filter(Boolean).map((name, idx) => {
                  const team = teamByName.get(name);
                  const key = "CHAMP|Final|0";
                  // Champion slot: check if team won their semifinal
                  const semiKey = idx === 0 ? "F4|Semi|0" : "F4|Semi|1";
                  const actualSemiWinner = ACTUAL_RESULTS[semiKey];
                  const matchesActual = !!actualSemiWinner && team?.name === actualSemiWinner;
                  const busted = team ? isBusted(team.name, "CHAMP") : false;
                  return (
                    <BracketSlot key={`champ-${idx}`} team={team} isPicked={true}
                      isCorrect={matchesActual}
                      isIncorrect={false}
                      isBusted={busted && !matchesActual}
                      score={team ? getActualScore(key, team.name) : null} winPct={null} />
                  );
                })}
              </div>
            </div>

            {/* Semi 2: West vs Midwest */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#78716c", textTransform: "uppercase", marginBottom: 6 }}>West vs Midwest</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["West", "Midwest"].map(region => {
                  const team = teamByName.get(bbmiPicks[`E8|${region}|0`]);
                  const key = "F4|Semi|1";
                  const actualE8Winner = ACTUAL_RESULTS[`E8|${region}|0`];
                  const matchesActual = !!actualE8Winner && team?.name === actualE8Winner;
                  const busted = !!actualE8Winner && team?.name !== actualE8Winner;
                  return (
                    <BracketSlot key={region} team={team} isPicked={true}
                      isCorrect={matchesActual}
                      isIncorrect={false}
                      isBusted={busted}
                      score={team ? getActualScore(key, team.name) : null} winPct={null} />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
