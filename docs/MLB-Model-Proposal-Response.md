# Response to Director's Critique — MLB Model Proposal

**Date:** 2026-03-29
**Re:** Director's 25-point review of MLB Spread & Over/Under Model Proposal

---

Thank you for the thorough review. The critique correctly identifies several foundational issues that would have caused significant problems downstream. Below is our point-by-point response organized by the director's severity framework, with proposed resolutions and, where appropriate, context on our reasoning.

---

## Red — Critical Flaws

### 1. Break-Even Math Is Wrong in Success Criteria

**Verdict: Accepted. Embarrassing oversight.**

The director is correct — at standard -110 juice, break-even is 52.38%. A 52.0% threshold literally defines a losing model. This was a careless error in the proposal, not a deliberate choice.

**Revised Success Criteria:**
- Spread ATS >= **53.5%** (provides ~1.1 pp margin above break-even for variance and line shopping friction)
- Under ATS >= **56.0%** at edge threshold >= 1.0 runs
- All thresholds measured **net of expected juice**. We will compute implied EV at -110 base, with sensitivity analysis at -112 and -115 for shaded lines
- ROI will be reported alongside ATS% — a model at 54% ATS with average -112 juice is materially different from 54% at -110

We will also add a "minimum viable ROI" criterion: **+2.0% ROI net of juice** at the recommended edge threshold, measured across the full walk-forward sample. This is the number that actually matters for viability.

### 2. Double-Counting Park Factors on Offense

**Verdict: Accepted. This is a genuine architectural flaw.**

The director's diagnosis is precise. wRC+ removes park context to isolate talent. Then applying a multiplicative park factor at the projection stage partially double-corrects. In the NCAA model this problem doesn't exist because adj_runs_per_game is *not* park-adjusted — the park multiplication is clean.

**Proposed Fix — Two-Layer Separation:**

1. **Talent layer (park-neutral):** Use wRC+ (and other park-adjusted metrics) to build a park-neutral team offensive talent rating. This tells us "how good is this team's offense in a neutral environment?"

2. **Projection layer (park-applied):** Convert the talent rating back to a raw runs projection using league-average R/G as the baseline, *then* apply the venue park factor.

Concretely:
```
talent_rating = composite(wRC+, wOBA_adj, ISO, BB%, K%, BsR)  // park-neutral
neutral_proj_runs = talent_rating x (league_avg_R/G / 100)     // convert to runs scale
venue_proj_runs = neutral_proj_runs x park_factor               // apply park effect once
```

This is analogous to what the NCAA model's re-anchoring already does — but we need to be explicit that re-anchoring operates on park-neutral ratings and the park factor is applied after, not before.

**Alternative considered:** Use raw (non-park-adjusted) offensive metrics instead of wRC+, then apply park factors. This is closer to the NCAA approach but sacrifices the quality of wRC+ as a talent assessment tool. We prefer the two-layer separation because it lets us use the best talent metric (wRC+) while keeping park application clean.

We will document the exact math in the revised spec so there is no ambiguity about where park effects enter the projection.

### 3. Poisson Is Likely Wrong for MLB — Needs Validation

**Verdict: Accepted. We made an unsupported assumption.**

The director's point about overdispersion is well-taken. The claim that Poisson is "even more appropriate for MLB" was backwards reasoning — we assumed larger samples -> cleaner Poisson fit, but the actual issue is the *variance structure* of MLB scoring, not sample size.

The specific mechanism the director identifies (HR clustering creating fat tails where variance > mean) is correct and well-documented in baseball analytics literature. MLB team run distributions typically show variance/mean ratios of 1.05-1.20, vs. the Poisson assumption of 1.00.

**Proposed Resolution:**

Phase 1 will include a **distribution validation study** as the first analytical task before any model building:

