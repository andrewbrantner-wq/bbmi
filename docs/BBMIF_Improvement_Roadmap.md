# BBMIF Model V2 — Implementation Roadmap
## Response to Vegas Risk Critique (March 2026)

---

## Priority Matrix

| # | Issue | Severity | Phase | Effort | Data Available? |
|---|-------|----------|-------|--------|----------------|
| 1 | Mid-season accuracy collapse (Bayesian blending) | CRITICAL | 1 | Medium-High | Yes (existing) |
| 2 | Opponent-adjust box score stats | CRITICAL | 1 | Medium | Yes (SP+ already fetched) |
| 3 | Over/under model rebuild (PPP) | HIGH | 3 | High | Yes (ESPN box scores) |
| 4 | Diversify away from 76% SP+ | HIGH | 3 | High | FPI: free ESPN API; Elo: derived |
| 5 | Variable STD_DEV for win probability | HIGH | 2 | Low-Medium | Yes (historical games) |
| 6 | Injury modeling | HIGH | 3 | Medium | ESPN injuries API (free) |
| 7 | Z-score normalization (replace percentile ranks) | HIGH | 2 | Medium | Yes (existing stats) |
| 8 | Blowout compression | MODERATE | 1 | Low | N/A |
| 9 | Home bias root cause | MODERATE | 2 | Low-Medium | Yes (existing) |
| 10 | Bye week bonus reduction | MODERATE | 1 | Very Low | N/A |
| 11 | Coaching change registry | MODERATE | 4 | Low | Manual curation |
| 12 | Situational tags (rivalry, letdown, trap) | MODERATE | 4 | Medium | Manual + schedule |
| 13 | Empirical altitude adjustments | MODERATE | 4 | Low | Elevation data |
| 14 | Continuous weather model | LOWER | 2 | Low | Yes (Open-Meteo) |
| 15 | Advanced stats (explosiveness, havoc, red zone, penalties) | LOWER | 3 | Medium | CFBD advanced stats API |
| 16 | Neutral-site proximity HFA | LOWER | 4 | Medium | CFBD lat/lon + venue table |
| 17 | Transfer portal impact | LOWER | 4 | Medium | Manual / 247Sports |
| 18 | CLV tracking as primary metric | LOWER | 4 | Low | Odds API historical |
| 19 | Multi-season calibration (3 years) | LOWER | 4 | High | CFBD/ESPN historical APIs |
| 20 | K-fold cross-validation | LOWER | 4 | High | N/A (methodology change) |

---

## PHASE 1: Critical Fixes (Weeks 1-2)
*Target: Fix the 52% ATS mid-season collapse before 2026 season*

### 1.1 Opponent-Adjust Box Score Stats [UNBLOCKS EVERYTHING]

**Problem:** `calculate_weighted_cfb_stats()` computes raw differentials like `ypp_diff = my_ypp - opp_ypp`. A team with 7.0 YPP against Kansas has the same value as 7.0 YPP against Georgia. Mixing these unadjusted stats with opponent-adjusted SP+ contaminates the signal.

**Solution:** For each game, scale the raw stat by opponent strength:
```python
opp_sp_def = sp_ratings[opponent]["sp_defense"]
fbs_avg_def = median(all sp_defense values)
opp_factor = fbs_avg_def / opp_sp_def
adjusted_ypp = raw_ypp * opp_factor
```

**Where to change:** `calculate_weighted_cfb_stats()` (~line 1864). After parsing box scores, look up opponent SP+ ratings and apply adjustment factor to `ypp_diff`, `turnover_margin`, `third_down_diff`, `pass_eff_diff`.

**Data:** SP+ ratings already fetched via CFBD API. No new data needed.

### 1.2 Bayesian Phase Blending [FIXES THE COLLAPSE]

**Problem:** Single set of stat weights all season. Box scores enter at full weight starting week 4, but 3-4 games of data is pure noise. The model goes from 83% (pure SP+) to 52% (SP+ contaminated with noise).

**Solution:** New function `get_phase_weights(current_week)` that returns dynamic stat weights:

| Phase | Weeks | SP+ Weight | Box Score Weight | Rationale |
|-------|-------|-----------|-----------------|-----------|
| 1 | 1-4 | 90-95% | 0-5% | SP+ preseason is the strongest early signal |
| 2 | 5-8 | Linear 90%→50% | Bayesian increase 5%→40% | Gradual transition, quality-weighted |
| 3 | 9+ | 40-50% | 40-50% | In-season data now reliable |

**Where to change:** `calculate_bbmif()` (~line 2300) — accept `current_week`, call `get_phase_weights()` to override `STAT_CONFIG` weights. `run_rolling_backtest()` already processes week-by-week, just pass `week_num` through.

**Critical detail from critique:** The box score stats that enter Phase 2-3 MUST be opponent-adjusted (Item 1.1). This is why 1.1 must be done first.

### 1.3 Bye Week Bonus Reduction [TRIVIAL]

