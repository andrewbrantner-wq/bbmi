# BBMI MLB Model — Technical Memorandum

**Prepared by:** BBMI Sports Analytics
**Date:** April 1, 2026
**Model Version:** MVM Phase 1c + Phase 3 Weather (Production)
**Validation Period:** 2024–2025 MLB seasons (walk-forward, point-in-time)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Model Architecture](#2-model-architecture)
3. [Input Data and Calibration](#3-input-data-and-calibration)
4. [Projection Engine](#4-projection-engine)
5. [Scoring Distribution — Negative Binomial Engine](#5-scoring-distribution--negative-binomial-engine)
6. [Product Definitions and Examples](#6-product-definitions-and-examples)
7. [Walk-Forward Validation Protocol](#7-walk-forward-validation-protocol)
8. [Validated Results](#8-validated-results)
9. [Components Investigated and Excluded](#9-components-investigated-and-excluded)
10. [Open Items and Forward-Looking Agenda](#10-open-items-and-forward-looking-agenda)
11. [Appendix A — Park Factors](#appendix-a--park-factors)
12. [Appendix B — Season Configuration](#appendix-b--season-configuration)
13. [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Executive Summary

The BBMI MLB model projects game-level scoring using a Negative Binomial (NB) engine with five core inputs: team-level FIP (pitching quality), park-neutral wOBA (offensive quality), park factors, trailing league scoring environment, and home-field advantage. The model produces three validated wagering products and one monitoring signal:

| Product | Walk-Forward ATS | Sample | ROI at -110 |
|---------|-----------------|--------|-------------|
| Total Under (edge >= 0.83 runs) | 58.8% | 565 games | +12.2% |
| Away +1.5 Run Line (all tiers) | 69.4% | 1,897 games | +13.8% at -156 |
| Away Ace (Tier 4) | 81.2% | 85 games | +33.2% at -156 |
| Over Watch (>= 1.25 runs) | 53.6% | 822 games | Monitoring only |

All products were validated using strict walk-forward methodology with point-in-time data enforcement. No future information leaks into any projection.

---

## 2. Model Architecture

The projection pipeline operates in the following sequence:

```
Step 1   Team FIP blending (current season + prior year, Bayesian)
Step 2   Starter FIP shrinkage toward team FIP
Step 3   Run projection (pitcher signal: FIP-based expected runs)
Step 3b  Offense blending (wOBA-based offensive rating, alpha = 0.50)
Step 4   Park factor (asymmetric for hitter-friendly parks)
Step 4a  Weather factor
Step 4b  Re-anchoring (trailing 30-day league scoring environment)
Step 5   Home-field advantage (+0.02 runs total)
Step 5b  Catcher framing adjustment
Step 5c  Wrigley wind adjustment (post-park-factor, Wrigley only)
Step 6   Floor enforcement (minimum 1.5 runs per team)
Step 7   Negative Binomial win probability
Step 8   Run line probabilities (all alternate lines)
Step 9   Moneyline derivation
Step 10  Edge calculation (BBMI projection vs Vegas posted line)
```

### Design Principles

- **Team-level, not individual-level.** Pitching quality is measured at the team FIP level, not the individual starter. Walk-forward validation confirmed that team FIP (80.0% ATS on 70 qualifying games) outperforms individual starter FIP (74.8% on 127 games). Team FIP captures rotation depth; individual FIP isolates a single matchup.

- **Negative Binomial, not Poisson.** MLB scoring exhibits overdispersion (variance exceeds the mean). The NB distribution captures this with a conditional dispersion parameter that varies by projected game total.

- **Point-in-time enforcement.** All inputs use only data available on the day before each game. wOBA coefficients, prior-year FIP, and league baselines are locked per season and never updated retroactively.

---

## 3. Input Data and Calibration

### 3.1 Team FIP (Pitching Quality)

Fielding Independent Pitching (FIP) isolates the pitcher's contribution by measuring strikeouts, walks, hit-by-pitches, and home runs — outcomes not affected by team defense.

**Formula:**
```
FIP = ((13 × HR) + (3 × (BB + HBP)) - (2 × K)) / IP + FIP_constant
```

**Bayesian blending** (current season vs prior year):
```
w_team = max(0.10, games_played / 162 × 0.67)
blended_fip = w_team × current_season_fip + (1 - w_team) × prior_year_fip
```

At 0 games played, the prior year receives 90% weight. At a full 162-game season, the current year receives 67% weight (the prior never fully disappears, reflecting regression to the mean).

**Example:** On June 1, a team has played 55 games.
```
w_team = max(0.10, 55/162 × 0.67) = max(0.10, 0.227) = 0.227
blended_fip = 0.227 × 3.82 + 0.773 × 4.10 = 3.04 + 3.17 = 4.04
```

### 3.2 Team wOBA (Offensive Quality)

Weighted On-Base Average (wOBA) is a park-neutral offensive metric that weights each offensive event (single, double, triple, HR, walk) by its run-scoring value.

**Conversion to runs per game:**
```
offense_rpg = slope × blended_woba + intercept
```

The slope and intercept are calibrated annually from the prior season's data (point-in-time):

| Projection Season | Calibration Year | Slope | Intercept |
|-------------------|-----------------|-------|-----------|
| 2024 | 2023 | 31.85 | -5.67 |
| 2025 | 2024 | 30.38 | -5.13 |
| 2026 | 2025 | 29.05 | -4.76 |

**wOBA blending** (same Bayesian structure, faster stabilization):
```
w_off = max(0.10, games_played / 162 × 0.75)
blended_woba = w_off × current_woba + (1 - w_off) × prior_year_woba
```

Offense uses a 0.75 full-season weight (vs 0.67 for pitching) because batting metrics stabilize faster than pitching metrics.

**Example:** A team with 40 games played has a current wOBA of .325 and prior-year wOBA of .310.
```
w_off = max(0.10, 40/162 × 0.75) = 0.185
blended_woba = 0.185 × .325 + 0.815 × .310 = 0.060 + 0.253 = .313
offense_rpg (2026) = 29.05 × .313 + (-4.76) = 9.09 - 4.76 = 4.33 R/G
```

### 3.3 Park Factors

Park factors are multiplicative adjustments reflecting how a venue affects run scoring relative to a neutral park (1.00).

**Source:** Initially seeded from FanGraphs multi-year park factors, then recalibrated from 2024–2025 walk-forward observed data using Bayesian shrinkage:
```
w_implied = n_games / (n_games + 162)
corrected_pf = w_implied × implied_pf + (1 - w_implied) × prior_model_pf
```

13 parks were corrected where the gap between model PF and implied PF exceeded 0.05 on 160+ games. Notable corrections:

| Park | Prior PF | Corrected PF | Direction |
|------|----------|-------------|-----------|
| Globe Life Field (TEX) | 1.060 | 0.959 | Was over-projecting scoring by 1.58 runs/game |
| Chase Field (ARI) | 1.020 | 1.090 | Was under-projecting scoring by 1.39 runs/game |
| Wrigley Field (CHC) | 1.020 | 0.968 | Was over-projecting scoring by 0.74 runs/game |
| Coors Field (COL) | 1.270 | 1.270 | Unchanged — already accurate |

Full park factor table in Appendix A.

### 3.4 League Scoring Environment (Re-Anchoring)

MLB's scoring environment shifts throughout the season (cold April weather, mid-summer offense, September expanded rosters). Rather than use a static baseline, the model computes a trailing 30-day league average runs per game and re-anchors projections accordingly.

```
reanchor_factor = trailing_30_day_league_rpg / static_season_baseline
home_proj × = reanchor_factor
away_proj × = reanchor_factor
```

This adjustment is applied equally to both teams. It shifts the total projection level without affecting the differential (margin).

### 3.5 Home-Field Advantage

**HCA = 0.02 runs** (total, split +0.01 home / -0.01 away).

This value was empirically validated on 4,158 domestic walk-forward games. The original proposal transferred an NCAA-derived value of 0.30, which was 15x too high. Empirical measurement: +0.021 runs (95% CI: -0.113 to +0.156), statistically indistinguishable from zero but directionally positive.

---

## 4. Projection Engine

### 4.1 Pitcher-Based Run Projection

Each team's projected runs begin with the opponent's pitching quality:

```
home_runs_pitcher = league_avg_rpg × (effective_away_fip / league_avg_rpg)
away_runs_pitcher = league_avg_rpg × (effective_home_fip / league_avg_rpg)
```

A pitcher with FIP equal to the league average projects the opposing offense at exactly the league average. A pitcher with FIP below average suppresses the opposing offense proportionally.

### 4.2 Pitcher/Offense Blending

The pitcher signal and the offensive signal are blended with equal weight:

```
alpha = 0.50
home_proj = alpha × home_runs_pitcher + (1 - alpha) × home_offense_rpg
away_proj = alpha × away_runs_pitcher + (1 - alpha) × away_offense_rpg
```

**Example — Full Projection:**

Cubs (home) vs Cardinals (away), June 15, 2025.

Inputs:
- Cubs blended team FIP: 3.95 (pitching staff quality — faces Cardinals batters)
- Cardinals blended team FIP: 4.20 (pitching staff quality — faces Cubs batters)
- Cubs offense RPG (from wOBA): 4.50
- Cardinals offense RPG (from wOBA): 4.15
- League avg RPG baseline: 4.447
- Park factor (Wrigley): 0.968
- Trailing 30-day league RPG: 4.52

Pitcher signal:
```
Cubs_runs_pitcher = 4.447 × (4.20 / 4.447) = 4.20  (facing Cardinals pitching)
Cards_runs_pitcher = 4.447 × (3.95 / 4.447) = 3.95  (facing Cubs pitching)
```

Blend with offense (alpha = 0.50):
```
Cubs_proj  = 0.50 × 4.20 + 0.50 × 4.50 = 4.35
Cards_proj = 0.50 × 3.95 + 0.50 × 4.15 = 4.05
```

### 4.3 Asymmetric Park Factor

For hitter-friendly parks (PF > 1.04), the model applies asymmetric park factor adjustments. Home teams are partially adapted to their park environment; visiting teams face the full park effect.

```
PF_ATTENUATION = 0.56

if park_factor > 1.04:
    home_pf = 1.0 + (park_factor - 1.0) × 0.56
    home_proj × = park_factor      # home offense: full park boost
    away_proj × = home_pf          # visiting offense: attenuated
else:
    home_proj × = park_factor      # symmetric for pitcher-friendly parks
    away_proj × = park_factor
```

Continuing the example (Wrigley PF = 0.968, symmetric):
```
Cubs_proj  = 4.35 × 0.968 = 4.211
Cards_proj = 4.05 × 0.968 = 3.920
```

### 4.4 Re-Anchoring

```
reanchor_factor = 4.52 / 4.447 = 1.016
Cubs_proj  = 4.211 × 1.016 = 4.278
Cards_proj = 3.920 × 1.016 = 3.983
```

### 4.5 HCA

```
Cubs_proj  = 4.278 + 0.01 = 4.288
Cards_proj = 3.983 - 0.01 = 3.973
```

### 4.6 Catcher Framing

Asymmetric adjustment: poor framers cost more than elite framers gain.

| Tier | Adjustment |
|------|-----------|
| Elite | -0.08 runs (suppresses opposing offense) |
| Average | 0.00 |
| Poor | +0.10 runs (inflates opposing offense) |

Both catchers average → no adjustment. Final projections:
```
Cubs:      4.29 projected runs
Cardinals: 3.97 projected runs
Total:     8.26 projected runs
Margin:    +0.32 (Cubs favored)
```

### 4.7 Wrigley Wind Adjustment

Applied only to Chicago Cubs home games when wind speed >= 8 mph:

```
speed_factor = min(wind_speed_mph / 15.0, 1.5)

Wind blowing in/in_angle:   adjustment = -0.60 × speed_factor
Wind blowing out/out_angle: adjustment = +0.60 × speed_factor
```

The adjustment modifies the projected total after park factor and before edge calculation. Walk-forward validation: Wrigley under ATS improved from 44.4% to 47.6% after adjustment; overall model improved from 58.5% to 58.8%.

**Example:** Wind blowing out at 15 mph.
```
speed_factor = min(15/15, 1.5) = 1.0
adjustment = +0.60 × 1.0 = +0.60 runs
adjusted_total = 8.26 + 0.60 = 8.86
```

The adjustment raises the total by 0.60 runs, reflecting Wrigley's documented wind-out scoring inflation. This makes the model less likely to generate an under pick on a day when the wind is carrying the ball out.

---

## 5. Scoring Distribution — Negative Binomial Engine

### 5.1 Why Negative Binomial

MLB game scoring exhibits overdispersion: the variance of runs scored exceeds the mean. A Poisson distribution assumes variance equals the mean, which systematically underestimates the probability of blowouts and shutouts. The Negative Binomial distribution adds a dispersion parameter that captures this extra variance.

### 5.2 Conditional Dispersion

Dispersion varies with the projected game total:

| Game Total Range | Dispersion Index | Interpretation |
|-----------------|-----------------|----------------|
| < 7.5 runs | 1.16 | Moderate overdispersion (low-scoring, pitcher-dominated) |
| 7.5 – 9.5 runs | 1.03 | Near-Poisson (typical games) |
| > 9.5 runs | 1.70 | High overdispersion (offensive environments, more blowout risk) |

The NB dispersion parameter r is computed as:
```
r = mu / (dispersion_index - 1)
```

Higher r → distribution closer to Poisson. Lower r → fatter tails (more extreme outcomes).

### 5.3 Win Probability

Win probability is computed by summing the joint probability of every possible score combination:

```
P(home wins) = SUM[h=0..25, a=0..25] P(home=h) × P(away=a) × I(h > a)
             + P(tie) × HOME_TIE_SHARE

Where:
  P(home=h) = NB_PMF(h; mu=home_proj, r=home_r)
  P(away=a) = NB_PMF(a; mu=away_proj, r=away_r)
  HOME_TIE_SHARE = 0.53 (extra-inning walk-off advantage)
```

The grid is computed over 0–25 runs per team (676 cells). This captures the full distribution including extreme outcomes.

**Example:** Cubs 4.29, Cardinals 3.97, total 8.26 (medium bin, dispersion 1.03).
```
home_r = 4.29 / (1.03 - 1) = 143.0
away_r = 3.97 / (1.03 - 1) = 132.3
```

With r this high, the distribution is near-Poisson. The resulting win probability is approximately 0.518 for the Cubs.

### 5.4 Run Line Probabilities

The model computes margin-of-victory probabilities for all standard run lines (-3.5 through +3.5). Tie probability is distributed across margins using empirical extra-inning resolution rates:

| Margin | Home share of ties | Away share of ties |
|--------|-------------------|-------------------|
| +1 / -1 | 60% | 60% |
| +2 / -2 | 25% | 25% |
| +3 / -3 | 15% | 15% |

Run line probability for a given threshold (e.g., home -1.5) is the cumulative probability that the home margin exceeds the threshold.

### 5.5 Moneyline Derivation

```
if win_prob >= 0.50:
    ML = -(win_prob / (1 - win_prob)) × 100     # negative (favorite)
else:
    ML = ((1 - win_prob) / win_prob) × 100       # positive (underdog)
```

**Example:** Cubs at 51.8% win probability.
```
ML = -(0.518 / 0.482) × 100 = -107
```

---

## 6. Product Definitions and Examples

### 6.1 Total Under

**Signal:** The model's projected total is significantly lower than the Vegas posted total.

**Edge calculation:**
```
ou_edge = bbmi_projected_total - vegas_posted_total
```

A negative edge means the model projects fewer runs than Vegas. When `ou_edge <= -0.83`, an under recommendation is generated.

**Confidence tiers:**

| Tier | Edge Threshold | Dots |
|------|---------------|------|
| Standard | >= 0.83 runs | 1 |
| Strong | >= 1.25 runs | 2 |
| Premium | >= 1.50 runs | 3 |

**Example:** BBMI projects 7.2 total runs. Vegas posts an O/U of 8.5.
```
ou_edge = 7.2 - 8.5 = -1.30
|edge| = 1.30 >= 0.83 → UNDER pick generated
1.30 >= 1.25 → Tier 2 (Strong), 2 dots displayed
```

**Primary segment:** Evening games with traditional starters (excludes opener games). Walk-forward: 58.8% ATS on 565 games, +12.2% ROI at -110 juice.

### 6.2 Away +1.5 Run Line

**Signal:** The model projects the away team to win, but the away team is the Vegas underdog (home team is -1.5 favorite).

**Conditions (all must be true):**
1. `home_spread < 0` (home team is the -1.5 favorite per the odds API)
2. `bbmi_margin < 0` (model projects away team to win)

**Confidence tiers:**

| Tier | Margin Threshold | Dots |
|------|-----------------|------|
| Standard | >= 0.00 | 1 |
| Strong | >= 0.15 | 2 |
| Premium | >= 0.25 | 3 |
| Away Ace | >= 0.15 AND FIP diff < -1.0 | 4 (ACE label) |

**Suppression rule:** Home underdog picks (home team is +1.5, model projects home win) are permanently suppressed. Walk-forward showed 53.1% cover rate on 746 games — 10.9 pp below the 64.0% MLB base rate for +1.5 covers. This is an anti-signal.

**Example:** Dodgers (-1.5) host Padres (+1.5). BBMI projects Padres to win by 0.20 runs.
```
home_spread = -1.5 (Dodgers favorite)
bbmi_margin = -0.20 (model projects Padres)
|margin| = 0.20 >= 0.15 → Tier 2 (Strong)
FIP differential = 3.40 - 4.60 = -1.20 (Padres pitcher has 1.20 FIP advantage)
-1.20 < -1.0 → Tier 4 (Away Ace)
Pick: "Padres +1.5" with ACE confidence label
```

**Walk-forward:** 69.4% cover rate on 1,897 games across 2024–2025. The MLB base rate for away +1.5 is 64.0%, so the model adds +5.4 pp of edge.

### 6.3 Away Ace (Tier 4)

The Away Ace tier is a subset of the Away +1.5 product that requires both a model-projected away win (margin >= 0.15) and a significant pitching advantage (team FIP differential < -1.0, meaning the away team's pitching staff has FIP at least 1.0 runs lower than the home team's).

**Walk-forward:** 81.2% cover rate on 85 games, +33.2% ROI at typical -156 juice. Both individual seasons pass: 2024 at 84.0% (44 games), 2025 at 80.0% (41 games).

### 6.4 Over Watch (Monitoring Signal)

**Signal:** The model's projected total is significantly higher than the Vegas posted total (edge >= 1.25 runs in the over direction).

**Over is not a validated wagering product.** Walk-forward across all thresholds produced 49–51% ATS (below break-even). A May-June subset showed 55.7% on 115 games, which warrants monitoring but does not meet gate criteria for recommendation.

**Confidence tiers (monitoring only):**

| Tier | Edge Threshold | Dots |
|------|---------------|------|
| Standard | >= 1.25 runs | 1 |
| Strong | >= 1.50 runs | 2 |

### 6.5 Win Probability

The model's win probability output is derived from the Negative Binomial scoring grid (Section 5.3). It is displayed on the platform for informational purposes but does not directly generate a wagering recommendation. The moneyline edge (model win probability minus implied Vegas probability) is computed but did not produce a validated product during walk-forward testing.

---

## 7. Walk-Forward Validation Protocol

### 7.1 Methodology

Every game in the 2024 and 2025 MLB seasons was projected using only data that would have been available the day before the game:

- **wOBA calibration coefficients:** 2023 coefficients for 2024 projections, 2024 coefficients for 2025 projections. Never updated within a season.
- **Prior-year FIP:** 2023 team FIP for 2024 projections, 2024 team FIP for 2025 projections.
- **Odds:** Opening lines captured at the time of the game. Historical odds cached locally from The Odds API.
- **League scoring environment:** Trailing 30-day average computed from games completed before the projection date.

No game's projection used any information from the game itself or any future game.

### 7.2 Pre-Registered Gate Criteria

Five conditions were established before the walk-forward was run. All must pass for a product to be authorized:

| Gate | Criterion | Rationale |
|------|-----------|-----------|
| 1 | ATS >= 53.5% | Exceeds break-even at -110 juice by margin of safety |
| 2 | ROI >= +2.0% at -110 | Positive expected value after standard juice |
| 3 | All 4 half-seasons >= 52.38% | Consistent across time periods (no single hot streak) |
| 4 | Both full seasons >= 52.38% | Stable across both test seasons independently |
| 5 | Edge monotonicity | Higher-confidence tiers perform at least as well as lower tiers |

### 7.3 Exclusions

- **International venue games** (Seoul, Tokyo, London, Mexico): Excluded from all ATS calculations. Odds coverage is unreliable and park factors are unavailable.
- **Opener games:** Excluded from the primary reporting segment (evening + traditional). Opener games have different bullpen usage patterns that the model does not specifically address.
- **Pushes:** Games where the actual total equals the posted total are excluded from win/loss calculations (standard industry practice).

---

## 8. Validated Results

### 8.1 Total Under

| Metric | Value |
|--------|-------|
| ATS | 58.8% (332/565) |
| ROI at -110 | +12.2% |
| 2024 full season | 56.1% (138/246) |
| 2025 full season | 60.8% (194/319) |
| 2024 H1 (Apr–Jun) | 54.9% (117/213) |
| 2024 H2 (Jul–Sep) | 63.6% (21/33) |
| 2025 H1 (Apr–Jun) | 60.8% (158/260) |
| 2025 H2 (Jul–Sep) | 61.0% (36/59) |

All four half-seasons and both full seasons exceed the 52.38% break-even floor.

### 8.2 Away +1.5 Run Line

| Metric | Value |
|--------|-------|
| Cover rate | 69.4% (1,317/1,897) |
| MLB base rate | 64.0% |
| Edge over base | +5.4 pp |
| ROI at -156 median | +13.8% |

**By margin threshold:**

| Threshold | N | Cover % | Edge over 64% |
|-----------|---|---------|---------------|
| >= 0.00 | 1,897 | 69.4% | +5.4 pp |
| >= 0.15 | 1,527 | 69.7% | +5.7 pp |
| >= 0.25 | 1,003 | 72.3% | +8.3 pp |

Monotonic: higher conviction thresholds produce higher cover rates.

### 8.3 Away Ace (Tier 4)

| Metric | Value |
|--------|-------|
| Cover rate | 81.2% (69/85) |
| 2024 | 84.0% (37/44) |
| 2025 | 80.0% (33/41) |
| ROI at -156 | +33.2% |
| Mean margin | 0.514 runs |

---

## 9. Components Investigated and Excluded

The following components were rigorously tested during Phase 2 and Phase 3 development. Each was evaluated against the same walk-forward gate criteria. All failed to improve the validated baseline and were excluded from production.

### 9.1 Bullpen Quality Adjustment

**Hypothesis:** Replacing the implicit league-average bullpen assumption with team-specific bullpen ERA would improve total projections.

**Implementation:** Trailing 30-day team bullpen ERA with Bayesian shrinkage to a dynamic (not hardcoded) league average. Combined with per-pitcher starter IP projection (RMSE 1.33, correlation 0.353 — both passed standalone gates).

**Result:** Walk-forward ATS degraded from 56.7% to 52.2% (-4.5 pp). The adjustment reclassified borderline games across the 0.83-run edge threshold. Games newly qualifying as under picks performed below break-even. Games removed from the pool were actually good picks.

**Conclusion:** The implicit league-average bullpen assumption produces better total projections than the explicit team-specific adjustment. Team-level bullpen ERA adds noise, not signal, to game totals.

### 9.2 Bullpen Fatigue

**Hypothesis:** Teams with heavily used bullpens in recent days would allow more runs.

**Implementation:** Weighted trailing bullpen IP (yesterday × 0.50, 2-day × 0.30, 3-day × 0.15, 4-day × 0.05).

**Result:** Correlation with actual bullpen ERA: r = 0.003 on 14,478 team-game observations. Statistically indistinguishable from zero. The tier analysis was non-monotonic: teams with the lowest fatigue scores (seemingly fresh bullpens) actually had the highest ERA — because low fatigue correlates with off-days and opener games, not bullpen freshness.

**Conclusion:** Permanently excluded. No recoverable signal.

### 9.3 Rest and Travel Effects

**Hypothesis:** Road trip fatigue (day 5+) or cross-country travel would degrade away team performance.

**Result:** Road trip days 5+ combined: mean error = +0.087 runs on 1,830 games, p = 0.207 (not significant). Off-day effect (both teams off): mean error = +0.681 runs, p = 0.015 — but this was an artifact of Opening Day and All-Star break games (non-representative scheduling).

**Conclusion:** Permanently excluded. No actionable signal.

### 9.4 First 5 Innings (F5) Product

**Hypothesis:** Projecting only the first 5 innings would isolate the starter signal and remove bullpen variance, producing a cleaner betting product.

**Result:** Maximum ATS achieved was 56.3% — below the full-game under product's 58.8%. The hypothesis that bullpen innings are a meaningful source of noise was not supported.

**Conclusion:** Not validated. Full-game product is superior.

### 9.5 Over Product

**Hypothesis:** Games where the model projects significantly above the Vegas total should be actionable over bets.

**Result:** All-threshold ATS: 49–51% (below break-even). The structural issue is that Vegas systematically under-prices totals by approximately 0.32 runs. When the model projects above Vegas, it is often merely agreeing with the true scoring rate that the market has already partially corrected for. Even after bias correction (subtracting 0.318 from all projections), overs still hit only 49.2%.

A May-June subset showed 55.7% on 115 games (2024: 57.4% on 61, 2025: 53.7% on 54). This signal is monitored under the "Over Watch" label but does not meet gate criteria for a wagering recommendation.

**Conclusion:** Not validated. Displayed as monitoring signal with "Calibrating" label.

### 9.6 Temperature Projection Adjustment

**Hypothesis:** Extreme temperatures (cold or hot) could be incorporated as a direct adjustment to the projected total.

**Testing approach:** Three variants tested:
1. **Global linear coefficient** (+0.043 runs/°F deviation, p = 0.0024 on outdoor parks): Added 86 marginal games that performed at ~48% ATS. Overall under ATS decreased by 3.8 pp.
2. **Weather-adjusted thresholds** (cold edge >= 0.70, warm edge >= 1.00): Only 3 games reclassified at Wrigley. Net impact -1.2 pp.
3. **Park-specific early-season cold** (9 northern parks, March-May, < 50°F): 11 newly added games went 4/11 = 36.4% ATS. Existing under picks at those parks already covered at 75.0% (12/16) — no room to improve.

**Conclusion:** Temperature does not produce a consistent enough pattern to adjust the projection. All three variants failed the variance check by adding borderline games that do not cover. Temperature badges (informational only) are displayed on the platform to flag uncertainty without modifying the projection.

### 9.7 Humidity

**Regression result:** p = 0.42. Not independent of temperature. In a combined regression (temp deviation + humidity), humidity p = 0.12 while temperature p = 0.0006. Humidity provides no incremental signal beyond temperature.

**Conclusion:** Permanently excluded.

### 9.8 Barometric Pressure

**Regression result (non-Coors parks):** p = 0.72. No significant relationship between pressure and scoring residuals.

**Conclusion:** Permanently excluded.

### 9.9 Coors Field Humidity (Humidor Effect)

**Hypothesis:** Coors Field's humidor (introduced to reduce home run rates) would create a humidity-scoring interaction unique to Denver.

**Result:** Non-monotonic across humidity tiers. No consistent pattern that could be modeled.

**Conclusion:** Permanently excluded. The existing Coors park factor (1.27) captures the altitude effect adequately.

---

## 10. Open Items and Forward-Looking Agenda

### 10.1 Scheduled Reviews

| Item | Deadline | Description |
|------|----------|-------------|
| wOBA Slope Recalibration | June 1, 2026 | Declining trend: 31.85 → 30.38 → 29.05. Compute 2026 preliminary. If < 28.5, recalibrate mid-season. |
| 2026 Summer Gate | September 2026 | Pre-registered Condition A: If Jul–Sep 2026 under ATS >= 52.38% at edge >= 0.83, summer limitation is confirmed as single-year anomaly. |
| Over Product Re-evaluation | September 2026 | If Over Watch signal sustains 53%+ on 80+ live games, formal gate re-evaluation. |
| Away Ace Live Sample | September 2026 | First meaningful inference at n >= 50 live games. |
| Gate 5 Monotonicity | September 2026 | Investigate Tier 3 (>= 1.50, 55.6% ATS) underperforming Tier 2 (>= 1.25, 58.9%) by 3.3 pp. Determine whether structural or sample noise. |

### 10.2 Deferred Components

| Component | Status | Dependency |
|-----------|--------|-----------|
| Wind adjustment at Oracle Park and other exposed parks | Deferred | Requires 2026 full-season data (60+ games per wind direction) |
| Leverage context (high-leverage reliever classification) | Deferred | Requires MLB Gameday API enhancement for pitcher entry inning and score-at-entry |
| Catcher framing (continuous model) | Deferred | Phase 1c binary tiers showed zero impact; revisit only with continuous per-matchup model |
| HCA venue-specific refinement | Deferred | Current HCA of 0.02 is adequate; team-specific adjustments unlikely to improve with N < 162 per team |

### 10.3 Monitoring Metrics

The following metrics are tracked on every pipeline run and reviewed at 250-game and 500-game marks during the 2026 live season:

- Under ATS at edge >= 0.83 (target: >= 55%)
- Away +1.5 cover rate (target: >= 66%)
- Monthly bias (model total - actual total, by month)
- Wrigley wind adjustment hit rate (first live test: April 1, 2026)
- Temperature badge correlation with outcomes (informational)

---

## Appendix A — Park Factors

All 27 unique park factors used in production (as of April 1, 2026):

| Park | Factor | Notes |
|------|--------|-------|
| Coors Field | 1.270 | Highest — altitude effect |
| Chase Field | 1.090 | Corrected from 1.02 |
| Fenway Park | 1.050 | Green Monster effect |
| Great American Ball Park | 1.048 | Corrected from 1.09 |
| Citizens Bank Park | 1.040 | |
| Dodger Stadium | 1.032 | Corrected from 0.99 |
| Target Field | 1.031 | Corrected from 0.99 |
| Yankee Stadium | 1.030 | Short porch |
| loanDepot park | 1.023 | Corrected from 0.98 |
| Angel Stadium | 1.011 | Corrected from 0.98 |
| Nationals Park | 1.010 | |
| Rogers Centre | 1.008 | Corrected from 0.97 |
| Oakland Coliseum | 1.003 | Corrected from 0.95 |
| Busch Stadium | 1.000 | Neutral |
| Minute Maid Park | 1.000 | |
| American Family Field | 0.980 | |
| Guaranteed Rate Field | 0.976 | Corrected from 1.03 |
| Truist Park | 0.973 | Corrected from 1.00 |
| PNC Park | 0.970 | |
| Kauffman Stadium | 0.970 | |
| Wrigley Field | 0.968 | Corrected from 1.02 |
| Comerica Park | 0.960 | |
| Progressive Field | 0.960 | |
| Globe Life Field | 0.959 | Corrected from 1.06 (largest correction) |
| Tropicana Field | 0.950 | Fixed dome |
| T-Mobile Park | 0.940 | Retractable roof |
| Petco Park | 0.930 | |
| Oracle Park | 0.900 | Most pitcher-friendly |

---

## Appendix B — Season Configuration

| Parameter | 2024 Season | 2025 Season | 2026 Season |
|-----------|------------|------------|------------|
| wOBA slope | 31.85 | 30.38 | 29.05 |
| wOBA intercept | -5.67 | -5.13 | -4.76 |
| Prior FIP season | 2023 | 2024 | 2025 |
| League avg RPG baseline | 4.407 | 4.393 | 4.447 |
| Pitcher blend w (full season) | 0.67 | 0.67 | 0.67 |
| Offense blend w (full season) | 0.75 | 0.75 | 0.75 |
| Alpha (pitcher/offense weight) | 0.50 | 0.50 | 0.50 |
| HCA (total runs) | 0.02 | 0.02 | 0.02 |

---

## Appendix C — Glossary

| Term | Definition |
|------|-----------|
| **ATS** | Against The Spread. Win rate of picks against the Vegas posted line. 52.38% is break-even at -110 juice. |
| **FIP** | Fielding Independent Pitching. Measures pitcher quality using only strikeouts, walks, HBP, and home runs. |
| **wOBA** | Weighted On-Base Average. Offensive metric weighting each event by its run-scoring value. |
| **NB** | Negative Binomial. A probability distribution that generalizes the Poisson by adding overdispersion. |
| **ROI** | Return on Investment. Net profit as a percentage of total wagered. |
| **Edge** | Difference between the model's projection and the Vegas posted line. |
| **Walk-Forward** | Validation method where each game is projected using only data available before that game. No future information. |
| **Point-in-Time (PIT)** | Data access policy ensuring no lookahead bias. Each day's projection uses only data that existed on that date. |
| **Park Factor** | Multiplicative adjustment for venue-specific scoring effects. 1.00 = neutral. > 1.00 = hitter-friendly. < 1.00 = pitcher-friendly. |
| **Re-Anchoring** | Adjusting the league scoring baseline using a trailing 30-day window to capture seasonal shifts. |
| **Bayesian Shrinkage** | Blending a noisy current estimate with a stable prior to reduce variance. Weight increases as sample size grows. |
| **Opener Game** | A game where the listed starter pitches only 1–2 innings before being relieved by the "bulk" pitcher. Different usage pattern from traditional starts. |
| **Dispersion Index** | Ratio of variance to mean. Equal to 1 for Poisson. Greater than 1 indicates overdispersion. |
| **Home Tie Share** | Fraction of tied games (entering extras) won by the home team (0.53), reflecting the walk-off advantage. |

---

*This memorandum describes the BBMI MLB model as deployed on April 1, 2026. Model parameters, validation results, and product definitions are subject to revision based on ongoing monitoring and the scheduled September 2026 review.*
