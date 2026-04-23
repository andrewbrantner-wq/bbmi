> **[Note, 2026-04-23]:** This audit was performed 2026-04-22 against
> the v2 canonical (`2b3d877f…`). The v2.1 release on 2026-04-21
> supersedes some of the product performance numbers cited in §2.5
> (e.g., Away +1.5 has since updated to 64.32% / 199 picks). The
> canonical record count cited as "9,734 games" is more precisely
> 4,866 records / 9,732 team-games (the 9,734 figure was an imprecise
> reading of the team-game count from a docs source). For current
> canonical state see `workstream_a/canonical_baseline/CANONICAL_PIN.md`;
> for current product numbers see `docs/model_v2/release_manifest.md`
> and `docs/product_audits/mlb_audit_2026-04.md`. This audit's
> structural findings (data inventory, pipeline architecture, gap
> analysis) remain valid; only specific performance numbers may be
> stale.

---

# MLB Modeling — Audit Report

**Date produced:** 2026-04-22
**Scope:** Read-only audit of existing MLB data and model code. No files modified outside `./analysis/`.
**Working directory:** `c:/Users/andre/dev/my-app`

---

## 0. Upfront honest corrections

Two things to set straight before the audit:

1. **The current approach is not "traditional regression."** The deployed model is a hand-tuned **Negative Binomial run-expectancy engine** (`mlb_mvm.py`). It calls `scipy.special.gammaln` and `scipy.stats` directly. There is **no `sklearn`, `statsmodels`, `xgboost`, or `torch` import anywhere in the MLB pipeline**. There is no gradient fit, no regularized regression, no cross-validated hyperparameter search. Coefficients (HCA = 0.02, K_FIP = 48, park factors, dispersion-by-bin = 1.16/1.03/1.70, wOBA slope = 29.05) are either empirically derived from 2024–2025 walk-forward residuals or hand-set from external research. If we discuss "changing the model," the current baseline is a parametric scoring engine, not a regression.
2. **The MLB pipeline is not in this repo.** `c:/Users/andre/dev/my-app/src/data/` holds only the JSON artifacts that the Next.js frontend consumes. The model code, caches, and snapshots live at `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/`. Any modeling work happens there; this repo is downstream.

## 0.1 Location map

| What | Where |
|---|---|
| Model code (Python) | `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/*.py` |
| Pipeline caches (source of truth for features) | `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/cache/` |
| Daily odds snapshots | `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/snapshots/` |
| Walk-forward records | `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/analysis/walkforward_records.json` |
| Docs (audits, validation specs, research notes) | `C:/Users/andre/BoundScraper/docs/` |
| Published frontend artifacts | `c:/Users/andre/dev/my-app/src/data/` |

---

## 1. DATA INVENTORY

### 1.1 Frontend artifacts — `c:/Users/andre/dev/my-app/src/data/`

These are **outputs** of the pipeline, consumed by the Next.js app. They are not inputs to the model.

| File | Size | Shape | Records | Date range | Granularity |
|---|---|---|---|---|---|
| `betting-lines/mlb-games.json` | 1.1 MB | array of objects | 2,430 games | 2026-03-25 → 2026-04-22 | game-level |
| `betting-lines/ml-snapshots.json` | 2 B | `{}` | 0 | — | **empty placeholder** |
| `betting-lines/injuries.json` | 61 KB | object keyed by team | 221 teams | — | **college basketball only — no MLB rows** |
| `rankings/mlb-rankings.json` | 20 KB | object keyed by team | 30 teams | 2026 snapshot | team-season |
| `mlb-playoff-probs.json` | 17 KB | `{meta, results}` | 30 teams | 2026-04-22 (`updated_at`) | team-season projection |
| `mlb-boxscores.json` | 623 KB | unknown | **unreadable / 0 lines** | — | flag for investigation |

**Sample — `mlb-games.json`:**
```
{
  gameId, date, gameTimeUTC,
  homeTeam, awayTeam,
  actualHomeScore, actualAwayScore,
  (+ BBMI projections, Vegas odds, pick, edge, confidence tier)
}
```

**Sample — `mlb-rankings.json` (Yankees):**
```
wins 14, losses 9, games_played 23,
woba_raw, woba_neutral, blended_woba, ops, obp, slg, runs_per_game,
fip 3.41, era, whip, k_per_9, runs_allowed_per_game,
park_factor 1.03, off_rating, pit_rating,
bbmi_score 111.5, pyth_win_pct, model_rank 3
```

