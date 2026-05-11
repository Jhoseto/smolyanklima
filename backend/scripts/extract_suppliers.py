"""Извлича всички уникални доставчици от aerf.xls и брои броя поръчки за всеки."""

from pathlib import Path
from collections import Counter

import pandas as pd

XLS_PATH = Path(r"h:\Apps\SmolyanKlima\Doc\aerf.xls")


def normalize(name: str) -> str:
    return " ".join(str(name).split()).strip().upper()


def main() -> int:
    xls = pd.ExcelFile(XLS_PATH, engine="xlrd")
    counter: Counter[str] = Counter()
    per_sheet: dict[str, Counter[str]] = {}

    for sheet_name in xls.sheet_names:
        df = xls.parse(sheet_name)
        if "ДОСТАВЧИК" not in df.columns:
            continue
        s = df["ДОСТАВЧИК"].dropna().map(normalize)
        s = s[s != ""]
        per_sheet[sheet_name] = Counter(s.tolist())
        counter.update(s.tolist())

    print(f"\n=== Уникални доставчици (общо {len(counter)}) ===\n")
    for name, cnt in counter.most_common():
        sheet_info = ", ".join(f"{sh}={c}" for sh, c in per_sheet.items() if c.get(name))
        print(f"  {cnt:>5} × {name:<30}  [{sheet_info}]")

    print(f"\nОбщо записи с доставчик: {sum(counter.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
