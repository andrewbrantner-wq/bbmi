# BBMI MLB Spread & Over/Under Model Proposal

**Prepared:** 2026-03-29
**Author:** BBMI Analytics
**Status:** Draft for Director Review

---

## Part 1: BBMI NCAA Baseball Methodology Summary

### 1.1 Core Architecture

The BBMI NCAA baseball model is a **Poisson-based projection system** that independently projects runs for each team, then derives spreads, totals, moneylines, and win probabilities. The model was developed through a rigorous diagnostic process and validated via **walk-forward backtesting** across 2024 and 2025 seasons (~1,977 games out-of-sample).

**Validated Performance:**
| Product | ATS% | Sample | Status |
|---------|------|--------|--------|
| Under picks (edge >= 1.5) | 61.7% | 269-167 (2025) | Primary product |
| Spread picks (edge 2.0-5.0) | 54.4% | 312-259 (2025) | Co-primary product |
| ML disagree picks | +4-10% ROI | 5-10% prob edge | Tertiary |
| Over picks | 44.2% | Negative EV | Display only |

### 1.2 Spread (Run Line) Methodology

**Core Formula:**
```
Projected Margin = (Home_Off - Away_Def + Away_Off - Home_Def) / 2 + adjustments
BBMI Line = -(Projected Margin x BBMI_LINE_MULTIPLIER)
```

**BBMI_LINE_MULTIPLIER = 2.0** — This decompresses the rating differential to the actual spread scale. Walk-forward validated at the center of a 1.75-2.25 plateau, chosen for robustness.

**Projection steps (per game):**
1. Calculate offensive & defensive composite ratings (see Section 1.4)
2. Apply re-anchoring factors to ground ratings in observed league-average R/G
3. Compute base projected runs: `(team_off + opp_def) / 2` for each side
4. Apply pitcher adjustment (ERA-based, Bayesian shrinkage, +/-0.5 cap)
5. Apply series position factor (Fri ace 0.95, Sat 1.00, Sun 1.04)
6. Apply platoon split (+0.15 runs for LHP vs RHB-dominant lineup)
7. Apply midweek multiplier (x1.03 for Tue/Wed/Thu)
8. Apply bullpen fatigue (+0.3 runs when BP has 10+ IP in prior 3 days)
9. Apply HCA (+0.3/-0.3 runs, 0.6 total, flat — no team-specific splits)
10. Apply park factor (multiplicative, team-quality-adjusted)
11. Apply weather adjustments (temp, wind, humidity)
12. Apply conference tier offset (P5 vs mid +0.3, P5 vs low +0.6)
13. Floor at 1.0 runs per team
14. Calculate Poisson win probability -> derive moneylines

### 1.3 Over/Under (Total) Methodology

**Core Formula:**
```
Projected Total = Home_Runs + Away_Runs + DOW_Total_Adjustment
```

**Day-of-Week Adjustment** (key finding — starter workload drives scoring):
| Day | Adjustment | Reason |
|-----|-----------|--------|
| Monday | 0.0 | Baseline |
| Tuesday | 0.0 | Midweek (short starters, more bullpen) |
| Wednesday | 0.0 | Midweek baseline |
| Thursday | -0.8 | Game 1 of conference series |
| Friday | -2.0 | Ace vs ace, starters throw 4.76 IP avg |
| Saturday | -1.5 | #2 starters, 4.53 IP avg |
| Sunday | +0.3 | Bullpen games, shortest starter outings |

**Root cause validated:** Friday starters average 4.76 IP (29% go 6+) vs Tuesday starters at 3.01 IP (3% go 6+). The model's team-level ratings blend starter + bullpen ERA; when aces cover 5-7 innings, the model over-projects bullpen usage. The DOW adjustment corrects this structural bias — the director confirmed this IS the fix, not a stopgap.

**Park factors** applied multiplicatively. **Total bias correction = 0.0** — re-anchoring handles calibration. Rounded to nearest 0.5.

### 1.4 Rating Systems

**Offensive Rating Weights:**
| Component | Weight | Source |
|-----------|--------|--------|
| adj_runs_per_game | 25% | NCAA API (code 213) — primary observed output |
| wOBA | 25% | Calculated from component stats (BB, HBP, 1B, 2B, 3B, HR) |
| OBP | 20% | NCAA API (code 589) — plate discipline |
| SLG | 10% | NCAA API (code 327) — power/extra-base hits |
| Stolen base rate | 10% | NCAA API (code 326) — speed-based run creation |
| SOS adjustment | 10% | Warren Nolan RPI — schedule strength |