**Sample — `mlb-playoff-probs.json` (Braves):**
```
current_wins 16, current_losses 8,
projected_wins, projected_wins_10th, projected_wins_90th,
playoff_pct 0.991, division_pct 0.989, wildcard_pct, lds_pct, lcs_pct, ws_pct,
champion_pct 0.090, division, league
```
Metadata: `n_simulations = 10,000`, `games_remaining = 2,076`.

### 1.2 Pipeline caches — `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/cache/`

These are the actual inputs the model reads.

| File | Size | Shape | Records | Date range | Granularity |
|---|---|---|---|---|---|
| `mlb_team_stats_{2019..2026}.json` (8 files) | ~33 KB each | array | 30 teams × 8 = 240 | 2019 → 2026 | team-season |
| `mlb_game_scores_{2022..2026}.json` (5 files) | ~369 KB (full yr), 8.6 KB (2026 YTD) | array | ~2,430 / full season | 2022 → 2026 | game-level (final scores) |
| `pitcher_game_logs_{2022..2026}.json` (5 files) | 4.6–17 MB, 3.0 MB (2026 YTD) | array with nested per-pitcher | ~2,430 games × dozens of pitchers | 2022 → 2026 | pitcher-appearance per game |
| `historical_odds_cache.json` | **162 MB** (largest) | object keyed by `"YYYY-MM-DD_HH"` | tens of thousands of bookmaker snapshots | 2024-03-18 → present | hourly × game × ~15–20 books |
| `team_xwoba_{2022..2025}.json` (4 files) | ~7 KB | array | 30 teams | 2022 → 2025 | team-season Statcast |
| `team_oaa_{2022..2025}.json` (4 files) | ~5.8 KB | array | 30 teams | 2022 → 2025 | team-season defense |
| `game_catchers_{2024,2025}.json` | ~598 KB | array | 2,670 / yr | 2024–2025 | game-level catcher assignment |
| `catcher_framing_{2024,2025}.json` | 297 KB | object keyed by `gamePk` | 2,430 / yr | 2024–2025 | game-level framing tier {elite, average, poor} |
| `opener_flags_{2024,2025}.json` | 1.1 MB | array | 2,464 / yr | 2024–2025 | game-level opener classification |
| `pitcher_stats_cache_{2024,2025}.json` | ~35 KB | object keyed by team | 30 teams × pitchers | 2024–2025 | pitcher-season |
| `mlb_monthly_scoring_{2024,2025}.json` | 496 B | object keyed by month | 6 buckets/yr | 2024–2025 | league-month RPG |
| `mlb_standings_2026.json` | 5.7 KB | object keyed by team | 30 teams | 2026 snapshot | team-division standings |
| `mlb_schedule_remaining_2026.json` | 288 KB | array | 2,076 games | 2026-04-22 → ~2026-10-04 | future game-level |
| `mlb_playoff_probs_2026.json` | 17 KB | mirrors frontend file | 30 teams | 2026 | team-season projection |

**Notable omissions inside files:**
- `pitcher_game_logs` tracks IP, ER, R, H, BB, K, HR, pitches, decision — **no entry inning, no score-at-entry, no leverage**. This is the deferred "Phase 3 data pipeline enhancement" per `docs/product_audits/mlb_audit_2026-04.md`.
- `team_xwoba` / `team_oaa` end at 2025 — **no 2026 file yet**. 2026 predictions that use these must either wait or fall back to 2025 carry-over.

### 1.3 Daily odds snapshots — `C:/Users/andre/BoundScraper/bbmi_pipeline/MLB/snapshots/`

- `mlb_odds_2026-03-30.json` → `mlb_odds_2026-04-22.json` (24 files)
- `mlb_odds_master.json` (191 KB, consolidated)
- Sizes: 13 KB – 455 KB per day
- Granularity: intra-day (morning/afternoon/night) × game × per-book
- Fields per game: `spread`, `spread_home_odds`, `spread_away_odds`, `home_ml`, `away_ml`, `total`, `over_odds`, `under_odds`, `implied_home_win_prob`, `num_bookmakers`, `all_books` (FanDuel, DK, Caesars, BetMGM, Fanatics, Fliff, BetOnline, Lowvig, ReBet, MyBookie, EspnBet, …)
- **Season started 2026-03-25; snapshots start 2026-03-30 — ~5 days of 2026 games have no snapshot trail.**

