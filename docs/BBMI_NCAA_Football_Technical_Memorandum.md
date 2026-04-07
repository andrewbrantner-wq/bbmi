# BBMI NCAA Football Model — Technical Memorandum

**Prepared by:** BBMI Sports Analytics
**Date:** April 1, 2026
**Model Version:** BBMIF V2 (Phase 1 Complete, Phase-Blended SP+ Architecture)
**Validation Period:** 2023–2025 NCAA seasons (3-season walk-forward)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Model Architecture](#2-model-architecture)
3. [Input Data and Calibration](#3-input-data-and-calibration)
4. [Spread Projection Engine](#4-spread-projection-engine)
5. [Over/Under Total Projection](#5-overunder-total-projection)
6. [Win Probability](#6-win-probability)
7. [Product Definitions and Examples](#7-product-definitions-and-examples)
8. [Walk-Forward Validation Protocol](#8-walk-forward-validation-protocol)
9. [Validated Results](#9-validated-results)
10. [Components Investigated and Excluded](#10-components-investigated-and-excluded)
11. [Open Items and Forward-Looking Agenda](#11-open-items-and-forward-looking-agenda)
12. [Appendix A — Stat Weights by Phase](#appendix-a--stat-weights-by-phase)
13. [Appendix B — Quality Wins Tiers](#appendix-b--quality-wins-tiers)
14. [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Executive Summary

The BBMIF (BBMI Football) model projects point spreads, over/under totals, and win probabilities for NCAA FBS football games. The model blends pre-game SP+ efficiency ratings with in-season box score recency, using a phase-dependent weighting system that starts SP+-heavy in weeks 1–4 (when current-season data is sparse) and gradually incorporates box score data as the season progresses.

| Product | Walk-Forward ATS | Sample | Status |
|---------|-----------------|--------|--------|
| ATS Spread (all picks) | 56.4% / 58.0% | 760 / 781 games | Validated |
| ATS Spread (edge >= 5, spread < 14) | ~59% | Filtered subset | Primary product |
| Over/Under (blended model) | 53–55% | Multi-season | Marginal — monitoring |

The model achieved 56–58% ATS across two walk-forward test seasons with essentially zero overfitting gap (in-sample 57.5% vs walk-forward 58.0%). The multiplier is stable across three seasons (2.29, 2.27, 2.24 — variance of only 0.05).

---

## 2. Model Architecture

```
Step 1   Fetch ESPN schedule, scores, and box scores
Step 2   Fetch CFBD SP+ ratings (offense, defense, special teams)
Step 3   Calculate recency-weighted box score stats per team
Step 4   Phase-dependent stat blending (SP+ dominant early, box scores grow mid-season)
Step 5   Percentile rank each stat (1–50 scale)
Step 6   Weighted aggregate → BBMIF composite score
Step 7   Apply ranking cap
Step 8   Calculate residual-based home field advantage per team
Step 9   Raw line = (away_BBMIF - home_BBMIF + HFA) × multiplier
Step 10  Blowout compression (sqrt dampening above 23 pts)
Step 11  Home bias correction (+1.0 pt toward away)
Step 12  Line snapping (nearest 0.5, never whole number)
Step 13  O/U via PPP model × Vegas blend
Step 14  Win probability via Normal CDF
Step 15  Edge calculation vs Vegas
```

### Design Principles

- **SP+ as structural backbone.** Bill Connelly's SP+ ratings are opponent-adjusted, tempo-adjusted efficiency metrics that are the most predictive single input for college football. The model uses SP+ as the dominant signal early in the season and gradually blends in box score recency as games accumulate.

- **Phase-dependent blending.** Football's short season (12–15 games) means early-season data is extremely noisy. The model addresses this by weighting SP+ at 88% in weeks 1–4, ramping box scores up to 33% by weeks 9+. This prevents the "week 4–9 collapse" that occurs when noisy box scores are weighted equally to SP+.

- **Blowout compression.** Raw model outputs for extreme mismatches (e.g., Alabama vs FCS opponent) would produce unrealistic 50+ point spreads. A sqrt-based compression caps the effective spread while preserving directional signal.

---

## 3. Input Data and Calibration

### 3.1 SP+ Ratings

SP+ (Success Rate Plus) is an advanced team rating system that measures:
- **SP+ Offense:** Expected points added per play on offense, adjusted for opponent
- **SP+ Defense:** Expected points allowed per play on defense, adjusted for opponent
- **SP+ Special Teams:** Field position advantage from kicks, returns, and turnovers

SP+ ratings are available preseason (prior-year carryover with recruiting adjustments) and updated weekly during the season. They provide the strongest single-source predictive signal for college football outcomes.

### 3.2 Box Score Statistics

| Stat | Weight (Phase 3) | Description |
|------|-----------------|-------------|
| ypp_diff | 0.030 | Yards per play differential |
| turnover_margin | 0.040 | Takeaways minus giveaways per game |
| third_down_diff | 0.040 | Third-down conversion rate differential |
| pass_eff_diff | 0.000 | Passing efficiency (disabled — noisy) |
| sack_rate_diff | 0.000 | Sack rate differential (disabled) |
| redzone_diff | 0.000 | Red zone conversion differential (disabled) |
| pace | 0.000 | Tempo (disabled — captured by SP+) |

Box score stats are **not opponent-adjusted** (unlike SP+), which introduces noise. This is the primary reason they are weighted at only 12–33% of the total signal depending on season phase.

### 3.3 Quality Wins

Games are valued by opponent rank tier with bonuses for ranked wins and penalties for bad losses:

| Opponent Rank | Win | Close Loss (<=3 pts) | Loss |
|--------------|-----|---------------------|------|
| 1–10 | +6.0 | +1.5 | -1.5 |
| 11–20 | +3.0 | +0.5 | -3.0 |
| 21–25 | +3.0 | 0 | -4.5 |
| 26–40 | +1.0 | 0 | 0 |
| 41–75 | +0.4 | 0 | 0 |
| 76+ | 0 | 0 | 0 |

### 3.4 Recency Decay

Stats are weighted by recency with a decay factor of 0.85 per week. An early-season penalty of 0.75 is applied for weeks 1–3, reflecting the lower signal content of games against non-conference opponents and the general instability of early-season team performance.

---

## 4. Spread Projection Engine

### 4.1 Raw Line

```
raw_line = (away_BBMIF - home_BBMIF + HFA) × BBMIF_LINE_MULTIPLIER
```

Where `BBMIF_LINE_MULTIPLIER = 1.70` (OLS-calibrated from 2023 season, 796 games). Walk-forward testing uses ~2.25 due to wider score distributions without rank caps.

### 4.2 Home Field Advantage

**Residual-based HFA calculation:**
```
true_hfa = (avg_home_residual - avg_away_residual) / 2
adjusted_hfa = true_hfa × HCA_SCALE
capped_hfa = min(adjusted_hfa, HCA_CAP)
```

| Parameter | Value |
|-----------|-------|
| HCA_SCALE | 0.50 |
| HCA_CAP | 8.0 pts |
| HCA_ALLOW_NEG | True |

Negative HFA is allowed — some teams genuinely perform worse at home (typically due to fan base size or altitude adjustment for opponents).

**Altitude teams** receive additional away-game adjustments:

| Team | Altitude Bonus |
|------|---------------|
| Air Force | 4.0 pts |
| Wyoming | 3.0 pts |
| Colorado State | 2.5 pts |
| Colorado | 2.5 pts |
| BYU | 2.0 pts |
| UNLV | 2.0 pts |
| Utah | 2.0 pts |
| New Mexico | 1.5 pts |

### 4.3 Blowout Compression

For projected margins exceeding 23 points, a sqrt-based compression is applied:

```
if |raw_line| > 23.0:
    compressed = sign × (23.0 + sqrt(|raw_line| - 23.0) × 2.8)
```

| Raw Line | Compressed | Reduction |
|----------|-----------|-----------|
| 23.0 | 23.0 | 0 |
| 30.0 | 30.4 | -0.6 |
| 40.0 | 34.6 | -5.4 |
| 50.0 | 37.6 | -12.4 |

### 4.4 Home Bias Correction

A diagnostic found that BBMIF favored the home team in 70.5% of picks vs an actual 59.6% home win rate. A fixed +1.0 point correction shifts the line toward the away team:

```
corrected_line = compressed_line + HOME_BIAS_CORRECTION (1.0)
```

### 4.5 Bye Week and Short Week Adjustments

| Situation | Adjustment |
|-----------|-----------|
| Bye week (weeks 4–8) | +1.8 pts to team off bye |
| Bye week (weeks 10+) | +1.5 pts to team off bye |
| Short week (Thu→Sat) | -1.25 pts to team on short week |

### 4.6 Worked Example

Ohio State (home, BBMIF 45.2) vs Michigan (away, BBMIF 43.8). Ohio State HFA = 5.1 pts. Week 11 (Phase 3 weights).

```
raw_line = (43.8 - 45.2 + 5.1) × 1.70 = 3.7 × 1.70 = 6.29
blowout check: 6.29 < 23 → no compression
bias correction: 6.29 + 1.0 = 7.29
snapped: 7.5 (Ohio State -7.5)
```

If Vegas has Ohio State -10.5, the edge is 3.0 points. Pick: Michigan +10.5.

---

## 5. Over/Under Total Projection

### 5.1 V2 PPP Model (Points Per Play)

The O/U model uses a points-per-play framework with opponent adjustment:

**Possession estimate:**
```
avg_plays = (home_plays + away_plays + opp_plays_h + opp_plays_a) / 4
pace_factor = avg_plays / 70.0    (capped 0.88–1.12)
```

**Expected scoring:**
```
home_exp_pts = (home_pts_pg + away_pts_allowed_pg) / 2 × pace_factor + 0.05 × |HFA|
away_exp_pts = (away_pts_pg + home_pts_allowed_pg) / 2 × pace_factor
```

**Mean regression (phase-dependent):**

| Weeks | Regression % |
|-------|-------------|
| 1–4 | 25% toward FBS average |
| 5–8 | 20% toward FBS average |
| 9+ | 15% toward FBS average |

Where `FBS_AVG_POINTS_PER_GAME = 28.5`.

### 5.2 Vegas Blending

The model total is blended with the Vegas total, with increasing model weight as the season progresses:

| Weeks | Vegas Weight | Model Weight |
|-------|-------------|-------------|
| 1–5 | 80% | 20% |
| 6–9 | 65% | 35% |
| 10+ | 55% | 45% |

**Rationale:** Early-season model totals are highly uncertain. Vegas totals embed preseason research that the model cannot replicate with 2–3 games of data. As the season progresses and the model accumulates data, its weight increases.

### 5.3 Weather Adjustments

Weather effects are applied to outdoor-venue games only:

| Condition | Adjustment |
|-----------|-----------|
| Wind > 10 mph | -0.20 pts per mph above 10 |
| Temperature < 40°F | -0.08 pts per degree below 40 |
| Precipitation | -0.50 pts per mm (capped at 10mm) |
| Cold + wind interaction | -0.015 × (wind - 15) × (32 - temp) |
| Wind + rain interaction | -0.010 × (wind - 12) × precip |
| Maximum total adjustment | -12.0 pts |
| Dome games | No adjustment |

---

## 6. Win Probability

```
Z = bbmif_line / STD_DEV
P(home wins) = (1 - norm_cdf(Z)) × 100%
```

Where `STD_DEV = 14.0` points.

**Example:** BBMIF line = -7.5 (home favored).
```
Z = -7.5 / 14.0 = -0.536
P(home wins) = (1 - norm_cdf(-0.536)) × 100% ≈ 70.4%
```

**Note:** The actual observed standard deviation of college football scoring margins is 19.8 points. The calibrated value of 14.0 produces better-calibrated win probabilities because it accounts for the model's predictive power, not raw outcome variance.

---

## 7. Product Definitions and Examples

### 7.1 ATS Spread Pick

```
edge = |bbmif_line - vegas_line|
if bbmif_line > vegas_line → pick away cover
if bbmif_line < vegas_line → pick home cover
```

### 7.2 Edge Classification

| Edge | Classification |
|------|---------------|
| >= 5.0 pts | High edge — primary product |
| < 5.0 pts | Lower confidence — included |

**Filtered high-quality subset:** Edge >= 5.0 AND |Vegas spread| < 14. This excludes extreme spreads where compression artifacts may affect accuracy.

### 7.3 Over/Under Pick

```
ou_edge = bbmif_total - vegas_total
if ou_edge > 0 → OVER
if ou_edge < 0 → UNDER
```

---

## 8. Walk-Forward Validation Protocol

### 8.1 Methodology

Three-season walk-forward:
- **Train on 2023 → Test on 2024:** Multiplier calibrated from 2023 data, applied to unseen 2024 games
- **Train on 2023+2024 → Test on 2025:** Combined calibration applied to unseen 2025 games

SP+ ratings are loaded as preseason values for each test year. Box scores are accumulated game-by-game within each test season. No future information enters any projection.

### 8.2 Multiplier Stability

| Season | OLS Multiplier |
|--------|---------------|
| 2023 | 2.29 |
| 2024 | 2.27 |
| 2025 | 2.24 |

Variance of 0.05 across three seasons confirms structural stability.

### 8.3 Overfitting Check

- **In-sample 2025:** 57.5% ATS
- **Walk-forward 2025:** 58.0% ATS
- **Gap:** +0.5% (walk-forward slightly better — no overfitting)

---

## 9. Validated Results

### 9.1 Spread ATS

| Test | ATS | Games | Multiplier Used |
|------|-----|-------|----------------|
| Train 2023 → Test 2024 | 56.4% | 760 | 1.70 (2023 calibration) |
| Train 2023+2024 → Test 2025 | 58.0% | 781 | ~2.0 (combined) |
| Filtered (edge >= 5, spread < 14) | ~59% | ~489/season | Consistent both years |

### 9.2 Phase-by-Phase Performance

| Phase | Weeks | 2024 ATS | 2025 ATS | Notes |
|-------|-------|----------|----------|-------|
| Phase 1 | 1–4 | Higher (~60%) | Higher | SP+ dominance, strong signal |
| Phase 2 | 5–8 | ~52% | ~53% | Box score noise peaks; half-Kelly recommended |
| Phase 3 | 9+ | ~55% | ~57% | Box scores stabilize, SP+ still guides |

### 9.3 Over/Under

| Metric | 2024 | 2025 |
|--------|------|------|
| Blended O/U ATS | 52–54% | 53–55% |
| Mean Absolute Error | ~23.5 pts | ~24.1 pts |
| Overs | 50–52% | 50–52% |
| Unders | 54–56% | 54–56% |

O/U performance is marginal relative to the 55% target. Under picks outperform overs consistently.

### 9.4 Correlation Metrics

| Metric | Value |
|--------|-------|
| Margin prediction correlation (walk-forward) | 0.72 |
| Margin prediction correlation (in-sample) | 0.74 |

---

## 10. Components Investigated and Excluded

### 10.1 Pass Efficiency Differential

**Weight:** 0.000 (disabled)

**Rationale:** Raw passing efficiency is not opponent-adjusted. Against weak secondaries, any quarterback posts high efficiency numbers. SP+ already captures passing quality in its opponent-adjusted framework.

### 10.2 Red Zone Differential

**Weight:** 0.000 (disabled)

**Rationale:** Red zone conversion rates are highly volatile game-to-game and heavily opponent-dependent. Small sample sizes within a single football season (12–15 games) make this metric unreliable.

### 10.3 Sack Rate Differential

**Weight:** 0.000 (disabled)

**Rationale:** Sack rates conflate offensive line quality, quarterback mobility, and opponent pass rush strength without adequately separating these signals.

### 10.4 Pace

**Weight:** 0.000 (disabled in spread model)

**Rationale:** Pace affects total scoring but not margin of victory. SP+ is already tempo-adjusted. Pace is used in the O/U model via the PPP framework but excluded from spread projection.

### 10.5 Home Bias Diagnosis

**Finding:** BBMIF favored the home team in 70.5% of predictions vs a 59.6% actual home win rate. Regression analysis: BBMIF ≈ 0.46 × Vegas + 3.0 (intercept = systematic home bias).

**Fix:** +1.0 point HOME_BIAS_CORRECTION applied toward the away team. Additional investigation scheduled for Phase 2 (2026 season).

### 10.6 Week 4–9 Accuracy Collapse

**Finding:** Model accuracy drops to ~52% during weeks 4–9 when box score noise peaks. Vegas maintains ~74% directional accuracy during this period.

**Root cause:** Raw box scores without opponent adjustment introduce directional noise — a team that gained 400 yards against a weak defense gets the same credit as 400 yards against a strong defense.

**Fix:** Reduced box score weight from ~38% to ~12% in early phases. SP+ dominance (76%+) preserves signal through the noisy mid-season period.

---

## 11. Open Items and Forward-Looking Agenda

### 11.1 Pre-2026 Season Action Items

| Item | Description | Priority |
|------|-------------|----------|
| Multiplier reconciliation | Production uses 1.70, walk-forward uses ~2.25. Score-scale artifact from rank caps. Verify distributions before changing. | High |
| Half-Kelly weeks 5–8 | Phase 2 was 52.2% in 2024 — barely profitable. Build reduced sizing as default. | High |
| Accuracy page redesign | Display phase-by-phase performance rather than single-season ATS. | Medium |
| CLV tracking | Opening + closing line capture already built. First real CLV data September 2026. | Medium |

### 11.2 Future Development Phases

| Phase | Components | Target |
|-------|-----------|--------|
| Phase 2 | Z-score normalization, variable STD_DEV, continuous weather, home bias fix for 14+ pt favorites | 2026 early season |
| Phase 3 | O/U rebuild (PPP model enhancement), FPI + Elo diversification, CFBD advanced stats | 2026 mid-season |
| Phase 4 | Coaching registry, situational tags, transfer portal impact, multi-season calibration | 2027+ |

---

## Appendix A — Stat Weights by Phase

### Phase 1 (Weeks 1–4): SP+ Dominant

| Category | Weight | Components |
|----------|--------|-----------|
| SP+ Offense | 44% | Pre-game rating |
| SP+ Defense | 44% | Pre-game rating |
| Quality Wins | 5% | Schedule-adjusted |
| Box Scores | ~3.5% | Minimal — too few games |
| Special Teams | 3% | SP+ special teams |

### Phase 2 (Weeks 5–8): Gradual Blend

| Category | Week 5 | Week 6 | Week 7 | Week 8 |
|----------|--------|--------|--------|--------|
| SP+ (total) | 85% | 75% | 65% | 58% |
| Quality Wins | 5–10% | | (linear ramp) | |
| Last 5 | 1–3% | | (linear ramp) | |
| Box Scores | Remainder | | (distributed) | |

### Phase 3 (Weeks 9+): Full Blend

| Category | Weight | Components |
|----------|--------|-----------|
| SP+ Offense | 25% | Pre-game rating |
| SP+ Defense | 25% | Pre-game rating |
| Quality Wins | 10% | Schedule-adjusted |
| Box Scores | 33% | YPP 10%, TO 11%, 3rd down 8%, pass eff disabled |
| Last 5 | 3% | Recent form |
| Special Teams | 3% | SP+ special teams |
| Pace | 2% | O/U only |

---

## Appendix B — Quality Wins Tiers

| Opponent Rank | Win | Close Loss (<=3 pts) | Loss |
|--------------|-----|---------------------|------|
| 1–10 (Tier 1) | +6.0 | +1.5 | -1.5 |
| 11–20 (Tier 2) | +3.0 | +0.5 | -3.0 |
| 21–25 (Tier 3) | +3.0 | 0 | -4.5 |
| 26–40 (Tier 4) | +1.0 | 0 | 0 |
| 41–75 (Tier 5) | +0.4 | 0 | 0 |
| 76+ | 0 | 0 | 0 |

---

## Appendix C — Glossary

| Term | Definition |
|------|-----------|
| **SP+** | Success Rate Plus — Bill Connelly's opponent-adjusted, tempo-adjusted team efficiency rating |
| **BBMIF** | BBMI Football composite score (percentile-ranked, weighted aggregate) |
| **Phase Blending** | Dynamic weight allocation that shifts from SP+-dominant (early season) to box-score-inclusive (late season) |
| **Blowout Compression** | Sqrt-based dampening for projected margins > 23 points |
| **PPP** | Points Per Play — the basis for the V2 over/under total model |
| **HFA** | Home Field Advantage — team-specific residual-based adjustment |
| **CLV** | Closing Line Value — measures whether the market moved toward the model's projection between opening and closing |
| **Walk-Forward** | Validation where each season is projected using only data from prior seasons |
| **FBS** | Football Bowl Subdivision — the top tier of NCAA football (~130 teams) |

---

*This memorandum describes the BBMIF NCAA Football model as of April 1, 2026. Model parameters and validation results are subject to revision based on ongoing monitoring and the pre-2026-season calibration work.*
