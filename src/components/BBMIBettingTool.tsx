"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebase-config";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KalshiTrade {
  ticker: string;
  sport: string;
  market_type: string;
  date: string;
  game_time: string | null;
  away_team: string;
  home_team: string;
  pick_team: string;
  pick_line: string;
  entry_price: number | null;
  amount_wagered: number | null;
  settled: boolean;
  settled_time: string | null;
  created_time: string | null;
  bbmi_matched: boolean;
  result?: string;
  revenue?: number;
  cost?: number;
  fee?: number;
  pnl?: number;
  market_result?: string;
  bbmiLine?: number;
  vegasLine?: number;
  bbmiTotal?: number;
  vegasTotal?: number;
  bbmiWinProb?: number;
  actualHome?: number;
  actualAway?: number;
  ouPick?: string;
  ouEdge?: number;
  edge?: number;
  tier?: string;
}

interface KalshiSummary {
  balance: number;
  total_trades: number;
  settled: number;
  wins: number;
  losses: number;
  win_pct: number;
  total_pnl: number;
  total_wagered: number;
  roi_pct: number;
  by_sport: Record<string, { w: number; l: number; pnl: number }>;
  last_updated: string;
}

interface KalshiData {
  summary: KalshiSummary | null;
  trades: KalshiTrade[];
}

interface MLBGame {
  gameDate?: string;
  date?: string;
  homeTeam?: string;
  awayTeam?: string;
  bbmiMargin?: number;
  vegasLine?: number;
  bbmiTotal?: number;
  vegasTotal?: number;
  ouPick?: string;
  ouEdge?: number;
  edge?: number;
  confidenceTier?: string;
  rlPick?: string;
  actualHomeScore?: number | null;
  actualAwayScore?: number | null;
  homePitcher?: string;
  awayPitcher?: string;
  gameTimeUTC?: string;
  kalshi?: {
    spread: any | null;
    total: any | null;
    spread_event_ticker: string | null;
    total_event_ticker: string | null;
  };
}

// ─── Today Bet type ───────────────────────────────────────────────────────────
interface TodayBet {
  gameId: string;         // homeTeam|awayTeam|date
  pick: string;           // e.g. "Kansas City Royals +1.5" or "OVER 6.5"
  size: number | null;    // dollars wagered
  odds: number | null;    // entry price in cents (Kalshi style, e.g. 52 = $0.52)
  outcome: "WIN" | "LOSS" | "PENDING";
  source: "kalshi" | "manual";
  ticker?: string;        // Kalshi market ticker if auto-matched
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
const BETS_PATH = (uid: string) => doc(db, "bettingJournal", uid, "data", "todayBets");

async function loadTodayBets(uid: string): Promise<Record<string, TodayBet>> {
  try {
    const snap = await getDoc(BETS_PATH(uid));
    if (snap.exists()) return snap.data() as Record<string, TodayBet>;
  } catch {}
  return {};
}

async function saveTodayBets(uid: string, bets: Record<string, TodayBet>) {
  try {
    await setDoc(BETS_PATH(uid), bets);
  } catch (e) {
    console.error("Failed to save bets:", e);
  }
}

// ─── useTodayBets hook ────────────────────────────────────────────────────────
// Fuzzy match: does kalshiName overlap with bbmiName?
function fuzzyTeamMatch(kalshiName: string, bbmiName: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const abbrev: Record<string, string> = {
    "as": "athletics", "new york y": "yankees", "new york m": "mets",
    "la d": "dodgers", "la a": "angels", "chicago w": "white sox", "chicago c": "cubs",
  };
  const k = abbrev[norm(kalshiName)] ?? norm(kalshiName);
  const b = norm(bbmiName);
  const bWords = b.split(" ").filter(w => w.length > 3);
  return bWords.some(w => k.includes(w)) || k.split(" ").filter(w => w.length > 3).some(w => b.includes(w));
}

function useTodayBets(trades: KalshiTrade[], games: { homeTeam?: string; awayTeam?: string; gameDate?: string; date?: string }[]) {
  const [bets, setBets] = useState<Record<string, TodayBet>>({});
  const [uid, setUid] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = todayStr();

  // Load from Firestore on auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      setUid(user.uid);
      const saved = await loadTodayBets(user.uid);
      setBets(saved);
    });
    return unsub;
  }, []);

  // Pull live Kalshi positions and match to today's game cards
  useEffect(() => {
    if (!games.length) return;
    fetch("/api/kalshi-positions")
      .then(r => r.json())
      .then(({ positions }: { positions: any[] }) => {
        if (!positions?.length) return;
        setBets(prev => {
          const next = { ...prev };
          for (const pos of positions) {
            // Find matching game by fuzzy team name
            const matchedGame = games.find(g => {
              const home = g.homeTeam ?? "";
              const away = g.awayTeam ?? "";
              return fuzzyTeamMatch(pos.home, home) && fuzzyTeamMatch(pos.away, away);
            });
            if (!matchedGame) continue;
            const gameDate = matchedGame.gameDate ?? matchedGame.date ?? today;
            const key = `${matchedGame.homeTeam}|${matchedGame.awayTeam}|${gameDate}`;
            // Only auto-fill if not already manually edited
            if (next[key]?.source === "manual") continue;
            // Build pick label from position data
            const sideLabel = pos.side === "yes" ? "YES" : "NO";
            const pick = `${sideLabel} · ${pos.title}`;
            next[key] = {
              gameId: key,
              pick,
              size: pos.cost,
              odds: pos.avg_price != null ? Math.round(pos.avg_price * 100) : null,
              outcome: "PENDING",
              source: "kalshi",
              ticker: pos.ticker,
            };
          }
          return next;
        });
      })
      .catch(e => console.warn("kalshi-positions fetch failed:", e));
  }, [games, today]);

  // Debounced Firestore save
  const updateBet = useCallback((gameId: string, patch: Partial<TodayBet>) => {
    setBets(prev => {
      const next = {
        ...prev,
        [gameId]: Object.assign({ pick: "", size: null, odds: null, outcome: "PENDING" as const, source: "manual" as const }, prev[gameId], { gameId }, patch),
      };
      if (uid) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveTodayBets(uid, next), 800);
      }
      return next;
    });
  }, [uid]);

  return { bets, updateBet };
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CFG = {
  unitPct: 0.015,
  tiers: [
    { label: "Edge 5–6",  min: 5,  max: 6,   units: 1.0, winPct: 0.638, color: "#2563eb" },
    { label: "Edge 6–8",  min: 6,  max: 8,   units: 1.5, winPct: 0.645, color: "#1a6640" },
    { label: "Edge 8–10", min: 8,  max: 10,  units: 2.0, winPct: 0.662, color: "#c9a84c" },
    { label: "Edge ≥ 10", min: 10, max: 999, units: 2.5, winPct: 0.748, color: "#dc2626" },
  ],
};