**Defensive Rating Weights (lower = better):**
| Component | Weight | Source |
|-----------|--------|--------|
| Starter FIP | 35% | Calculated: (13xHR + 3x(BB+HBP) - 2xK) / IP + 3.2 |
| Bullpen ERA | 25% | Derived: (team_ERA x total_IP - sum(SP_ERA x SP_IP)) / BP_IP |
| WHIP | 20% | NCAA API (code 597) — baserunner prevention |
| K/9 | 20% | NCAA API (code 425) — swing-and-miss |
| Fielding % | 0% | REMOVED — not predictive in college baseball |

**Regression to mean:** 25% blend toward league average for both offense and defense.

**Re-anchoring:** Each pipeline run calculates `reanchor_factor = league_avg_R/G / avg_composite_rating` to ground synthetic ratings in actual run environment. This prevents systematic over/under-projection from component scaling (wOBA x15, WHIP x3, etc.).

### 1.5 Pitcher Adjustment

- **ERA-based** (PQS formula was tested and destroyed signal)
- **Bayesian shrinkage:** `shrunk_ERA = w x pitcher_ERA + (1-w) x team_ERA` where `w = min(starts/8, 0.85)`
- **Adjustment:** `pitcher_adj = (shrunk_ERA - team_ERA) x 1.5`, capped at +/-0.5 runs
- **Key finding:** ERA = FIP in college baseball (r=0.157 vs r=0.158) — noise swamps theory
- **Key finding:** ERA-to-IP relationship is flat (R^2=0.008) — coaches manage by pitch count, not quality
- **k=0.18** locked after sweep showed it only moves 0.08 runs across full range

### 1.6 Park Factors

- **Self-computed**, team-quality-adjusted (CBI stadium RPG removed — had +1.64 run bias from team-quality conflation)
- **Method:** `PF = avg_actual_total / avg_expected_total` per venue, where expected uses team ratings without park adjustment
- **Regression:** 40% at 8-game minimum, decays 3% per additional game, floor 10%
- **Bounds:** 0.75-1.30
- **Coverage:** 171 venues from 4,330+ games, 84% of games covered
- **Validation:** +3.1 pp improvement over no park factors (49.7% -> 52.8% O/U ATS)

### 1.7 Data Sources

| Source | Data | Update Frequency |
|--------|------|-----------------|
| NCAA API (henrygd) | Team batting/pitching stats (20+ stat categories) | Daily |
| Warren Nolan | RPI rankings, SOS, conference assignment | Daily |
| ESPN API | Schedule, scores, venue info | Real-time |
| College Baseball Insiders | Probable pitchers, stadium metadata, weather, book odds | Daily |
| The Odds API | Vegas lines (DraftKings priority) | Pre-game |
| Historical DB (SQLite) | 19,854 games, 151,825 pitching lines | Daily auto-build |

### 1.8 Key Analytical Findings (Permanent)

These findings were validated through rigorous analysis and should inform any new model:

1. **Pitcher quality matters but team ratings capture 85% of signal** — individual pitcher adjustment is a marginal refinement
2. **FIP = ERA in college** — noise swamps the theoretical advantage of defense-independent metrics
3. **Home/away splits don't persist** (stability r=0.026) — flat HCA is correct
4. **Starter workload drives day-of-week scoring patterns** more than pitcher quality
5. **The model is structurally an under-finder** — over picks are negative EV
6. **Park RPG conflates team quality with venue effect** — must be quality-adjusted
7. **Weight optimization fits noise** (permutation test proved this in basketball) — don't overfit weights

---

## Part 2: MLB Spread & Over/Under Model Proposal

### 2.1 Strategic Rationale

The NCAA model provides a proven architectural template. MLB differs in several critical ways that create both challenges and opportunities:

