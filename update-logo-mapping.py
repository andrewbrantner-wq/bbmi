#!/usr/bin/env python3
"""
Auto-update ncaa-logo-mapping.json with manually added logos
Scans the logos folder and adds any new logos to the mapping file
"""

import json
import os
from pathlib import Path

# Configuration
LOGOS_DIR = "public/logos/ncaa"
MAPPING_FILE = "src/data/ncaa-logo-mapping.json"
RANKINGS_FILE = "src/data/rankings/rankings.json"

def sanitize_filename(name):
    """Convert team name to safe filename (same logic as fetch script)"""
    safe_name = name.lower().strip()
    safe_name = safe_name.replace(' ', '-')
    safe_name = safe_name.replace("'", '')
    safe_name = safe_name.replace('(', '').replace(')', '')
    safe_name = safe_name.replace('&', 'and')
    safe_name = ''.join(c for c in safe_name if c.isalnum() or c == '-')
    return safe_name

def load_team_names():
    """Load all team names from rankings.json"""
    try:
        with open(RANKINGS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        teams = []
        for item in data:
            team_name = item.get('team') or item.get('Team')
            if team_name:
                teams.append(team_name)
        
        return teams
    except Exception as e:
        print(f"✗ Error loading team names: {e}")
        return []

def get_existing_logos():
    """Get list of all .png files in logos directory"""
    if not os.path.exists(LOGOS_DIR):
        print(f"✗ Logos directory not found: {LOGOS_DIR}")
        return []
    
    logos = []
    for file in os.listdir(LOGOS_DIR):
        if file.endswith('.png'):
            logos.append(file)
    
    return logos

def load_mapping():
    """Load existing mapping file"""
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_mapping(mapping):
    """Save mapping file"""
    os.makedirs(os.path.dirname(MAPPING_FILE), exist_ok=True)
    with open(MAPPING_FILE, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, indent=2)

def main():
    print("=" * 70)
    print("NCAA LOGO MAPPING AUTO-UPDATER")
    print("=" * 70)
    
    # Load data
    print("\n📂 Loading data...")
    team_names = load_team_names()
    existing_logos = get_existing_logos()
    mapping = load_mapping()
    
    print(f"✓ Found {len(team_names)} teams in rankings")
    print(f"✓ Found {len(existing_logos)} logo files")
    print(f"✓ Current mapping has {len(mapping)} entries")
    
    # Build filename to team name lookup
    filename_to_team = {}
    for team in team_names:
        filename = f"{sanitize_filename(team)}.png"
        filename_to_team[filename] = team
    
    # Find new logos
    new_logos = []
    updated_logos = []
    
    for logo_file in existing_logos:
        # Check if this logo file matches a team
        if logo_file in filename_to_team:
            team_name = filename_to_team[logo_file]
            
            # Check if already in mapping
            if team_name not in mapping:
                new_logos.append(team_name)
                mapping[team_name] = {
                    "filename": logo_file,
                    "path": f"/logos/ncaa/{logo_file}"
                }
            else:
                # Update existing entry (in case path changed)
                if mapping[team_name].get("filename") != logo_file:
                    updated_logos.append(team_name)
                    mapping[team_name]["filename"] = logo_file
                    mapping[team_name]["path"] = f"/logos/ncaa/{logo_file}"
    
    # Save updated mapping
    if new_logos or updated_logos:
        save_mapping(mapping)
        print("\n💾 Updated mapping file!")
    else:
        print("\n✓ Mapping file is already up to date")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total teams in mapping:  {len(mapping)}")
    print(f"New logos added:         {len(new_logos)}")
    print(f"Updated entries:         {len(updated_logos)}")
    print("=" * 70)
    
    if new_logos:
        print(f"\n✨ Added {len(new_logos)} new logo(s):")
        for team in sorted(new_logos)[:10]:  # Show first 10
            print(f"  ✓ {team}")
        if len(new_logos) > 10:
            print(f"  ... and {len(new_logos) - 10} more")
    
    if updated_logos:
        print(f"\n🔄 Updated {len(updated_logos)} logo(s):")
        for team in sorted(updated_logos):
            print(f"  ✓ {team}")
    
    # Check for logos without matching teams
    orphaned = []
    for logo_file in existing_logos:
        if logo_file not in filename_to_team:
            orphaned.append(logo_file)
    
    if orphaned:
        print(f"\n⚠️  Found {len(orphaned)} logo file(s) that don't match any team:")
        for logo in sorted(orphaned)[:5]:
            print(f"  - {logo}")
        if len(orphaned) > 5:
            print(f"  ... and {len(orphaned) - 5} more")
        print("\n  These might be typos or old files you can delete.")
    
    print(f"\n✅ Done! Mapping file: {MAPPING_FILE}")
    print("   Restart your dev server to see the changes.\n")

if __name__ == "__main__":
    main()
