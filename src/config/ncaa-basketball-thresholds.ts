/**
 * NCAA Basketball Thresholds — Single source of truth
 * All NCAA basketball pages import from here.
 */

export const SPORT_LABEL = "NCAA Basketball";
export const SPORT_ACCENT = "#4a6fa5";
export const SPORT_ACCENT_LIGHT = "#e8eef6";

// ── Spread (ATS) Thresholds ─────────────────────────────────
export const MIN_EDGE = 2;              // minimum edge for any pick (pts)
export const FREE_EDGE_LIMIT = 6;       // premium threshold (pts)
export const JUICE = -110;

// ── O/U Thresholds (same as spread for basketball) ──────────
export const OU_MIN_EDGE = 2;
export const OU_FREE_EDGE_LIMIT = 6;