1. Build historical run distribution from Retrosheet (2019-2025, ~15,000 games)
2. Fit both Poisson and negative binomial to observed team run distributions
3. Compute AIC/BIC for model selection
4. Test whether overdispersion materially affects win probability estimates vs. spread/total projections
5. If negative binomial is superior: implement it. The Poisson engine is modular — swapping the distribution function is a contained change, not an architectural rewrite.

**Critical follow-up on the "under-finder" reversal risk:** The director flags that Poisson's underestimation of 10+ run games could reverse the structural under-finding behavior. This is the most important implication. If Poisson systematically under-prices high-total outcomes, the model could have a *structural over bias* in MLB — the opposite of NCAA. This must be quantified before we commit to any product hierarchy. The distribution validation study will explicitly measure directional bias by total range (low/medium/high totals).

We are **not** committing to Poisson or negative binomial in advance. We are committing to testing both and going with the data.

### 4. Under-Finder Thesis Is Not Portable Without Proof

**Verdict: Accepted. We were projecting NCAA results onto a different market.**

The director is right on both counts:

1. The NCAA under edge exists partly because the *market is inefficient* — not just because the model is structurally biased
2. MLB totals attract massive sharp action that has already arbitraged away most systematic public over-bias

**Revised Approach:**

- The product hierarchy in Section 3.7 is **removed** from the proposal. We will let the walk-forward results determine the product hierarchy, not assume it
- The first backtest deliverable will be a **product discovery analysis**: which bet types (spread, ML, over, under, F5) show positive EV at which edge thresholds in the historical data?
- We explicitly state: **we have no prior belief about which product will be primary in MLB.** If the data says the edge is in F5 unders, that's the product. If it's in ML underdogs, that's the product. If nothing clears the ROI threshold, we don't launch.

This is actually consistent with how the NCAA model was built — the under-finder discovery was an *output* of the diagnostic process, not an input. We made the mistake of treating an NCAA output as an MLB assumption.

---

## Orange — Significant Gaps

### 5. Opening Line vs. Closing Line — Lookahead Bias

**Verdict: Accepted. This is the most important methodological concern in the entire proposal.**

The director correctly identifies the most common cause of spurious backtesting results in baseball models. Comparing projections to closing lines is measuring how well the market converged to truth, not how well our model performs in a tradeable window.

**Proposed Resolution:**

- **Primary validation:** Compare against **opening lines** (or earliest available line). The Odds API does store historical line snapshots with timestamps — we need to confirm the granularity and ensure we're pulling the earliest available line, not the closing line.
- **If opening lines aren't available at sufficient coverage:** We will use the Odds API's historical endpoint to pull the earliest timestamped line per game. If this proves insufficient, we budget for a premium historical odds source (e.g., Bet Labs, Don Best historical feeds, or SBR Line History).
- **Validation protocol:** Every backtested edge will be reported at three time points: (a) opening line, (b) line at pitcher confirmation (~4-5 hours pre-game), (c) closing line. The spread between these tells us how much of our "edge" is real vs. line convergence.
- **Conservative assumption:** If we can only validate against closing lines, we apply a **2-3 pp penalty** to all reported ATS% as a rough correction for line movement. This is a known heuristic in the sports analytics literature.

This is a data procurement problem as much as a methodology problem. We need to inventory what The Odds API actually provides for historical MLB lines before committing to a specific validation approach.

### 6. Point-in-Time Rating Problem

**Verdict: Accepted. This is standard practice in the NCAA pipeline and we failed to specify it for MLB.**

The NCAA pipeline computes ratings daily from cumulative season data through the prior day. The same approach transfers directly to MLB. To be explicit:

**Specification:**
```
For a game on date D:
  - Team ratings use stats through games completed on D-1
  - Pitcher ratings use game logs through D-1
  - Park factors use completed games through D-1
  - No future data is accessible at projection time
```

