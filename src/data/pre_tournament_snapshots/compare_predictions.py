"""
Pre-Tournament Prediction Accuracy Comparison
==============================================
Compares BBMI bracket predictions (made before tournament) against actual results.

WIAA: Pre-tournament snapshot from 2026-03-02 vs completed tournament results
NCAA: Pre-tournament snapshot from 2026-03-15 vs tournament results (in progress)

Usage: python compare_predictions.py
"""
import json, os, sys

sys.stdout.reconfigure(encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, ".."))  # src/data
WIAA_PRE_DIR = os.path.join(SCRIPT_DIR, "wiaa")
NCAA_PRE_DIR = os.path.join(SCRIPT_DIR, "ncaa")
WIAA_CUR_DIR = os.path.normpath(os.path.join(DATA_DIR, "wiaa-seeding"))
NCAA_CUR_FILE = os.path.normpath(os.path.join(DATA_DIR, "seeding", "seeding.json"))


# ── WIAA Analysis ─────────────────────────────────────────────────

# Round mapping: pre-tournament key -> current key
# Pre-tournament didn't have RegionalQuarter, started at RegionalSemis
WIAA_ROUND_MAP = {
    "RegionalSemis":          "RegionalSemis",
    "RegionalChampion":       "RegionalFinals",
    "SectionalSemiFinalist":  "SectionalSemi",
    "SectionalFinalist":      "SectionalFinal",
    "StateQualifier":         "StateQualifier",
    "StateFinalist":          "StateFinalist",
    "StateChampion":          "StateChampion",
}

WIAA_ROUND_DISPLAY = {
    "RegionalSemis":          "Regional Semis",
    "RegionalChampion":       "Regional Finals",
    "SectionalSemiFinalist":  "Sectional Semis",
    "SectionalFinalist":      "Sectional Finals",
    "StateQualifier":         "State Qualifier",
    "StateFinalist":          "State Finalist",
    "StateChampion":          "State Champion",
}

NCAA_ROUNDS = [
    ("RoundOf32Pct",    "Round of 32"),
    ("Sweet16Pct",      "Sweet 16"),
    ("Elite8Pct",       "Elite 8"),
    ("FinalFourPct",    "Final Four"),
    ("ChampionshipPct", "Championship"),
    ("WinTitlePct",     "Champion"),
]


