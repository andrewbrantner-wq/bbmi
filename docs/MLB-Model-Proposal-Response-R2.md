# Response to Director's Second Review — MLB Model Proposal

**Date:** 2026-03-30
**Re:** Director's second-pass critique (issues 18-27 + scope creep meta-problem)

---

The second round hits harder than the first. Round 1 found visible structural errors. Round 2 found the assumptions we didn't know we were making — particularly the 2023 rule change break, correlated outcomes, and the scope creep meta-problem. The lean Phase 1 reframing at the end is the single most valuable piece of feedback across both reviews.

---

## Red — Additional Critical Flaws

### 18. 2023 Rule Changes Create a Structural Break in Historical Data

**Verdict: Accepted. This is a blind spot we should have caught.**

We treated "2019-2025 historical DB" as a homogeneous dataset. It isn't. The pitch clock, shift ban, and larger bases collectively represent the largest single-season rule change in modern baseball history. The director's specific examples are correct:

- **Shift ban:** Teams like Tampa Bay and Houston built entire defensive identities around shifting. Their pre-2023 BABIP-against, WHIP, and defensive ratings are from a different game. Using 2022 Houston's defensive profile as a prior for 2023 Houston is projecting a team that no longer exists defensively.
- **Pitch clock:** Changed bullpen warm-up patterns, reliever usage cadence, and arguably starter fatigue curves. Pre-2023 bullpen fatigue signatures may not transfer.
- **Stolen bases:** 41% increase in one year. Any baserunning metric (BsR, SB rate) has a step-change discontinuity at the 2023 boundary.

**Revised Data Policy:**

1. **2023 is Year 0.** Primary parameter estimation uses 2023-2025 data only. This gives us 3 seasons (~7,290 games) — smaller than the proposed 7-season window but structurally honest.
2. **Pre-2023 data is available but discounted.** For components that are rule-invariant (park dimensions, weather effects, Poisson/NB distribution shape), pre-2023 data adds sample size without contamination. For components that are rule-dependent (defensive metrics, bullpen fatigue, baserunning, BABIP-based stats), pre-2023 data is excluded entirely.
3. **Rule-dependent vs rule-invariant classification:**

| Component | Rule-Dependent? | Use Pre-2023 Data? |
|-----------|-----------------|---------------------|
| Park factors (dimensions, altitude) | No | Yes |
| Weather effects (temp, wind, humidity) | No | Yes |
| Distribution shape (Poisson vs NB) | No | Yes |
| HCA magnitude | Possibly (pace) | Test both windows |
| Team offensive ratings (wRC+, wOBA) | Partially (shift ban) | 2023+ only |
| Team defensive ratings (FIP, WHIP) | Partially (shift ban, clock) | 2023+ only |
| Bullpen fatigue patterns | Yes (pitch clock) | 2023+ only |
| Baserunning value (BsR) | Yes (larger bases) | 2023+ only |
| Pitcher FIP/xFIP career priors | Partially | Weight 2023+ at 3:1 vs pre-2023 |

4. **Walk-forward implication:** Our backtest window shrinks to 2024-2025 walk-forward (using 2023 as the prior year). That's ~4,860 games — still above the 2,000-game threshold from Round 1, but there's no margin for further data exclusions. This makes every game in the sample more precious and reinforces the lean Phase 1 argument.

5. **Pitcher career priors:** For individual pitcher projections, we can use pre-2023 career FIP but should weight post-2023 performance 3:1. A pitcher's FIP from 2021 is less contaminated by rule changes than team-level BABIP stats (FIP is defense-independent by design), but their usage patterns and fatigue curves may differ.

**One nuance the director may want to weigh in on:** The 2023 rules were announced in advance. Books and sharp bettors had the entire offseason to re-price teams based on expected rule impact. If the market correctly priced the shift ban's effect on Houston's defense in April 2023 opening lines, then our model's structural break problem is partially mitigated in the *betting validation* even if it exists in the *rating accuracy*. In other words: the question isn't just "are our ratings correct?" but "are our ratings more correct than the market's?" — and the market also had to deal with this structural break. Still, we should build on clean data regardless.

### 19. Correlated Outcomes Invalidate Poisson Independence Assumption

