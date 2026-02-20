"use client";

import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";

/* -------------------------------------------------------
   FREE EDGE THRESHOLD — must match ncaa-todays-picks
-------------------------------------------------------- */
const FREE_EDGE_LIMIT = 5;

/* -------------------------------------------------------
   TYPES
-------------------------------------------------------- */
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

type SummaryColors = {
  winPct: string;
  won: string;
  roi: string;
};

/* -------------------------------------------------------
   TOOLTIP CONTENT
-------------------------------------------------------- */
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

/* -------------------------------------------------------
   HIGH EDGE CALLOUT — NEW
-------------------------------------------------------- */
function HighEdgeCallout({
  overallWinPct, overallTotal,
  highEdgeWinPct, highEdgeTotal, highEdgeRoi,
  eliteEdgeWinPct, eliteEdgeTotal, eliteEdgeRoi,
}: {
  overallWinPct: string; overallTotal: number;
  highEdgeWinPct: string; highEdgeTotal: number; highEdgeRoi: string;
  eliteEdgeWinPct: string; eliteEdgeTotal: number; eliteEdgeRoi: string;
}) {
  const improvement = (Number(highEdgeWinPct) - Number(overallWinPct)).toFixed(1);
  const eliteImprovement = (Number(eliteEdgeWinPct) - Number(overallWinPct)).toFixed(1);
  return (
    <div style={{
      backgroundColor: "#0a1a2f", borderRadius: 12,
      border: "2px solid #facc15",
      marginBottom: "2rem", overflow: "hidden",
    }}>
      {/* Responsive styles */}
      <style>{`
        .hec-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 1.25rem 1rem;
          gap: 0;
        }
        .hec-divider-v {
          width: 1px;
          background: rgba(255,255,255,0.1);
          align-self: stretch;
          margin: 0.25rem 0;
        }
        .hec-cta {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 0.9rem 1rem 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
          text-align: center;
        }
        @media (min-width: 640px) {
          .hec-grid {
            grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
            padding: 1.25rem 1.5rem;
          }
          .hec-divider-v {
            height: 56px;
            align-self: center;
            margin: 0;
          }
          .hec-cta {
            grid-column: auto;
            border-top: none;
            padding: 0 0.75rem;
            display: block;
            text-align: center;
          }
        }
      `}</style>

      {/* Header bar */}
      <div style={{
        backgroundColor: "rgba(250,204,21,0.1)",
        borderBottom: "1px solid rgba(250,204,21,0.2)",
        padding: "0.5rem 1.25rem",
        fontSize: "0.62rem", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.5)",
      }}>
        🎯 Where the model performs best
      </div>

      <div className="hec-grid">

        {/* Col 1: Overall */}
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>
            Overall
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1, marginBottom: "0.3rem" }}>
            {overallWinPct}%
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>
            {overallTotal.toLocaleString()} picks
          </div>
        </div>

        <div className="hec-divider-v" />

        {/* Col 2: Edge >= 5 */}
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>
            Edge ≥ {FREE_EDGE_LIMIT} pts
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1, marginBottom: "0.3rem" }}>
            {highEdgeWinPct}%
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>
            {highEdgeTotal} picks
          </div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(250,204,21,0.15)", color: "#facc15", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>
            +{improvement}pts
          </div>
        </div>

        <div className="hec-divider-v" />

        {/* Col 3: Elite edge >= 8 */}
        <div style={{ textAlign: "center", padding: "0 0.5rem" }}>
          <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", marginBottom: "0.4rem" }}>
            Edge ≥ 8 pts
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f97316", lineHeight: 1, marginBottom: "0.3rem" }}>
            {eliteEdgeWinPct}%
          </div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)" }}>
            {eliteEdgeTotal} picks
          </div>
          <div style={{ display: "inline-block", marginTop: "0.35rem", backgroundColor: "rgba(249,115,22,0.15)", color: "#f97316", fontSize: "0.58rem", fontWeight: 700, padding: "0.1rem 0.45rem", borderRadius: 999 }}>
            +{eliteImprovement}pts
          </div>
        </div>

        {/* CTA — spans full width on mobile, 4th col on desktop */}
        <div className="hec-cta">
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", lineHeight: 1.5 }}>
            High-edge picks are <strong style={{ color: "#facc15" }}>premium-only</strong> on Today's Picks
          </div>
          <a href="/ncaa-todays-picks" style={{
            display: "inline-block", backgroundColor: "#facc15", color: "#0a1a2f",
            padding: "0.5rem 1.1rem", borderRadius: 7,
            fontWeight: 800, fontSize: "0.8rem",
            textDecoration: "none", letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}>
            Unlock — $15 trial →
          </a>
          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.25)", marginTop: "0.4rem" }}>
            or $49/mo — cancel anytime
          </div>
        </div>

      </div>
    </div>
  );
}