def analyze_wiaa():
    print("=" * 80)
    print("  WIAA TOURNAMENT — PREDICTION vs ACTUAL (Tournament Complete)")
    print("=" * 80)

    all_division_stats = {}

    for div in range(1, 6):
        pre_file = os.path.join(WIAA_PRE_DIR, f"wiaa-d{div}-bracket-20260302.json")
        cur_file = os.path.join(WIAA_CUR_DIR, f"wiaa-d{div}-bracket.json")

        with open(pre_file) as f:
            pre_data = json.load(f)
        with open(cur_file) as f:
            cur_data = json.load(f)

        # Build lookup by team name
        cur_by_team = {t["Team"]: t for t in cur_data}

        print(f"\n{'─' * 80}")
        print(f"  DIVISION {div}")
        print(f"{'─' * 80}")

        round_stats = {}
        upsets = []
        correct_calls = []

        for pre_key, cur_key in WIAA_ROUND_MAP.items():
            display = WIAA_ROUND_DISPLAY[pre_key]
            predicted_yes = 0
            actual_yes = 0
            correct = 0
            total = 0
            calibration_sum_pred = 0.0
            calibration_count_actual = 0

            round_details = []

            for team in pre_data:
                name = team["Team"]
                cur_team = cur_by_team.get(name)
                if not cur_team:
                    continue

                pred_prob = team.get(pre_key, 0)
                actual = cur_team.get(cur_key, 0)
                actual_binary = 1 if actual == 1.0 else 0

                total += 1
                if pred_prob >= 0.5:
                    predicted_yes += 1
                if actual_binary == 1:
                    actual_yes += 1
                    calibration_sum_pred += pred_prob
                    calibration_count_actual += 1

                # Correct if (predicted >= 0.5 and actual) or (predicted < 0.5 and not actual)
                if (pred_prob >= 0.5 and actual_binary == 1) or (pred_prob < 0.5 and actual_binary == 0):
                    correct += 1

                # Track notable predictions
                if actual_binary == 1:
                    round_details.append((name, pred_prob, actual_binary))
                    if pred_prob < 0.25:
                        upsets.append((display, name, pred_prob))
                    elif pred_prob >= 0.6:
                        correct_calls.append((display, name, pred_prob))

            accuracy = correct / total * 100 if total else 0
            avg_pred_for_actual = calibration_sum_pred / calibration_count_actual if calibration_count_actual else 0

            round_stats[display] = {
                "accuracy": accuracy,
                "correct": correct,
                "total": total,
                "predicted_yes": predicted_yes,
                "actual_yes": actual_yes,
                "avg_pred_for_actual": avg_pred_for_actual,
            }

            print(f"\n  {display:20s}  Accuracy: {accuracy:5.1f}%  ({correct}/{total})")
            print(f"    Predicted to advance: {predicted_yes}  |  Actually advanced: {actual_yes}")
            if calibration_count_actual:
                print(f"    Avg predicted prob for teams that advanced: {avg_pred_for_actual:.3f}")

            # Show who actually advanced with their predicted prob
            if round_details and cur_key in ("StateQualifier", "StateFinalist", "StateChampion"):
                round_details.sort(key=lambda x: -x[1])
                for name, prob, _ in round_details:
                    marker = "✓" if prob >= 0.5 else "✗ UPSET"
                    print(f"      {name:30s} predicted: {prob:.1%}  {marker}")

        all_division_stats[f"D{div}"] = round_stats

        if upsets:
            print(f"\n  UPSETS (advanced but predicted < 25%):")
            for rnd, name, prob in upsets:
                print(f"    {rnd}: {name} (predicted {prob:.1%})")

    # Overall WIAA summary
    print(f"\n{'=' * 80}")
    print(f"  WIAA OVERALL SUMMARY")
    print(f"{'=' * 80}")
    for display in WIAA_ROUND_DISPLAY.values():
        total_correct = sum(d.get(display, {}).get("correct", 0) for d in all_division_stats.values())
        total_total = sum(d.get(display, {}).get("total", 0) for d in all_division_stats.values())
        if total_total:
            print(f"  {display:20s}  {total_correct}/{total_total}  ({total_correct/total_total*100:.1f}%)")


