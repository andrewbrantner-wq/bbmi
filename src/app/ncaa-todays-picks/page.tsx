"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import React from "react";
import ReactDOM from "react-dom";
import Link from "next/link";
import games from "@/data/betting-lines/games.json";
import LogoBadge from "@/components/LogoBadge";
import NCAALogo from "@/components/NCAALogo";
import EdgePerformanceGraph from "@/components/EdgePerformanceGraph";
import { AuthProvider, useAuth } from "../AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase-config";

// ------------------------------------------------------------
// FREE TIER THRESHOLD — rows with edge >= this are locked
// ------------------------------------------------------------
const FREE_EDGE_LIMIT = 5;

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------

type UpcomingGame = {
  date: string | null;
  away: string | number | null;
  home: string | number | null;
  vegasHomeLine: number | null;
  bbmiHomeLine: number | null;
  bbmiWinProb: number | null;
  vegaswinprob: number | null;
};

type SortableKeyUpcoming =
  | "bbmiPick" | "date" | "away" | "home"
  | "vegasHomeLine" | "bbmiHomeLine" | "bbmiWinProb"
  | "vegaswinprob" | "edge";

// ------------------------------------------------------------
// TOOLTIP CONTENT
// ------------------------------------------------------------

const TOOLTIPS: Record<string, string> = {
  date: "The date of the game.",
  away: "The visiting team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  home: "The home team. The small record below the name shows BBMI's win-loss when picking that team this season.",
  vegasHomeLine: "Point spread set by sportsbooks for the home team. Negative = home team is favored.",
  bbmiHomeLine: "What BBMI's model predicts the spread should be.",
  edge: "The gap between BBMI's line and the Vegas line. Larger edge = stronger model conviction.",
  bbmiPick: "The team BBMI's model favors to cover the Vegas spread.",
  bbmiWinProb: "BBMI's estimated probability that the home team wins outright.",
  vegaswinprob: "Vegas's implied probability that the home team wins outright.",
};

// ------------------------------------------------------------
// TOOLTIP PORTAL
// ------------------------------------------------------------

function ColDescPortal({ tooltipId, anchorRect, onClose }: {
  tooltipId: string; anchorRect: DOMRect; onClose: () => void;
}) {
  const text = TOOLTIPS[tooltipId];
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (el.current && !el.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  if (!text || typeof document === "undefined") return null;
  const left = Math.min(anchorRect.left + anchorRect.width / 2 - 110, window.innerWidth - 234);
  const top = anchorRect.bottom + 6;

  return ReactDOM.createPortal(
    <div ref={el} style={{ position: "fixed", top, left, zIndex: 99999, width: 220, backgroundColor: "#1e3a5f", border: "1px solid #3a5a8f", borderRadius: 6, boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
      <div style={{ padding: "10px 28px 6px 12px", fontSize: 12, color: "#e2e8f0", lineHeight: 1.5, textAlign: "left", whiteSpace: "normal" }}>{text}</div>
      <button onMouseDown={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "absolute", top: 6, right: 8, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 12 }}>✕</button>
    </div>,
    document.body
  );
}

// ------------------------------------------------------------
// SORTABLE HEADER
// ------------------------------------------------------------

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc }: {
  label: string; columnKey: SortableKeyUpcoming; tooltipId?: string;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
  rowSpan?: number; activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
}) {
  const isActive = sortConfig.key === columnKey;
  const thRef = useRef<HTMLTableCellElement>(null);
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
        <span onClick={handleLabelClick} className="text-xs font-semibold tracking-wide" style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}>
          {label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }} className="text-xs cursor-pointer hover:text-stone-300 transition-colors" style={{ opacity: isActive ? 1 : 0.4, minWidth: 10 }}>
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// LOCKED ROW OVERLAY — shown for high-edge rows when not premium
// ------------------------------------------------------------

