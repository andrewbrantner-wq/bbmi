"""
Extract cells BF6:BG14 from 'team probabilities' sheet to JSON
"""
import win32com.client as win32
import json
from pathlib import Path
import sys

def extract_range_to_json(excel_path, output_path):
    """Extract BF6:BG14 from 'team probabilities' sheet and save as JSON"""
    
    print(f"Opening Excel workbook: {excel_path}")
    
    try:
        excel = win32.Dispatch("Excel.Application")
        excel.AutomationSecurity = 3
        excel.Visible = False
        excel.DisplayAlerts = False
        
        wb = excel.Workbooks.Open(excel_path)
        print("Workbook opened.")
        
        # Access the 'team probabilities' sheet
        try:
            ws = wb.Sheets("team probabilities")
        except:
            print("ERROR: Could not find sheet named 'team probabilities'")
            wb.Close()
            excel.Quit()
            sys.exit(1)
        
        print("Found 'team probabilities' sheet. Reading range BF6:BG14...")
        
        # Read the range BF6:BG14
        range_obj = ws.Range("BF6:BG14")
        values = range_obj.Value
        
        # Convert to list of lists (removing COM wrapper)
        data = []
        if values:
            for row in values:
                data.append(list(row))
        
        # Close Excel
        wb.Close(False)
        excel.Quit()
        print("Excel closed.")
        
        # Save to JSON
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        print(f"JSON saved to: {output_path}")
        print(f"Extracted {len(data)} rows x {len(data[0]) if data else 0} columns")
        
        return True
        
    except Exception as e:
        print(f"ERROR during extraction: {e}")
        try:
            excel.Quit()
        except:
            pass
        return False

if __name__ == "__main__":
    excel_file = r"C:\Users\andre\OneDrive\Desktop\Backup This Folder\MM2025 Model 20260111.xlsm"
    output_file = r"C:\Users\andre\dev\my-app\src\data\ncaa-bracket\bubblewatch.json"
    
    success = extract_range_to_json(excel_file, output_file)
    
    if not success:
        sys.exit(1)
