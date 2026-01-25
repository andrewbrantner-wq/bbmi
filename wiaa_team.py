import os
import csv
import win32com.client as win32

# ============================================
# CONFIGURATION
# ============================================

EXCEL_PATH = r"C:\Users\andre\OneDrive\Desktop\WIAA Line Maker 20260118.xlsm"
OUTPUT_CSV = r"C:\Users\andre\dev\my-app\src\data\wiaa-team\WIAA-team.csv"

SHEET_NAME = "team-schedule"

START_ROW = 2
END_ROW = 20000  # bulk read ceiling

# Column letters
COLS = {
    "team": "B",
    "team_div": "A",
    "date": "C",
    "opp": "D",
    "opp_div": "M",
    "location": "F",
    "result": "G",
    "team_score": "H",
    "opp_score": "I",
    "teamline": "V",
    "teamwin": "AA"
}

# ============================================
# HELPER: Read a full column range in one call
# ============================================

def read_column(sheet, col_letter):
    rng = f"{col_letter}{START_ROW}:{col_letter}{END_ROW}"
    values = sheet.Range(rng).Value

    # Excel returns tuple of tuples → flatten
    return [row[0] for row in values]

# ============================================
# MAIN EXTRACTION LOGIC
# ============================================

def extract_wiaa_team():
    print("Opening Excel...")
    excel = win32.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    wb = None

    try:
        wb = excel.Workbooks.Open(EXCEL_PATH)
        sheet = wb.Worksheets(SHEET_NAME)

        print("Reading columns in bulk...")

        # Read all columns in one COM call each
        data = {key: read_column(sheet, col) for key, col in COLS.items()}

        print("Zipping rows and filtering empty entries...")

        rows = []
        for i in range(END_ROW - START_ROW + 1):
            # anchor column = team_div (column A)
            if data["team_div"][i] is None:
                continue

            rows.append([
                data["team"][i],
                data["team_div"][i],
                data["date"][i],
                data["opp"][i],
                data["opp_div"][i],
                data["location"][i],
                data["result"][i],
                data["team_score"][i],
                data["opp_score"][i],
                data["teamline"][i],
                data["teamwin"][i]
            ])

        print(f"Writing CSV → {OUTPUT_CSV}")
        os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "team",
                "team-div",
                "date",
                "opp",
                "opp-div",
                "location",
                "result",
                "team-score",
                "opp-score",
                "teamline",
                "teamwin%"
            ])
            writer.writerows(rows)

        print(f"Done. Wrote {len(rows)} rows.")
        print("WIAA team CSV created successfully.")

    except Exception as e:
        print("ERROR:", e)

    finally:
        if wb:
            wb.Close(SaveChanges=False)
        excel.Quit()
        print("Excel closed cleanly.")

# ============================================
# RUN SCRIPT
# ============================================

if __name__ == "__main__":
    extract_wiaa_team()