### 1.4 Data-class coverage matrix (the classes you flagged)

| Class | Status | Evidence / Notes |
|---|---|---|
| **Betting lines — opening** | **PARTIAL** | `mlb_odds_snapshot.py` captures "opening" as noon-ET snapshot for evening games, 8 AM for day games. Lines before that cutoff are not stored. |
| **Betting lines — closing** | **NOT EXPLICITLY TAGGED** | `historical_odds_cache.json` has hourly snapshots. The last snapshot before first pitch *can be derived* but no field says "closing." No CLV tracking exists today. |
| **Weather** | **EFFECTIVELY MISSING** | `build_weather_component.py` uses *monthly city averages* as a temperature proxy. No real per-game wind/humidity/pressure historical. Temperature was turned **OFF** in the canonical walk-forward because the proxy was contaminating residuals. Wrigley monthly PF is the only live weather-adjacent feature; its walk-forward lookup is broken (gamePk key mismatch) and deferred. |
| **Ballpark** | **PARTIAL** | One scalar per park in `mlb_mvm.py:DEFAULT_PARK_FACTORS` + `park_factor` on each team in `mlb-rankings.json`. 13 parks were Bayesian-shrunk on 2024–2025 residuals on 2026-04-20. **No** park dimensions, wall heights, foul territory, or batted-ball-type (GB/FB/LD) factors. |
| **Umpires** | **MISSING** | No file contains home-plate ump assignments or ump tendency stats. |
| **Lineups** | **PARTIAL** | `game_catchers_*` records the catcher; `pitcher_game_logs_*` records starters. **No positions 1–9, no handedness splits, no late scratches, no projected lineup.** |
| **Bullpen usage** | **PARTIAL** | Per-appearance IP/pitches/decisions in `pitcher_game_logs_*`. **No pre-computed** rest-day, trailing-N pitch count, "closer unavailable" flag, or entry inning. Phase 2 Layer 3 (fatigue) was investigated and rejected (corr 0.003); Layer 4 (leverage) is deferred pending Gameday data. |
| **Statcast metrics** | **PARTIAL — aggregate only** | Team-season xwOBA/xBA/xSLG (`team_xwoba_*`) and team-season OAA/FRV (`team_oaa_*`). **No pitch-level, no exit velocity/barrel, no stuff+/pitching+/CSW%, no player-level xwOBA, no xERA.** |
| **Travel / rest** | **MISSING (derived)** | Game dates and venues exist, but no derived features: miles traveled, rest days, timezone change, back-to-back, coast-to-coast flag, altitude change. Phase 2 Priority 3 investigation ran residuals and found road-trip-length not significant (p=0.207, N=1,830). |

---

## 2. CURRENT MODEL

### 2.1 What is actually predicted

Three outputs, all truly modeled (not display-only):

- **Moneyline / win probability** — `mlb_mvm.py:nb_win_prob()` (line 227). Integrates two independent NB distributions over all score pairs; ties split 53% home (`HOME_TIE_SHARE`).
- **Total runs** — `project_game()` (line 310). Sum of two team projected runs.
- **Run-line spread** — `compute_run_line_probs()` (line 254). Monte Carlo over margin distribution; alternate lines at ±0.5, ±1.5, ±2.5, ±3.5.

### 2.2 Algorithm and library

**Custom Negative Binomial scoring engine** — not ML, not regression in the training sense.

- **Engine:** two independent NB distributions (one per team) with **conditional dispersion**:
  - low total (<7.5): dispersion index **1.16**
  - med total (7.5–9.5): **1.03**
  - high total (>9.5): **1.70**
  - `r = mu / (disp_index − 1)`, implemented via `scipy.special.gammaln` for numerical stability.
- **Projected runs per team:**
  `projected_runs = league_avg_rpg × (effective_team_FIP / league_avg_FIP)`
  with effective FIP a classical credibility blend: `w = gp / (gp + K_FIP)`, `K_FIP = 48` (Model v2, deployed 2026-04-20; replaces the legacy `max(0.10, gp/162 × 0.67)`).
- **Libraries:** `numpy`, `scipy.stats`, `scipy.special.gammaln`. That is it.
- **No training step.** No gradient descent, no regularization, no CV loop.

### 2.3 Inputs (features) used pre-game

Core (always on):

