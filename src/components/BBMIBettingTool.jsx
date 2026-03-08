"use client";
import React from "react";
import { useState, useMemo, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/app/firebase-config";
import games from "@/data/betting-lines/games.json";
import injuryData from "@/data/betting-lines/injuries.json";

// ─── Config ───────────────────────────────────────────────────────────────────
const CFG = {
  minEdge: 5,
  unitPct: 0.015,
  maxBetsPerDay: 10,
  stopLoss: { weeklyPct: 10, seasonFloor: 40, streakDays: 3 },
  recal: { minSample: 20, winPctFloor: 55 },
  tiers: [
    { label: "Edge 5–6",  min: 5,  max: 6,   units: 1.0, winPct: 0.638, color: "#2563eb" },
    { label: "Edge 6–8",  min: 6,  max: 8,   units: 1.5, winPct: 0.645, color: "#0a1a2f" },
    { label: "Edge 8–10", min: 8,  max: 10,  units: 2.0, winPct: 0.662, color: "#c9a84c" },
    { label: "Edge ≥ 10", min: 10, max: 999, units: 2.5, winPct: 0.748, color: "#dc2626" },
  ],
};

const DEFAULT = {
  startingBankroll: 1000, currentBankroll: 1000, peakBankroll: 1000,
  seasonStopped: false, cooldownUntil: null, weeklyStopUntil: null,
  recalMode: false, bets: [],
};

// ─── ESPN ─────────────────────────────────────────────────────────────────────
const TEAM_CROSSWALK = [
  ["Connecticut","UConn"],["Pittsburgh","Pitt"],["Mississippi","Ole Miss"],
  ["UNLV","UNLV"],["VCU","VCU"],["SMU","SMU"],["TCU","TCU"],
  ["North Carolina","UNC"],["Appalachian State","App State"],["Massachusetts","UMass"],
  ["Miami","Miami"],["Miami (OH)","Miami OH"],["St. John's (NY)","St. John's"],
  ["Saint Joseph's","Saint Joseph's"],["Saint Mary's (CA)","Saint Mary's"],
  ["Mount St. Mary's","Mount St. Mary's"],["Loyola Chicago","Loyola IL"],
  ["Loyola Marymount","LMU"],["UC Davis","UC Davis"],["UC Irvine","UC Irvine"],
  ["UC Santa Barbara","UC Santa Barbara"],["UC Riverside","UC Riverside"],
  ["UC San Diego","UC San Diego"],["UTSA","UTSA"],["UTEP","UTEP"],
  ["Texas-RGV","UT Rio Grande Valley"],["UT Rio Grande Valley","Texas-RGV"],
  ["FIU","FIU"],["FAU","FAU"],["LSU","LSU"],["USC","USC"],["UCF","UCF"],
  ["UAB","UAB"],["Louisiana","Louisiana"],["Merrimack","Merrimack College"],
  ["Purdue","Purdue Boilermakers"],["Saint Francis (PA)","St. Francis (PA)"],
  ["Central Connecticut","Central Connecticut State"],["Nicholls State","Nicholls"],
];

const NO_STRIP = new Set([
  "iowa state","michigan state","ohio state","florida state","kansas state",
  "penn state","utah state","fresno state","san jose state","boise state",
  "colorado state","kent state","ball state","north carolina state",
  "mississippi state","washington state","oregon state","arizona state",
  "oklahoma state","texas state","morgan state","alcorn state","coppin state",
  "jackson state","grambling state","savannah state","tennessee state",
  "illinois state","indiana state","wichita state","kennesaw state",
  "portland state","weber state","north carolina","south carolina",
  "north florida","south florida","northern iowa","southern illinois",
  "central michigan","eastern michigan","western michigan","northern michigan",
  "central connecticut","western kentucky","eastern kentucky","northern kentucky",
  "southern mississippi","northern illinois","eastern illinois","western illinois",
  "mcneese state","nicholls state","tarleton state","dixie state","st. thomas",
  "houston christian","incarnate word","southeastern louisiana",
  "stephen f austin","east texas am","northwestern state",
]);

function normBase(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g,"").replace(/\s+/g," ").trim();
}
const ESPN_TO_BBMI = Object.fromEntries(
  TEAM_CROSSWALK.map(([bbmi, espn]) => [normBase(espn), normBase(bbmi)])
);
function normName(name) {
  const base = normBase(name);
  return ESPN_TO_BBMI[base] ?? base;
}
function normNoMascot(name) {
  const n = normName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const w1 = words.slice(0,-1).join(" ");
  if (NO_STRIP.has(w1)) return w1;
  return words.length > 1 ? w1 : n;
}
function normNoTwo(name) {
  const n = normName(name);
  if (NO_STRIP.has(n)) return n;
  const words = n.split(" ");
  const w1 = words.slice(0,-1).join(" ");
  const w2 = words.length > 2 ? words.slice(0,-2).join(" ") : w1;
  if (NO_STRIP.has(w1)) return w1;
  if (NO_STRIP.has(w2)) return w2;
  return words.length > 2 ? w2 : normNoMascot(name);
}

function getEspnUrl() {
  const ctDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" })
    .format(new Date()).replace(/-/g,"");
  return `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&dates=${ctDate}`;
}

async function fetchEspnScores() {
  try {
    const res = await fetch(getEspnUrl(), { cache: "no-store" });
    if (!res.ok) return new Map();
    const data = await res.json();
    const map = new Map();
    const todayLocal = new Date().toLocaleDateString("en-CA");
    const todayUTC = new Date().toISOString().slice(0,10);
    const tomorrowUTC = new Date(Date.now()+86400000).toISOString().slice(0,10);
    for (const event of data.events ?? []) {
      const gameDate = (event.date ?? "").slice(0,10);
      if (gameDate !== todayLocal && gameDate !== todayUTC && gameDate !== tomorrowUTC) continue;
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const awayC = comp.competitors?.find(c => c.homeAway === "away");
      const homeC = comp.competitors?.find(c => c.homeAway === "home");
      if (!awayC || !homeC) continue;
      const st = comp.status ?? event.status;
      const sid = st.type.id;
      const isLive = sid === "2" || sid === "23";
      const state = isLive ? "in" : sid === "3" ? "post" : "pre";
      let detail = st.type.description;
      if (sid === "23") {
        const p = st.period ?? 1;
        detail = p === 1 ? "Halftime" : `End OT${p-2}`;
      } else if (sid === "2") {
        const p = st.period ?? 1;
        const half = p === 1 ? "1st Half" : p === 2 ? "2nd Half" : `OT${p-2}`;
        detail = st.displayClock ? `${half} ${st.displayClock}` : half;
      }
      const awayScore = awayC.score != null ? parseInt(awayC.score,10) : null;
      const homeScore = homeC.score != null ? parseInt(homeC.score,10) : null;
      const liveGame = {
        awayScore: Number.isNaN(awayScore) ? null : awayScore,
        homeScore: Number.isNaN(homeScore) ? null : homeScore,
        state, detail,
        espnAwayName: awayC.team.displayName, espnHomeName: homeC.team.displayName,
      };
      [[awayC.team.displayName,homeC.team.displayName],
       [awayC.team.shortDisplayName,homeC.team.shortDisplayName],
       [awayC.team.abbreviation,homeC.team.abbreviation]
      ].forEach(([a,h]) => map.set(`${normName(a)}|${normName(h)}`, liveGame));
      [awayC.team.displayName, awayC.team.shortDisplayName].forEach(aN => {
        [homeC.team.displayName, homeC.team.shortDisplayName].forEach(hN => {
          const a0=normName(aN),h0=normName(hN);
          const a1=normNoMascot(aN),h1=normNoMascot(hN);
          const a2=normNoTwo(aN),h2=normNoTwo(hN);
          map.set(`${a1}|${h1}`,liveGame); map.set(`${a1}|${h0}`,liveGame);
          map.set(`${a0}|${h1}`,liveGame); map.set(`${a2}|${h2}`,liveGame);
          map.set(`${a2}|${h0}`,liveGame); map.set(`${a0}|${h2}`,liveGame);
          map.set(`${a2}|${h1}`,liveGame); map.set(`${a1}|${h2}`,liveGame);
        });
      });
      [awayC.team.displayName,awayC.team.shortDisplayName,awayC.team.abbreviation].forEach(n => {
        map.set(`away:${normName(n)}`,liveGame);
        map.set(`away:${normNoMascot(n)}`,liveGame);
        map.set(`away:${normNoTwo(n)}`,liveGame);
      });
      [homeC.team.displayName,homeC.team.shortDisplayName,homeC.team.abbreviation].forEach(n => {
        map.set(`home:${normName(n)}`,liveGame);
        map.set(`home:${normNoMascot(n)}`,liveGame);
        map.set(`home:${normNoTwo(n)}`,liveGame);
      });
    }
    return map;
  } catch { return new Map(); }
}

