#!/usr/bin/env python3
"""
NCAA Team Logo Fetcher - Improved with rate limiting
Uses TheSportsDB API with smart throttling
"""

import requests
import json
import os
import time
from pathlib import Path
from urllib.parse import quote

# ===== CONFIGURATION =====
RANKINGS_FILE = "src/data/rankings/rankings.json"
OUTPUT_DIR = "public/logos/ncaa"
MAPPING_FILE = "src/data/ncaa-logo-mapping.json"
CACHE_FILE = "logo-fetch-cache.json"  # Cache to avoid re-fetching

# API Configuration
SPORTS_DB_URL = "https://www.thesportsdb.com/api/v1/json/3/searchteams.php"
REQUEST_DELAY = 2.0  # 2 seconds between requests (increased)
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds

def setup():
    """Create necessary directories"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(MAPPING_FILE), exist_ok=True)

def load_cache():
    """Load cached API responses"""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_cache(cache):
    """Save API responses to cache"""
    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, indent=2)

def sanitize_filename(name):
    """Convert team name to safe filename"""
    safe_name = name.lower().strip()
    safe_name = safe_name.replace(' ', '-')
    safe_name = safe_name.replace("'", '')
    safe_name = safe_name.replace("(", '').replace(")", '')
    safe_name = safe_name.replace("&", 'and')
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '-')
    return safe_name

def load_teams():
    """Load team names from rankings.json"""
    try:
        with open(RANKINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        teams = []
        for item in data:
            team_name = item.get('team') or item.get('Team')
            if team_name:
                teams.append(team_name)
        
        print(f"✓ Loaded {len(teams)} teams")
        return teams
    except Exception as e:
        print(f"✗ Error loading teams: {e}")
        return []

def search_team_api(team_name, cache, retry_count=0):
    """Search for team with retry logic"""
    
    # Check cache first
    if team_name in cache:
        print(f"  📦 Using cached result")
        return cache[team_name]
    
    try:
        url = f"{SPORTS_DB_URL}?t={quote(team_name)}"
        response = requests.get(url, timeout=15)
        
        # Handle rate limiting
        if response.status_code == 429:
            if retry_count < MAX_RETRIES:
                wait_time = RETRY_DELAY * (retry_count + 1)
                print(f"  ⏳ Rate limited. Waiting {wait_time}s...")
                time.sleep(wait_time)
                return search_team_api(team_name, cache, retry_count + 1)
            else:
                print(f"  ✗ Rate limit - max retries reached")
                cache[team_name] = None
                return None
        
        response.raise_for_status()
        data = response.json()
        
        # Cache the result
        cache[team_name] = data
        
        if data.get('teams'):
            for team in data['teams']:
                if team.get('strSport') == 'Basketball':
                    return data
        
        return None
    
    except Exception as e:
        print(f"  ✗ API Error: {e}")
        cache[team_name] = None
        return None

def download_logo(logo_url, team_name):
    """Download logo image"""
    if not logo_url:
        return None
    
    try:
        response = requests.get(logo_url, timeout=15)
        response.raise_for_status()
        
        filename = f"{sanitize_filename(team_name)}.png"
        filepath = os.path.join(OUTPUT_DIR, filename)
        
        with open(filepath, 'wb') as f:
            f.write(response.content)
        
        return filename
    except Exception as e:
        print(f"  ✗ Download error: {e}")
        return None

def main():
    print("=" * 70)
    print("NCAA LOGO FETCHER - TheSportsDB (Rate-Limited Version)")
    print("=" * 70)
    print("\n⚠️  This will be SLOW to avoid rate limiting (2s between requests)")
    print("⚠️  Estimated time: ~12 minutes for 365 teams")
    print("\nPress Ctrl+C to stop at any time. Progress is saved!\n")
    
    setup()
    teams = load_teams()
    
    if not teams:
        return
    
    # Load cache
    cache = load_cache()
    print(f"✓ Loaded cache with {len(cache)} entries\n")
    
    # Track results
    logo_mapping = {}
    stats = {
        'total': len(teams),
        'processed': 0,
        'found': 0,
        'downloaded': 0,
        'skipped': 0,
        'failed': 0
    }
    
    try:
        for idx, team_name in enumerate(teams, 1):
            print(f"[{idx}/{len(teams)}] {team_name}")
            
            # Check if already downloaded
            filename = f"{sanitize_filename(team_name)}.png"
            filepath = os.path.join(OUTPUT_DIR, filename)
            
            if os.path.exists(filepath):
                print(f"  ✓ Already have logo")
                stats['skipped'] += 1
                logo_mapping[team_name] = {
                    'filename': filename,
                    'path': f'/logos/ncaa/{filename}'
                }
                stats['processed'] += 1
                continue
            
            # Search API
            team_data = search_team_api(team_name, cache)
            
            if team_data and team_data.get('teams'):
                team_info = None
                for team in team_data['teams']:
                    if team.get('strSport') == 'Basketball':
                        team_info = team
                        break
                
                if team_info:
                    stats['found'] += 1
                    logo_url = team_info.get('strBadge') or team_info.get('strLogo')
                    
                    if logo_url:
                        print(f"  ✓ Found logo")
                        
                        if download_logo(logo_url, team_name):
                            stats['downloaded'] += 1
                            logo_mapping[team_name] = {
                                'filename': filename,
                                'path': f'/logos/ncaa/{filename}',
                                'sportsdb_id': team_info.get('idTeam')
                            }
                            print(f"  ✓ Downloaded")
                        else:
                            stats['failed'] += 1
                    else:
                        print(f"  ✗ No logo URL")
                        stats['failed'] += 1
                else:
                    print(f"  ✗ Not a basketball team")
                    stats['failed'] += 1
            else:
                print(f"  ✗ Not found in API")
                stats['failed'] += 1
            
            stats['processed'] += 1
            
            # Save progress every 10 teams
            if idx % 10 == 0:
                save_cache(cache)
                with open(MAPPING_FILE, 'w') as f:
                    json.dump(logo_mapping, f, indent=2)
                print(f"\n💾 Progress saved ({stats['processed']}/{stats['total']})\n")
            
            # Rate limiting delay
            time.sleep(REQUEST_DELAY)
    
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        print("Progress has been saved. You can resume later.")
    
    finally:
        # Save final results
        save_cache(cache)
        
        with open(MAPPING_FILE, 'w') as f:
            json.dump(logo_mapping, f, indent=2)
        
        # Summary
        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)
        print(f"Processed:     {stats['processed']}/{stats['total']}")
        print(f"Downloaded:    {stats['downloaded']}")
        print(f"Already had:   {stats['skipped']}")
        print(f"Found in API:  {stats['found']}")
        print(f"Failed:        {stats['failed']}")
        print("=" * 70)
        
        if stats['processed'] < stats['total']:
            remaining = stats['total'] - stats['processed']
            print(f"\n⏸️  {remaining} teams remaining. Run script again to continue.")
        
        print(f"\n✅ Results saved to:")
        print(f"   - {OUTPUT_DIR}/")
        print(f"   - {MAPPING_FILE}")
        print(f"   - {CACHE_FILE} (cache)")

if __name__ == "__main__":
    main()