/* -------------------------------------------------------
   SUMMARY CARD TOOLTIP
-------------------------------------------------------- */
function InfoTooltip({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const text = TOOLTIPS[id];
  if (!text) return null;
  return (
    <span className="relative inline-flex items-center ml-1" style={{ verticalAlign: "middle" }}>
      <button type="button" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); }}
        style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", padding: 0, lineHeight: 1 }}
        aria-label="More info">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <text x="8" y="12" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor">i</text>
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6, width: 200, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 100, padding: "8px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, fontWeight: "normal", whiteSpace: "normal", textAlign: "left" }}>
          {text}
        </div>
      )}
    </span>
  );
}

/* -------------------------------------------------------
   HOW TO READ THIS PAGE - ACCORDION
-------------------------------------------------------- */
function HowToReadAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: "100%", marginBottom: "1.5rem", border: "1px solid #d6d3d1", borderRadius: "8px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <button type="button" onClick={() => setOpen((p) => !p)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", textAlign: "left", fontWeight: 600, fontSize: 14, letterSpacing: "0.02em", backgroundColor: open ? "#1e3a5f" : "#0a1a2f", color: "#ffffff", border: "none", cursor: "pointer", borderRadius: open ? "8px 8px 0 0" : "8px", transition: "background-color 0.15s" }}>
        <span>📖 How do I use this page?</span>
        <span style={{ fontSize: 14 }}>{open ? "▲" : "▼"}</span>
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
              💡 Pro tip: Filter to edge ≥ {FREE_EDGE_LIMIT} pts to see the exact picks subscribers get on Today's Picks — historically the highest accuracy and ROI tier.
            </p>
          </div>
          <p style={{ fontSize: 12, color: "#78716c", marginTop: 10, marginBottom: 0 }}>All figures use simulated flat $100 wagers for illustration. This is not financial or gambling advice.</p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------
   COLUMN DESC PORTAL
-------------------------------------------------------- */
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
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, textAlign: "left", whiteSpace: "normal" }}>{text}</div>
      <div style={{ padding: "4px 12px 8px", fontSize: 11, color: "#64748b" }}>Click again to sort ↕</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------
   SORTABLE HEADER
