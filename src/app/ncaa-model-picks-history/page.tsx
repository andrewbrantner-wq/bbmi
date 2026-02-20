"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

const FREE_EDGE_LIMIT = 5;

type HistoricalGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  actualAwayScore: number | null;
  actualHomeScore: number | null;
  fakeBet: string | number | null;
  fakeWin: number | null;
};

type SortKey =
  | "date" | "away" | "home" | "vegasHomeLine" | "bbmiHomeLine"
  | "actualAwayScore" | "actualHomeScore" | "actualHomeLine"
  | "fakeBet" | "fakeWin" | "result";

type SortDirection = "asc" | "desc";

type SummaryData = {
  sampleSize: number;
  bbmiWinPct: string;
  fakeWagered: number;
  fakeWon: number;
  roi: string;
};

// ------------------------------------------------------------
// SHARED STYLES
// ------------------------------------------------------------

const TH: React.CSSProperties = {
  backgroundColor: "#0a1a2f",
  color: "#ffffff",
  padding: "8px 10px",
  textAlign: "center",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 20,
  borderBottom: "2px solid rgba(255,255,255,0.1)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  verticalAlign: "middle",
  userSelect: "none",
};

const TD: React.CSSProperties = {
  padding: "8px 10px",
  borderTop: "1px solid #f5f5f4",
  fontSize: 13,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };
const TD_CENTER: React.CSSProperties = { ...TD, textAlign: "center" };

// ------------------------------------------------------------
// TOOLTIPS
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  date: "The date the game was played.",
  away: "The visiting team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  home: "The home team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  vegasHomeLine: "The point spread set by sportsbooks. Negative = home team is favored.",
  bbmiHomeLine: "What BBMI's model predicted the spread should be. Compare to Vegas to understand the edge.",
  actualHomeLine: "The actual final margin from the home team's perspective.",
  actualAwayScore: "Final score for the away team.",
  actualHomeScore: "Final score for the home team.",
  fakeBet: "A simulated flat $100 wager placed on every game where BBMI's line differs from Vegas by at least the selected edge threshold.",
  fakeWin: "The simulated amount returned on the $100 bet. A winning bet typically returns ~$191-$195. $0 = loss.",
  result: "Whether BBMI's pick covered the Vegas spread. ✓ = correct pick, ✗ = incorrect pick.",
  teamPicked: "Number of games where BBMI's model picked this team to beat the Vegas spread.",
  teamWinPct: "How often BBMI's pick on this team was correct against the spread.",
  teamWagered: "Total simulated amount bet on this team at $100 flat per game.",
  teamWon: "Total simulated amount returned across all bets on this team.",
  teamRoi: "Return on investment for bets on this team. 0% = break even.",
};

// ------------------------------------------------------------
// HIGH EDGE CALLOUT
// ------------------------------------------------------------