The historical backtest will be built as a **rolling simulation**: for each game date in the backtest period, compute ratings using only data available on that date. This is computationally expensive (you're rebuilding ratings ~180 times per season instead of once) but is the only honest approach.

For prior-year priors (April projections using 2023 data for 2024 games): the full prior season is available, which is correct — that data was known before the season started.

We will implement this as a `--point-in-time` flag in the backtest pipeline so that any future backtest is automatically point-in-time compliant.

### 7. Probable Pitcher to Actual Starter Mismatch

**Verdict: Accepted. We need a fallback protocol.**

The ~10-15% mismatch rate the director cites is real and creates two distinct problems:

**Problem 1: Live model (what do we output when the starter scratches?)**

Fallback protocol:
1. If replacement starter is known: use replacement starter's projection (even if it's a lower-confidence projection due to fewer starts)
2. If replacement is unknown (bullpen game / opener): use team bullpen-weighted projection (team_avg_FIP weighted 70% to bullpen quality, 30% to team overall)
3. Flag the game as **reduced confidence** in all outputs — never recommend a wager on a game with a last-minute pitcher change
4. Pipeline re-runs when new starter is confirmed (target: within 30 minutes of announcement)

**Problem 2: Walk-forward validation (did the probable pitcher actually start?)**

The historical database must record *actual* starters, not probable pitchers. For backtesting:
- Use actual starter data (available from game logs after the fact) for all retrospective projections
- This is not lookahead bias — we're asking "given that we knew this starter was pitching, would our projection have been correct?" The lookahead risk would be using the actual starter's *game performance* as an input, which we obviously won't do
- Separately track: of probable pitchers scraped pre-game, what % actually started? This gives us a confidence discount for live deployment

### 8. Trade Deadline Discontinuity

**Verdict: Accepted. This is a pure MLB problem with no NCAA analog.**

The August 1st deadline can fundamentally reshape a team's pitching staff and lineup overnight. A team's season-to-date FIP is meaningless when they've traded their #1 and #2 starters.

**Proposed Resolution — Roster Change Detector:**

1. **Daily roster diff:** Compare today's active roster to yesterday's. Track acquisitions, DFA's, IL movements, callups via MLB Transaction Wire API.
2. **Pitching staff turnover flag:** If a team's pitching staff (by IP-weighted contribution) turns over >25% in a 7-day window, trigger a rating reset:
   - Down-weight pre-trade team pitching ratings (reduce credibility to 50%)
   - Up-weight individual pitcher projections (use acquiring team's new starters' career/prior-season FIP as the rating base)
   - Gradually blend back to team-level ratings as post-trade sample grows (same Bayesian shrinkage schedule: `w = min(post_trade_IP / 80, 0.90)`)
3. **Buyer/seller classification:** Teams above .500 at the deadline are buyers (expect improvement); teams below are sellers (expect degradation). Apply a ±0.1 run prior adjustment for 2 weeks post-deadline while ratings stabilize.
4. **Lineup turnover:** Same logic for position player trades, but with a higher turnover threshold (one bat traded is less disruptive than one starter traded).

This doesn't need to be complex. The key insight is: **down-weight team aggregates and up-weight individual projections when the roster changes significantly.** The mechanism already exists in our pitcher adjustment system — we just need a trigger.

### 9. LINE_MULTIPLIER Has No MLB Validation / Run Line Format Ambiguity

**Verdict: Accepted. The proposal was ambiguous on the fundamental product format.**

The director correctly identifies that MLB's "spread" product is fundamentally different from NCAA/NBA spreads. Let us be explicit:

**Product Definitions:**

| Product | Format | Model Output |
|---------|--------|-------------|
| **Run line** | Fixed -1.5 at variable juice | Win probability of winning by 2+ runs (from Poisson/NB CDF) |
| **Alternate run lines** | -2.5, -3.5, etc. | CDF at each run threshold |
| **Moneyline** | Variable juice, no spread | Win probability directly |
| **Total (O/U)** | Fixed number at -110/-110 | Projected total vs posted total |
| **F5 total** | First 5 innings O/U | Projected F5 total (starter-only model) |
| **F5 ML** | First 5 innings winner | F5 win probability |