| Dimension | NCAA | MLB | Implication |
|-----------|------|-----|------------|
| Sample size per team | 56 games/season | 162 games/season | More stable ratings, faster convergence |
| Pitcher signal | Weak (team captures 85%) | **Strong** (starters dominate) | Pitcher modeling is the primary lever |
| Bullpen usage | Chaotic (short starts) | Structured (6th-9th inning roles) | Bullpen modeling is tractable |
| Park factors | Moderate variance | **Extreme variance** (Coors, Fenway) | Park modeling is critical |
| Platoon splits | Minimal data | **Deep data** (years of L/R splits) | Platoon adjustment is real and measurable |
| Lineup stability | Roster turnover, no DH/NL split | Daily lineup cards available | Lineup-specific projections possible |
| Market efficiency | Thin/inefficient | **Most efficient sports market** | Edges will be smaller; precision matters |
| Data availability | Limited, fragmented | **Best in sports** (Statcast, FanGraphs) | More and better inputs available |

**Key thesis:** MLB's richer data and larger samples should allow a more precise model, but the market is also more efficient. Our edge will come from (a) the structural under-finding tendency proven in NCAA, (b) rigorous walk-forward validation that prevents overfitting, and (c) pitcher/bullpen modeling depth that retail bettors underweight.

### 2.2 Proposed Architecture

Maintain the proven **Poisson-based projection system** — project runs independently for each team, derive all outputs from those projections. This architecture worked in NCAA and is even more appropriate for MLB where run distributions follow Poisson more cleanly (larger samples, less variance in team quality).

```
MLB Projected Runs (per team):
  = Base Team Rating
  + Starting Pitcher Adjustment
  + Bullpen Quality Adjustment
  + Lineup-Specific Adjustment (optional Phase 2)
  + Park Factor (multiplicative)
  + Weather Adjustment
  + Home Field Advantage
  + Umpire Adjustment (optional Phase 2)
  + Rest/Travel Adjustment

Spread = -(Home_Proj - Away_Proj) x LINE_MULTIPLIER
Total  = Home_Proj + Away_Proj + Bias_Correction
ML     = Derived from Poisson win probability
```

### 2.3 Component Design: Team Base Ratings

#### 2.3.1 Offensive Rating

MLB has far richer offensive data. Proposed components:

| Component | Proposed Weight | Metric | Rationale |
|-----------|----------------|--------|-----------|
| wRC+ | 25% | Runs Created Plus (park/league adjusted) | Gold standard for overall offensive production; already park-adjusted |
| wOBA | 20% | Weighted On-Base Average | Linear weights on all offensive events; proven predictive in NCAA model |
| Team OBP | 15% | On-Base Percentage | Plate discipline; high year-to-year stability (r~0.70) |
| ISO (Isolated Power) | 15% | SLG - AVG | Pure power metric; HR/XBH production independent of batting average |
| BB% | 10% | Walk Rate | Plate discipline component; stabilizes fastest (~120 PA) |
| K% | 10% | Strikeout Rate | Contact quality indicator; inverse relationship with BABIP-driven variance |
| BsR / Sprint Speed | 5% | Baserunning Runs / Statcast speed | Baserunning value (stolen bases + extra bases taken) |

**Why these over NCAA weights:**
- **wRC+** replaces adj_runs_per_game — it's already park-and-league-adjusted, removing the need for separate re-anchoring on offense
- **ISO** replaces SLG — isolates power from contact, less redundant with OBP
- **BB% and K%** replace SOS adjustment — in MLB, schedule is balanced (everyone plays everyone); plate discipline metrics serve as stabilization
- **BsR** replaces stolen base rate — captures full baserunning value, not just steals

**Data Sources:**
- **FanGraphs** (fangraphs.com): wRC+, wOBA, BB%, K%, BsR, ISO — all available via leaderboard exports and FanGraphs API
- **Baseball Savant / Statcast** (baseballsavant.mlb.com): Sprint speed, expected stats (xwOBA, xBA, xSLG), barrel rate, hard-hit rate
- **Baseball Reference** (baseball-reference.com): Traditional stats, team splits, game logs

**Regression to Mean:**
- Lower than NCAA. Propose **10-15%** blend toward league average (vs 25% in NCAA)
- MLB team talent is more concentrated; 162-game samples are large enough to trust observed performance
- Early season (April): Use higher regression (25-30%) with prior-year ratings as prior
- Midseason (June+): Reduce regression as current-year sample grows

#### 2.3.2 Defensive Rating (Pitching + Fielding)

In MLB, unlike NCAA, pitching and fielding can be separated. The pitching staff — particularly the starting pitcher — is the dominant factor.

