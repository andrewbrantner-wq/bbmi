# BBMI NCAA Baseball Model — Technical Memorandum

**Prepared by:** BBMI Sports Analytics
**Date:** April 1, 2026
**Model Version:** V4 (Poisson Engine, ERA-Based Pitcher Adjustment, Self-Computed Park Factors)
**Validation Period:** 2024–2025 NCAA seasons (walk-forward)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Model Architecture](#2-model-architecture)
3. [Input Data and Calibration](#3-input-data-and-calibration)
4. [Projection Engine](#4-projection-engine)
5. [Scoring Distribution — Poisson Engine](#5-scoring-distribution--poisson-engine)
6. [Product Definitions and Examples](#6-product-definitions-and-examples)
7. [Walk-Forward Validation Protocol](#7-walk-forward-validation-protocol)
8. [Validated Results](#8-validated-results)
9. [Components Investigated and Excluded](#9-components-investigated-and-excluded)
10. [Open Items and Forward-Looking Agenda](#10-open-items-and-forward-looking-agenda)
11. [Appendix A — Rating Component Weights](#appendix-a--rating-component-weights)
12. [Appendix B — Conference Tiers](#appendix-b--conference-tiers)
13. [Appendix C — Glossary](#appendix-c--glossary)

---

## 1. Executive Summary

The BBMI NCAA Baseball model projects game-level scoring using a Poisson engine with two core team ratings (offense and defense), pitcher-specific adjustments, park factors, and conference tier offsets. The model produces two validated wagering products:

| Product | Walk-Forward ATS | Sample | Status |
|---------|-----------------|--------|--------|
| Total Under (edge >= 1.5 runs) | 61.7% | 436 games (2025) | Validated — primary product |
| Spread (edge 2.0–5.0 runs) | 54.4% | 1,977 games | Validated — co-primary |

The model is structurally an "under-finder" — it identifies games where the projected total is meaningfully below the Vegas posted line. The under product achieves a higher ATS than the spread product because college baseball totals are less efficiently priced by the market than spreads.

---

## 2. Model Architecture

```
Step 1   Calculate team offensive rating (wOBA, OBP, SLG, SB, SOS, adj R/G)
Step 2   Calculate team defensive rating (FIP, bullpen ERA, WHIP, K/9)
Step 3   Apply re-anchoring (force league-average ratings to match actual league R/G)
Step 4   Base run projection = (team_off + opponent_def) / 2
Step 5   Apply pitcher adjustment (ERA-based, Bayesian shrinkage)
Step 6   Apply park factor
Step 7   Apply home-field advantage (+0.6 runs total)
Step 8   Apply conference tier offset
Step 9   Apply series position and day-of-week adjustments
Step 10  Apply workload and bullpen fatigue adjustments
Step 11  Poisson win probability from projected runs
Step 12  Spread = margin × BBMI_LINE_MULTIPLIER (2.0)
Step 13  Total = home_proj + away_proj + day-of-week adjustment
Step 14  Edge calculation vs Vegas
```

### Design Principles

- **Team ratings, not individual matchups.** The model computes team-level offensive and defensive ratings. Individual pitcher adjustments are layered on top but cannot override the team signal. Walk-forward testing confirmed team FIP captures 85% of the pitcher signal.

- **Poisson scoring.** College baseball games have lower, more discrete scoring patterns than MLB. The Poisson distribution (which assumes variance equals the mean) is an adequate approximation for college baseball where fewer extreme blowouts occur.

- **Re-anchoring.** Offensive and defensive ratings are dynamically re-anchored so that the league-average composite always equals the actual observed league-average R/G. This prevents systematic over- or under-projection as the scoring environment shifts during the season.

- **Under-first product hierarchy.** The model's highest-validated signal is in identifying unders. Over picks (44% ATS) are an anti-signal. The model is calibrated to maximize under pick quality.

---

## 3. Input Data and Calibration

### 3.1 Team Offensive Rating

Six components weighted to produce an offensive runs-per-game estimate:

| Component | Weight | Scaling | Description |
|-----------|--------|---------|-------------|
| adj_runs_per_game | 0.25 | Raw | Adjusted runs scored per game |
| wOBA (or OPS) | 0.25 | × 15.0 | Weighted on-base average |
| OBP | 0.20 | × 12.0 | On-base percentage |
| SLG | 0.10 | × 10.0 | Slugging percentage |
| Stolen base rate | 0.10 | × 2.0 | Team speed/aggressiveness |
| SOS adjustment | 0.10 | (150 - SOS_rank) / 300 | Strength of schedule correction |

**Regression to mean:** 25% blend toward league average (6.5 R/G baseline, dynamically updated).

**Re-anchoring:** The final rating is multiplied by `_REANCHOR_OFF` (currently 1.308) to force the league-average offensive rating to equal the actual observed league R/G.

### 3.2 Team Defensive Rating

Five components (one disabled) weighted to produce a defensive runs-allowed-per-game estimate:

| Component | Weight | Description |
|-----------|--------|-------------|
| Team FIP (starters) | 0.35 | Fielding-independent pitching of starting rotation |
| Bullpen ERA/FIP | 0.25 | Relief pitching quality |
| WHIP | 0.20 | Walks + hits per inning pitched (× 3.0 scaling) |
| K/9 | 0.20 | Strikeouts per 9 innings (inverted: (10 - K/9) × 0.5) |
| Fielding % | 0.00 | Removed — notoriously poor quality in college data |

**SOS adjustment for defense:** `(SOS_rank - 150) / 150 × 0.3`

**Regression and re-anchoring:** Same 25% regression to mean, multiplied by `_REANCHOR_DEF` (currently 1.275).

### 3.3 FIP Formula

```
FIP = (13 × HR + 3 × (BB + HBP) - 2 × K) / IP + 3.2
```

**Key finding:** In college baseball, FIP and ERA correlate at r = 0.157 vs r = 0.158. Theory (FIP) does not outperform direct observation (ERA) because noise in the college game swamps the theoretical advantage of FIP's defense-independence. Both are used: FIP for team ratings (more stable), ERA for individual pitcher adjustments (more responsive).

### 3.4 Pitcher Adjustment

Individual pitcher quality is modeled as an ERA-based deviation from team average, with Bayesian shrinkage:

```
shrunk_ERA = individual_weight × pitcher_ERA + team_weight × team_ERA
adjustment = clamp((shrunk_ERA - team_ERA) × PITCHER_K, -2.0, +2.0)
```

Where `PITCHER_K = 0.18` (calibrated on 1,114 games with known starters).

**Shrinkage schedule:**

| Starts | Individual Weight | Team Weight |
|--------|------------------|-------------|
| 0–2 | 0% | 100% |
| 3 | 37.5% | 62.5% |
| 5 | 62.5% | 37.5% |
| 8+ | 85% | 15% |

**Cap:** ±2.0 runs maximum adjustment per pitcher. This prevents a single outlier pitcher ERA from dominating the projection.

### 3.5 Park Factors

Self-computed from observed data, team-quality-adjusted:

```
implied_pf = (team_home_rpg × 2) / (team_home_rpg + team_away_rpg)
```

Adjusted for team quality (strong teams inflate home RPG by winning more), with 30% regression toward 1.0 and weekly updates. Minimum 8 home games required for a park factor computation.

**Notable park factors:**

| Category | Examples | Factor Range |
|----------|---------|-------------|
| High altitude / hitter-friendly | Colorado State (1.15), Air Force (1.15), Wyoming (1.12) | 1.06–1.15 |
| Power conference pitchers' parks | Vanderbilt (0.92), Virginia (0.93), Stanford (0.93) | 0.92–0.96 |
| Neutral | Most parks | 0.97–1.03 |

Factors are capped at the 0.80–1.25 range.

### 3.6 Home-Field Advantage

**HCA = 0.6 runs** (flat, applied as +0.3 home / -0.3 away).

The HCA adjustment cancels in the total projection (both sides receive equal-and-opposite adjustments) and only affects the spread. Team-specific home/away splits were tested and rejected (stability r = 0.026, pure noise).

---

## 4. Projection Engine

### 4.1 Base Run Projection

```
home_proj = (home_off + away_def) / 2.0
away_proj = (away_off + home_def) / 2.0
```

This crosses each team's offensive capability against the opponent's defensive quality. The average produces a balanced estimate that accounts for both sides of the matchup.

### 4.2 Sequential Adjustments

Applied in order after the base projection:

| Adjustment | Formula | Description |
|-----------|---------|-------------|
| Pitcher | +/- (shrunk ERA - team ERA) × 0.18 | Individual starter quality |
| Park factor | × park_factor | Venue-specific scoring environment |
| HCA | +0.3 home / -0.3 away | Home-field advantage |
| Conference tier | +/- offset / 2 per team | Cross-tier matchup adjustment |
| Series position | Defense × 0.95/1.00/1.04 | Fri ace / Sat avg / Sun weaker |
| Day of week (total) | -2.0 Fri / -1.5 Sat / +0.3 Sun | Starter workload effect |
| Midweek | × 1.03 | Tue/Wed/Thu weaker pitching |
| Bullpen fatigue | +0.3 if BP 10+ IP in 3 days | Opponent scores more |
| Workload adj | Based on starter IP vs 4.4 baseline | Reliever innings cost |
| Platoon | +0.15 if LHP vs RHB-dominant lineup | Handedness advantage |

### 4.3 Worked Example

LSU (home) vs Vanderbilt (away). Friday night game. LSU park factor 1.06.

**Ratings:**
```
LSU OFF = 7.8, LSU DEF = 5.2
Vandy OFF = 6.5, Vandy DEF = 4.1
```

**Base projection:**
```
LSU proj  = (7.8 + 4.1) / 2 = 5.95
Vandy proj = (6.5 + 5.2) / 2 = 5.85
```

**Pitcher adjustment:** LSU starter ERA 2.80 vs team avg 3.90 (k=0.18, 6 starts, ind_weight=0.70):
```
shrunk_ERA = 0.70 × 2.80 + 0.30 × 3.90 = 3.13
adj = (3.13 - 3.90) × 0.18 = -0.14 runs (applied to Vandy's projection)
Vandy proj = 5.85 - 0.14 = 5.71
```

**Park factor:**
```
LSU proj  = 5.95 × 1.06 = 6.31
Vandy proj = 5.71 × 1.06 = 6.05
```

**HCA:**
```
LSU proj  = 6.31 + 0.30 = 6.61
Vandy proj = 6.05 - 0.30 = 5.75
```

**Conference tier:** Both SEC (Tier 1) → offset = 0.0

**Series position:** Friday → defense × 0.95 (ace):
```
Vandy proj = 5.75 × 0.95 = 5.46  (LSU ace suppresses Vandy)
LSU proj  = 6.61 × 0.95 = 6.28  (Vandy ace suppresses LSU)
```

**Day of week:** Friday → -2.0 total:
```
Total = 6.28 + 5.46 - 2.0 = 9.74
```

**Final:**
```
BBMI Total = 9.5 (rounded to 0.5)
BBMI Spread = (6.28 - 5.46) × 2.0 = 1.64 → snapped to 1.5 (LSU -1.5)
```

If Vegas has the total at 11.5 and the spread at LSU -2.5:
- Under edge = 11.5 - 9.5 = 2.0 runs → UNDER pick
- Spread edge = |-1.5 - (-2.5)| = 1.0 → Spread pick toward Vanderbilt

---

## 5. Scoring Distribution — Poisson Engine

### 5.1 Win Probability

```
P(home wins) = SUM[h=0..max, a=0..max] P(h) × P(a) × I(h > a)
             + P(tie) × POISSON_HOME_TIE_SHARE

Where:
  P(k) = e^(-lambda) × lambda^k / k!
  POISSON_HOME_TIE_SHARE = 0.53 (extra-inning walk-off advantage)
```

### 5.2 Moneyline Derivation

```
if win_prob >= 0.50:
    ML = -round(win_prob / (1 - win_prob) × 100)
else:
    ML = round((1 - win_prob) / win_prob × 100)
```

### 5.3 Standard Deviations (Edge Calculation)

| Product | STD_DEV | Notes |
|---------|---------|-------|
| Spread | 6.2 | Calibrated from 710 games |
| Total | 4.0 | Production value; 2026 data suggests 6.24 |

---

## 6. Product Definitions and Examples

### 6.1 Total Under (Primary Product)

**Signal:** BBMI's projected total is significantly below the Vegas posted total.

```
ou_edge = vegas_total - bbmi_total
if ou_edge >= 1.5 → UNDER recommendation
```

**Confidence flags (edge-based):**

| Level | Edge |
|-------|------|
| High | >= 3.0 runs |
| Moderate | 2.0–3.0 runs |
| Low | < 2.0 runs |

**Walk-forward:** 61.7% ATS on 436 games (2025). The model's highest-confidence product.

### 6.2 Spread (Co-Primary Product)

**Signal:** BBMI's projected margin differs meaningfully from the Vegas spread.

```
spread_edge = |bbmi_line - vegas_line|
if bbmi_line > vegas_line → pick away
if bbmi_line < vegas_line → pick home
```

**Optimal edge range:** 2.0–5.0 runs. Below 2.0 is marginal. Above 5.0 has smaller sample sizes but historically strong performance.

**Walk-forward:** 54.4% ATS on 1,977 games (combined 2024–2025). Both seasons independently profitable: 54.1% (2024), 54.6% (2025).

### 6.3 ML Disagree (Tertiary — Display Only)

When BBMI's win probability diverges from the implied Vegas probability by 5–10 percentage points, a moneyline disagree signal is generated. This showed +4–10% ROI in testing but has not been promoted to a full recommendation.

### 6.4 Over (Display Only — Anti-Signal)

Over picks hit at approximately 44% ATS — worse than a coin flip. The model consistently over-identifies unders and under-identifies overs. Over picks are displayed for transparency but carry an explicit "display only" label.

### 6.5 Model Maturity Labels

| Label | V4 Games | Status |
|-------|----------|--------|
| Immature | < 500 | Early season, limited confidence |
| Developing | 500–1,500 | Growing sample |
| Calibrating | 1,500–5,000 | Current (2,355 games as of April 2026) |
| Mature | 5,000+ | Full confidence |

---

## 7. Walk-Forward Validation Protocol

### 7.1 Methodology

2024 team ratings (built from 2024 season data) are applied to 2025 games as a walk-forward test. The multiplier (2.0) is calibrated from 2024 in-sample data and held fixed for 2025 out-of-sample evaluation.

### 7.2 Multiplier Calibration

`BBMI_LINE_MULTIPLIER = 2.0` — converts raw rating differential to spread scale.

Calibration: Plateau at 1.75–2.25. Center-of-plateau chosen (2.0) for robustness. Performance:
- 1.75: 53.9% ATS
- 2.00: 54.4% ATS
- 2.25: 54.1% ATS

---

## 8. Validated Results

### 8.1 Total Under

| Metric | Value |
|--------|-------|
| ATS (2025 walk-forward) | 61.7% (269/436) |
| Edge threshold | >= 1.5 runs |
| ROI at -110 | ~17.4% |

### 8.2 Spread

| Metric | Value |
|--------|-------|
| ATS (combined 2024–2025) | 54.4% (1,077/1,977) |
| 2024 | 54.1% |
| 2025 | 54.6% |
| Edge 2.0–5.0 | 55.2% (312/259 games in strongest bucket) |
| Edge >= 2.0 | 55.2% |

### 8.3 Calibration Diagnostics (2026 In-Sample)

| Metric | Spread | Total |
|--------|--------|-------|
| STD_DEV | 5.87 | 6.24 |
| MAE | 4.56 | 5.03 |
| Bias | -0.348 (slight home under-projection) | -0.734 (under-projecting 0.7 R/G) |

---

## 9. Components Investigated and Excluded

### 9.1 PQS (Pitcher Quality Score)

**Hypothesis:** A theory-based pitcher quality metric (combining IP, hits, walks, strikeouts, home runs) would outperform raw ERA for individual pitcher adjustments.

**Result:** PQS produced r = 0.008 correlation with margin outcomes. Raw ERA produced r = 0.158. PQS destroyed signal in the walk-forward.

**Conclusion:** Direct observation (ERA) beats theory (PQS) in the high-noise college baseball environment. ERA-based adjustment with k = 0.18 is the validated approach.

### 9.2 Home/Away Splits

**Hypothesis:** Team-specific home/away performance splits would improve on a flat HCA.

**Result:** Split stability correlation r = 0.026 (first half to second half). Pure noise.

**Conclusion:** Flat HCA of 0.6 runs captures the advantage. Team-specific splits add error.

### 9.3 Fielding Percentage

**Hypothesis:** Team fielding quality would improve defensive projections.

**Result:** Removed from defensive weights. Fielding percentage is a notoriously poor quality measure in college baseball — it penalizes teams with more athletic fielders who attempt difficult plays.

**Conclusion:** Permanently excluded.

### 9.4 CBI Park Factors (External Source)

**Hypothesis:** College Baseball Insider's published stadium RPG figures would serve as park factors.

**Finding:** CBI stadium RPG had a +1.64 run systematic bias. The values were inflated by team quality (good teams play in parks that appear "hitter-friendly" because the team scores a lot, not the park).

**Fix:** Self-computed park factors with team-quality adjustment, 30% regression, 8-game minimum.

### 9.5 Complex Pitcher Workload Models

**Tested:** Detailed pitcher workload projections (starter IP, bullpen handoffs, pitch count estimation).

**Result:** Minimal impact after re-anchoring handles the total bias. Capped at 1.5 runs to preserve the under signal.

**Status:** Simplified version retained (SP_RP_ERA_GAP = 2.12, WORKLOAD_ADJ_CAP = 1.5). Complex model deferred.

### 9.6 K/9 Weight Swap

**Tested:** Reducing bullpen ERA weight from 0.25 to 0.15 and increasing K/9 from 0.20 to 0.30.

**Result:** Spread improved +0.2–0.4 pp, but under degraded -0.6 to -1.2 pp.

**Decision:** Under product has veto power. Weights locked as-is.

---

## 10. Open Items and Forward-Looking Agenda

### 10.1 Monitoring Thresholds

| Metric | Target | Trigger |
|--------|--------|---------|
| Under ATS (live 2026) | >= 55% | Review if < 52% at 500 games |
| Spread ATS (live 2026) | >= 53% | Promote to full recommendation at 500 games if > 53% |
| STD_DEV_TOTAL | 4.0 (production) | 2026 data suggests 6.24 — recalibrate at season end |
| Total bias | 0.0 target | Current -0.734 under-projection — re-anchoring should correct as season progresses |

### 10.2 Deferred Enhancements

| Item | Description | Dependency |
|------|-------------|-----------|
| Umpire strike zone data | Could improve F/B% and K-rate projections | Data availability |
| Lineup-specific platoon adjustment | Currently flat 0.15; could be LHP-matchup-specific | Daily lineup feeds |
| Weather integration | Temperature/wind effects on scoring | Weather API + outdoor park identification |
| Conference tournament adjustments | Neutral-site, single-elimination dynamics | Venue + format data |

### 10.3 Weight Lock Policy

Weights are locked and not to be modified unless new orthogonal data sources are added (platoon, umpire, daily lineup). The under product has veto power over any weight change — if a proposed change improves spread ATS but degrades under ATS, the change is rejected.

---

## Appendix A — Rating Component Weights

### Offensive Rating

| Component | Weight | Scaling |
|-----------|--------|---------|
| Adjusted R/G | 0.25 | Raw |
| wOBA (or OPS) | 0.25 | × 15.0 |
| OBP | 0.20 | × 12.0 |
| SLG | 0.10 | × 10.0 |
| Stolen base rate | 0.10 | × 2.0 |
| SOS adjustment | 0.10 | (150 - rank) / 300 |

### Defensive Rating

| Component | Weight | Description |
|-----------|--------|-------------|
| Team FIP (starters) | 0.35 | Rotation quality |
| Bullpen ERA/FIP | 0.25 | Relief quality |
| WHIP | 0.20 | Baserunner management |
| K/9 | 0.20 | Strikeout rate (inverted) |
| Fielding % | 0.00 | Removed |

---

## Appendix B — Conference Tiers

### Tier 1 (Power)
SEC, ACC, Big 12, Big Ten, Pac-12

### Tier 2 (Mid-Major)
Sun Belt, American, Mountain West, C-USA, MAC, West Coast, Missouri Valley, Colonial

### Tier 3 (Low-Major)
All other conferences

### Cross-Tier Run Offsets

| Matchup | Total Adjustment |
|---------|-----------------|
| Tier 1 vs Tier 1 | 0.0 |
| Tier 1 vs Tier 2 | +0.3 |
| Tier 1 vs Tier 3 | +0.6 |
| Tier 2 vs Tier 2 | 0.0 |
| Tier 2 vs Tier 3 | +0.2 |
| Tier 3 vs Tier 3 | 0.0 |

Each team receives half of the total adjustment applied to their projected runs.

---

## Appendix C — Glossary

| Term | Definition |
|------|-----------|
| **FIP** | Fielding Independent Pitching — measures pitcher quality using only HR, BB, HBP, K |
| **wOBA** | Weighted On-Base Average — offensive metric weighting each event by run value |
| **OBP** | On-Base Percentage — rate at which batters reach base |
| **SLG** | Slugging Percentage — total bases per at-bat |
| **WHIP** | Walks + Hits per Inning Pitched |
| **K/9** | Strikeouts per 9 innings |
| **SOS** | Strength of Schedule — opponent quality ranking |
| **Re-anchoring** | Dynamic calibration forcing league-average rating to equal actual league R/G |
| **Bayesian Shrinkage** | Blending individual pitcher stats with team average, weighted by sample size |
| **Series Position** | Friday (ace), Saturday (middle), Sunday (weaker) — reflects pitching quality in college weekend series |
| **Poisson** | Probability distribution modeling discrete events (runs scored) where variance equals the mean |
| **PITCHER_K** | Scaling constant (0.18) converting ERA deviation to run adjustment |
| **Park Factor** | Self-computed venue adjustment for scoring environment (1.0 = neutral) |

---

*This memorandum describes the BBMI NCAA Baseball model as of April 1, 2026. Model parameters and validation results are subject to revision based on ongoing monitoring and end-of-season review.*