1. **Team pitching FIP — current season** (from `pit_data_loader.get_team_fip`, point-in-time).
2. **Team pitching FIP — prior year** (shrinkage blend partner).
3. **Park factor** (hardcoded `DEFAULT_PARK_FACTORS` + 13 recalibrated 2026-04-20 + Wrigley monthly PF live).
4. **League average R/G** (trailing 30-day re-anchoring window).
5. **Home-field advantage** (constant +0.02 runs, empirically derived from 2024–2025 residuals — the pre-correction value of 0.30 was an unvalidated transfer and was 6× too high).

Conditional (Away Ace tier only):

6. **Individual pitcher trailing FIP** — `pitcher_fip_model.get_pitcher_trailing_fip(..., as_of_date)`. Used strictly for the Away Ace qualifier (FIP < 3.25 union with team tier).

Derived / upstream:

7. **wOBA → R/G offense calibration** blended 50/50 with pitcher-based projection (α = 0.50). PIT via `calibration_offense.py`.

Turned OFF in the canonical walk-forward (either silent-off due to bugs or explicitly disabled):

- Catcher framing tier (key mismatch → zero; feature idle)
- Bullpen ERA component (cancelled — Phase 2 Layer 2, found to add −4.5 pp integration noise)
- Weather temperature (was contaminating residuals; removed)
- Wrigley wind (key mismatch in walk-forward; live pipeline only)

### 2.4 Training / evaluation

- **No training.** Coefficients are set by hand or empirically from walk-forward residuals.
- **Evaluation window:** 2024–2025 only (`modern rules era`). 2022 is pre-pitch-clock, 2023 is transitional; both excluded from canonical validation.
- **Point-in-time enforcement:** `pit_data_loader.py` accepts `as_of_date` on every query; walk-forward never reaches live endpoints.
- **Canonical walk-forward:** 9,734 games (2024–2025). SHA256 `185e921918767742bf279bd47df1efbedf5350d6ddf7f4c4d32c1414403fd88f`. Stored at `analysis/walkforward_records.json`.
- **Metrics tracked:** ATS%, ROI at per-product juice, per-season and per-half-season splits, traditional-vs-opener splits, confidence-tier calibration buckets (Elite 8+, Premium 6–7, Standard).

### 2.5 Stored predictions and backtest results

Files that contain performance evidence:

- `analysis/walkforward_records.json` — 9,734-row single source of truth for all product claims.
- `mlb_spread_audit.csv`, `mlb_totals_audit.csv` — daily append-only live audits since 2026-03-30.
- `c:/tmp/mlb_ou_seasonal_analysis.json` — seasonal breakdown.
- `docs/product_audits/mlb_audit_2026-04.md` — latest production audit summary.
- `analysis/MLB_Phase1_Research_Report.md` (2026-03-30) — **historical record; many numbers superseded, see below.**

#### Performance — current state vs Phase 1 claims

**Important:** The Phase 1 Research Report (2026-03-30) has been materially revised by the April 2026 audit cycle and the 2026-04-20 v2 release. Report against v2 numbers when talking about current products.

| Product | Phase 1 claim | Current (v2, 2026-04-20) | Status |
|---|---|---|---|
| Home -1.5 | 63% ATS (claim) | 54.7% on modern data, 1–8 live | **KILLED** (number came from a 2022–23 subset) |
| General Under (edge ≥ 0.83) | 56.7% / 630 / +8.2% ROI | 51.9–53.6% on canonical | **PAUSED** (below deployment standard) |
| Both-Bad-Starters Under | 61.0% / 41 picks | 63.7% / 80 picks | **REDEPLOYED** (fixed force-Over bug) |
| Over (Jun+, edge ≥ 1.5) | — | **67.21% / 122 picks** | **LIVE** (corrected filter) |
| Away +1.5 (underdog) | 69.4% / 1,897 / +13.8% ROI | **65.31% / 516 picks at margin ≥ 0.20** | **LIVE** (correct-side grading, v2) |
| Away Ace (FIP < 3.25) | 81.2% / 85 picks (team-FIP) | 83.7% / 86 picks (indiv-FIP union w/ team tier) | **LIVE** |
| Moneyline underdog | — | — | Never validated; market efficient at current juice |

Live 2026 season (small-n, through 2026-04-22): Away +1.5 73.7% / 19 picks; Away Ace 83.3% / 12 picks. Pre-specified pull thresholds exist (BBS Under review at 20 games / pull at 40 games if < 55%).

The Phase 1 headline numbers are still cited in places — worth a sweep for staleness before any public-facing revision.