**Team Pitching Baseline (used when no specific starter adjustment):**

| Component | Proposed Weight | Metric | Rationale |
|-----------|----------------|--------|-----------|
| Team FIP | 30% | Fielding Independent Pitching | Unlike NCAA (where FIP=ERA), MLB FIP predicts future ERA better than ERA itself |
| Team xFIP | 20% | Expected FIP (normalized HR/FB) | Removes HR variance; more stable than FIP |
| Team SIERA | 15% | Skill-Interactive ERA | Incorporates GB/FB tendency + K/BB interaction |
| Bullpen ERA (last 30 days) | 20% | Recent reliever performance | Bullpen is ~35% of innings; recency matters for fatigue/usage patterns |
| K-BB% | 15% | Strikeout minus walk rate | Single best predictor of pitching quality; stabilizes at ~70 IP |

**Team Fielding:**

| Component | Proposed Weight | Metric | Rationale |
|-----------|----------------|--------|-----------|
| Defensive Runs Saved (DRS) | 40% | Total defensive contribution | Captures range + arm + double plays |
| Outs Above Average (OAA) | 40% | Statcast-based fielding | Tracks actual catch probability vs expected |
| Framing Runs | 20% | Catcher framing value | 10-20 runs/season swing between best and worst framers |

**Why separate pitching and fielding:**
- In NCAA, fielding % was noise (removed at 0% weight). In MLB, fielding has measurable, persistent skill — OAA from Statcast quantifies this objectively
- Catcher framing is a **unique MLB edge** — worth 1-2 runs per game for elite vs poor framers, and most models underweight it
- Fielding adjustment is small relative to pitching (typically +/-0.1 runs/game) but adds precision

**Data Sources:**
- **FanGraphs**: FIP, xFIP, SIERA, K-BB%, DRS, bullpen splits, catcher framing
- **Baseball Savant**: OAA, catcher framing runs, pitch-level data
- **Baseball Reference**: Team fielding stats, game logs

### 2.4 Component Design: Starting Pitcher Adjustment

This is where MLB diverges most from NCAA. In college, team ratings capture 85% of pitcher signal. In MLB, the **starting pitcher is the single most important variable** in any game projection.

#### 2.4.1 Starter Projection Model

For each starting pitcher, project expected runs allowed per 9 innings:

**Primary Metrics (career/season, weighted by recency):**

| Metric | Weight | Why |
|--------|--------|-----|
| FIP (current season) | 25% | Defense-independent; best single-season predictor |
| xFIP (current season) | 20% | Removes HR/FB noise; more stable |
| SIERA (current season) | 15% | Captures pitch sequencing and batted-ball profile |
| Stuff+ / PitchingBot | 15% | Pitch quality model (velocity, movement, location) — captures true talent independent of results |
| FIP (prior 2 seasons, weighted) | 15% | Stabilization from larger sample; handles April starts with <20 IP |
| Recent form (last 5 starts FIP) | 10% | Captures injury-related decline, mechanical changes |

**Bayesian Shrinkage (same principle as NCAA, refined):**
```
projected_ERA = w x pitcher_FIP + (1-w) x team_avg_FIP
w = min(current_season_IP / 80, 0.90)
```
- At 0 IP (season opener): 100% prior-year weighted FIP
- At 40 IP (~8 starts): 50% current, 50% prior
- At 80+ IP (~15 starts): 90% current season
- **Prior** = weighted average of last 2 seasons FIP (60/40 split recent/older)

**Adjustment Calculation:**
```
pitcher_adj = (projected_ERA - team_season_ERA) x innings_factor
innings_factor = projected_IP / 9.0
```
- Positive adjustment = pitcher is worse than team average (more runs)
- Negative adjustment = pitcher is better than team average (fewer runs)

**Projected Innings:**
- Unlike NCAA (where ERA-to-IP is flat), MLB starters have meaningful IP variance
- Project from: season average IP/start, pitch count trends, manager tendencies
- Typical range: 5.0-6.5 IP for most starters
- This directly feeds the bullpen innings calculation

#### 2.4.2 Pitcher Handedness / Platoon Adjustment

MLB platoon splits are **real, persistent, and large**:

| Matchup | Typical wOBA Advantage | Adjustment |
|---------|----------------------|------------|
| RHB vs LHP | +15-20 points wOBA | +0.2-0.3 runs |
| LHB vs RHP | +10-15 points wOBA | +0.1-0.2 runs |
| Same-hand (LHL or RHR) | -10-20 points wOBA | -0.1-0.3 runs |

- Use **opposing lineup's L/R split** (available from daily lineup cards) against starter's handedness
- Adjust projected runs based on lineup's platoon composition
- Data available from: FanGraphs splits, Baseball Savant, ESPN lineup API

### 2.5 Component Design: Bullpen Modeling

MLB bullpens are more structured and measurable than college. This is a significant modeling opportunity.

#### 2.5.1 Bullpen Quality Rating

```
Bullpen_Runs_Allowed = (9 - Projected_Starter_IP) x (Bullpen_ERA_Adj / 9)
```

**Bullpen ERA Adjustment Components:**

| Component | Weight | Source |
|-----------|--------|--------|
| Bullpen FIP (season) | 30% | FanGraphs team bullpen splits |
| Bullpen xFIP (season) | 25% | More stable than FIP |
| High-leverage reliever quality | 25% | Top 3 relievers by WPA — these pitch the close games |
| Recent workload/fatigue | 20% | IP thrown in last 3/5/7 days |

#### 2.5.2 Bullpen Fatigue Model

More granular than NCAA's simple 10+ IP threshold:

```
fatigue_factor = 1.0 + fatigue_adj

fatigue_adj = sum of:
  + 0.02 x IP_last_1_day  (yesterday's usage)
  + 0.015 x IP_last_2_days (2 days ago)
  + 0.01 x IP_last_3_days  (3 days ago)
  + 0.05 if closer_pitched_yesterday AND game projects close
  + 0.03 if team_played_extras_in_last_3_days
```

- Cap fatigue_adj at +0.20 (prevents runaway)
- **Data source:** Game logs from ESPN/MLB API — every pitcher's IP/ER per game is public

#### 2.5.3 Bullpen Usage Pattern

- After day games following night games: bullpen usage typically higher (short rest for starter)
- After extra-inning games: bullpen depleted for 2-3 days
- September roster expansion: bullpen quality improves (fresh arms)
- These are addressable adjustments once base model is validated

### 2.6 Component Design: Park Factors

MLB park factors are **more extreme and better-studied** than NCAA. Our self-computed approach from NCAA transfers directly, but with richer data.

#### 2.6.1 Methodology

Use the same team-quality-adjusted approach from NCAA:
```
PF = avg_actual_total / avg_expected_total (using team ratings, no park adjustment)
```

**But also incorporate:**
- **Multi-year regression:** MLB parks are stable structures; use 3-year weighted PFs (50/30/20)
- **Handedness-specific PFs:** Some parks are more extreme for LHB vs RHB (e.g., Yankee Stadium short right porch)
- **HR park factor vs total PF:** Separate HR factor from overall scoring factor (a park can suppress HRs but allow doubles)
- **Roof/retractable status:** Track open vs closed for retractable-roof parks (Miller, Chase, Minute Maid, etc.)

**Known Extreme Parks (for reference/validation):**
| Park | Approximate PF | Notes |
|------|---------------|-------|
| Coors Field (COL) | 1.25-1.35 | Altitude + dry air; most extreme in sports |
| Great American (CIN) | 1.08-1.12 | Small dimensions, river humidity |
| Globe Life (TEX) | 1.05-1.10 | Retractable roof; hitter-friendly dimensions |
| Oracle Park (SF) | 0.88-0.92 | Marine layer, deep RF, heavy air |
| Petco Park (SD) | 0.90-0.94 | Marine layer, spacious outfield |
| T-Mobile Park (SEA) | 0.92-0.96 | Cool, damp, retractable roof |

**Data Sources:**
- **FanGraphs Park Factors:** Multi-year, handedness-split, HR-specific PFs (pre-computed, validated)
- **Baseball Savant:** Batted-ball trajectory data per park (exit velo + launch angle outcomes)
- **ESPN/MLB API:** Game-by-game scores for self-computation
- **Our own computation:** Same quality-adjusted method from NCAA, validated against FanGraphs published PFs

#### 2.6.2 Application

```
home_proj_runs = base_home_proj x park_factor
away_proj_runs = base_away_proj x park_factor
```

Park factor applies to **both teams equally** (the park affects all hitters, not just the home team). This is consistent with our NCAA approach.