function getLiveGame(liveScores, away, home) {
  const aN = normName(away), hN = normName(home);
  return liveScores.get(`${aN}|${hN}`) ??
    liveScores.get(`away:${aN}`) ??
    liveScores.get(`home:${hN}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toLocaleDateString("en-CA");
const fmt$ = n => `$${Math.abs(Math.round(n)).toLocaleString()}`;
const fmtPct = n => `${(n * 100).toFixed(1)}%`;
function getTier(edge) { return CFG.tiers.find(t => edge >= t.min && edge < t.max) ?? null; }
function betAmt(tier, bankroll) { return tier ? tier.units * bankroll * CFG.unitPct : 0; }
function getInjury(team, src) {
  const players = (src[team] ?? []).filter(p => p.status === "out" || p.status === "doubtful");
  const mins = players.reduce((s, p) => s + (p.avg_minutes ?? 0), 0);
  return { players, impact: mins / 200 };
}
function injColor(impact) {
  if (impact < 0.05) return null;
  return "#c9a84c";
}

// ─── Firestore ────────────────────────────────────────────────────────────────
async function loadFS(uid) {
  try {
    const ref = doc(db, "bettingJournal", uid, "data", "journal");
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const raw = snap.data();
    return raw.journal ?? raw;
  } catch (e) { console.error("[BBMI] loadFS error:", e); return null; }
}
async function saveFS(uid, data) {
  try { await setDoc(doc(db, "bettingJournal", uid, "data", "journal"), { journal: data }); }
  catch (e) { console.error("Firestore save failed:", e); }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BBMIBettingTool() {
  const [journal, setJournal] = useState(DEFAULT);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("picks");
  const [liveScores, setLiveScores] = useState(new Map());
  const [scoresTs, setScoresTs] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newBankroll, setNewBankroll] = useState("");
  const [lineGot, setLineGot] = useState("");
  const [juice, setJuice] = useState("-110");
  const [betNotes, setBetNotes] = useState("");
  // Inline bet inputs keyed by game key (away|home)
  const [inlineLines, setInlineLines] = useState({});
  const [inlineJuice, setInlineJuice] = useState({});
  const [inlineNotes, setInlineNotes] = useState({});
  // FIX 1: editable amount per game
  const [inlineAmounts, setInlineAmounts] = useState({});
  const [settleModal, setSettleModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [settleResult, setSettleResult] = useState("win");
  // Journal inline edit
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (user) {
        const d = await loadFS(user.uid);
        if (d) setJournal({ ...DEFAULT, ...d, bets: Array.isArray(d.bets) ? d.bets : [] });
      }
      setReady(true);
    });
    return unsub;
  }, []);

  const save = useCallback(async updated => {
    setJournal(updated);
    const user = auth.currentUser;
    if (user) await saveFS(user.uid, updated);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const map = await fetchEspnScores();
      setLiveScores(map);
      setScoresTs(new Date().toLocaleTimeString());
      return Array.from(map.values()).some(g => g.state === "in");
    };
    let id;
    const scheduleNext = async () => {
      const hasLive = await refresh();
      id = setTimeout(scheduleNext, hasLive ? 30000 : 120000);
    };
    scheduleNext();
    return () => clearTimeout(id);
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const today = todayStr();
  const todayBets = journal.bets.filter(b => b.date === today);
  const pendingBets = todayBets.filter(b => b.result === null);
  const settledToday = todayBets.filter(b => b.result !== null);
  const todayW = settledToday.filter(b => b.result === "win").length;
  const todayL = settledToday.filter(b => b.result === "loss").length;

  const seasonDD = useMemo(() => {
    if (!journal.peakBankroll) return 0;
    return ((journal.peakBankroll - journal.currentBankroll) / journal.peakBankroll) * 100;
  }, [journal]);

  // ── Derived peak and season P&L from bet history ──────────────────────────
  // Group settled bets by date, compute cumulative bankroll end-of-day, find peak
  const { computedPeak, seasonPnl } = useMemo(() => {
    const settled = journal.bets.filter(b => b.result === "win" || b.result === "loss");
    const totalPnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);

    // Build daily cumulative balances starting from startingBankroll
    const byDate = {};
    for (const b of settled) {
      byDate[b.date] = (byDate[b.date] ?? 0) + (b.pnl ?? 0);
    }
    const sortedDates = Object.keys(byDate).sort();
    let running = journal.startingBankroll;
    let peak = journal.startingBankroll;
    for (const d of sortedDates) {
      running += byDate[d];
      if (running > peak) peak = running;
    }

    return { computedPeak: peak, seasonPnl: totalPnl };
  }, [journal.bets, journal.startingBankroll]);

  const weeklyDD = useMemo(() => {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const weeklyPnl = journal.bets.filter(b => b.date >= cutoff && b.result !== null).reduce((s, b) => s + (b.pnl ?? 0), 0);
    const currentBR = journal.startingBankroll + journal.bets.filter(b => b.result !== null).reduce((s, b) => s + (b.pnl ?? 0), 0);
    return currentBR > 0 ? (-weeklyPnl / Math.max(currentBR - weeklyPnl, 1)) * 100 : 0;
  }, [journal]);

  const recent50 = useMemo(() => {
    const settled = journal.bets.filter(b => b.result === "win" || b.result === "loss").slice(-50);
    if (settled.length < CFG.recal.minSample) return null;
    return { pct: (settled.filter(b => b.result === "win").length / settled.length) * 100, n: settled.length };
  }, [journal.bets]);

  const cooldownActive = journal.cooldownUntil && new Date(journal.cooldownUntil) > new Date();
  const anyStopped = journal.seasonStopped || cooldownActive || settledToday.length >= CFG.maxBetsPerDay;

  // ── Today's games ─────────────────────────────────────────────────────────
  const processedGames = useMemo(() => {
    return (games)
      .filter(g => String(g.date ?? "").split("T")[0] === today)
      .map(g => {
        const edge = Math.abs((g.bbmiHomeLine ?? 0) - (g.vegasHomeLine ?? 0));
        const pickIsHome = (g.bbmiHomeLine ?? 0) < (g.vegasHomeLine ?? 0);
        const pick = pickIsHome ? String(g.home) : String(g.away);
        const tier = getTier(edge);
        const amount = betAmt(tier, journal.currentBankroll);
        const awayInj = getInjury(String(g.away), injuryData);
        const homeInj = getInjury(String(g.home), injuryData);
        const live = getLiveGame(liveScores, String(g.away), String(g.home)) ?? null;
        const alreadyBet = pendingBets.some(b => b.away === String(g.away) && b.home === String(g.home));
        const isComplete = g.actualHomeScore !== null && g.actualHomeScore !== undefined;

        const awayScore = isComplete ? g.actualAwayScore : live?.awayScore;
        const homeScore = isComplete ? g.actualHomeScore : live?.homeScore;
        const hasScore = awayScore != null && homeScore != null;
        const isLiveOrFinal = isComplete || (live && live.state !== "pre");

        let liveStatus = null;
        if (hasScore && isLiveOrFinal) {
          const pickScore = pickIsHome ? homeScore : awayScore;
          const oppScore  = pickIsHome ? awayScore : homeScore;
          const rawDiff = pickScore - oppScore;
          const spread = pickIsHome ? (g.vegasHomeLine ?? 0) : -(g.vegasHomeLine ?? 0);
          const vsSpread = rawDiff + spread;
          liveStatus = { pickScore, oppScore, rawDiff, vsSpread, covering: vsSpread > 0, awayScore, homeScore };
        }
        return { ...g, away: String(g.away), home: String(g.home), edge, pick, pickIsHome, tier, amount, awayInj, homeInj, live, liveStatus, alreadyBet, isComplete };
      })
      .sort((a, b) => b.edge - a.edge);
  }, [journal.currentBankroll, today, liveScores, pendingBets]);

  const bettableGames = processedGames.filter(g => g.edge >= CFG.minEdge);

  // ── Place bet (inline) ────────────────────────────────────────────────────
  const handleInlinePlace = useCallback(async (g) => {
    const gameKey = `${g.away}|${g.home}`;
    const parsedLine = parseFloat(inlineLines[gameKey]) || g.vegasHomeLine;
    // FIX 1: use overridden amount if set, else default
    const overrideAmt = parseFloat(inlineAmounts[gameKey]);
    const finalAmount = (!isNaN(overrideAmt) && overrideAmt > 0) ? overrideAmt : g.amount;

    const newBet = {
      id: Date.now(), date: today,
      away: g.away, home: g.home, pick: g.pick,
      edge: g.edge, tierLabel: g.tier?.label ?? "Unknown",
      amount: finalAmount,
      lineGot: parsedLine,
      juice: inlineJuice[gameKey] || "-110",
      notes: inlineNotes[gameKey] || "",
      bbmiHomeLine: g.bbmiHomeLine ?? null,
      vegasHomeLine: g.vegasHomeLine ?? null,
      result: null, pnl: null,
    };
    await save({ ...journal, bets: [...journal.bets, newBet] });
    setInlineLines(p  => { const n = {...p}; delete n[gameKey]; return n; });
    setInlineJuice(p  => { const n = {...p}; delete n[gameKey]; return n; });
    setInlineNotes(p  => { const n = {...p}; delete n[gameKey]; return n; });
    setInlineAmounts(p => { const n = {...p}; delete n[gameKey]; return n; });
  }, [inlineLines, inlineJuice, inlineNotes, inlineAmounts, journal, today, save]);

  // ── Settle bet ────────────────────────────────────────────────────────────
  const settleBet = useCallback(async () => {
    const bet = settleModal;
    if (!bet) return;
    const juiceNum = parseFloat(bet.juice ?? "-110");
    const payout = juiceNum < 0 ? bet.amount * (100 / Math.abs(juiceNum)) : bet.amount * (juiceNum / 100);
    const pnl = settleResult === "win" ? payout : settleResult === "loss" ? -bet.amount : 0;
    const newBankroll = journal.currentBankroll + pnl;
    const newPeak = Math.max(journal.peakBankroll, newBankroll);
    const updatedBets = journal.bets.map(b => b.id === bet.id ? { ...b, result: settleResult, pnl } : b);

    // Losing streak check
    let cooldownUntil = journal.cooldownUntil;
    const dates = [...new Set(updatedBets.map(b => b.date))].sort().reverse();
    let streak = 0;
    for (const d of dates) {
      const day = updatedBets.filter(b => b.date === d && b.result !== null);
      if (!day.length) continue;
      if (day.filter(b => b.result === "loss").length > day.filter(b => b.result === "win").length) streak++;
      else break;
    }
    if (streak >= CFG.stopLoss.streakDays && !cooldownUntil) {
      cooldownUntil = new Date(Date.now() + 24 * 3600000).toISOString();
    }

    await save({ ...journal, bets: updatedBets, currentBankroll: newBankroll, peakBankroll: newPeak, cooldownUntil });
    setSettleModal(null);
  }, [settleModal, settleResult, journal, save]);

  // ── Delete bet ────────────────────────────────────────────────────────────
  const handleDelete = async (betId) => {
    const updated = journal.bets.filter(b => b.id !== betId);
    await save({ ...journal, bets: updated });
    setDeleteConfirm(null);
  };

  // ── Journal inline edit ───────────────────────────────────────────────────
  const openEdit = useCallback((b) => {
    setEditingId(b.id);
    setEditDraft({
      date: b.date ?? "",
      away: b.away ?? "",
      home: b.home ?? "",
      pick: b.pick ?? "",
      tierLabel: b.tierLabel ?? "",
      amount: String(b.amount ?? ""),
      lineGot: String(b.lineGot ?? ""),
      juice: String(b.juice ?? "-110"),
      result: b.result ?? "pending",
      notes: b.notes ?? "",
    });
  }, []);

  const cancelEdit = useCallback(() => { setEditingId(null); setEditDraft({}); }, []);

  const saveEdit = useCallback(async (b) => {
    const newAmt = parseFloat(editDraft.amount);
    const result = editDraft.result === "pending" ? null : editDraft.result;
    let newPnl = null;
    if (result === "win" || result === "loss") {
      const juiceNum = parseFloat(editDraft.juice ?? "-110");
      const payout = juiceNum < 0 ? newAmt * (100 / Math.abs(juiceNum)) : newAmt * (juiceNum / 100);
      newPnl = result === "win" ? payout : -newAmt;
    } else if (result === "push") {
      newPnl = 0;
    }
    const updatedBets = journal.bets.map(bet =>
      bet.id === b.id ? {
        ...bet,
        date: editDraft.date,
        away: editDraft.away,
        home: editDraft.home,
        pick: editDraft.pick,
        tierLabel: editDraft.tierLabel,
        amount: isNaN(newAmt) ? bet.amount : newAmt,
        lineGot: parseFloat(editDraft.lineGot) || bet.lineGot,
        juice: editDraft.juice || "-110",
        result,
        pnl: newPnl,
        notes: editDraft.notes,
      } : bet
    );
    const newBankroll = journal.startingBankroll + updatedBets
      .filter(bet => bet.result === "win" || bet.result === "loss" || bet.result === "push")
      .reduce((s, bet) => s + (bet.pnl ?? 0), 0);
    await save({ ...journal, bets: updatedBets, currentBankroll: newBankroll });
    setEditingId(null);
    setEditDraft({});
  }, [editDraft, journal, save]);

  const inStyle = (extra = {}) => ({
    padding: "0.3rem 0.4rem", fontSize: "0.8rem", border: "1.5px solid #c9a84c",
    borderRadius: 5, backgroundColor: "#fffbeb", color: "#1a2e45",
    outline: "none", width: "100%", boxSizing: "border-box", ...extra,
  });

  // ── EV rows ───────────────────────────────────────────────────────────────
  const evRows = CFG.tiers.map(tier => {
    const amt = betAmt(tier, journal.currentBankroll);
    const ev = tier.winPct * (amt * (100 / 110)) - (1 - tier.winPct) * amt;
    return { ...tier, amt, ev };
  });

  if (!ready) return (
    <div className="section-wrapper" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#78716c" }}>Loading journal…</div>
    </div>
  );

  const TABS = [
    ["picks", "Today's Picks"],
    ["live", "Live Bets"],
    ["journal", "Journal"],
    ["performance", "Performance"],
    ["rules", "Rules"],
    ["ev", "EV Tables"],
  ];

  return (
    <div className="section-wrapper" style={{ backgroundColor: "#0d1117" }}>
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── PAGE HEADER ── */}
        <section style={{ marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
              <h1 style={{ fontSize: "clamp(1.4rem, 3vw, 1.9rem)", fontWeight: 800, color: "#f0f4ff", letterSpacing: "-0.03em", margin: 0 }}>
                BBMI Betting Console
              </h1>
              <span style={{
                fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em",
                background: "linear-gradient(90deg, #1e3a5f, #254d7a)",
                color: "#facc15", borderRadius: 4, padding: "2px 8px",
                textTransform: "uppercase",
              }}>ADMIN</span>
            </div>
            <p style={{ color: "#94aec7", fontSize: "0.85rem", margin: 0 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              {scoresTs && <span style={{ color: "#5a7a9a", marginLeft: "0.75rem" }}>· Scores updated {scoresTs}</span>}
            </p>
          </div>
          <button onClick={() => setSettingsOpen(true)} style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.5rem 1.1rem", fontSize: "0.82rem", fontWeight: 600,
            backgroundColor: "#1a2e45", color: "#f0f4ff",
            border: "1.5px solid #2a4a6b", borderRadius: 8, cursor: "pointer",
          }}>⚙ Settings</button>
        </section>

        {/* ── STATS STRIP ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "0.4rem" }}>
          {[
            { label: "Bankroll", value: fmt$(journal.startingBankroll + seasonPnl), color: seasonPnl >= 0 ? "#16a34a" : "#dc2626", sub: `started ${fmt$(journal.startingBankroll)}` },
            { label: "Peak", value: fmt$(computedPeak), color: "#f0f4ff", sub: "season high (settled bets)" },
            { label: "Season P&L", value: `${seasonPnl >= 0 ? "+" : ""}${fmt$(seasonPnl)}`, color: seasonPnl >= 0 ? "#16a34a" : "#dc2626", sub: "sum of settled bets" },
            { label: "7-Day Drawdown", value: `${Math.max(0, weeklyDD).toFixed(1)}%`, color: weeklyDD >= CFG.stopLoss.weeklyPct ? "#dc2626" : weeklyDD >= 5 ? "#c9a84c" : "#16a34a", sub: `limit: ${CFG.stopLoss.weeklyPct}%` },
            { label: "Today W–L", value: `${todayW}–${todayL}`, color: todayW > todayL ? "#16a34a" : todayL > todayW ? "#dc2626" : "#f0f4ff", sub: `${settledToday.length} / ${CFG.maxBetsPerDay} bets` },
          ].map(s => (
            <div key={s.label} style={{
              backgroundColor: "#1a2e45", border: "1px solid #2a4a6b",
              borderRadius: 10, padding: "1rem 1.1rem", textAlign: "center",
            }}>
              <div style={{ fontSize: "1.4rem", fontWeight: 900, color: s.color, fontFamily: "monospace", letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94aec7", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>{s.label}</div>
              <div style={{ fontSize: "0.68rem", color: "#a8a29e", marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ── STOP BANNERS ── */}
        {journal.seasonStopped && (
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, color: "#a07828", fontSize: "0.9rem" }}>🛑 Season Stop — {seasonDD.toFixed(1)}% Drawdown</div>
              <div style={{ fontSize: "0.8rem", color: "#78716c", marginTop: 2 }}>Bankroll dropped {seasonDD.toFixed(1)}% from peak. Betting suspended per strategy rules.</div>
            </div>
            <button onClick={() => save({ ...journal, seasonStopped: false })} style={{ fontSize: "0.75rem", padding: "0.4rem 0.9rem", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>Override</button>
          </div>
        )}
        {cooldownActive && (
          <div style={{ backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 800, color: "#c2410c", fontSize: "0.9rem" }}>⏸ 24h Cooldown Active</div>
              <div style={{ fontSize: "0.8rem", color: "#9a3412", marginTop: 2 }}>Until: {new Date(journal.cooldownUntil).toLocaleString()}</div>
            </div>
            <button onClick={() => save({ ...journal, cooldownUntil: null })} style={{ fontSize: "0.75rem", padding: "0.4rem 0.9rem", backgroundColor: "#c9a84c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}>Clear</button>
          </div>
        )}
        {recent50 && recent50.pct < CFG.recal.winPctFloor && (
          <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1rem" }}>
            <div style={{ fontWeight: 800, color: "#c9a84c", fontSize: "0.9rem" }}>⚠️ Recalibration Alert</div>
            <div style={{ fontSize: "0.8rem", color: "#a07828", marginTop: 2 }}>Last {recent50.n} bets: <strong>{recent50.pct.toFixed(1)}%</strong> win rate — below {CFG.recal.winPctFloor}% floor. Reduce unit size.</div>
          </div>
        )}

        {/* ── MAIN PANEL ── */}
        <section style={{
          backgroundColor: "#f5f2ef", borderRadius: 12,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          border: "1px solid #dedad5",
          padding: "2rem 1.5rem 2.5rem",
          marginBottom: "2rem",
        }}>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.75rem", borderBottom: "1px solid #e7e5e4", paddingBottom: "1rem", flexWrap: "wrap" }}>
            {TABS.map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 600,
                borderRadius: 7, border: "none", cursor: "pointer",
                backgroundColor: tab === id ? "#0a1a2f" : "transparent",
                color: tab === id ? "#facc15" : "#78716c",
              }}>{lbl}</button>
            ))}
          </div>

          {/* ══ TODAY'S PICKS ══ */}
          {tab === "picks" && (
            <div>
              {bettableGames.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
                  <div style={{ fontWeight: 700, color: "#57534e", fontSize: "0.95rem" }}>No qualifying games today</div>
                  <div style={{ fontSize: "0.82rem", color: "#a8a29e", marginTop: 4 }}>Games with edge ≥ {CFG.minEdge} pts will appear here</div>
                </div>
              )}

              {CFG.tiers.slice().reverse().map(tierDef => {
                const tierGames = bettableGames.filter(g => g.tier?.label === tierDef.label);
                if (!tierGames.length) return null;
                const isStrong = tierDef.min >= 8;
                return (
                  <div key={tierDef.label} style={{ marginBottom: "0.4rem" }}>
                    {/* Tier header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      marginBottom: "0.2rem", paddingBottom: "0.2rem",
                      borderBottom: `2px solid ${isStrong ? tierDef.color + "80" : "#c8c0b5"}`,
                    }}>
                      <span style={{
                        backgroundColor: isStrong ? tierDef.color : "#c8c0b5",
                        color: isStrong ? "#ffffff" : "#4a4238",
                        fontSize: "0.78rem", fontWeight: 900, letterSpacing: "0.1em",
                        textTransform: "uppercase", borderRadius: 4,
                        padding: "0.2rem 0.55rem",
                      }}>{isStrong ? "BET" : "CONSIDER"}</span>
                      <span style={{ fontSize: "0.92rem", fontWeight: 800, color: isStrong ? "#0d1d2e" : "#5c5449", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {tierDef.label}
                      </span>
                      <span style={{ fontSize: "0.86rem", color: "#7a7168" }}>
                        {tierDef.units}u · {(tierDef.winPct * 100).toFixed(1)}% target
                      </span>
                    </div>

                    {tierGames.map((g, gi) => {
                      const gameKey = `${g.away}|${g.home}`;
                      const hasInj = g.awayInj.players.length > 0 || g.homeInj.players.length > 0;
                      const isLive = g.live?.state === "in";
                      const isFinal = g.live?.state === "post" || g.isComplete;
                      const currentLine = inlineLines[gameKey] !== undefined ? inlineLines[gameKey] : String(g.vegasHomeLine ?? "");
                      const currentJuice = inlineJuice[gameKey] !== undefined ? inlineJuice[gameKey] : "-110";
                      const currentNotes = inlineNotes[gameKey] ?? "";
                      // FIX 1: editable amount — default to calculated, override if typed
                      const currentAmount = inlineAmounts[gameKey] !== undefined ? inlineAmounts[gameKey] : g.amount.toFixed(2);
                      const displayAmount = parseFloat(inlineAmounts[gameKey]) > 0 ? parseFloat(inlineAmounts[gameKey]) : g.amount;

                      return (
                        <div key={gi} style={{
                          border: "1px solid #2a4a6b",
                          borderLeft: `4px solid ${tierDef.color}`,
                          borderRadius: 10, marginBottom: "0.75rem",
                          backgroundColor: "#1a2e45",
                          overflow: "hidden",
                        }}>
                          {/* Main card row */}
                          <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>

                            {/* Left: matchup + details */}
                            <div style={{ flex: 1, minWidth: 200 }}>
                              {/* FIX 2: was color "#1a2e45" on bg "#1a2e45" — now white */}
                              <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#f0f4ff", marginBottom: 3 }}>
                                {g.away} @ {g.home}
                                {(g.awayInj.players.length > 0 || g.homeInj.players.length > 0) && (
                                  <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#c9a84c", fontWeight: 800 }}>⚠</span>
                                )}
                              </div>
                              <div style={{ fontSize: "0.8rem", color: "#94aec7" }}>
                                Bet: <strong style={{ color: "#facc15", fontWeight: 900 }}>{g.pick}</strong>
                                {" "}· {g.tier?.label}
                                {" "}· Vegas <strong style={{ color: "#f0f4ff" }}>{g.vegasHomeLine > 0 ? "+" : ""}{g.vegasHomeLine}</strong>
                                {" "}· BBMI <strong style={{ color: "#f0f4ff" }}>{g.bbmiHomeLine > 0 ? "+" : ""}{g.bbmiHomeLine}</strong>
                                {" "}· Win% <strong style={{ color: "#f0f4ff" }}>{((g.bbmiWinProb ?? 0) * 100).toFixed(1)}%</strong>
                              </div>
                            </div>

                            {/* Right: inputs or status */}
                            {(g.isComplete || isFinal) ? (
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", backgroundColor: "#0f1e2e", border: "1px solid #2a4a6b", borderRadius: 6, padding: "0.4rem 0.85rem", flexShrink: 0 }}>Game over</span>
                            ) : g.alreadyBet ? (
                              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#facc15", backgroundColor: "#0f1e2e", border: "1px solid #2a4a6b", borderRadius: 6, padding: "0.4rem 0.85rem", flexShrink: 0 }}>✓ Placed</span>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0, flexWrap: "wrap" }}>
                                {/* FIX 1: editable amount input */}
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <span style={{ fontSize: "0.6rem", color: "#5a7a9a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Amt $</span>
                                  <input
                                    type="number" step="0.50" min="0"
                                    value={currentAmount}
                                    onChange={e => setInlineAmounts(p => ({...p, [gameKey]: e.target.value}))}
                                    title="Bet amount"
                                    style={{ width: 68, padding: "0.4rem 0.5rem", border: "1.5px solid #c9a84c", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace", backgroundColor: "#0f1e2e", color: "#facc15", fontWeight: 700 }}
                                  />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <span style={{ fontSize: "0.6rem", color: "#5a7a9a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Line</span>
                                  <input
                                    type="number" step="0.5"
                                    value={currentLine}
                                    onChange={e => setInlineLines(p => ({...p, [gameKey]: e.target.value}))}
                                    title="Line"
                                    style={{ width: 62, padding: "0.4rem 0.5rem", border: "1px solid #2a4a6b", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace", backgroundColor: "#0f1e2e", color: "#f0f4ff" }}
                                  />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <span style={{ fontSize: "0.6rem", color: "#5a7a9a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Juice</span>
                                  <input
                                    type="text"
                                    value={currentJuice}
                                    onChange={e => setInlineJuice(p => ({...p, [gameKey]: e.target.value}))}
                                    title="Juice" placeholder="-110"
                                    style={{ width: 52, padding: "0.4rem 0.5rem", border: "1px solid #2a4a6b", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace", backgroundColor: "#0f1e2e", color: "#f0f4ff" }}
                                  />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <span style={{ fontSize: "0.6rem", color: "#5a7a9a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</span>
                                  <input
                                    type="text"
                                    value={currentNotes}
                                    onChange={e => setInlineNotes(p => ({...p, [gameKey]: e.target.value}))}
                                    title="Notes" placeholder="notes"
                                    style={{ width: 80, padding: "0.4rem 0.5rem", border: "1px solid #2a4a6b", borderRadius: 6, fontSize: "0.85rem", backgroundColor: "#0f1e2e", color: "#f0f4ff" }}
                                  />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                                  <span style={{ fontSize: "0.6rem", color: "transparent" }}>_</span>
                                  <button
                                    disabled={anyStopped}
                                    onClick={() => handleInlinePlace(g)}
                                    style={{
                                      backgroundColor: anyStopped ? "#1a2e45" : "#1e3a5f",
                                      color: anyStopped ? "#5a7a9a" : "#facc15",
                                      border: "none", borderRadius: 7,
                                      padding: "0.5rem 1.1rem", fontSize: "0.8rem",
                                      fontWeight: 700, cursor: anyStopped ? "not-allowed" : "pointer",
                                      whiteSpace: "nowrap",
                                    }}>
                                    ✓ Place {fmt$(displayAmount)}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Live score bar */}
                          {g.liveStatus && (
                            <div style={{
                              borderTop: `3px solid ${g.liveStatus.covering ? "#4a90d9" : "#6b7280"}`,
                              backgroundColor: g.liveStatus.covering ? "#0f2a4a" : "#2a2a2e",
                              padding: "0.3rem 0.75rem",
                              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem",
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                                {isLive && <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.85rem", fontWeight: 800, color: "#f0f4ff" }}>
                                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#ef4444", display: "inline-block" }} />
                                  LIVE
                                </span>}
                                {isFinal && <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#64748b" }}>FINAL</span>}
                                <span style={{ fontSize: "1rem", fontWeight: 900, fontFamily: "monospace", color: "#f0f4ff" }}>
                                  {g.away} <strong>{g.liveStatus.awayScore}</strong>
                                  <span style={{ color: "#4a6a8a", margin: "0 0.35rem" }}>–</span>
                                  {g.home} <strong>{g.liveStatus.homeScore}</strong>
                                </span>
                                {g.live?.detail && <span style={{ fontSize: "0.82rem", color: "#94aec7" }}>{g.live.detail}</span>}
                              </div>
                              <div style={{
                                display: "flex", alignItems: "center", gap: "0.4rem",
                                backgroundColor: g.liveStatus.covering ? "#0a2240" : "#3a3a40",
                                border: `1px solid ${g.liveStatus.covering ? "#4a90d9" : "#6b7280"}`,
                                borderRadius: 5, padding: "0.2rem 0.5rem",
                              }}>
                                <span style={{ fontSize: "1rem" }}>{g.liveStatus.covering ? "✓" : "✗"}</span>
                                <div>
                                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: g.liveStatus.covering ? "#16a34a" : "#ef4444" }}>
                                    {g.pick} {g.liveStatus.covering ? "COVERING" : "NOT COVERING"}
                                  </div>
                                  <div style={{ fontSize: "0.78rem", color: "#94aec7" }}>
                                    {g.liveStatus.rawDiff > 0 ? "+" : ""}{g.liveStatus.rawDiff} pts · {g.liveStatus.vsSpread > 0 ? "+" : ""}{g.liveStatus.vsSpread.toFixed(1)} vs spread
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Injury panel */}
                          {hasInj && (
                            <div style={{ borderTop: "1px solid #2a4a6b", backgroundColor: "#0f1e2e", padding: "0.5rem 0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                              {[{ inj: g.awayInj, name: g.away, side: "Away" }, { inj: g.homeInj, name: g.home, side: "Home" }]
                                .filter(x => x.inj.players.length > 0)
                                .map(({ inj, name, side }) => {
                                  const c = injColor(inj.impact) ?? "#78716c";
                                  return (
                                    <div key={side}>
                                      <div style={{ fontSize: "0.78rem", fontWeight: 800, color: c, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>🤕 {name} ({side})</div>
                                      {inj.players.sort((a, b) => (b.avg_minutes ?? 0) - (a.avg_minutes ?? 0)).map((p, j) => (
                                        <div key={j} style={{ fontSize: "0.84rem", color: "#cbd5e8", display: "flex", justifyContent: "space-between", lineHeight: 1.5 }}>
                                          <span>
                                            <span style={{ color: p.status === "out" ? "#ef4444" : "#c9a84c", fontWeight: 800, fontSize: "0.75rem", marginRight: 4 }}>{p.status.toUpperCase()}</span>
                                            {p.player}
                                          </span>
                                          <span style={{ color: "#5a7a9a", fontSize: "0.82rem" }}>{p.avg_minutes != null ? `${p.avg_minutes}m` : "?"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Below-threshold games */}
              {processedGames.filter(g => g.edge > 0 && g.edge < CFG.minEdge).length > 0 && (
                <div style={{ marginTop: "0.25rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>Below threshold (edge &lt; {CFG.minEdge} pts) — skip</div>
                  {processedGames.filter(g => g.edge > 0 && g.edge < CFG.minEdge).map((g, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.75rem", backgroundColor: "#1a2e45", border: "1px solid #2a4a6b", borderRadius: 6, marginBottom: "0.2rem", opacity: 0.45 }}>
                      <span style={{ fontSize: "0.82rem", color: "#94aec7" }}>{g.away} @ {g.home}</span>
                      <span style={{ fontSize: "0.86rem", color: "#5a7a9a", fontFamily: "monospace" }}>{g.edge.toFixed(1)} pts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ LIVE BETS ══ */}
          {tab === "live" && (
            <div>
              <p style={{ fontSize: "0.85rem", color: "#78716c", marginBottom: "1rem" }}>{pendingBets.length} pending {pendingBets.length === 1 ? "bet" : "bets"} today</p>
              {pendingBets.length === 0 && (
                <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📭</div>
                  <div style={{ fontWeight: 700, color: "#57534e", fontSize: "0.95rem" }}>No pending bets</div>
                  <div style={{ fontSize: "0.82rem", color: "#a8a29e", marginTop: 4 }}>Place bets from Today's Picks tab</div>
                </div>
              )}
              {pendingBets.map((bet, i) => {
                const live = getLiveGame(liveScores, bet.away, bet.home) ?? null;
                const pickIsHome = bet.pick?.trim().toLowerCase() === bet.home?.trim().toLowerCase();
                const pickScore = pickIsHome ? live?.homeScore : live?.awayScore;
                const oppScore = pickIsHome ? live?.awayScore : live?.homeScore;
                const rawDiff = typeof pickScore === "number" && typeof oppScore === "number" ? pickScore - oppScore : null;
                const gameData = games.find(g => String(g.away) === bet.away && String(g.home) === bet.home);
                const lineGotNum = parseFloat(bet.lineGot) || gameData?.vegasHomeLine || 0;
                const pickSpread = pickIsHome ? lineGotNum : -lineGotNum;
                const covering = rawDiff !== null ? (rawDiff + pickSpread > 0) : null;
                const tierDef = CFG.tiers.find(t => t.label === bet.tierLabel);

                return (
                  <div key={bet.id ?? i} style={{
                    border: "1px solid #e7e5e4", borderLeft: `4px solid ${tierDef?.color ?? "#0a1a2f"}`,
                    borderRadius: 10, marginBottom: "0.75rem", backgroundColor: "#faf8f6",
                    padding: "1rem 1.25rem",
                    display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap",
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: "0.98rem", fontWeight: 700, color: "#1a2e45", marginBottom: 3 }}>{bet.away} @ {bet.home}</div>
                      <div style={{ fontSize: "0.8rem", color: "#78716c" }}>
                        Pick: <strong style={{ color: tierDef?.color ?? "#0a1a2f" }}>{bet.pick}</strong>
                        {" "}· {bet.tierLabel} · {fmt$(bet.amount)} @ {bet.lineGot}
                      </div>
                    </div>
                    {live?.state === "in" && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, fontFamily: "monospace", color: "#1a2e45" }}>{live.awayScore}–{live.homeScore}</div>
                        <div style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 700 }}>● {live.detail}</div>
                        {covering !== null && <div style={{ fontSize: "0.7rem", fontWeight: 700, color: covering ? "#16a34a" : "#dc2626", marginTop: 2 }}>{covering ? "✓ Covering" : "✗ Not covering"}</div>}
                      </div>
                    )}
                    {live?.state === "post" && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "1.15rem", fontWeight: 900, fontFamily: "monospace", color: "#1a2e45" }}>{live.awayScore}–{live.homeScore}</div>
                        <div style={{ fontSize: "0.68rem", color: "#52525b", fontWeight: 700, marginBottom: 2 }}>FINAL</div>
                        {covering !== null && (
                          <div style={{ fontSize: "0.7rem", fontWeight: 800, color: covering ? "#16a34a" : "#dc2626" }}>
                            {covering ? "✓ Covered" : "✗ Did not cover"}
                          </div>
                        )}
                      </div>
                    )}
                    {(!live || live.state === "pre") && <div style={{ fontSize: "0.86rem", color: "#7a7168" }}>Not started yet</div>}
                    <button onClick={() => { setSettleModal(bet); setSettleResult("win"); }} style={{
                      backgroundColor: "#1e3a5f", color: "#facc15", border: "none",
                      borderRadius: 7, padding: "0.5rem 1.1rem", fontSize: "0.8rem",
                      fontWeight: 700, cursor: "pointer", flexShrink: 0,
                    }}>Settle ▾</button>
                    <button onClick={() => setDeleteConfirm(bet.id)} style={{
                      backgroundColor: "transparent", color: "#a8a29e",
                      border: "1px solid #e7e5e4", borderRadius: 7,
                      padding: "0.5rem 0.65rem", fontSize: "0.9rem",
                      cursor: "pointer", flexShrink: 0, lineHeight: 1,
                    }} title="Delete bet">🗑</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ JOURNAL ══ */}
          {tab === "journal" && (
            <div>
              <p style={{ fontSize: "0.85rem", color: "#78716c", marginBottom: "1rem" }}>
                {journal.bets.length} total bets logged
                <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "#a8a29e" }}>· click ✏️ to edit any row inline</span>
              </p>
              {journal.bets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#a8a29e", fontSize: "0.9rem" }}>No bets logged yet</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #254d7a 100%)" }}>
                        {["Date", "Away", "Home", "Pick", "Tier", "Amt $", "BBMI Line", "Orig Vegas", "Line Got", "Rev Edge", "Juice", "Result", "P&L", "Notes", ""].map(h => (
                          <th key={h} style={{ padding: "0.65rem 0.75rem", textAlign: "left", fontSize: "0.63rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...journal.bets].reverse().map((b, i) => {
                        const isEditing = editingId === b.id;
                        const tierDef = CFG.tiers.find(t => t.label === b.tierLabel);
                        const rowBg = isEditing ? "#fffdf0" : i % 2 === 0 ? "#faf8f6" : "#f0ede9";
                        // Use lines stored on the bet at placement time (most accurate).
                        // Fall back to games.json only if missing, matched on date+teams.
                        const gameData = (b.bbmiHomeLine == null || b.vegasHomeLine == null)
                          ? games.find(g =>
                              String(g.away) === b.away &&
                              String(g.home) === b.home &&
                              String(g.date ?? "").slice(0, 10) === b.date
                            )
                          : null;
                        const bbmiLine = b.bbmiHomeLine ?? gameData?.bbmiHomeLine ?? null;
                        const origVegas = b.vegasHomeLine ?? gameData?.vegasHomeLine ?? null;
                        const lineGotNum = parseFloat(b.lineGot);
                        const revEdge = (bbmiLine !== null && !isNaN(lineGotNum))
                          ? Math.abs(bbmiLine - lineGotNum)
                          : null;
                        // Color revised edge: better than original = green, worse = red
                        const origEdge = (bbmiLine !== null && origVegas !== null)
                          ? Math.abs(bbmiLine - origVegas) : null;
                        const edgeColor = revEdge === null ? "#a8a29e"
                          : origEdge !== null && revEdge > origEdge ? "#16a34a"
                          : origEdge !== null && revEdge < origEdge ? "#dc2626"
                          : "#44403c";
                        // Live preview values used while a row is being edited
                        const draftLineGotNum = parseFloat(editDraft.lineGot);
                        const liveRevEdge = (bbmiLine !== null && !isNaN(draftLineGotNum))
                          ? Math.abs(bbmiLine - draftLineGotNum)
                          : revEdge;
                        const liveEdgeColor = liveRevEdge === null ? "#a8a29e"
                          : origEdge !== null && liveRevEdge > origEdge ? "#16a34a"
                          : origEdge !== null && liveRevEdge < origEdge ? "#dc2626"
                          : "#44403c";
                        return (
                          <tr key={b.id ?? i} style={{ borderBottom: "1px solid #f5f5f4", backgroundColor: rowBg, outline: isEditing ? "2px solid #c9a84c" : "none" }}>

                            {/* DATE */}
                            <td style={{ padding: "0.45rem 0.75rem", color: "#78716c", whiteSpace: "nowrap" }}>
                              {isEditing
                                ? <input type="date" value={editDraft.date} onChange={e => setEditDraft(d => ({...d, date: e.target.value}))} style={inStyle({ width: 120 })} />
                                : b.date}
                            </td>

                            {/* AWAY */}
                            <td style={{ padding: "0.45rem 0.75rem", color: "#44403c" }}>
                              {isEditing
                                ? <input value={editDraft.away} onChange={e => setEditDraft(d => ({...d, away: e.target.value}))} style={inStyle({ width: 110 })} />
                                : b.away}
                            </td>

                            {/* HOME */}
                            <td style={{ padding: "0.45rem 0.75rem", color: "#44403c" }}>
                              {isEditing
                                ? <input value={editDraft.home} onChange={e => setEditDraft(d => ({...d, home: e.target.value}))} style={inStyle({ width: 110 })} />
                                : b.home}
                            </td>

                            {/* PICK */}
                            <td style={{ padding: "0.45rem 0.75rem", fontWeight: 700, color: tierDef?.color ?? "#1a2e45" }}>
                              {isEditing
                                ? <input value={editDraft.pick} onChange={e => setEditDraft(d => ({...d, pick: e.target.value}))} style={inStyle({ width: 100 })} />
                                : b.pick}
                            </td>

                            {/* TIER */}
                            <td style={{ padding: "0.45rem 0.75rem", color: "#78716c" }}>
                              {isEditing
                                ? (
                                  <select value={editDraft.tierLabel} onChange={e => setEditDraft(d => ({...d, tierLabel: e.target.value}))} style={inStyle({ width: 100 })}>
                                    {CFG.tiers.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
                                    <option value="Unknown">Unknown</option>
                                  </select>
                                )
                                : b.tierLabel}
                            </td>

                            {/* AMOUNT */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#1a2e45" }}>
                              {isEditing
                                ? <input type="number" step="0.50" min="0" value={editDraft.amount} onChange={e => setEditDraft(d => ({...d, amount: e.target.value}))} style={inStyle({ width: 72, fontFamily: "monospace" })} />
                                : fmt$(b.amount)}
                            </td>

                            {/* BBMI LINE — read-only from games.json */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#2563eb", fontWeight: 600 }}>
                              {bbmiLine !== null ? (bbmiLine > 0 ? `+${bbmiLine}` : bbmiLine) : <span style={{ color: "#d1c9c0" }}>—</span>}
                            </td>

                            {/* ORIG VEGAS — read-only from games.json */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#78716c" }}>
                              {origVegas !== null ? (origVegas > 0 ? `+${origVegas}` : origVegas) : <span style={{ color: "#d1c9c0" }}>—</span>}
                            </td>

                            {/* LINE GOT — editable */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#78716c" }}>
                              {isEditing
                                ? <input type="number" step="0.5" value={editDraft.lineGot} onChange={e => setEditDraft(d => ({...d, lineGot: e.target.value}))} style={inStyle({ width: 60, fontFamily: "monospace" })} />
                                : b.lineGot ?? "—"}
                            </td>

                            {/* REV EDGE — |bbmiLine - lineGot|, color-coded vs original edge */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", fontWeight: 700, color: isEditing ? liveEdgeColor : edgeColor }}>
                              {(() => {
                                const displayEdge = isEditing ? liveRevEdge : revEdge;
                                if (displayEdge === null) return <span style={{ color: "#d1c9c0" }}>—</span>;
                                return <>
                                  {displayEdge.toFixed(1)}
                                  {origEdge !== null && displayEdge !== origEdge && (
                                    <span style={{ fontSize: "0.7rem", marginLeft: 3, opacity: 0.8 }}>
                                      {displayEdge > origEdge ? "▲" : "▼"}
                                    </span>
                                  )}
                                </>;
                              })()}
                            </td>

                            {/* JUICE */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", color: "#78716c" }}>
                              {isEditing
                                ? <input value={editDraft.juice} onChange={e => setEditDraft(d => ({...d, juice: e.target.value}))} style={inStyle({ width: 56, fontFamily: "monospace" })} />
                                : b.juice ?? "-110"}
                            </td>

                            {/* RESULT */}
                            <td style={{ padding: "0.45rem 0.75rem" }}>
                              {isEditing
                                ? (
                                  <select value={editDraft.result} onChange={e => setEditDraft(d => ({...d, result: e.target.value}))} style={inStyle({ width: 80 })}>
                                    <option value="pending">Pending</option>
                                    <option value="win">WIN</option>
                                    <option value="loss">LOSS</option>
                                    <option value="push">PUSH</option>
                                  </select>
                                )
                                : b.result === null
                                  ? <span style={{ color: "#c9a84c", fontWeight: 700, fontSize: "0.72rem" }}>● Pending</span>
                                  : <span style={{ fontWeight: 800, fontSize: "0.72rem", color: b.result === "win" ? "#16a34a" : b.result === "loss" ? "#dc2626" : "#78716c" }}>{b.result.toUpperCase()}</span>
                              }
                            </td>

                            {/* P&L — always derived, never edited directly */}
                            <td style={{ padding: "0.45rem 0.75rem", fontFamily: "monospace", fontWeight: 700, color: b.result === null ? "#a8a29e" : (b.pnl ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                              {isEditing
                                ? (() => {
                                    const amt = parseFloat(editDraft.amount);
                                    const res = editDraft.result;
                                    if (!res || res === "pending" || isNaN(amt)) return <span style={{ color: "#a8a29e" }}>—</span>;
                                    const juiceNum = parseFloat(editDraft.juice ?? "-110");
                                    const payout = juiceNum < 0 ? amt * (100 / Math.abs(juiceNum)) : amt * (juiceNum / 100);
                                    const preview = res === "win" ? payout : res === "loss" ? -amt : 0;
                                    return <span style={{ color: preview >= 0 ? "#16a34a" : "#dc2626" }}>{preview >= 0 ? "+" : ""}{fmt$(preview)}</span>;
                                  })()
                                : b.result === null ? "—" : `${(b.pnl ?? 0) >= 0 ? "+" : ""}${fmt$(b.pnl ?? 0)}`
                              }
                            </td>

                            {/* NOTES */}
                            <td style={{ padding: "0.45rem 0.75rem", color: "#a8a29e", maxWidth: 160 }}>
                              {isEditing
                                ? <input value={editDraft.notes} onChange={e => setEditDraft(d => ({...d, notes: e.target.value}))} placeholder="notes" style={inStyle({ width: 130 })} />
                                : <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{b.notes || "—"}</span>
                              }
                            </td>

                            {/* ACTIONS */}
                            <td style={{ padding: "0.45rem 0.75rem", whiteSpace: "nowrap" }}>
                              {isEditing ? (
                                <div style={{ display: "flex", gap: "0.3rem" }}>
                                  <button onClick={() => saveEdit(b)} style={{ padding: "0.3rem 0.65rem", backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: 5, fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>✓ Save</button>
                                  <button onClick={cancelEdit} style={{ padding: "0.3rem 0.55rem", backgroundColor: "#f5f5f4", color: "#78716c", border: "1px solid #e7e5e4", borderRadius: 5, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>✕</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
                                  <button onClick={() => openEdit(b)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "0.85rem", padding: "0 0.2rem" }} title="Edit row">✏️</button>
                                  <button onClick={() => setDeleteConfirm(b.id ?? i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d1c9c0", fontSize: "0.85rem", padding: "0 0.2rem" }} title="Delete bet">🗑</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══ PERFORMANCE ══ */}
          {tab === "performance" && (() => {
            const settled = journal.bets.filter(b => b.result === "win" || b.result === "loss");
            const wins = settled.filter(b => b.result === "win").length;
            const wagered = settled.reduce((s, b) => s + (b.amount ?? 0), 0);
            // FIX 3: sum actual pnl from settled bets rather than relying on currentBankroll delta
            const netPnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
            const roi = wagered > 0 ? (netPnl / wagered) * 100 : 0;
            return (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                  {[
                    { label: "Record", value: `${wins}–${settled.length - wins}`, color: "#ffffff" },
                    { label: "Win %", value: settled.length ? `${((wins / settled.length) * 100).toFixed(1)}%` : "—", color: wins / Math.max(settled.length, 1) >= 0.55 ? "#16a34a" : "#dc2626" },
                    { label: "Wagered", value: fmt$(wagered), color: "#ffffff" },
                    { label: "Net P&L", value: `${netPnl >= 0 ? "+" : ""}${fmt$(netPnl)}`, color: netPnl >= 0 ? "#16a34a" : "#dc2626" },
                    { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, color: roi >= 0 ? "#16a34a" : "#dc2626" },
                  ].map(s => (
                    <div key={s.label} style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #254d7a 100%)", borderRadius: 10, padding: "1rem", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #254d7a 100%)", padding: "0.7rem 1rem", fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Performance by Edge Tier</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#fafaf9" }}>
                        {["Tier", "Bets", "W–L", "Win %", "Target", "vs Target", "P&L"].map(h => (
                          <th key={h} style={{ padding: "0.6rem 1rem", textAlign: "right", fontSize: "0.67rem", fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CFG.tiers.map((tier, i) => {
                        const tb = journal.bets.filter(b => b.tierLabel === tier.label && (b.result === "win" || b.result === "loss"));
                        const tw = tb.filter(b => b.result === "win").length;
                        const pct = tb.length ? tw / tb.length : null;
                        const vs = pct !== null ? pct - tier.winPct : null;
                        const tp = tb.reduce((s, b) => s + (b.pnl ?? 0), 0);
                        return (
                          <tr key={i} style={{ borderTop: "1px solid #f5f5f4", backgroundColor: i % 2 === 0 ? "#faf8f6" : "#f0ede9" }}>
                            <td style={{ padding: "0.7rem 1rem", fontWeight: 800, color: tier.color }}>{tier.label}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#78716c" }}>{tb.length}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#1a2e45" }}>{tb.length ? `${tw}–${tb.length - tw}` : "—"}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: pct !== null ? (pct >= tier.winPct ? "#16a34a" : "#dc2626") : "#a8a29e" }}>{pct !== null ? `${(pct * 100).toFixed(1)}%` : "—"}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#78716c" }}>{fmtPct(tier.winPct)}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", color: vs !== null ? (vs >= 0 ? "#16a34a" : "#dc2626") : "#a8a29e" }}>{vs !== null ? `${vs >= 0 ? "+" : ""}${(vs * 100).toFixed(1)}pp` : "—"}</td>
                            <td style={{ padding: "0.7rem 1rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: tp >= 0 ? "#16a34a" : "#dc2626" }}>{tb.length ? `${tp >= 0 ? "+" : ""}${fmt$(tp)}` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ══ RULES ══ */}
          {tab === "rules" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
              {[
                { title: "🛑 Stop-Loss Rules", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", rules: [`Max ${CFG.maxBetsPerDay} bets/day — no exceptions`, `${CFG.stopLoss.streakDays} consecutive losing days → 24h cooldown`, `7-day drop ≥ ${CFG.stopLoss.weeklyPct}% → stop for the week`, `Season drop ≥ ${CFG.stopLoss.seasonFloor}% from peak → stop season`, "Never chase losses"] },
                { title: "✅ Pre-Bet Checklist", color: "#0a1a2f", bg: "#e8edf5", border: "#93a8c9", rules: [`Edge ≥ ${CFG.minEdge} pts vs Vegas line`, "Verify line still available at your book", "Check injuries — no key absences", "Within daily bet limit", "Line shop — find the best number"] },
                { title: "📐 Sizing Tiers", color: "#c9a84c", bg: "#fffbeb", border: "#fde68a", rules: CFG.tiers.map(t => `${t.label}: ${t.units}u — ${(t.winPct * 100).toFixed(1)}% target`).concat(["Never exceed 2.5u on any single bet"]) },
                { title: "🧠 Cardinal Rules", color: "#0a1a2f", bg: "#f0fdf4", border: "#86efac", rules: ["Model edge only — ignore gut and narratives", "Never bet emotionally invested games", "Record every bet immediately with actual line", "Line shop every bet — 0.5 pts compounds", "Never bet tilted or under the influence"] },
                { title: "🔧 Recalibration", color: "#0ea5e9", bg: "#f0f9ff", border: "#bae6fd", rules: [`Last ${CFG.recal.minSample}+ bets < ${CFG.recal.winPctFloor}% → alert`, "Drop to 0.5u flat until 20 more settle", "Audit last 20 losses for patterns", "Confirm getting opening lines, not closing", "Update tier rates after each backtest"] },
                { title: "📅 Daily Protocol", color: "#1a2e45", bg: "#f8fafc", border: "#e2e8f0", rules: ["Check picks after 10am CT — lines loaded", "Sort by edge — bet highest first", "Place before significant line movement", "Log each bet immediately after placing", "Update results as games complete"] },
              ].map((s, i) => (
                <div key={i} style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: s.color, marginBottom: "0.4rem" }}>{s.title}</div>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                    {s.rules.map((r, j) => (
                      <li key={j} style={{ fontSize: "0.8rem", color: "#44403c", lineHeight: 1.75, display: "flex", gap: 7 }}>
                        <span style={{ color: s.color, flexShrink: 0 }}>›</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* ══ EV TABLES ══ */}
          {tab === "ev" && (
            <div>
              <p style={{ fontSize: "0.82rem", color: "#57534e", marginBottom: "1.25rem", lineHeight: 1.7 }}>
                Expected value per bet at current bankroll of <strong style={{ color: "#1a2e45" }}>{fmt$(journal.currentBankroll)}</strong> · unit = {(CFG.unitPct * 100).toFixed(1)}% = <strong style={{ color: "#1a2e45" }}>{fmt$(journal.currentBankroll * CFG.unitPct)}</strong> · assumes –110 juice
              </p>
              <div style={{ border: "1px solid #e7e5e4", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #254d7a 100%)", padding: "0.7rem 1rem", fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  EV by Tier · Bankroll: {fmt$(journal.currentBankroll)}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#fafaf9" }}>
                      {["Tier", "Units", "Bet Size", "Win %", "Win Payout", "EV / Bet", "EV %"].map(h => (
                        <th key={h} style={{ padding: "0.65rem 1rem", textAlign: "right", fontSize: "0.67rem", fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evRows.map((row, i) => (
                      <tr key={i} style={{ borderTop: "1px solid #f5f5f4", backgroundColor: i % 2 === 0 ? "#faf8f6" : "#f0ede9" }}>
                        <td style={{ padding: "0.75rem 1rem", fontWeight: 800, color: row.color }}>{row.label}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#57534e" }}>{row.units}u</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#1a2e45" }}>{fmt$(row.amt)}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#57534e" }}>{(row.winPct * 100).toFixed(1)}%</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: "#16a34a" }}>{fmt$(row.amt * (100 / 110))}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: row.ev >= 0 ? "#16a34a" : "#dc2626" }}>{row.ev >= 0 ? "+" : ""}{fmt$(row.ev)}</td>
                        <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "monospace", color: row.ev >= 0 ? "#16a34a" : "#dc2626" }}>{row.amt > 0 ? `${((row.ev / row.amt) * 100).toFixed(1)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </section>

        {/* ── DELETE CONFIRM MODAL ── */}
        {deleteConfirm !== null && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setDeleteConfirm(null)}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "1.5rem", width: "100%", maxWidth: 320, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1a2e45", marginBottom: "0.4rem" }}>Delete this bet?</div>
              <div style={{ fontSize: "0.83rem", color: "#78716c", marginBottom: "1.25rem" }}>This cannot be undone.</div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "0.6rem", borderRadius: 8, border: "1px solid #e7e5e4", backgroundColor: "#f5f3f0", color: "#78716c", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem" }}>Cancel</button>
                <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "0.6rem", borderRadius: 8, border: "none", backgroundColor: "#0a1a2f", color: "#f5c518", fontWeight: 800, cursor: "pointer", fontSize: "0.88rem" }}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTLE MODAL ── */}
        {settleModal && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setSettleModal(null)}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "1.75rem", width: "100%", maxWidth: 400, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1a2e45", marginBottom: 4 }}>Settle Bet</div>
              <div style={{ fontSize: "0.82rem", color: "#78716c", marginBottom: "1.25rem" }}>
                {settleModal.away} @ {settleModal.home} — <strong>{settleModal.pick}</strong> · {fmt$(settleModal.amount)}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                {["win", "loss", "push"].map(r => (
                  <button key={r} onClick={() => setSettleResult(r)} style={{
                    flex: 1, padding: "0.65rem", border: "2px solid",
                    borderColor: settleResult === r ? (r === "win" ? "#16a34a" : r === "loss" ? "#dc2626" : "#78716c") : "#e7e5e4",
                    backgroundColor: settleResult === r ? (r === "win" ? "#f0fdf4" : r === "loss" ? "#fef2f2" : "#f8f8f7") : "#ffffff",
                    color: r === "win" ? "#16a34a" : r === "loss" ? "#dc2626" : "#78716c",
                    borderRadius: 8, fontSize: "0.88rem", fontWeight: 800, cursor: "pointer", textTransform: "uppercase",
                  }}>{r}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.6rem" }}>
                <button onClick={settleBet} style={{
                  flex: 1, padding: "0.7rem",
                  backgroundColor: settleResult === "win" ? "#16a34a" : settleResult === "loss" ? "#dc2626" : "#78716c",
                  color: "#ffffff", border: "none", borderRadius: 8, fontSize: "0.88rem", fontWeight: 800, cursor: "pointer",
                }}>Confirm {settleResult.toUpperCase()}</button>
                <button onClick={() => setSettleModal(null)} style={{ flex: 1, padding: "0.7rem", backgroundColor: "#f5f5f4", color: "#44403c", border: "none", borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS MODAL ── */}
        {settingsOpen && (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setSettingsOpen(false)}>
            <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "1.75rem", width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "#1a2e45", marginBottom: "1.25rem" }}>⚙ Settings</div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Starting Bankroll</label>
                <input type="number" value={newBankroll} onChange={e => setNewBankroll(e.target.value)} placeholder={String(journal.startingBankroll)}
                  style={{ width: "100%", boxSizing: "border-box", padding: "0.55rem 0.85rem", fontSize: "0.88rem", border: "1.5px solid #e7e5e4", borderRadius: 7, outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1rem" }}>
                <button onClick={async () => { const br = parseFloat(newBankroll); if (br > 0) await save({ ...journal, startingBankroll: br, currentBankroll: br, peakBankroll: br }); setSettingsOpen(false); setNewBankroll(""); }} style={{ flex: 1, padding: "0.65rem", background: "linear-gradient(135deg, #0a1a2f, #0d2440)", color: "#facc15", border: "none", borderRadius: 8, fontSize: "0.85rem", fontWeight: 800, cursor: "pointer" }}>Save</button>
                <button onClick={() => setSettingsOpen(false)} style={{ flex: 1, padding: "0.65rem", backgroundColor: "#f5f5f4", color: "#44403c", border: "none", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
              </div>
              <div style={{ borderTop: "1px solid #f5f5f4", paddingTop: "1rem" }}>
                <button onClick={async () => { if (confirm("Reset ALL journal data? This cannot be undone.")) { await save(DEFAULT); setSettingsOpen(false); } }} style={{ width: "100%", padding: "0.6rem", backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                  ⚠ Reset Journal (Delete All Data)
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.7rem", color: "#d6d3d1" }}>
          BBMI Betting Console · Admin Only · Not for distribution
        </div>

      </div>
    </div>
  );
}
