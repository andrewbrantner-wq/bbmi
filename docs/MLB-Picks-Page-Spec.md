# MLB Today's Game Lines — Page Specification

**Target:** `src/app/baseball/picks/page.tsx` (or new `src/app/mlb/picks/page.tsx`)
**Template:** NCAA Basketball Today's Picks (`src/app/ncaa-todays-picks/page.tsx`)
**Status:** Build hidden — do NOT connect to navbar or homepage until authorized
**Data Source:** `src/data/betting-lines/mlb-games.json` (new file, produced by MLB pipeline)

---

## Global Changes from NCAA Basketball Template

| Element | NCAA Basketball | MLB |
|---------|----------------|-----|
| Logo | NCAA logo | MLB logo |
| Title | Today's Game Lines | Today's Game Lines |
| Toggle buttons | "Against the Spread" / "Over/Under" | **"Run Line"** / **"Over/Under"** |
| Edge units | Points (pts) | **Runs** (for O/U) / **Margin** (for RL) |
| Break-even reference | 50% (spreads), 52.4% (totals) | **64.0%** (RL away +1.5 base rate), **52.4%** (totals) |
| Nav tabs | Today's Picks, Rankings, Model Accuracy, BBMI vs Vegas, Bracket Pulse, Bracket Challenge, WIAA | Today's Picks, Rankings, Model Accuracy, BBMI vs Vegas |

---

## Top Performance Cards (Three Cards)

### Run Line Tab

| Position | Label | Value | Subtext |
|----------|-------|-------|---------|
| Left | FREE PICKS | 69.4% | Away +1.5 all picks |
| Center (highlighted) | PREMIUM PICKS | 72.3% | margin >= 0.25 |
| Right | OVERALL RL | 69.4% | 1,897 games |

**Disclaimer below cards:**

> Record includes only games where the model projects the away team to win. The away team covers +1.5 whenever the home team wins by 0-1 runs or the away team wins outright. MLB base rate for away +1.5 is 64.0% — BBMI's validated edge is +5.4 pp above base rate on 1,897 games (2024-2025 walk-forward). Edge is captured at opening lines. A margin smaller than 0.15 is within normal model variance and does not represent a meaningful BBMI advantage. [Show full public record...]

### Over/Under Tab

| Position | Label | Value | Subtext |
|----------|-------|-------|---------|
| Left | FREE PICKS | 54.6% | edge >= 0.50 |
| Center (highlighted) | PREMIUM PICKS | 56.7% | edge >= 0.83 |
| Right | OVERALL O/U | 56.7% | 630 games |

**Disclaimer below cards:**

> Record includes only games where BBMI projected total differs by 0.83+ runs from the posted total — captured at opening lines 7+ hours before first pitch. A difference smaller than 0.83 runs is within normal market variance and does not represent a meaningful BBMI disagreement with Vegas. Evening games with traditional starting pitchers only. [Show full public record...]

---

## Win Rate by Edge Size Chart

### Run Line Tab

- **Title:** "Cover Rate by Projected Margin — by Bi-Week"
- **Subtitle:** "Larger projected away advantages produce stronger away +1.5 cover rates"
- **Y-axis:** 50% to 85%
- **Lines:**
  - Blue: margin 0.00–0.10
  - Green: margin 0.10–0.20
  - Orange: margin 0.20–0.30
  - Red: margin > 0.30
  - **Dashed reference line at 64.0%** labeled "64% base-rate" *(replaces 50% break-even from basketball)*

### Over/Under Tab

- **Title:** "Win Rate by Edge Size — by Bi-Week"
- **Subtitle:** "Higher edge disagreements with Vegas produce stronger outcomes"
- **Y-axis:** 40% to 80%
- **Lines:**
  - Blue: edge 0.83–1.25
  - Green: edge 1.25–1.50
  - Orange: edge 1.50–2.00
  - Red: edge > 2.00
  - Dashed reference line at 52.4% labeled "52.4% break-even"

---

## Historical Performance by Edge Size Table

### Run Line Tab

| PROJECTED MARGIN | GAMES | COVER % | 95% CI | ROI vs BASE |
|-----------------|-------|---------|--------|-------------|
| 0.00–0.10 | populate | populate | populate | populate |
| 0.10–0.20 | populate | populate | populate | populate |
| 0.20–0.30 | populate | populate | populate | populate |
| > 0.30 | populate | populate | populate | populate |

**Footnote:**

> Includes only games where model projects away team win. Cover rate measures away +1.5 result (home wins by 0-1 or away team wins). Base rate for comparison: 64.0%. ROI calculated at median -156 away +1.5 juice (typical range: -130 to -180). Walk-forward validation on 2024-2025 seasons. 95% CI uses Wilson score method.

### Over/Under Tab

