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
export const OU_MIN_EDGE = 1.00;          // minimum edge for UNDER picks
export const OVER_MIN_EDGE = 1.50;        // minimum edge for OVER picks (raised from 1.0, April 2026)
                                          // Walk-forward: 54.1% at 1.50 vs 51.7% at 1.00
export const OU_STRONG_EDGE = 1.25;       // strong tier / free-premium split (unders)
export const OU_PREMIUM_EDGE = 1.50;      // premium tier
export const OU_JUICE = -110;             // standard O/U juice for ROI calc
export const OVER_HIGH_TOTAL_CUTOFF = 9.0;  // suppress overs when posted total >= 9.0
export const OVER_LOW_TOTAL_CUTOFF = 7.0;   // ELITE boost for overs when posted total < 7.0

// ── Run Line Thresholds (away +1.5 only — home -1.5 discontinued 2026-04-16) ──
export const RL_MIN_MARGIN_AWAY = 1.00;   // minimum margin for away +1.5 pick (non-ace)
export const RL_MIN_MARGIN_HOME = 1.10;   // DISABLED — home -1.5 discontinued
export const RL_STRONG_MARGIN = 1.15;     // legacy — kept for backward compat
export const RL_PREMIUM_MARGIN = 1.25;    // legacy — kept for backward compat
export const RL_JUICE = -156;             // legacy median — fallback only; prefer rlJuiceForHomeML()
export const RL_BASE_RATE = 64.0;         // away +1.5 MLB base rate

// Home-favorite exclusion boundary (picks generated but not surfaced to subscribers)
export const RL_HOME_FAV_CUTOFF = -120;   // exclude picks where homeML < -120

/**
 * Regime-keyed juice for away +1.5 picks (static v1 approximation).
 *
 * Derived from MLB_Phase1_Research_Report.md:
 *   "ROI at -180 juice (heavy favorites): +8.0%"
 *   "ROI at -140 juice: +23.9%"
 *   "ROI at median -156 juice: +13.8%"
 *
 * This is a STATIC APPROXIMATION — per-game juice capture is a v2 ticket.
 * When alt-line juice data starts flowing from the pipeline, replace this
 * lookup with the actual juice from posted odds.
 *
 * Home-favorite regime (homeML < RL_HOME_FAV_CUTOFF) is excluded from the
 * subscriber product by the pipeline guardrail, so those picks should not
 * reach this function in practice. The fallback case returns -160.
 */
export function rlJuiceForHomeML(homeML: number | null | undefined): number {
  if (homeML == null) return RL_JUICE;     // fallback median when odds unavailable
  if (homeML > 200) return -180;           // away heavy fav — alt line, expensive
  if (homeML >= -120) return -160;         // away mild/moderate fav + near pick'em
  return -160;                             // home-fav regime (excluded upstream; safety fallback)
}

/**
 * Alt-line detection. "Away +1.5" is an alt run line when the away team is
 * the Vegas favorite (homeML > 0). In that regime the standard run line is
 * away -1.5; subscribers need the alt market at their sportsbook to place
 * the pick. Annotate in the display so they know what to search for.
 *
 * Returns false for home -1.5 picks (not applicable — retired product).
 */
export function isRLAltLine(homeML: number | null | undefined, rlPick: string | null | undefined): boolean {
  if (!rlPick || !rlPick.includes("+1.5")) return false;
  return homeML != null && homeML > 0;
}

// ── Both-Bad-Starters Qualifier ─────────────────────────────
export const BOTH_BAD_FIP_THRESHOLD = 4.50;
export const BOTH_BAD_OU_EDGE = 1.00;

// ── Individual Ace Qualifier ────────────────────────────────
export const IND_ACE_FIP_THRESHOLD = 3.25;