function LockedRowOverlay({ colSpan, onSubscribe, winPct }: { colSpan: number; onSubscribe: () => void; winPct: string }) {
  return (
    <tr style={{ backgroundColor: "#0a1a2f" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>🔒</span>
            <span style={{ fontSize: "0.78rem", color: "#facc15", fontWeight: 700 }}>
              High-edge pick — Edge ≥ {FREE_EDGE_LIMIT} pts
            </span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
              These picks are <strong style={{ color: "#facc15" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button
            onClick={onSubscribe}
            style={{
              backgroundColor: "#facc15", color: "#0a1a2f",
              border: "none", borderRadius: 6,
              padding: "0.35rem 0.9rem",
              fontSize: "0.72rem", fontWeight: 800,
              cursor: "pointer", whiteSpace: "nowrap",
              letterSpacing: "0.03em",
            }}
          >
            Unlock →
          </button>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------
// PAYWALL MODAL — shown when user clicks "Unlock"
// ------------------------------------------------------------

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct }: {
  onClose: () => void;
  highEdgeWinPct: string;
  highEdgeTotal: number;
  overallWinPct: string;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1rem",
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "#ffffff", borderRadius: 16,
        padding: "2rem 1.75rem", maxWidth: 520, width: "100%",
        boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        textAlign: "center",
      }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            backgroundColor: "#fef3c7", border: "1px solid #fcd34d",
            borderRadius: 999, padding: "0.25rem 0.75rem",
            fontSize: "0.72rem", fontWeight: 700, color: "#92400e",
            marginBottom: "0.75rem",
          }}>
            🔒 Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.4rem" }}>
            Unlock High-Edge Picks
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>
            This pick has an edge ≥ {FREE_EDGE_LIMIT} pts — where the model is most accurate
          </p>
        </div>

        {/* High edge stat hero */}
        <div style={{
          backgroundColor: "#0a1a2f", borderRadius: 10,
          padding: "1rem 1.25rem", marginBottom: "1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
              Win rate
            </div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              {highEdgeTotal} picks · edge ≥ {FREE_EDGE_LIMIT}
            </div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>
              Overall rate
            </div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
              all picks tracked
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          {/* Trial */}
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$15</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>
              One-time · No auto-renewal
            </div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02"
              style={{ display: "block", backgroundColor: "#16a34a", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>
              Try 7 Days →
            </a>
          </div>
          {/* Monthly */}
          <div style={{ border: "2px solid #2563eb", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#eff6ff", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "0.15rem 0.6rem", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>
              MOST POPULAR
            </div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$49</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e40af", margin: "0.3rem 0 0.2rem" }}>Per Month</div>
            <div style={{ fontSize: "0.65rem", color: "#3b82f6", backgroundColor: "#dbeafe", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>
              Cancel anytime
            </div>
            <a href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01"
              style={{ display: "block", background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>
              Subscribe →
            </a>
          </div>
        </div>

        <button onClick={onClose} style={{ fontSize: "0.75rem", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          No thanks, keep browsing free picks
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// MAIN PAGE CONTENT
// ------------------------------------------------------------

function BettingLinesPageContent() {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Check premium status
  useEffect(() => {
    async function checkPremium() {
      if (!user) { setIsPremium(false); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
      } catch {
        setIsPremium(false);
      }
    }
    checkPremium();
  }, [user]);

  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Dataset",
      name: "BBMI Today's Picks – NCAA Betting Lines & Predictions",
      description: "Live NCAA basketball betting lines, BBMI model picks, and win probabilities for today's games.",
      url: "https://bbmihoops.com/ncaa-todays-picks",
      dateModified: "2025-01-01",
    });
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const [descPortal, setDescPortal] = useState<{ id: string; rect: DOMRect } | null>(null);
  const openDesc = useCallback((id: string, rect: DOMRect) => setDescPortal({ id, rect }), []);
  const closeDesc = useCallback(() => setDescPortal(null), []);

  const cleanedGames = games.filter((g) => g.date && g.away && g.home);
  const upcomingGames: UpcomingGame[] = cleanedGames.filter((g) =>
    g.actualHomeScore === 0 || g.actualHomeScore == null || g.actualAwayScore == null
  );
  const historicalGames = cleanedGames.filter(
    (g) => g.actualHomeScore !== null && g.actualAwayScore !== null && g.actualHomeScore !== 0
  );

  // Compute high-edge stats for paywall messaging
  const edgeStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const allWins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const overallWinPct = allBets.length > 0 ? ((allWins / allBets.length) * 100).toFixed(1) : "0.0";

    const highEdge = allBets.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= FREE_EDGE_LIMIT);
    const highEdgeWins = highEdge.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const highEdgeWinPct = highEdge.length > 0 ? ((highEdgeWins / highEdge.length) * 100).toFixed(1) : "0.0";

    return { overallWinPct, total: allBets.length, highEdgeWinPct, highEdgeTotal: highEdge.length };
  }, [historicalGames]);

  const teamRecords = useMemo(() => {
    const records: Record<string, { wins: number; picks: number }> = {};
    historicalGames.forEach((g) => {
      if (Number(g.fakeBet || 0) <= 0) return;
      const vegasLine = g.vegasHomeLine ?? 0;
      const bbmiLine = g.bbmiHomeLine ?? 0;
      if (vegasLine === bbmiLine) return;
      const bbmiPickedHome = bbmiLine < vegasLine;
      const pickedTeam = bbmiPickedHome ? String(g.home) : String(g.away);
      if (!records[pickedTeam]) records[pickedTeam] = { wins: 0, picks: 0 };
      records[pickedTeam].picks++;
      if (Number(g.fakeWin || 0) > 0) records[pickedTeam].wins++;
    });
    return records;
  }, [historicalGames]);

  const getTeamRecord = (teamName: string) => {
    const record = teamRecords[String(teamName)];
    if (!record || record.picks === 0) return null;
    const winPct = ((record.wins / record.picks) * 100).toFixed(0);
    return { wins: record.wins, picks: record.picks, winPct, display: `${record.wins}-${record.picks - record.wins}`, color: record.wins / record.picks >= 0.5 ? "#16a34a" : "#dc2626" };
  };

  const [minEdge, setMinEdge] = useState<number>(0);
  const edgeOptions = useMemo(() => { const o = [0]; for (let i = 0.5; i <= 10; i += 0.5) o.push(i); return o; }, []);

  const edgePerformanceStats = useMemo(() => {
    const cats = [{ name: "≤2 pts", min: 0, max: 2 }, { name: "2-4 pts", min: 2, max: 4 }, { name: "4-6 pts", min: 4, max: 6 }, { name: "6-8 pts", min: 6, max: 8 }, { name: ">8 pts", min: 8, max: Infinity }];
    return cats.map((cat) => {
      const catGames = historicalGames.filter((g) => { if (Number(g.fakeBet || 0) <= 0) return false; const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)); return edge >= cat.min && edge < cat.max; });
      const wins = catGames.filter((g) => Number(g.fakeWin || 0) > 0).length;
      const wagered = catGames.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
      const won = catGames.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
      const roi = wagered > 0 ? won / wagered * 100 - 100 : 0;
      return { name: cat.name, games: catGames.length, winPct: catGames.length > 0 ? ((wins / catGames.length) * 100).toFixed(1) : "0.0", roi: roi.toFixed(1), roiPositive: roi > 0 };
    });
  }, [historicalGames]);

  const historicalStats = useMemo(() => {
    const allBets = historicalGames.filter((g) => Number(g.fakeBet || 0) > 0);
    const wins = allBets.filter((g) => Number(g.fakeWin || 0) > 0).length;
    const wagered = allBets.reduce((sum, g) => sum + Number(g.fakeBet || 0), 0);
    const won = allBets.reduce((sum, g) => sum + Number(g.fakeWin || 0), 0);
    return { total: allBets.length, winPct: allBets.length > 0 ? ((wins / allBets.length) * 100).toFixed(1) : "0.0", roi: wagered > 0 ? ((won / wagered) * 100 - 100).toFixed(1) : "0.0" };
  }, [historicalGames]);

  const edgeFilteredGames = useMemo(() => {
    if (minEdge === 0) return upcomingGames;
    return upcomingGames.filter((g) => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= minEdge);
  }, [upcomingGames, minEdge]);

  const [sortConfig, setSortConfig] = useState<{ key: SortableKeyUpcoming; direction: "asc" | "desc" }>({ key: "edge", direction: "desc" });
  const handleSort = (columnKey: SortableKeyUpcoming) => setSortConfig((prev) => ({ key: columnKey, direction: prev.key === columnKey && prev.direction === "asc" ? "desc" : "asc" }));

  const sortedUpcoming = useMemo(() => {
    const withComputed = edgeFilteredGames.map((g) => ({
      ...g,
      bbmiPick: g.bbmiHomeLine == null || g.vegasHomeLine == null ? "" : g.bbmiHomeLine === g.vegasHomeLine ? "" : g.bbmiHomeLine > g.vegasHomeLine ? g.away : g.home,
      edge: Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)),
    }));
    return [...withComputed].sort((a, b) => {
      const aVal = a[sortConfig.key], bVal = b[sortConfig.key];
      if (typeof aVal === "number" && typeof bVal === "number") return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      if (aVal == null) return 1; if (bVal == null) return -1;
      return sortConfig.direction === "asc" ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
  }, [edgeFilteredGames, sortConfig]);

  const headerProps = { sortConfig, handleSort, activeDescId: descPortal?.id, openDesc, closeDesc };

  // Counts for the freemium banner
  const freeCount = sortedUpcoming.filter((g) => g.edge < FREE_EDGE_LIMIT).length;
  const lockedCount = sortedUpcoming.filter((g) => g.edge >= FREE_EDGE_LIMIT).length;

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          highEdgeWinPct={edgeStats.highEdgeWinPct}
          highEdgeTotal={edgeStats.highEdgeTotal}
          overallWinPct={edgeStats.overallWinPct}
        />
      )}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* Header */}
          <div className="mt-10 flex flex-col items-center mb-6">
            <h1 className="flex items-center text-3xl font-bold tracking-tightest leading-tight">
              <LogoBadge league="ncaa" className="h-8 mr-3" />
              <span>Men's Picks</span>
            </h1>
          </div>

          {/* HEADLINE STATS STRIP */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
            {[
              { value: `${historicalStats.winPct}%`, label: "Beat Vegas", sub: "All tracked picks" },
              { value: `${historicalStats.roi}%`, label: "ROI", sub: "Flat $100/game" },
              { value: historicalStats.total.toLocaleString(), label: "Games Tracked", sub: "Every result logged" },
            ].map((card) => (
              <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0a1a2f", lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* HIGH EDGE CALLOUT — always visible, entices non-premium */}
          {!isPremium && lockedCount > 0 && (
            <div style={{
              backgroundColor: "#0a1a2f", borderRadius: 10,
              border: "2px solid #facc15",
              padding: "1rem 1.5rem", marginBottom: "1.5rem",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: "1rem",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{edgeStats.highEdgeWinPct}%</span>
                  <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.6)" }}>win rate on picks with edge ≥ {FREE_EDGE_LIMIT} pts</span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
                  vs <strong style={{ color: "rgba(255,255,255,0.6)" }}>{edgeStats.overallWinPct}%</strong> overall · documented across <strong style={{ color: "rgba(255,255,255,0.6)" }}>{edgeStats.highEdgeTotal}</strong> picks
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                <div style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 700 }}>
                  🔒 {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked today
                </div>
                <button
                  onClick={() => setShowPaywall(true)}
                  style={{
                    backgroundColor: "#facc15", color: "#0a1a2f",
                    border: "none", borderRadius: 7,
                    padding: "0.5rem 1.25rem",
                    fontSize: "0.82rem", fontWeight: 800,
                    cursor: "pointer", letterSpacing: "0.02em",
                  }}
                >
                  Unlock for $15 →
                </button>
              </div>
            </div>
          )}

          {/* EDGE PERFORMANCE GRAPH */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <EdgePerformanceGraph games={historicalGames} showTitle={true} />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-xl shadow-md">
            <div style={{ background: "hsl(210 30% 12%)", color: "white", padding: "0.75rem 1rem", fontWeight: "600", fontSize: "0.875rem", textAlign: "center", letterSpacing: "0.05em" }}>
              HISTORICAL PERFORMANCE BY EDGE SIZE
            </div>
            <div className="bg-white overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "hsl(210 30% 12%)", color: "white" }}>
                    {["Edge Size", "Games", "Win %", "ROI"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold text-center">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="px-4 py-3 text-center font-semibold text-stone-700">{stat.name}</td>
                      <td className="px-4 py-3 text-center text-stone-600">{stat.games.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center font-bold text-lg" style={{ color: Number(stat.winPct) > 50 ? "#16a34a" : "#dc2626" }}>{stat.winPct}%</td>
                      <td className="px-4 py-3 text-center font-bold text-lg" style={{ color: stat.roiPositive ? "#16a34a" : "#dc2626" }}>{stat.roi}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-stone-50 p-3 text-center text-xs text-stone-600 border-t border-stone-200">
              Historical performance across all completed games where BBMI made a pick
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.75rem 1.25rem", marginBottom: "1.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#166534", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {FREE_EDGE_LIMIT} pts) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks ≥ {FREE_EDGE_LIMIT} pts</strong> — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access — use the edge filter to focus on the model's strongest picks.</span>}
            </p>
          </div>

          <h2 className="text-xl font-semibold tracking-tight mb-6 text-center">Upcoming Games</h2>

          {/* EDGE FILTER */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <label htmlFor="edge-filter" className="text-lg font-bold text-stone-800">Filter by Minimum Edge</label>
            <select
              id="edge-filter"
              className="border-2 border-stone-400 rounded-lg px-6 py-3 bg-white shadow-md focus:ring-2 focus:ring-stone-600 outline-none font-semibold text-stone-800"
              style={{ minWidth: "20px", fontSize: "1.125rem" }}
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
            >
              {edgeOptions.map((edge) => (
                <option key={edge} value={edge} style={{ fontSize: "1.125rem" }}>
                  {edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}
                </option>
              ))}
            </select>
            <p className="text-sm font-semibold text-stone-700">
              Showing <span className="font-bold text-stone-900">{sortedUpcoming.length}</span> of{" "}
              <span className="font-bold text-stone-900">{upcomingGames.length}</span> games
              {!isPremium && lockedCount > 0 && (
                <span style={{ color: "#dc2626", marginLeft: "0.5rem" }}>
                  · {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked 🔒
                </span>
              )}
            </p>
            {!isPremium && (
              <p className="text-xs text-stone-500 italic">
                Free picks shown for edge &lt; {FREE_EDGE_LIMIT} pts. <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>Subscribe to unlock high-edge picks →</button>
              </p>
            )}
          </div>

          <p className="text-xs text-stone-600 mb-1 text-center italic">
            Team records shown below team names indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>

          {/* PICKS TABLE */}
          <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
            <div className="rankings-scroll max-h-[1400px] overflow-y-auto overflow-x-auto">
              <table className="min-w-[1000px] w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#0a1a2f] text-white text-sm">
                    <SortableHeader label="Date" columnKey="date" tooltipId="date" rowSpan={2} {...headerProps} />
                    <SortableHeader label="Away Team" columnKey="away" tooltipId="away" rowSpan={2} {...headerProps} />
                    <SortableHeader label="Home Team" columnKey="home" tooltipId="home" rowSpan={2} {...headerProps} />
                    <th colSpan={2} className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white" style={{ textAlign: "center" }}>
                      <div className="flex items-center justify-center text-xs font-semibold">Home Line</div>
                    </th>
                    <SortableHeader label="Edge" columnKey="edge" tooltipId="edge" rowSpan={2} {...headerProps} />
                    <SortableHeader label="BBMI Pick" columnKey="bbmiPick" tooltipId="bbmiPick" rowSpan={2} {...headerProps} />
                    <th colSpan={2} className="px-3 py-2 whitespace-nowrap bg-[#0a1a2f] text-white border-b border-white" style={{ textAlign: "center" }}>
                      <div className="flex items-center justify-center text-xs font-semibold">Money Line Home Win %</div>
                    </th>
                  </tr>
                  <tr className="bg-[#0a1a2f] text-white text-sm" style={{ position: "sticky", top: "39px", zIndex: 20 }}>
                    <SortableHeader label="Vegas" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" {...headerProps} />
                    <SortableHeader label="BBMI" columnKey="bbmiHomeLine" tooltipId="bbmiHomeLine" {...headerProps} />
                    <SortableHeader label="BBMI" columnKey="bbmiWinProb" tooltipId="bbmiWinProb" {...headerProps} />
                    <SortableHeader label="Vegas" columnKey="vegaswinprob" tooltipId="vegaswinprob" {...headerProps} />
                  </tr>
                </thead>

                <tbody>
                  {sortedUpcoming.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-6 text-stone-500">No games match the selected edge filter.</td></tr>
                  )}

                  {sortedUpcoming.map((g, i) => {
                    const isLocked = !isPremium && g.edge >= FREE_EDGE_LIMIT;

                    if (isLocked) {
                      return (
                        <LockedRowOverlay
                          key={i}
                          colSpan={9}
                          onSubscribe={() => setShowPaywall(true)}
                          winPct={edgeStats.highEdgeWinPct}
                        />
                      );
                    }

                    return (
                      <tr key={i} className="bg-white border-b border-stone-200">
                        <td className="px-3 py-2 whitespace-nowrap w-[120px]">{g.date}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.away))}`} className="hover:underline cursor-pointer flex items-center gap-2">
                            <NCAALogo teamName={String(g.away)} size={24} />
                            <div className="flex flex-col">
                              <span>{g.away}</span>
                              {(() => { const r = getTeamRecord(String(g.away)); return r ? <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.display}</span> : null; })()}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link href={`/ncaa-team/${encodeURIComponent(String(g.home))}`} className="hover:underline cursor-pointer flex items-center gap-2">
                            <NCAALogo teamName={String(g.home)} size={24} />
                            <div className="flex flex-col">
                              <span>{g.home}</span>
                              {(() => { const r = getTeamRecord(String(g.home)); return r ? <span className="text-[10px] font-semibold" style={{ color: r.color }}>{r.display}</span> : null; })()}
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{g.vegasHomeLine}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{g.bbmiHomeLine}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold">
                          <span style={{ color: g.edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: g.edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                            {g.edge.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-medium">
                          {g.bbmiPick && (
                            <Link href={`/ncaa-team/${encodeURIComponent(String(g.bbmiPick))}`} className="hover:underline cursor-pointer flex items-center justify-end gap-2">
                              <NCAALogo teamName={String(g.bbmiPick)} size={20} />
                              <span>{g.bbmiPick}</span>
                            </Link>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{g.bbmiWinProb == null ? "—" : (g.bbmiWinProb * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">{g.vegaswinprob == null ? "—" : (g.vegaswinprob * 100).toFixed(1)}%</td>
                      </tr>
                    );
                  })}

                  {/* Bottom CTA row for non-premium users */}
                  {!isPremium && lockedCount > 0 && (
                    <tr style={{ backgroundColor: "#f0f9ff" }}>
                      <td colSpan={9} style={{ padding: "1rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                          <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate vs {edgeStats.overallWinPct}% overall
                        </div>
                        <button
                          onClick={() => setShowPaywall(true)}
                          style={{ backgroundColor: "#0a1a2f", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}
                        >
                          Unlock all picks — $15 for 7 days →
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------
// EXPORTED PAGE — no ProtectedRoute wrapper needed anymore
// ------------------------------------------------------------

export default function BettingLinesPage() {
  return (
    <AuthProvider>
      <BettingLinesPageContent />
    </AuthProvider>
  );
}
