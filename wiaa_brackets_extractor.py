import os
import csv
import json
import win32com.client as win32

# ============================================
# CONFIGURATION
# ============================================
EXCEL_PATH = r"C:\Users\andre\OneDrive\Desktop\WIAA Line Maker 20260118.xlsm"
OUTPUT_DIR = r"C:\Users\andre\dev\my-app\src\data\wiaa-seeding"

# Division configurations
DIVISIONS = [
    {"sheet": "D1 Bracket", "division": "1", "output": "wiaa-d1-bracket"},
    {"sheet": "D2 Bracket", "division": "2", "output": "wiaa-d2-bracket"},
    {"sheet": "D3 Bracket", "division": "3", "output": "wiaa-d3-bracket"},
    {"sheet": "D4 Bracket", "division": "4", "output": "wiaa-d4-bracket"},
    {"sheet": "D5 Bracket", "division": "5", "output": "wiaa-d5-bracket"},
]

START_ROW = 6
# Columns B through M
# B=Team, C=Region, D=WIAASeed, E=BBMISeed, F-L=Probabilities, M=BracketSeed
COLS = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"]

# ============================================
# HELPER: Find last row with data
# ============================================
def find_last_row(sheet, start_row=6):
    """Find the last row with data in column C (WIAA Seed)"""
    row = start_row
    while True:
        # Check column C (WIAA Seed) instead of column B
        cell_value = sheet.Range(f"C{row}").Value
        if cell_value is None or cell_value == "":
            return row - 1
        row += 1
        if row > 1000:  # Safety limit
            break
    return row - 1

# ============================================
# HELPER: Read a range of cells
# ============================================
def read_range(sheet, start_row, end_row, cols):
    """Read a rectangular range of cells"""
    data = []
    for col in cols:
        col_range = f"{col}{start_row}:{col}{end_row}"
        values = sheet.Range(col_range).Value
        # Excel returns tuple of tuples → flatten to list
        if isinstance(values, tuple):
            data.append([row[0] if isinstance(row, tuple) else row for row in values])
        else:
            data.append([values])
    return data

# ============================================
# HELPER: Create slug from team name
# ============================================
def create_slug(team_name):
    """Create a URL-friendly slug from team name"""
    import re
    slug = team_name.lower()
    # Replace spaces and slashes with hyphens
    slug = re.sub(r'[\s/]+', '-', slug)
    # Remove special characters except hyphens
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)
    # Remove leading/trailing hyphens
    slug = slug.strip('-')
    return slug

