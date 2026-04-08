/**
 * NCAA Baseball Thresholds — Single source of truth
 * All NCAA baseball pages import from here.
 */

export const SPORT_LABEL = "NCAA Baseball";
export const SPORT_ACCENT = "#1a7a8a";
export const SPORT_ACCENT_LIGHT = "#e6f0f2";

// ── Spread (ATS) Thresholds ─────────────────────────────────
export const MIN_EDGE = 1.0;            // minimum edge for any pick (runs)
export const FREE_EDGE_LIMIT = 3.0;     // premium threshold (runs)
export const MAX_EDGE = 5.0;            // cap — edges above this excluded from record
export const JUICE = -110;

// ── O/U Thresholds ──────────────────────────────────────────
export const OU_MIN_EDGE = 1.0;
export const OU_FREE_EDGE_LIMIT = 3.0;