function HighEdgeCallout({ overallWinPct, overallTotal, highEdgeWinPct, highEdgeTotal, highEdgeRoi, eliteEdgeWinPct, eliteEdgeTotal, eliteEdgeRoi }: {
  overallWinPct: string; overallTotal: number;
  highEdgeWinPct: string; highEdgeTotal: number; highEdgeRoi: string;
  eliteEdgeWinPct: string; eliteEdgeTotal: number; eliteEdgeRoi: string;
}) {
  const improvement = (Number(highEdgeWinPct) - Number(overallWinPct)).toFixed(1);
  const eliteImprovement = (Number(eliteEdgeWinPct) - Number(overallWinPct)).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#0a1a2f", borderRadius: 12, border: "2px solid #facc15", overflow: "hidden" }}>
      <style>{`
        .hec-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; padding: 1.25rem 1rem; gap: 0; }
        .hec-divider-v { width: 1px; background: rgba(255,255,255,0.1); align-self: stretch; margin: 0.25rem 0; }
        .hec-cta { grid-column: 1 / -1; border-top: 1px solid rgba(255,255,255,0.08); padding: 0.9rem 1rem 0.25rem; display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; text-align: center; }
        @media (min-width: 640px) {
          .hec-grid { grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; padding: 1.25rem 1.5rem; }
          .hec-divider-v { height: 56px; align-self: center; margin: 0; }
          .hec-cta { grid-column: auto; border-top: none; padding: 0 0.75rem; display: block; text-align: center; }
        }
      `}</style>

      <div style={{ backgroundColor: "rgba(250,204,21,0.1)", borderBottom: "1px solid rgba(250,204,21,0.2)", padding: "0.5rem 1.25rem", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>
        🎯 Where the model performs best
      </div>

      <div className="hec-grid">
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Overall</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.3rem" }}>{overallWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{overallTotal.toLocaleString()} picks</div>
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Edge ≥ {FREE_EDGE_LIMIT} pts</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1, marginBottom: "0.3rem" }}>{highEdgeWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{highEdgeTotal} picks</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(250,204,21,0.15)", color: "#facc15", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>+{improvement}pts</div>
        </div>

        <div className="hec-divider-v" />

        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>Edge ≥ 8 pts</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f97316", lineHeight: 1, marginBottom: "0.3rem" }}>{eliteEdgeWinPct}%</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>{eliteEdgeTotal} picks</div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(249,115,22,0.15)", color: "#f97316", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>+{eliteImprovement}pts</div>
        </div>

        <div className="hec-cta">
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", lineHeight: 1.5 }}>High-edge picks are <strong style={{ color: "#facc15" }}>premium-only</strong> on Today&apos;s Picks</div>
          <a href="/ncaa-todays-picks" style={{ display: "inline-block", backgroundColor: "#facc15", color: "#0a1a2f", padding: "0.5rem 1.1rem", borderRadius: 7, fontWeight: 800, fontSize: "0.8rem", textDecoration: "none", whiteSpace: "nowrap" }}>
            Unlock — $15 trial →
          </a>
          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginTop: "0.4rem" }}>or $49/mo — cancel anytime</div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// HOW TO READ ACCORDION
// ------------------------------------------------------------

function HowToReadAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", border: "1px solid #d6d3d1", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>📖 How do I use this page?</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px 24px", borderTop: "1px solid #d6d3d1", fontSize: 14, color: "#44403c", lineHeight: 1.65 }}>
          <p style={{ marginBottom: 12 }}>This page tracks every game BBMI has picked against the Vegas spread — with full results logged publicly, unedited, from the first pick of the season.</p>
          <p style={{ marginBottom: 12 }}><strong>The Edge Filter is the most important control on this page.</strong> "Edge" is the gap between BBMI's predicted line and the Vegas line. A higher edge means the model disagrees more strongly with Vegas. Historically, larger disagreements lead to better outcomes — try setting it to ≥ {FREE_EDGE_LIMIT}.0 and watch the accuracy climb.</p>
          <p style={{ marginBottom: 12 }}><strong>Each row is one game.</strong> The Vegas Line is what sportsbooks set. The BBMI Line is what the model predicted. When those two numbers differ, BBMI places a simulated flat $100 bet on its pick. The Bet, Win, and Result columns track whether that pick covered the spread.</p>
          <p style={{ marginBottom: 12 }}><strong>The Weekly Summary</strong> lets you check whether model performance is consistent over time — not just a lucky stretch. Use the week selector to browse any period in the season.</p>
          <p style={{ marginBottom: 12 }}><strong>Team Performance Analysis</strong> shows which teams the model has read best (and worst) this season. Click any team name to see its full schedule and detailed pick history.</p>
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "10px 14px", marginTop: 8 }}>
            <p style={{ fontSize: 13, color: "#166534", margin: 0, fontWeight: 600 }}>
              💡 Pro tip: Filter to edge ≥ {FREE_EDGE_LIMIT} pts to see the exact picks subscribers get on Today&apos;s Picks — historically the highest accuracy and ROI tier.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>All figures use simulated flat $100 wagers for illustration. This is not financial or gambling advice.</p>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// COLUMN DESC PORTAL
// ------------------------------------------------------------