**The LINE_MULTIPLIER concept does not transfer to MLB.** In NCAA, we project a margin and multiply it to get a spread because the market offers variable spreads. In MLB, the -1.5 run line is fixed — the market adjusts the *juice*, not the spread. Our model needs to output **win probability at specific run thresholds**, not a projected spread that gets multiplied.

This is actually simpler than the NCAA approach: the Poisson/NB distribution directly gives us `P(margin >= 1.5)`, `P(margin >= 2.5)`, etc. No multiplier needed.

**Revised architecture for spread products:**
```
P(home wins by 2+) = sum of Poisson/NB P(home_runs = h, away_runs = a) where h - a >= 2
fair_RL_juice = P / (1 - P) converted to American odds
edge = fair_juice - posted_juice
```

### 10. F5 Lines Should Be Primary Product

**Verdict: Accepted. The director's logic is compelling.**

The argument is straightforward: if our thesis is that pitcher modeling is the primary lever, F5 lines isolate exactly that lever with zero bullpen noise. Full-game lines add bullpen variance, fatigue modeling, and late-game randomness — all of which are harder to model and add noise to the pitcher signal.

**Revised Phase 1 Scope:**
- F5 totals and F5 ML are **promoted to Phase 1 products**, not deferred
- Full-game totals and run line remain in Phase 1 but are not assumed to be the primary product
- The walk-forward will evaluate all products (F5 total, F5 ML, full-game total, full-game RL, full-game ML) and the product hierarchy will be determined by results

**F5 Projection Model:**
```
F5_home_runs = projected_starter_runs_allowed(away_SP, home_offense) x (5/9)
F5_away_runs = projected_starter_runs_allowed(home_SP, away_offense) x (5/9)
F5_total = F5_home + F5_away + park_factor_adjustment
```

This is cleaner than the full-game model because it removes: bullpen quality estimation, fatigue modeling, late-game leverage effects, and closer usage patterns. The only inputs that matter are starter quality and team offensive talent — both of which we model with high confidence.

**One caveat:** F5 lines have lower betting limits at most books. We need to verify that the F5 market is deep enough to be tradeable at meaningful volume. If limits are too low, F5 becomes an analytical validation tool (proving our pitcher model works) even if the primary wagering product ends up being full-game.

---

## Yellow — Important Refinements

### 11. FanGraphs Scraping Is Legally Fragile

**Verdict: Accepted. We will restructure data sourcing.**

**Revised Data Source Priority:**

1. **Baseball Savant (primary)** — MLB explicitly provides bulk CSV downloads, leaderboards, and a public API. Savant covers: xwOBA, xFIP components (K, BB, HR, IP), OAA, sprint speed, catcher framing, Stuff+, park factors. This is the sanctioned path.
2. **MLB Stats API (primary)** — Official API at statsapi.mlb.com. Covers: schedule, rosters, game logs, box scores, probable pitchers, standings. No scraping needed — this is a public API.
3. **Baseball Reference (secondary)** — For historical data and game logs. Use Retrosheet for bulk historical data instead of scraping BR.
4. **FanGraphs (tertiary/manual)** — Use only for metrics not available elsewhere (SIERA, BsR, DRS). If we need these daily, budget for a FanGraphs data subscription or use their official API within rate limits. Do not build an automated scraper against their leaderboards.

The proposal's data source table will be revised to reflect this hierarchy. Most of what we listed under FanGraphs is available from Savant or the MLB Stats API.

### 12. Regression Schedule Is Vague

**Verdict: Accepted. The director's three criticisms are all correct.**

**Fix 1 — Derive regression from year-to-year correlation:**

We will compute year-to-year team-level correlation for each metric using 2019-2025 data:
- wRC+: expected r ~ 0.70-0.75 -> ~25-30% regression for full season
- Team FIP: expected r ~ 0.55-0.65 -> ~35-45% regression for full season
- ISO: expected r ~ 0.65-0.70 -> ~30-35% regression for full season

