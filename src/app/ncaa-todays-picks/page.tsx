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
// FREE TIER THRESHOLD
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

function SortableHeader({ label, columnKey, tooltipId, sortConfig, handleSort, rowSpan, activeDescId, openDesc, closeDesc, align = "center" }: {
  label: string; columnKey: SortableKeyUpcoming; tooltipId?: string;
  sortConfig: { key: SortableKeyUpcoming; direction: "asc" | "desc" };
  handleSort: (key: SortableKeyUpcoming) => void;
  rowSpan?: number; activeDescId?: string | null;
  openDesc?: (id: string, rect: DOMRect) => void; closeDesc?: () => void;
  align?: "left" | "center" | "right";
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
    <th
      ref={thRef}
      rowSpan={rowSpan}
      style={{
        backgroundColor: "#0a1a2f", color: "#ffffff",
        padding: "8px 10px", textAlign: align,
        whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 20,
        borderBottom: "2px solid rgba(255,255,255,0.1)",
        fontSize: "0.72rem", fontWeight: 700,
        letterSpacing: "0.06em", textTransform: "uppercase",
        verticalAlign: "middle",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: align === "left" ? "flex-start" : "center", gap: 4 }}>
        <span
          onClick={handleLabelClick}
          style={{ cursor: tooltipId ? "help" : "default", textDecoration: tooltipId ? "underline dotted" : "none", textUnderlineOffset: 3, textDecorationColor: "rgba(255,255,255,0.45)" }}
        >
          {label}
        </span>
        <span
          onClick={(e) => { e.stopPropagation(); closeDesc?.(); handleSort(columnKey); }}
          style={{ cursor: "pointer", opacity: isActive ? 1 : 0.4, fontSize: 10, lineHeight: 1 }}
        >
          {isActive ? (sortConfig.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </div>
    </th>
  );
}

// ------------------------------------------------------------
// LOCKED ROW OVERLAY
// ------------------------------------------------------------

function LockedRowOverlay({ colSpan, onSubscribe, winPct }: { colSpan: number; onSubscribe: () => void; winPct: string }) {
  return (
    <tr style={{ backgroundColor: "#0a1a2f" }}>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1.25rem", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1rem" }}>🔒</span>
            <span style={{ fontSize: "0.78rem", color: "#facc15", fontWeight: 700 }}>High-edge pick — Edge ≥ {FREE_EDGE_LIMIT} pts</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
              These picks are <strong style={{ color: "#facc15" }}>{winPct}%</strong> accurate historically
            </span>
          </div>
          <button onClick={onSubscribe} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 6, padding: "0.35rem 0.9rem", fontSize: "0.72rem", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            Unlock →
          </button>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------
// PAYWALL MODAL
// ------------------------------------------------------------

function PaywallModal({ onClose, highEdgeWinPct, highEdgeTotal, overallWinPct }: {
  onClose: () => void; highEdgeWinPct: string; highEdgeTotal: number; overallWinPct: string;
}) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
      <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "2rem 1.75rem", maxWidth: 520, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>

        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", backgroundColor: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 999, padding: "0.25rem 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem" }}>
            🔒 Premium Pick
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0a1a2f", margin: "0 0 0.4rem" }}>Unlock High-Edge Picks</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>This pick has an edge ≥ {FREE_EDGE_LIMIT} pts — where the model is most accurate</p>
        </div>

        <div style={{ backgroundColor: "#0a1a2f", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-around", gap: "1rem" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#facc15", lineHeight: 1 }}>{highEdgeWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Win rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{highEdgeTotal} picks · edge ≥ {FREE_EDGE_LIMIT}</div>
          </div>
          <div style={{ width: 1, height: 50, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.2rem", fontWeight: 900, color: "#4ade80", lineHeight: 1 }}>{overallWinPct}%</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>Overall rate</div>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>all picks tracked</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ border: "2px solid #16a34a", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#f0fdf4" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#15803d", lineHeight: 1 }}>$15</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#166534", margin: "0.3rem 0 0.2rem" }}>7-Day Trial</div>
            <div style={{ fontSize: "0.65rem", color: "#4ade80", backgroundColor: "#14532d", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>One-time · No auto-renewal</div>
            <a href="https://buy.stripe.com/7sYcN4bzH8jJdZBgXlgEg02" style={{ display: "block", backgroundColor: "#16a34a", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Try 7 Days →</a>
          </div>
          <div style={{ border: "2px solid #2563eb", borderRadius: 10, padding: "1rem 0.75rem", backgroundColor: "#eff6ff", position: "relative" }}>
            <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", backgroundColor: "#2563eb", color: "#fff", fontSize: "0.58rem", fontWeight: 800, padding: "0.15rem 0.6rem", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: "0.06em" }}>MOST POPULAR</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1d4ed8", lineHeight: 1 }}>$49</div>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#1e40af", margin: "0.3rem 0 0.2rem" }}>Per Month</div>
            <div style={{ fontSize: "0.65rem", color: "#3b82f6", backgroundColor: "#dbeafe", borderRadius: 999, padding: "0.15rem 0.5rem", display: "inline-block", marginBottom: "0.75rem", fontWeight: 600 }}>Cancel anytime</div>
            <a href="https://buy.stripe.com/28EbJ05bjgQf3kXayXgEg01" style={{ display: "block", background: "linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)", color: "#fff", padding: "0.55rem", borderRadius: 7, fontWeight: 700, fontSize: "0.82rem", textDecoration: "none" }}>Subscribe →</a>
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

  useEffect(() => {
    async function checkPremium() {
      if (!user) { setIsPremium(false); return; }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        setIsPremium(userDoc.exists() && userDoc.data()?.premium === true);
      } catch { setIsPremium(false); }
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
      const pickedTeam = bbmiLine < vegasLine ? String(g.home) : String(g.away);
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
    const cats = [
      { name: "≤2 pts", min: 0, max: 2 },
      { name: "2–4 pts", min: 2, max: 4 },
      { name: "4–6 pts", min: 4, max: 6 },
      { name: "6–8 pts", min: 6, max: 8 },
      { name: ">8 pts", min: 8, max: Infinity },
    ];
    return cats.map((cat) => {
      const catGames = historicalGames.filter((g) => {
        if (Number(g.fakeBet || 0) <= 0) return false;
        const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
        return edge >= cat.min && edge < cat.max;
      });
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
  const freeCount = sortedUpcoming.filter((g) => g.edge < FREE_EDGE_LIMIT).length;
  const lockedCount = sortedUpcoming.filter((g) => g.edge >= FREE_EDGE_LIMIT).length;

  // Shared TD style
  const TD: React.CSSProperties = { padding: "8px 10px", borderTop: "1px solid #f5f5f4", fontSize: 13, whiteSpace: "nowrap", verticalAlign: "middle" };
  const TD_RIGHT: React.CSSProperties = { ...TD, textAlign: "right", fontFamily: "ui-monospace, monospace" };

  return (
    <>
      {descPortal && <ColDescPortal tooltipId={descPortal.id.split("_")[0]} anchorRect={descPortal.rect} onClose={closeDesc} />}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} highEdgeWinPct={edgeStats.highEdgeWinPct} highEdgeTotal={edgeStats.highEdgeTotal} overallWinPct={edgeStats.overallWinPct} />}

      <div className="section-wrapper">
        <div className="w-full max-w-[1600px] mx-auto px-6 py-8">

          {/* HEADER */}
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
            <h1 style={{ display: "flex", alignItems: "center", fontSize: "1.875rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              <LogoBadge league="ncaa" />
              <span style={{ marginLeft: 12 }}>Men&apos;s Picks</span>
            </h1>
          </div>

          {/* HEADLINE STATS */}
          <div style={{ maxWidth: 600, margin: "0 auto 2rem", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[
              { value: `${historicalStats.winPct}%`, label: "Beat Vegas", sub: "All tracked picks", color: Number(historicalStats.winPct) >= 50 ? "#16a34a" : "#dc2626" },
              { value: `${historicalStats.roi}%`, label: "ROI", sub: "Flat $100/game", color: Number(historicalStats.roi) >= 0 ? "#16a34a" : "#dc2626" },
              { value: historicalStats.total.toLocaleString(), label: "Games Tracked", sub: "Every result logged", color: "#0a1a2f" },
            ].map((card) => (
              <div key={card.label} style={{ backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: 8, padding: "0.875rem 0.75rem", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "1.6rem", fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#0a1a2f", margin: "4px 0 3px" }}>{card.label}</div>
                <div style={{ fontSize: "0.68rem", color: "#78716c" }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* HIGH EDGE CALLOUT */}
          {!isPremium && lockedCount > 0 && (
            <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#0a1a2f", borderRadius: 10, border: "2px solid #facc15", padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
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
                <div style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 700 }}>🔒 {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked today</div>
                <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#facc15", color: "#0a1a2f", border: "none", borderRadius: 7, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 800, cursor: "pointer" }}>
                  Unlock for $15 →
                </button>
              </div>
            </div>
          )}

          {/* EDGE PERFORMANCE GRAPH */}
          <div style={{ maxWidth: 1100, margin: "0 auto 2rem", backgroundColor: "#0a1a2f", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", padding: "1.5rem" }}>
            <EdgePerformanceGraph games={historicalGames} showTitle={true} />
          </div>

          {/* EDGE PERFORMANCE STATS TABLE */}
          <div style={{ maxWidth: 500, margin: "0 auto 2rem" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ backgroundColor: "#0a1a2f", color: "#ffffff", padding: "10px 14px", fontWeight: 700, fontSize: "0.75rem", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Historical Performance by Edge Size
              </div>
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "25%" }} />
                  <col style={{ width: "25%" }} />
                </colgroup>
                <thead>
                  <tr>
                    {["Edge Size", "Games", "Win %", "ROI"].map((h) => (
                      <th key={h} style={{ backgroundColor: "#1e3a5f", color: "#ffffff", padding: "7px 10px", textAlign: "center", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "2px solid rgba(255,255,255,0.1)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {edgePerformanceStats.map((stat, idx) => (
                    <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff" }}>
                      <td style={{ ...TD, fontWeight: 600, textAlign: "center" }}>{stat.name}</td>
                      <td style={{ ...TD, textAlign: "center", color: "#57534e" }}>{stat.games.toLocaleString()}</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 15, color: Number(stat.winPct) > 50 ? "#16a34a" : "#dc2626" }}>{stat.winPct}%</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 700, fontSize: 15, color: stat.roiPositive ? "#16a34a" : "#dc2626" }}>{stat.roi}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: "#78716c", backgroundColor: "#fafaf9", borderTop: "1px solid #f5f5f4" }}>
                      Historical performance across all completed games where BBMI made a pick
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* HOW TO USE */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "0.75rem 1.25rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "#166534", margin: 0 }}>
              <strong>How to use this page:</strong> Free picks (edge &lt; {FREE_EDGE_LIMIT} pts) are shown below.{" "}
              {!isPremium && <span>Subscribe to unlock <strong>high-edge picks ≥ {FREE_EDGE_LIMIT} pts</strong> — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate.</span>}
              {isPremium && <span>You have full access — use the edge filter to focus on the model&apos;s strongest picks.</span>}
            </p>
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, textAlign: "center", marginBottom: 16 }}>Upcoming Games</h2>

          {/* EDGE FILTER */}
          <div style={{ maxWidth: 1100, margin: "0 auto 1.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <label htmlFor="edge-filter" style={{ fontSize: "1rem", fontWeight: 700, color: "#1c1917" }}>Filter by Minimum Edge</label>
            <select
              id="edge-filter"
              value={minEdge}
              onChange={(e) => setMinEdge(Number(e.target.value))}
              style={{ height: 44, border: "2px solid #d6d3d1", borderRadius: 8, padding: "0 20px", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", fontSize: "1rem", fontWeight: 600, color: "#1c1917", minWidth: 200 }}
            >
              {edgeOptions.map((edge) => (
                <option key={edge} value={edge}>{edge === 0 ? "All Games" : `≥ ${edge.toFixed(1)} points`}</option>
              ))}
            </select>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#44403c", margin: 0 }}>
              Showing <strong>{sortedUpcoming.length}</strong> of <strong>{upcomingGames.length}</strong> games
              {!isPremium && lockedCount > 0 && <span style={{ color: "#dc2626", marginLeft: 8 }}>· {lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"} locked 🔒</span>}
            </p>
            {!isPremium && (
              <p style={{ fontSize: 12, color: "#78716c", fontStyle: "italic", margin: 0 }}>
                Free picks shown for edge &lt; {FREE_EDGE_LIMIT} pts.{" "}
                <button onClick={() => setShowPaywall(true)} style={{ color: "#2563eb", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                  Subscribe to unlock high-edge picks →
                </button>
              </p>
            )}
          </div>

          <p style={{ fontSize: 11, color: "#78716c", textAlign: "center", fontStyle: "italic", marginBottom: 8 }}>
            Team records shown below team names indicate Win-Loss record when BBMI picks that team to beat Vegas.
          </p>

          {/* PICKS TABLE — widest table, needs horizontal scroll on mobile */}
          <div style={{ maxWidth: 1100, margin: "0 auto 40px" }}>
            <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden", backgroundColor: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ overflowX: "auto", maxHeight: 1400, overflowY: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
                  <thead>
                    <tr>
                      <SortableHeader label="Date"      columnKey="date"          tooltipId="date"         {...headerProps} />
                      <SortableHeader label="Away"      columnKey="away"          tooltipId="away"    align="left" {...headerProps} />
                      <SortableHeader label="Home"      columnKey="home"          tooltipId="home"    align="left" {...headerProps} />
                      <SortableHeader label="Vegas Line" columnKey="vegasHomeLine" tooltipId="vegasHomeLine" {...headerProps} />
                      <SortableHeader label="BBMI Line"  columnKey="bbmiHomeLine"  tooltipId="bbmiHomeLine"  {...headerProps} />
                      <SortableHeader label="Edge"      columnKey="edge"          tooltipId="edge"         {...headerProps} />
                      <SortableHeader label="BBMI Pick" columnKey="bbmiPick"      tooltipId="bbmiPick" align="left" {...headerProps} />
                      <SortableHeader label="BBMI Win%" columnKey="bbmiWinProb"   tooltipId="bbmiWinProb"  {...headerProps} />
                      <SortableHeader label="Vegas Win%" columnKey="vegaswinprob" tooltipId="vegaswinprob" {...headerProps} />
                    </tr>
                  </thead>

                  <tbody>
                    {sortedUpcoming.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px 0", color: "#78716c", fontStyle: "italic", fontSize: 14 }}>No games match the selected edge filter.</td></tr>
                    )}

                    {sortedUpcoming.map((g, i) => {
                      const isLocked = !isPremium && g.edge >= FREE_EDGE_LIMIT;
                      if (isLocked) {
                        return <LockedRowOverlay key={i} colSpan={9} onSubscribe={() => setShowPaywall(true)} winPct={edgeStats.highEdgeWinPct} />;
                      }

                      const rowBg = i % 2 === 0 ? "rgba(250,250,249,0.6)" : "#ffffff";
                      return (
                        <tr key={i} style={{ backgroundColor: rowBg }}>
                          <td style={TD}>{g.date}</td>
                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(String(g.away))}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={String(g.away)} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.away}</span>
                                {(() => { const r = getTeamRecord(String(g.away)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>
                          <td style={TD}>
                            <Link href={`/ncaa-team/${encodeURIComponent(String(g.home))}`} style={{ display: "flex", alignItems: "center", gap: 8, color: "#0a1a2f" }} className="hover:underline">
                              <NCAALogo teamName={String(g.home)} size={22} />
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: 13, fontWeight: 500 }}>{g.home}</span>
                                {(() => { const r = getTeamRecord(String(g.home)); return r ? <span style={{ fontSize: 10, fontWeight: 700, color: r.color }}>{r.display}</span> : null; })()}
                              </div>
                            </Link>
                          </td>
                          <td style={TD_RIGHT}>{g.vegasHomeLine}</td>
                          <td style={TD_RIGHT}>{g.bbmiHomeLine}</td>
                          <td style={{ ...TD_RIGHT, color: g.edge >= FREE_EDGE_LIMIT ? "#16a34a" : "#374151", fontWeight: g.edge >= FREE_EDGE_LIMIT ? 800 : 600 }}>
                            {g.edge.toFixed(1)}
                          </td>
                          <td style={TD}>
                            {g.bbmiPick && (
                              <Link href={`/ncaa-team/${encodeURIComponent(String(g.bbmiPick))}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#0a1a2f" }} className="hover:underline">
                                <NCAALogo teamName={String(g.bbmiPick)} size={18} />
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{g.bbmiPick}</span>
                              </Link>
                            )}
                          </td>
                          <td style={TD_RIGHT}>{g.bbmiWinProb == null ? "—" : `${(g.bbmiWinProb * 100).toFixed(1)}%`}</td>
                          <td style={TD_RIGHT}>{g.vegaswinprob == null ? "—" : `${(g.vegaswinprob * 100).toFixed(1)}%`}</td>
                        </tr>
                      );
                    })}

                    {/* Bottom CTA */}
                    {!isPremium && lockedCount > 0 && (
                      <tr style={{ backgroundColor: "#f0f9ff" }}>
                        <td colSpan={9} style={{ padding: "1rem", textAlign: "center" }}>
                          <div style={{ fontSize: "0.82rem", color: "#0369a1", marginBottom: "0.5rem" }}>
                            <strong>{lockedCount} high-edge {lockedCount === 1 ? "pick" : "picks"}</strong> locked above — historically <strong>{edgeStats.highEdgeWinPct}%</strong> accurate vs {edgeStats.overallWinPct}% overall
                          </div>
                          <button onClick={() => setShowPaywall(true)} style={{ backgroundColor: "#0a1a2f", color: "#ffffff", border: "none", borderRadius: 7, padding: "0.6rem 1.5rem", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>
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
      </div>
    </>
  );
}

export default function BettingLinesPage() {
  return (
    <AuthProvider>
      <BettingLinesPageContent />
    </AuthProvider>
  );
}
