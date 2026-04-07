import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { createSign } from "crypto";

// ── Auth ──────────────────────────────────────────────────────────────────────
const KALSHI_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
const KEY_ID = process.env.KALSHI_API_KEY_ID ?? "";
const KEY_PATH = process.env.KALSHI_PRIVATE_KEY_PATH ?? "";

function kalshiHeaders(method: string, path: string): Record<string, string> {
  const ts = Date.now().toString();
  const pem = readFileSync(KEY_PATH, "utf-8");
  const sign = createSign("SHA256");
  sign.update(`${ts}${method}${path}`);
  sign.end();
  const sig = sign.sign({ key: pem, padding: 8, saltLength: -2 }, "base64"); // RSA-PSS MAX_LENGTH
  return {
    "KALSHI-ACCESS-KEY": KEY_ID,
    "KALSHI-ACCESS-TIMESTAMP": ts,
    "KALSHI-ACCESS-SIGNATURE": sig,
    "Content-Type": "application/json",
  };
}

async function kalshiGet(endpoint: string, params: Record<string, string> = {}) {
  const path = `/trade-api/v2${endpoint}`;
  const url = new URL(`${KALSHI_BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: kalshiHeaders("GET", path),
    next: { revalidate: 60 }, // cache 60s
  });
  if (!res.ok) throw new Error(`Kalshi ${endpoint} → ${res.status}`);
  return res.json();
}

// ── Ticker parser ─────────────────────────────────────────────────────────────
const MONTH_MAP: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04",
  MAY: "05", JUN: "06", JUL: "07", AUG: "08",
  SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const MLB_CODES: Record<string, string> = {
  ANA: "Los Angeles Angels", ARI: "Arizona Diamondbacks", ATH: "Athletics",
  ATL: "Atlanta Braves", BAL: "Baltimore Orioles", BOS: "Boston Red Sox",
  CHC: "Chicago Cubs", CIN: "Cincinnati Reds", CLE: "Cleveland Guardians",
  COL: "Colorado Rockies", CWS: "Chicago White Sox", DET: "Detroit Tigers",
  HOU: "Houston Astros", KC: "Kansas City Royals", LAA: "Los Angeles Angels",
  LAD: "Los Angeles Dodgers", MIA: "Miami Marlins", MIL: "Milwaukee Brewers",
  MIN: "Minnesota Twins", NYM: "New York Mets", NYY: "New York Yankees",
  OAK: "Athletics", PHI: "Philadelphia Phillies", PIT: "Pittsburgh Pirates",
  SD: "San Diego Padres", SEA: "Seattle Mariners", SF: "San Francisco Giants",
  STL: "St. Louis Cardinals", TB: "Tampa Bay Rays", TEX: "Texas Rangers",
  TOR: "Toronto Blue Jays", WSH: "Washington Nationals", AZ: "Arizona Diamondbacks",
};

function parseEventTicker(ticker: string): { date: string; awayCode: string; homeCode: string } | null {
  try {
    // Format: KXMLBSPREAD-26APR071610AZNYM or KXMLBTOTAL-26APR071610AZNYM
    const datePart = ticker.split("-")[1];
    const year = "20" + datePart.slice(0, 2);
    const rest = datePart.slice(2);
    const month = MONTH_MAP[rest.slice(0, 3)];
    if (!month) return null;
    const day = rest.slice(3, 5);
    let teamPart = rest.slice(5);
    // Strip time if present (4 digits)
    if (/^\d{4}/.test(teamPart)) teamPart = teamPart.slice(4);
    // teamPart is now e.g. AZNYM, SDPIT, NYYNEW etc.
    // Try to split into two known codes
    for (let i = 1; i < teamPart.length; i++) {
      const away = teamPart.slice(0, i);
      const home = teamPart.slice(i);
      if (MLB_CODES[away] && MLB_CODES[home]) {
        return { date: `${year}-${month}-${day}`, awayCode: away, homeCode: home };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Fetch all open markets for a series ──────────────────────────────────────
async function fetchSeriesMarkets(seriesTicker: string): Promise<any[]> {
  const markets: any[] = [];
  let cursor: string | undefined;
  let pages = 0;
  while (pages < 5) {
    const params: Record<string, string> = {
      series_ticker: seriesTicker,
      status: "open",
      limit: "100",
    };
    if (cursor) params.cursor = cursor;
    const data = await kalshiGet("/markets", params);
    markets.push(...(data.markets ?? []));
    cursor = data.cursor;
    if (!cursor || !data.markets?.length) break;
    pages++;
  }
  return markets;
}

// ── Find best spread contract (closest to ±1.5 RL) ───────────────────────────
function findSpreadContract(markets: any[], eventTicker: string, homeTeamCode: string | null) {
  const contracts = markets.filter(m => m.event_ticker === eventTicker);
  if (!contracts.length) return null;

  // For RL, we want the contract where home wins by 2+ (floor_strike = 1.5)
  // or away wins by 2+ — find closest to 1.5
  const rl = contracts.find(m => m.floor_strike === 1.5);
  if (rl) return rl;
  // Fallback: lowest strike
  return contracts.sort((a, b) => a.floor_strike - b.floor_strike)[0];
}

// ── Find total contract closest to Vegas total ────────────────────────────────
function findTotalContract(markets: any[], eventTicker: string, vegasTotal: number | null) {
  const contracts = markets.filter(m => m.event_ticker === eventTicker);
  if (!contracts.length) return null;
  if (vegasTotal == null) return contracts[0];
  // Find contract whose floor_strike is closest to vegasTotal
  return contracts.sort((a, b) =>
    Math.abs(a.floor_strike - vegasTotal) - Math.abs(b.floor_strike - vegasTotal)
  )[0];
}

// ── Format odds ───────────────────────────────────────────────────────────────
function fmtOdds(contract: any) {
  if (!contract) return null;
  return {
    yes_bid: contract.yes_bid_dollars,
    yes_ask: contract.yes_ask_dollars,
    no_bid: contract.no_bid_dollars,
    no_ask: contract.no_ask_dollars,
    last_price: contract.last_price_dollars,
    floor_strike: contract.floor_strike,
    ticker: contract.ticker,
    title: contract.title,
    yes_sub_title: contract.yes_sub_title,
    no_sub_title: contract.no_sub_title,
    open_interest: contract.open_interest_fp,
    volume_24h: contract.volume_24h_fp,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET() {
  try {
    // Load today's BBMI games
    const gamesPath = join(process.cwd(), "src/data/betting-lines/mlb-games.json");
    const allGames: any[] = JSON.parse(readFileSync(gamesPath, "utf-8"));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    const todayGames = allGames.filter(g => (g.date ?? g.gameDate ?? "").startsWith(today));

    if (!todayGames.length) {
      return NextResponse.json({ games: [], fetched_at: new Date().toISOString() });
    }

    // Fetch all open markets for both series in parallel
    const [spreadMarkets, totalMarkets] = await Promise.all([
      fetchSeriesMarkets("KXMLBSPREAD"),
      fetchSeriesMarkets("KXMLBTOTAL"),
    ]);

    // Build event ticker lookup: "awayCode|homeCode|date" → event_ticker
    const spreadEventMap = new Map<string, string>();
    const totalEventMap = new Map<string, string>();

    for (const m of spreadMarkets) {
      const parsed = parseEventTicker(m.event_ticker);
      if (parsed) {
        const key = `${parsed.awayCode}|${parsed.homeCode}|${parsed.date}`;
        spreadEventMap.set(key, m.event_ticker);
      }
    }
    for (const m of totalMarkets) {
      const parsed = parseEventTicker(m.event_ticker);
      if (parsed) {
        const key = `${parsed.awayCode}|${parsed.homeCode}|${parsed.date}`;
        totalEventMap.set(key, m.event_ticker);
      }
    }

    // Match each BBMI game to Kalshi markets
    const enriched = todayGames.map(g => {
      const gameDate = (g.date ?? g.gameDate ?? "").slice(0, 10);

      // Find matching event tickers
      let spreadEventTicker: string | undefined;
      let totalEventTicker: string | undefined;

      // Try all away/home code combinations
      for (const [awayCode, awayName] of Object.entries(MLB_CODES)) {
        if (!normalize(awayName).includes(normalize(g.awayTeam ?? ""))) continue;
        for (const [homeCode, homeName] of Object.entries(MLB_CODES)) {
          if (!normalize(homeName).includes(normalize(g.homeTeam ?? ""))) continue;
          const key = `${awayCode}|${homeCode}|${gameDate}`;
          if (spreadEventMap.has(key)) spreadEventTicker = spreadEventMap.get(key);
          if (totalEventMap.has(key)) totalEventTicker = totalEventMap.get(key);
        }
      }

      // Find best contracts
      const spreadContract = spreadEventTicker
        ? findSpreadContract(spreadMarkets, spreadEventTicker, null)
        : null;
      const totalContract = totalEventTicker
        ? findTotalContract(totalMarkets, totalEventTicker, g.vegasTotal ?? null)
        : null;

      return {
        ...g,
        kalshi: {
          spread: fmtOdds(spreadContract),
          total: fmtOdds(totalContract),
          spread_event_ticker: spreadEventTicker ?? null,
          total_event_ticker: totalEventTicker ?? null,
        },
      };
    });

    return NextResponse.json({
      games: enriched,
      fetched_at: new Date().toISOString(),
      spread_markets_fetched: spreadMarkets.length,
      total_markets_fetched: totalMarkets.length,
    });
  } catch (e: any) {
    console.error("[kalshi-odds]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
