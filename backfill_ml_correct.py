"""
Correct ML backfill using point-in-time git snapshots.
For each day, extracts baseball-games.json from that day's FIRST commit,
applies Platt scaling to the homeWinPct and odds from that snapshot,
computes ML picks, and matches to actual final scores.
"""
import subprocess, json, math, sys

PLATT_A = 2.796
PLATT_B = -0.366
ML_MIN_EDGE = 0.05

# First commit per day (morning pipeline run)
DAY_COMMITS = {
    "2026-04-02": "650ce5b",
    "2026-04-03": "9498e24",
    "2026-04-04": "827183a",
    "2026-04-05": "001fd7d",
    "2026-04-06": "53c20f9",
    "2026-04-07": "503331d",
    "2026-04-08": "b971aea",
    "2026-04-09": "70be9d0",
    "2026-04-10": "a0a47fd",
    "2026-04-11": "3a22552",
    "2026-04-12": "acd6635",
    "2026-04-13": "275440c",
    "2026-04-14": "668b353",
}

def american_to_prob(ml):
    if ml > 0: return 100 / (ml + 100)
    elif ml < 0: return abs(ml) / (abs(ml) + 100)
    return 0.5

def get_snapshot(sha):
    """Extract baseball-games.json from a specific git commit."""
    result = subprocess.run(
        ["git", "show", f"{sha}:src/data/betting-lines/baseball-games.json"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return []
    return json.loads(result.stdout)

# Load current games for actual scores
with open("src/data/betting-lines/baseball-games.json") as f:
    current_games = json.load(f)
score_lookup = {}
for g in current_games:
    key = f"{g.get('date')}|{g.get('awayTeam')}|{g.get('homeTeam')}"
    if g.get("actualHomeScore") is not None:
        score_lookup[key] = (g["actualHomeScore"], g["actualAwayScore"])

print("=" * 70)
print("  CORRECT ML BACKFILL — Point-in-Time Git Snapshots")
print("=" * 70)

all_picks = []
daily_summary = []

for date in sorted(DAY_COMMITS.keys()):
    sha = DAY_COMMITS[date]
    snapshot = get_snapshot(sha)
    if not snapshot:
        print(f"\n  {date}: Could not load snapshot from {sha}")
        continue

    day_games = [g for g in snapshot if g.get("date") == date]
    day_picks = []

    for g in day_games:
        hwp = g.get("homeWinPct")
        hml = g.get("homeML")
        aml = g.get("awayML")
        if hwp is None or hml is None or aml is None:
            continue

        # Platt scaling
        eps = 1e-6
        p = max(eps, min(1 - eps, hwp))
        logit = math.log(p / (1 - p))
        platt_hp = 1.0 / (1.0 + math.exp(-(PLATT_A * logit + PLATT_B)))
        platt_ap = 1.0 - platt_hp

        # Vegas fair probs
        v_hp = american_to_prob(hml)
        v_ap = american_to_prob(aml)
        vig = v_hp + v_ap
        if vig == 0:
            continue
        v_hf = v_hp / vig
        v_af = v_ap / vig

        # Edge
        he = platt_hp - v_hf
        ae = platt_ap - v_af

        pick = None
        edge = 0
        pick_team = ""
        pick_odds = 0
        pick_prob = 0

        if he > ae and he >= ML_MIN_EDGE:
            pick = "HOME"
            edge = he
            pick_team = g.get("homeTeam", "")
            pick_odds = hml
            pick_prob = platt_hp
        elif ae >= ML_MIN_EDGE:
            pick = "AWAY"
            edge = ae
            pick_team = g.get("awayTeam", "")
            pick_odds = aml
            pick_prob = platt_ap

        if pick:
            # Match to actual score
            key = f"{date}|{g.get('awayTeam')}|{g.get('homeTeam')}"
            scores = score_lookup.get(key)
            won = None
            if scores:
                home_won = scores[0] > scores[1]
                won = (pick == "HOME" and home_won) or (pick == "AWAY" and not home_won)

            day_picks.append({
                "date": date,
                "pick": pick,
                "pick_team": pick_team,
                "opp_team": g.get("homeTeam") if pick == "AWAY" else g.get("awayTeam"),
                "edge": round(edge * 100, 1),
                "odds": pick_odds,
                "prob": round(pick_prob, 3),
                "won": won,
                "hwp": hwp,
                "hml": hml,
                "aml": aml,
            })

    # Daily summary
    wins = sum(1 for p in day_picks if p["won"] == True)
    losses = sum(1 for p in day_picks if p["won"] == False)
    pending = sum(1 for p in day_picks if p["won"] is None)

    if day_picks:
        print(f"\n  {date}: {len(day_picks)} picks, {wins}W-{losses}L" +
              (f" ({pending} pending)" if pending else ""))
        for p in day_picks:
            res = "W" if p["won"] else ("L" if p["won"] == False else "?")
            print(f"    {res} {p['pick_team']:25s} edge={p['edge']:>5.1f}% "
                  f"odds={p['odds']:>+5d} prob={p['prob']:.3f} "
                  f"| {p['opp_team']} (hwp={p['hwp']:.4f} hml={p['hml']} aml={p['aml']})")

        daily_summary.append({"date": date, "picks": len(day_picks), "wins": wins, "losses": losses})
        all_picks.extend(day_picks)

# Overall summary
print(f"\n{'=' * 70}")
print("  SUMMARY")
print("=" * 70)
total_w = sum(d["wins"] for d in daily_summary)
total_l = sum(d["losses"] for d in daily_summary)
total_n = total_w + total_l
print(f"  Days: {len(daily_summary)}")
print(f"  Total picks: {len(all_picks)}")
print(f"  Resolved: {total_n} ({total_w}W-{total_l}L)")
if total_n > 0:
    print(f"  Win rate: {total_w/total_n*100:.1f}%")
    print(f"  Avg picks/day: {len(all_picks)/len(daily_summary):.1f}")

    # ROI
    profit = 0
    for p in all_picks:
        if p["won"] is None:
            continue
        odds = p["odds"]
        if odds > 0:
            dec = (odds / 100) + 1
        else:
            dec = (100 / abs(odds)) + 1
        if p["won"]:
            profit += dec - 1
        else:
            profit -= 1
    print(f"  ROI: {profit/total_n*100:+.1f}%")

# Edge bucket analysis
print(f"\n  Edge buckets:")
for lo, hi, label in [(5, 10, "5-10%"), (10, 15, "10-15%"), (15, 20, "15-20%"), (20, 100, "20%+")]:
    bucket = [p for p in all_picks if lo <= p["edge"] < hi and p["won"] is not None]
    if len(bucket) < 3:
        continue
    bw = sum(1 for p in bucket if p["won"])
    bn = len(bucket)
    print(f"    {label}: {bw}/{bn} = {bw/bn*100:.1f}%")

print(f"\n{'=' * 70}")
