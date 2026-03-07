"""
compute_rmse.py

Computes the RMSE of the BBMI line vs actual game margin.
This gives the model's margin of error, which we use to define
a statistically defensible equivalence threshold between BBMI and Vegas lines.

Usage:
    python compute_rmse.py
    python compute_rmse.py --games path/to/games.json
"""

import json
import math
import argparse
from pathlib import Path

def load_games(path: str) -> list[dict]:
    with open(path, "r") as f:
        return json.load(f)

def compute_rmse(games: list[dict]) -> dict:
    # Only use completed games with valid scores and a BBMI line
    completed = [
        g for g in games
        if g.get("actualHomeScore") is not None
        and g.get("actualAwayScore") is not None
        and g.get("actualHomeScore") != 0
        and g.get("bbmiHomeLine") is not None
    ]

    if not completed:
        raise ValueError("No completed games with BBMI lines found.")

    errors = []
    for g in completed:
        actual_margin = g["actualHomeScore"] - g["actualAwayScore"]
        bbmi_line = g["bbmiHomeLine"]
        # BBMI line is from home team perspective (negative = home favored)
        # Predicted margin = -bbmiHomeLine (e.g. line of -5 means home favored by 5)
        predicted_margin = -bbmi_line
        errors.append(predicted_margin - actual_margin)

    n = len(errors)
    mse = sum(e ** 2 for e in errors) / n
    rmse = math.sqrt(mse)
    mae = sum(abs(e) for e in errors) / n
    bias = sum(errors) / n  # positive = BBMI systematically overestimates home

    # Equivalence thresholds
    # Games where |bbmiLine - vegasLine| < threshold are "statistically equivalent"
    threshold_half = round(rmse * 0.5, 1)   # conservative: half RMSE
    threshold_third = round(rmse * 0.33, 1) # tighter: one-third RMSE

    # Also compute win rate at various edge thresholds for context
    all_bets = [g for g in completed if g.get("fakeBet", 0) and float(g.get("fakeBet", 0)) > 0]
    
    results = {}
    thresholds = [0, 1, 2, 3, 4, 5, 6]
    for t in thresholds:
        bucket = [
            g for g in all_bets
            if abs((g.get("bbmiHomeLine") or 0) - (g.get("vegasHomeLine") or 0)) >= t
        ]
        wins = [g for g in bucket if float(g.get("fakeWin", 0)) > 0]
        win_pct = (len(wins) / len(bucket) * 100) if bucket else 0
        results[t] = {"games": len(bucket), "win_pct": round(win_pct, 1)}

    return {
        "n": n,
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "bias": round(bias, 2),
        "equivalence_threshold_half_rmse": threshold_half,
        "equivalence_threshold_third_rmse": threshold_third,
        "win_rate_by_min_edge": results,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--games", default="games.json", help="Path to games.json")
    args = parser.parse_args()

    path = Path(args.games)
    if not path.exists():
        # Try common locations
        for candidate in [
            "src/data/betting-lines/games.json",
            "data/betting-lines/games.json",
            "public/data/games.json",
        ]:
            if Path(candidate).exists():
                path = Path(candidate)
                break
        else:
            print(f"Could not find games.json. Pass the path explicitly: python compute_rmse.py --games path/to/games.json")
            return

    print(f"Loading games from: {path}")
    games = load_games(str(path))
    stats = compute_rmse(games)

    print("\n========== BBMI MODEL ACCURACY ==========")
    print(f"  Completed games analyzed : {stats['n']}")
    print(f"  RMSE (vs actual margin)  : {stats['rmse']} pts")
    print(f"  MAE  (vs actual margin)  : {stats['mae']} pts")
    print(f"  Bias (+ = favors home)   : {stats['bias']} pts")
    print()
    print("========== EQUIVALENCE THRESHOLDS ==========")
    print(f"  Half RMSE  ({stats['rmse']} × 0.50) = {stats['equivalence_threshold_half_rmse']} pts")
    print(f"  Third RMSE ({stats['rmse']} × 0.33) = {stats['equivalence_threshold_third_rmse']} pts")
    print()
    print("  Games where |BBMI - Vegas| < threshold are statistically")
    print("  indistinguishable from Vegas and should be excluded from")
    print("  your 'beat Vegas' performance record.")
    print()
    print("========== WIN RATE BY MINIMUM EDGE ==========")
    print(f"  {'Min Edge':>10}  {'Games':>7}  {'Win %':>7}")
    print(f"  {'-'*30}")
    for t, v in stats["win_rate_by_min_edge"].items():
        marker = "  ← recommended cutoff" if t == stats["equivalence_threshold_half_rmse"] else ""
        print(f"  {f'>= {t}':>10}  {v['games']:>7}  {v['win_pct']:>6}%{marker}")

    print()
    print("========== SUGGESTED DISCLOSURE ==========")
    print(f'  "Games where BBMI and Vegas lines differ by less than')
    print(f'  {stats["equivalence_threshold_half_rmse"]} points fall within the model\'s margin of error')
    print(f'  (RMSE = {stats["rmse"]} pts) and are excluded from the performance record."')

if __name__ == "__main__":
    main()
