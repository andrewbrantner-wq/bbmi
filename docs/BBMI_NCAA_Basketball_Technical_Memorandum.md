# BBMI NCAA Basketball Model — Technical Memorandum

**Prepared by:** BBMI Sports Analytics
**Date:** April 1, 2026
**Model Version:** Production (Progressive Stretch, 11-Feature Ensemble)
**Validation Period:** 2023–2026 NCAA seasons (3-season walk-forward)

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
12. [Appendix A — Stat Weights](#appendix-a--stat-weights)
13. [Appendix B — Quality Wins Tiers](#appendix-b--quality-wins-tiers)
14. [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Executive Summary

The BBMI NCAA Basketball model generates spread predictions, over/under totals, and win probabilities for all Division I men's basketball games. The model uses a percentile-rank ensemble of 11 statistical features, calibrated through a progressive line stretch formula that converts raw BBMI score differentials into point spread projections.

The model's edge derives from its architecture — the progressive stretch formula and KenPom efficiency baseline — rather than from weight optimization. A 3-season actuarial audit with permutation testing confirmed that the optimization surface is flat: the top 20 weight combinations span only 0.23 pp (51.24% to 51.47% ATS out-of-sample).

| Product | Performance | Sample | Status |
|---------|------------|--------|--------|
| ATS Spread (all picks) | ~52–53% ATS | Multi-season | Validated |
| ATS Spread (edge >= 5 pts) | 56–58% ATS | Filtered subset | Primary product |
| Over/Under | ~52–54% ATS | Multi-season | Validated |

---

## 2. Model Architecture

```
Step 1   Fetch team statistics (ESPN API, KenPom)
Step 2   Calculate recency-weighted stats per team
Step 3   Percentile rank each stat (1–50 scale)
Step 4   Weighted aggregate → BBMI composite score
Step 5   Apply ranking cap (10–20 spots/day max improvement)
Step 6   Calculate residual-based home court advantage per team
Step 7   Raw line = (away_BBMI - home_BBMI + HCA) × multiplier
Step 8   Progressive stretch (calibrated non-linear transformation)
Step 9   Snap to nearest 0.5 (never whole number)
Step 10  Over/Under via KenPom efficiency × pace × modifiers
Step 11  Win probability via Normal CDF
Step 12  Edge calculation (BBMI line vs Vegas line)
```

### Design Principles

- **Percentile-rank ensemble.** Each statistic is ranked on a 1–50 scale across all 351+ D-I teams, then weighted and aggregated. This normalizes different stat scales and reduces sensitivity to outliers.

- **Progressive stretch, not linear.** A raw BBMI score differential of 2 points does not translate to a 2-point spread. The progressive stretch amplifies small edges more aggressively than large ones, reflecting the non-linear relationship between quality differential and margin of victory.

- **Residual-based HCA.** Each team's home court advantage is computed from the residual between actual margin and model projection, separately for home and away games. This captures venue-specific crowd effects rather than applying a single national average.

- **Ranking cap.** Teams cannot improve more than 10–20 ranking spots per day, preventing a single upset win from causing a volatile ranking jump. This stabilizes the model while allowing gradual assessment updates.

---

## 3. Input Data and Calibration

### 3.1 Statistical Features

The model uses 11 features, each percentile-ranked and weighted:

| Feature | Weight | Higher Is Better | Description |
|---------|--------|-----------------|-------------|
| fg_diff | 0.156 | Yes | Field goal percentage differential |
| adjD | 0.139 | No | KenPom adjusted defensive efficiency |
| turnovers | 0.123 | Yes | Turnover rate differential |
| ft_pct | 0.089 | Yes | Free throw percentage |
| rebounds | 0.089 | Yes | Rebound rate differential |
| assists | 0.089 | Yes | Assists per game |
| quality_wins | 0.084 | Yes | Schedule-adjusted win value (tier-weighted) |
| adjO | 0.083 | Yes | KenPom adjusted offensive efficiency |
| ft_rate_diff | 0.080 | Yes | Free throw rate differential |
| three_pt_diff | 0.034 | Yes | Three-point percentage differential |
| last10 | 0.034 | Yes | Win-loss record in last 10 games |

**Total: 1.000**

### 3.2 KenPom Efficiency Metrics

KenPom's adjusted efficiency ratings measure points scored (adjO) and allowed (adjD) per 100 possessions, adjusted for opponent strength. These are the most predictive single inputs available for college basketball.

- **adjO** (adjusted offensive efficiency): Higher = better offense
- **adjD** (adjusted defensive efficiency): Lower = better defense
- **adjTempo** (adjusted tempo): Possessions per 40 minutes

**Collinearity finding:** adjO and adjD exhibit near-perfect collinearity (r = 0.947 in both 2023–24 and 2024–25). Collapsing to a single adjNetEff = adjO - adjD is out-of-sample neutral (52.2% vs 52.3% ATS). The model retains separate features for now but this is flagged for architectural cleanup.

### 3.3 Quality Wins

Games are valued based on the opponent's rank, with bonuses for beating highly ranked teams and penalties for losing to weaker opponents. See Appendix B for the full tier table.

### 3.4 Percentile Ranking

Each stat is ranked across all D-I teams on a 1–50 scale. The weighted aggregate is then multiplied by 0.8 to produce the final BBMI composite score. Lower-bound adjustment for quality wins compresses the scale to 80%, penalizing teams with weak schedules.

---

## 4. Spread Projection Engine

### 4.1 Raw Line

```
raw_line = (away_BBMI - home_BBMI + HCA) × BBMI_LINE_MULTIPLIER
```

Where:
- `BBMI_LINE_MULTIPLIER = 1.42` (OLS-calibrated, March 2026)
- `HCA = 3.5 points` (baseline; team-specific adjustments via residual method)

### 4.2 Progressive Stretch

The raw line is transformed through a non-linear function that amplifies small differentials and compresses extreme ones:

```
progressive_line(raw) = sign(raw) × (1.0 × |raw| + 2.0 × sqrt(|raw|))
```

| Raw Line | Progressive Output | Effective Multiplier |
|----------|-------------------|---------------------|
| 2.0 | 4.83 | 2.4× |
| 5.0 | 9.47 | 1.9× |
| 10.0 | 16.32 | 1.6× |
| 15.0 | 22.75 | 1.5× |
| 20.0 | 28.94 | 1.4× |

This captures the empirical reality that a team with a slight quality edge wins by a wider margin than a linear model would predict, while extreme quality gaps (e.g., #1 vs #300) don't produce proportionally extreme blowouts.

### 4.3 Home Court Advantage

**Baseline HCA:** 3.5 points

**Team-specific HCA** (residual method):
```
true_hca = (home_residual - away_residual) / 2
adjusted_hca = true_hca × 0.4    (scale down for stability)
capped_hca = min(adjusted_hca, 7.0)
final_hca = max(-capped_hca, 0.0)   (never positive — always favors home)
```

The residual is computed from the difference between actual margin and model-projected margin, separately for home and away games. This captures venue-specific effects (altitude, crowd size, travel burden) without relying on assumptions.

### 4.4 Line Snapping

The final spread is rounded to the nearest 0.5 and never allowed to be a whole number (to prevent pushes):
```
if bbmi_line == int(bbmi_line): bbmi_line ± 0.5
```

### 4.5 Worked Example

Duke (home, BBMI score 42.5) vs North Carolina (away, BBMI score 38.0). Duke's team-specific HCA is 4.2 points.

```
raw_line = (38.0 - 42.5 + 4.2) × 1.42 = -0.426
progressive = -sign(0.426) × (1.0 × 0.426 + 2.0 × sqrt(0.426))
            = -(0.426 + 2.0 × 0.653) = -(0.426 + 1.306) = -1.73
snapped = -1.5 (Duke -1.5)
```

Duke is projected as a 1.5-point favorite. If Vegas has Duke -4.5, the edge is 3.0 points toward North Carolina.

---

## 5. Over/Under Total Projection

The O/U model uses KenPom efficiency ratings crossed with pace to project total points.

### 5.1 Pace Projection

```
raw_pace = (tempo_home + tempo_away) / 2.0
projected_poss = raw_pace × 0.75 + AVG_TEMPO × 0.25
```

Where `AVG_TEMPO = 67.4` possessions (league average, dynamically computed). The 25% regression toward the league mean dampens extreme pace projections.

### 5.2 Efficiency Interaction

```
home_pts_per_100 = adjO_home × (adjD_away / AVG_ADJ_EFFICIENCY)
away_pts_per_100 = adjO_away × (adjD_home / AVG_ADJ_EFFICIENCY)
```

Where `AVG_ADJ_EFFICIENCY = 109.3` (league average). This cross-references each team's offensive efficiency against the opponent's defensive efficiency.

### 5.3 Scale to Game Points

```
home_pts = home_pts_per_100 × projected_poss / 100.0
away_pts = away_pts_per_100 × projected_poss / 100.0
```

### 5.4 Adjustments

| Adjustment | Formula | Notes |
|-----------|---------|-------|
| HCA total bump | `home_pts += abs(hca) × 0.25` | Home teams score slightly more |
| Recent form | `±0.25 pts × (last10_wins - 5.0)` | Each win above .500 adds 0.25 |
| Neutral site | `-2.5 pts total` | Tournament/neutral games score lower |
| FG% diff / 3PT% diff | Disabled (weight = 0.0) | Too noisy game-to-game |

### 5.5 Win Probability Standard Deviation

The O/U model uses `STD_DEV_TOTAL = 11.55` points for edge calculation, reflecting higher uncertainty in pace-dependent total projections compared to margin projections.

---

## 6. Win Probability

Win probability is computed using a Normal distribution CDF:

```
Z = bbmi_line / (STD_DEV × sqrt(2))
P(home wins) = 1 - erfc(Z) / 2
```

Where `STD_DEV = 10.75` points. This is calibrated to minimize Brier score across the walk-forward sample.

**Example:** BBMI line = -6.5 (home favored by 6.5).
```
Z = -6.5 / (10.75 × 1.414) = -6.5 / 15.20 = -0.428
P(home wins) = 1 - erfc(-0.428)/2 ≈ 0.666 = 66.6%
```

---

## 7. Product Definitions and Examples

### 7.1 ATS Spread Pick

**Signal:** BBMI's projected spread differs from the Vegas spread by a meaningful amount.

```
edge = |bbmi_line - vegas_line|
pick_direction: if bbmi_line > vegas_line → pick away; if < → pick home
```

**Example:** BBMI projects Kansas -3.5. Vegas has Kansas -8.5. Edge = 5.0 points. Pick: Kansas opponent (cover +8.5).

### 7.2 Edge Classification

| Edge | Classification | Description |
|------|---------------|-------------|
| >= 5.0 pts | High edge | Primary product — strongest signal |
| 3.0–5.0 pts | Medium edge | Secondary — included with lower conviction |
| 0.5–3.0 pts | Low edge | Marginal — included for completeness |
| < 0.5 pts | No edge | Filtered out |

### 7.3 Over/Under Pick

Same edge framework applied to the total projection:
```
ou_edge = bbmi_total - vegas_total
if ou_edge > threshold → OVER
if ou_edge < -threshold → UNDER
```

---

## 8. Walk-Forward Validation Protocol

### 8.1 Methodology

The model was validated across three seasons using walk-forward methodology:
- **2023–24:** Training data
- **2024–25:** Out-of-sample test (trained on 2023–24)
- **2025–26:** Live season with rolling updates

Feature snapshots are captured at end-of-season for walk-forward testing. No future information enters any projection. KenPom snapshots are locked per walk-forward year.

### 8.2 Permutation Test

A permutation test was conducted to verify that the model's performance is not an artifact of optimization:
- **Method:** Shuffle game outcomes randomly, re-run the full weight optimization
- **Result:** Shuffled data produces the same "best" ATS (51.47%) as real data
- **Conclusion:** Weight optimization finds patterns in search space geometry, not in the underlying signal. The model's edge comes from its architecture (progressive stretch, KenPom baseline), not from weight tuning.

### 8.3 Seasonal Windows

Performance is tracked across three seasonal windows:
- **Early season (Nov–Dec):** Highest uncertainty, heaviest reliance on preseason ratings
- **Mid-season (Jan–Feb):** Sample accumulation, weight recalibration
- **Late season (Mar–Apr):** Conference tournaments, NCAA tournament

---

## 9. Validated Results

### 9.1 Spread ATS

| Metric | Value |
|--------|-------|
| Overall ATS (3-season) | ~52–53% |
| High-edge ATS (>= 5 pts) | 56–58% |
| Progressive stretch validation | 75.2% on 2,231 picks (in-sample calibration) |
| Optimization surface span | 0.23 pp across top 20 combos |
| Equal weights baseline | 51.1% OOS |

### 9.2 Seasonal Stability

| Season Window | ATS | Notes |
|--------------|-----|-------|
| 2023–24 late season | 41.6% | Genuine outlier |
| 2024–25 tournament | 51.8% | Adequate |
| 2025–26 tournament | 53.8% | Above break-even |
| 2025–26 March production | 52.7% (419 games) | Above break-even |

### 9.3 Calibration History

| Parameter | Original | Current | Calibration Date |
|-----------|----------|---------|-----------------|
| BBMI_LINE_MULTIPLIER | Variable | 1.42 | 2026-03-03 (OLS fit) |
| STD_DEV | 9.0 | 10.75 | 2026-03-14 (Brier score) |
| Progressive stretch D | N/A | 2.0 | 2026-03-20 (75.2% ATS) |

---

## 10. Components Investigated and Excluded

### 10.1 Tournament Stretch Dampener

**Hypothesis:** The progressive stretch formula over-amplifies edges in March Madness, causing systematic favorites bias in tournament games.

**Testing:** Tested D = 0.0 (pure linear) through D = 2.0 (production) across 938 tournament games over 3 seasons.

**Result:** ATS range: 50.2% to 50.6% — completely flat. No dampener value improves tournament performance. Large Elite 8 edges (e.g., BBMI -15 vs Vegas -7.5) are individual game noise, not systematic miscalibration.

**Conclusion:** Permanently excluded. Production D = 2.0 retained.

### 10.2 adjO/adjD Collapse to Net Efficiency

**Hypothesis:** Since adjO and adjD are nearly perfectly correlated (r = 0.947), collapsing them to a single net efficiency metric would simplify the model without losing performance.

**Result:** Out-of-sample neutral (52.2% vs 52.3% ATS). An architectural cleanup, not a performance improvement.

**Status:** Deferred. Will activate only after production snapshot data confirms collinearity in live model.

### 10.3 ft_rate_diff Weight Reduction

**Finding:** ft_rate_diff was overweighted at 0.123. Stable at 0.06–0.08 across all validation cuts: 3-season, 2-season, every window, constrained and unconstrained.

**Action:** Cut to 0.080 and shipped. The only weight change from the full audit that survived every check.

### 10.4 Turnovers Weight Increase

**Finding:** Constrained grid search placed turnovers at 0.130 (vs current 0.123) — directionally consistent but within grid step size (0.03). Signal unstable: shifts from 0.130 (3-season) to 0.100 (2-season excluding 2023–24).

**Status:** Deferred until clean production snapshot dataset exists.

### 10.5 Last10 (Recent Form)

**Status:** Weight reduced to 0.034 (effective zero in some configurations). Recent form is captured through recency-weighted box score stats; a separate last10 indicator adds marginal value at best.

### 10.6 FG% and 3PT% Modifiers in Totals

**Status:** Both weights zeroed in the O/U model. Game-to-game shooting percentages are too noisy to improve total projections. KenPom efficiency already captures sustained shooting ability.

---

## 11. Open Items and Forward-Looking Agenda

### 11.1 Offseason Roadmap (2026)

| Item | Target | Description |
|------|--------|-------------|
| BoundScraper git + process controls | Complete | Version control for pipeline changes |
| fakeWin test | August 2026 | Verify no data leakage in win/loss encoding |
| Snapshot validation | Mid-offseason | Verify feature snapshots match point-in-time enforcement |
| adjO/adjD collapse | Mid-offseason | If collinearity confirmed in production data, simplify |
| Phase 2 walk-forward | 2-season project | Full multi-season walk-forward with production snapshots |

### 11.2 Monitoring Metrics

- Weekly ATS by edge bucket
- Monthly ATS by seasonal window (Early/Mid/Late)
- Conference tournament run-up week (2/23–3/1 soft spot monitoring)
- O/U ATS with pace-adjusted analysis

---

## Appendix A — Stat Weights

| Stat | Weight | Direction | Data Source |
|------|--------|-----------|-------------|
| fg_diff | 0.156 | Higher = better | ESPN box scores |
| adjD | 0.139 | Lower = better | KenPom |
| turnovers | 0.123 | Higher = better (forcing TOs) | ESPN box scores |
| ft_pct | 0.089 | Higher = better | ESPN box scores |
| rebounds | 0.089 | Higher = better | ESPN box scores |
| assists | 0.089 | Higher = better | ESPN box scores |
| quality_wins | 0.084 | Higher = better | Computed from results + opponent rank |
| adjO | 0.083 | Higher = better | KenPom |
| ft_rate_diff | 0.080 | Higher = better | ESPN box scores |
| three_pt_diff | 0.034 | Higher = better | ESPN box scores |
| last10 | 0.034 | Higher = better | ESPN results |

---

## Appendix B — Quality Wins Tiers

| Opponent Rank | Win Bonus | Close Loss (<=5 pts) | Loss Penalty |
|--------------|-----------|---------------------|-------------|
| 1–15 (Tier 1) | +15.0 | +3.0 | -2.5 |
| 16–35 (Tier 2) | +7.5 | +1.0 | -4.0 |
| 36–100 (Tier 3) | +2.0 | — | -8.0 |
| 101+ (Tier 4) | — | — | -5.0 |

Close losses against elite opponents are valued positively — a 3-point road loss to a top-15 team demonstrates competitive quality.

---

## Appendix C — Glossary

| Term | Definition |
|------|-----------|
| **BBMI Score** | Composite percentile-ranked team rating (higher = better) |
| **Progressive Stretch** | Non-linear transformation that converts raw score differentials to point spreads; amplifies small edges, compresses large ones |
| **adjO / adjD** | KenPom adjusted offensive/defensive efficiency (points per 100 possessions vs average opponent) |
| **adjTempo** | KenPom adjusted tempo (possessions per 40 minutes) |
| **Ranking Cap** | Maximum daily ranking improvement (10 spots if ranked <=75, 20 spots if >75) |
| **Residual HCA** | Team-specific home court advantage derived from the gap between actual and projected margins at home vs away |
| **Permutation Test** | Statistical test that shuffles outcomes to determine if optimization results exceed chance |
| **STD_DEV** | Standard deviation of score margin distribution (10.75 pts), used for win probability calculation |

---

*This memorandum describes the BBMI NCAA Basketball model as of April 1, 2026. Model parameters and validation results are subject to revision based on ongoing monitoring and the 2026 offseason review.*