// ─── Sport accent colors ─────────────────────────────────────────────────────
const SPORT_ACCENT: Record<string, string> = {
  MLB: "#1a6640",
  NCAAB: "#4a6fa5",
  NCAAF: "#6b7280",
  "NCAA Baseball": "#1a7a8a",
};
const DEFAULT_ACCENT = "#2952cc";
const accent = (sport?: string) => SPORT_ACCENT[sport ?? ""] ?? DEFAULT_ACCENT;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) => {
  const abs = Math.abs(n);
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(2)}`;
  return n < 0 ? `-${formatted}` : formatted;
};
const fmtDate = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${m}/${d}/${y.slice(2)}`;
};
const todayStr = () => new Date().toLocaleDateString("en-CA");

// ─── Styles (warm cream theme) ───────────────────────────────────────────────
const S = {
  page: {
    background: "#f0efe9",
    minHeight: "100vh",
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    color: "#1a1a1a",
    padding: "0 0 4rem",
  } as React.CSSProperties,

  header: {
    background: "#ffffff",
    borderBottom: "1px solid #d4d2cc",
    padding: "1.25rem 1.5rem 1rem",
    position: "sticky" as const,
    top: 0,
    zIndex: 100,
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  },

  headerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
  },

  logo: {
    fontSize: "1.1rem",
    fontWeight: 800,
    color: "#1a1a1a",
    letterSpacing: "-0.02em",
  },

  adminBadge: {
    fontSize: "0.6rem",
    fontWeight: 700,
    color: "#888888",
    background: "#eae8e1",
    border: "1px solid #d4d2cc",
    borderRadius: 4,
    padding: "2px 6px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginLeft: "0.5rem",
  },

  sportPills: {
    display: "flex",
    gap: "0.4rem",
    justifyContent: "center",
  },

  pill: (active: boolean, sportKey?: string): React.CSSProperties => ({
    padding: "0.3rem 0.9rem",
    borderRadius: 20,
    fontSize: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
    border: active ? "none" : "1px solid #d6d3d1",
    background: active ? accent(sportKey) : "#ffffff",
    color: active ? "#ffffff" : "#555555",
    transition: "all 0.15s",
    letterSpacing: "0.02em",
  }),

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "0.6rem",
    padding: "1rem 1.5rem",
  },

  card: (accentColor?: string): React.CSSProperties => ({
    background: "#ffffff",
    border: "1px solid #d4d2cc",
    borderTop: `4px solid ${accentColor ?? "#d4d2cc"}`,
    borderRadius: 10,
    padding: "0.75rem 1rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
  }),

  cardLabel: {
    fontSize: "0.6rem",
    fontWeight: 700,
    color: "#777777",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.3rem",
  } as React.CSSProperties,

  cardValue: (color?: string): React.CSSProperties => ({
    fontSize: "1.3rem",
    fontWeight: 800,
    color: color ?? "#1a1a1a",
    letterSpacing: "-0.03em",
    lineHeight: 1,
  }),

  cardSub: {
    fontSize: "0.65rem",
    color: "#888888",
    marginTop: "0.2rem",
  } as React.CSSProperties,

  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid #d4d2cc",
    padding: "0 1.5rem",
    overflowX: "auto" as const,
    background: "#ffffff",
  },

  tab: (active: boolean, sportKey?: string): React.CSSProperties => ({
    padding: "0.65rem 1.1rem",
    fontSize: "0.78rem",
    fontWeight: active ? 700 : 500,
    color: active ? accent(sportKey) : "#888888",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: active ? `2px solid ${accent(sportKey)}` : "2px solid transparent",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    background: "none",
    transition: "color 0.15s",
  }),

  content: {
    padding: "1.25rem 1.5rem",
  },

  alert: (color: string, bg: string, border: string): React.CSSProperties => ({
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: "0.65rem 1rem",
    fontSize: "0.78rem",
    color: color,
    marginBottom: "1rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  }),

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.8rem",
  },

  th: (sportKey?: string): React.CSSProperties => ({
    padding: "0.6rem 0.75rem",
    textAlign: "left" as const,
    fontSize: "0.62rem",
    fontWeight: 700,
    color: "#ffffff",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    borderBottom: "1px solid #ece9e2",
    background: accent(sportKey),
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  }),

  td: {
    padding: "0.6rem 0.75rem",
    borderBottom: "1px solid #ece9e2",
    color: "#1a1a1a",
    verticalAlign: "middle" as const,
  },

  badge: (color: string, bg: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 7px",
    borderRadius: 4,
    fontSize: "0.65rem",
    fontWeight: 700,
    color,
    background: bg,
    letterSpacing: "0.04em",
  }),

  sectionTitle: {
    fontSize: "0.7rem",
    fontWeight: 700,
    color: "#777777",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginBottom: "0.75rem",
  } as React.CSSProperties,

  gameCard: (highlighted: boolean): React.CSSProperties => ({
    background: highlighted ? "#ffffff" : "#ffffff",
    border: `1px solid ${highlighted ? "#b8d4c8" : "#d4d2cc"}`,
    borderRadius: 10,
    padding: "0.9rem 1rem",
    marginBottom: "0.6rem",
    boxShadow: highlighted ? "0 1px 6px rgba(26,102,64,0.10)" : "0 1px 4px rgba(0,0,0,0.07)",
  }),
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent: accentColor, valueColor }: {
  label: string; value: string; sub?: string; accent?: string; valueColor?: string;
}) {
  return (
    <div style={S.card(accentColor)}>
      <div style={S.cardLabel}>{label}</div>
      <div style={S.cardValue(valueColor)}>{value}</div>
      {sub && <div style={S.cardSub}>{sub}</div>}
    </div>
  );
}

