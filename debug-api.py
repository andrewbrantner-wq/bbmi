#!/usr/bin/env python3
"""
Debug script to see what TheSportsDB returns for a team
"""

import requests
import json
from urllib.parse import quote

def test_team(team_name):
    """Test API response for a specific team"""
    url = f"https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t={quote(team_name)}"
    
    print(f"Testing: {team_name}")
    print(f"URL: {url}")
    print("=" * 70)
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        print("\nFull Response:")
        print(json.dumps(data, indent=2))
        
        if data.get('teams'):
            print(f"\n✓ Found {len(data['teams'])} team(s)")
            
            for idx, team in enumerate(data['teams'], 1):
                print(f"\nTeam #{idx}:")
                print(f"  Name: {team.get('strTeam')}")
                print(f"  Sport: {team.get('strSport')}")
                print(f"  League: {team.get('strLeague')}")
                print(f"  strTeamBadge: {team.get('strTeamBadge')}")
                print(f"  strTeamLogo: {team.get('strTeamLogo')}")
                print(f"  strTeamBanner: {team.get('strTeamBanner')}")
        else:
            print("\n✗ No teams found in response")
    
    except Exception as e:
        print(f"\n✗ Error: {e}")

# Test a few teams
print("TESTING NCAA TEAMS\n")
test_team("Michigan")
print("\n" + "=" * 70 + "\n")
test_team("Duke")
print("\n" + "=" * 70 + "\n")
test_team("Michigan Wolverines")  # Try with mascot