---

## 3. DATA QUALITY NOTES

### 3.1 Point-in-time / leakage risks

- **Historical team stats are end-of-season snapshots, not PIT.** `pit_data_loader.get_team_fip` carries an explicit in-source warning: "HISTORICAL (prior seasons): the cache holds end-of-season team stats… which is NOT a valid point-in-time input for walk-forward analysis and will leak future data." The walk-forward *mitigates* this via `real_pit_revalidation.py`, which recomputes FIP from game-by-game box scores strictly before the prediction date. **If that mitigation is ever bypassed (e.g., a new analysis script reads team_stats directly), it is leakage.**
- **Wrigley wind feature — silent off in walk-forward** due to a `gamePk` vs constructed-id key mismatch. The live pipeline uses the live weather API. The walk-forward therefore understates any legitimate wind signal. Classified as deferred fix.
- **Catcher framing — same silent-off bug.** Feature is effectively zero in the 2024–2025 canonical.
- **Closing-line selection.** Snapshots are hourly; "closing" is not labeled. If anyone grabs an arbitrary snapshot as a feature it may post-date first pitch → leakage.
- **No obvious leakage found** in model inputs that are used: individual pitcher trailing FIP uses `as_of_date`; park factors are static; HCA is constant; opening lines are fetched before first pitch.

### 3.2 Regime-break handling (2023+)

Policy is explicit in `docs/product_audits/mlb_audit_2026-04.md`:

> "MLB: 2024 forward (modern rules era — pitch clock, shift restrictions, expanded bases). 2022 is pre-pitch-clock; 2023 is transitional. Pooling across rule eras produces misleading results."

Operationally:

- Canonical walk-forward window: **2024–2025 only** (9,734 games).
- Pre-2023 pitching metrics (FIP, ERA, WHIP, K-BB%) treated as rule-invariant and usable as prior-year blend partners.
- Pre-2023 contact-based offense (BA, BABIP, OBP, SB): **2023 = Year 0**, pre-2023 excluded.
- wOBA: −0.019 cross-break drop; pre-2023 down-weighted 2:1.
- **Confirmed kill due to regime pooling:** Home -1.5 (63% claim sourced from a 2022–23 subset; actual 54.7% on modern data).

### 3.3 Missing values, empty files, duplicates

- `mlb-boxscores.json` — 623 KB on disk but reports 0 readable lines. Either empty or malformed. **Investigate before relying on it.**
- `ml-snapshots.json` — 2 bytes (`{}`). Unused placeholder.
- `injuries.json` — college basketball only. **No MLB injury data anywhere in the repo.**
- `mlb_monthly_scoring_*` stops at 2025; no 2026 file.
- `team_xwoba_*` and `team_oaa_*` stop at 2025; no 2026 file. Any 2026 model run that wants Statcast aggregates must either wait on a scrape or hold prior-year carry.
- `historical_odds_cache.json` starts 2024-03-18. Any 2022/2023 odds analysis required for regression-style training doesn't exist yet.
- Daily snapshots start 2026-03-30 (season started 2026-03-25 — 5-day gap at season start).

### 3.4 Suspicious distributions / date gaps

- Monthly projection residual (from Phase 2 Priority 3 investigation, N=4,866):

  | Month | N | Mean error | p |
  |---|---|---|---|
  | Apr | 788 | +0.77 | 0.0004 |
  | May | 822 | +0.73 | 0.0014 |
  | Jun | 799 | +0.37 | 0.33 |
  | Jul | 739 | −0.35 | 0.0004 |
  | Aug | 837 | −0.27 | 0.0022 |
  | Sep | 759 | −0.10 | 0.045 |

  The trailing 30-day re-anchoring window lags seasonal scoring shifts. Documented as a known property of the architecture, not a bug.

- Under-pick selection bias in 2024 Jul–Sep (−2.06 runs on the selected subset vs. −0.18 on all games) — the under product's failure mode is a *selection* problem, not a calibration problem.

### 3.5 Architectural risks

- **No training step means the threshold sweep is the only optimization path.** Each product was tuned by sweeping edge thresholds post-hoc on 2024–2025. This is a form of researcher-degrees-of-freedom overfitting that walk-forward gates partially but do not fully guard against. Out-of-sample behavior lives entirely in 2026 onward.
- **Investigation graveyard.** 10+ investigation scripts (`mlb_*_investigation.py`) have run: bullpen, weather, rest/travel, recency, xwOBA standalone, OAA, starter IP, summer, opener, defense. **Three produced production features** (wOBA calibration, park-factor recalibration, Wrigley monthly PF). The rest were neutral or rejected. The memo from `project_mlb_phase2_roadmap.md`: "Model at ceiling with current inputs" — consistent with what the inventory shows.

