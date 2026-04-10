"use client";

import { useState, useMemo } from "react";
import gamesData from "@/data/betting-lines/nfl-games.json";
import {
  OU_MIN_EDGE, OU_STRONG_EDGE, OU_PREMIUM_EDGE, OU_MAX_EDGE, OU_JUICE,
  SPORT_ACCENT,
} from "@/config/nfl-thresholds";

// ── Helpers ──────────────────────────────────────────────────
function wilsonCI(wins: number, n: number): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96;
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    low: Math.max(0, ((centre - margin) / denom) * 100),
    high: Math.min(100, ((centre + margin) / denom) * 100),
  };
}

function computeROI(w: number, n: number): number {
  if (n === 0) return 0;
  const juice = Math.abs(OU_JUICE);
  const payout = 100 / (juice / 100);
  const l = n - w;
  return (w * payout - l * 100) / (n * 100) * 100;
}

type NFLGame = {
  gameId?: string;
  date: string;
  week?: number;
  homeTeam: string;
  awayTeam: string;
  bbmiTotal?: number | null;
  vegasTotal?: number | null;
  ouPick?: string | null;
  ouConfidenceTier?: number | null;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
};

const allGames = gamesData as NFLGame[];

export default function NFLAccuracyPage() {
  const accent = SPORT_ACCENT;
  const [sortCol, setSortCol] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // ── Completed games with results ──
  const results = useMemo(() => {
    return allGames
      .filter(g =>
        g.actualHomeScore != null && g.actualAwayScore != null &&
        g.bbmiTotal != null && g.vegasTotal != null
      )
      .map(g => {
        const edge = Math.abs(g.bbmiTotal! - g.vegasTotal!);
        const qualifies = edge >= OU_MIN_EDGE && edge <= OU_MAX_EDGE;
        const actual = g.actualHomeScore! + g.actualAwayScore!;
        const call = g.bbmiTotal! < g.vegasTotal! ? "UNDER" : "OVER";
        const push = actual === g.vegasTotal!;
        const won = push ? null : (call === "OVER" ? actual > g.vegasTotal! : actual < g.vegasTotal!);
        return { ...g, edge, qualifies, actual, call, won, push };
      });
  }, []);

  const qualified = useMemo(() => results.filter(r => r.qualifies), [results]);
  const decided = useMemo(() => qualified.filter(r => r.won !== null), [qualified]);
  const wins = useMemo(() => decided.filter(r => r.won === true).length, [decided]);
  const losses = decided.length - wins;
  const pct = decided.length > 0 ? ((wins / decided.length) * 100).toFixed(1) : "---";
  const ci = wilsonCI(wins, decided.length);
  const roi = computeROI(wins, decided.length);

  // ── Tier breakdown ──
  const tiers = useMemo(() => {
    const tierDefs = [
      { name: "\u25CF", min: OU_MIN_EDGE, max: OU_STRONG_EDGE },
      { name: "\u25CF\u25CF", min: OU_STRONG_EDGE, max: OU_PREMIUM_EDGE },
      { name: "\u25CF\u25CF\u25CF", min: OU_PREMIUM_EDGE, max: OU_MAX_EDGE },
    ];
    return tierDefs.map(t => {
      const bucket = decided.filter(r =>
        r.edge >= t.min && (t.max === OU_MAX_EDGE ? r.edge <= t.max : r.edge < t.max)
      );
      const w = bucket.filter(r => r.won).length;
      const n = bucket.length;
      return {
        name: t.name, w, l: n - w, n,
        pct: n > 0 ? ((w / n) * 100).toFixed(1) : "---",
        ci: wilsonCI(w, n),
        roi: computeROI(w, n),
      };
    });
  }, [decided]);

  // ── Weekly breakdown ──
  const weekly = useMemo(() => {
    const byWeek = new Map<number, typeof decided>();
    decided.forEach(r => {
      const wk = r.week ?? 0;
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(r);
    });
    return Array.from(byWeek.entries())
      .sort(([a], [b]) => a - b)
      .map(([week, games]) => {
        const w = games.filter(g => g.won).length;
        const n = games.length;
        return {
          week, picks: n, w, l: n - w,
          pct: n > 0 ? ((w / n) * 100).toFixed(1) : "---",
          roi: computeROI(w, n),
        };
      });
  }, [decided]);

  // ── Sort game history ──
  const sorted = useMemo(() => {
    const s = [...results];
    s.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = a.date.localeCompare(b.date);
      else if (sortCol === "edge") cmp = a.edge - b.edge;
      else if (sortCol === "actual") cmp = a.actual - b.actual;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return s;
  }, [results, sortCol, sortDir]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const hasData = results.length > 0;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "#1c1917", margin: 0 }}>
          NFL Model Accuracy
        </h1>
        <p style={{ color: "#78716c", fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Totals pick performance &mdash; every game tracked transparently
        </p>
      </div>

      {!hasData ? (
        <div style={{
          background: "#f8f7f4", border: "1px solid #d4d2cc", borderRadius: 12,
          padding: "3rem 2rem", textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏈</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "#1c1917", marginBottom: "0.5rem" }}>
            Results Tracked Starting September 2026
          </h2>
          <p style={{ color: "#78716c", fontSize: "0.85rem" }}>
            Model validated at 56.0% ATS across 4 historical seasons (2022&ndash;2025).
            Live tracking begins when the 2026 NFL season starts.
          </p>
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div style={{
            background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12,
            padding: "1.5rem", marginBottom: "1.5rem", textAlign: "center",
          }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 800, color: Number(pct) >= 52.4 ? "#1a6640" : "#dc2626" }}>
              {pct}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "#78716c", marginBottom: "0.5rem" }}>
              {wins}W&ndash;{losses}L on {decided.length} qualifying picks
            </div>
            <div style={{ fontSize: "0.68rem", color: "#9ca3af" }}>
              95% CI: {ci.low.toFixed(1)}&ndash;{ci.high.toFixed(1)}% | ROI: {roi >= 0 ? "+" : ""}{roi.toFixed(1)}% at {OU_JUICE}
            </div>
          </div>

          {/* Tier breakdown */}
          <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12, overflow: "hidden", marginBottom: "1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ background: accent, color: "#fff" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Confidence</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Games</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Win %</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>95% CI</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>ROI</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8f7f4" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{t.name}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{t.n}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: t.n > 0 && Number(t.pct) >= 52.4 ? "#1a6640" : t.n > 0 ? "#dc2626" : "#78716c" }}>
                      {t.pct}{t.n > 0 ? "%" : ""}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontSize: "0.72rem", color: "#78716c" }}>
                      {t.n > 0 ? `${t.ci.low.toFixed(1)}\u2013${t.ci.high.toFixed(1)}%` : "---"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: t.roi >= 0 ? "#1a6640" : "#dc2626" }}>
                      {t.n > 0 ? `${t.roi >= 0 ? "+" : ""}${t.roi.toFixed(1)}%` : "---"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ padding: "8px 14px", textAlign: "center", fontSize: "0.65rem", color: "#78716c", background: "#f8f7f4" }}>
                    ROI at {OU_JUICE} juice
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Weekly breakdown */}
          {weekly.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12, overflow: "hidden", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ background: accent, color: "#fff" }}>
                    <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Week</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Picks</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Record</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>Win %</th>
                    <th style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, textTransform: "uppercase", fontSize: "0.68rem" }}>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map((wk, i) => (
                    <tr key={wk.week} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f8f7f4" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>Week {wk.week}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>{wk.picks}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>{wk.w}-{wk.l}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: Number(wk.pct) >= 52.4 ? "#1a6640" : "#dc2626" }}>
                        {wk.pct}%
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: wk.roi >= 0 ? "#1a6640" : "#dc2626" }}>
                        {wk.roi >= 0 ? "+" : ""}{wk.roi.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {/* Season total */}
                  <tr style={{ backgroundColor: "#e8edf4", fontWeight: 700 }}>
                    <td style={{ padding: "10px 14px" }}>Season Total</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{decided.length}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>{wins}-{losses}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", color: Number(pct) >= 52.4 ? "#1a6640" : "#dc2626" }}>{pct}%</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", color: roi >= 0 ? "#1a6640" : "#dc2626" }}>{roi >= 0 ? "+" : ""}{roi.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Game-by-game history */}
          <div style={{ background: "#fff", border: "1px solid #d4d2cc", borderRadius: 12, overflow: "hidden" }}>
            <h3 style={{ padding: "1rem 1.25rem 0.5rem", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", color: accent }}>
              Pick History
            </h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
                    {[
                      { key: "date", label: "Date" },
                      { key: "matchup", label: "Matchup" },
                      { key: "call", label: "Pick" },
                      { key: "edge", label: "Edge" },
                      { key: "vegas", label: "Vegas" },
                      { key: "bbmi", label: "BBMI" },
                      { key: "actual", label: "Actual" },
                      { key: "result", label: "Result" },
                    ].map(col => (
                      <th key={col.key}
                        onClick={() => toggleSort(col.key)}
                        style={{ padding: "8px 10px", textAlign: "center", cursor: "pointer", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", color: "#78716c" }}>
                        {col.label} {sortCol === col.key ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, 200).map((r, i) => (
                    <tr key={i} style={{
                      backgroundColor: i % 2 === 0 ? "#fff" : "#f8f7f4",
                      opacity: r.qualifies ? 1 : 0.5,
                    }}>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{r.date}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.awayTeam} @ {r.homeTeam}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: r.call === "UNDER" ? accent : "#92400e" }}>{r.call}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600 }}>{r.edge.toFixed(1)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>{r.vegasTotal}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>{r.bbmiTotal?.toFixed(1)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 600 }}>{r.actual}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center" }}>
                        {r.won === null ? (
                          <span style={{ color: "#78716c" }}>PUSH</span>
                        ) : r.won ? (
                          <span style={{ color: "#1a6640", fontWeight: 700 }}>W</span>
                        ) : (
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>L</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
