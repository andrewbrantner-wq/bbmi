/**
 * NFL Thresholds — Single source of truth
 * All NFL pages import from here.
 *
 * Product: Totals only (spreads are display-only).
 * Validated: 56.0% ATS on 366 picks across 4 seasons [2.5, 7.0] band.
 */

export const SPORT_LABEL = "NFL";
export const SPORT_ACCENT = "#013369";        // NFL blue
export const SPORT_ACCENT_LIGHT = "#e8edf4";

// ── Totals (O/U) Thresholds — the product ──────────────────
export const OU_MIN_EDGE = 2.5;              // minimum edge for qualifying pick (points)
export const OU_STRONG_EDGE = 4.0;           // strong tier
export const OU_PREMIUM_EDGE = 5.5;          // premium tier
export const OU_MAX_EDGE = 7.0;              // cap — extreme edges excluded from record
export const OU_JUICE = -110;

// ── Spread Thresholds — display only ───────────────────────
export const SPREAD_MIN_EDGE = 2.0;          // display threshold
export const SPREAD_STRONG_EDGE = 3.0;
export const SPREAD_PREMIUM_EDGE = 4.0;
export const SPREAD_JUICE = -110;