# ============================================
# MAIN EXTRACTION LOGIC
# ============================================
def extract_division_bracket(wb, config):
    """Extract bracket data for a single division"""
    sheet_name = config["sheet"]
    division = config["division"]
    output_name = config["output"]
    
    print(f"\nProcessing {sheet_name}...")
    
    try:
        sheet = wb.Worksheets(sheet_name)
    except Exception as e:
        print(f"  ERROR: Could not find sheet '{sheet_name}': {e}")
        return None
    
    # Find last row with data
    last_row = find_last_row(sheet, START_ROW)
    print(f"  Found data from row {START_ROW} to {last_row}")
    
    if last_row < START_ROW:
        print(f"  WARNING: No data found in {sheet_name}")
        return None
    
    # Read all columns at once
    data = read_range(sheet, START_ROW, last_row, COLS)
    
    # Transpose and create rows
    rows = []
    for i in range(len(data[0])):
        row = [data[col_idx][i] for col_idx in range(len(COLS))]
        rows.append(row)
    
    # Filter rows with valid Region and appropriate seed range
    # D1: Seeds 1-16 (NCAA style), regions are numeric (1, 2, 3, 4)
    # D2-D5: Seeds 1-8 (WIAA style), regions are alphanumeric (1A, 1B, 2A, 2B, etc)
    max_seed = 16 if division == "1" else 8
    
    filtered_rows = []
    debug_count = 0
    for row in rows:
        debug_count += 1
        if debug_count <= 3:  # Show first 3 rows for debugging
            print(f"  Row {debug_count}: Team={row[0]}, Region={row[1]}, BracketSeed={row[11]}")
        
        team_name = row[0]  # Column B (Team)
        region = row[1]  # Column C (Region)
        wiaa_seed = row[2]  # Column D (WIAA Seed)
        bracket_seed = row[11]  # Column M (Bracket seed)
        
        # Skip rows where team name is missing
        if not team_name or str(team_name).strip() == "":
            if debug_count <= 3:
                print(f"    -> Skipped: No team name")
            continue
        
        # Skip rows where region is missing
        if not region or str(region).strip() == "":
            if debug_count <= 3:
                print(f"    -> Skipped: No region")
            continue
        
        # For D1, region should be numeric. For D2-D5, region can be alphanumeric (1A, 1B, etc)
        region_str = str(region).strip()
        if division == "1":
            # D1 should have numeric regions - accept both int and float (1, 1.0)
            try:
                float(region_str)  # Just check if it's a valid number, don't fail
            except (ValueError, TypeError):
                if debug_count <= 3:
                    print(f"    -> Skipped: D1 region not numeric ({region_str})")
                continue
        # For D2-D5, we accept any non-empty region string
        
        # Convert bracket_seed to int, skip if invalid or > max_seed
        try:
            seed_val = int(bracket_seed) if bracket_seed is not None else 999
            if seed_val > max_seed:
                if debug_count <= 3:
                    print(f"    -> Skipped: Seed {seed_val} > {max_seed}")
                continue
        except (ValueError, TypeError):
            if debug_count <= 3:
                print(f"    -> Skipped: Invalid bracket seed ({bracket_seed})")
            continue
        
        if debug_count <= 3:
            print(f"    -> INCLUDED!")
        filtered_rows.append(row)
    
    print(f"  Filtered to {len(filtered_rows)} teams (seeds 1-{max_seed})")
    
    # Convert to JSON structure
    teams = []
    for row in filtered_rows:
        team_name = str(row[0]) if row[0] is not None else ""  # Column B
        region_raw = row[1]  # Column C
        
        # Clean up region - convert floats like 1.0 to integers like 1
        if division == "1":
            # D1 regions should be clean integers (1, 2, 3, 4 not 1.0, 2.0)
            try:
                region_num = int(float(region_raw)) if region_raw is not None else 0
                region = str(region_num)
            except (ValueError, TypeError):
                region = str(region_raw) if region_raw is not None else ""
        else:
            # D2-D5 regions are alphanumeric (1A, 1B, etc)
            region = str(region_raw) if region_raw is not None else ""
        
        # Safely convert integers
        try:
            wiaa_seed = int(row[2]) if row[2] is not None else 0  # Column D
        except (ValueError, TypeError):
            wiaa_seed = 0
        
        try:
            bbmi_seed = int(row[3]) if row[3] is not None else 0  # Column E
        except (ValueError, TypeError):
            bbmi_seed = 0
        
        # Safely convert floats (Columns F-L)
        try:
            reg_semis = float(row[4]) if row[4] is not None else 0.0  # Column F
        except (ValueError, TypeError):
            reg_semis = 0.0
            
        try:
            reg_finals = float(row[5]) if row[5] is not None else 0.0  # Column G
        except (ValueError, TypeError):
            reg_finals = 0.0
            
        try:
            sect_semi = float(row[6]) if row[6] is not None else 0.0  # Column H
        except (ValueError, TypeError):
            sect_semi = 0.0
            
        try:
            sect_final = float(row[7]) if row[7] is not None else 0.0  # Column I
        except (ValueError, TypeError):
            sect_final = 0.0
            
        try:
            state_qual = float(row[8]) if row[8] is not None else 0.0  # Column J
        except (ValueError, TypeError):
            state_qual = 0.0
            
        try:
            state_final = float(row[9]) if row[9] is not None else 0.0  # Column K
        except (ValueError, TypeError):
            state_final = 0.0
            
        try:
            state_champ = float(row[10]) if row[10] is not None else 0.0  # Column L
        except (ValueError, TypeError):
            state_champ = 0.0
            
        try:
            bracket_seed = int(row[11]) if row[11] is not None else 0  # Column M
        except (ValueError, TypeError):
            bracket_seed = 0
        
        teams.append({
            "Team": team_name,
            "Division": division,
            "Region": region,
            "WIAASeed": wiaa_seed,
            "BBMISeed": bbmi_seed,
            "Seed": bracket_seed,  # Use Column M for bracket matchups
            "slug": create_slug(team_name),
            "RegionalSemis": reg_semis,
            "RegionalChampion": reg_finals,
            "SectionalSemiFinalist": sect_semi,
            "SectionalFinalist": sect_final,
            "StateQualifier": state_qual,
            "StateFinalist": state_final,
            "StateChampion": state_champ
        })
    
    # Write JSON
    json_path = os.path.join(OUTPUT_DIR, f"{output_name}.json")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(teams, f, indent=2)
    
    print(f"  ✓ Created {output_name}.json with {len(teams)} teams")
    
    # Write CSV
    csv_path = os.path.join(OUTPUT_DIR, f"{output_name}.csv")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "Team", "Division", "Region", "WIAASeed", "BBMISeed", "Seed", "slug",
            "RegionalSemis", "RegionalChampion", "SectionalSemiFinalist",
            "SectionalFinalist", "StateQualifier", "StateFinalist", "StateChampion"
        ])
        for team in teams:
            writer.writerow([
                team["Team"], team["Division"], team["Region"],
                team["WIAASeed"], team["BBMISeed"], team["Seed"], team["slug"],
                team["RegionalSemis"], team["RegionalChampion"],
                team["SectionalSemiFinalist"], team["SectionalFinalist"],
                team["StateQualifier"], team["StateFinalist"], team["StateChampion"]
            ])
    
    print(f"  ✓ Created {output_name}.csv")
    
    return teams

# ============================================
# MAIN SCRIPT
# ============================================
def main():
    print("="*60)
    print("  WIAA BRACKET EXTRACTOR")
    print("="*60)
    
    print(f"\nOpening Excel file: {EXCEL_PATH}")
    
    excel = win32.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False
    wb = None
    
    try:
        wb = excel.Workbooks.Open(EXCEL_PATH)
        
        all_results = {}
        
        for config in DIVISIONS:
            result = extract_division_bracket(wb, config)
            if result:
                all_results[config["division"]] = result
        
        print("\n" + "="*60)
        print("  SUMMARY")
        print("="*60)
        for div, teams in all_results.items():
            print(f"  Division {div}: {len(teams)} teams")
        
        print("\n✓ All bracket files created successfully!")
        print(f"✓ Files saved to: {OUTPUT_DIR}")
        
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        if wb:
            wb.Close(SaveChanges=False)
        excel.Quit()
        print("\nExcel closed.")

if __name__ == "__main__":
    main()