def analyze_ncaa():
    print(f"\n\n{'=' * 80}")
    print(f"  NCAA TOURNAMENT — PREDICTION vs ACTUAL (In Progress)")
    print(f"{'=' * 80}")

    pre_file = os.path.join(NCAA_PRE_DIR, "seeding-20260315.json")
    with open(pre_file) as f:
        pre_data = json.load(f)

    with open(NCAA_CUR_FILE) as f:
        cur_data = json.load(f)

    cur_by_team = {t["Team"]: t for t in cur_data}

    for round_key, display in NCAA_ROUNDS:
        predicted_yes = 0
        actual_yes = 0
        actual_no = 0
        correct = 0
        total_decided = 0
        still_alive = 0
        calibration_sum = 0.0
        calibration_actual = 0

        details = []

        for team in pre_data:
            name = team["Team"]
            cur_team = cur_by_team.get(name)
            if not cur_team:
                continue

            pred_prob = float(team.get(round_key, 0))
            actual_val = cur_team.get(round_key, 0)
            if isinstance(actual_val, str):
                actual_val = float(actual_val)

            if actual_val == 1.0:
                actual_yes += 1
                actual_binary = 1
            elif actual_val == 0.0:
                # Check if they were eliminated or just haven't played yet
                # If a prior round is 0, they were eliminated before this round
                prior_eliminated = False
                for prior_key, _ in NCAA_ROUNDS:
                    if prior_key == round_key:
                        break
                    prior_val = cur_team.get(prior_key, 0)
                    if isinstance(prior_val, str):
                        prior_val = float(prior_val)
                    if prior_val == 0.0:
                        prior_eliminated = True
                        break

                if prior_eliminated:
                    actual_binary = 0
                    actual_no += 1
                else:
                    # Check if current round has any 1.0s (round has started)
                    # If no teams have 1.0 for this round, it hasn't been played
                    any_decided = any(
                        (cur_by_team.get(t["Team"], {}).get(round_key, 0) == 1.0 or
                         (isinstance(cur_by_team.get(t["Team"], {}).get(round_key, 0), str) and
                          float(cur_by_team.get(t["Team"], {}).get(round_key, 0)) == 1.0))
                        for t in pre_data if cur_by_team.get(t["Team"])
                    )
                    if any_decided:
                        # Round has started, this team lost
                        actual_binary = 0
                        actual_no += 1
                    else:
                        # Round not yet played
                        still_alive += 1
                        continue
            else:
                # Fractional value = updated prediction, not a result
                still_alive += 1
                continue

            total_decided += 1
            if pred_prob >= 0.5:
                predicted_yes += 1

            if (pred_prob >= 0.5 and actual_binary == 1) or (pred_prob < 0.5 and actual_binary == 0):
                correct += 1

            if actual_binary == 1:
                calibration_sum += pred_prob
                calibration_actual += 1
                details.append((name, team.get("CurrentSeed", "?"), pred_prob, "✓ ADVANCED"))
            elif pred_prob >= 0.5:
                details.append((name, team.get("CurrentSeed", "?"), pred_prob, "✗ ELIMINATED"))

        if total_decided == 0:
            print(f"\n  {display:20s}  Not yet played")
            continue

        accuracy = correct / total_decided * 100
        avg_pred = calibration_sum / calibration_actual if calibration_actual else 0

        print(f"\n  {display:20s}  Accuracy: {accuracy:5.1f}%  ({correct}/{total_decided})")
        print(f"    Advanced: {actual_yes}  |  Eliminated: {actual_no}  |  Still TBD: {still_alive}")
        if calibration_actual:
            print(f"    Avg predicted prob for teams that advanced: {avg_pred:.3f}")

        # Show notable results
        details.sort(key=lambda x: -x[2])
        if display in ("Sweet 16", "Elite 8", "Final Four", "Championship", "Champion"):
            print(f"    {'Team':30s} {'Seed':>4s}  {'Predicted':>9s}  Result")
            for name, seed, prob, result in details:
                print(f"    {name:30s} {str(seed):>4s}  {prob:8.1%}   {result}")

    # Brier score for calibration
    print(f"\n{'─' * 80}")
    print(f"  CALIBRATION CHECK (Brier Score — lower is better)")
    print(f"{'─' * 80}")
    for round_key, display in NCAA_ROUNDS:
        brier_sum = 0
        n = 0
        for team in pre_data:
            name = team["Team"]
            cur_team = cur_by_team.get(name)
            if not cur_team:
                continue
            pred = float(team.get(round_key, 0))
            actual_val = cur_team.get(round_key, 0)
            if isinstance(actual_val, str):
                actual_val = float(actual_val)
            if actual_val in (0.0, 1.0):
                brier_sum += (pred - actual_val) ** 2
                n += 1
        if n:
            brier = brier_sum / n
            print(f"  {display:20s}  Brier: {brier:.4f}  (n={n})")


def main():
    analyze_wiaa()
    analyze_ncaa()
    print(f"\n{'=' * 80}")
    print(f"  Generated: compare pre-tournament predictions vs actual results")
    print(f"  WIAA snapshot: 2026-03-02 (night before tournament)")
    print(f"  NCAA snapshot: 2026-03-15 (day before tournament)")
    print(f"{'=' * 80}")


if __name__ == "__main__":
    main()
