/**
 * MLB Model Thresholds — Single source of truth
 *
 * All MLB pages (picks, accuracy, homepage, betting tool) import from here.
 * Change a threshold once and it propagates everywhere.
 *
 * These must match the pipeline constants in:
 *   BoundScraper/bbmi_pipeline/MLB/mlb_daily_pipeline.py
 */

// ── O/U Thresholds ──────────────────────────────────────────
export const OU_MIN_EDGE = 1.00;          // minimum edge for any O/U pick
export const OU_STRONG_EDGE = 1.25;       // strong tier / free-premium split
export const OU_PREMIUM_EDGE = 1.50;      // premium tier
export const OU_JUICE = -110;             // standard O/U juice for ROI calc

// ── Run Line Thresholds ─────────────────────────────────────
export const RL_MIN_MARGIN_AWAY = 1.00;   // minimum margin for away +1.5 pick
export const RL_MIN_MARGIN_HOME = 1.10;   // minimum margin for home -1.5 pick
export const RL_STRONG_MARGIN = 1.15;     // strong tier
export const RL_PREMIUM_MARGIN = 1.25;    // premium tier / free-premium split
export const RL_JUICE = -156;             // median away +1.5 juice
export const RL_BASE_RATE = 64.0;         // away +1.5 MLB base rate

// ── Both-Bad-Starters Qualifier ─────────────────────────────
export const BOTH_BAD_FIP_THRESHOLD = 4.50;
export const BOTH_BAD_OU_EDGE = 1.00;

// ── Individual Ace Qualifier ────────────────────────────────
export const IND_ACE_FIP_THRESHOLD = 3.25;