| EDGE SIZE | GAMES | WIN % | 95% CI | ROI |
|-----------|-------|-------|--------|-----|
| 0.83–1.25 runs | populate | populate | populate | populate |
| 1.25–1.50 runs | populate | populate | populate | populate |
| 1.50–2.00 runs | populate | populate | populate | populate |
| > 2.00 runs | populate | populate | populate | populate |

**Footnote:**

> Includes only games where BBMI and Vegas totals differ by 0.83+ runs. Edge captured at opening lines 7+ hours before first pitch. Evening games with traditional starting pitchers only. 95% CI uses Wilson score method.

---

## Filter Buttons

### Run Line Tab

| Button | Label |
|--------|-------|
| Default (highlighted) | All Games |
| | 0.10+ margin |
| | 0.15+ margin |
| | 0.20+ margin |
| | 0.25+ margin |

### Over/Under Tab

| Button | Label |
|--------|-------|
| Default (highlighted) | All Games |
| | 0.83+ runs |
| | 1.25+ runs |
| | 1.50+ runs |
| | 2.00+ runs |

---

## Data Source Line

Replace "Scores via ESPN" with:

> Scores via MLB API — Updated [timestamp] | Lines via The Odds API — Opening lines captured [timestamp]

---

## Legend Section

**Team record:** Below team name, show BBMI Win% when picking that team (same as basketball).

**Flags:**

> 🔵 **Opener game** — model uses bullpen projection | 🌤 **Weather adjustment applied** | ⚾ **Probable pitcher confirmed**

---

## Game Table Columns

### Run Line Tab

| # | Column | Width | Description |
|---|--------|-------|-------------|
| 1 | SCORE | narrow | Live/final score with color |
| 2 | AWAY | medium | Away team name + W-L record |
| 3 | HOME | medium | Home team name + W-L record |
| 4 | PITCHERS | medium | Two-line cell (see below) |
| 5 | RUN LINE | narrow | Posted -1.5 juice for both sides |
| 6 | BBMI MARGIN | narrow | Model's projected run margin |
| 7 | EDGE | narrow | Away margin threshold (e.g., +0.24) |
| 8 | BBMI PICK | narrow | Away team name if model picks away; **blank/dash if home projected** |
| 9 | BBMI WIN% | narrow | Model's win probability for projected side |
| 10 | VEGAS WIN% | narrow | Market-implied win probability from ML |

**IMPORTANT:** BBMI PICK column only populates when model projects away win. Home -1.5 is NOT a validated product — do not display home picks.

### Over/Under Tab

| # | Column | Width | Description |
|---|--------|-------|-------------|
| 1 | SCORE | narrow | Live/final score with color |
| 2 | AWAY | medium | Away team name + W-L record |
| 3 | HOME | medium | Home team name + W-L record |
| 4 | PITCHERS | medium | Two-line cell (see below) |
| 5 | VEGAS O/U | narrow | Posted total |
| 6 | BBMI TOTAL | narrow | Model's projected total |
| 7 | EDGE | narrow | Difference (negative = under edge) |
| 8 | PICK | narrow | "UNDER" if edge >= 0.83, blank otherwise |
| 9 | ACTUAL | narrow | Final total after game completes |
| 10 | RESULT | narrow | W/L on the under pick |

---

## Pitcher Display (PITCHERS Column)

Two-line cell format:

```
G. Cole     3.21  2.98    ← Away pitcher: Name  ERA  FIP
L. Webb     2.85  3.12    ← Home pitcher: Name  ERA  FIP
```

### Pitcher Status Indicators

| Status | Display | Visual |
|--------|---------|--------|
| **Confirmed** | Pitcher name, full brightness | Small ✓ icon |
| **Projected** | Pitcher name, slightly dimmed | Small ⏳ icon. Tooltip: "Probable pitcher — not yet officially confirmed. Model projection may change if starter changes." |
| **Opener** | "Opener/Bullpen" text, dimmed | 🔵 flag. Tooltip: "Opener strategy detected — model uses team bullpen average instead of individual starter projection. Confidence reduced." |

### Mobile Behavior

On mobile, collapse PITCHERS into the row expansion (same pattern as injury flag in basketball). Tap game row to see pitcher details including ERA and FIP.

### Data Fields

Pitcher data comes from: `home_starter`, `away_starter`, `home_starter_fip`, `away_starter_fip`, `home_starter_era`, `away_starter_era`, `pitcher_confirmed`, `is_opener_game`

---

## Live Scoring Color Logic

### Over/Under Tab (Under Pick Active)

