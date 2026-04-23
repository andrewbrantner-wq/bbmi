"""
Moneyline Diagnostics — All Sports
=====================================
Calibration check + edge analysis where ML odds available.

USAGE:
  cd c:/Users/andre/dev/my-app
  python -X utf8 -u src/scripts/ml_diagnostics_all_sports.py
"""
import json, numpy as np, os

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(BASE, "src", "data", "betting-lines")


def calibration_check(games, prob_field, label):
    """Check win probability calibration: model prob vs actual win rate."""
    valid = []
    for g in games:
        prob = g.get(prob_field)
        hs = g.get("actualHomeScore")
        as_ = g.get("actualAwayScore")
        if prob is None or hs is None or as_ is None:
            continue
        if hs == as_:
            continue
        # Normalize prob to 0-1 range
        p = float(prob)
        if p > 1:
            p = p / 100  # convert percentage to decimal
        home_won = hs > as_
        # Use the picked side (whichever > 50%)
        if p >= 0.5:
            pick_prob = p
            pick_won = home_won
        else:
            pick_prob = 1 - p
            pick_won = not home_won
        valid.append({"prob": pick_prob, "won": pick_won, "home_won": home_won, "raw_prob": p})

    print(f"\n  {label}: {len(valid)} games with win prob + results")

    if len(valid) < 50:
        print("  Insufficient data")
        return valid

    # Calibration by bucket
    print(f"  {'Bucket':>10s} {'N':>5s} {'Model':>7s} {'Actual':>8s} {'Gap':>7s}")
    print(f"  {'-'*40}")
    for lo in range(50, 95, 5):
        hi = lo + 5
        bucket = [v for v in valid if lo <= v["prob"] * 100 < hi]
        if len(bucket) < 10:
            continue
        model_avg = np.mean([v["prob"] for v in bucket]) * 100
        actual = sum(1 for v in bucket if v["won"]) / len(bucket) * 100
        gap = actual - model_avg
        print(f"  {lo}-{hi}%  {len(bucket):>5d} {model_avg:>6.1f}% {actual:>7.1f}% {gap:>+6.1f}")

    # Overall
    total_w = sum(1 for v in valid if v["won"])
    print(f"\n  Overall pick rate: {total_w}/{len(valid)} = {total_w/len(valid)*100:.1f}%")

    return valid


def ml_edge_sweep(games, prob_field, ml_home_field, ml_away_field, label):
    """Full ML edge sweep with actual odds (only for sports with ML data)."""
    valid = []
    for g in games:
        prob = g.get(prob_field)
        hs = g.get("actualHomeScore")
        as_ = g.get("actualAwayScore")
        ml_h = g.get(ml_home_field)
        ml_a = g.get(ml_away_field)
        if any(v is None for v in [prob, hs, as_, ml_h, ml_a]):
            continue
        if hs == as_:
            continue

        p = float(prob)
        if p > 1:
            p = p / 100

        # Convert American ML to implied prob
        def ml_to_prob(ml):
            ml = float(ml)
            if ml > 0:
                return 100 / (ml + 100)
            elif ml < 0:
                return abs(ml) / (abs(ml) + 100)
            return 0.5

        def ml_to_decimal(ml):
            ml = float(ml)
            if ml > 0:
                return (ml / 100) + 1
            elif ml < 0:
                return (100 / abs(ml)) + 1
            return 2.0

        v_hp = ml_to_prob(ml_h)
        v_ap = ml_to_prob(ml_a)
        vig = v_hp + v_ap
        v_hf = v_hp / vig
        v_af = v_ap / vig

        home_edge = p - v_hf
        away_edge = (1 - p) - v_af
        home_won = hs > as_

        if home_edge > away_edge:
            pick = "HOME"
            edge = home_edge
            pick_won = home_won
            pick_odds_dec = ml_to_decimal(ml_h)
            pick_odds_am = ml_h
        else:
            pick = "AWAY"
            edge = away_edge
            pick_won = not home_won
            pick_odds_dec = ml_to_decimal(ml_a)
            pick_odds_am = ml_a

        valid.append({
            "edge": edge, "won": pick_won,
            "odds_dec": pick_odds_dec, "odds_am": pick_odds_am,
            "prob": p if pick == "HOME" else 1 - p,
        })

    print(f"\n  {label} — ML Edge Sweep: {len(valid)} games")

    if len(valid) < 50:
        print("  Insufficient ML data")
        return

    print(f"  {'Edge':>6s} {'N':>5s} {'Win%':>7s} {'ROI':>7s}")
    print(f"  {'-'*28}")

    for pct in [1, 2, 3, 5, 7, 10, 15, 20]:
        thresh = pct / 100
        picks = [v for v in valid if v["edge"] >= thresh]
        if len(picks) < 10:
            continue
        w = sum(1 for v in picks if v["won"])
        n = len(picks)
        profit = sum((v["odds_dec"] - 1) if v["won"] else -1 for v in picks)
        print(f"  {pct:>5d}% {n:>5d} {w/n*100:>6.1f}% {profit/n*100:>+6.1f}%")


