"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import NCAALogo from "@/components/NCAALogo";
import LogoBadge from "@/components/LogoBadge";
import games from "@/data/betting-lines/baseball-games.json";

const MIN_EDGE = 1.5;  // runs — minimum for record counting

type Game = {
  gameId: string; date: string; homeTeam: string; awayTeam: string;
  bbmiLine: number | null; vegasLine: number | null; bbmiTotal: number | null; vegasTotal: number | null;
  actualHomeScore: number | null; actualAwayScore: number | null;
  homeWinPct: number | null; edge: number | null; conference: string;
  homePitcher: string; awayPitcher: string; pitcherConfirmed: boolean;
  bbmiMoneylineHome: number | null; bbmiMoneylineAway: number | null;
};

function wilsonCI(wins: number, n: number) {
  if (n === 0) return { low: 0, high: 0 };
  const z = 1.96, p = wins / n, d = 1 + z * z / n;
  const c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { low: Math.max(0, (c - m) / d * 100), high: Math.min(100, (c + m) / d * 100) };
}

function didCover(g: Game): boolean | null {
  if (g.actualHomeScore == null || g.actualAwayScore == null || g.vegasLine == null || g.bbmiLine == null) return null;
  const margin = g.actualHomeScore - g.actualAwayScore;
  const pickIsHome = g.bbmiLine < g.vegasLine;
  const homeCovers = margin > -g.vegasLine;
  if (margin === -g.vegasLine) return null; // push
  return pickIsHome ? homeCovers : !homeCovers;
}

const TH: React.CSSProperties = { backgroundColor: "#0a1628", color: "#fff", padding: "8px 10px", textAlign: "center", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "2px solid rgba(255,255,255,0.1)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", userSelect: "none" };
const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
const TDM: React.CSSProperties = { ...TD, textAlign: "center", fontFamily: "ui-monospace, monospace", color: "#57534e" };
const TDR: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };

