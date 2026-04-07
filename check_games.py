import json
with open('src/data/betting-lines/kalshi-trades.json') as f:
    data = json.load(f)

for t in data['trades']:
    if 'Furman' in str(t.get('away_team','')) and t.get('cost') == 0.0:
        print(json.dumps(t, indent=2))
        break