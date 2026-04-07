import { NextResponse } from "next/server";
import { createSign } from "crypto";

const KALSHI_BASE = "https://trading-api.kalshi.com/trade-api/v2";

function kalshiHeaders(method: string, path: string): Record<string, string> {
  const keyId = process.env.KALSHI_API_KEY_ID ?? "";
  const privateKeyPem = (process.env.KALSHI_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const timestampMs = Date.now().toString();
  // Strip query params from path before signing
  const pathOnly = path.split("?")[0];
  const msgString = timestampMs + method.toUpperCase() + pathOnly;

  const sign = createSign("SHA256");
  sign.update(msgString);
  sign.end();
  const signature = sign.sign(
    { key: privateKeyPem, padding: 6, saltLength: 32 }, // 6 = RSA_PKCS1_PSS_PADDING, saltLength=digest=32
    "base64"
  );

  return {
    "Content-Type": "application/json",
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestampMs,
    "KALSHI-ACCESS-SIGNATURE": signature,
  };
}

// Parse team names from Kalshi position titles like:
//   "Cincinnati vs Miami: Total Runs"
//   "A's vs New York Y: Spread"
//   "Detroit vs Minnesota: Total Runs"
function parsePositionTitle(title: string): { away: string; home: string; market: string } | null {
  // Format: "Away vs Home: Market Type"
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
    const positions = rawPositions.map((p: any) => {
      const title = p.market_title ?? p.title ?? "";
      const parsed = parsePositionTitle(title);
      const isTotal = /total/i.test(title);
      const isSpread = /spread/i.test(title);
      const side = p.position ?? p.side ?? "yes"; // "yes" or "no"

      // Post-March 2026 migration: prices are dollar strings like "0.6500"
      const avgPrice = parseFloat(p.average_price ?? p.avg_price ?? "0");
      const contracts = parseInt(p.total_held ?? p.quantity ?? "0");
      const cost = parseFloat(p.total_cost ?? p.cost ?? "0") || +(avgPrice * contracts).toFixed(4);
      const payout = contracts; // $1 per contract if wins
      const marketValue = parseFloat(p.market_value ?? "0") || +(parseFloat(p.last_price ?? "0") * contracts).toFixed(4);

      return {
        ticker: p.market_ticker ?? p.ticker ?? "",
        title,
        away: parsed?.away ?? "",
        home: parsed?.home ?? "",
        market_type: isTotal ? "total" : isSpread ? "spread" : "other",
        side,                             // "yes" or "no"
        contracts,
        avg_price: avgPrice,              // e.g. 0.4775
        cost,                             // dollars paid
        payout_if_right: payout,          // dollars if win
        market_value: marketValue,
        unrealized_pnl: +(marketValue - cost).toFixed(2),
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