### 2.7 Component Design: Weather

Transfer NCAA weather model directly, with refinements:

| Factor | NCAA Formula | MLB Refinement |
|--------|-------------|----------------|
| Temperature | 0.012 per deg F from 72F baseline | Same; well-validated in baseball literature |
| Wind out | +0.5% per mph, cap +8% | Incorporate Statcast wind vector data per park when available |
| Wind in | -0.7% per mph, cap -10% | Same |
| Humidity | +1.5% per 10% above 50%, cap +6% | Same |
| Indoor/dome | No weather adjustment | Track retractable roof open/closed status |

**Data Sources:**
- **Weather API** (OpenWeather, Visual Crossing): Pre-game forecasts
- **MLB Gameday API**: Some weather data embedded in game feeds
- **Park metadata**: Indoor/outdoor/retractable classification

### 2.8 Component Design: Home Field Advantage

MLB HFA is **smaller and declining** compared to NCAA:

- **Historical MLB HFA:** ~54% home win rate (equivalent to ~0.3-0.4 runs)
- **Recent trend (2020-2025):** Declining toward 53%, possibly 52%
- **Proposed starting value:** HCA_RUNS = 0.3 (vs 0.6 in NCAA)
- **Do NOT use team-specific HFA** — same lesson from NCAA (stability r=0.026)

**Altitude exception:** Colorado home games may warrant +0.1 additional HCA (acclimatization effect — Rockies hitters perform better at altitude due to daily exposure). This is separate from the park factor.

**Interleague DH adjustment:** No longer relevant post-2022 universal DH.

### 2.9 Component Design: Rest & Travel

MLB's 162-game schedule creates fatigue patterns absent from college:

| Situation | Proposed Adjustment | Evidence |
|-----------|-------------------|----------|
| Day game after night game | +0.1 runs to opponent | Reduced offensive output documented |
| 4th game in 4 days (no off day) | +0.05 runs to opponent | Cumulative fatigue |
| Cross-country travel (3+ time zones) | +0.1 runs for traveling team | West-to-East especially impactful |
| First game after off day | -0.05 runs (team is fresher) | Slight offensive bump from rest |
| Doubleheader Game 2 | +0.15 runs to both teams | Bullpen depletion, fatigue |

- Cap total rest/travel adjustment at +/-0.25 runs
- **These are small effects** — validate before including. If not significant in walk-forward, remove them.
- **Data source:** MLB schedule (freely available), compute travel distances and rest days programmatically

### 2.10 Component Design: Umpire Adjustment (Phase 2)

MLB umpires have **measurable, persistent tendencies**:

- Strike zone size varies by umpire by ~1-2 inches
- Large-zone umpires: fewer walks, fewer runs, lower totals
- Small-zone umpires: more walks, more runs, higher totals
- **Effect size:** ~0.3-0.5 runs on total per game
- Umpire assignments announced ~24-48 hours before game

**Data Sources:**
- **Umpire Scorecards** (umpscorecards.com): Accuracy, consistency, favor metrics
- **Baseball Savant**: Called strike probability models by umpire
- **FanGraphs**: Umpire run environment data

**Recommendation:** Phase 2 feature. Validate the base model first without umpire data, then add as a refinement. The signal is real but small.

### 2.11 Component Design: Lineup-Specific Projections (Phase 2)

MLB lineup cards are available ~2-4 hours before game time. This enables:

1. **Sum of individual hitter projections** vs team average:
   - Use each hitter's projected wOBA/wRC+ vs the opposing starter
   - Compare to team season average
   - Adjust projected runs based on delta

2. **Key value:** Captures rest days for stars, minor leaguers called up, platoon lineups vs LHP/RHP

3. **Data Sources:**
   - **MLB API / ESPN API**: Daily lineup cards (typically confirmed by 4-5 PM ET)
   - **FanGraphs / Statcast**: Individual player projections (Steamer, ZiPS, PECOTA, ATC)
   - **Roster moves**: MLB transaction wire (trades, IL, callups)

**Recommendation:** Phase 2. Adds meaningful signal but requires real-time data pipeline and player-level projection infrastructure. Build the team-level model first.

---

## Part 3: Implementation Plan

### 3.1 Phase 1 — Foundation (Pre-Season / First Month)

**Goal:** Working team-level model with pitcher adjustments, validated against historical data.

