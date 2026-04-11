/**
 * NCAA Football Thresholds — Single source of truth
 * All NCAA football pages import from here.
 *
 * Walk-forward validated 2026-04-10:
 *   55.9% ATS overall (2 seasons, 1,548 games, 0.0pt overfitting gap)
 *   Free tier (5+/21):  ~58-60% ATS, ~400 games/season
 *   Premium tier (6+/14): 62.4% ATS, ~300 games/season
 */

export const SPORT_LABEL = "NCAA Football";
export const SPORT_ACCENT = "#6b7280";
export const SPORT_ACCENT_LIGHT = "#f0f1f3";

// ── Spread (ATS) Thresholds ─────────────────────────────────
export const MIN_EDGE = 5;              // minimum edge for any pick (pts) — below 5 is sub-50% noise
export const FREE_EDGE_LIMIT = 6;       // premium threshold (pts) — 62.4% ATS across 2 seasons
export const MAX_SPREAD = 21;           // free tier spread cap — 14-21 still 58.5% ATS, drops at 28+
export const MAX_SPREAD_PREMIUM = 14;   // premium tier spread cap — tightest filter, 62.4% ATS
export const JUICE = -110;

// ── O/U Thresholds (display-only, no recommended picks) ─────
export const OU_MIN_EDGE = 0;           // show all O/U games (display-only)
export const OU_FREE_EDGE_LIMIT = 6;    // not used for picks, retained for edge table breakpoints
