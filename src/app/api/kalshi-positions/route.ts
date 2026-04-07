import { NextResponse } from "next/server";
import { createSign } from "crypto";
import { readFileSync } from "fs";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

function loadPrivateKey(): string {
  // Try file path first (local dev), then env var (Vercel)
  const keyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (keyPath) {
    try { return readFileSync(keyPath, "utf-8"); } catch {}
  }
  const keyEnv = process.env.KALSHI_PRIVATE_KEY ?? "";
  return keyEnv.replace(/\\n/g, "\n");
}

function kalshiHeaders(method: string, path: string): Record<string, string> {
  const keyId = process.env.KALSHI_API_KEY_ID ?? "";
  const privateKeyPem = loadPrivateKey();

  const timestampMs = Date.now().toString();
  // Sign: timestamp + METHOD + /trade-api/v2/path (no query params)
  // Path passed in is like "/portfolio/positions" — prepend the base path
  const fullPath = `/trade-api/v2${path.split("?")[0]}`;
  const msgString = timestampMs + method.toUpperCase() + fullPath;

  const sign = createSign("SHA256");
  sign.update(msgString);
  sign.end();
  // RSA-PSS: padding=6 (PSS), saltLength=32 (SHA256 digest length)
  const signature = sign.sign(
    { key: privateKeyPem, padding: 6, saltLength: 32 },
    "base64"
  );

  return {
    "Content-Type": "application/json",
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestampMs,
    "KALSHI-ACCESS-SIGNATURE": signature,
  };
}

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

// Parse team codes from ticker like KXMLBTOTAL-26APR071845STLWSH-8
function parseTickerTeams(ticker: string): { away: string; home: string } | null {
  try {
    const parts = ticker.split("-");
    if (parts.length < 2) return null;
    const datePart = parts[1];
    // Skip year (2), month (3), day (2), time (4) = 11 chars, rest is team codes
    let teamPart = datePart.slice(2); // skip year
    const monthStr = teamPart.slice(0, 3);
    if (!/^[A-Z]{3}$/.test(monthStr)) return null;
    teamPart = teamPart.slice(5); // skip month + day
    if (/^\d{4}/.test(teamPart)) teamPart = teamPart.slice(4); // skip time
    // Split into two known team codes
    for (let i = 1; i < teamPart.length; i++) {
      const away = teamPart.slice(0, i);
      const home = teamPart.slice(i);
      if (MLB_CODES[away] && MLB_CODES[home]) {
        return { away: MLB_CODES[away], home: MLB_CODES[home] };
      }
    }
    return null;
  } catch { return null; }
}

// Parse team names from Kalshi position titles (fallback)
function parsePositionTitle(title: string): { away: string; home: string; market: string } | null {
  const match = title.match(/^(.+?)\s+vs\s+(.+?):\s+(.+)$/i);
  if (!match) return null;
  return { away: match[1].trim(), home: match[2].trim(), market: match[3].trim() };
}

// Fuzzy team name match — checks if either string contains the other
function teamsMatch(kalshiName: string, bbmiName: string): boolean {
  const k = kalshiName.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const b = bbmiName.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  // Handle common abbreviations
  const abbrevMap: Record<string, string> = {
    "as": "athletics",
    "new york y": "yankees",
    "new york m": "mets",
    "la": "los angeles",
    "la d": "dodgers",
    "chicago w": "white sox",
    "chicago c": "cubs",
  };
  const kNorm = abbrevMap[k] ?? k;
  const bWords = b.split(" ");
  // Match if any word from BBMI name appears in Kalshi name or vice versa
  return bWords.some(w => w.length > 3 && kNorm.includes(w)) || kNorm.split(" ").some(w => w.length > 3 && b.includes(w));
}

export async function GET() {
  try {
    const path = "/portfolio/positions";
    const headers = kalshiHeaders("GET", path);
    const res = await fetch(`${KALSHI_BASE}${path}?limit=100`, { headers });
    if (!res.ok) {
      const err = await res.text();
      console.error("Kalshi positions error:", res.status, err);
      return NextResponse.json({ positions: [], error: `Kalshi API ${res.status}` }, { status: 200 });
    }

    const data = await res.json();
    const rawPositions: any[] = data.positions ?? data.market_positions ?? [];

    // Shape each position into something the frontend can use
    // Kalshi v2 fields: ticker, position_fp (contracts), total_traded_dollars (cost),
    // market_exposure_dollars, fees_paid_dollars, realized_pnl_dollars
    const positions = rawPositions.map((p: any) => {
      const ticker = p.ticker ?? p.market_ticker ?? "";
      const tickerTeams = parseTickerTeams(ticker);
      const away = tickerTeams?.away ?? "";
      const home = tickerTeams?.home ?? "";
      const isTotal = /total/i.test(ticker);
      const isSpread = /spread/i.test(ticker);

      const contracts = parseFloat(p.position_fp ?? "0");
      const cost = parseFloat(p.total_traded_dollars ?? "0");
      const exposure = parseFloat(p.market_exposure_dollars ?? "0");
      const fees = parseFloat(p.fees_paid_dollars ?? "0");
      const realizedPnl = parseFloat(p.realized_pnl_dollars ?? "0");
      // Avg price per contract = cost / contracts
      const avgPrice = contracts > 0 ? cost / contracts : 0;
      // Payout if win = $1 per contract (Kalshi binary)
      const payoutIfWin = contracts;
      // Position is always "yes" if position_fp > 0 (Kalshi returns positive for yes, negative for no)
      const side = contracts >= 0 ? "yes" : "no";

      return {
        ticker,
        title: `${away} @ ${home}`,
        away,
        home,
        market_type: isTotal ? "total" : isSpread ? "spread" : "other",
        side,
        contracts: Math.abs(contracts),
        avg_price: +avgPrice.toFixed(4),
        cost: +cost.toFixed(2),
        payout_if_right: +payoutIfWin.toFixed(2),
        exposure: +exposure.toFixed(2),
        fees: +fees.toFixed(2),
        realized_pnl: +realizedPnl.toFixed(2),
        settled: false,
      };
    });

    // Filter to baseball/MLB only (what Today's Picks shows)
    const baseballPositions = positions.filter(p =>
      /baseball|mlb/i.test(p.ticker) || /KXMLB/i.test(p.ticker)
    );

    return NextResponse.json({ positions: baseballPositions, raw_count: rawPositions.length });
  } catch (e: any) {
    console.error("kalshi-positions route error:", e);
    return NextResponse.json({ positions: [], error: e.message }, { status: 200 });
  }
}