def main():
    sep = "=" * 60

    # ── NCAA BASKETBALL ──
    print(f"\n{sep}")
    print("  NCAA BASKETBALL")
    print(sep)

    with open(os.path.join(DATA, "games.json")) as f:
        bball = json.load(f)
    completed = [g for g in bball if g.get("actualHomeScore") is not None]
    print(f"  Total completed: {len(completed)}")
    calibration_check(completed, "bbmiWinProb", "Basketball (bbmiWinProb)")

    # Check for ML odds
    has_ml = sum(1 for g in completed if g.get("homeML") or g.get("moneylineHome"))
    print(f"  Games with ML odds: {has_ml}")
    if has_ml > 50:
        ml_edge_sweep(completed, "bbmiWinProb", "homeML", "awayML", "Basketball ML")

    # ── NCAA FOOTBALL ──
    print(f"\n{sep}")
    print("  NCAA FOOTBALL")
    print(sep)

    with open(os.path.join(DATA, "football-games.json")) as f:
        football = json.load(f)
    completed_fb = [g for g in football if g.get("actualHomeScore") is not None]
    print(f"  Total completed: {len(completed_fb)}")
    calibration_check(completed_fb, "homeWinPct", "Football (homeWinPct)")

    has_ml_fb = sum(1 for g in completed_fb if g.get("homeML") or g.get("moneylineHome"))
    print(f"  Games with ML odds: {has_ml_fb}")

    # ── MLB ──
    print(f"\n{sep}")
    print("  MLB")
    print(sep)

    with open(os.path.join(DATA, "mlb-games.json")) as f:
        mlb = json.load(f)
    completed_mlb = [g for g in mlb if g.get("actualHomeScore") is not None]
    print(f"  Total completed: {len(completed_mlb)}")
    calibration_check(completed_mlb, "homeWinPct", "MLB (homeWinPct)")

    # MLB has actual ML odds
    has_ml_mlb = sum(1 for g in completed_mlb if g.get("homeML"))
    print(f"  Games with ML odds: {has_ml_mlb}")
    if has_ml_mlb > 50:
        ml_edge_sweep(completed_mlb, "homeWinPct", "homeML", "awayML", "MLB ML")

    # ── SUMMARY ──
    print(f"\n{sep}")
    print("  SUMMARY: ML ODDS AVAILABILITY")
    print(sep)
    print(f"  NCAA Basketball: {'NO ML odds' if has_ml == 0 else f'{has_ml} games'} — need to pull from odds API")
    print(f"  NCAA Football:   {'NO ML odds' if has_ml_fb == 0 else f'{has_ml_fb} games'} — need to pull from odds API")
    print(f"  MLB:             {has_ml_mlb} games with ML odds")
    print(f"  NCAA Baseball:   Already done (Platt scaling validated)")
    print(sep)


if __name__ == "__main__":
    main()
