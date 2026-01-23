import openpyxl
import csv
import os

# === CONFIG ===

# Your Excel workbook
excel_path = r"C:\Users\andre\OneDrive\Desktop\Backup This Folder\MM2025 Model 20260111.xlsm"

# Output CSV paths
games_csv = r"C:\Users\andre\dev\my-app\src\data\betting-lines\games.csv"
rankings_csv = r"C:\Users\andre\dev\my-app\src\data\rankings\rankings.csv"
seeding_csv = r"C:\Users\andre\dev\my-app\src\data\seeding\seeding.csv"

# Excel locations
DATA_MAP = {
    "games": {
        "sheet": "Betting Lines",
        "range": "AH8:AQ3000",
        "output": games_csv
    },
    "rankings": {
        "sheet": "My Rankings",
        "range": "BZ6:CF371",
        "output": rankings_csv
    },
    "seeding": {
        "sheet": "Team Probabilities",
        "range": "AV6:BD70",
        "output": seeding_csv
    }
}

# === HELPERS ===

def read_range(ws, cell_range):
    cells = ws[cell_range]
    rows = []
    for row in cells:
        rows.append([
            "" if cell.value is None else str(cell.value)
            for cell in row
        ])
    return rows

def export_csv(sheet_name, cell_range, output_path):
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb[sheet_name]

    rows = read_range(ws, cell_range)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(rows)

    print(f"Exported → {output_path}")

# === MAIN ===

for key, cfg in DATA_MAP.items():
    export_csv(cfg["sheet"], cfg["range"], cfg["output"])