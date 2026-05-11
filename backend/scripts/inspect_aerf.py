"""
Бърз inspector на h:\\Apps\\SmolyanKlima\\Doc\\aerf.xls.
Извежда:
  - имена на всички sheet-ове
  - брой редове / колони
  - колоните и първите 5-10 примерни реда от всеки sheet
  - всички уникални стойности в колони, които могат да са „доставчик"
"""

import sys
from pathlib import Path

import pandas as pd

XLS_PATH = Path(r"h:\Apps\SmolyanKlima\Doc\aerf.xls")


def main() -> int:
    if not XLS_PATH.exists():
        print(f"FILE NOT FOUND: {XLS_PATH}")
        return 1

    # xlrd 2.x чете само legacy .xls — точно това е нашият формат
    xls = pd.ExcelFile(XLS_PATH, engine="xlrd")
    print(f"\n=== FILE: {XLS_PATH.name} ===")
    print(f"Sheets ({len(xls.sheet_names)}): {xls.sheet_names}\n")

    for sheet_name in xls.sheet_names:
        df = xls.parse(sheet_name)
        print(f"--- Sheet: {sheet_name} ---")
        print(f"Shape: {df.shape[0]} rows × {df.shape[1]} cols")
        print(f"Columns ({len(df.columns)}):")
        for i, col in enumerate(df.columns):
            non_null = df[col].notna().sum()
            sample = df[col].dropna().astype(str).head(3).tolist()
            print(f"  [{i}] {col!r:<40} non_null={non_null:<5} sample={sample}")
        print()
        print("First 5 rows:")
        with pd.option_context("display.max_columns", 50, "display.width", 220, "display.max_colwidth", 60):
            print(df.head(5).to_string())
        print()


if __name__ == "__main__":
    sys.exit(main())