These are starting points. We will compute the actual correlations from data and derive regression amounts empirically.

**Fix 2 — Separate the two regression operations:**

The proposal conflated two different things:

a) **Prior-year shrinkage (April problem):** When current-season sample is small, blend toward prior-year performance as the Bayesian prior. This is "what was this team last year?" and decays as current-season data accumulates.

b) **Mean regression (persistent):** Even with full-season data, regress toward league average to account for the gap between observed and true talent. This is smaller in MLB than NCAA but never zero.

**Explicit formula:**
```
effective_rating = (1 - prior_weight) x current_season_rating + prior_weight x prior_year_rating
prior_weight = max(0.10, 0.50 - (games_played / 162) x 0.40)

// Then apply mean regression
final_rating = effective_rating x (1 - mean_regression) + league_avg x mean_regression
mean_regression = 0.10  // permanent, derived from year-to-year r
```

At Opening Day (0 games): 50% prior year, 50% current (which is nothing) -> effectively 100% prior year
At 81 games (midseason): 10% prior year, 90% current -> then 10% regression to league mean
At 162 games (end of season): 10% prior year -> then 10% regression to league mean

**Fix 3 — Write the formula, don't describe it verbally.**

Done above. The revised spec will include the exact formulas, not prose descriptions.

### 13. Catcher Framing Effect Is Understated / Interacts with Pitcher Model

**Verdict: Partially accepted. The interaction argument is strong; the Phase 1 inclusion is debatable.**

The director makes a compelling point: framing interacts with the pitcher adjustment. A 3.50 FIP pitcher with a -10 framing catcher projects closer to 3.80-4.00 ERA. If we're adjusting based on pitcher FIP but ignoring who's catching, we have a systematic bias in the pitcher adjustment itself.

**Compromise — Phase 1 binary flag:**