-------------------------------------------------------- */
function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc }: {
  label: React.ReactNode; columnKey: SortKey; tooltipId?: string;
  sortConfig: { key: SortKey; direction: SortDirection }; handleSort: (key: SortKey) => void;
  rowSpan?: number; activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
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
    <th ref={thRef} className="select-none px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white" rowSpan={rowSpan} style={{ textAlign: "center", verticalAlign: "middle" }}>
      <div className="flex items-center justify-center gap-1">
        <span onClick={handleLabelClick} className="text-xs font-semibold tracking-wide" style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} className="text-xs cursor-pointer hover:text-stone-300 transition-colors" style={{ opacity: isActive ? 1 : 0.4, minWidth: 10 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

/* -------------------------------------------------------
   SUMMARY CARD
-------------------------------------------------------- */
function SummaryCard({ title, data, colors, activeDescId, openDesc, closeDesc }: {
  title: string; data: SummaryData; colors: SummaryColors;
  activeDescId?: string | null; openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
}) {
  const makeThClick = (tooltipId: string) => (e: React.MouseEvent<HTMLTableCellElement>) => {
    const uid = tooltipId + "_summary_" + tooltipId;
    activeDescId === uid ? closeDesc?.() : openDesc?.(uid, e.currentTarget.getBoundingClientRect());
  };
  const thStyle: React.CSSProperties = { color: "#ffffff", cursor: openDesc ? "pointer" : "default", textDecoration: openDesc ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" };
  return (
    <div className="rankings-table mb-20 overflow-hidden border border-stone-200 rounded-md shadow-sm">
      <div className="p-2 text-center font-bold uppercase tracking-widest text-xl" style={{ backgroundColor: "#0a1a2f", color: "#ffffff" }}>{title}</div>
      <div className="bg-white overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-stone-200" style={{ backgroundColor: "#0a1a2f" }}>
              <th className="px-4 py-3 text-[11px] tracking-wider font-semibold text-center" style={thStyle} onClick={makeThClick("sampleSize")}>Sample Size</th>
              <th className="px-4 py-3 text-[11px] tracking-wider font-semibold text-center" style={thStyle} onClick={makeThClick("result")}>% Beats Vegas</th>
              <th className="px-4 py-3 text-[11px] tracking-wider font-semibold text-center" style={thStyle} onClick={makeThClick("fakeBet")}>Wagered</th>
              <th className="px-4 py-3 text-[11px] tracking-wider font-semibold text-center" style={thStyle} onClick={makeThClick("fakeWin")}>Won</th>
              <th className="px-4 py-3 text-[11px] tracking-wider font-semibold text-center" style={thStyle} onClick={makeThClick("teamRoi")}>ROI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-10 text-2xl font-bold text-center">{data.sampleSize.toLocaleString()}</td>
              <td className="px-4 py-10 text-2xl font-bold text-center" style={{ color: colors.winPct }}>{data.bbmiWinPct}%</td>
              <td className="px-4 py-10 text-2xl font-bold text-center text-red-600">${data.fakeWagered.toLocaleString()}</td>
              <td className="px-4 py-10 text-2xl font-bold text-center" style={{ color: colors.won }}>${data.fakeWon.toLocaleString()}</td>
              <td className="px-4 py-6 text-2xl font-bold text-center" style={{ color: colors.roi }}>{data.roi}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   MAIN PAGE
-------------------------------------------------------- */
export default function BettingLinesPage() {
  const cleanedGames = games.filter((g) => g.date && g.away && g.home);
  const historicalGames: HistoricalGame[] = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  // ── NEW: compute high-edge stats for callout ──
  const edgeStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";

    // Edge >= FREE_EDGE_LIMIT (5)
    const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";
    const highEdgeWon = highEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const highEdgeWagered = highEdge.length * 100;
    const highEdgeRoi = highEdgeWagered > 0 ? (((highEdgeWon / highEdgeWagered) * 100) - 100).toFixed(1) : "0.0";

    // Edge >= 8 (sharpest disagreements)
    const eliteEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= 8);
    const eliteEdgeWins = eliteEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const eliteEdgeWinPct = eliteEdge.length > 0 ? ((eliteEdgeWins / eliteEdge.length) * 100).toFixed(1) : "0.0";
    const eliteEdgeWon = eliteEdge.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    const eliteEdgeWagered = eliteEdge.length * 100;
    const eliteEdgeRoi = eliteEdgeWagered > 0 ? (((eliteEdgeWon / eliteEdgeWagered) * 100) - 100).toFixed(1) : "0.0";

    return {
      overallWinPct, overallTotal: allBets.length,
      highEdgeWinPct, highEdgeTotal: highEdge.length, highEdgeRoi,
      eliteEdgeWinPct, eliteEdgeTotal: eliteEdge.length, eliteEdgeRoi,
    };
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
    const search = teamSearch.toLowerCase();
    return allTeams.filter((t) => t.toLowerCase().includes(search)).slice(0, 10);
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
      const pickedTeam = bbmiLine < vegasLine ? String(g.home) : String(g.away);
      return pickedTeam === selectedTeam;
    });
  }, [teamAndEdgeFilteredGames, selectedTeam]);

  const sampleSize = betHistorical.length;
  const wins = betHistorical.filter((g) => Number(g.fakeWin) > 0).length;
  const fakeWagered = betHistorical.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
  const fakeWon = betHistorical.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const roi = fakeWagered > 0 ? (fakeWon / fakeWagered) * 100 - 100 : 0;
  const summary: SummaryData = { sampleSize, bbmiWinPct: wins > 0 ? ((wins / sampleSize) * 100).toFixed(1) : "0", fakeWagered, fakeWon, roi: roi.toFixed(1) };
  const bbmiBeatsVegasColor = Number(summary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626";
  const fakeWonColor = summary.fakeWon > summary.fakeWagered ? "#16a34a" : "#dc2626";
  const roiColor = Number(summary.roi) > 0 ? "#16a34a" : "#dc2626";

  const allDates = useMemo(() => {
    const dates = new Set<string>();
    for (const g of teamAndEdgeFilteredGames) { if (g.date) dates.add(g.date.split("T")[0].split(" ")[0]); }
    return Array.from(dates).sort();
  }, [teamAndEdgeFilteredGames]);

  const weekRanges = useMemo(() => {
    if (allDates.length === 0) return [];
    const ranges: Array<{ start: string; end: string }> = [];
    const addDays = (d: string, n: number) => { const [y, m, day] = d.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, day)); dt.setUTCDate(dt.getUTCDate() + n); return dt.toISOString().slice(0, 10); };
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
  const weeklySampleSize = betWeekly.length;
  const weeklyWins = betWeekly.filter((g) => Number(g.fakeWin) > 0).length;
  const weeklyFakeWagered = betWeekly.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
  const weeklyFakeWon = betWeekly.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
  const weeklyRoi = weeklyFakeWagered > 0 ? (weeklyFakeWon / weeklyFakeWagered) * 100 - 100 : 0;
  const weeklySummary: SummaryData = { sampleSize: weeklySampleSize, bbmiWinPct: weeklySampleSize > 0 ? ((weeklyWins / weeklySampleSize) * 100).toFixed(1) : "0", fakeWagered: weeklyFakeWagered, fakeWon: weeklyFakeWon, roi: weeklyRoi.toFixed(1) };

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

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}
      <div className="section-wrapper bg-stone-50 min-h-screen">
        <div className="w-full max-w-[1400px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div className="mt-10 flex flex-col items-center mb-8">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>Men's Picks Model Accuracy</span>
            </h1>
            <p className="text-stone-700 text-sm tracking-tight mt-1">Weekly comparison of BBMI model vs Vegas lines</p>
          </div>

          {/* HOW TO READ */}
          <HowToReadAccordion />

          {/* ── HIGH EDGE CALLOUT ── */}
          <HighEdgeCallout
            overallWinPct={edgeStats.overallWinPct}
            overallTotal={edgeStats.overallTotal}
            highEdgeWinPct={edgeStats.highEdgeWinPct}
            highEdgeTotal={edgeStats.highEdgeTotal}
            highEdgeRoi={edgeStats.highEdgeRoi}
            eliteEdgeWinPct={edgeStats.eliteEdgeWinPct}
            eliteEdgeTotal={edgeStats.eliteEdgeTotal}
            eliteEdgeRoi={edgeStats.eliteEdgeRoi}
          />

          {/* FILTERS */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-2 relative">
            <div className="flex flex-col items-center gap-3">
              <label htmlFor="edge-filter" className="text-sm font-semibold text-stone-700">Minimum Edge (|BBMI Line - Vegas Line|):</label>
              <select id="edge-filter" className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none" value={minEdge} onChange={(e) => setMinEdge(Number(e.target.value))}>
                {edgeOptions.map((edge) => <option key={edge} value={edge}>{edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}</option>)}
              </select>
            </div>
            <div className="flex flex-col items-center gap-3">
              <label htmlFor="team-search" className="text-sm font-semibold text-stone-700">Filter by Team:</label>
              <div className="relative">
                <div className="flex items-center gap-2">
                  <input id="team-search" type="text" placeholder="Search team name..." className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none w-64" value={teamSearch} autoComplete="off"
                    onChange={(e) => { setTeamSearch(e.target.value); setShowSuggestions(true); if (!e.target.value) setSelectedTeam(""); }}
                    onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
                  {selectedTeam && <button onClick={handleClearTeam} className="px-3 py-2 bg-stone-200 hover:bg-stone-300 rounded-md text-sm font-medium transition-colors">Clear</button>}
                </div>
                {showSuggestions && filteredTeams.length > 0 && (
                  <div className="absolute w-full mt-1 bg-white border-2 border-stone-400 rounded-md shadow-2xl max-h-60 overflow-y-auto" style={{ zIndex: 999999 }}>
                    {filteredTeams.map((team) => (
                      <div key={team} className="px-4 py-2 hover:bg-stone-100 cursor-pointer text-sm flex items-center gap-2" onMouseDown={(e) => { e.preventDefault(); handleTeamSelect(team); }}>
                        <NCAALogo teamName={team} size={20} /><span>{team}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* EDGE TIP — now dynamic */}
          <div className="flex justify-center mb-8">
            <p className="text-xs text-stone-500 italic text-center">
              Tip: The model performs best when edge is highest. Try <strong>≥ {FREE_EDGE_LIMIT}.0 points</strong> to see picks where BBMI most strongly disagrees with Vegas.
              {minEdge >= FREE_EDGE_LIMIT && (
                <span style={{ color: "#16a34a", fontWeight: 700 }}> ✓ You're viewing high-edge picks — {edgeStats.highEdgeWinPct}% accuracy at this threshold.</span>
              )}
            </p>
          </div>

          {selectedTeam && (
            <div className="flex justify-center mb-6">
              <div className="px-4 py-2 rounded-md flex items-center gap-2" style={{ backgroundColor: "#0a1a2f", color: "#ffffff" }}>
                <NCAALogo teamName={selectedTeam} size={24} />
                <span className="font-semibold">Showing results for: {selectedTeam}</span>
              </div>
            </div>
          )}

          {/* GLOBAL SUMMARY */}
          <div className="w-full">
            <SummaryCard title={selectedTeam ? `Summary Metrics - ${selectedTeam}` : "Summary Metrics"} data={summary} colors={{ winPct: bbmiBeatsVegasColor, won: fakeWonColor, roi: roiColor }} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
          </div>

          {/* TEAM PERFORMANCE */}
          {!selectedTeam && teamPerformance.length > 0 && (
            <div className="w-full">
              <div className="rankings-table mb-20 overflow-hidden border border-stone-200 rounded-md shadow-sm">
                <div className="p-2 text-center font-bold uppercase tracking-widest text-sm" style={{ backgroundColor: "#0a1a2f", color: "#ffffff" }}>Team Performance Analysis</div>
                <div className="bg-stone-50 p-4 border-b border-stone-200">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-stone-700">Show:</label>
                      <select className="border border-stone-300 rounded-md px-3 py-1.5 bg-white shadow-sm text-sm" value={showTopTeams ? "top" : "bottom"} onChange={(e) => setShowTopTeams(e.target.value === "top")}>
                        <option value="top">Best Performing Teams</option>
                        <option value="bottom">Worst Performing Teams</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-semibold text-stone-700">Number of Teams:</label>
                      <select className="border border-stone-300 rounded-md px-3 py-1.5 bg-white shadow-sm text-sm" value={teamReportSize} onChange={(e) => setTeamReportSize(Number(e.target.value))}>
                        {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>Top {n}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-white overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: "#0a1a2f", color: "#ffffff" }}>
                        <th className="px-3 py-3 text-[11px] tracking-wider font-semibold text-left" style={{ color: "#ffffff" }}>Rank</th>
                        <th className="px-3 py-3 text-[11px] tracking-wider font-semibold text-left" style={{ color: "#ffffff" }}>Team</th>
                        {(["teamPicked","teamWinPct","teamWagered","teamWon","teamRoi"] as const).map((tid, i) => {
                          const labels = ["Picked","Win %","Wagered","Won","ROI"];
                          const uid = tid + "_team_" + tid;
                          return (
                            <th key={tid} className="px-3 py-3 text-[11px] tracking-wider font-semibold text-center cursor-pointer" style={{ color: "#ffffff", textDecoration: "underline dotted", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
                              onClick={(e) => { descPortal?.id === uid ? closeDesc() : openDesc(uid, e.currentTarget.getBoundingClientRect()); }}>
                              {labels[i]}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTeams.map((td, idx) => (
                        <tr key={td.team} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="px-3 py-3 text-center font-semibold text-stone-600">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <Link href={`/ncaa-team/${encodeURIComponent(td.team)}`} className="hover:underline cursor-pointer flex items-center gap-2">
                              <NCAALogo teamName={td.team} size={24} /><span className="font-medium">{td.team}</span>
                            </Link>
                          </td>
                          <td className="px-3 py-3 text-center">{td.games}</td>
                          <td className="px-3 py-3 text-center font-semibold" style={{ color: td.winPct >= 50 ? "#16a34a" : "#dc2626" }}>{td.winPct.toFixed(1)}%</td>
                          <td className="px-3 py-3 text-center text-red-600 font-medium">${td.wagered.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center font-medium" style={{ color: td.won >= td.wagered ? "#16a34a" : "#dc2626" }}>${td.won.toLocaleString()}</td>
                          <td className="px-3 py-3 text-center font-semibold" style={{ color: td.roi >= 0 ? "#16a34a" : "#dc2626" }}>{td.roi.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-stone-50 p-3 text-center text-xs text-stone-600 border-t border-stone-200">
                  Minimum 3 games required. Based on current edge filter (≥{minEdge.toFixed(1)} points).
                </div>
              </div>
            </div>
          )}

          {/* WEEK SELECTOR */}
          <div className="flex flex-col items-center gap-6">
            <h2 className="text-xl font-semibold tracking-tight mb-3">Historical Results By Week</h2>
            <p className="text-xs text-stone-600 mb-3 text-center italic">Team records indicate Win-Loss when BBMI picks that team to beat Vegas.</p>
            <select className="border border-stone-300 rounded-md px-4 py-2 bg-white shadow-sm focus:ring-2 focus:ring-stone-500 outline-none mb-6" value={selectedWeekIndex} onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}>
              {weekRanges.map((range, idx) => {
                const fmt = (d: string) => { const [y, m, day] = d.split("-"); return `${parseInt(m)}/${parseInt(day)}/${y}`; };
                return <option key={idx} value={idx}>{fmt(range.start)} – {fmt(range.end)}</option>;
              })}
            </select>
          </div>

          <div className="w-full">
            <SummaryCard title={selectedTeam ? `Weekly Summary - ${selectedTeam}` : "Weekly Summary"} data={weeklySummary}
              colors={{ winPct: Number(weeklySummary.bbmiWinPct) > 50 ? "#16a34a" : "#dc2626", won: weeklySummary.fakeWon > weeklySummary.fakeWagered ? "#16a34a" : "#dc2626", roi: Number(weeklySummary.roi) > 0 ? "#16a34a" : "#dc2626" }}
              activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
          </div>

          {/* HISTORICAL TABLE */}
          <div className="w-full">
            <div className="rankings-table border border-stone-200 rounded-md overflow-hidden bg-white shadow-sm mt-10">
              <div className="max-h-[600px] overflow-auto pt-6">
                <table className="min-w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0a1a2f] text-white text-sm">
                      <SortableHeader label="Date" columnKey="date" tooltipId="date" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Away" columnKey="away" tooltipId="away" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Home" columnKey="home" tooltipId="home" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <th colSpan={2} className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white" style={{ textAlign: "center", fontSize: "0.75rem", fontWeight: "600" }}>Home Line</th>
                      <SortableHeader label={<>Actual<br />Line</>} columnKey="actualHomeLine" tooltipId="actualHomeLine" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Away Score" columnKey="actualAwayScore" tooltipId="actualAwayScore" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Home Score" columnKey="actualHomeScore" tooltipId="actualHomeScore" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Bet" columnKey="fakeBet" tooltipId="fakeBet" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Win" columnKey="fakeWin" tooltipId="fakeWin" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="Result" columnKey="result" tooltipId="result" sortConfig={sortConfig} handleSort={handleSort} rowSpan={2} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                    </tr>
                    <tr className="bg-[#0a1a2f] text-white text-sm" style={{ position: "sticky", top: "33px", zIndex: 10 }}>
                      <SortableHeader label="Vegas" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" sortConfig={sortConfig} handleSort={handleSort} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                      <SortableHeader label="BBMI" columnKey="bbmiHomeLine" tooltipId="bbmiHomeLine" sortConfig={sortConfig} handleSort={handleSort} activeDescId={descPortal?.id} openDesc={openDesc} closeDesc={closeDesc} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistorical.map((g, i) => (
                      <tr key={i} className="bg-white border-b border-stone-200">
                        <td className="px-3 py-2 text-xs">{g.date}</td>
                        <td className="px-3 py-2 text-sm">
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.away))}`} className="hover:underline cursor-pointer flex items-center gap-2">
                            <NCAALogo teamName={String(g.away)} size={24} />
                            <div className="flex flex-col"><span>{g.away}</span>{(() => { const r = getTeamRecord(String(g.away)); return r ? <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.display}</span> : null; })()}</div>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.home))}`} className="hover:underline cursor-pointer flex items-center gap-2">
                            <NCAALogo teamName={String(g.home)} size={24} />
                            <div className="flex flex-col"><span>{g.home}</span>{(() => { const r = getTeamRecord(String(g.home)); return r ? <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.display}</span> : null; })()}</div>
                          </Link>
                        </td>
                        <td className="text-right px-3 py-2">{g.vegasHomeLine}</td>
                        <td className="text-right px-3 py-2">{g.bbmiHomeLine}</td>
                        <td className="text-right px-3 py-2 font-semibold">{g.actualHomeLine}</td>
                        <td className="text-right px-3 py-2">{g.actualAwayScore}</td>
                        <td className="text-right px-3 py-2">{g.actualHomeScore}</td>
                        <td className="text-right px-3 py-2">${g.fakeBet}</td>
                        <td className="text-right px-3 py-2 font-medium" style={{ color: Number(g.fakeWin) > 0 ? "#16a34a" : "#dc2626" }}>${g.fakeWin}</td>
                        <td className="text-center px-3 py-2">
                          {g.result === "win" ? <span style={{ color: "#16a34a", fontWeight: 900, fontSize: "1.25rem" }}>✓</span> : g.result === "loss" ? <span style={{ color: "#dc2626", fontWeight: 900, fontSize: "1.25rem" }}>✗</span> : ""}
                        </td>
                      </tr>
                    ))}
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
