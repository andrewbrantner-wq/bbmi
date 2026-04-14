/**
 * NCAA Baseball Thresholds — Single source of truth
 * All NCAA baseball pages import from here.
 */

export const SPORT_LABEL = "NCAA Baseball";
export const SPORT_ACCENT = "#1a7a8a";
export const SPORT_ACCENT_LIGHT = "#e6f0f2";

// ── Spread (ATS) Thresholds ─────────────────────────────────
export const MIN_EDGE = 0.5;            // minimum edge for free picks (Phase 2: 55.9% @0.5)
export const FREE_EDGE_LIMIT = 2.0;     // premium threshold (Phase 2: 58.1% on 668 picks)
export const MAX_EDGE = 4.0;            // cap — edges above this excluded from ATS record
export const JUICE = -110;

// ── O/U Thresholds ──────────────────────────────────────────
export const OU_MIN_EDGE = 1.0;
export const OU_FREE_EDGE_LIMIT = 3.0;
export const OU_MAX_EDGE = 5.0;         // O/U keeps the 5.0 cap (≥4 bucket still profitable)
