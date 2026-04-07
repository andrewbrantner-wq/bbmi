# BBMI Sports -- NCAA Baseball Predictive Model
## Methodology Brief for External Review
### Prepared for: Director of Risk, Vegas Analytics
### March 2026 | CONFIDENTIAL

---

## Purpose

BBMI Sports operates a public-facing NCAA baseball predictive model at bbmisports.com that generates game-by-game spread predictions, over/under totals, moneylines, and win probabilities for all Division I matchups. We previously received and implemented a 17-point critique of this model's initial specification. This document describes the current state of the model after those improvements and requests a second-round review focused on identifying remaining weaknesses and opportunities.

---

## Model Architecture

### Data Sources

The model draws from four primary data sources, with the NCAA API serving as the backbone for team statistics:

| Source | Data Provided | Role |
|--------|--------------|------|
| NCAA API (henrygd) | OBP, SLG, WHIP, K/9, ERA, HR allowed, HBP allowed, K/BB, fielding % -- all at team level from 15 stat endpoints covering 300+ D1 teams | Primary stats source |
| Warren Nolan | RPI rankings, Strength of Schedule, runs/game, runs allowed/game | RPI/SOS only (demoted from primary) |
| College Baseball Insiders | Probable starting pitchers (ERA, SIERA, K%, BB%, IP, hand), bullpen ERA derivation, weather (temp, wind, humidity), stadium data (RPG, dimensions) | Daily game-day data |
| The Odds API | Vegas spreads, moneylines, totals from DraftKings, FanDuel, BetMGM | Market comparison + opening line capture |

### Team Rating System

Each team receives an offensive rating (expected runs scored) and a defensive rating (expected runs allowed), both regressed 25% toward the league mean of 5.5 runs/game.

**Offensive Rating** (weighted composite, scaled to runs):
- Adjusted runs/game: 25% (Warren Nolan)
- wOBA: 25% (calculated from real NCAA API components: BB, HBP, 1B, 2B, 3B, HR, PA)
- On-base percentage: 20% (NCAA API code 589)
- Stolen base rate: 10% (NCAA API code 326)
- Strength of schedule adjustment: 10%
- Slugging: 10% (NCAA API code 327)

**Defensive Rating** (weighted composite):
- Starter FIP: 35% (calculated from real NCAA API HR allowed, BB, HBP, K, IP)
- Bullpen ERA: 25% (derived daily from CBI pitcher history: team ERA minus starter contribution)
- WHIP: 20% (NCAA API code 597)
- K/9: 15% (NCAA API code 425)
- Fielding %: 5% (NCAA API code 212)

**BBMI Composite Score** = (offensive rating - defensive rating) + SOS bonus, where SOS bonus = (150 - SOS rank) / 150.

---

## Win Probability

Win probabilities are calculated using independent Poisson distributions for each team's run scoring:

```
P(home wins) = sum over all (h, a) where h > a of:
    [e^(-lambda_h) * lambda_h^h / h!] * [e^(-lambda_a) * lambda_a^a / a!]
```

Where lambda_h = home team's projected runs and lambda_a = away team's projected runs. Ties are split 50/50 as an extra-innings approximation. This is the same approach used by professional sportsbooks for baseball.

---

## Game Projection

Each game's projected runs follow an 11-step process:

1. **Base projection**: home_runs = (home_offense + away_defense) / 2
2. **Home/away offensive splits**: team-specific multipliers from completed game history (cap +/-20%, min 5 home + 5 away games)
3. **Series position**: Friday ace (x0.95 runs allowed), Saturday #2 (x1.00), Sunday #3 (x1.08)
4. **Pitcher quality adjustment**: Bayesian-shrunk individual pitcher PQS vs team average (capped at +/-2.0 runs)
5. **Home field advantage**: 0.3 runs (only when team-specific splits unavailable)
6. **Park factor**: multiplicative (CBI daily RPG > cached venue RPG > static altitude/park dict > 1.0)
7. **Temperature**: +0.5 runs per 10F above 72F baseline (outdoor only, capped +/-12%)
8. **Wind direction**: Out to CF = +0.5%/mph over 10mph; In from CF = -0.7%/mph over 10mph (outdoor only)
9. **Conference tier offset**: P5 vs low-major = +0.6 total runs
10. **Floor**: minimum 1.0 runs per team
11. **Spread/total/moneyline derivation**: from Poisson win probability on projected runs

---

## Pitcher Quality Score (PQS)

Individual pitcher performance is blended with team baseline using Bayesian shrinkage based on starts:

| Starts | Individual Weight | Team Weight | Rationale |
|--------|------------------|-------------|-----------|
| 0-2 | 0% | 100% | No signal |
| 3-4 | 30% | 70% | Minimal sample |
| 5-7 | 55% | 45% | Moderate signal |
| 8-12 | 75% | 25% | Reliable |
| 13+ | 90% | 10% | Full confidence |

PQS components: FIP (35%), K/9 (25%), WHIP (25%), ERA (15%). The adjustment is capped at +/-2.0 runs to prevent single-pitcher overcorrection.

---

## Bullpen Modeling

