import win32com.client
import csv
import sys
from pathlib import Path

def export_ncaa_scores():
    """
    Export NCAA scores from Excel to CSV.
    Reads from 'Scores' tab starting at row 6.
    """
    
    excel_path = r"C:\Users\andre\OneDrive\Desktop\Backup This Folder\MM2025 Model 20260111.xlsm"
    output_path = Path(r"C:\Users\andre\dev\my-app\src\data\ncaa-team\ncaa-scores.csv")
    
    print(f"Opening Excel file: {excel_path}")
    
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False
        
        wb = excel.Workbooks.Open(excel_path)
        print("Workbook opened.")
        
        # Get the "Scores" sheet
        ws = wb.Sheets("Scores")
        print("Found 'Scores' sheet.")
        
        # Find last row with data in column S (GameDate)
        last_row = ws.Cells(ws.Rows.Count, "S").End(-4162).Row  # -4162 = xlUp
        print(f"Last row with data: {last_row}")
        
        # Prepare CSV output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            # Write header
            writer.writerow([
                'GameDate',      # Column S
                'HomeTeam',      # Column J
                'AwayTeam',      # Column L
                'HomeScore',     # Column F
                'AwayScore'      # Column G
            ])
            
            # Write data rows (starting from row 6)
            rows_written = 0
            for row in range(6, last_row + 1):
                game_date = ws.Cells(row, "S").Value
                home_team = ws.Cells(row, "J").Value
                away_team = ws.Cells(row, "L").Value
                home_score = ws.Cells(row, "F").Value
                away_score = ws.Cells(row, "G").Value
                
                # Skip if no game date (empty row)
                if not game_date:
                    continue
                
                # Convert date to string format
                if game_date:
                    try:
                        # If it's a datetime object, format it
                        if hasattr(game_date, 'strftime'):
                            game_date = game_date.strftime('%Y-%m-%d')
                    except:
                        pass
                
                writer.writerow([
                    game_date or '',
                    home_team or '',
                    away_team or '',
                    home_score if home_score is not None else '',
                    away_score if away_score is not None else ''
                ])
                
                rows_written += 1
            
            print(f"✓ Wrote {rows_written} game records to {output_path}")
        
        wb.Close(SaveChanges=False)
        excel.Quit()
        print("Excel closed.")
        
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    export_ncaa_scores()