**Current:** `BYE_WEEK_BONUS = 2.5` pts. Research shows 1.0-1.5 is accurate.

**Fix:**
```python
BYE_WEEK_BONUS_BASE = 1.5
def get_bye_bonus(week):
    return BYE_WEEK_BONUS_BASE * 1.2 if week <= 8 else BYE_WEEK_BONUS_BASE
```
Also add **short-week penalty**: Thursday-to-Saturday = -1.0 to -1.5 pts.

**Where to change:** Line 267 (constant) and ~line 2796 (application).

### 1.4 Blowout Compression [TRIVIAL]

**Problem:** Linear OLS multiplier overshoots large margins. A team that "should" win by 40 often wins by 28 (starters sit, clock runs).

**Fix:**
```python
def compress_blowout(raw_line, threshold=21.0):
    if abs(raw_line) <= threshold:
        return raw_line
    sign = 1 if raw_line > 0 else -1
    excess = abs(raw_line) - threshold
    return sign * (threshold + math.sqrt(excess) * 3.0)
```

**Where to change:** `build_football_picks()` ~line 2809, before `snap_line()`.

---

## PHASE 2: High-Value Improvements (Weeks 3-4)
*Target: Better win probabilities, fix home bias, better stat normalization*

### 2.1 Z-Score Normalization

**Problem:** Percentile ranking (1-50) destroys information. The gap between #1 and #5 might be huge, but #45 and #50 might be tiny — both show as 5-unit differences.

**Fix:** Replace `calculate_rank()` with z-score normalization:
```python
def calculate_zscore(value, all_values, higher_is_better=True):
    z = (value - mean) / std
    return z if higher_is_better else -z
```

**Cascading impact:** Requires recalibrating `BBMIF_LINE_MULTIPLIER` since the score scale changes from 0-50 to roughly -3 to +3.

### 2.2 Variable STD_DEV

**Problem:** Fixed STD_DEV = 14.0 for all games. But close games have tighter distributions than blowouts.

**Fix:** Bucket by spread magnitude:
```python
STD_DEV_BUCKETS = {
    (0, 3):    12.0,   # close games
    (3, 7):    13.0,
    (7, 14):   14.0,
    (14, 21):  15.0,
    (21, 35):  16.5,   # blowouts
    (35, 999): 18.0,
}
```

Calibrate each bucket independently via Brier score minimization on historical data.

### 2.3 Continuous Weather Model

**Problem:** Binary thresholds (-4 pts for wind > 20 mph treats 21 mph and 40 mph identically).

**Fix:** Continuous function with interaction terms:
```python
def weather_adjustment_v2(wind, temp, precip):
    wind_adj = -0.15 * max(0, wind - 10)
    temp_adj = -0.08 * max(0, 40 - temp)
    precip_adj = -0.5 * min(precip, 10)
    interaction = -0.02 * max(0, wind - 15) * max(0, 32 - temp)
    return wind_adj + temp_adj + precip_adj + interaction
```

### 2.4 Home Bias Root Cause

**Investigation needed:**
1. Check if SP+ already includes HFA (CFBD docs say "neutral-field basis" — verify)
2. Check if HFA residual calculation at line 2249 has circular reference (does `projected_margin` already include HFA?)
3. Check if raw box score stats carry HFA signal (home YPP > away YPP naturally)

**If double-counting confirmed:** Remove BBMIF HCA entirely, rely on SP+'s built-in HFA.
**If not double-counting:** Investigate box score stat home-field contamination.

---

## PHASE 3: Major Additions (Weeks 5-8)
*Target: Rebuild O/U model, diversify ratings, add injury modeling*

### 3.1 Over/Under Model Rebuild (PPP Method)

**Problem:** Current SP+ ratio method requires a -23.6 point correction for P4vP4 games. If you need a 24-point bandaid, the base method is broken.

**New method:** Pace-adjusted Points Per Possession:
```
possessions = (plays + turnovers) / avg_plays_per_possession
ppp = points_scored / possessions (adjusted for opponent)
projected_total = home_possessions * home_ppp_adj + away_possessions * away_ppp_adj
```

**Data:** ESPN box scores already have `totalPlays`, `possessionTime`, and scores. CFBD has `pointsPerGame`. No new APIs needed.

### 3.2 Diversify Power Rating Sources

**Reduce SP+ from 76% to 35-40%.** Add:

| Source | API | Cost | Weight Target |
|--------|-----|------|--------------|
| SP+ (keep) | CFBD | Free | 35-40% |
| ESPN FPI | ESPN API | Free | 15-20% |
| Internal Elo | Derived from results | Free | 15-20% |
| Sagarin/Massey | Scraping | Free | 5-10% |

**Internal Elo system (~80 lines):**
- Initialize all teams at 1500
- K-factor = 20, margin-of-victory multiplier
- Update after each game
- Store in `elo_ratings_cache.json`

**ESPN FPI:** Available at `https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings` (check if FPI is included in polls list).

### 3.3 Injury Modeling

