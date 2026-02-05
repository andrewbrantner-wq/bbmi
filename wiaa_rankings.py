import os
import csv
import win32com.client as win32

# ============================================
# CONFIGURATION
# ============================================

EXCEL_PATH = r"C:\Users\andre\OneDrive\Desktop\WIAA Line Maker 20260118.xlsm"
OUTPUT_CSV = r"C:\Users\andre\dev\my-app\src\data\wiaa-rankings\WIAArankings.csv"

SHEETS = ["d1", "d2", "d3", "d4", "d5"]

DIVISION_RANGE = "B7:B150"
TEAM_RANGE = "C7:C150"
RANK_RANGE = "AL7:AL150"
RECORD_RANGE = "AM7:AM150"
CONF_RECORD_RANGE = "BB7:BB150"  # Conference record

# ============================================
# HELPER: Read a range safely
# ============================================

def read_range(sheet, cell_range):
    values = sheet.Range(cell_range).Value
    if isinstance(values, tuple):
        return [row[0] for row in values]
    return []

# ============================================
# MAIN EXTRACTION LOGIC
# ============================================

def extract_wiaa_rankings():
    print("Opening Excel...")
    excel = win32.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    wb = None

    try:
        wb = excel.Workbooks.Open(EXCEL_PATH)
        wb.RefreshAll()
        excel.CalculateUntilAsyncQueriesDone()

        all_rows = []

        for sheet_name in SHEETS:
            print(f"Processing sheet: {sheet_name}")
            sheet = wb.Worksheets(sheet_name)

            divisions = read_range(sheet, DIVISION_RANGE)
            teams = read_range(sheet, TEAM_RANGE)
            rankings = read_range(sheet, RANK_RANGE)
            records = read_range(sheet, RECORD_RANGE)
            conf_records = read_range(sheet, CONF_RECORD_RANGE)

            for d, t, r, rec, conf_rec in zip(divisions, teams, rankings, records, conf_records):
                # Skip empty rows
                if d is None and t is None and r is None and rec is None:
                    continue

                all_rows.append([d, t, r, rec, conf_rec])

        print(f"Writing CSV → {OUTPUT_CSV}")
        os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)

        with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["division", "team", "ranking", "record", "conf_record"])
            writer.writerows(all_rows)

        print("WIAA rankings CSV created successfully.")

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
    extract_wiaa_rankings()