**Verdict: Accepted. This is the deeper statistical problem beneath the overdispersion issue.**

The director identifies three sources of correlation between home and away run distributions:

1. **Game-state bullpen management** (negative correlation) — blowouts trigger mop-up arms, inflating the losing team's late scoring while the winning team coasts
2. **Weather/park covariance** (positive correlation) — conditions affect both offenses simultaneously
3. **Consequence:** Independent Poisson overstates close-game probability and understates blowout probability

This is testable and we should test it before committing to any distribution.

**Proposed Resolution — Three-Tier Distribution Testing:**

The distribution validation study (already committed in Round 1, issue #3) now expands to test three models, not two:

| Model | Assumptions | What It Captures |
|-------|-------------|-----------------|
| Independent Poisson | Var = mean, zero covariance | Baseline |
| Independent Negative Binomial | Var > mean, zero covariance | Overdispersion from HR clustering |
| **Bivariate Poisson / Copula model** | Var >= mean, non-zero covariance | Both overdispersion AND outcome correlation |

**Testing protocol:**
1. Fit all three to 2023-2025 game outcomes (~7,290 games)
2. Compare win probability calibration: for games where model predicts 60% home win, does the home team win ~60% of the time? (calibration plot by decile)
3. Compare spread calibration: does the model correctly predict the frequency of 1-run games, 2-run games, etc.?
4. Compare total calibration: at each projected total, is the over/under split close to 50/50?
5. **Critical test:** Compare F5 outcomes (where bullpen management correlation is absent) vs full-game outcomes. If the correlation effect is real, independent Poisson should calibrate better for F5 than for full-game — because the game-state bullpen management (director's point #1) doesn't kick in until innings 6-9.

**Practical note:** A bivariate Poisson or copula model is more complex to implement but not dramatically so. The `scipy` ecosystem has bivariate Poisson implementations, and a Gaussian copula with Poisson marginals is a well-documented approach. The question is whether the complexity is *necessary* — i.e., whether the calibration improvement justifies the additional parameter. If independent NB passes calibration within acceptable bounds, we may not need the bivariate model. But we need to test it to know.

**The F5 escape hatch:** Per the director's earlier recommendation to prioritize F5, it's worth noting that the correlation problem is primarily a full-game issue. F5 outcomes are much closer to independent because: (a) no bullpen management effect yet, (b) starters pitch to both sides under the same conditions, (c) game state hasn't diverged enough to trigger blowout dynamics. If F5 becomes the primary product, the independence assumption is much more defensible — and the bivariate model becomes a Phase 2 concern for full-game products only.

### 20. No Variance / Confidence Interval Framework

**Verdict: Accepted. This is the gap between a projection model and a betting model.**

The director's point is precise: in a market where edges are 1-2 pp, the *confidence in the projection* is as important as the projection itself. A projected 0.8-run edge with a 95% CI of +/-2.0 runs is statistically indistinguishable from zero edge.

This is something the NCAA model could afford to ignore because: (a) edges were larger (3-4 pp), (b) the market was less efficient, and (c) the model was simpler with fewer uncertainty sources. In MLB, we can't ignore it.

**Proposed Framework — Projection Confidence Score:**

Each game projection carries a confidence score derived from the uncertainty in its inputs:

```
projection_variance = sum of:
  + starter_variance(IP_this_season, career_IP)
  + offense_variance(games_played, year-to-year r)
  + park_factor_variance(n_games_at_venue, multi-year stability)
  + bullpen_variance(recent_IP_sample, roster_stability)
  + catcher_variance(framing_sample_size)

projection_CI = projected_edge +/- z * sqrt(projection_variance)
```

**Key components:**

1. **Starter uncertainty** — A pitcher with 120 IP this season has a FIP standard error of ~0.35. A pitcher with 15 IP has SE ~1.0. The model should propagate this uncertainty through to the final projection.
   - Formula: `starter_SE = sqrt(13^2 * HR_rate_var + 3^2 * BB_rate_var + 2^2 * K_rate_var) / IP + prior_SE_discount`
   - Shrinkage toward team average already reduces this, but the residual uncertainty should be tracked

2. **Offense uncertainty** — Team wRC+ stabilizes at ~200 PA (~30 games). In April, offensive ratings are noisy; by July, they're stable.
   - Formula: `offense_SE = observed_SD / sqrt(games_played) + mean_regression_uncertainty`

3. **Park factor uncertainty** — Well-established parks (Coors, Fenway) have tight CI. New parks or renovated parks have wider CI.

4. **Combined confidence tier:**

| Tier | Criteria | Recommendation |
|------|----------|---------------|
| High confidence | All inputs above minimum sample thresholds; projected edge > 2x projection SE | Full-size recommendation |
| Medium confidence | Most inputs stable; projected edge > 1x projection SE | Half-size recommendation |
| Low confidence | Any critical input below threshold OR edge < 1x projection SE | Display only, no recommendation |
| Exclude | Starter TBD, doubleheader G2, September eliminated team | No projection generated |

**Impact on bet sizing (connects to issue #21):**
- Confidence score feeds directly into Kelly fraction calculation
- A high-confidence 1.5-run edge gets a larger bet than a low-confidence 2.5-run edge
- This is the mechanism that prevents the model from over-betting on noisy April projections or unknown-pitcher games

**This is an architectural addition, not a refinement.** It needs to be designed into Phase 1 from the start, not bolted on later. Every projection output should include: point estimate, confidence tier, and effective sample size for each input.

---

## Orange — Additional Significant Gaps

### 21. No Bankroll Management or Sizing Framework

**Verdict: Accepted. We need a dedicated sizing document before live deployment.**

The director raises three specific issues. Addressing each:

**Kelly fraction:**

At estimated 1-2 pp edge and -110 juice:
- True edge ~1.5% (53.5% win rate - 52.38% break-even)
- Kelly fraction = edge / odds = 0.015 / 0.909 = ~1.65% of bankroll per bet
- Full Kelly at this edge level is extremely volatile — a 10-game losing streak (which will happen multiple times per season) draws down ~15% of bankroll
- **Recommendation: Quarter-Kelly (0.4% of bankroll per bet)** for MLB given market efficiency and edge uncertainty
- Scale up to half-Kelly only for high-confidence projections (per issue #20 framework)

**Correlated bet exposure:**

The director's example (8 weather-correlated under picks on one Sunday) is exactly the scenario we need to model. Proposed rules:

1. **Maximum daily exposure:** 3% of bankroll total across all games (at quarter-Kelly, this allows ~7-8 bets max)
2. **Correlation discount:** When multiple picks share a common factor (weather pattern, same series, same bullpen fatigue cluster), reduce individual sizing by `1 / sqrt(n_correlated_picks)`. Eight correlated under picks each get `0.4% / sqrt(8) = 0.14%` each, totaling ~1.1% — not 3.2%.
3. **Same-game exposure:** Never recommend both sides of the same game (e.g., under AND home RL). Pick the higher-confidence product.
4. **Series exposure cap:** Maximum 2 recommendations per 3-game series between the same teams.

**Line shopping infrastructure:**

The director is correct — at 1-2 pp edge, the juice difference between -110 and -105 is the profit margin. This is not optional.

**Phase 1 requirement:** Odds API already provides multi-book odds. The pipeline must:
1. Compare projected fair line against best available odds across all tracked books
2. Report the best available line and book for each recommendation
3. Calculate effective edge at the best available price, not at a default -110
4. If no book offers a price where the edge exceeds 0.5% net ROI on a specific pick, downgrade or suppress the recommendation

We will produce a standalone **MLB Betting Strategy Document** (analogous to NCAA's bbmi-betting-strategy.docx) before any live deployment. This is a Phase 1 deliverable, not a Phase 2 afterthought.

### 22. Re-Anchoring Mechanism Needs Redesign for MLB

**Verdict: Accepted. This is the third manifestation of the wRC+ integration problem.**

The director identifies three issues. All three are correct:

**Issue 1: wRC+ doesn't need re-anchoring.**

wRC+ is normalized to 100 = league average by definition. Applying `reanchor_factor = league_avg_R/G / avg_composite_rating` to a metric that's already normalized is circular. This is the same double-counting problem from issue #2, now surfacing in the calibration layer.

**Fix:** The offensive side of the model does not use re-anchoring at all. The wRC+-to-runs conversion (`neutral_proj_runs = talent_rating x (league_avg_R/G / 100)`) already grounds the projection in the current run environment. Re-anchoring is redundant and removed for offense.

**Issue 2: Run environment changes year-to-year.**

The director's point about ball composition changes and rule changes is well-taken. MLB has changed the ball at least 3 times since 2019 (confirmed: pre-2019 juiced ball, 2021 deadened ball, 2023 slight re-juicing). Each change shifts league-average R/G by 0.3-0.5 runs.

**Fix:** For the defensive/pitching side of the model (where we still use FIP/xFIP/K-BB% and need re-anchoring), compute the re-anchoring factor from **current-season data only** (rolling, updated daily), not the full historical DB. This ensures the model is calibrated to the current run environment, not a historical average.

```
// Offensive: NO re-anchoring (wRC+ is self-normalizing)
off_proj = wRC+_composite x (current_season_league_R/G / 100)

// Defensive: Re-anchor to CURRENT season only
def_reanchor = current_season_league_R/G / avg_current_season_def_composite
def_proj = def_composite x def_reanchor
```

**Issue 3: Right-skew from elite vs. poor pitchers.**

Re-anchoring to the *mean* creates bias when the distribution is skewed. The director's point: if elite pitchers (deGrom, Cole) pull the average down, re-anchoring to the mean systematically over-adjusts for average pitchers and under-adjusts for elite/poor ones.

**Fix:** Use *median* composite rating instead of mean for the re-anchoring denominator. The median is more robust to skew. Alternatively, re-anchor per-tier (top third, middle third, bottom third) and verify the correction is consistent across tiers. If it's not, the re-anchoring is masking a nonlinearity in the rating construction — which needs to be fixed in the weights, not patched in calibration.

We will test mean vs. median re-anchoring in the pre-model analytical phase and use whichever produces lower residual bias.

### 23. No Discussion of Live / In-Game Modeling

**Verdict: Accepted as an architectural decision. Answered: build for extensibility.**

The director frames this correctly — it's a nearly-free decision now and an expensive retrofit later. Our answer:

**Decision: Build the distribution output, defer the live product.**

The Poisson/NB engine naturally outputs a full probability distribution over (home_runs, away_runs) pairs. We will:

1. **Store the full joint distribution** (or its parameters) for each game projection, not just the point estimate
2. **Design the projection function** to accept a game state as input (inning, score, outs, runners) even if Phase 1 only calls it with the pre-game state (inning=1, score=0-0)
3. **Not build a live data feed, live odds scraper, or in-game recommendation engine in Phase 1**

This means: if we later decide to enter live markets, we extend the existing projection function with game-state updates rather than rebuilding from scratch. The marginal cost of storing distribution parameters is essentially zero (a few extra columns in the output JSON). The marginal cost of designing the function signature to accept game state is a few hours of upfront design.

We are explicitly **not** committing to a live product. We are committing to not closing the door on one.

### 24. Moneyline Should Be Primary, Not Derivative

**Verdict: Accepted. The reframing is correct.**

The director's argument has two parts, and both are right:

**Part 1: ML and RL price different things in MLB.**

In basketball or football, the spread and ML are mechanically linked — a team favored by 7 points has a specific implied ML. In MLB, the -1.5 run line and the moneyline diverge meaningfully because MLB's low-scoring nature means the gap between "winning" and "winning by 2+" is larger as a percentage of outcomes. A team with 55% win probability might only cover -1.5 in 40% of games. These are genuinely different products.

**Part 2: Moderate underdogs are a documented inefficiency.**

The academic literature on MLB moneyline mispricing is real. Multiple studies (Woodland & Woodland 1994, Levitt 2004, Paul & Weinbach 2014) document persistent positive EV on moderate underdogs at +120 to +180 implied odds. The mechanism is well-understood: public bettors overbet favorites, books shade accordingly, and the underdog line carries positive EV even at closing prices. This is one of the *specific market inefficiencies* the director demanded in issue #16.

**Revised Architecture:**

The model produces **three parallel edge signals**, not a parent/child hierarchy:

1. **Win probability edge:** `model_win_prob - implied_ML_prob` -> moneyline recommendations
2. **Run line edge:** `model_P(win_by_2+) - implied_RL_prob` -> run line recommendations
3. **Total edge:** `model_projected_total - posted_total` -> over/under recommendations

Plus the F5 variants of each.

These are evaluated independently in the walk-forward. It's entirely possible that the ML product clears the ROI threshold while the RL product doesn't (or vice versa). They are separate products with separate validation, not a single model with derived outputs.

**Addition to inefficiency theses (from issue #16):**

6. **Moderate underdog ML mispricing** — well-documented in academic literature, driven by public chalk bias. Our win probability model identifies mispriced underdogs as a primary product candidate.

### 25. Steam / Reverse Line Movement as Model Validation Signal

**Verdict: Accepted. This is a clever validation shortcut for the paper-trading phase.**

The insight is that we don't have to wait for game outcomes to assess model quality during 2026 paper trading. If our model's edge signals correlate with subsequent line movement, we're capturing real information — even before the first pitch.

**Implementation for 2026 paper-trading season:**

1. **Snapshot capture:** Record the line at model projection time (typically morning) and the line at game time (closing line)
2. **Compute:** For each game, does the line move in the direction our model predicted?
   - Model says under -> does the total drop between our snapshot and close?
   - Model says home ML -> does the home ML shorten between snapshot and close?
3. **Track:** `direction_agreement_rate = (games where line moved our direction) / (all games with measurable line movement)`
4. **Benchmark:** If direction_agreement_rate > 55%, the model is capturing real signal that sharp money also captures. If < 50%, the model is systematically wrong about something the market understands better.
5. **Early warning:** If after 50 games the direction_agreement_rate is < 48%, flag for immediate model review — don't wait for the full 2,430-game sample.

**This is not a model input** — we will not use line movement as a predictor (that would be curve-fitting to sharp money rather than having our own model). It's a **validation signal** during the paper-trading year. Think of it as a real-time calibration check: "is our model at least directionally aligned with informed market participants?"

**Low implementation cost:** We already capture odds snapshots from The Odds API. Adding a second snapshot closer to game time and computing the agreement metric is ~50 lines of code.

---

## Yellow — Additional Important Refinements

### 26. Doubleheader Game 2 Is Structurally Unmodeled

**Verdict: Accepted. Requires a specific protocol, not a generic adjustment.**

The director is right that doubleheader Game 2 is qualitatively different from a normal game, not just quantitatively different by +0.15 runs. The correct framing:

**Doubleheader Game 2 Protocol:**

1. **Flag:** All doubleheader Game 2s are flagged as special events in the pipeline
2. **Starter handling:**
   - If probable Game 2 starter is known and in our pitcher database: use normal pitcher projection but apply a **reduced projected IP** (typically 4.0-4.5 IP for DH Game 2 starters vs 5.0-6.0 normal)
   - If probable starter is TBD or not in our database: use team bullpen-weighted projection for the full game (same fallback as issue #7 pitcher scratch protocol)
3. **Bullpen handling:**
   - Track Game 1 bullpen usage in real-time (or from Game 1 box score if games are staggered)
   - Game 2 bullpen quality = season bullpen quality x fatigue penalty, where fatigue penalty is derived from Game 1 bullpen IP
   - If Game 1 went extras: maximum fatigue penalty applied; Game 2 bullpen projection degrades by +0.5-1.0 runs
4. **Confidence:** All doubleheader Game 2 recommendations are capped at **low confidence** regardless of edge size. The structural uncertainty is too high for full-conviction recommendations.
5. **Walk-forward:** Track DH Game 2 outcomes separately. If the model is systematically wrong on DH Game 2s, exclude them from recommendation scope rather than trying to model them precisely. ~60 games/season is small enough to skip without material impact on the product.

### 27. Interleague Scheduling Creates Soft SOS Effect

**Verdict: Accepted as a diagnostic item. Not a Phase 1 model input.**

The director correctly notes that MLB's schedule is not fully balanced. The 76/46/40 split (division/league/interleague) creates measurable but small opponent quality effects.

**Resolution:** Track division matchup type as a metadata field in the historical DB. After walk-forward, run residual analysis by matchup type:
- Intra-division games
- Same-league, cross-division games
- Interleague games (further split by division pairing)

If residual bias exceeds 0.1 runs for any category, investigate and potentially add a soft SOS correction. Our expectation: this effect is <0.05 runs and will not clear statistical significance. But the diagnostic costs nothing and we should have the data.

---

## The Meta-Problem: Scope Creep

**Verdict: This is the most important piece of feedback across both reviews.**

The director's closing argument deserves to be quoted back:

> *"The NCAA lesson was explicit: 'optimization surface is flat; equal weights produce 51.1% OOS; model edge derives from architecture not weight tuning.' That lesson argues for a simpler MLB Phase 1, not a more complex one."*

We agree. Our Round 1 response already expanded Phase 1 from the original proposal — adding F5 products, catcher framing, roster change detector, September flag, confidence framework, bankroll document, and multiple pre-model validation studies. The cumulative Phase 1 scope has grown to a point where it's no longer a focused validation exercise. It's an attempt to build a complete production system before proving the concept works.

**The director's lean alternative — 3 inputs only — is the right framing.**

### Revised Phase 1: Minimum Viable Model (MVM)

**Three inputs:**
1. Starting pitcher FIP projection (Bayesian shrinkage, prior-year priors, 2023+ data only)
2. Park factor (published FanGraphs PFs, validated against self-computed)
3. HCA = 0.3 flat

**That's it for v0.1.** No team offensive ratings, no bullpen model, no weather, no catcher framing, no fatigue, no rest/travel, no lineup-specific, no umpire.

**Why this works as a proof-of-concept:**

- The thesis is that pitcher modeling is the primary lever. If that's true, a model with *only* pitcher + park + HCA should beat break-even on F5 lines — because F5 outcomes are dominated by the starting pitcher.
- If a 3-input model can't beat 52.38% on F5 lines, adding 27 more features won't help. The edge either exists in the pitcher signal or it doesn't.
- If it *can* beat break-even, we add components **one at a time**, measuring marginal walk-forward improvement at each step. This is the methodologically honest approach.

**MVM Architecture:**

```
// For each game:
home_starter_proj = bayesian_FIP(home_SP, prior_year_FIP, current_IP)
away_starter_proj = bayesian_FIP(away_SP, prior_year_FIP, current_IP)

// F5 projection (starter-only, no bullpen needed):
F5_home_runs = away_starter_proj x (5/9) x park_factor
F5_away_runs = home_starter_proj x (5/9) x park_factor
F5_total = F5_home_runs + F5_away_runs

// Full-game projection (using league-average offense as baseline):
home_runs = (away_starter_proj x starter_IP_proj/9 + league_avg_bullpen x (9 - starter_IP_proj)/9) x park_factor + HCA
away_runs = (home_starter_proj x starter_IP_proj/9 + league_avg_bullpen x (9 - starter_IP_proj)/9) x park_factor - HCA

// Win probability from Poisson/NB distribution
// Edge = model prob - implied market prob
```

**Note:** This MVM still uses league-average offense for all teams. The only team-specific input is the starting pitcher. This is intentionally crude — it isolates the pitcher signal from everything else.

### Incremental Component Addition (Post-MVM Validation)

Each component is added independently. For each, we measure:
- Does walk-forward ATS% improve by >= 0.3 pp?
- Does walk-forward ROI improve by >= 0.2%?
- Is the improvement consistent across both halves of the test season?
- Does the improvement survive a permutation test (shuffle the component, re-run walk-forward)?

If a component fails any of these, it stays out. Ordered by expected marginal value:

| Priority | Component | Expected Signal | Add After |
|----------|-----------|----------------|-----------|
| 1 | Team offensive rating (wRC+) | High — offense varies 20%+ across teams | MVM validates |
| 2 | Bullpen quality | Medium — 35% of innings, measurable variance | Offense added |
| 3 | Catcher framing (binary) | Low-Medium — interacts with pitcher model | Bullpen added |
| 4 | Weather | Low-Medium — proven in NCAA | Framing added |
| 5 | Bullpen fatigue | Low — complex, may not clear threshold | Weather added |
| 6 | Platoon splits | Low — real but may already be priced | Fatigue tested |
| 7 | Rest/travel | Very Low — contested evidence | Only if residuals show signal |
| 8 | Umpire | Very Low — small effect | Only if Phase 2 |
| 9 | Lineup-specific | Unknown — high complexity | Only if Phase 2+ |

**This is the antidote to scope creep.** Each component earns its place in the model through measured marginal improvement, not theoretical justification. The NCAA model taught us that the optimization surface is flat — most "improvements" are fitting noise. We apply that lesson here by *not* assuming any component is valuable until proven otherwise.

### Pre-Model Analytical Work (Unchanged)

These studies still happen before any model code, but they're scoped to support the MVM, not a 30-component system:

1. **Distribution validation** (Poisson vs NB vs bivariate) — 2023-2025 data only
2. **Historical odds inventory** (opening line availability from The Odds API)
3. **Year-to-year pitcher FIP stability** (derive shrinkage parameters from 2023-2025)
4. **2023 structural break validation** (compare pre/post rule change distributions)

Items cut from pre-model phase:
- ~~Year-to-year team offensive correlation analysis~~ (deferred until team offense is added to model)
- ~~FanGraphs vs Savant coverage audit~~ (MVM only needs Savant + MLB Stats API)
- ~~Full regression schedule derivation~~ (deferred until we're adding the components that need it)

### Revised Deliverables

**Phase 1a — MVM (target: 6 weeks)**
- 3-input model: pitcher FIP + park factor + HCA
- Walk-forward on 2024-2025 (point-in-time, opening lines, 2023+ data only)
- Products: F5 total, F5 ML, full-game ML
- Go/no-go gate: Does the pitcher-only model beat 52.38% on any F5 product?

**Phase 1b — Component Addition (target: 8 weeks after 1a)**
- Add components one at a time in priority order
- Each addition validated independently
- Stop adding when marginal improvement < 0.3 pp or when complexity budget is exhausted

**Phase 1c — Paper Trading (2026 season, ongoing)**
- Run the validated model in real-time against 2026 MLB games
- Track: ATS%, ROI, line movement agreement (issue #25), projection confidence calibration
- Produce the bankroll/sizing strategy document based on observed edge distribution
- Go/no-go gate: Net positive ROI at quarter-Kelly sizing over 2,000+ games

**Phase 1 Output:**
- Either: validated model with identified product(s) and proven market inefficiency, ready for 2027 live deployment with bankroll framework
- Or: documented conclusion that the edge doesn't clear juice, with specific evidence per component. This is a *successful* outcome — it saves us from bleeding money in the most efficient sports market.

---

## Consolidated Response to Director's Cumulative Assessment

> *"The proposal is well-researched but architecturally overambitious for Phase 1, contains at least 4 flaws that would produce meaningfully misleading walk-forward results (closing lines, lookahead bias, 2023 structural break, correlated outcomes), and enters the most efficient betting market without a specific inefficiency thesis. Fix those five things first. Everything else is refinement."*

All five are now addressed:

1. **Closing lines** -> Opening line validation with multi-timepoint protocol (Round 1, #5)
2. **Lookahead bias** -> Point-in-time rolling simulation with `--point-in-time` flag (Round 1, #6)
3. **2023 structural break** -> 2023 is Year 0; pre-2023 data excluded for rule-dependent components (this round, #18)
4. **Correlated outcomes** -> Three-tier distribution validation (Poisson, NB, bivariate); F5 as primary product where independence holds (this round, #19)
5. **No inefficiency thesis** -> Six specific theses defined, each with validation criteria; moderate underdog ML mispricing added as the strongest academic-backed thesis (Round 1 #16 + this round #24)

And the overarching scope problem is addressed by the MVM reframing: prove the pitcher signal works with 3 inputs before building a 30-component system.

---

*Submitted for director's third review. We believe the proposal is now methodologically sound. The remaining question is whether the pitcher signal clears the efficiency bar in MLB's market — and the MVM is designed to answer exactly that question with minimal wasted effort.*