**Position-value framework:**
```python
INJURY_POSITION_VALUES = {
    "QB":  {"starter": 10.0, "backup": 4.0},
    "RB":  {"starter": 2.0,  "backup": 0.5},
    "WR":  {"starter": 1.5,  "backup": 0.5},
    "DE":  {"starter": 2.5,  "backup": 1.0},
    "CB":  {"starter": 2.0,  "backup": 0.5},
}
```

**Data:** ESPN injuries API: `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/{team_id}/injuries` (free, no auth)

**MVP approach:** Start with QB-only (biggest impact). Add other positions in Phase 4.

### 3.4 CFBD Advanced Stats

**New stats to add from CFBD advanced stats endpoint:**
- `isoPPP` (explosiveness — distribution of play outcomes, not just average)
- `havocRate` (defensive disruption — TFL, sacks, forced fumbles)
- `redzoneScoring` (finishing drives — TD-to-FG ratio)

**Also:** Parse `totalPenaltiesYards` from ESPN box scores (field exists but is never parsed at line 1699).

**API:** `https://api.collegefootballdata.com/stats/season/advanced` (free with API key).

---

## PHASE 4: Off-Season Refinements
*Target: Polish for sustained accuracy across multiple seasons*

### 4.1 Coaching Change Registry
Manual JSON file (`coaching_changes.json`), first-year HC penalty of -2 to -3 BBMIF points decaying over 6 games. Updated annually.

### 4.2 Situational Tags
Rivalry lookup table, letdown/trap detection from schedule context, bowl motivation from record. 1-2 point adjustments each.

### 4.3 Empirical Altitude
Derive from historical data via regression on elevation differential, controlling for team quality. Replace hand-calibrated values.

### 4.4 Neutral-Site Proximity HFA
Geographic proximity → 30-50% of normal HFA. CFBD teams API has lat/lon. Need neutral venue coordinate table.

### 4.5 Transfer Portal
Pre-season adjustment based on net talent gain/loss. Manual curation from 247Sports/On3.

### 4.6 CLV Tracking
Track BBMIF line at prediction time vs closing Vegas line. Report mean CLV, median CLV, % positive CLV as primary quality metrics (more stable than ATS).

### 4.7 Multi-Season Calibration
Load 2023-2025 data. Weight: 2025 50%, 2024 30%, 2023 20%. Run all calibrations on 3-year pooled data (~2,400 games instead of 796).

### 4.8 K-Fold Cross-Validation
5-fold CV with contiguous weeks (not random) to avoid temporal leakage. L2 regularization on weights. Report in-sample vs out-of-sample accuracy.

---

## Data Source Summary

| Data Need | Source | Cost | Status |
|-----------|--------|------|--------|
| SP+ ratings | CFBD API | Free | Already integrated |
| Box scores | ESPN API | Free | Already integrated |
| Vegas lines | The Odds API | Paid | Already integrated |
| Weather | Open-Meteo | Free | Already integrated |
| FPI ratings | ESPN API | Free | **NEW — needs integration** |
| Advanced stats (IsoPPP, havoc, RZ) | CFBD advanced stats | Free | **NEW — needs integration** |
| Injuries | ESPN injuries API | Free | **NEW — needs integration** |
| Elo ratings | Derived from game results | Free | **NEW — needs implementation** |
| Coaching changes | Manual curation | Free | **NEW — annual update** |
| Rivalry matchups | Manual curation | Free | **NEW — one-time setup** |
| Venue coordinates | Manual + CFBD | Free | **NEW — one-time setup** |
| Elevation data | Manual lookup | Free | **NEW — one-time setup** |
| Historical odds (CLV) | Odds API historical | Paid | **NEW — may need plan upgrade** |

---

## Success Metrics

| Metric | Current | Phase 1 Target | Phase 3 Target |
|--------|---------|---------------|---------------|
| ATS weeks 1-3 | 83% | Maintain 80%+ | Maintain 80%+ |
| ATS weeks 4-9 | 52% | 60%+ | 65%+ |
| ATS overall | ~55% | 62%+ | 65%+ |
| O/U accuracy | Unknown (model broken) | Suspend wagering | Viable (55%+) |
| Home team pick rate | 70.5% | 62-65% | 58-62% |
| Mean CLV (selected plays) | Not tracked | Begin tracking | +0.5 to +1.5 pts |
| SP+ dependency | 76% | 76% (unchanged Phase 1) | 35-40% |

---

## Timeline

| Phase | When | Focus | Expected Impact |
|-------|------|-------|----------------|
| 1 | April-May 2026 | Critical fixes (blending, opponent adjustment, bye week, compression) | +5-8% ATS weeks 4-9 |
| 2 | May-June 2026 | Z-scores, variable STD_DEV, weather, home bias | +2-4% overall accuracy |
| 3 | June-August 2026 | O/U rebuild, FPI+Elo, injuries, advanced stats | Totals become viable; spreads +2-4% |
| 4 | Post-2026 season | Coaching, situational, altitude, portal, multi-year, CV | Professional-grade baseline |