---

## 4. GAPS WORTH FILLING

Not in the dataset today. Ranked by expected impact on pre-game prediction of outcome / total / spread. Ranking criterion: (a) size of effect typically reported in public baseball research, (b) whether the current model can absorb the signal, (c) whether the data is obtainable. **No modeling changes proposed here; this is a data gap list.**

1. **Per-game starting-pitcher Statcast profile** — xwOBA-against, xERA, CSW%, whiff%, stuff+ / pitching+, pitch mix. The current model uses team-season FIP with a single individual-FIP gate (Away Ace). Game-level pitcher quality is the biggest single driver of run environment and is readily scrapeable from Baseball Savant.
2. **Home-plate umpire per game + ump tendencies** (called-strike rate, zone size, historical O/U). Totally absent. Umps swing totals by 0.2–0.5 runs in published studies. `umpscorecards.com` and Retrosheet cover this.
3. **Per-game actual weather** at outdoor parks — temperature, wind speed, wind direction, humidity, barometric pressure, precipitation. Current proxy is a monthly city average, which is why temperature was pulled. Open-Meteo provides free historical hourly data; geocode by venue.
4. **Starting lineups 1–9 with handedness and projected batting order.** Only the catcher is currently recorded. Platoon advantage vs a LHP/RHP starter is a known, exploitable factor and is free on the MLB Stats API hydrate parameter (`probablePitcher`, `lineup`).
5. **Bullpen availability signals** — trailing 1/2/3-day pitch counts by pitcher, "closer unavailable" flags, who pitched last night, days since last appearance. Raw data exists inside `pitcher_game_logs_*`; derived features do not.
6. **Pitcher entry state (leverage / role)** — inning at entry, score at entry, bases at entry. Phase 2 Layer 4 is explicitly deferred pending this. Requires a Gameday API pull beyond the current game-log scraper.
7. **Travel / rest / schedule features** — miles since last city, days of rest, back-to-back, coast-to-coast flag, timezone change, altitude change. Trivial to derive from existing schedule data; currently not computed. Even if the residual signal is modest, it is cheap.
8. **Closing-line snapshot per game**, explicitly labeled. Today the hourly cache can be queried, but there is no "closing" field and no CLV tracking. Needed for both a feature (closing line as a proxy for consensus wisdom) and for post-hoc evaluation (closing-line value).
9. **Park factors disaggregated** — by batted-ball type (GB/FB/LD), by handedness split, by season segment. Today: one scalar per park (+ Wrigley monthly). Known to matter for totals modeling in public research.
10. **Player-level batter Statcast** — plate-appearance or season xwOBA, barrel%, exit velocity, xSLG by handedness. Today: team-season xwOBA/xBA/xSLG only. Required input for a true lineup-vs-pitcher matchup model rather than a team-averaged one. Also free on Baseball Savant.

Runner-up (not in the top 10 but worth noting): **an MLB injury / transaction feed** (the current `injuries.json` is CBB). The MLB Stats API `/transactions` endpoint and probable-pitcher / late-scratch notices fill this at no cost.

---

## 5. Notes for the director

- "Traditional regression" does not match the implementation. If we're planning toward a real regression / ML approach, the starting baseline to beat is the NB engine at roughly its current numbers (v2 2026-04-20), not a regression model we already have.
- The only clean modern-rules validation window is 2024–2025 (9,734 games). A third out-of-sample season means either waiting for 2026 to complete or treating early-2026 live picks as provisional.
- Phase 1 Research Report numbers on the platform may still reflect pre-v2 claims (Under 56.7%, Away +1.5 69.4%). Worth a sweep for staleness before any public revision.
- Historical team stats cache is not PIT. Any new analysis must go through `real_pit_revalidation.py` or re-derive from game logs — otherwise it leaks.
- The top three data gaps (per-game starter Statcast, home-plate ump, real weather) are all free or near-free to scrape. If the goal is to lift the current ceiling before revisiting architecture, these are the cheapest shots.

---

*End of audit. This document summarizes read-only findings. No pipeline or data files were modified.*