College starters average 4-5 innings. The bullpen throws 40-50% of every game. The model tracks bullpen ERA separately:

```
bullpen_era = (team_era * total_ip - sum(starter_era * starter_ip)) / bullpen_ip
```

Bullpen ERA is weighted at 25% of the defensive rating. Starter FIP is weighted at 35%. This split is derived daily from CBI's pitcher history database (855 pitchers across 306 teams).

---

## Spread & Moneyline Derivation

- **Spread**: projected margin rounded to nearest 0.5 (no integer lines), sign convention: negative = home favored
- **Moneyline**: derived from Poisson win probability
  - Favorite: ML = -(win_prob / (1 - win_prob)) x 100
  - Underdog: ML = ((1 - win_prob) / win_prob) x 100
- **Over/under**: sum of both teams' projected runs, rounded to nearest 0.5

---

## Line Movement Tracking

The pipeline captures opening lines (8:00 AM CT) and closing lines (10:45 AM CT) daily:
- Opening line cached before sharp money moves markets
- Line movement = closing - opening
- Stored per game for future CLV (Closing Line Value) analysis

---

## Model Calibration

- **STD_DEV_SPREAD = 6.2** (calibrated from 710 completed games)
- **MODEL_VERSION = 2** -- all recalibration metrics isolated from v1 legacy data
- Automatic recalibration runs after every pipeline execution, reporting:
  - Spread and total bias (systematic over/under-projection)
  - MAE (mean absolute error)
  - STD_DEV drift recommendations
- Model maturity tracking: early_season (<100 games) through mature (500+ games)

---

## Known Limitations

1. **Single-season calibration**: The model has only been running since February 2026. STD_DEV and regression constants are calibrated on current-season data. Multi-season walk-forward validation has not been performed (unlike our football model which was validated across 2023-2025).

2. **Total bias**: Early recalibration indicates the model may be over-projecting totals by 2-4 runs. This is being monitored but not yet corrected to avoid premature adjustment on thin data.

3. **Home bias**: A +1.2 run home margin over-projection was detected in early calibration. Home/away splits partially address this, but the root cause may be deeper.

4. **No injury modeling**: College baseball does not have reliable injury reporting feeds. Pitcher TBD situations are handled via team baseline fallback, but day-of scratches are not captured.

5. **NCAA API limitations**: The API provides team-level stats only (not individual player stats). Individual pitcher data comes from CBI, which is a web scraper dependent on a third-party site's availability.

6. **Park factor approximation**: Static park factors are hand-assigned for ~20 venues. The dynamic stadium RPG cache improves over the season but has limited data early.

7. **No coaching/scheme adjustments**: Coaching changes and tactical tendencies are not modeled.

8. **Thin odds market**: Many mid-major games have no Vegas line available. The model generates predictions for all games but can only compute edge for games with market lines.

---

## What We're Looking For

We would appreciate your assessment of:

1. **Run projection methodology**: Is the (offense + defense) / 2 base formula appropriate, or should we use a different interaction model? The football review recommended testing a weighted average (e.g., 45% offense / 55% defense).

2. **Poisson model adequacy**: We use simple independent Poisson distributions. Should we consider a correlated Poisson model, negative binomial for overdispersion, or the Skellam distribution for margin prediction?

3. **Regression rate**: Is 25% regression to mean appropriate for a 56-game college baseball season? Should it decay over the season (like our football model's phase blending)?

4. **Pitcher adjustment cap**: The +/-2.0 run cap was set heuristically. Is this the right range? Professional shops may have data on the actual point-spread impact of starting pitcher changes in college baseball.

5. **Bullpen modeling depth**: We derive bullpen ERA from the residual (team ERA minus starter contribution). Are there better approaches? Should we weight high-leverage relievers differently from mop-up arms?

6. **Series position factors**: The 0.95/1.00/1.08 multipliers for Friday/Saturday/Sunday were set from the original critique. Should these be empirically calibrated from historical data?

7. **Weather model**: We use linear temperature and wind adjustments. Should we model weather as a continuous function with interaction terms (like our football model does)?

8. **Market efficiency**: College baseball is described as one of the most inefficient markets. Does our edge threshold approach (highlighting games with 2+ run disagreement with Vegas) make sense, or should we use a different framework for identifying actionable picks?

9. **wOBA calculation**: We calculate wOBA from real NCAA API components using standard linear weights. Should the weights be adjusted for the college run environment (which differs from MLB)?

10. **What are we missing entirely?**: What factors do professional college baseball pricing models include that we've omitted?

---

## Performance Context

The model is in its first season of operation. Early-season metrics (subject to in-sample bias):
- 2,100+ games tracked
- Model maturity: mature (500+ completed v2 games)
- Spread ATS and total accuracy are being monitored but not yet published pending multi-season validation

Our NCAA football model underwent a similar review process and was subsequently walk-forward validated at 56-58% ATS across three unseen seasons. We intend to apply the same rigor to the baseball model once sufficient historical data is available.

---

## Contact

For questions about the methodology or to discuss findings, contact the BBMI Sports development team at support@bbmihoops.com.

*This document is confidential and intended solely for the purpose of the requested model review.*