function ColDescPortal({ tooltipId, anchorRect, onClose }: { tooltipId: string; anchorRect: DOMRect; onClose: () => void }) {
  const text = TOOLTIPS[tooltipId];
  const el = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
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
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort ↕</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc, stickyTop = 0 }: {
  label: React.ReactNode; columnKey: SortKey; tooltipId?: string;
  sortConfig: { key: SortKey; direction: SortDirection }; handleSort: (key: SortKey) => void;
  rowSpan?: number; activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
  stickyTop?: number;
}) {
  const isActive = sortConfig.key === columnKey;
  const thRef = React.useRef<HTMLTableCellElement>(null);
  const uid = tooltipId ? tooltipId + "_" + columnKey : null;
  const descShowing = !!(uid && activeDescId === uid);

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tooltipId && TOOLTIPS[tooltipId] && openDesc && uid) {
      descShowing ? closeDesc?.() : openDesc(uid, thRef.current?.getBoundingClientRect()!);
    }
  };

  return (
    <th ref={thRef} rowSpan={rowSpan} style={{ ...TH, cursor: "default", top: stickyTop }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <span onClick={handleLabelClick} style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// SUMMARY CARD
// ------------------------------------------------------------

function SummaryCard({ title, data, colors }: { title: string; data: SummaryData; colors: { winPct: string; won: string; roi: string } }) {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto 2rem", border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
      <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
          <thead>
            <tr>
              {["Sample Size", "% Beats Vegas", "Wagered", "Won", "ROI"].map((h) => (
                <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, color: "#0a1a2f", padding: "28px 16px", whiteSpace: "nowrap" }}>{data.sampleSize.toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "28px 16px", color: colors.winPct, whiteSpace: "nowrap" }}>{data.bbmiWinPct}%</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "28px 16px", color: "#dc2626", whiteSpace: "nowrap" }}>${data.fakeWagered.toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "28px 16px", color: colors.won, whiteSpace: "nowrap" }}>${data.fakeWon.toLocaleString()}</td>
              <td style={{ ...TD_CENTER, fontSize: "1.5rem", fontWeight: 800, padding: "28px 16px", color: colors.roi, whiteSpace: "nowrap" }}>{data.roi}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN PAGE
// ------------------------------------------------------------