| State | Condition | Color |
|-------|-----------|-------|
| **Green** | In progress: `current_total < (posted_total - 1.0)` | Green background at low opacity |
| **Green** | Final: `actual_total < posted_total` | Green |
| **Yellow** | In progress: `current_total` within 1.0 run of `posted_total` | Yellow |
| **Red** | In progress: `current_total >= posted_total` | Red |
| **Red** | Final: `actual_total >= posted_total` | Red |
| **None** | Game not started OR no BBMI pick (edge < 0.83) | Default/neutral |

### Run Line Tab (Away +1.5 Pick Active)

| State | Condition | Color |
|-------|-----------|-------|
| **Green** | In progress: away winning OR home leads by exactly 1 | Green |
| **Green** | Final: `actual_margin <= 1` (away covered +1.5) | Green |
| **Green** | Extra innings reached with game tied or away leading | Green (certainty — home cannot win by 2+) |
| **Yellow** | In progress: home leads by exactly 2 | Yellow |
| **Red** | In progress: home leads by 3+ | Red |
| **Red** | Final: `actual_margin >= 2` (home won by 2+) | Red |
| **None** | Game not started OR no BBMI pick (model projected home) | Default/neutral |

### Score Display Format

```
During game:
  NYY  4          ← away score
  BOS  2   [7th]  ← home score + inning

Final:
  NYY  4   FINAL
  BOS  2

Extra innings final:
  NYY  4   F/10
  BOS  3
```

### Inning Display

Show "1st" through "9th" for regulation, "10th", "11th" for extras, "F/10" for completed extra-inning games.

### Live Data Source

- MLB Stats API gameday feed, polled every 2-3 minutes during active games
- Push updates to Firestore (same pattern as NCAA basketball live scoring)
- Color logic runs entirely on frontend from `current_total`, `posted_total`, `proj_margin`, `game_status` fields

---

## MLB-Specific Additional Elements

### 1. Summer Performance Note (Seasonal Banner)

**Display condition:** June 15 through September 30 only. Show above game table.

> ⚠️ **Summer Validation Period** — The under model's July-September performance is actively monitored in the 2026 live season. Walk-forward validation showed strong results across all seasonal segments. [View live performance →]

### 2. Early Season Sample Caveat

**Display condition:** Automatically when live sample < 100 recommendations for either product.

> **Early season** — sample too small for statistical inference. Walk-forward validation (2024-2025) remains the primary performance reference.

**Remove automatically** once 100+ recommendations logged for each product.

### 3. Confidence Tier Indicators

Both products display 1-3 strength indicators next to the BBMI PICK / PICK cell.

**Under Product:**
- One indicator: edge >= 0.83
- Two indicators: edge >= 1.25
- Three indicators: edge >= 1.50

**Away +1.5 Product:**
- One indicator: margin >= 0.00 (all away picks)
- Two indicators: margin >= 0.15
- Three indicators: margin >= 0.25

---

## Data Schema (`mlb-games.json`)

The MLB pipeline outputs a JSON array. Each game object contains:

```json
{
  "gameId": "string",
  "date": "YYYY-MM-DD",
  "gameTimeUTC": "ISO timestamp",
  "homeTeam": "string",
  "awayTeam": "string",
  "homeRecord": "W-L",
  "awayRecord": "W-L",
  "homePitcher": "string",
  "awayPitcher": "string",
  "homePitcherERA": 3.21,
  "awayPitcherERA": 2.85,
  "homePitcherFIP": 3.12,
  "awayPitcherFIP": 2.98,
  "pitcherConfirmed": true,
  "isOpenerGame": false,
  "bbmiHomeProj": 4.21,
  "bbmiAwayProj": 3.85,
  "bbmiTotal": 8.1,
  "projMargin": -0.36,
  "homeWinPct": 0.492,
  "vegasTotal": 8.5,
  "vegasRunLineHome": -1.5,
  "homeRLJuice": -130,
  "awayRLJuice": 110,
  "edge": -0.4,
  "bbmiPick": "UNDER",
  "bbmiRLPick": "NYY +1.5",
  "rlMarginEdge": 0.36,
  "underConfidenceTier": 1,
  "rlConfidenceTier": 2,
  "actualHomeScore": null,
  "actualAwayScore": null,
  "actualTotal": null,
  "actualMargin": null,
  "currentInning": null,
  "gameStatus": "preview",
  "parkFactor": 1.03,
  "weatherFactor": 1.0,
  "reanchorFactor": 1.02
}
```

---

## What Does NOT Change from Basketball Template

- Overall page layout and dark theme
- Navigation bar structure and styling
- Card component styling (change numbers and labels only)
- Chart component (change axis labels, line colors, reference line value)
- Table component styling
- Filter button component styling
- Loading states and empty states
- Mobile responsive behavior
- Firestore real-time subscription pattern for live scores

---

*Spec complete. Build as hidden pages — do not connect to navbar or homepage until authorized.*