**Data Pipeline:**
1. **FanGraphs scraper** — Team batting and pitching leaderboards (wRC+, wOBA, FIP, xFIP, SIERA, K-BB%, bullpen splits)
2. **Baseball Savant scraper** — Park factors, Stuff+ ratings, OAA
3. **ESPN/MLB API integration** — Daily schedule, scores, probable pitchers, game results
4. **Odds API** — Vegas lines (DraftKings priority, same as NCAA pipeline)
5. **Historical database** — Build from Retrosheet/FanGraphs game logs (2019-2025, ~15,000 games)

**Model Components (Phase 1):**
- Team offensive rating (wRC+, wOBA, OBP, ISO, BB%, K%, BsR)
- Team pitching rating (FIP, xFIP, SIERA, K-BB%, bullpen ERA)
- Starting pitcher adjustment (FIP-based, Bayesian shrinkage, prior-year priors)
- Park factors (FanGraphs published + self-computed validation)
- Weather adjustments (transfer from NCAA)
- HCA = 0.3 runs flat
- Poisson win probability -> spreads, totals, moneylines
- Re-anchoring calibration (same method as NCAA)

**Validation:**
- Walk-forward backtest: Use 2023 ratings to project 2024, then 2024 ratings to project 2025
- Minimum 2 full seasons out-of-sample before any wagering recommendations
- Track: spread ATS%, total ATS% (over and under separately), spread bias, total bias, STD_DEV
- **Success threshold:** Spread >52% ATS, Under >55% ATS at meaningful edge thresholds

### 3.2 Phase 2 — Refinements (After Walk-Forward Validation)

**Only add these if Phase 1 validates and we need marginal improvements:**

1. **Lineup-specific projections** — requires daily lineup scraping + player projection database
2. **Umpire adjustment** — 0.3-0.5 run effect on totals
3. **Bullpen fatigue granularity** — game-log-level relief pitcher tracking
4. **Catcher framing** — 0.1-0.2 run effect per game
5. **Handedness-split park factors** — separate LHB/RHB park effects
6. **Rest/travel adjustments** — validate before including

### 3.3 Phase 3 — Advanced (Post-First-Live-Season)

1. **Statcast batted ball model** — Use xwOBA, barrel rate, hard-hit rate as leading indicators
2. **Pitch-level modeling** — Stuff+, location+, pitch mix vs lineup composition
3. **In-season roster adjustment** — Trade deadline, callups, IL returns
4. **Second-half splits** — Some pitchers have persistent first-half/second-half patterns
5. **Divisional familiarity** — Teams in same division play 13 times/year; may develop specific edges

### 3.4 Data Source Summary

| Source | URL / Access | Data | Cost | Priority |
|--------|-------------|------|------|----------|
| **FanGraphs** | fangraphs.com/leaders | wRC+, wOBA, FIP, xFIP, SIERA, K-BB%, DRS, splits, park factors | Free (exports) | Critical |
| **Baseball Savant** | baseballsavant.mlb.com | Statcast (EV, LA, sprint speed, OAA, Stuff+, xStats, framing) | Free | Critical |
| **Baseball Reference** | baseball-reference.com | Game logs, historical stats, team splits | Free | Important |
| **ESPN API** | site.api.espn.com | Schedule, scores, probable pitchers, lineup | Free | Critical |
| **MLB Stats API** | statsapi.mlb.com | Official schedule, roster, game data, pitch-by-pitch | Free | Important |
| **The Odds API** | the-odds-api.com | Vegas lines (multi-book) | Existing subscription | Critical |
| **Retrosheet** | retrosheet.org | Historical game logs (1871-present) | Free | Backtest |
| **Weather API** | openweathermap.org | Pre-game weather forecasts | Free tier sufficient | Important |
| **Umpire Scorecards** | umpscorecards.com | Umpire tendencies, zone metrics | Free | Phase 2 |

### 3.5 Key Differences from NCAA Model

