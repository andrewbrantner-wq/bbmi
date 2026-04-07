# BBMI Baseball Model (V2) -- Internal Technical Summary

## Overview

The BBMI Baseball model is a NCAA Division I baseball predictive system that generates spread predictions, over/under totals, moneylines, and win probabilities for every D1 game. It uses a Poisson-based run scoring model with pitcher-specific adjustment layers, powered by real NCAA API statistics.

---

## Data Sources

| Source | Data | Auth | Refresh |
|--------|------|------|---------|
| **NCAA API (henrygd)** | Team batting/pitching stats: OBP, SLG, WHIP, K/9, ERA, FIP components, HR allowed, fielding | Free (5 req/sec) | Daily (24hr cache) |
| **Warren Nolan** | RPI rankings, SOS, runs/game, runs allowed, margins | Free (scraping) | Daily (24hr cache) |
| **ESPN API** | Schedule, live scores, box scores, team metadata | Free | Each pipeline run |
| **CBI (collegebaseballinsiders.com)** | Probable starters (ERA, SIERA, K%, BB%, IP, hand), weather (temp, wind, humidity), stadium (RPG, HFA) | Free (scraping) | Daily (pre-pipeline) |
| **The Odds API** | Vegas spreads, moneylines, totals (DraftKings/FanDuel priority) | Paid | Each run + morning capture |

---

## Rating System

### Offensive Rating Weights (expected runs/game)

| Input | Weight | Source | Scaling |
|-------|--------|--------|---------|
| Adj Runs/Game | 25% | Warren Nolan | Direct |
| wOBA | 25% | NCAA API (real components) | x15.0 to runs |
| OBP | 20% | NCAA API (code 589) | x12.0 to runs |
| Stolen Base Rate | 10% | NCAA API (code 326) | x2.0 |
| SOS Adjustment | 10% | Warren Nolan SOS rank | (150-rank)/300 |
| Slugging | 10% | NCAA API (code 327) | x10.0 to runs |

### Defensive Rating Weights (expected runs allowed/game)

| Input | Weight | Source |
|-------|--------|--------|
| Starter FIP | 35% | NCAA API (calculated: 13xHR + 3x(BB+HBP) - 2xK / IP + 3.2) |
| Bullpen ERA | 25% | CBI-derived (team ERA - starter contribution) |
| WHIP | 20% | NCAA API (code 597) |
| K/9 | 15% | NCAA API (code 425) |
| Fielding % | 5% | NCAA API (code 212) |

Both ratings regressed 25% toward league mean (5.5 R/G).

### BBMI Composite Score
```
bbmi_score = (offensive_rating - defensive_rating) + sos_bonus
sos_bonus = (150 - sos_rank) / 150.0   # range: -1.0 to +1.0
```

---

## Game Projection (11-Step Process)

1. **Team ratings** -- calculate offensive and defensive ratings
2. **Base projection** -- home_runs = (home_off + away_def) / 2.0
3. **Home/away splits** -- multiply by team-specific home/away offensive multiplier (data-driven, cap +/-20%)
4. **Series position** -- Friday ace (x0.95), Saturday #2 (x1.00), Sunday #3 (x1.08)
5. **Pitcher adjustment** -- Bayesian-shrunk PQS vs team average (cap +/-2.0 runs)
6. **Home field advantage** -- 0.3 runs fallback only when splits unavailable for both teams
7. **Park factor** -- multiplicative (CBI RPG > cached venue > static dict > 1.0)
8. **Temperature** -- +/-0.5 runs per 10F above/below 72F baseline (outdoor only)
9. **Wind direction** -- Out: +0.5%/mph over 10; In: -0.7%/mph over 10 (outdoor only)
10. **Conference tier offset** -- P5 vs low-major: +0.6 runs split equally
11. **Floor at 1.0 runs** per team

---

## Win Probability (Poisson)

```
P(home wins) = sum over all (h, a) combinations where h > a
             = sum[h=0..25] sum[a=0..h-1] (e^(-lam_h) * lam_h^h / h!) * (e^(-lam_a) * lam_a^a / a!)
Ties split 50/50 (extra innings approximation)
```

Where lam_h = home projected runs, lam_a = away projected runs.

---

## Spread & Moneyline

- **Spread**: projected margin rounded to nearest 0.5, sign flipped (negative = home favored)
- **Moneyline**: derived directly from Poisson win probability
  - Favorite: ML = -(p / (1-p)) x 100
  - Underdog: ML = ((1-p) / p) x 100

---

## Key Constants

| Parameter | Value | Notes |
|-----------|-------|-------|
| STD_DEV_SPREAD | 6.2 | Calibrated from 710 games |
| HCA_RUNS | 0.3 | Fallback only (splits preferred) |
| BASEBALL_TEAM_REGRESSION | 0.25 | 25% to league mean |
| MODEL_VERSION | 2 | Real NCAA API stats |
| Pitcher adjustment cap | +/-2.0 runs | Prevents overcorrection |
| Park factor range | 0.80 - 1.25 | Multiplicative |
| Temperature factor | 0.012 per 10F | ~0.5 runs/game |

---

## Pitcher Quality Score (Bayesian Shrinkage)

| Starts | Individual Weight | Team Weight |
|--------|------------------|-------------|
| 0-2 | 0% | 100% |
| 3-4 | 30% | 70% |
| 5-7 | 55% | 45% |
| 8-12 | 75% | 25% |
| 13+ | 90% | 10% |

PQS component weights: FIP 35%, K/9 25%, WHIP 25%, ERA 15%

---

## Infrastructure

- **Opening line capture**: 8:00 AM CT morning run caches opening odds
- **Main pipeline**: 10:45 AM CT runs scrapers + pipeline + auto-deploy
- **Line movement**: closing - opening tracked per game
- **Model maturity**: tracks completed v2 games (<100=early, 100-300=calibrating, 300-500=calibrated, 500+=mature)
- **STD_DEV recalibration**: runs automatically, only measures v2 games
- **Stadium RPG cache**: 205 venues, updates from completed game results
- **Home/away splits**: 146 teams, min 5 games each side
- **Daily JSON backup**: 3-day retention with auto-cleanup
- **Auto-deploy**: git commit + push to Vercel after each pipeline run