function SportBadge({ sport }: { sport: string }) {
  const colors: Record<string, [string, string]> = {
    MLB:   ["#1a6640", "#e6f4ec"],
    NCAAB: ["#4a6fa5", "#e8eef6"],
  };
  const [color, bg] = colors[sport] ?? ["#666666", "#f0efe9"];
  return <span style={S.badge(color, bg)}>{sport}</span>;
}

function ResultBadge({ result }: { result?: string }) {
  if (!result) return <span style={{ color: "#888888", fontSize: "0.72rem" }}>Pending</span>;
  const map: Record<string, [string, string]> = {
    WIN:  ["#166534", "#dcfce7"],
    LOSS: ["#991b1b", "#fee2e2"],
  };
  const [color, bg] = map[result.toUpperCase()] ?? ["#666666", "#f0efe9"];
  return <span style={S.badge(color, bg)}>{result.toUpperCase()}</span>;
}

function MarketBadge({ type }: { type: string }) {
  return (
    <span style={S.badge(type === "spread" ? "#5b21b6" : "#166534", type === "spread" ? "#ede9fe" : "#dcfce7")}>
      {type === "spread" ? "Spread" : "Total"}
    </span>
  );
}

// ─── My Bet Panel ─────────────────────────────────────────────────────────────
function MyBetPanel({ gameId, bet, onUpdate }: {
  gameId: string;
  bet: TodayBet | undefined;
  onUpdate: (gameId: string, patch: Partial<TodayBet>) => void;
}) {
  const hasKalshiBet = bet?.source === "kalshi";
  const [open, setOpen] = useState(!!bet);
  const b = bet;

  // Auto-expand when Kalshi bet arrives
  useEffect(() => { if (hasKalshiBet) setOpen(true); }, [hasKalshiBet]);

  const inputStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    padding: "0.3rem 0.5rem",
    border: "1px solid #d4d2cc",
    borderRadius: 5,
    background: "#fafaf8",
    color: "#1a1a1a",
    outline: "none",
    width: "100%",
  };

  const sourceBadge = b?.source === "kalshi"
    ? <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#1a6640", background: "#e6f4ec", borderRadius: 4, padding: "1px 6px", marginLeft: 6 }}>Kalshi</span>
    : b?.source === "manual"
    ? <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#5b21b6", background: "#ede9fe", borderRadius: 4, padding: "1px 6px", marginLeft: 6 }}>Manual</span>
    : null;

  const outcomeColor = b?.outcome === "WIN" ? "#166534" : b?.outcome === "LOSS" ? "#dc2626" : "#888888";

  const payout = b?.size != null && b?.odds != null && b.odds > 0 ? ((b.size * (100 - b.odds)) / b.odds) : null;

  return (
    <div style={{ marginTop: "0.75rem", paddingTop: "0.65rem", borderTop: "1px solid #e8e6e0" }}>
      {/* Kalshi bet summary — always visible when matched */}
      {hasKalshiBet && b && (
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" as const, marginBottom: "0.65rem", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Position</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a6640" }}>{b.pick || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Wagered</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#1a1a1a", fontFamily: "monospace" }}>{b.size != null ? `$${b.size.toFixed(2)}` : "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Avg Price</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#666", fontFamily: "monospace" }}>{b.odds != null ? `${b.odds}¢` : "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Payout if Win</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#166534", fontFamily: "monospace" }}>{payout != null ? `+$${payout.toFixed(2)}` : "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: outcomeColor }}>{b.outcome}</div>
          </div>
          {sourceBadge}
        </div>
      )}

      {/* Header row — click to expand/collapse manual entry */}
      {!hasKalshiBet && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: open ? "0.65rem" : 0 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#777777", textTransform: "uppercase", letterSpacing: "0.07em" }}>My Bet</span>
            {sourceBadge}
            {b && b.outcome !== "PENDING" && (
              <span style={{ fontSize: "0.62rem", fontWeight: 700, color: outcomeColor }}>
                {b.outcome === "WIN" ? "✓ WIN" : "✗ LOSS"}
              </span>
            )}
            {b && b.size != null && b.outcome === "PENDING" && (
              <span style={{ fontSize: "0.62rem", color: "#888888" }}>${b.size.toFixed(2)} wagered · pending</span>
            )}
          </div>
          <span style={{ fontSize: "0.7rem", color: "#aaaaaa" }}>{open ? "▲" : "▼"}</span>
        </div>
      )}

      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.5rem", alignItems: "end" }}>
          {/* Pick */}
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pick</div>
            <input
              style={inputStyle}
              value={b?.pick ?? ""}
              placeholder="e.g. KC Royals +1.5"
              onChange={e => onUpdate(gameId, { pick: e.target.value, source: "manual" })}
            />
          </div>
          {/* Size */}
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Wagered ($)</div>
            <input
              style={inputStyle}
              type="number"
              value={b?.size ?? ""}
              placeholder="0.00"
              onChange={e => onUpdate(gameId, { size: parseFloat(e.target.value) || null, source: b?.source === "kalshi" ? "kalshi" : "manual" })}
            />
          </div>
          {/* Odds */}
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Price (¢)</div>
            <input
              style={inputStyle}
              type="number"
              value={b?.odds ?? ""}
              placeholder="52"
              onChange={e => onUpdate(gameId, { odds: parseInt(e.target.value) || null, source: b?.source === "kalshi" ? "kalshi" : "manual" })}
            />
          </div>
          {/* Outcome */}
          <div>
            <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Outcome</div>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={b?.outcome ?? "PENDING"}
              onChange={e => onUpdate(gameId, { outcome: e.target.value as TodayBet["outcome"] })}
            >
              <option value="PENDING">Pending</option>
              <option value="WIN">WIN ✓</option>
              <option value="LOSS">LOSS ✗</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Today's Picks — MLB ──────────────────────────────────────────────────────
