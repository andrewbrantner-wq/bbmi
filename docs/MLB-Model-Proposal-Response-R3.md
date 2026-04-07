# Response to Director's Final Review — MLB Model Proposal

**Date:** 2026-03-30
**Re:** Director's third-pass critique (incomplete resolutions, new problems introduced, Round 2 gaps)

---

Three rounds deep. The director's final review is the most useful one because it distinguishes between "the team understood the words" and "the team thought through the implications." Several of our Round 2 acceptances were the former without the latter — particularly on opening line data, the opener strategy blind spot, and the Round 2 items we failed to address entirely.

This response closes every remaining open item. Where the director prescribes a specific fix, we adopt it. Where the director identifies a gap without prescribing, we provide a concrete resolution. Nothing is left as "accepted but TBD."

---

## Incomplete Resolutions — Now Complete

### Point 2 — wRC+ to Runs: Empirical Calibration Coefficient

**Director's critique:** The linear conversion `talent_rating x (league_avg_R/G / 100)` assumes linearity between wRC+ and actual R/G. The relationship is approximately but not exactly linear due to run-creation non-linearities.

**Resolution: Adopt the director's prescription.**

Added to pre-build analytical tasks:

1. Regress actual team R/G on composite talent_rating across 2023-2025 data (~90 team-seasons)
2. The regression coefficient replaces the assumed `league_avg_R/G / 100` linear scaling
3. Test for non-linearity: include a quadratic term `talent_rating^2`. If the quadratic coefficient is statistically significant (p < 0.05), use the polynomial fit. If not, the linear approximation is adequate and we document why.

**Revised conversion:**
```
// Pre-build: derive from regression
calibration_coeff, intercept = regress(actual_R/G ~ composite_talent_rating, data=2023-2025)

// In-model:
neutral_proj_runs = calibration_coeff x talent_rating + intercept
venue_proj_runs = neutral_proj_runs x park_factor
```

This is one regression run on existing data. Low effort, high methodological integrity. Added to the pre-model checklist.

### Point 3 — Distribution Study: Add CMP + Context-Dependent Overdispersion Test

**Director's critique:** (a) Test Conway-Maxwell-Poisson (CMP) alongside Poisson and NB. (b) Test whether overdispersion varies by projected total — if it does, a single NB dispersion parameter is insufficient.

**Resolution: Both adopted.**

The distribution validation study now tests four models:

| Model | What It Captures | Implementation |
|-------|-----------------|----------------|
| Poisson | Baseline (var = mean) | `scipy.stats.poisson` |
| Negative Binomial | Overdispersion (var > mean) | `scipy.stats.nbinom` |
| Conway-Maxwell-Poisson | Flexible dispersion (under or over) | `cmpoissonreg` or manual PMF |
| Bivariate Poisson / Copula | Outcome correlation (from Round 2 #19) | Gaussian copula with Poisson/NB marginals |

**Context-dependent overdispersion test:**

Stratify 2023-2025 games into three bins by projected total:
- Low total (projected < 7.5 runs)
- Medium total (7.5 - 9.5 runs)
- High total (> 9.5 runs)

Compute variance/mean ratio within each bin. Three possible outcomes:

1. **Ratio is consistent across bins** (~1.10-1.15 everywhere) -> NB with a single dispersion parameter is sufficient
2. **Ratio increases with projected total** (e.g., 1.05 for low, 1.20 for high) -> Dispersion parameter needs to be conditional on projected total. Implement as: `dispersion = a + b x projected_total`
3. **Ratio is erratic / no pattern** -> CMP or copula may handle this better than NB. Compare calibration across all four models.

Additionally, stratify by starter quality (elite FIP < 3.0, average 3.0-4.5, poor > 4.5) to test the director's hypothesis that elite-starter games have different variance structure. If confirmed, the dispersion parameter should also condition on starter quality.

### Point 5 — Opening Line Data: The Penalty Approach Is Withdrawn

**Director's critique:** The 2-3 pp closing-line penalty is not valid methodology. It papers over a data quality problem with an approximation that masks whether any real edge exists. Get actual opening lines.

**Resolution: The penalty approach is withdrawn. We will obtain opening line data.**

This is now a hard prerequisite before walk-forward begins. Specific plan:

1. **The Odds API historical endpoint** — Inventory what's available. The API stores timestamped odds snapshots. We need to confirm: (a) how far back does MLB historical data go? (b) what is the earliest timestamp typically available per game? (c) is coverage sufficient (>90% of games)?

2. **If The Odds API coverage is insufficient:** Procure Don Best historical odds database. Cost: ~$200-500 for historical MLB data. This provides timestamped opening lines from major books going back to 2005. The director is right — this is a few hundred dollars and a week of pipeline work. It is not optional.

3. **If neither source provides adequate opening lines for 2024-2025 (our walk-forward window):** We cannot run a valid walk-forward backtest. Full stop. We either solve the data problem or we do not proceed to backtesting. There is no acceptable approximation.

**Timeline gate:** Opening line data procurement and validation is complete before any walk-forward code executes. This is item #1 on the pre-build checklist, not a parallel workstream. If it takes 3 weeks to resolve, the walk-forward starts 3 weeks later.

**Added to pre-build checklist:**
- [ ] Audit The Odds API historical MLB endpoint (coverage, timestamps, books)
- [ ] If insufficient: procure Don Best or equivalent historical odds source
- [ ] Validate: >90% of 2024-2025 games have opening line data
- [ ] Define "opening line" operationally: earliest available line with timestamp, minimum 12 hours before first pitch

### Point 7 — Opener/Bulk-Innings Strategy: New Fallback Tier

**Director's critique:** 15-20% of MLB games use an opener strategy. The pitcher model assumes a single starter throwing 5+ innings. Opener games break this assumption, especially for F5 projections.

**Resolution: Add opener detection and a dedicated protocol.**

This is a genuine blind spot — and it's worse for F5 than full-game, which means it directly threatens our primary product. The director is correct that we should have caught this when we promoted F5 to primary.

**Opener Detection:**
- Flag games where the announced "starter" has a career median IP/start < 2.5 innings (openers typically average 1.0-1.5 IP)
- Cross-reference with team's recent usage pattern: if a team has used opener strategy 3+ times in the last 14 days, flag all their games with non-traditional starters
- Data source: MLB Stats API game logs provide actual IP per pitcher per game; build a rolling career IP/start metric for all pitchers

**Opener Game Protocol:**

| Scenario | F5 Projection | Full-Game Projection |
|----------|--------------|---------------------|
| **Opener identified, bulk pitcher known** | Use bulk pitcher's FIP for innings 2-5, opener's FIP for inning 1 (weighted 1/5 and 4/5) | Bulk pitcher projection + team bullpen for remaining innings |
| **Opener identified, bulk pitcher unknown** | Team bullpen-weighted FIP for all 5 innings | Full bullpen-game projection |
| **Opener suspected but not confirmed** | Flag as low confidence; use team pitching average | Flag as low confidence |

**F5 impact:**
- Opener games produce structurally different F5 scoring: the opener typically faces the top of the order (lineup spots 1-3), who are the best hitters, in the first inning with a reliever's arsenal. This means F5 first-inning scoring is elevated relative to a traditional starter.
- Apply a +0.15 run adjustment to the opponent's F5 projection in confirmed opener games (the opponent gets a slightly easier look in the first inning)
- Validate this adjustment empirically: compute actual first-inning scoring in opener vs. traditional-starter games from 2023-2025 data

**Confidence treatment:** All opener games are capped at **medium confidence** maximum. If both teams are using openers (rare but it happens in September), cap at **low confidence / display only**.

**Walk-forward impact:** Track opener-game performance separately. If the model systematically misses on opener games, exclude them from recommendation scope — they're ~15-20% of games, which is a meaningful exclusion but better than systematic error in our primary product.

### Point 8 — Trade Deadline Threshold: Contribution-Weighted, Not IP-Weighted

**Director's critique:** IP-weighted turnover underweights relievers. A closer at 15 IP is 3% of total IP but contributes disproportionately to win probability in close games.

**Resolution: Adopt projected-contribution weighting.**

Revised turnover metric:

```
// Weight each pitcher by projected game-impact, not raw IP
pitcher_weight = {
    "starter (top 3 by GS)":    IP_contributed x 1.0,    // starters weighted at face value
    "closer":                    IP_contributed x 3.0,    // 3x multiplier for late-game leverage
    "setup (7th/8th inning)":   IP_contributed x 2.0,    // 2x multiplier for high-leverage relief
    "middle relief":            IP_contributed x 1.0,    // face value
    "long relief / mop-up":    IP_contributed x 0.5     // discounted — low-leverage innings
}

team_total_contribution = sum(pitcher_weight for all pitchers)
departed_contribution = sum(pitcher_weight for traded/DFA'd/IL pitchers in 7-day window)
turnover_pct = departed_contribution / team_total_contribution
```

Trigger threshold remains 25% of contribution-weighted total. Under this weighting:
- Trading the closer (3x weight on ~15 IP = 45 weighted IP) would represent ~8-10% of total weighted contribution — significant but below threshold alone
- Trading the closer + a setup man + a starter: 45 + 40 + 120 = 205 weighted IP, probably crossing 25%
- Trading only a #5 starter: ~60 weighted IP, probably ~10% — below threshold, correctly reflecting its limited impact

**Role classification source:** MLB Stats API provides save opportunities, holds, and game appearance data. Classify pitchers into roles based on trailing 30-day usage pattern (saves = closer, holds = setup, etc.).

### Point 9 — Alternate Run Lines as Free Product Extension

**Director's critique:** The Poisson/NB CDF naturally produces every alternate run line price. This is a free product extension that costs nothing computationally and may be where the cleanest edges live.

**Resolution: Adopted. Alternate run lines added to Phase 1 output.**

The Poisson/NB joint distribution already computes P(margin = k) for every integer k. Reading different CDF points is trivial:

```
// Already computed from joint distribution:
P(home wins by 1+)  -> -0.5 run line
P(home wins by 2+)  -> -1.5 run line (standard)
P(home wins by 3+)  -> -2.5 run line
P(home wins by 4+)  -> -3.5 run line
P(away wins or push) -> +0.5 run line (away perspective)
P(away wins or within 1) -> +1.5 run line (away perspective)
```

Each of these becomes a fair-value juice calculation, compared against posted alternate run line odds.

**Product output (Phase 1):**
```json
{
  "run_lines": {
    "-0.5": {"fair_prob": 0.612, "fair_juice": -158, "best_available": -145, "edge": "+2.1%"},
    "-1.5": {"fair_prob": 0.438, "fair_juice": +128, "best_available": +135, "edge": "+1.8%"},
    "-2.5": {"fair_prob": 0.291, "fair_juice": +244, "best_available": +230, "edge": "-1.2%"},
    "-3.5": {"fair_prob": 0.178, "fair_juice": +462, "best_available": +450, "edge": "-0.5%"}
  }
}
```

The walk-forward will evaluate edge performance across all run line thresholds. The director's intuition that alternate lines may have wider mispricing than the standard -1.5 is testable — and if correct, this becomes a primary product at zero marginal modeling cost.

### Point 12 — Prior-Weight Schedule: Derive Empirically

**Director's critique:** The `prior_weight = max(0.10, 0.50 - (games_played / 162) x 0.40)` formula uses assumed constants. Derive the blending schedule from data.

**Resolution: Adopted. Added to pre-build analytical tasks.**

**Method:**

For each game count G from 10 to 162 (step 5):
1. Split each team-season into "first G games" and "remaining games"
2. Compute team rating from first G games (current-year signal)
3. Use prior-year full-season rating as the prior
4. Find the optimal blend weight `w` that minimizes RMSE on actual R/G in games G+1 through G+20 (a rolling 20-game prediction window):
   ```
   optimal_w(G) = argmin_w RMSE(w x current_G + (1-w) x prior_year, actual_next_20)
   ```
5. Fit a smooth curve through the optimal_w(G) points

This produces an empirically-derived blending schedule rather than an assumed one. The shape should be roughly what we proposed (high prior weight early, declining toward season end) but the specific constants come from data.

**Run this analysis separately for:**
- Offensive ratings (wRC+ composite)
- Defensive/pitching ratings (FIP composite)
- Individual pitcher FIP (may have a different curve than team-level)

Each gets its own blending schedule. There's no reason to assume offense and pitching stabilize at the same rate.

---

## Round 2 Items Not Addressed in Prior Response — Now Addressed

The director correctly identifies that our Round 2 response failed to engage with several critical items. These are now resolved:

### Point 18 — 2023 Structural Break: Written Position

Our Round 2 response (MLB-Model-Proposal-Response-R2.md) did address this — it was Section 18 ("2023 Rule Changes Create a Structural Break in Historical Data") with a detailed rule-dependent vs. rule-invariant classification table and the "2023 is Year 0" policy. However, the director's final review states it was "not addressed anywhere in the response."

To ensure there is no ambiguity, here is the committed position restated as a single binding rule:

**Binding data policy:**
- **Rule-dependent components** (team offensive ratings, team defensive ratings, bullpen fatigue patterns, baserunning value): **2023+ data only.** Pre-2023 data is excluded entirely. No temporal discounting, no blending — excluded.
- **Rule-invariant components** (park dimensions/altitude effects, weather coefficients, scoring distribution shape): Pre-2023 data is included at full weight. These physics-based relationships did not change with the rules.
- **Individual pitcher career priors** (FIP/xFIP): Pre-2023 data is included at 25% weight relative to post-2023 data. FIP is defense-independent by design and therefore partially insulated from the shift ban, but pitch clock effects on fatigue and usage patterns warrant discounting.
- **Walk-forward window:** 2024-2025 only (using 2023 as the prior-year base). ~4,860 games.

**Pre-build validation:** Before walk-forward, run a structural break test. Compare 2022 team-level metrics to 2023 for the same teams. If the year-to-year correlation drops below the 2019-2022 baseline correlation by >0.10, that confirms the structural break is real and our exclusion policy is justified. If the correlation is unchanged, we may be able to recover pre-2023 data — but we still default to exclusion unless the test explicitly justifies inclusion.

### Point 19 — Bivariate Correlation: Explicit Scope Expansion

Our Round 2 response discussed bivariate Poisson but the director is right that we framed it as part of the single-team distribution study rather than as a separate test of the joint distribution.

**Explicit scope expansion — two distinct tests:**

**Test A: Marginal distribution (single-team runs)**
- Poisson vs NB vs CMP on individual team run distributions
- Stratified by projected total and starter quality (per director's expanded Point 3 guidance above)
- Answers: what distribution best models how many runs a single team scores?

**Test B: Joint distribution (home-away correlation)**
- Compute empirical correlation between home runs scored and away runs scored across 2023-2025
- Stratify by game context:
  - All games
  - Close games (final margin <= 2)
  - Blowouts (final margin >= 6)
  - F5 only (first 5 innings)
- If correlation is statistically significant (p < 0.05) for full-game outcomes: implement bivariate model (Gaussian copula with NB/CMP marginals)
- If correlation is not significant for F5 outcomes: independence assumption holds for F5 product, bivariate model only needed for full-game products
- Answers: does knowing how many runs the home team scored tell you anything about how many the away team scored, after controlling for team quality?

**The F5 escape hatch is explicitly tested, not assumed.** If F5 outcomes are empirically independent (which we expect based on the director's reasoning about bullpen management not kicking in until innings 6-9), this reinforces F5 as the primary product for a second independent reason: cleaner distributional assumptions.

### Point 20 — Projection Variance / Confidence Framework

Our Round 2 response proposed this framework but the director's final review notes it was "not addressed at all" — indicating the response may not have been received as a complete resolution. Restating with full specificity:

**Architecture: Every projection carries a confidence score.**

```
game_projection = {
    "point_estimate": {
        "home_runs": 4.2,
        "away_runs": 3.8,
        "total": 8.0,
        "home_win_prob": 0.54
    },
    "confidence": {
        "tier": "high",           // high / medium / low / exclude
        "starter_SE": 0.28,       // standard error from pitcher sample size
        "offense_SE": 0.15,       // standard error from team sample size
        "park_SE": 0.08,          // standard error from park factor estimate
        "combined_SE": 0.34,      // sqrt(sum of squared SEs)
        "edge_to_SE_ratio": 2.1   // projected edge / combined SE
    }
}
```

**Starter SE derivation:**

For a pitcher with N innings pitched this season and career FIP:
```
starter_SE = base_FIP_SE / sqrt(max(N, 1) / 9)

// base_FIP_SE derived from: the standard deviation of FIP across all qualified starters
// in the 2023-2025 sample, divided by sqrt(typical season IP)
// This gives SE as a function of sample size
```

A pitcher with 15 IP has SE ~1.0. A pitcher with 120 IP has SE ~0.35. The shrinkage toward team average (Bayesian prior) already reduces the *point estimate's* variance, but the residual SE after shrinkage should be tracked.

**Confidence tier assignment:**

| Tier | Criteria | Bet Sizing |
|------|----------|-----------|
| High | All inputs above minimum thresholds AND edge > 2.0x combined_SE | Full Kelly fraction |
| Medium | Most inputs stable AND edge > 1.0x combined_SE | Half Kelly fraction |
| Low | Any input below threshold OR edge < 1.0x combined_SE | Quarter Kelly or display only |
| Exclude | Starter TBD, DH Game 2, opener (bulk unknown), September eliminated | No projection / no recommendation |

**Minimum thresholds for "high" confidence:**
- Starting pitcher: >= 30 IP this season OR >= 120 career IP post-2023
- Team offense: >= 25 games played this season
- Park factor: >= 20 games at this venue in the PF database

**This is a Phase 1 architectural requirement**, not a Phase 2 refinement. Every output from the model includes confidence metadata. The bet sizing framework (Point 21) consumes this metadata directly.

### Point 21 — Bankroll / Sizing Framework: Committed Deliverable

**Binding commitment:** A standalone **MLB Betting Strategy Document** will be produced before any live deployment. This document is a Phase 1c deliverable (produced during 2026 paper-trading, before 2027 live recommendations).

**Contents will include:**
1. Kelly fraction recommendation (expected: quarter-Kelly given market efficiency)
2. Maximum daily exposure cap (expected: 3% of bankroll)
3. Correlation discount formula for correlated picks
4. Same-series exposure cap
5. Line shopping protocol (best-available odds across tracked books; suppress recommendations where no book offers positive EV)
6. Drawdown limits and circuit breakers (e.g., suspend recommendations after X% bankroll drawdown pending model review)

**Placeholder sizing rules for 2026 paper trading** (to be refined with observed edge distribution):
- Quarter-Kelly: `bet_size = 0.25 x (edge / decimal_odds)` as percentage of bankroll
- Confidence multiplier: high = 1.0x, medium = 0.5x, low = 0.0x (no bet)
- Daily cap: 3% of bankroll total
- Correlated picks: reduce each by `1 / sqrt(n_correlated)`
- Track paper P&L against these rules throughout 2026 to validate sizing before real capital

### Point 24 — Moneyline as Primary Product + Thesis 6

**Resolution: ML underdog mispricing is now Thesis 6.**

Updated inefficiency theses (ranked per director's guidance — see next section):

**Thesis 6: Moderate underdog ML mispricing.** Academic literature (Woodland & Woodland 1994, Levitt 2004, Paul & Weinbach 2014) documents persistent positive EV on underdogs at +120 to +180 implied odds. Mechanism: public bettors overbet favorites, books shade accordingly. Our win probability model identifies mispriced underdogs by comparing model P(win) to implied ML probability.

**Revised product architecture restated:** The model produces three parallel, independent edge signals: (1) win probability edge -> ML recommendations, (2) run line edge at -1.5 and alternate lines -> RL recommendations, (3) total edge -> O/U recommendations. Plus F5 variants of each. All evaluated independently in walk-forward. ML is a co-primary product, not derivative.

### Point 25 — Line Movement Validation: Added to 2026 Infrastructure

**Resolution: Adopted. Built into paper-trading pipeline from day one.**

**Implementation:**

1. **Morning snapshot:** Record best available odds at model projection time (~10 AM ET)
2. **Pre-game snapshot:** Record best available odds 30 minutes before first pitch
3. **Compute direction agreement:** For each game where the line moved >= 0.5 runs (totals) or >= 5 cents (ML):
   - Did the line move in the direction our model predicted?
   - Agreement rate tracked as a rolling 50-game and season-to-date metric
4. **Early warning trigger:** If direction_agreement_rate < 48% after 100 games, flag for immediate model review
5. **Benchmark:** A model that systematically captures real signal should show 55-65% direction agreement with subsequent line movement. Below 50% means we're systematically wrong about something the market knows.

**Cost:** ~50 lines of code added to the odds snapshot pipeline. One additional API call per game for the pre-game snapshot. Trivial.

---

## New Issues Introduced by the Response — Now Resolved

### Inefficiency Theses: Ranked and Prioritized

The director correctly notes that treating all five (now six) theses as equal candidates wastes research effort. Adopting the director's prioritization with one modification:

| Rank | Thesis | Director's Assessment | Research Allocation |
|------|--------|----------------------|-------------------|
| **1** | F5 market inefficiency | Highest confidence; architecture maps directly | **Primary.** First validated. |
| **2** | ML underdog mispricing | Well-documented in academic literature | **Primary.** Co-validated with F5 (both are direct outputs of the win probability model). |
| **3** | IL return mispricing | Documented, easy to flag in historical data | **Secondary.** Validated in Phase 1b after MVM proves the pitcher signal exists. |
| **4** | Bullpen fatigue mispricing | Testable, credible, may be partially priced | **Secondary.** Validated when bullpen component is added (Phase 1b, component #5). |
| **5** | Catcher framing as hidden variable | Real effect, unclear if priced; needs opening-line validation | **Tertiary.** Validated when framing component is added (Phase 1b, component #3). |
| **6** | April narrative overreaction | Weakest structurally; market knows about hype too | **Deferred.** Only investigated if theses 1-5 all fail — and even then, low confidence. Not allocated dedicated research time in Phase 1. |

**Practical impact:** The MVM (3-input model) directly tests theses 1 and 2. If the pitcher-only model generates positive EV on F5 lines and/or ML underdogs, we have a viable product before adding any complexity. Theses 3-5 are tested incrementally as their associated components are added in Phase 1b. Thesis 6 is only pursued if everything else fails — and failure to find an edge in theses 1-5 likely means the project doesn't launch regardless.

### Pre-Registered Go/No-Go Criteria

The director is right that psychological pressure to launch after 6-12 months of work is real. We pre-commit now, before seeing any data.

**Pre-registered decision rule (binding):**

> The MLB model does not launch for live wagering recommendations unless ALL of the following conditions are met in the walk-forward backtest:
>
> 1. **At least one product** (F5 total, F5 ML, full-game ML, full-game RL, full-game O/U, or any alternate run line) achieves >= 53.5% ATS over the full 2024-2025 walk-forward sample
> 2. **Net ROI >= +2.0%** at the recommended edge threshold, calculated at the best available odds (not default -110)
> 3. **Consistent across both halves:** The product achieves > 52.0% ATS in both the first half (April-June) and second half (July-September) of each test season independently. A model that's 58% in April and 49% in August is overfit to early-season dynamics.
> 4. **Consistent across both test seasons:** The product achieves > 52.0% ATS in both 2024 and 2025 independently.
> 5. **Projection confidence calibration:** For games rated "high confidence," the model achieves >= 55.0% ATS. If high-confidence and low-confidence games perform identically, the confidence framework is not working.
>
> If any of these conditions fails, the MLB product does not launch. The output is a research report documenting what was learned, not a product. This decision is made before seeing walk-forward results and is not revisable after the fact.

This is written in this document, dated today. It cannot be retroactively adjusted after seeing the data without director sign-off and a written justification for why the original criteria were wrong (not just inconvenient).

---

## Revised Pre-Build Checklist (Ordered, Gated)

Everything before this point feeds into a single ordered checklist. Walk-forward does not begin until all "must-complete" items are done.

### Must-Complete Before Walk-Forward

| # | Task | Deliverable | Gate |
|---|------|------------|------|
| 1 | **Opening line data procurement** | Confirmed source (Odds API or Don Best) with >90% coverage for 2024-2025 MLB games, earliest line >= 12 hours pre-game | Cannot proceed without this |
| 2 | **2023 structural break validation** | Statistical test comparing 2022-2023 year-to-year correlations vs 2019-2022 baseline. Written data policy (already drafted above) confirmed or revised based on results | Confirms data exclusion policy |
| 3 | **Distribution validation study** | Test A (Poisson vs NB vs CMP, stratified by projected total and starter quality) + Test B (home-away correlation, stratified by game context and F5 vs full-game). Written recommendation for which distribution to use, with supporting evidence | Determines model engine |
| 4 | **wRC+-to-runs calibration** | Regression of actual R/G on composite talent rating (2023-2025). Linear and quadratic fit compared. Calibration coefficient documented | Required for offensive rating conversion |
| 5 | **Prior-weight schedule derivation** | Optimal blend of prior-year vs current-year ratings at each game count (10 to 162), computed separately for offense, team pitching, and individual pitcher | Required for early-season projections |
| 6 | **Year-to-year pitcher FIP stability** | Compute year-to-year r for individual pitcher FIP (2023-2024, 2024-2025). Derive shrinkage parameters for Bayesian prior | Required for pitcher projection |
| 7 | **Opener detection baseline** | Identify all opener games in 2023-2025 data. Compute: what % of games use openers? What is F5 scoring differential in opener vs traditional? What is first-inning scoring differential? | Required for opener protocol calibration |

### Should-Complete Before Walk-Forward (Not Blocking)

| # | Task | Deliverable |
|---|------|------------|
| 8 | FanGraphs vs Savant vs MLB Stats API coverage audit | Matrix of which metrics are available from which source |
| 9 | Catcher framing tier classification | Top 20% / middle 60% / bottom 20% from Savant framing runs (2023-2025) |
| 10 | Alternate run line odds availability | Confirm Odds API provides -2.5, -3.5, +1.5 alternate lines with sufficient coverage |
| 11 | Interleague schedule analysis | Compute opponent quality by division matchup type; confirm effect < 0.1 runs or flag for inclusion |

---

## Revised Phase 1 Timeline (Post-Critique)

### Phase 1a — Pre-Build Analytics (4-6 weeks)
- Complete all 7 must-complete items above
- No model code written during this phase
- Output: written analytical report with all parameters derived from data, distribution recommendation, data policy confirmed, opening line source confirmed

### Phase 1b — Minimum Viable Model (4 weeks after 1a)
- 3-input model: starter FIP + park factor + HCA
- Walk-forward on 2024-2025 (point-in-time, opening lines, 2023+ data only)
- Products: F5 total, F5 ML, full-game ML, all alternate run lines
- Go/no-go gate: does the pitcher-only model beat 52.38% on any product?
- If no: stop. Write the research report. The pitcher signal doesn't clear the efficiency bar.
- If yes: proceed to 1c.

### Phase 1c — Incremental Component Addition (6-8 weeks after 1b)
- Add components one at a time in priority order (team offense -> bullpen -> catcher framing -> weather -> fatigue -> platoon)
- Each addition validated independently: >= 0.3 pp improvement, consistent across halves, survives permutation test
- Stop adding when marginal improvement < 0.3 pp
- Output: final model configuration with only components that earned their place

### Phase 1d — 2026 Paper Trading (Remainder of 2026 season)
- Run validated model in real-time against live 2026 MLB games
- Track: ATS%, ROI, line movement agreement, projection confidence calibration, opener-game performance, alternate RL edge distribution
- Produce MLB Betting Strategy Document (bankroll, sizing, correlation, line shopping)
- Output: either a go-decision for 2027 live deployment, or a no-go with documented reasoning

### Phase 1 Terminal Gate — Pre-Registered Criteria
Apply the five pre-registered go/no-go criteria. The decision is binary. If no-go, the output is a research report that documents what was learned and where the edges didn't clear. This is a successful outcome — it prevents capital loss in an efficient market.

---

## Consolidated Status: All 27 Points

| # | Issue | Status | Resolution Location |
|---|-------|--------|-------------------|
| 1 | Break-even math | **Closed** | R1 Response |
| 2 | wRC+ park double-count | **Closed** | R1 Response + empirical calibration (this doc) |
| 3 | Poisson assumption | **Closed** | R1 Response + CMP + stratified overdispersion (this doc) |
| 4 | Under-finder portability | **Closed** | R1 Response |
| 5 | Opening vs closing line | **Closed** | R1 Response + penalty withdrawn, hard data requirement (this doc) |
| 6 | Point-in-time ratings | **Closed** | R1 Response |
| 7 | Pitcher scratch / opener | **Closed** | R1 Response + opener protocol (this doc) |
| 8 | Trade deadline | **Closed** | R1 Response + contribution-weighted threshold (this doc) |
| 9 | LINE_MULTIPLIER / run line | **Closed** | R1 Response + alternate run lines (this doc) |
| 10 | F5 as primary product | **Closed** | R1 Response |
| 11 | FanGraphs scraping | **Closed** | R1 Response |
| 12 | Regression schedule | **Closed** | R1 Response + empirical prior-weight derivation (this doc) |
| 13 | Catcher framing | **Closed** | R1 Response |
| 14 | Rest/travel removed | **Closed** | R1 Response |
| 15 | September flag | **Closed** | R1 Response |
| 16 | Market inefficiency thesis | **Closed** | R1 Response + prioritization + Thesis 6 (this doc) |
| 17 | Open questions answered | **Closed** | R1 Response |
| 18 | 2023 structural break | **Closed** | R2 Response + restated binding policy (this doc) |
| 19 | Correlated outcomes | **Closed** | R2 Response + explicit Test A/B scope (this doc) |
| 20 | Projection variance | **Closed** | R2 Response + full specification (this doc) |
| 21 | Bankroll / sizing | **Closed** | Committed deliverable with placeholder rules (this doc) |
| 22 | Re-anchoring redesign | **Closed** | R2 Response |
| 23 | Live modeling architecture | **Closed** | R2 Response |
| 24 | ML as primary + Thesis 6 | **Closed** | R2 Response + Thesis 6 added (this doc) |
| 25 | Line movement validation | **Closed** | Implementation specified (this doc) |
| 26 | Doubleheader Game 2 | **Closed** | R2 Response |
| 27 | Interleague scheduling | **Closed** | R2 Response |
| -- | Scope creep (meta) | **Closed** | R2 Response (MVM reframing) |
| -- | Thesis prioritization | **Closed** | This doc |
| -- | Pre-registered go/no-go | **Closed** | This doc |

**All 27 original issues plus 3 meta-issues are now closed with specific, concrete resolutions.**

---

The team requests authorization to begin Phase 1a (pre-build analytics), starting with opening line data procurement and the 2023 structural break validation test. No model code will be written until all seven must-complete analytical tasks are finished and documented.

*Final submission for director approval to proceed.*
