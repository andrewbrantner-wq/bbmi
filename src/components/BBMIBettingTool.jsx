import { useState, useMemo, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebase-config";
import games from "@/data/betting-lines/games.json";
import injuryData from "@/data/betting-lines/injuries.json";

// ─────────────────────────────────────────────────────────────────────────────
// STRATEGY CONFIG — sourced from BBMI Betting Strategy & Rules Playbook
// Win rates from bbmi_backtest.csv — last updated 2026-03-07 (5,343 games)
// Recalibrate unit $ monthly. Tiers updated after each major backtest run.
// ─────────────────────────────────────────────────────────────────────────────
const CFG = {
  minEdge: 5,
  kelly: 0.25,                    // fractional Kelly — always 1/4
  unitPct: 0.015,                 // 1 unit = 1.5% of bankroll (per doc)
  maxSimultaneousExposurePct: 20, // never >20% bankroll in live unresolved bets
  maxBetsPerDay: 5,

  // Stop-loss thresholds (Section 5)
  stopLoss: {
    dailyPct: 5,          // stop if single-day loss > 5% of bankroll
    weeklyPct: 10,        // stop 2 weeks if 7-day loss > 10%
    seasonFloor: 40,      // stop season if bankroll drops to 60% of start (= 40% loss)
    streakDays: 3,        // N consecutive losing days → 24-hr mandatory break
  },

  // Line movement rules (Section 6)
  lineMove: {
    skipPts: 2,           // skip if line moved ≥ 2 pts against BBMI
    reduceTierPts: 1,     // reduce one tier if moved 1–1.9 pts against
  },

  // Juice limits (Section 6)
  juice: {
    avoid: -120,          // avoid if worse than -120 (unless edge ≥ 6)
    never: -130,          // never bet at -130 or worse
  },

  // Recalibration (Section 12 / actuary's rule)
  recal: {
    minSample: 20,
    winPctFloor: 55,      // last-N bets < 55% → alert
    reducedUnits: 0.5,    // flat units during recal mode
  },

  // Sizing tiers (Section 4) — units per edge bucket
  // Note: doc uses 5–5.9=1u, 6–7.9=1.5u, 8–9.9=2u, ≥10=2.5u
  // Backtest win rates inserted from 2026-03-07 CSV
  tiers: [
    { label: "Edge 5–6",  min: 5,  max: 6,   units: 1.0, winPct: 0.638, color: "#3b82f6" },
    { label: "Edge 6–8",  min: 6,  max: 8,   units: 1.5, winPct: 0.645, color: "#8b5cf6" },
    { label: "Edge 8–10", min: 8,  max: 10,  units: 2.0, winPct: 0.662, color: "#f59e0b" },
    { label: "Edge ≥ 10", min: 10, max: 999, units: 2.5, winPct: 0.748, color: "#ef4444" },
  ],
};

const FIRESTORE_COLLECTION = "bettingJournal";
const FIRESTORE_DOC = "journal";

const DEFAULT = {
  startingBankroll: 2000,
  currentBankroll: 2000,
  peakBankroll: 2000,
  seasonStopped: false,
  cooldownUntil: null,
  weeklyStopUntil: null,
  recalMode: false,
  bets: [],
  // bet: { id, date, away, home, pick, edge, tierLabel, amount, bbmiLine, lineGot, juice, slippage, result, pnl, notes }
};

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toLocaleDateString("en-CA");
const fmt$ = n => `$${Math.round(Math.abs(n)).toLocaleString()}`;
const fmtPct = n => `${(n * 100).toFixed(1)}%`;
const signed$ = n => `${n >= 0 ? "+" : "−"}${fmt$(n)}`;
const signedPct = n => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function getTier(edge) {
  return CFG.tiers.find(t => edge >= t.min && edge < t.max) ?? null;
}

function unitDollar(bankroll) {
  return bankroll * CFG.unitPct;
}

function calcBetSize(tier, bankroll, recalMode) {
  const u = unitDollar(bankroll);
  if (recalMode) return u * CFG.recal.reducedUnits;
  return u * tier.units;
}

function calcEV(betAmt, winPct, juice = -110) {
  const odds = 100 / Math.abs(juice);
  return betAmt * odds * winPct - betAmt * (1 - winPct);
}

function wilsonLow(wins, n, z = 1.645) {
  if (n === 0) return 0;
  const p = wins / n;
  const d = 1 + z * z / n;
  const c = p + z * z / (2 * n);
  const m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return (c - m) / d;
}

function getInjury(team, src) {
  const players = (src[team] ?? [])
    .filter(p => p.status === "out" || p.status === "doubtful")
    .sort((a, b) => (b.avg_minutes ?? 0) - (a.avg_minutes ?? 0));
  const minsLost = players.reduce((s, p) => s + (p.avg_minutes ?? 0), 0);
  return { players, minsLost, pct: minsLost / 200 };
}

function injColor(pct) {
  if (pct < 0.05) return null;
  if (pct < 0.10) return "#eab308";
  if (pct < 0.15) return "#f97316";
  return "#ef4444";
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function BBMIBettingConsole() {
  const [j, setJ] = useState(null); // journal
  const [tab, setTab] = useState("picks");
  const [logModal, setLogModal] = useState(null);      // "place bet" modal
  const [settleModal, setSettleModal] = useState(null); // "settle result" modal
  const [logState, setLogState] = useState({ amount: "", lineGot: "", juice: "-110", notes: "" });
  const [settleResult, setSettleResult] = useState("win");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newBR, setNewBR] = useState("");
  const [newUnit, setNewUnit] = useState(""); // override unit $
  const [unitOverride, setUnitOverride] = useState(null); // null = use bankroll %

  // ── Persistent storage ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setJ(DEFAULT); return; }
        const ref = doc(db, FIRESTORE_COLLECTION, user.uid, "data", FIRESTORE_DOC);
        const snap = await getDoc(ref);
        setJ(snap.exists() ? snap.data().journal : DEFAULT);
      } catch { setJ(DEFAULT); }
    })();
  }, []);

  const save = useCallback(async (next) => {
    setJ(next);
    try {
      const user = auth.currentUser;
      if (!user) return;
      const ref = doc(db, FIRESTORE_COLLECTION, user.uid, "data", FIRESTORE_DOC);
      await setDoc(ref, { journal: next });
    } catch (e) { console.error("Firestore save error:", e); }
  }, []);

  // ── Derived metrics ───────────────────────────────────────────────────────
  const m = useMemo(() => {
    if (!j) return null;
    const today = todayISO();
    const settled = j.bets.filter(b => b.result !== null);
    const todayBets = j.bets.filter(b => b.date === today); // includes pending
    const todayW = todayBets.filter(b => b.result === "win").length;
    const todayL = todayBets.filter(b => b.result === "loss").length;

    // 7-day P&L
    const cut7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const wkPnl = settled.filter(b => b.date >= cut7).reduce((s, b) => s + (b.pnl ?? 0), 0);
    const wkDrawPct = wkPnl < 0 ? (Math.abs(wkPnl) / j.peakBankroll) * 100 : 0;

    // Season drawdown from peak
    const seaDraw = j.peakBankroll > 0
      ? Math.max(0, (j.peakBankroll - j.currentBankroll) / j.startingBankroll * 100)
      : 0;

    // Consecutive losing days
    const allDates = [...new Set(settled.map(b => b.date))].sort().reverse();
    let lossDayStreak = 0;
    for (const d of allDates) {
      const db = settled.filter(b => b.date === d);
      if (db.length === 0) continue;
      if (db.filter(b => b.result === "loss").length > db.filter(b => b.result === "win").length) lossDayStreak++;
      else break;
    }

    // Recent 50 win rate
    const recent = settled.slice(-50);
    const recentW = recent.filter(b => b.result === "win").length;
    const recentPct = recent.length >= CFG.recal.minSample ? recentW / recent.length * 100 : null;
    const wilsonCI = recent.length >= CFG.recal.minSample
      ? wilsonLow(recentW, recent.length) * 100 : null;

    // Overall
    const allW = settled.filter(b => b.result === "win").length;
    const totalWagered = settled.reduce((s, b) => s + b.amount, 0);
    const totalPnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
    const roi = totalWagered > 0 ? totalPnl / totalWagered * 100 : 0;
    const avgSlip = settled.filter(b => b.slippage != null).length > 0
      ? settled.filter(b => b.slippage != null).reduce((s, b) => s + (b.slippage ?? 0), 0) /
        settled.filter(b => b.slippage != null).length : null;

    // Stop conditions
    const dailyLossDollars = todayBets.filter(b => b.result === "loss").reduce((s, b) => s + b.amount, 0);
    const dailyLossPct = (dailyLossDollars / j.currentBankroll) * 100;
    const stopDaily = dailyLossPct >= CFG.stopLoss.dailyPct || todayBets.length >= CFG.maxBetsPerDay;
    const stopWeekly = j.weeklyStopUntil && new Date(j.weeklyStopUntil) > new Date();
    const stopWeeklyTriggered = wkDrawPct >= CFG.stopLoss.weeklyPct;
    const stopSeason = seaDraw >= CFG.stopLoss.seasonFloor || j.seasonStopped;
    const cooldownActive = j.cooldownUntil && new Date(j.cooldownUntil) > new Date();
    const cooldownHrs = cooldownActive
      ? Math.ceil((new Date(j.cooldownUntil) - new Date()) / 3600000) : 0;
    const anyStopped = stopDaily || stopWeekly || stopSeason || cooldownActive;
    const needsRecal = recentPct !== null && recentPct < CFG.recal.winPctFloor;
    const effectiveUnit = unitOverride ?? unitDollar(j.currentBankroll);

    return {
      today, todayW, todayL, todayCount: todayBets.length,
      dailyLossPct, wkDrawPct, seaDraw,
      lossDayStreak, recentPct, wilsonCI, recentN: recent.length,
      allW, allN: settled.length, totalWagered, totalPnl, roi, avgSlip,
      stopDaily, stopWeekly, stopWeeklyTriggered, stopSeason,
      cooldownActive, cooldownHrs, anyStopped, needsRecal, effectiveUnit,
    };
  }, [j, unitOverride]);

  // ── Today's games ─────────────────────────────────────────────────────────
  const todayGames = useMemo(() => {
    if (!j || !m) return [];
    const today = todayISO();
    return games
      .filter(g => {
        const d = g.date ? String(g.date).split("T")[0] : "";
        return d === today && g.actualHomeScore === null;
      })
      .map(g => {
        const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
        const pickIsHome = (g.bbmiHomeLine ?? 0) < (g.vegasHomeLine ?? 0);
        const pick = pickIsHome ? String(g.home) : String(g.away);
        const tier = getTier(edge);
        const betAmt = tier ? calcBetSize(tier, j.currentBankroll, j.recalMode) : 0;
        const ev = tier ? calcEV(betAmt, tier.winPct) : 0;
        const awayInj = getInjury(String(g.away), injuryData);
        const homeInj = getInjury(String(g.home), injuryData);
        const pickInj = pickIsHome ? homeInj : awayInj;
        const oppInj  = pickIsHome ? awayInj : homeInj;
        const existingBets = (m?.today ? j.bets.filter(b => b.date === m.today && b.away === String(g.away) && b.home === String(g.home)) : []);
        const lastLog = existingBets[existingBets.length - 1] ?? null;
        const isPending = lastLog && lastLog.result === null;
        const isSettled = lastLog && lastLog.result !== null;
        return {
          ...g,
          away: String(g.away), home: String(g.home),
          edge, pick, pickIsHome, tier, betAmt, ev,
          awayInj, homeInj, pickInj, oppInj,
          logged: existingBets.length > 0, lastLog, isPending, isSettled,
        };
      })
      .sort((a, b) => b.edge - a.edge);
  }, [j, m]);

  const bettable = todayGames.filter(g => g.edge >= CFG.minEdge);
  const totalEV = bettable.reduce((s, g) => s + g.ev, 0);

  // ── Log a bet ─────────────────────────────────────────────────────────────
  // Place a bet (pending — no result yet)
  const logBet = useCallback(async (game) => {
    const { amount, lineGot, juice, notes } = logState;
    const betAmt = parseFloat(amount) || game.betAmt;
    const juiceNum = parseFloat(juice) || -110;
    const odds = 100 / Math.abs(juiceNum);
    const payout = betAmt * odds;
    const slippage = lineGot !== "" ? parseFloat(lineGot) - (game.vegasHomeLine ?? 0) : null;

    // Remove any existing pending entry for this game today
    const filtered = j.bets.filter(b => !(b.away === game.away && b.home === game.home && b.date === m.today));

    const bet = {
      id: Date.now(),
      date: m.today,
      away: game.away, home: game.home, pick: game.pick,
      edge: game.edge, tierLabel: game.tier?.label ?? "Unknown",
      amount: betAmt, payout, pnl: null,
      bbmiLine: game.vegasHomeLine,
      lineGot: lineGot !== "" ? parseFloat(lineGot) : null,
      slippage,
      juice: juiceNum,
      result: null,  // null = pending until settled
      notes,
    };

    await save({ ...j, bets: [...filtered, bet] });
    setLogModal(null);
    setLogState({ amount: "", lineGot: "", juice: "-110", notes: "" });
  }, [j, m, logState, save]);

  // Settle a bet result after the game ends
  const settleBet = useCallback(async (betId, result) => {
    const bet = j.bets.find(b => b.id === betId);
    if (!bet) return;

    const pnl = result === "win" ? bet.payout : result === "loss" ? -bet.amount : 0;
    const newBets = j.bets.map(b => b.id === betId ? { ...b, result, pnl } : b);
    const newBankroll = j.currentBankroll + pnl;
    const newPeak = Math.max(j.peakBankroll, newBankroll);
    const newJ = { ...j, bets: newBets, currentBankroll: newBankroll, peakBankroll: newPeak };

    // Check streak -> cooldown
    const settled = newBets.filter(b => b.result !== null);
    const sd = [...new Set(settled.map(b => b.date))].sort().reverse();
    let streak = 0;
    for (const d of sd) {
      const db = settled.filter(b => b.date === d);
      if (!db.length) continue;
      if (db.filter(b => b.result === "loss").length > db.filter(b => b.result === "win").length) streak++;
      else break;
    }
    if (streak >= CFG.stopLoss.streakDays && !newJ.cooldownUntil) {
      newJ.cooldownUntil = new Date(Date.now() + 24 * 3600000).toISOString();
    }
    // Check weekly stop
    const cut7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const wkLoss = newBets.filter(b => b.date >= cut7 && b.result === "loss").reduce((s, b) => s + b.amount, 0);
    const wkPct = (wkLoss / newBankroll) * 100;
    if (wkPct >= CFG.stopLoss.weeklyPct && !newJ.weeklyStopUntil) {
      const nextMon = new Date();
      nextMon.setDate(nextMon.getDate() + (8 - nextMon.getDay()) % 7 + 7);
      newJ.weeklyStopUntil = nextMon.toISOString();
    }

    await save(newJ);
    setSettleModal(null);
  }, [j, save]);

  // ─── CSS ─────────────────────────────────────────────────────────────────
  const C = {
    page: { backgroundColor: "#060e1a", minHeight: "100vh", color: "#dde3ed", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", padding: "18px 14px" },
    card: { backgroundColor: "#0b1929", border: "1px solid #152640", borderRadius: 8, padding: "14px 16px" },
    input: { background: "#060e1a", border: "1px solid #152640", borderRadius: 5, color: "#dde3ed", padding: "8px 11px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", outline: "none", width: "100%", boxSizing: "border-box" },
    label: { fontSize: 9, fontWeight: 700, color: "#2d4a6e", textTransform: "uppercase", letterSpacing: "0.12em", display: "block", marginBottom: 4 },
    tab: (a) => ({
      background: a ? "#facc15" : "transparent",
      color: a ? "#060e1a" : "#2d4a6e",
      border: `1px solid ${a ? "#facc15" : "#152640"}`,
      borderRadius: 5, padding: "6px 14px", fontSize: 10, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer",
    }),
    btn: (a, clr = "#facc15") => ({
      background: a ? clr : "transparent",
      color: a ? "#060e1a" : "#2d4a6e",
      border: `1px solid ${a ? clr : "#152640"}`,
      borderRadius: 5, padding: "7px 14px", fontSize: 10, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: "0.08em", cursor: "pointer", whiteSpace: "nowrap",
    }),
  };

  if (!j || !m) {
    return <div style={{ ...C.page, display: "flex", alignItems: "center", justifyContent: "center", color: "#2d4a6e" }}>Loading…</div>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STOP BANNER
  // ─────────────────────────────────────────────────────────────────────────
  const StopBanner = ({ icon, title, detail, onOverride, overrideLbl }) => (
    <div style={{ background: "#1a0608", border: "2px solid #ef4444", borderRadius: 10, padding: "20px 22px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, marginBottom: 5 }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#ef4444", letterSpacing: "-0.02em", marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#7f1d1d", lineHeight: 1.7 }}>{detail}</div>
      </div>
      {onOverride && <button onClick={onOverride} style={{ ...C.btn(false), color: "#ef444488", borderColor: "#ef444433", fontSize: 10, flexShrink: 0 }}>{overrideLbl}</button>}
    </div>
  );

  return (
    <div style={C.page}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#facc15", letterSpacing: "-0.04em" }}>BBMI</span>
              <span style={{ fontSize: 11, color: "#2d4a6e", letterSpacing: "0.2em", textTransform: "uppercase" }}>Betting Console</span>
              <span style={{ fontSize: 9, background: "#152640", color: "#2d4a6e", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.1em" }}>ADMIN</span>
            </div>
            <div style={{ fontSize: 10, color: "#1a3050", marginTop: 2 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              {j.recalMode && <span style={{ color: "#f59e0b", marginLeft: 10 }}>● RECALIBRATION MODE ACTIVE</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {j.recalMode && <button onClick={() => save({ ...j, recalMode: false })} style={C.btn(true, "#f59e0b")}>Exit Recal</button>}
            <button onClick={() => setSettingsOpen(true)} style={C.btn(false)}>⚙ Settings</button>
          </div>
        </div>

        {/* ── TOP METRICS STRIP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 10 }}>
          {[
            { l: "Bankroll", v: fmt$(j.currentBankroll), c: j.currentBankroll >= j.startingBankroll ? "#4ade80" : "#f87171" },
            { l: "Peak", v: fmt$(j.peakBankroll), c: "#475569" },
            { l: "Season P&L", v: signed$(j.currentBankroll - j.startingBankroll), c: j.currentBankroll >= j.startingBankroll ? "#4ade80" : "#f87171" },
            { l: "7-Day Drawdown", v: signedPct(-m.wkDrawPct), c: m.wkDrawPct >= CFG.stopLoss.weeklyPct ? "#ef4444" : m.wkDrawPct >= 5 ? "#f97316" : "#475569" },
            { l: "Season Drawdown", v: signedPct(-m.seaDraw), c: m.seaDraw >= CFG.stopLoss.seasonFloor ? "#ef4444" : m.seaDraw >= 20 ? "#f97316" : "#475569" },
          ].map(s => (
            <div key={s.l} style={{ ...C.card, textAlign: "center", padding: "9px 8px" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: s.c, letterSpacing: "-0.02em" }}>{s.v}</div>
              <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── TODAY STRIP ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { l: "Today W–L", v: `${m.todayW}–${m.todayL}`, c: m.todayW > m.todayL ? "#4ade80" : m.todayL > m.todayW ? "#f87171" : "#475569" },
            { l: `Bets (max ${CFG.maxBetsPerDay})`, v: `${m.todayCount} / ${CFG.maxBetsPerDay}`, c: m.todayCount >= CFG.maxBetsPerDay ? "#ef4444" : "#facc15" },
            { l: "Loss Streak Days", v: `${m.lossDayStreak}`, c: m.lossDayStreak >= CFG.stopLoss.streakDays ? "#ef4444" : m.lossDayStreak >= 2 ? "#f97316" : "#475569" },
            { l: "Today EV", v: signed$(totalEV), c: totalEV >= 0 ? "#4ade80" : "#f87171" },
          ].map(s => (
            <div key={s.l} style={{ ...C.card, textAlign: "center", padding: "9px 8px" }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: s.c, letterSpacing: "-0.02em" }}>{s.v}</div>
              <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── RECAL ALERT ── */}
        {m.needsRecal && (
          <div style={{ background: "#1a1200", border: "2px solid #f59e0b", borderRadius: 10, padding: "14px 18px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", marginBottom: 3 }}>⚠️ Recalibration Alert</div>
              <div style={{ fontSize: 11, color: "#78350f", lineHeight: 1.7 }}>
                Last {m.recentN} bets: <strong style={{ color: "#fbbf24" }}>{m.recentPct?.toFixed(1)}%</strong> win rate
                {m.wilsonCI && <span> · Wilson 90% CI lower bound: <strong style={{ color: "#fbbf24" }}>{m.wilsonCI.toFixed(1)}%</strong></span>}
                {" "}— below {CFG.recal.winPctFloor}% floor. Drop to {CFG.recal.reducedUnits}u flat until 20+ more bets settle.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setTab("recal"); }} style={C.btn(false, "#f59e0b")}>Review</button>
              <button onClick={() => save({ ...j, recalMode: true })} style={C.btn(true, "#f59e0b")}>Enter Recal Mode</button>
            </div>
          </div>
        )}

        {/* ── STOP BANNERS ── */}
        {m.stopSeason && (
          <StopBanner
            icon="🛑" title="SEASON STOP — Bankroll down ≥40% from start"
            detail={`Current: ${fmt$(j.currentBankroll)} / Start: ${fmt$(j.startingBankroll)} / Peak: ${fmt$(j.peakBankroll)}. Per strategy rules, no more bets this season. Review model performance before next season.`}
            onOverride={() => save({ ...j, seasonStopped: false })} overrideLbl="Manual Override"
          />
        )}
        {m.cooldownActive && !m.stopSeason && (
          <StopBanner
            icon="⏸" title={`COOLDOWN — ${m.cooldownHrs}h remaining`}
            detail={`${CFG.stopLoss.streakDays} consecutive losing days triggered mandatory 24-hour break. No bets until ${new Date(j.cooldownUntil).toLocaleString()}. Use this time to review recent losses.`}
            onOverride={() => save({ ...j, cooldownUntil: null })} overrideLbl="Clear Cooldown"
          />
        )}
        {m.stopWeekly && !m.stopSeason && !m.cooldownActive && (
          <StopBanner
            icon="⏹" title="WEEKLY STOP — 7-day loss ≥10% of bankroll"
            detail={`7-day drawdown: ${m.wkDrawPct.toFixed(1)}%. Per strategy rules, no betting for rest of this week + next week (until ${j.weeklyStopUntil ? new Date(j.weeklyStopUntil).toLocaleDateString() : "next Monday+7"}). Review execution: are you getting the lines BBMI captures?`}
            onOverride={() => save({ ...j, weeklyStopUntil: null })} overrideLbl="Clear Stop"
          />
        )}
        {m.stopDaily && !m.stopSeason && !m.cooldownActive && !m.stopWeekly && (
          <div style={{ background: "#1a0c00", border: "1px solid #f97316", borderRadius: 9, padding: "11px 16px", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#f97316" }}>
              {m.todayCount >= CFG.maxBetsPerDay
                ? `✋ Daily max ${CFG.maxBetsPerDay} bets reached — done for today.`
                : `✋ Daily loss limit (${CFG.stopLoss.dailyPct}%) reached — ${m.dailyLossPct.toFixed(1)}% lost today. Done for today.`}
            </span>
            <span style={{ fontSize: 10, color: "#7c3a00", marginLeft: 8 }}>Resets at midnight.</span>
          </div>
        )}

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            ["picks", "📋 Today's Picks"],
            ["journal", "📓 Bet Journal"],
            ["performance", "📊 Performance"],
            ["rules", "📐 Rules"],
            ["recal", "🔧 Recalibrate"],
            ["ev", "📈 EV Tables"],
          ].map(([id, lbl]) => (
            <button key={id} onClick={() => setTab(id)} style={C.tab(tab === id)}>{lbl}</button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PICKS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "picks" && (
          <div>
            {bettable.length === 0 && (
              <div style={{ ...C.card, textAlign: "center", padding: 48, color: "#1a3050" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>No qualifying games today</div>
                <div style={{ fontSize: 11, marginTop: 5 }}>Games with edge ≥ {CFG.minEdge} pts appear here after 10am CT</div>
              </div>
            )}

            {bettable.map((g, i) => {
              const tc = g.tier?.color ?? "#334155";
              const pickInjC = injColor(g.pickInj.pct);
              const oppInjC = injColor(g.oppInj.pct);
              const disabled = m.anyStopped;

              return (
                <div key={i} style={{ ...C.card, marginBottom: 10, borderLeft: `4px solid ${tc}`, opacity: disabled ? 0.35 : 1 }}>
                  {/* Row 1: matchup + bet box */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {/* Left: matchup info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                        <span style={{ background: tc + "22", color: tc, border: `1px solid ${tc}55`, borderRadius: 4, padding: "2px 9px", fontSize: 13, fontWeight: 900 }}>
                          {g.edge.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 9, color: "#2d4a6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{g.tier?.label}</span>
                        {g.isPending && <span style={{ fontSize: 8, background: "#1a1200", color: "#f59e0b", border: "1px solid #f59e0b44", borderRadius: 3, padding: "1px 6px", fontWeight: 700 }}>● PENDING</span>}
                        {g.isSettled && <span style={{ fontSize: 8, background: "#0a2a1a", color: "#4ade80", border: "1px solid #4ade8044", borderRadius: 3, padding: "1px 6px", fontWeight: 700 }}>✓ SETTLED</span>}
                      </div>

                      <div style={{ fontSize: 16, fontWeight: 700, color: "#e8edf5", marginBottom: 6 }}>
                        {g.away} <span style={{ color: "#1a3050" }}>@</span> {g.home}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0 16px", fontSize: 11, color: "#2d4a6e" }}>
                        <span>Vegas: <span style={{ color: "#dde3ed", fontFamily: "monospace" }}>{(g.vegasHomeLine ?? 0) > 0 ? "+" : ""}{g.vegasHomeLine ?? "—"}</span></span>
                        <span>BBMI: <span style={{ color: "#facc15", fontFamily: "monospace" }}>{(g.bbmiHomeLine ?? 0) > 0 ? "+" : ""}{g.bbmiHomeLine ?? "—"}</span></span>
                        <span>Win%: <span style={{ color: "#60a5fa", fontFamily: "monospace" }}>{((g.bbmiWinProb ?? 0.5) * 100).toFixed(1)}%</span></span>
                        <span>EV: <span style={{ color: g.ev >= 0 ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>{signed$(g.ev)}</span></span>
                      </div>
                    </div>

                    {/* Right: bet box */}
                    <div style={{ background: "#060e1a", border: `1px solid ${tc}44`, borderRadius: 8, padding: "10px 14px", textAlign: "center", minWidth: 120 }}>
                      <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>BET ON</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: tc, marginBottom: 2 }}>{g.pick}</div>
                      <div style={{ fontSize: 9, color: "#1a3050", marginBottom: 6 }}>{g.pickIsHome ? "Home" : "Away"} · {j.recalMode ? "0.5u" : `${g.tier?.units}u`}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#facc15", letterSpacing: "-0.03em" }}>{fmt$(g.betAmt)}</div>
                      {pickInjC && <div style={{ marginTop: 5, fontSize: 8, fontWeight: 800, color: pickInjC, background: pickInjC + "22", borderRadius: 3, padding: "2px 5px" }}>⚠️ PICK INJURED</div>}
                      {oppInjC && <div style={{ marginTop: 3, fontSize: 8, fontWeight: 800, color: "#4ade80", background: "#4ade8011", borderRadius: 3, padding: "2px 5px" }}>✓ OPP INJURED</div>}
                    </div>

                    {/* Log button */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button
                        disabled={disabled && !g.isPending}
                        onClick={() => {
                          setLogModal(g);
                          setLogState({ amount: String(Math.round(g.betAmt)), lineGot: "", juice: "-110", notes: "" });
                        }}
                        style={{ ...C.btn(!disabled || g.isPending, "#facc15"), opacity: (disabled && !g.isPending) ? 0.3 : 1 }}
                      >
                        {g.isPending || g.isSettled ? "Edit Bet" : "Place Bet"}
                      </button>
                      {g.isPending && (
                        <button
                          onClick={() => { setSettleModal(g.lastLog); setSettleResult("win"); }}
                          style={C.btn(true, "#4ade80")}
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Injury panels */}
                  {(g.awayInj.players.length > 0 || g.homeInj.players.length > 0) && (
                    <div style={{ display: "grid", gridTemplateColumns: g.awayInj.players.length > 0 && g.homeInj.players.length > 0 ? "1fr 1fr" : "1fr", gap: 8, marginTop: 10 }}>
                      {[{ inj: g.awayInj, name: g.away, side: "Away" }, { inj: g.homeInj, name: g.home, side: "Home" }]
                        .filter(x => x.inj.players.length > 0)
                        .map(({ inj, name, side }) => {
                          const ic = injColor(inj.pct);
                          return (
                            <div key={side} style={{ background: ic ? ic + "0a" : "#0b192988", border: `1px solid ${ic ? ic + "44" : "#152640"}`, borderRadius: 6, padding: "7px 10px" }}>
                              <div style={{ fontSize: 8, fontWeight: 800, color: ic ?? "#1a3050", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                                🤕 {name} ({side}){ic ? ` — ${(inj.pct * 100).toFixed(0)}% min lost` : ""}
                              </div>
                              {inj.players.map((p, j2) => (
                                <div key={j2} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2d4a6e", lineHeight: 1.9 }}>
                                  <span>
                                    <span style={{ color: p.status === "out" ? "#ef4444" : "#f97316", fontWeight: 800, fontSize: 8, marginRight: 5 }}>{p.status.toUpperCase()}</span>
                                    {p.player}{p.note && p.note !== "Undisclosed" ? <span style={{ color: "#1a3050", marginLeft: 4 }}>· {p.note}</span> : ""}
                                  </span>
                                  <span style={{ color: "#2d4a6e", fontSize: 9 }}>{p.avg_minutes != null ? `${p.avg_minutes}m` : "?"}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Pre-bet checklist (inline) */}
                  <div style={{ marginTop: 10, background: "#060e1a", borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Pre-Bet Checklist</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px 14px" }}>
                      {[
                        { ok: true,  text: `Edge ≥ ${CFG.minEdge} pts ✓  (${g.edge.toFixed(1)})` },
                        { ok: null,  text: "Verify live line at book (line movement check)" },
                        { ok: !pickInjC, text: pickInjC ? "⚠️ Pick-side injury — consider reducing tier" : "Pick-side injury check — clear" },
                        { ok: m.todayCount < CFG.maxBetsPerDay, text: "Within daily bet limit" },
                        { ok: null,  text: "Daily 5% loss limit not hit (auto-checked above)" },
                        { ok: null,  text: "Weekly 10% drawdown limit not hit" },
                        { ok: null,  text: "Not chasing yesterday's losses (emotional check)" },
                        { ok: null,  text: "Record BBMI line vs. line actually received (slippage)" },
                        { ok: null,  text: "Check juice — -120 or worse: reduce or skip" },
                      ].map((item, k) => (
                        <div key={k} style={{ fontSize: 9.5, color: item.ok === false ? "#f87171" : item.ok === true ? "#4ade80" : "#2d4a6e", lineHeight: 1.9, display: "flex", gap: 5 }}>
                          <span style={{ flexShrink: 0 }}>{item.ok === true ? "✓" : item.ok === false ? "✗" : "›"}</span>
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Below-threshold */}
            {todayGames.filter(g => g.edge > 0 && g.edge < CFG.minEdge).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#152640", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Below threshold (edge &lt; {CFG.minEdge} pts) — skip</div>
                {todayGames.filter(g => g.edge > 0 && g.edge < CFG.minEdge).map((g, i) => (
                  <div key={i} style={{ ...C.card, opacity: 0.25, display: "flex", justifyContent: "space-between", padding: "7px 12px", marginBottom: 4 }}>
                    <span style={{ fontSize: 11 }}>{g.away} @ {g.home}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{g.edge.toFixed(1)} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            JOURNAL TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "journal" && (
          <div style={C.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#facc15" }}>Bet Journal — {j.bets.length} total bets</span>
              {m.avgSlip !== null && (
                <span style={{ fontSize: 10, color: m.avgSlip <= -0.5 ? "#f97316" : "#475569" }}>
                  Avg line slippage: {m.avgSlip >= 0 ? "+" : ""}{m.avgSlip.toFixed(2)} pts {m.avgSlip <= -1 ? "⚠️ hurting edge" : ""}
                </span>
              )}
            </div>
            {j.bets.length === 0 && <div style={{ textAlign: "center", color: "#1a3050", padding: 28, fontSize: 12 }}>No bets logged yet.</div>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    {["Date", "Matchup", "Pick", "Tier", "Amount", "BBMI Line", "Got", "Slip", "Juice", "Result", "P&L", "Notes", ""].map(h => (
                      <th key={h} style={{ fontSize: 8, fontWeight: 700, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 8px", textAlign: "right", borderBottom: "1px solid #152640", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...j.bets].reverse().map((b, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #0a1525" }}>
                      <td style={{ padding: "6px 8px", color: "#2d4a6e", textAlign: "right", whiteSpace: "nowrap" }}>{b.date}</td>
                      <td style={{ padding: "6px 8px", color: "#64748b", textAlign: "right", whiteSpace: "nowrap" }}>{b.away} @ {b.home}</td>
                      <td style={{ padding: "6px 8px", color: "#dde3ed", fontWeight: 700, textAlign: "right" }}>{b.pick}</td>
                      <td style={{ padding: "6px 8px", color: "#475569", textAlign: "right" }}>{b.tierLabel}</td>
                      <td style={{ padding: "6px 8px", color: "#facc15", fontFamily: "monospace", textAlign: "right" }}>{fmt$(b.amount)}</td>
                      <td style={{ padding: "6px 8px", color: "#475569", fontFamily: "monospace", textAlign: "right" }}>{b.bbmiLine ?? "—"}</td>
                      <td style={{ padding: "6px 8px", color: "#475569", fontFamily: "monospace", textAlign: "right" }}>{b.lineGot ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", textAlign: "right", color: (b.slippage ?? 0) < -0.5 ? "#f97316" : "#2d4a6e" }}>{b.slippage != null ? `${b.slippage >= 0 ? "+" : ""}${b.slippage.toFixed(1)}` : "—"}</td>
                      <td style={{ padding: "6px 8px", color: "#2d4a6e", fontFamily: "monospace", textAlign: "right" }}>{b.juice ?? "—"}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 800, textAlign: "right", color: b.result === "win" ? "#4ade80" : b.result === "loss" ? "#f87171" : b.result === null ? "#f59e0b" : "#94a3b8" }}>
                        {b.result === null ? "PENDING" : b.result.toUpperCase()}
                      </td>
                      <td style={{ padding: "6px 8px", fontFamily: "monospace", fontWeight: 700, textAlign: "right", color: b.result === null ? "#f59e0b" : (b.pnl ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
                        {b.result === null ? `at risk: ${fmt$(b.amount)}` : signed$(b.pnl ?? 0)}
                      </td>
                      <td style={{ padding: "6px 8px", color: "#2d4a6e", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.notes}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>
                        {b.result === null && (
                          <button onClick={() => { setSettleModal(b); setSettleResult("win"); }}
                            style={{ ...C.btn(true, "#4ade80"), fontSize: 9, padding: "3px 8px" }}>
                            Settle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PERFORMANCE TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "performance" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Overall */}
            <div style={{ ...C.card, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 12 }}>Overall Record</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {[
                  { l: "Record", v: `${m.allW}–${m.allN - m.allW}` },
                  { l: "Win %", v: m.allN ? fmtPct(m.allW / m.allN) : "—", c: m.allN && m.allW / m.allN > 0.55 ? "#4ade80" : "#f87171" },
                  { l: "Total Wagered", v: fmt$(m.totalWagered) },
                  { l: "Net P&L", v: signed$(m.totalPnl), c: m.totalPnl >= 0 ? "#4ade80" : "#f87171" },
                  { l: "ROI", v: signedPct(m.roi), c: m.roi >= 0 ? "#4ade80" : "#f87171" },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: s.c ?? "#dde3ed" }}>{s.v}</div>
                    <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", marginTop: 3 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* By tier */}
            <div style={{ ...C.card, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 12 }}>By Edge Tier</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tier", "Bets", "W-L", "Win %", "Target", "vs Target", "Wilson Low", "Net P&L"].map(h => (
                      <th key={h} style={{ fontSize: 8, fontWeight: 700, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.07em", padding: "5px 10px", textAlign: "right", borderBottom: "1px solid #152640" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CFG.tiers.map(t => {
                    const tb = j.bets.filter(b => b.tierLabel === t.label && b.result);
                    const w = tb.filter(b => b.result === "win").length;
                    const n = tb.length;
                    const pct = n > 0 ? w / n : null;
                    const vs = pct !== null ? pct - t.winPct : null;
                    const wl = n >= 10 ? wilsonLow(w, n) : null;
                    const pnl = tb.reduce((s, b) => s + (b.pnl ?? 0), 0);
                    return (
                      <tr key={t.label} style={{ borderBottom: "1px solid #0a1525" }}>
                        <td style={{ padding: "8px 10px", color: t.color, fontWeight: 800 }}>{t.label}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#2d4a6e" }}>{n}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#dde3ed" }}>{n > 0 ? `${w}–${n - w}` : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: pct != null ? (pct >= t.winPct ? "#4ade80" : "#f87171") : "#1a3050" }}>
                          {pct != null ? fmtPct(pct) : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: "#2d4a6e" }}>{fmtPct(t.winPct)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: vs != null ? (vs >= 0 ? "#4ade80" : "#f87171") : "#1a3050" }}>
                          {vs != null ? `${vs >= 0 ? "+" : ""}${(vs * 100).toFixed(1)}pp` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", color: wl != null ? (wl > 0.52 ? "#4ade80" : "#f97316") : "#1a3050" }}>
                          {wl != null ? fmtPct(wl) : n >= 10 ? "—" : `<10 bets`}
                        </td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: pnl >= 0 ? "#4ade80" : "#f87171" }}>
                          {n > 0 ? signed$(pnl) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 9, color: "#1a3050" }}>Wilson Low = 90% CI lower bound. If Wilson Low &lt; breakeven (~52%), investigate that tier before sizing further.</div>
            </div>

            {/* Line slippage */}
            {m.avgSlip !== null && (
              <div style={{ ...C.card, gridColumn: "1 / -1", borderTop: `2px solid ${m.avgSlip <= -1 ? "#f97316" : "#152640"}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.avgSlip <= -1 ? "#f97316" : "#facc15", marginBottom: 8 }}>Line Slippage Analysis</div>
                <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: m.avgSlip <= -1 ? "#f97316" : "#4ade80" }}>{m.avgSlip >= 0 ? "+" : ""}{m.avgSlip.toFixed(2)}</div>
                    <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", marginTop: 2 }}>Avg Slippage (pts)</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#2d4a6e", lineHeight: 1.8, flex: 1 }}>
                    {m.avgSlip <= -2
                      ? "⚠️ CRITICAL: Average slippage ≥2 pts means you're systematically missing the edge BBMI captures. Your effective edge floor may be near zero. Review: are you betting closing lines instead of opening lines?"
                      : m.avgSlip <= -1
                      ? "⚠️ Slippage is eroding your edge. Per strategy rules, consider raising your edge floor to ≥7 pts to compensate. Log every line you receive."
                      : "✓ Slippage is within acceptable range. Continue logging lines for trend monitoring."}
                  </div>
                </div>
              </div>
            )}

            {/* Recent health */}
            {m.recentPct !== null && (
              <div style={{ ...C.card, gridColumn: "1 / -1", borderTop: `2px solid ${m.recentPct < CFG.recal.winPctFloor ? "#f59e0b" : "#4ade80"}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.recentPct < CFG.recal.winPctFloor ? "#f59e0b" : "#4ade80", marginBottom: 8 }}>
                  Recent {m.recentN} Bets Health Check
                </div>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 26, fontWeight: 900, color: m.recentPct < CFG.recal.winPctFloor ? "#f59e0b" : "#4ade80" }}>
                      {m.recentPct.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", marginTop: 2 }}>Win Rate</div>
                  </div>
                  {m.wilsonCI && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: m.wilsonCI < 52.4 ? "#ef4444" : "#475569" }}>{m.wilsonCI.toFixed(1)}%</div>
                      <div style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", marginTop: 2 }}>Wilson 90% CI Low</div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#2d4a6e", lineHeight: 1.8, flex: 1 }}>
                    {m.recentPct < CFG.recal.winPctFloor
                      ? `Below ${CFG.recal.winPctFloor}% threshold. Per strategy rules: drop to ${CFG.recal.reducedUnits}u flat sizing, audit last 20 losses for patterns, and confirm you're getting opening lines.`
                      : `Healthy — above ${CFG.recal.winPctFloor}% floor. Continue normal sizing.`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            RULES TAB — full strategy doc embedded
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "rules" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              {
                title: "📐 Strategy Philosophy", color: "#facc15",
                items: [
                  "Only bet when model has ≥5 pts of disagreement with Vegas",
                  "Size bets with 1/4 Kelly — never full Kelly, never flat bets",
                  "Protect bankroll with hard stop-losses — these are not suggestions",
                  "Track every bet: line gotten vs. model line, slippage, juice",
                  "Treat this as a long-run actuarial exercise, not a get-rich scheme",
                  "Model is NOT uniformly good — it is specifically good at high conviction",
                  "Low-edge picks (<5 pts) win at near-coin-flip rates after juice — skip",
                ],
              },
              {
                title: "🛑 Stop-Loss Rules (Section 5)", color: "#ef4444",
                items: [
                  `Daily: stop if single-day loss > ${CFG.stopLoss.dailyPct}% of bankroll`,
                  `Weekly: stop 2 full weeks if 7-day loss > ${CFG.stopLoss.weeklyPct}% of bankroll`,
                  `Season: stop if bankroll drops to 60% of starting value (40% loss)`,
                  `${CFG.stopLoss.streakDays} consecutive losing days → mandatory 24-hour break (auto-enforced)`,
                  `Max ${CFG.maxBetsPerDay} bets per day — hard limit`,
                  "Max 20% of bankroll in live unresolved bets simultaneously",
                  "Stop-loss rules exist so you survive variance and benefit when edge reasserts",
                ],
              },
              {
                title: "✅ Pre-Bet Checklist (Section 8)", color: "#4ade80",
                items: [
                  "Edge ≥ 5.0 pts on bbmihoops.com as of tipoff",
                  "Checked injury flags — model notes significant absences",
                  "Live line has NOT moved ≥ 2 pts against BBMI since pick generation",
                  "Not betting more than 3 games simultaneously (max exposure rule)",
                  "Daily loss is under 5% of current bankroll",
                  "Weekly loss is under 10% of current bankroll",
                  "Not chasing yesterday's losses (emotional state check)",
                  "Recorded BBMI line vs. line received (slippage tracking)",
                  "Confirmed book/exchange and know the juice at time of bet",
                ],
              },
              {
                title: "📏 Line Management (Section 6)", color: "#60a5fa",
                items: [
                  "BBMI captures lines at a specific time — slippage is the #1 risk to live ROI",
                  "If line moved ≥ 2 pts against BBMI: SKIP — edge may be arbitraged away",
                  "If line moved 1–1.9 pts against: reduce one tier (2u → 1.5u)",
                  "If line moved in your favor: bet normally, optionally increase half a tier",
                  "Juice -110 or better: bet normally",
                  "Juice -115: acceptable, reduce size slightly if better line available",
                  "Juice -120 or worse: only bet if edge ≥ 6 pts. Consider skipping.",
                  "NEVER bet at -130 or worse — breakeven (56.5%) too close to edge floor",
                ],
              },
              {
                title: "🩺 Injury Rules (Section 7)", color: "#a78bfa",
                items: [
                  "If a starter for BBMI's pick is doubtful/out within 2 hrs: reduce one tier",
                  "If 2+ starters are questionable/out: skip the bet entirely",
                  "Injury affecting opposing team: bet normally — do not increase size",
                  "Check injury notes field on picks page before betting",
                  "10-min check of beat reporters / X before tipoff on high-edge plays",
                  "Model injury adjustments are estimates — late-breaking news overrides",
                ],
              },
              {
                title: "📐 Sizing Tiers (Section 4)", color: "#f59e0b",
                items: [
                  "< 5 pts: 0 units — no bet",
                  "5–5.9 pts: 1 unit (1.5% of bankroll)",
                  "6–7.9 pts: 1.5 units (2.25% of bankroll)",
                  "8–9.9 pts: 2 units (3.0% of bankroll)",
                  "≥ 10 pts: 2.5 units (3.75% of bankroll) — max bet",
                  "1 unit = 1.5% of current bankroll — recalibrate monthly",
                  "Recalibrate absolute dollar amounts monthly, never daily",
                  "During recal mode: 0.5 flat units until 20 more bets settle",
                ],
              },
              {
                title: "🧠 Psychological Rules (Section 10)", color: "#f472b6",
                items: [
                  "NEVER increase bet size to recover losses faster — #1 cause of ruin",
                  "NEVER deviate from edge floor because you 'have a feeling'",
                  "A losing week ≠ broken model. A losing month might — review carefully.",
                  "Don't monitor games in real time if it affects your discipline",
                  "Keep a separate budget for this — never replenish from other funds",
                  `5-game losing streak probability: ~1.6% — happens multiple times per season`,
                  `8-game losing streak: ~0.1% — rare but will occur over 388+ bets`,
                  "The discipline during losing stretches is what separates profitable bettors",
                ],
              },
              {
                title: "📅 Monthly Protocol (Section 5 / 12)", color: "#34d399",
                items: [
                  "Recalibrate unit $ to current bankroll — do this monthly only",
                  "Calculate win% by tier vs backtest targets",
                  "Review 'vs target' column — flag any tier >5pp below",
                  "Check average slippage — if >1 pt, raise effective edge floor",
                  "Review whether you're getting opening lines or closing lines",
                  "Assess bankroll vs. projections — adjust unit size if materially different",
                  "Review injury flags — were high-impact games appropriately handled?",
                  "After 50+ bets: analyze slippage. Systematically worse lines = real problem.",
                ],
              },
              {
                title: "🔀 Prediction Markets (Section 11)", color: "#38bdf8",
                items: [
                  "Kalshi / Polymarket available since WI has limited online sportsbook access",
                  "Prediction markets often have lower juice — better effective ROI",
                  "Limits typically lower than sportsbooks — harder to scale",
                  "Same edge floor (≥5 pts) and sizing rules apply regardless of platform",
                  "At -105 equivalent: breakeven drops from 52.4% to 51.2% (+1.2% margin)",
                  "At even money: breakeven = 50%, BBMI ≥5 margin = +15.5%",
                  "Any juice reduction below -110 = free ROI improvement",
                ],
              },
              {
                title: "🔧 Recalibration Triggers", color: "#f97316",
                items: [
                  `Last ${CFG.recal.minSample}+ bets win rate < ${CFG.recal.winPctFloor}% → alert fires`,
                  "Sustained negative 'vs target' in any tier over 20+ bets",
                  "Average line slippage > 1 pt → raise edge floor",
                  "Major model weight change → re-run backtest, update tier win rates",
                  "New season → reset bankroll tracking, review and update tier win rates",
                  "If triggered: 0.5u flat sizing until 20 more bets settle and review",
                  "When resolved: exit recal mode, resume normal Kelly sizing",
                ],
              },
            ].map((sec, i) => (
              <div key={i} style={{ ...C.card, borderTop: `3px solid ${sec.color}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: sec.color, marginBottom: 9 }}>{sec.title}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {sec.items.map((item, j2) => (
                    <li key={j2} style={{ fontSize: 10, color: "#2d4a6e", lineHeight: 1.8, display: "flex", gap: 6 }}>
                      <span style={{ color: sec.color, flexShrink: 0 }}>›</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            RECALIBRATE TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "recal" && (
          <div>
            <div style={{ ...C.card, borderTop: "3px solid #f59e0b", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b", marginBottom: 10 }}>🔧 Recalibration Protocol</div>
              <div style={{ fontSize: 11, color: "#2d4a6e", lineHeight: 1.9, marginBottom: 14 }}>
                Triggered when live win rate drifts below {CFG.recal.winPctFloor}% over the last {CFG.recal.minSample}+ settled bets.
                This can mean: (1) normal variance — ride it out at reduced sizing, (2) line degradation — confirm opening lines,
                (3) model drift — update weights from latest backtest, or (4) injury blindspot — audit losses for patterns.
                <strong style={{ color: "#fbbf24" }}> The rule: drop to {CFG.recal.reducedUnits}u flat until 20 more bets settle, then reassess.</strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[
                  { title: "Step 1: Reduce Sizing", body: `Drop to ${CFG.recal.reducedUnits} flat units per bet. Hit "Enter Recal Mode" — tool will auto-size at ${CFG.recal.reducedUnits}u. Do not use Kelly during recal. This limits downside while gathering data.` },
                  { title: "Step 2: Audit Recent Losses", body: "Journal tab → last 20 losses. Look for patterns: specific tier? Home/away bias? Injury blindspots? Conference-level misses? One bad tier contaminates overall numbers." },
                  { title: "Step 3: Check Line Source", body: "Model built on opening lines. If betting closing lines, your real edge is smaller. Average slippage in Performance tab tells the story. Systematically ≥1 pt worse = raise edge floor." },
                  { title: "Step 4: Update Tier Win Rates", body: "Run latest bbmi_backtest.csv through tier calculator. Update CFG.tiers win rates at top of this file. Consider using Wilson CI lower bound, not point estimate, for conservative sizing." },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#060e1a", border: "1px solid #152640", borderRadius: 7, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 10, color: "#2d4a6e", lineHeight: 1.8 }}>{s.body}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => save({ ...j, recalMode: !j.recalMode })}
                  style={C.btn(j.recalMode, "#f59e0b")}>
                  {j.recalMode ? "✓ Recal Mode Active — Click to Exit" : "Enter Recal Mode (0.5u flat)"}
                </button>
              </div>
            </div>

            {/* Current tier targets */}
            <div style={C.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 10 }}>Current Backtest Targets — update after each major backtest run</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {CFG.tiers.map(t => (
                  <div key={t.label} style={{ textAlign: "center", background: "#060e1a", borderRadius: 7, padding: "12px 8px", border: `1px solid ${t.color}33` }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: t.color }}>{(t.winPct * 100).toFixed(1)}%</div>
                    <div style={{ fontSize: 9, color: "#1a3050", textTransform: "uppercase", marginTop: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 8, color: "#152640", marginTop: 2 }}>{t.units}u · {(t.units * 1.5).toFixed(1)}% bankroll</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 9, color: "#1a3050" }}>
                Last updated: 2026-03-07 from bbmi_backtest.csv (5,343 games).
                To update: run tier analysis on latest CSV, edit CFG.tiers at top of BBMIBettingTool.jsx.
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            EV TABLES TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "ev" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* EV by tier */}
            <div style={C.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 10 }}>EV per $100 Wagered by Tier</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tier", "Win%", "Units", "EV/bet", "-110", "-115", "-120"].map(h => (
                      <th key={h} style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 8px", textAlign: "right", borderBottom: "1px solid #152640" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CFG.tiers.map(t => {
                    const betAmt = 100;
                    const ev110 = calcEV(betAmt, t.winPct, -110);
                    const ev115 = calcEV(betAmt, t.winPct, -115);
                    const ev120 = calcEV(betAmt, t.winPct, -120);
                    return (
                      <tr key={t.label} style={{ borderBottom: "1px solid #0a1525" }}>
                        <td style={{ padding: "7px 8px", color: t.color, fontWeight: 800, fontSize: 10 }}>{t.label}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569", fontSize: 10 }}>{(t.winPct * 100).toFixed(1)}%</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569", fontSize: 10 }}>{t.units}u</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#facc15", fontSize: 10, fontFamily: "monospace" }}>+{ev110.toFixed(2)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569", fontSize: 10, fontFamily: "monospace" }}>+{ev115.toFixed(2)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: ev120 > 0 ? "#475569" : "#f97316", fontSize: 10, fontFamily: "monospace" }}>{ev120 >= 0 ? "+" : ""}{ev120.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Season projections */}
            <div style={C.card}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 10 }}>Season Projection (per {fmt$(j.currentBankroll)} bankroll)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Tier", "~Bets/Season", "Unit $", "Proj P&L"].map(h => (
                      <th key={h} style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 8px", textAlign: "right", borderBottom: "1px solid #152640" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { ...CFG.tiers[0], approxBets: 80 },
                    { ...CFG.tiers[1], approxBets: 65 },
                    { ...CFG.tiers[2], approxBets: 30 },
                    { ...CFG.tiers[3], approxBets: 15 },
                  ].map(t => {
                    const uDollar = unitDollar(j.currentBankroll);
                    const betAmt = uDollar * t.units;
                    const ev = calcEV(betAmt, t.winPct);
                    const projPnl = ev * t.approxBets;
                    return (
                      <tr key={t.label} style={{ borderBottom: "1px solid #0a1525" }}>
                        <td style={{ padding: "7px 8px", color: t.color, fontWeight: 800, fontSize: 10 }}>{t.label}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#475569", fontSize: 10 }}>~{t.approxBets}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#facc15", fontSize: 10, fontFamily: "monospace" }}>{fmt$(betAmt)}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", color: "#4ade80", fontSize: 10, fontFamily: "monospace" }}>+{fmt$(projPnl)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #152640" }}>
                    <td colSpan={3} style={{ padding: "8px 8px", color: "#facc15", fontWeight: 800, fontSize: 10 }}>Total Projected</td>
                    <td style={{ padding: "8px 8px", textAlign: "right", color: "#4ade80", fontWeight: 900, fontSize: 12, fontFamily: "monospace" }}>
                      +{fmt$([
                        { ...CFG.tiers[0], approxBets: 80 },
                        { ...CFG.tiers[1], approxBets: 65 },
                        { ...CFG.tiers[2], approxBets: 30 },
                        { ...CFG.tiers[3], approxBets: 15 },
                      ].reduce((s, t) => s + calcEV(unitDollar(j.currentBankroll) * t.units, t.winPct) * t.approxBets, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style={{ marginTop: 8, fontSize: 9, color: "#1a3050" }}>Projections at -110 juice. Actual results depend on variance, slippage, juice, and injury adjustments.</div>
            </div>

            {/* Juice impact */}
            <div style={{ ...C.card, gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#facc15", marginBottom: 10 }}>Juice Impact Table (BBMI ≥5 edge, 65.5% win rate)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Juice", "Breakeven Win%", "BBMI Margin", "EV/$100", "Assessment"].map(h => (
                      <th key={h} style={{ fontSize: 8, color: "#1a3050", textTransform: "uppercase", letterSpacing: "0.07em", padding: "4px 10px", textAlign: "right", borderBottom: "1px solid #152640" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { juice: -100, be: 50.0, lbl: "Ideal — seek out", c: "#4ade80" },
                    { juice: -105, be: 51.2, lbl: "Excellent", c: "#4ade80" },
                    { juice: -110, be: 52.4, lbl: "Standard — fine", c: "#facc15" },
                    { juice: -115, be: 53.5, lbl: "Acceptable", c: "#f59e0b" },
                    { juice: -120, be: 54.5, lbl: "Avoid if possible", c: "#f97316" },
                    { juice: -130, be: 56.5, lbl: "Skip — too close to floor", c: "#ef4444" },
                  ].map(row => {
                    const ev = calcEV(100, 0.655, row.juice);
                    return (
                      <tr key={row.juice} style={{ borderBottom: "1px solid #0a1525" }}>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#dde3ed", textAlign: "right" }}>{row.juice}</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: "#475569", textAlign: "right" }}>{row.be.toFixed(1)}%</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: row.c, textAlign: "right" }}>+{(65.5 - row.be).toFixed(1)}pp</td>
                        <td style={{ padding: "7px 10px", fontFamily: "monospace", color: ev > 0 ? row.c : "#f87171", textAlign: "right" }}>{ev >= 0 ? "+" : ""}{ev.toFixed(2)}</td>
                        <td style={{ padding: "7px 10px", color: row.c, textAlign: "right", fontWeight: row.juice <= -130 ? 800 : 400 }}>{row.lbl}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SETTINGS MODAL ── */}
        {settingsOpen && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setSettingsOpen(false)}>
            <div style={{ ...C.card, width: 380, borderRadius: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#facc15", marginBottom: 14 }}>⚙ Settings</div>

              <div style={{ marginBottom: 12 }}>
                <label style={C.label}>Reset Starting Bankroll (resets all tracking)</label>
                <input style={C.input} type="number" placeholder={`Current: ${fmt$(j.startingBankroll)}`} value={newBR} onChange={e => setNewBR(e.target.value)} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={C.label}>Unit Size Override $ (leave blank = use 1.5% of bankroll)</label>
                <input style={C.input} type="number" placeholder={`Auto: ${fmt$(unitDollar(j.currentBankroll))}/unit`} value={newUnit} onChange={e => setNewUnit(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
                <button onClick={() => {
                  const br = parseFloat(newBR);
                  const u = parseFloat(newUnit);
                  const updated = { ...j };
                  if (br > 0) { updated.startingBankroll = br; updated.currentBankroll = br; updated.peakBankroll = br; }
                  if (u > 0) setUnitOverride(u); else setUnitOverride(null);
                  save(updated);
                  setSettingsOpen(false);
                }} style={C.btn(true)}>Save</button>
                <button onClick={() => setSettingsOpen(false)} style={C.btn(false)}>Cancel</button>
              </div>

              <div style={{ borderTop: "1px solid #152640", paddingTop: 12 }}>
                <button onClick={async () => {
                  if (confirm("Delete ALL bet history and reset bankroll? Cannot be undone.")) {
                    await save(DEFAULT);
                    setSettingsOpen(false);
                  }
                }} style={{ ...C.btn(false), color: "#ef444488", borderColor: "#ef444433", width: "100%", fontSize: 10 }}>
                  ⚠ Reset Journal (Delete All Data)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PLACE BET MODAL ── */}
        {logModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setLogModal(null)}>
            <div style={{ ...C.card, width: 440, borderRadius: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#facc15", marginBottom: 4 }}>Place Bet</div>
              <div style={{ fontSize: 10, color: "#2d4a6e", marginBottom: 14 }}>
                {logModal.away} @ {logModal.home} — Pick: <strong style={{ color: "#dde3ed" }}>{logModal.pick}</strong> · {logModal.tier?.label}
              </div>
              <div style={{ background: "#060e1a", border: "1px solid #1a3a20", borderRadius: 6, padding: "8px 12px", marginBottom: 14, fontSize: 10, color: "#4ade8088" }}>
                Fill in the details when you place the bet. Come back and hit <strong style={{ color: "#4ade80" }}>Settle</strong> after the game ends.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={C.label}>Amount Bet ($)</label>
                  <input style={C.input} type="number" placeholder={`Suggested: ${fmt$(logModal.betAmt)}`} value={logState.amount} onChange={e => setLogState(s => ({ ...s, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={C.label}>Juice (-110, -105, etc.)</label>
                  <input style={C.input} type="text" value={logState.juice} onChange={e => setLogState(s => ({ ...s, juice: e.target.value }))} />
                </div>
                <div>
                  <label style={C.label}>Line You Got (slippage tracking)</label>
                  <input style={C.input} type="number" step="0.5" placeholder={`BBMI: ${logModal.vegasHomeLine ?? "—"}`} value={logState.lineGot} onChange={e => setLogState(s => ({ ...s, lineGot: e.target.value }))} />
                </div>
                <div>
                  <label style={C.label}>Notes (book, injuries, etc.)</label>
                  <input style={C.input} type="text" placeholder="e.g. Got -4 at DraftKings" value={logState.notes} onChange={e => setLogState(s => ({ ...s, notes: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => logBet(logModal)} style={C.btn(true, "#facc15")}>
                  Confirm Bet Placed
                </button>
                <button onClick={() => setLogModal(null)} style={C.btn(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTLE MODAL ── */}
        {settleModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setSettleModal(null)}>
            <div style={{ ...C.card, width: 400, borderRadius: 10 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", marginBottom: 4 }}>Settle Bet</div>
              <div style={{ fontSize: 10, color: "#2d4a6e", marginBottom: 6 }}>
                {settleModal.away} @ {settleModal.home} — Pick: <strong style={{ color: "#dde3ed" }}>{settleModal.pick}</strong>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>
                Amount: <strong style={{ color: "#facc15" }}>{fmt$(settleModal.amount)}</strong> ·
                To win: <strong style={{ color: "#4ade80" }}>{fmt$(settleModal.payout)}</strong>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={C.label}>Result</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["win", "loss", "push"].map(r => (
                    <button key={r} onClick={() => setSettleResult(r)}
                      style={{ ...C.btn(settleResult === r, r === "win" ? "#4ade80" : r === "loss" ? "#ef4444" : "#94a3b8"), flex: 1, textTransform: "uppercase", fontSize: 13, padding: "10px" }}>
                      {r === "win" ? `WIN +${fmt$(settleModal.payout)}` : r === "loss" ? `LOSS -${fmt$(settleModal.amount)}` : "PUSH"}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 7 }}>
                <button onClick={() => settleBet(settleModal.id, settleResult)}
                  style={C.btn(true, settleResult === "win" ? "#4ade80" : settleResult === "loss" ? "#ef4444" : "#94a3b8")}>
                  Record Result
                </button>
                <button onClick={() => setSettleModal(null)} style={C.btn(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 9, color: "#0f1e33" }}>
          BBMI Betting Console · Admin Only · Not for distribution · bbmihoops.com 2025-2026
        </div>
      </div>
    </div>
  );
}