export default function BaseballAccuracyPage() {
  const allGames = (games as Game[]).filter(g => g.homeTeam && g.awayTeam);

  // Completed games with Vegas lines
  const completed = useMemo(() =>
    allGames.filter(g => g.actualHomeScore != null && g.actualAwayScore != null && g.vegasLine != null && g.bbmiLine != null),
  [allGames]);

  const [minEdge, setMinEdge] = useState(0);
  const edgeOptions = [0, 1, 1.5, 2, 2.5, 3, 4];

  const filtered = useMemo(() => {
    if (minEdge === 0) return completed;
    return completed.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= minEdge);
  }, [completed, minEdge]);

  // ATS record
  const record = useMemo(() => {
    const qual = filtered.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= MIN_EDGE);
    let wins = 0, losses = 0, pushes = 0;
    qual.forEach(g => {
      const r = didCover(g);
      if (r === true) wins++;
      else if (r === false) losses++;
      else pushes++;
    });
    const total = wins + losses;
    const pct = total > 0 ? ((wins / total) * 100).toFixed(1) : "—";
    const { low, high } = wilsonCI(wins, total);
    return { wins, losses, pushes, total, pct, ciLow: low, ciHigh: high };
  }, [filtered]);

  // Edge performance by bucket
  const edgePerf = useMemo(() => {
    const cats = [
      { name: "1.5–2", min: 1.5, max: 2 },
      { name: "2–3", min: 2, max: 3 },
      { name: "3–4", min: 3, max: 4 },
      { name: "≥ 4", min: 4, max: Infinity },
    ];
    return cats.map(cat => {
      const g = completed.filter(g => {
        const edge = Math.abs(g.bbmiLine! - g.vegasLine!);
        return edge >= cat.min && edge < cat.max;
      });
      let w = 0, l = 0;
      g.forEach(game => { const r = didCover(game); if (r === true) w++; else if (r === false) l++; });
      const total = w + l;
      const { low, high } = wilsonCI(w, total);
      return { name: cat.name, games: total, wins: w, pct: total > 0 ? ((w / total) * 100).toFixed(1) : "—", ciLow: low, ciHigh: high };
    });
  }, [completed]);

  // Weekly breakdown
  const weeklyData = useMemo(() => {
    const dates = [...new Set(filtered.map(g => g.date.split("T")[0]))].sort();
    if (dates.length === 0) return [];
    const addDays = (d: string, n: number) => {
      const dt = new Date(d + "T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    const weeks: { start: string; end: string; wins: number; losses: number }[] = [];
    let cur = dates[0];
    while (cur <= dates[dates.length - 1]) {
      const end = addDays(cur, 6);
      let w = 0, l = 0;
      filtered.forEach(g => {
        const d = g.date.split("T")[0];
        if (d >= cur && d <= end && Math.abs(g.bbmiLine! - g.vegasLine!) >= MIN_EDGE) {
          const r = didCover(g);
          if (r === true) w++; else if (r === false) l++;
        }
      });
      if (w + l > 0) weeks.push({ start: cur, end, wins: w, losses: l });
      cur = addDays(cur, 7);
    }
    return weeks.reverse();
  }, [filtered]);

  // Team performance
  const teamPerf = useMemo(() => {
    const stats: Record<string, { games: number; wins: number }> = {};
    filtered.filter(g => Math.abs(g.bbmiLine! - g.vegasLine!) >= MIN_EDGE).forEach(g => {
      const pickIsHome = g.bbmiLine! < g.vegasLine!;
      const team = pickIsHome ? g.homeTeam : g.awayTeam;
      if (!stats[team]) stats[team] = { games: 0, wins: 0 };
      stats[team].games++;
      if (didCover(g) === true) stats[team].wins++;
    });
    return Object.entries(stats).filter(([, s]) => s.games >= 2)
      .map(([team, s]) => ({ team, ...s, pct: (s.wins / s.games) * 100 }))
      .sort((a, b) => b.pct - a.pct || b.games - a.games);
  }, [filtered]);

  const [sortKey, setSortKey] = useState<string>("edge");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const handleSort = (k: string) => { if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  const sortedGames = useMemo(() => {
    const withComputed = filtered.map(g => ({
      ...g,
      _edge: Math.abs(g.bbmiLine! - g.vegasLine!),
      _margin: (g.actualHomeScore ?? 0) - (g.actualAwayScore ?? 0),
      _result: didCover(g),
      _pick: g.bbmiLine! < g.vegasLine! ? g.homeTeam : g.awayTeam,
    }));
    return [...withComputed].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === "edge") { av = a._edge; bv = b._edge; }
      else if (sortKey === "date") { av = a.date; bv = b.date; }
      else if (sortKey === "margin") { av = a._margin; bv = b._margin; }
      else if (sortKey === "result") { av = a._result === true ? 1 : 0; bv = b._result === true ? 1 : 0; }
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const SortTH = ({ label, k }: { label: string; k: string }) => (
    <th onClick={() => handleSort(k)} style={{ ...TH, cursor: "pointer" }}>
      {label} {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

        {/* HEADER */}
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            <LogoBadge league="ncaa-baseball" />
            <span style={{ marginLeft: 12 }}>Baseball Model Accuracy</span>
          </h1>
          <p style={{ color: "#78716c", fontSize: 14, textAlign: "center", maxWidth: 560, marginTop: 8 }}>Full public log of every BBMI baseball pick vs actual results</p>
        </div>

        {/* HEADLINE STATS */}
        <div style={{ maxWidth: 700, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
          {[
            { value: record.total > 0 ? `${record.pct}%` : "—", label: `ATS Record (≥ ${MIN_EDGE})`, sub: `${record.wins}–${record.losses}${record.pushes > 0 ? ` · ${record.pushes} push` : ""} · ${record.total} games`, color: record.total > 0 ? (Number(record.pct) >= 52.4 ? "#16a34a" : "#dc2626") : "#94a3b8" },
            { value: record.total > 0 ? `${record.ciLow.toFixed(1)}–${record.ciHigh.toFixed(1)}%` : "—", label: "95% Confidence", sub: "Wilson score interval", color: "#0a1628" },
            { value: completed.length.toString(), label: "Games Tracked", sub: "with Vegas lines + results", color: "#0a1628" },
          ].map(c => (
            <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1628", margin: "4px 0 3px" }}>{c.label}</div>
              <div style={{ fontSize: "0.65rem", color: "#78716c" }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* CALIBRATION NOTICE */}
        <div style={{ maxWidth: 700, margin: "0 auto 2rem", backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
          <p style={{ fontSize: "0.78rem", color: "#78350f", margin: 0, lineHeight: 1.5 }}>
            <strong>⚠ Calibration Phase:</strong> The baseball model launched in March 2026. Results will be tracked transparently from day one. Statistical confidence requires 200+ games with Vegas lines. Bet recommendations will not be shown until parameters are locked.
          </p>
        </div>

        {/* EDGE PERFORMANCE TABLE */}
        {completed.length >= 5 && (
          <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1628", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Performance by Edge Size (Runs)</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>
                  {["Edge", "Games", "Win %", "95% CI"].map(h => <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#fff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {edgePerf.map((s, i) => (
                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={{ ...TDM, fontWeight: 600 }}>{s.name}</td>
                      <td style={TDM}>{s.games}</td>
                      <td style={{ ...TDM, fontWeight: 700, color: s.games > 0 && Number(s.pct) >= 52.4 ? "#16a34a" : s.games > 0 ? "#dc2626" : "#94a3b8" }}>{s.pct}{s.games > 0 ? "%" : ""}</td>
                      <td style={{ ...TDM, fontSize: 11, color: "#78716c", fontStyle: "italic" }}>{s.games > 0 ? `${s.ciLow.toFixed(1)}–${s.ciHigh.toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WEEKLY BREAKDOWN */}
        {weeklyData.length > 0 && (
          <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1628", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Weekly Breakdown</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>
                  {["Week", "W–L", "Win %", "95% CI"].map(h => <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#fff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {weeklyData.map((w, i) => {
                    const total = w.wins + w.losses;
                    const pct = total > 0 ? (w.wins / total * 100).toFixed(1) : "—";
                    const { low, high } = wilsonCI(w.wins, total);
                    const startLabel = new Date(w.start + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                        <td style={{ ...TDM, fontSize: 12 }}>{startLabel}</td>
                        <td style={{ ...TDM, fontWeight: 700 }}>{w.wins}–{w.losses}</td>
                        <td style={{ ...TDM, fontWeight: 700, color: total > 0 && Number(pct) >= 52.4 ? "#16a34a" : "#dc2626" }}>{pct}{total > 0 ? "%" : ""}</td>
                        <td style={{ ...TDM, fontSize: 11, color: "#78716c", fontStyle: "italic" }}>{total > 0 ? `${low.toFixed(1)}–${high.toFixed(1)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TEAM PERFORMANCE */}
        {teamPerf.length > 0 && (
          <div style={{ maxWidth: 580, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1628", color: "#fff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>Team Performance (≥ 2 picks)</div>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>
                  {["Team", "Picks", "Win %"].map(h => <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#fff", padding: "7px 10px", textAlign: h === "Team" ? "left" : "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {teamPerf.slice(0, 15).map((t, i) => (
                    <tr key={t.team} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff" }}>
                      <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(t.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={t.team} size={20} /><span style={{ fontWeight: 600, fontSize: 13 }}>{t.team}</span></Link></td>
                      <td style={TDM}>{t.wins}–{t.games - t.wins}</td>
                      <td style={{ ...TDM, fontWeight: 700, color: t.pct >= 52.4 ? "#16a34a" : "#dc2626" }}>{t.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EDGE FILTER */}
        <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Minimum Edge Filter:</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {edgeOptions.map(e => {
              const active = minEdge === e;
              return (
                <button key={e} onClick={() => setMinEdge(e)} style={{
                  height: 34, padding: "0 14px", borderRadius: 999,
                  border: active ? "2px solid #0a1628" : "2px solid #d6d3d1",
                  backgroundColor: active ? "#0a1628" : "#fff",
                  color: active ? "#fff" : "#44403c",
                  fontSize: "0.82rem", fontWeight: active ? 700 : 500, cursor: "pointer",
                }}>{e === 0 ? "All" : `≥ ${e}`}</button>
              );
            })}
          </div>
          <div style={{ fontSize: 13, color: "#57534e" }}>Showing <strong>{sortedGames.length}</strong> games</div>
        </div>

        {/* GAME-BY-GAME TABLE */}
        <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
          <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 850 }}>
                <thead><tr>
                  <SortTH label="Date" k="date" />
                  <th style={{ ...TH, textAlign: "left" }}>Away</th>
                  <th style={{ ...TH, textAlign: "left" }}>Home</th>
                  <th style={TH}>Vegas</th>
                  <th style={TH}>BBMI</th>
                  <SortTH label="Edge" k="edge" />
                  <th style={TH}>Pick</th>
                  <th style={TH}>Score</th>
                  <SortTH label="Margin" k="margin" />
                  <SortTH label="Result" k="result" />
                </tr></thead>
                <tbody>
                  {sortedGames.length === 0 && (
                    <tr><td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No completed games with Vegas lines yet.</td></tr>
                  )}
                  {sortedGames.map((g, i) => {
                    const belowMin = g._edge < MIN_EDGE;
                    const isHigh = g._edge >= 3;
                    const rowBg = isHigh ? "rgba(254,252,232,0.7)" : belowMin ? "rgba(249,250,251,0.5)" : i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#fff";
                    return (
                      <tr key={g.gameId} style={{ backgroundColor: rowBg, opacity: belowMin ? 0.6 : 1 }}>
                        <td style={{ ...TDM, fontSize: 12 }}>{g.date}</td>
                        <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(g.awayTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={g.awayTeam} size={18} /><span style={{ fontSize: 12 }}>{g.awayTeam}</span></Link></td>
                        <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(g.homeTeam)}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={g.homeTeam} size={18} /><span style={{ fontSize: 12 }}>{g.homeTeam}</span></Link></td>
                        <td style={TDM}>{g.vegasLine}</td>
                        <td style={TDM}>{g.bbmiLine}</td>
                        <td style={{ ...TDM, fontWeight: isHigh ? 800 : 500, color: isHigh ? "#92400e" : belowMin ? "#b0b8c1" : "#6b7280", backgroundColor: isHigh ? "rgba(250,204,21,0.15)" : "transparent" }}>
                          {belowMin ? "~" : ""}{g._edge.toFixed(1)}
                        </td>
                        <td style={TD}><Link href={`/baseball/team/${encodeURIComponent(g._pick)}`} style={{ display: "flex", alignItems: "center", gap: 5, color: "inherit", textDecoration: "none" }}><NCAALogo teamName={g._pick} size={16} /><span style={{ fontSize: 12, fontWeight: 600 }}>{g._pick}</span></Link></td>
                        <td style={{ ...TDM, fontSize: 12 }}>{g.actualAwayScore}–{g.actualHomeScore}</td>
                        <td style={TDM}>{g._margin > 0 ? "+" : ""}{g._margin}</td>
                        <td style={{ ...TDM, fontWeight: 700, color: g._result === true ? "#16a34a" : g._result === false ? "#dc2626" : "#94a3b8" }}>
                          {g._result === true ? "✓" : g._result === false ? "✗" : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