export default function BettingLinesPage() {
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);
  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  const edgeStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";

    const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const highEdgeWon = highEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const highEdgeRoi = highEdge.length > 0 ? ((highEdgeWon / (highEdge.length * 100)) * 100 - 100).toFixed(1) : "0.0";

    const eliteEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= 8);
    const eliteEdgeWins = eliteEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const eliteEdgeWinPct = eliteEdge.length > 0 ? ((eliteEdgeWins / eliteEdge.length) * 100).toFixed(1) : "0.0";
    const eliteEdgeWon = eliteEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const eliteEdgeRoi = eliteEdge.length > 0 ? ((eliteEdgeWon / (eliteEdge.length * 100)) * 100 - 100).toFixed(1) : "0.0";

    return { overallWinPct, overallTotal: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length, highEdgeRoi, eliteEdgeWinPct, eliteEdgeTotal: eliteEdge.length, eliteEdgeRoi };
  }, [historicalGames]);

  const [minEdge, setMinEdge] = useState<number>(0);
  const [teamSearch, setTeamSearch] = useState<string>("");
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);

  const edgeOptions = useMemo(() => { const o = [0]; for (let i = 0.5; i <= 10; i += 0.5) o.push(i); return o; }, []);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    historicalGames.forEach((g) => { if (g.away) teams.add(String(g.away)); if (g.home) teams.add(String(g.home)); });
    return Array.from(teams).sort();
  }, [historicalGames]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch) return [];
    return allTeams.filter((t) => t.toLowerCase().includes(teamSearch.toLowerCase())).slice(0, 10);
  }, [teamSearch, allTeams]);

  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return historicalGames;
    return historicalGames.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= minEdge);
  }, [historicalGames, minEdge]);

  const teamAndEdgeFilteredGames = useMemo(() => {
    if (!selectedTeam) return edgeFilteredGames;
    return edgeFilteredGames.filter((g) => String(g.away) === selectedTeam || String(g.home) === selectedTeam);
  }, [edgeFilteredGames, selectedTeam]);

  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    teamAndEdgeFilteredGames.forEach((g) => {
      if (Number(g.fakeBet || 0) <= 0) return;
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const pickedTeam = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      if (!records[pickedTeam]) records[pickedTeam] = { wins: 0, picks: 0 };
      records[pickedTeam].picks++;
      if (Number(g.fakeWin || 0) > 0) records[pickedTeam].wins++;
    });
    return records;
  }, [teamAndEdgeFilteredGames]);

  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    return { wins: record.wins, picks: record.picks, display: `${record.wins}-${record.picks - record.wins}`, color: record.wins / record.picks >= 0.5 ? "#16a34a" : "#dc2626" };
  };

  const betHistorical = useMemo(() => {
    const bets = teamAndEdgeFilteredGames.filter((g) => Number(g.fakeBet) > 0);
    if (!selectedTeam) return bets;
    return bets.filter((g) => {
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return false;
      return (bbmiLine < vegasLine ? String(g.home) : String(g.away)) === selectedTeam;
    });
  }, [teamAndEdgeFilteredGames, selectedTeam]);

  const sampleSize = betHistorical.length;
  const wins = betHistorical.filter((g) => Number(g.fakeWin) > 0).length;
  const fakeWagered = betHistorical.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
  const fakeWon = betHistorical.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 - 100 : 0;
  const summary: SummaryData = { sampleSize, bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0", fakeWagered, fakeWon, roi: roi.toFixed(1) };

  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const g of teamAndEdgeFilteredGames) { if (g.date) dates.add(g.date.split("T")[0].split(" ")[0]); }
    return Array.from(dates).sort();
  }, [teamAndEdgeFilteredGames]);

  const weekRanges = useMemo(() => {
    if (allDates.length === 0) return [];
    const ranges: Array<{ start: string; end: string }> = [];
    const addDays = (d: string, n: number) => {
      const [y, m, day] = d.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, day));
      dt.setUTCDate(dt.getUTCDate() + n);
      return dt.toISOString().slice(0, 10);
    };
    let cur = allDates[0];
    while (cur <= allDates[allDates.length - 1]) {
      const end = addDays(cur, 6);
      if (teamAndEdgeFilteredGames.some((g) => { if (!g.date) return false; const d = g.date.split("T")[0].split(" ")[0]; return d >= cur && d <= end; })) ranges.push({ start: cur, end });
      cur = addDays(cur, 7);
    }
    return ranges.reverse();
  }, [allDates, teamAndEdgeFilteredGames]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  const filteredHistorical = useMemo(() => {
    const range = weekRanges[selectedWeekIndex];
    if (!range) return [];
    return teamAndEdgeFilteredGames.filter((g) => { if (!g.date) return false; const d = g.date.split("T")[0].split(" ")[0]; return d >= range.start && d <= range.end; });
  }, [teamAndEdgeFilteredGames, weekRanges, selectedWeekIndex]);

  const betWeekly = filteredHistorical.filter((g) => Number(g.fakeBet) > 0);
  const weeklyWins = betWeekly.filter((g) => Number(g.fakeWin) > 0).length;
  const weeklyFakeWagered = betWeekly.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
  const weeklyFakeWon = betWeekly.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const weeklyRoi = weeklyFakeWagered > 0 ? (weeklyFakeWon / weeklyFakeWagered) * 100 - 100 : 0;
  const weeklySummary: SummaryData = { sampleSize: betWeekly.length, bbmiWinPct: betWeekly.length > 0 ? ((weeklyWins / betWeekly.length) * 100).toFixed(1) : "0", fakeWagered: weeklyFakeWagered, fakeWon: weeklyFakeWon, roi: weeklyRoi.toFixed(1) };

  const teamPerformance = useMemo(() => {
    const stats: Record<string, { games: number; wins: number; wagered: number; won: number }> = {};
    betHistorical.forEach((g) => {
      const vegasLine = g.vegasHomeLine ?? 0, bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const team = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      if (!stats[team]) stats[team] = { games: 0, wins: 0, wagered: 0, won: 0 };
      stats[team].games++;
      if (Number(g.fakeWin) > 0) stats[team].wins++;
      stats[team].wagered += Number(g.fakeBet || 0);
      stats[team].won += Number(g.fakeWin || 0);
    });
    return Object.entries(stats).filter(([_, s]) => s.games >= 3)
      .map(([team, s]) => ({ team, games: s.games, winPct: (s.wins / s.games) * 100, roi: s.wagered > 0 ? (s.won / s.wagered) * 100 - 100 : 0, wagered: s.wagered, won: s.won }))
      .sort((a, b) => b.winPct - a.winPct);
  }, [betHistorical]);

  const [showTopTeams, setShowTopTeams] = useState(true);
  const [teamReportSize, setTeamReportSize] = useState(5);
  const displayedTeams = useMemo(() => showTopTeams ? teamPerformance.slice(0, teamReportSize) : teamPerformance.slice(-teamReportSize).reverse(), [teamPerformance, showTopTeams, teamReportSize]);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: "date", direction: "asc" });
  const handleSort = (key: SortKey) => setSortConfig((p) => ({ key, direction: p.key === key && p.direction === "asc" ? "desc" : "asc" }));

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = React.useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = React.useCallback(() => setDescPortal(null), []);

  const historicalWithComputed = filteredHistorical.map((g) => ({
    ...g,
    actualHomeLine: (g.actualAwayScore ?? 0) - (g.actualHomeScore ?? 0),
    result: Number(g.fakeBet) > 0 ? (Number(g.fakeWin) > 0 ? "win" : "loss") : "",
  }));

  const sortedHistorical = useMemo(() => {
    const sorted = [...historicalWithComputed];
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key], bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1; if (bVal == null) return -1;
      if (typeof aVal === "number" && typeof bVal === "number") return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      return sortConfig.direction === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [historicalWithComputed, sortConfig]);

  const handleTeamSelect = (team: string) => { setSelectedTeam(team); setTeamSearch(team); setShowSuggestions(false); setSelectedWeekIndex(0); };
  const handleClearTeam = () => { setSelectedTeam(""); setTeamSearch(""); setSelectedWeekIndex(0); };

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}

      <div className="section-wrapper" style={{ backgroundColor: "#fafaf9", minHeight: "100vh" }}>
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>Men&apos;s Picks Model Accuracy</span>
            </h1>
            <p style={{ color: "#57534e", fontSize: 14, marginTop: 4 }}>Weekly comparison of BBMI model vs Vegas lines</p>
          </div>

          {/* HOW TO READ */}
          <HowToReadAccordion />

          {/* HIGH EDGE CALLOUT */}
          <HighEdgeCallout {...edgeStats} />

          {/* FILTERS */}
          <div style={{ maxWidth: 1100, margin: "0 auto 8px", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Minimum Edge (|BBMI Line - Vegas Line|):</label>
              <select value={minEdge} onChange={(e) => setMinEdge(Number(e.target.value))}
                style={{ height: 38, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 12px", backgroundColor: "#ffffff", fontSize: 14, fontWeight: 500, color: "#1c1917" }}>
                {edgeOptions.map((edge) => <option key={edge} value={edge}>{edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: "#44403c" }}>Filter by Team:</label>
              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="text" placeholder="Search team name..." value={teamSearch} autoComplete="off"
                    onChange={(e) => { setTeamSearch(e.target.value); setShowSuggestions(true); if (!e.target.value) setSelectedTeam(""); }}
                    onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    style={{ height: 38, width: 240, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 12px", fontSize: 14, backgroundColor: "#ffffff" }} />
                  {selectedTeam && (
                    <button onClick={handleClearTeam} style={{ height: 38, padding: "0 12px", backgroundColor: "#e7e5e4", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Clear</button>
                  )}
                </div>
                {showSuggestions && filteredTeams.length > 0 && (
                  <div style={{ position: "absolute", width: "100%", marginTop: 4, backgroundColor: "#ffffff", border: "2px solid #d6d3d1", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto", zIndex: 999999 }}>
                    {filteredTeams.map((team) => (
                      <div key={team} onMouseDown={(e) => { e.preventDefault(); handleTeamSelect(team); }}
                        style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}
                        className="hover:bg-stone-50">
                        <NCAALogo teamName={team} size={20} /><span>{team}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* EDGE TIP */}
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic" }}>
              Tip: The model performs best when edge is highest. Try <strong>≥ {FREE_EDGE_LIMIT}.0 points</strong> to see picks where BBMI most strongly disagrees with Vegas.
              {minEdge >= FREE_EDGE_LIMIT && <span style={{ color: "#16a34a", fontWeight: 700 }}> ✓ You&apos;re viewing high-edge picks — {edgeStats.highEdgeWinPct}% accuracy at this threshold.</span>}
            </p>
          </div>

          {selectedTeam && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 16px", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <NCAALogo teamName={selectedTeam} size={24} />
                <span style={{ fontWeight: 600 }}>Showing results for: {selectedTeam}</span>
              </div>
            </div>
          )}

          {/* GLOBAL SUMMARY */}
          <SummaryCard
            title={selectedTeam ? `Summary Metrics — ${selectedTeam}` : "Summary Metrics"}
            data={summary}
            colors={{ winPct: Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626", won: summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626", roi: Number(summary.roi) > 0 ? "#16a34a" : "#dc2626" }}
          />

          {/* TEAM PERFORMANCE TABLE */}
          {!selectedTeam && teamPerformance.length > 0 && (
            <div style={{ maxWidth: 900, margin: "0 auto 40px" }}>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Team Performance Analysis
                </div>
                <div style={{ backgroundColor: "#fafaf9", padding: 16, borderBottom: "1px solid #e7e5e4", display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#44403c" }}>Show:</label>
                    <select value={showTopTeams ? "top" : "bottom"} onChange={(e) => setShowTopTeams(e.target.value === "top")}
                      style={{ height: 34, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 8px", fontSize: 13, backgroundColor: "#ffffff" }}>
                      <option value="top">Best Performing Teams</option>
                      <option value="bottom">Worst Performing Teams</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#44403c" }}>Number of Teams:</label>
                    <select value={teamReportSize} onChange={(e) => setTeamReportSize(Number(e.target.value))}
                      style={{ height: 34, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 8px", fontSize: 13, backgroundColor: "#ffffff" }}>
                      {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        {["Rank", "Team", "Picked", "Win %", "Wagered", "Won", "ROI"].map((h) => (
                          <th key={h} style={{ ...TH, position: "sticky", top: 0 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTeams.map((td, idx) => (
                        <tr key={td.team} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                          <td style={TD_CENTER}>{idx + 1}</td>
                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(td.team)}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f", fontWeight: 600, fontSize: 13 }} className="hover:underline">
                              <NCAALogo teamName={td.team} size={22} />{td.team}
                            </Link>
                          </td>
                          <td style={TD_CENTER}>{td.games}</td>
                          <td style={{ ...TD_CENTER, fontWeight: 700, color: td.winPct >= 50 ? "#16a34a" : "#dc2626" }}>{td.winPct.toFixed(1)}%</td>
                          <td style={{ ...TD_CENTER, color: "#dc2626", fontFamily: "ui-monospace, monospace" }}>${td.wagered.toLocaleString()}</td>
                          <td style={{ ...TD_CENTER, fontFamily: "ui-monospace, monospace", color: td.won >= td.wagered ? "#16a34a" : "#dc2626" }}>${td.won.toLocaleString()}</td>
                          <td style={{ ...TD_CENTER, fontWeight: 700, color: td.roi >= 0 ? "#16a34a" : "#dc2626" }}>{td.roi.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={7} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                          Minimum 3 games required. Based on current edge filter (≥{minEdge.toFixed(1)} points).
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* WEEK SELECTOR */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Historical Results By Week</h2>
            <p style={{ fontSize: 11, color: "#78716c", fontStyle: "italic", textAlign: "center" }}>Team records indicate Win-Loss when BBMI picks that team to beat Vegas.</p>
            <select value={selectedWeekIndex} onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              style={{ height: 38, border: "1px solid #d6d3d1", borderRadius: 6, padding: "0 12px", backgroundColor: "#ffffff", fontSize: 14, fontWeight: 500 }}>
              {weekRanges.map((range, idx) => {
                const fmt = (d: string) => { const [y, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}/${y}`; };
                return <option key={idx} value={idx}>{fmt(range.start)} – {fmt(range.end)}</option>;
              })}
            </select>
          </div>

          {/* WEEKLY SUMMARY */}
          <SummaryCard
            title={selectedTeam ? `Weekly Summary — ${selectedTeam}` : "Weekly Summary"}
            data={weeklySummary}
            colors={{ winPct: Number(weeklySummary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626", won: weeklySummary.fakeWon > weeklySummary.fakeWagered ? "#16a34a" : "#dc2626", roi: Number(weeklySummary.roi) > 0 ? "#16a34a" : "#dc2626" }}
          />

          {/* HISTORICAL RESULTS TABLE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Date"       columnKey="date"            tooltipId="date"            rowSpan={2} {...headerProps} />
                      <SortableHeader label="Away"       columnKey="away"            tooltipId="away"            rowSpan={2} {...headerProps} />
                      <SortableHeader label="Home"       columnKey="home"            tooltipId="home"            rowSpan={2} {...headerProps} />
                      <th colSpan={2} style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "8px 10px", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20, borderBottom: "1px solid rgba(255,255,255,0.25)" }}>
                        Home Line
                      </th>
                      <SortableHeader label="Actual Line" columnKey="actualHomeLine" tooltipId="actualHomeLine"  rowSpan={2} {...headerProps} />
                      <SortableHeader label="Away Sc."   columnKey="actualAwayScore" tooltipId="actualAwayScore" rowSpan={2} {...headerProps} />
                      <SortableHeader label="Home Sc."   columnKey="actualHomeScore" tooltipId="actualHomeScore" rowSpan={2} {...headerProps} />
                      <SortableHeader label="Bet"        columnKey="fakeBet"         tooltipId="fakeBet"         rowSpan={2} {...headerProps} />
                      <SortableHeader label="Win"        columnKey="fakeWin"         tooltipId="fakeWin"         rowSpan={2} {...headerProps} />
                      <SortableHeader label="Result"     columnKey="result"          tooltipId="result"          rowSpan={2} {...headerProps} />
                    </tr>
                    <tr>
                      <SortableHeader label="Vegas" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" stickyTop={33} {...headerProps} />
                      <SortableHeader label="BBMI"  columnKey="bbmiHomeLine"  tooltipId="bbmiHomeLine"  stickyTop={33} {...headerProps} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistorical.map((g, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                        <td style={{ ...TD, fontSize: 12 }}>{g.date}</td>
                        <td style={TD}>
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.away))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                            <NCAALogo teamName={String(g.away)} size={22} />
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                              {(() => { const r = getTeamRecord(String(g.away)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                            </div>
                          </Link>
                        </td>
                        <td style={TD}>
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.home))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                            <NCAALogo teamName={String(g.home)} size={22} />
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                              {(() => { const r = getTeamRecord(String(g.home)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                            </div>
                          </Link>
                        </td>
                        <td style={TD_RIGHT}>{g.vegasHomeLine}</td>
                        <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>
                        <td style={{ ...TD_RIGHT, fontWeight: 600 }}>{g.actualHomeLine}</td>
                        <td style={TD_RIGHT}>{g.actualAwayScore}</td>
                        <td style={TD_RIGHT}>{g.actualHomeScore}</td>
                        <td style={TD_RIGHT}>${g.fakeBet}</td>
                        <td style={{ ...TD_RIGHT, fontWeight: 600, color: Number(g.fakeWin) > 0 ? "#16a34a" : "#dc2626" }}>${g.fakeWin}</td>
                        <td style={TD_CENTER}>
                          {g.result === "win" ? <span style={{ color: "#16a34a", fontWeight: 900, fontSize: "1.1rem" }}>✓</span>
                            : g.result === "loss" ? <span style={{ color: "#dc2626", fontWeight: 900, fontSize: "1.1rem" }}>✗</span>
                            : ""}
                        </td>
                      </tr>
                    ))}
                    {sortedHistorical.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games for the selected week and filters.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