| Decision | NCAA Approach | MLB Proposed | Reason for Change |
|----------|--------------|-------------|-------------------|
| Pitcher weight | 15% of projection (team captures 85%) | **40-50% of projection** | MLB starters are the dominant variable |
| FIP vs ERA | Equivalent (r=0.157 vs 0.158) | **FIP >> ERA** | MLB sample sizes make FIP's theoretical advantage real |
| Regression to mean | 25% to league avg | **10-15%** | 162 games >> 56 games; more reliable team-level data |
| Park factors | Self-computed only | **FanGraphs + self-computed validation** | MLB PFs are well-studied; no need to start from scratch |
| Day-of-week adjustment | -2.0 Friday to +0.3 Sunday | **Not applicable** | MLB doesn't have the college series structure |
| Conference tier | P5/mid/low offsets | **Not applicable** | Balanced schedule; no conference tier mismatch |
| Offensive metrics | wOBA, adj R/G, OBP, SLG, SB, SOS | **wRC+, wOBA, ISO, BB%, K%, BsR** | Better metrics available; SOS not needed (balanced schedule) |
| HCA | 0.6 runs | **0.3 runs** | MLB HFA is smaller and declining |
| Lineup specificity | Not possible (unknown lineups) | **Phase 2: lineup-card-based** | MLB announces lineups pre-game |
| Weight optimization | Locked (noise per permutation test) | **Lock early, same discipline** | Same principle applies — grid search finds noise |

### 3.6 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Market efficiency** — MLB is the most efficient betting market | High | Demand walk-forward >52% before any recs; focus on structural edges (unders, pitcher mismatch) |
| **Overfitting** — More available data = more temptation to overfit | High | Same discipline as NCAA: walk-forward validation, permutation testing, lock weights early |
| **Data pipeline complexity** — More sources, more moving parts | Medium | Build incrementally; validate each component's marginal value before adding |
| **Line movement** — MLB lines move significantly with lineup/pitcher news | Medium | Run model after probable pitchers confirmed; timestamp projections |
| **April small samples** — Season starts with 0 current-year data | Medium | Prior-year Bayesian priors; higher regression early season; widen confidence thresholds |
| **Injury/roster churn** — MLB rosters change daily | Medium | Phase 2 lineup-specific projections; Phase 1 uses team averages (robust to daily changes) |

### 3.7 Success Criteria

**Phase 1 Walk-Forward Validation (must pass before any live deployment):**
- Spread ATS >= 52.0% over 2+ full seasons (~4,860 games)
- Under ATS >= 55.0% at edge threshold >= 1.0 runs
- Spread bias (mean error) within +/-0.3 runs
- Total bias (mean error) within +/-0.3 runs
- STD_DEV_SPREAD stable across seasons (no drift)

**Product Hierarchy (expected, based on NCAA pattern):**
1. **Under picks** — structural edge from Poisson model + re-anchoring
2. **Spread picks** — pitcher mismatch games at moderate edge thresholds
3. **ML disagree** — probability edge on mispriced underdogs
4. **Over picks** — likely display-only (same structural under-bias expected)

---

## Part 4: Open Questions for Director

1. **Timeline priority:** Should we target the 2026 MLB season (starting ~March 27) for data collection and backtesting, or wait for a full offseason build targeting 2027 live deployment?

2. **Data infrastructure:** Do we build a separate MLB pipeline from scratch, or extend the existing Baseball directory with an MLB subfolder sharing common utilities (Poisson engine, calibration, odds fetching)?

3. **Statcast depth:** How deep do we go on pitch-level data in Phase 1? Stuff+ is available but adds pipeline complexity. The conservative path is FIP/xFIP only in Phase 1.

4. **Player-level projections:** Build our own or consume existing projection systems (Steamer, ZiPS, ATC) as inputs? Building our own is a significant project; consuming existing ones is faster but introduces dependency on third-party methodology.

5. **Catcher framing:** Include in Phase 1 or Phase 2? The effect is real (0.1-0.2 R/G) but requires a separate data pipeline for catcher-specific metrics.

6. **Walk-forward standard:** The NCAA model required 2 full seasons of walk-forward validation before wagering recs. Apply the same standard to MLB, or is 1 season sufficient given the larger per-season sample (2,430 games vs ~800)?

7. **Market selection:** Focus on full-game lines only, or also model first-5-innings (F5) lines? F5 lines isolate starting pitcher impact and remove bullpen variance — may be where our pitcher model has the cleanest edge.

8. **Budget:** The Odds API subscription covers MLB. Any budget for premium data sources (e.g., FanGraphs membership for advanced exports, Statcast bulk data access)?

---

*End of proposal. Submitted for director review and critique.*