We will implement a simple catcher framing adjustment in Phase 1:
- Classify catchers into 3 tiers: elite (top 20%), average (middle 60%), poor (bottom 20%) based on Baseball Savant framing runs
- Apply adjustment: elite = -0.08 runs, average = 0.00, poor = +0.10 runs (asymmetric per director's observation)
- This captures the majority of the effect without requiring a full framing model
- Phase 2 upgrades to continuous framing runs per catcher

This is low implementation cost and addresses the pitcher model interaction. The daily data requirement is just "who is the starting catcher?" — available from lineup cards via MLB Stats API.

### 14. Rest/Travel Adjustments Have Mixed Evidence

**Verdict: Accepted. Remove from Phase 1 entirely.**

The director's recommendation is clean: build without rest/travel adjustments, measure residual error by rest/travel category in the walk-forward, and add only if the signal is statistically significant.

We were already hedging on these ("validate before including") but the director is right that building infrastructure for unproven effects is wasted effort. If the walk-forward shows a significant residual pattern by rest/travel category, we add it in Phase 2 with data backing it up.

**Removed from Phase 1:**
- Day game after night game adjustment
- Cross-country travel adjustment
- Off-day freshness adjustment
- Doubleheader Game 2 adjustment

**Retained in Phase 1 (as a diagnostic, not a model input):**
- Track rest/travel category for every game in the historical DB
- After walk-forward, run residual analysis by category
- Only promote to model input if p < 0.05 and effect size > 0.05 runs

### 15. September Is a Different Baseball Game

**Verdict: Accepted. Simple fix.**

**Phase 1 addition:**
- Binary `playoff_race` flag based on FanGraphs or Baseball Reference playoff probability (>10% = in race, <10% = out)
- For September games where one team is out of contention:
  - Reduce confidence level on all recommendations involving that team
  - Do not apply pitcher projections based on season-to-date usage patterns (expect rest/prospect auditions)
  - Flag in output: "SEP_ROSTER — [team] eliminated, projected lineup/rotation unreliable"
- For September games where both teams are in contention: no adjustment (both teams are maximizing)

This is a low-cost flag that prevents the model from making confident recommendations in the most unpredictable month. We don't need to model September perfectly — we need to know when to abstain.

---

## Blue — Strategic / Philosophical

### 16. The Proposal Doesn't Engage With Market Efficiency

**Verdict: Accepted. This is the most important strategic gap.**

The director is asking the right question: in an efficient market, where does the edge come from? "Building a more-accurate-than-average model" is necessary but insufficient — the question is *what specific mispricing are we exploiting?*

**Proposed Inefficiency Theses (to be validated in walk-forward):**

1. **Bullpen fatigue mispricing:** The public and most models use season-level bullpen stats. When a bullpen has thrown 15+ IP in the last 3 days, the full-game total should adjust upward but the posted line often doesn't fully reflect this. Our game-log-level fatigue tracking may capture a real mispricing, particularly in the second half when bullpen fatigue accumulates.

2. **Pitcher injury recovery / return mispricing:** When a starter returns from IL, books typically price them near their pre-injury projection. But post-IL starters consistently underperform for 2-3 starts (velocity down, pitch count limited, rust). If we detect IL returns and apply a +0.3-0.5 run adjustment for the first 3 starts back, this may be systematically underpriced.

3. **Early-season narrative overreaction:** April lines are set partly on offseason narratives (spring training hype, preseason rankings). Our prior-year Bayesian approach should be more stable than market sentiment. If a team's April lines are moved by a hot spring training or a splashy free agent signing, our ratings (based on actual prior-season performance) may find value.

4. **F5 market inefficiency:** F5 lines are less heavily bet than full-game lines, with thinner sharp action. The F5 total market in particular may be less efficient because it requires pitcher-specific modeling that casual bettors don't do. This is our strongest structural hypothesis per the director's F5 argument.

5. **Catcher framing as hidden variable:** Most public models don't adjust for catcher framing. If framing is worth 0.1-0.2 R/G and the market doesn't fully price it, this is a small but persistent edge, especially on totals.

**What we're NOT claiming:**
- We don't claim the full-game spread market is inefficient enough for consistent edge — it may not be
- We don't claim the overall under/over bias from NCAA transfers — it must be validated
- We don't claim our model will be more accurate than sharp money — we claim it may find specific niches where the line hasn't fully adjusted

**Validation approach:** For each thesis, we will measure: (a) does the condition exist in historical data? (b) when the condition is present, is there a measurable mispricing vs. the opening line? (c) is the effect large enough to overcome juice? If a thesis doesn't pass all three, we discard it.

### 17. Open Questions Should Be Answers

**Verdict: Accepted. The director's answers align with our inclinations but we should have committed.**

Adopting the director's answers with minor modifications:

| Question | Director's Answer | Our Response |
|----------|------------------|--------------|
| Q1 Timeline | 2026 = paper trading, 2027 = live | **Adopted.** 2026 season is data collection + real-time paper validation. Build starts now. |
| Q2 Infrastructure | Separate pipeline, shared utilities | **Adopted.** MLB subfolder under BoundScraper/bbmi_pipeline/ sharing Poisson engine, calibration module, odds API wrapper. Sport-specific scrapers and model config. |
| Q3 Statcast depth | FIP/xFIP only Phase 1 | **Adopted.** Stuff+ deferred to Phase 2. |
| Q4 Player projections | Not addressed | **Our answer:** Consume Steamer/ZiPS as *validation benchmarks*, not inputs. Build our own pitcher projections from FIP/xFIP/career data. Don't create a dependency on third-party projection methodology. |
| Q5 Catcher framing | Not addressed directly | **Phase 1 binary flag** per the director's critique in point #13. |
| Q6 Walk-forward standard | 2,000+ OOS games (1 season) | **Adopted with caveat.** One MLB season (2,430 games) provides more statistical power than two NCAA seasons. But we add: must validate across both halves of the season (April-June vs July-September) independently. If the model only works in one half, it's overfit to seasonal patterns. |
| Q7 F5 lines | Yes, Phase 1 | **Adopted.** F5 is a primary Phase 1 product. |
| Q8 Budget | Not addressed | **Our answer:** Budget for (a) historical odds data source if Odds API opening lines prove insufficient, (b) FanGraphs data subscription if Savant can't cover SIERA/BsR. Estimate: $200-500/year total. |

---

## Summary of Revisions

| # | Issue | Resolution | Effort |
|---|-------|-----------|--------|
| 1 | Break-even math | Thresholds raised to 53.5% spread, 56% under, +2% ROI minimum | Done |
| 2 | wRC+ park double-count | Two-layer talent/projection separation with explicit math | Medium |
| 3 | Poisson assumption | Distribution validation study (Poisson vs NB) before model build | Medium |
| 4 | Under-finder portability | Product hierarchy removed; determined by walk-forward results | Done |
| 5 | Opening vs closing line | Validate against opening lines; budget for historical odds source | High |
| 6 | Point-in-time ratings | Rolling simulation with `--point-in-time` flag; spec written | High |
| 7 | Pitcher scratch fallback | 3-tier fallback protocol; historical mismatch rate tracking | Medium |
| 8 | Trade deadline | Roster change detector with pitching staff turnover trigger | Medium |
| 9 | LINE_MULTIPLIER / run line | Replaced with direct CDF-based win probability at run thresholds | Medium |
| 10 | F5 as primary product | Promoted to Phase 1; F5 projection model specified | Medium |
| 11 | FanGraphs scraping | Savant + MLB Stats API as primary; FanGraphs tertiary/subscription | Low |
| 12 | Regression schedule | Explicit formula with empirical year-to-year r derivation | Low |
| 13 | Catcher framing | Phase 1 binary flag (elite/avg/poor); continuous in Phase 2 | Low |
| 14 | Rest/travel | Removed from Phase 1; diagnostic tracking only | Done |
| 15 | September flag | Binary playoff_race flag; abstain on eliminated teams | Low |
| 16 | Market inefficiency thesis | Five specific theses defined; each validated in walk-forward | High (research) |
| 17 | Open questions as answers | All 8 questions answered with commitments | Done |

---

## Revised Phase 1 Scope (Post-Critique)

**Before any model code:**
1. Distribution validation study (Poisson vs negative binomial)
2. Historical odds data inventory (what can The Odds API provide for opening lines?)
3. Year-to-year correlation analysis for all proposed metrics (derive regression empirically)
4. FanGraphs vs Savant vs MLB Stats API coverage audit (what's available where?)

**Phase 1 Model Build:**
- Team offensive rating (wRC+-based, two-layer park separation)
- Team pitching rating (FIP/xFIP/K-BB%)
- Starting pitcher adjustment (FIP-based Bayesian shrinkage with prior-year priors)
- Bullpen quality and fatigue (game-log-level)
- Catcher framing (binary flag)
- Park factors (FanGraphs published, validated against self-computed)
- Weather (transferred from NCAA)
- HCA = 0.3 flat
- Poisson OR negative binomial (per distribution study results)
- F5 projection model (starter-only)
- Full-game projection model
- Point-in-time rolling backtest infrastructure
- Roster change detector (trade deadline)
- September playoff race flag

**Phase 1 Validation:**
- Walk-forward on 2024-2025 (point-in-time, opening lines)
- Products evaluated: F5 total, F5 ML, full-game total, full-game RL, full-game ML
- Success: 53.5%+ ATS on best product, +2.0% net ROI, consistent across both season halves
- Product hierarchy determined by results, not assumed

**Phase 1 Output:**
- Either: validated model with identified product(s) ready for 2027 paper trading/live deployment
- Or: documented conclusion that MLB market efficiency prevents profitable deployment, with specific evidence showing where the edges don't clear juice

Both outcomes are acceptable. We're not committed to launching an MLB product — we're committed to finding out whether one is viable.

---

*Submitted for director's second review.*