function MLBPicksTab({ trades }: { trades: KalshiTrade[] }) {
  const [games, setGames] = useState<MLBGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [kalshiFetched, setKalshiFetched] = useState<string | null>(null);
  const today = todayStr();
  const { bets, updateBet } = useTodayBets(trades, games);

  useEffect(() => {
    const loadFromMLB = () => {
      fetch("/api/mlb-games")
        .then(r => r.json())
        .then((data: MLBGame[]) => {
          setGames(data.filter(g => (g.gameDate ?? g.date ?? "").startsWith(today)));
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetch("/api/kalshi-odds")
      .then(r => r.json())
      .then((data: { games: MLBGame[]; fetched_at?: string }) => {
        const todayGames = (data.games ?? []).filter(g =>
          (g.gameDate ?? g.date ?? "").startsWith(today)
        );
        if (todayGames.length > 0) {
          setGames(todayGames);
          setKalshiFetched(data.fetched_at ?? null);
          setLoading(false);
        } else {
          // Kalshi returned no games for today — fall back to pipeline data
          loadFromMLB();
        }
      })
      .catch(() => loadFromMLB());
  }, [today]);

  if (loading) return <div style={{ color: "#888888", padding: "2rem", textAlign: "center" }}>Loading MLB picks…</div>;
  if (!games.length) return <div style={{ color: "#888888", padding: "2rem", textAlign: "center" }}>No MLB games today.</div>;

  const withEdge = games.filter(g => g.edge != null && Math.abs(g.bbmiMargin ?? 0) >= 1.0);
  const noEdge = games.filter(g => !withEdge.includes(g));

  return (
    <div>
      {kalshiFetched && (
        <div style={{ fontSize: "0.65rem", color: "#aaaaaa", marginBottom: "0.75rem" }}>
          Kalshi odds as of {new Date(kalshiFetched).toLocaleTimeString()}
        </div>
      )}
      {withEdge.length > 0 && (
        <>
          <div style={S.sectionTitle}>BBMI Picks — {withEdge.length} qualifying game{withEdge.length !== 1 ? "s" : ""}</div>
          {withEdge.map((g, i) => <MLBGameCard key={i} game={g} highlighted bets={bets} onBetUpdate={updateBet} />)}
          <div style={{ marginTop: "1.5rem" }} />
        </>
      )}
      {noEdge.length > 0 && (
        <>
          <div style={S.sectionTitle}>All Games — {noEdge.length} below threshold</div>
          {noEdge.map((g, i) => <MLBGameCard key={i} game={g} highlighted={false} bets={bets} onBetUpdate={updateBet} />)}
        </>
      )}
    </div>
  );
}

function MLBGameCard({ game: g, highlighted, bets, onBetUpdate }: {
  game: MLBGame;
  highlighted: boolean;
  bets: Record<string, TodayBet>;
  onBetUpdate: (gameId: string, patch: Partial<TodayBet>) => void;
}) {
  const today = todayStr();
  const gameId = `${g.homeTeam}|${g.awayTeam}|${today}`;
  const time = g.gameTimeUTC ? new Date(g.gameTimeUTC).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : null;
  const isComplete = g.actualHomeScore != null;
  const kalshi = (g as any).kalshi;
  const spread = kalshi?.spread;
  const total = kalshi?.total;

  const midPct = (bid: string, ask: string) => {
    const mid = (parseFloat(bid) + parseFloat(ask)) / 2;
    return `${(mid * 100).toFixed(0)}%`;
  };

  return (
    <div style={S.gameCard(highlighted)}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a", marginBottom: "0.2rem" }}>
            {g.awayTeam} <span style={{ color: "#888888" }}>@</span> {g.homeTeam}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#888888" }}>
            {g.awayPitcher && `${g.awayPitcher} vs ${g.homePitcher}`}
            {time && ` · ${time} CT`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {isComplete ? (
            <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1a1a1a" }}>
              {g.actualAwayScore} – {g.actualHomeScore}
            </div>
          ) : (
            <div style={{ fontSize: "0.72rem", color: "#888888" }}>Upcoming</div>
          )}
        </div>
      </div>

      {/* BBMI Model fields — O/U + Spread */}
      <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.65rem", flexWrap: "wrap" as const }}>
        {/* O/U section */}
        {g.bbmiTotal != null && g.vegasTotal != null && (
          <>
            <div>
              <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>BBMI Total</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#5b21b6" }}>{g.bbmiTotal.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Vegas O/U</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "#666666" }}>{g.vegasTotal.toFixed(1)}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>O/U Edge</div>
              <div style={{ fontSize: "0.88rem", fontWeight: 700, color: Math.abs(g.bbmiTotal - g.vegasTotal) >= 1.0 ? "#5b21b6" : "#888888" }}>
                {g.bbmiTotal > g.vegasTotal ? "+" : ""}{(g.bbmiTotal - g.vegasTotal).toFixed(1)}
              </div>
            </div>
          </>
        )}
        {g.ouPick && (
          <div>
            <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>O/U Pick</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#5b21b6" }}>{g.ouPick.toUpperCase()} {g.vegasTotal}</div>
          </div>
        )}
        {/* Spread section */}
        {g.bbmiMargin != null && (
          <div>
            <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>BBMI Margin</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a6640" }}>{g.bbmiMargin > 0 ? "+" : ""}{g.bbmiMargin.toFixed(2)}</div>
          </div>
        )}
        {g.rlPick && (
          <div>
            <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Run Line</div>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a6640" }}>{g.rlPick}</div>
          </div>
        )}
      </div>

      {/* Kalshi Live Odds */}
      {(spread || total) && (
        <div style={{ marginTop: "0.75rem", paddingTop: "0.65rem", borderTop: "1px solid #e8e6e0" }}>
          <div style={{ fontSize: "0.6rem", color: "#aaaaaa", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
            Kalshi Live Odds
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" as const }}>

            {/* Spread */}
            {spread && (
              <div style={{ background: "#f8f7f4", borderRadius: 8, padding: "0.5rem 0.75rem", minWidth: 200 }}>
                <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                  Spread ±{spread.floor_strike} · {spread.yes_sub_title}
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.1rem" }}>YES (bid / ask)</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                      {spread.yes_bid} / {spread.yes_ask}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#888888" }}>~{midPct(spread.yes_bid, spread.yes_ask)} implied</div>
                  </div>
                  <div style={{ width: 1, background: "#e8e6e0" }} />
                  <div>
                    <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.1rem" }}>NO (bid / ask)</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#991b1b" }}>
                      {spread.no_bid} / {spread.no_ask}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#888888" }}>~{midPct(spread.no_bid, spread.no_ask)} implied</div>
                  </div>
                </div>
              </div>
            )}

            {/* Total */}
            {total && (
              <div style={{ background: "#f8f7f4", borderRadius: 8, padding: "0.5rem 0.75rem", minWidth: 220 }}>
                <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
                  Total O/U {total.floor_strike} · Vol 24h: {parseFloat(total.volume_24h ?? "0").toFixed(0)}
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.1rem" }}>OVER / YES (bid / ask)</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
                      {total.yes_bid} / {total.yes_ask}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#888888" }}>~{midPct(total.yes_bid, total.yes_ask)} implied</div>
                  </div>
                  <div style={{ width: 1, background: "#e8e6e0" }} />
                  <div>
                    <div style={{ fontSize: "0.58rem", color: "#888888", marginBottom: "0.1rem" }}>UNDER / NO (bid / ask)</div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#991b1b" }}>
                      {total.no_bid} / {total.no_ask}
                    </div>
                    <div style={{ fontSize: "0.6rem", color: "#888888" }}>~{midPct(total.no_bid, total.no_ask)} implied</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <MyBetPanel gameId={gameId} bet={bets[gameId]} onUpdate={onBetUpdate} />
    </div>
  );
}

// ─── Today's Picks — NCAAB ───────────────────────────────────────────────────
function NCAABPicksTab() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayStr();

  useEffect(() => {
    fetch("/api/ncaab-games")
      .then(r => r.json())
      .then((data: any[]) => {
        const todayGames = data.filter(g => (g.date ?? "").startsWith(today));
        setGames(todayGames);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [today]);

  if (loading) return <div style={{ color: "#888888", padding: "2rem", textAlign: "center" }}>Loading NCAAB picks…</div>;
  if (!games.length) return <div style={{ color: "#888888", padding: "2rem", textAlign: "center" }}>No NCAAB games today.</div>;

  const minEdge = 5;
  const withEdge = games.filter(g => Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0)) >= minEdge);
  const noEdge = games.filter(g => !withEdge.includes(g));

  return (
    <div>
      {withEdge.length > 0 && (
        <>
          <div style={S.sectionTitle}>BBMI Picks — {withEdge.length} qualifying game{withEdge.length !== 1 ? "s" : ""}</div>
          {withEdge.map((g, i) => {
            const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
            const pickIsHome = (g.bbmiHomeLine ?? 0) < (g.vegasHomeLine ?? 0);
            const pick = pickIsHome ? g.home : g.away;
            return (
              <div key={i} style={S.gameCard(true)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a1a1a" }}>
                    {g.away} <span style={{ color: "#888888" }}>@</span> {g.home}
                  </div>
                  {g.actualHomeScore != null && (
                    <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1a1a1a" }}>
                      {g.actualAwayScore} – {g.actualHomeScore}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.65rem" }}>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Pick</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#4a6fa5" }}>{pick}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>BBMI Line</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#4a6fa5" }}>{g.bbmiHomeLine > 0 ? "+" : ""}{g.bbmiHomeLine}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Vegas</div>
                    <div style={{ fontSize: "0.88rem", color: "#666666" }}>{g.vegasHomeLine > 0 ? "+" : ""}{g.vegasHomeLine}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Edge</div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1a6640" }}>{edge.toFixed(1)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "#777777", textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Win Prob</div>
                    <div style={{ fontSize: "0.88rem", color: "#5b21b6" }}>{g.bbmiWinProb ? `${(g.bbmiWinProb * 100).toFixed(0)}%` : "—"}</div>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: "1.5rem" }} />
        </>
      )}
      {noEdge.length > 0 && (
        <>
          <div style={S.sectionTitle}>All Games — {noEdge.length} below threshold</div>
          {noEdge.map((g, i) => (
            <div key={i} style={S.gameCard(false)}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: "0.85rem", color: "#666666" }}>
                  {g.away} @ {g.home}
                </div>
                {g.actualHomeScore != null && (
                  <div style={{ fontSize: "0.85rem", color: "#888888" }}>
                    {g.actualAwayScore} – {g.actualHomeScore}
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Journal Tab ──────────────────────────────────────────────────────────────
function JournalTab({ trades, sport }: { trades: KalshiTrade[]; sport: string }) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [marketFilter, setMarketFilter] = useState<"all" | "spread" | "total">("all");
  const [resultFilter, setResultFilter] = useState<"all" | "WIN" | "LOSS">("all");

  const filtered = useMemo(() => {
    return trades
      .filter(t => sport === "ALL" || t.sport === sport)
      .filter(t => marketFilter === "all" || t.market_type === marketFilter)
      .filter(t => resultFilter === "all" || t.result === resultFilter)
      .sort((a, b) => {
        const av = a[sort.key as keyof KalshiTrade] ?? "";
        const bv = b[sort.key as keyof KalshiTrade] ?? "";
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [trades, sport, sort, marketFilter, resultFilter]);

  const handleSort = (key: string) => setSort(prev => ({
    key,
    dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
  }));

  const totalPnl = filtered.filter(t => t.settled).reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins = filtered.filter(t => t.result === "WIN").length;
  const losses = filtered.filter(t => t.result === "LOSS").length;

  // Compute running balance — work chronologically on the full unfiltered trade list,
  // then look up each filtered trade's running balance by ticker
  const runningBalanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    // Sort all settled trades oldest-first to accumulate chronologically
    const allSettled = [...trades]
      .filter(t => t.settled && t.pnl != null)
      .sort((a, b) => (a.settled_time ?? a.date) < (b.settled_time ?? b.date) ? -1 : 1);
    let running = 0;
    for (const t of allSettled) {
      running = Math.round((running + (t.pnl ?? 0)) * 100) / 100;
      map[t.ticker] = running;
    }
    return map;
  }, [trades]);

  const sportAccent = accent(sport);

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" as const, alignItems: "center" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(["all", "spread", "total"] as const).map(f => (
            <button key={f} onClick={() => setMarketFilter(f)} style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              borderColor: marketFilter === f ? sportAccent : "#d6d3d1",
              background: marketFilter === f ? sportAccent : "transparent",
              color: marketFilter === f ? "#ffffff" : "#666666",
            }}>{f === "all" ? "All Markets" : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {(["all", "WIN", "LOSS"] as const).map(f => (
            <button key={f} onClick={() => setResultFilter(f)} style={{
              padding: "0.3rem 0.7rem", borderRadius: 6, fontSize: "0.72rem", fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              borderColor: resultFilter === f ? sportAccent : "#d6d3d1",
              background: resultFilter === f ? sportAccent : "transparent",
              color: resultFilter === f ? "#ffffff" : "#666666",
            }}>{f === "all" ? "All Results" : f}</button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: "0.72rem", color: "#888888" }}>
          {filtered.length} trades · {wins}-{losses} · <span style={{ color: totalPnl >= 0 ? "#166534" : "#dc2626" }}>{totalPnl >= 0 ? "+" : ""}{fmt$(totalPnl)}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" as const, borderRadius: 10, border: "1px solid #d4d2cc", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <table style={S.table}>
          <thead>
            <tr>
              {[
                { key: "date", label: "Date" },
                { key: "sport", label: "Sport" },
                { key: "market_type", label: "Market" },
                { key: "away_team", label: "Matchup" },
                { key: "pick_team", label: "Pick" },
                { key: "entry_price", label: "Price" },
                { key: "amount_wagered", label: "Wagered" },
                { key: "result", label: "Result" },
                { key: "pnl", label: "P&L" },
                { key: "balance", label: "Balance" },
                { key: "bbmi_matched", label: "BBMI" },
              ].map(col => (
                <th key={col.key} style={S.th(sport)} onClick={() => handleSort(col.key)}>
                  {col.label} {sort.key === col.key ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, i) => (
              <tr key={t.ticker} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                <td style={S.td}>{fmtDate(t.date)}</td>
                <td style={S.td}><SportBadge sport={t.sport} /></td>
                <td style={S.td}><MarketBadge type={t.market_type} /></td>
                <td style={S.td}>
                  <div style={{ fontSize: "0.78rem", color: "#1a1a1a" }}>{t.away_team}</div>
                  <div style={{ fontSize: "0.68rem", color: "#888888" }}>@ {t.home_team}</div>
                </td>
                <td style={S.td}>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: sportAccent }}>{t.pick_team}</div>
                  {t.pick_line && <div style={{ fontSize: "0.65rem", color: "#888888" }}>+{t.pick_line}</div>}
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: "0.78rem", color: "#1a1a1a", fontWeight: 600 }}>
                  {t.entry_price != null ? `$${t.entry_price.toFixed(2)}` : "—"}
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: "0.78rem", color: "#1a1a1a", fontWeight: 600 }}>
                  {t.amount_wagered != null ? fmt$(t.amount_wagered) : "—"}
                </td>
                <td style={S.td}><ResultBadge result={t.result} /></td>
                <td style={{ ...S.td, fontFamily: "monospace", fontWeight: 700, color: (t.pnl ?? 0) >= 0 ? "#166534" : "#dc2626" }}>
                  {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}${fmt$(t.pnl)}` : "—"}
                </td>
                <td style={{ ...S.td, fontFamily: "monospace", fontSize: "0.78rem", fontWeight: 600, color: (() => { const b = runningBalanceMap[t.ticker]; return b == null ? "#888888" : b >= 0 ? "#166534" : "#dc2626"; })() }}>
                  {(() => {
                    const b = runningBalanceMap[t.ticker];
                    if (b == null) return "—";
                    return `${b >= 0 ? "+" : ""}${fmt$(b)}`;
                  })()}
                </td>
                <td style={S.td}>
                  {t.bbmi_matched ? (
                    <span style={S.badge("#166534", "#dcfce7")}>Matched</span>
                  ) : (
                    <span style={{ color: "#cccccc", fontSize: "0.65rem" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────
function PerformanceTab({ trades, summary }: { trades: KalshiTrade[]; summary: KalshiSummary | null }) {
  const settled = trades.filter(t => t.settled && t.result);

  const byMonth = useMemo(() => {
    const map: Record<string, { w: number; l: number; pnl: number; wagered: number }> = {};
    for (const t of settled) {
      const m = t.date.slice(0, 7);
      if (!map[m]) map[m] = { w: 0, l: 0, pnl: 0, wagered: 0 };
      if (t.result === "WIN") map[m].w++;
      else map[m].l++;
      map[m].pnl += t.pnl ?? 0;
      map[m].wagered += t.amount_wagered ?? 0;
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [settled]);

  const byMarket = useMemo(() => {
    const map: Record<string, { w: number; l: number; pnl: number }> = {};
    for (const t of settled) {
      const k = `${t.sport} ${t.market_type}`;
      if (!map[k]) map[k] = { w: 0, l: 0, pnl: 0 };
      if (t.result === "WIN") map[k].w++;
      else map[k].l++;
      map[k].pnl += t.pnl ?? 0;
    }
    return Object.entries(map).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l));
  }, [settled]);

  const row = (label: string, w: number, l: number, pnl: number, wagered?: number) => {
    const dec = w + l;
    const pct = dec > 0 ? (w / dec * 100).toFixed(1) : "—";
    const roi = wagered && wagered > 0 ? (pnl / wagered * 100).toFixed(1) : null;
    return (
      <tr key={label} style={{ borderBottom: "1px solid #ece9e2" }}>
        <td style={{ ...S.td, fontWeight: 600, color: "#1a1a1a" }}>{label}</td>
        <td style={{ ...S.td, fontFamily: "monospace", color: "#1a1a1a", fontWeight: 600 }}>{w}-{l}</td>
        <td style={{ ...S.td, fontFamily: "monospace", color: "#1a1a1a", fontWeight: 600 }}>{pct}%</td>
        <td style={{ ...S.td, fontFamily: "monospace", color: pnl >= 0 ? "#166534" : "#dc2626", fontWeight: 700 }}>
          {pnl >= 0 ? "+" : ""}{fmt$(pnl)}
        </td>
        {roi && <td style={{ ...S.td, fontFamily: "monospace", color: "#666666" }}>{parseFloat(roi) >= 0 ? "+" : ""}{roi}%</td>}
      </tr>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
      {/* By Sport */}
      <div style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #d4d2cc", background: "#eae8e1", fontSize: "0.65rem", fontWeight: 700, color: "#333333", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>By Sport</div>
        <table style={S.table}>
          <thead><tr>
            {["Sport", "W-L", "ATS%", "P&L"].map(h => <th key={h} style={S.th()}>{h}</th>)}
          </tr></thead>
          <tbody>
            {summary && Object.entries(summary.by_sport).map(([sport, d]) =>
              row(sport, d.w, d.l, d.pnl)
            )}
          </tbody>
        </table>
      </div>

      {/* By Market */}
      <div style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #d4d2cc", background: "#eae8e1", fontSize: "0.65rem", fontWeight: 700, color: "#333333", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>By Market Type</div>
        <table style={S.table}>
          <thead><tr>
            {["Market", "W-L", "ATS%", "P&L"].map(h => <th key={h} style={S.th()}>{h}</th>)}
          </tr></thead>
          <tbody>
            {byMarket.map(([k, d]) => row(k, d.w, d.l, d.pnl))}
          </tbody>
        </table>
      </div>

      {/* By Month */}
      <div style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", gridColumn: "1 / -1", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #d4d2cc", background: "#eae8e1", fontSize: "0.65rem", fontWeight: 700, color: "#333333", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Monthly Breakdown</div>
        <table style={S.table}>
          <thead><tr>
            {["Month", "W-L", "ATS%", "P&L", "ROI"].map(h => <th key={h} style={S.th()}>{h}</th>)}
          </tr></thead>
          <tbody>
            {byMonth.map(([m, d]) => row(m, d.w, d.l, d.pnl, d.wagered))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── EV Tables Tab ────────────────────────────────────────────────────────────
function EVTab({ balance, sport }: { balance: number; sport: string }) {
  const bankroll = balance;
  const sportAccent = accent(sport);
  const evRows = CFG.tiers.map(t => {
    const amt = t.units * bankroll * CFG.unitPct;
    const winPayout = amt * (100 / 110);
    const ev = t.winPct * winPayout - (1 - t.winPct) * amt;
    return { ...t, amt, winPayout, ev };
  });

  return (
    <div>
      <p style={{ fontSize: "0.78rem", color: "#666666", marginBottom: "1.25rem", lineHeight: 1.7 }}>
        Expected value per bet at Kalshi balance of <strong style={{ color: sportAccent }}>{fmt$(balance)}</strong> · unit = {(CFG.unitPct * 100).toFixed(1)}% = <strong style={{ color: sportAccent }}>{fmt$(balance * CFG.unitPct)}</strong>
      </p>
      <div style={{ border: "1px solid #d4d2cc", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ background: "#eae8e1", padding: "0.7rem 1rem", fontSize: "0.65rem", fontWeight: 700, color: "#333333", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>
          EV by Tier · Balance: {fmt$(balance)}
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              {["Tier", "Units", "Bet Size", "Win %", "Win Payout", "EV / Bet", "EV %"].map(h => (
                <th key={h} style={{ ...S.th(sport), textAlign: "right" as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {evRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#f8f7f4" }}>
                <td style={{ ...S.td, fontWeight: 800, color: row.color }}>{row.label}</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", color: "#666666", fontWeight: 600 }}>{row.units}u</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", fontWeight: 700, color: "#1a1a1a" }}>{fmt$(row.amt)}</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", color: "#666666", fontWeight: 600 }}>{(row.winPct * 100).toFixed(1)}%</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", color: "#166534", fontWeight: 600 }}>{fmt$(row.winPayout)}</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", fontWeight: 700, color: row.ev >= 0 ? "#166534" : "#dc2626" }}>{row.ev >= 0 ? "+" : ""}{fmt$(row.ev)}</td>
                <td style={{ ...S.td, textAlign: "right" as const, fontFamily: "monospace", color: row.ev >= 0 ? "#166534" : "#dc2626", fontWeight: 600 }}>{row.amt > 0 ? `${((row.ev / row.amt) * 100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────
function RulesTab() {
  const rules = [
    { title: "Bet Sizing", items: ["1.5% of bankroll per unit", "Edge 5–6: 1.0 units", "Edge 6–8: 1.5 units", "Edge 8–10: 2.0 units", "Edge ≥10: 2.5 units"] },
    { title: "Stop Loss", items: ["Weekly drawdown > 10% → pause", "Season floor at 40% of starting bankroll", "3-day losing streak → 24hr cooldown"] },
    { title: "Recalibration", items: ["Last 50 bets < 55% ATS → reduce unit size by 50%", "Minimum 20 settled bets before recal check", "Return to full sizing after 10-bet recovery window"] },
    { title: "Kalshi Rules", items: ["RL picks: away margin ≥ 1.0 run", "Home RL picks: margin ≥ 1.1 run", "Away Ace qualifier fires independently", "O/U edge threshold: 0.83 runs minimum"] },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      {rules.map(section => (
        <div key={section.title} style={{ background: "#ffffff", border: "1px solid #d4d2cc", borderRadius: 10, padding: "1rem 1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#2952cc", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: "0.75rem" }}>{section.title}</div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {section.items.map((item, i) => (
              <li key={i} style={{ fontSize: "0.8rem", color: "#666666", padding: "0.3rem 0", borderBottom: i < section.items.length - 1 ? "1px solid #ece9e2" : "none", display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#cccccc", flexShrink: 0 }}>·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BBMIBettingTool() {
  const [sport, setSport] = useState<"MLB" | "NCAAB">("MLB");
  const [tab, setTab] = useState("picks");
  const [kalshi, setKalshi] = useState<KalshiData>({ summary: null, trades: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Fetch Kalshi data
  const fetchKalshi = useCallback(async () => {
    try {
      const res = await fetch("/api/kalshi-trades");
      const data: KalshiData = await res.json();
      setKalshi(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Kalshi fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKalshi();
    const id = setInterval(fetchKalshi, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, [fetchKalshi]);

  const { summary, trades } = kalshi;
  const sportTrades = trades.filter(t => t.sport === sport);

  // Recalibration alert
  const last50 = trades.filter(t => t.settled && t.result).slice(-50);
  const last50Pct = last50.length >= 20 ? last50.filter(t => t.result === "WIN").length / last50.length * 100 : null;
  const showRecal = last50Pct !== null && last50Pct < 55;

  const sportAccent = accent(sport);

  const tabs = [
    { key: "picks", label: "Today's Picks" },
    { key: "journal", label: `Journal (${sportTrades.filter(t => t.settled).length})` },
    { key: "performance", label: "Performance" },
    { key: "rules", label: "Rules" },
    { key: "ev", label: "EV Tables" },
  ];

  if (loading) return (
    <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#888888", fontSize: "0.85rem" }}>Loading Kalshi data…</div>
    </div>
  );

  const sportRecord = summary?.by_sport?.[sport];

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={S.logo}>BBMI Betting Console</span>
            <span style={S.adminBadge}>ADMIN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {lastUpdated && <span style={{ fontSize: "0.65rem", color: "#aaaaaa" }}>Updated {lastUpdated}</span>}
            <button onClick={fetchKalshi} style={{ fontSize: "0.7rem", color: "#666666", background: "none", border: "1px solid #d6d3d1", borderRadius: 6, padding: "0.3rem 0.7rem", cursor: "pointer" }}>Refresh</button>
          </div>
        </div>
        <div style={S.sportPills}>
          {(["MLB", "NCAAB"] as const).map(s => (
            <button key={s} style={S.pill(sport === s, s)} onClick={() => setSport(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={S.cards}>
        <StatCard
          label="Kalshi Balance"
          value={summary ? fmt$(summary.balance) : "—"}
          sub="current account balance"
          accent={summary && summary.balance < 500 ? "#dc2626" : sportAccent}
          valueColor={summary && summary.balance < 500 ? "#dc2626" : "#1a1a1a"}
        />
        <StatCard
          label="Season P&L"
          value={summary ? `${summary.total_pnl >= 0 ? "+" : ""}${fmt$(summary.total_pnl)}` : "—"}
          sub={`ROI: ${summary?.roi_pct?.toFixed(1) ?? "—"}%`}
          accent={sportAccent}
          valueColor={summary && summary.total_pnl >= 0 ? sportAccent : "#dc2626"}
        />
        <StatCard
          label={`${sport} Record`}
          value={sportRecord ? `${sportRecord.w}-${sportRecord.l}` : "—"}
          sub={sportRecord ? `${(sportRecord.w / (sportRecord.w + sportRecord.l) * 100).toFixed(1)}% ATS` : ""}
          accent={sportAccent}
        />
        <StatCard
          label={`${sport} P&L`}
          value={sportRecord ? `${sportRecord.pnl >= 0 ? "+" : ""}${fmt$(sportRecord.pnl)}` : "—"}
          accent={sportAccent}
          valueColor={(sportRecord?.pnl ?? 0) >= 0 ? sportAccent : "#dc2626"}
        />
        <StatCard
          label="Total Settled"
          value={summary ? `${summary.wins}-${summary.losses}` : "—"}
          sub={`${summary?.win_pct?.toFixed(1) ?? "—"}% overall`}
          accent={sportAccent}
          valueColor={summary && summary.win_pct >= 53 ? sportAccent : "#dc2626"}
        />
      </div>

      {/* ── Recal Alert ── */}
      {showRecal && (
        <div style={{ padding: "0 1.5rem" }}>
          <div style={S.alert("#92400e", "#fef3c7", "#fbbf24")}>
            Recalibration Alert — Last {last50.length} bets: {last50Pct?.toFixed(1)}% win rate · below 55% floor · reduce unit size
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={S.tabs}>
        {tabs.map(t => (
          <button key={t.key} style={S.tab(tab === t.key, sport)} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={S.content}>
        {tab === "picks" && (sport === "MLB" ? <MLBPicksTab trades={trades} /> : <NCAABPicksTab />)}
        {tab === "journal" && <JournalTab trades={sportTrades} sport={sport} />}
        {tab === "performance" && <PerformanceTab trades={trades} summary={summary} />}
        {tab === "rules" && <RulesTab />}
        {tab === "ev" && <EVTab balance={summary?.balance ?? 1000} sport={sport} />}
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.65rem", color: "#cccccc" }}>
        BBMI Betting Console · Admin Only · Not for distribution
      </div>
    </div>
  );
}
