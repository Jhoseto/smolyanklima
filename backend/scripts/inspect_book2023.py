#!/usr/bin/env python3
import json
import xlrd
from collections import Counter

PATH = r"H:\Apps\SmolyanKlima\Doc\Book2023-2.xls"
OUT = r"H:\Apps\SmolyanKlima\Doc\Book2023-2_report.txt"


def rgb_from_index(book, colour_index):
    try:
        if colour_index in book.colour_map:
            return book.colour_map[colour_index]
    except Exception:
        pass
    return None


def is_greenish(colour_index, rgb):
    if rgb and len(rgb) == 3:
        r, g, b = rgb
        return g > 80 and g > r + 30 and g > b + 30
    return colour_index in {3, 17, 21, 42, 43, 50}


def main():
    book = xlrd.open_workbook(PATH, formatting_info=True)
    lines = [f"sheets={book.sheet_names()}"]

    for si, sh in enumerate(book.sheets()):
        lines.append(f"\n## SHEET {si}: {sh.name!r} rows={sh.nrows} cols={sh.ncols}")
        lines.append("\nFirst rows preview:")
        shown = 0
        for r in range(min(sh.nrows, 30)):
            vals = []
            for c in range(min(sh.ncols, 12)):
                v = sh.cell_value(r, c)
                if v != "":
                    vals.append(f"C{c+1}={str(v).replace(chr(10),' ')[:35]!r}")
            if vals:
                lines.append(f"  R{r+1}: " + "; ".join(vals[:6]))
                shown += 1
                if shown >= 8:
                    break

        green_rows = []
        other_color_rows = []
        black_rows = 0
        font_colors = Counter()

        for r in range(sh.nrows):
            row_green = False
            row_other = False
            samples = []
            for c in range(sh.ncols):
                v = sh.cell_value(r, c)
                if v == "":
                    continue
                xf = book.xf_list[sh.cell_xf_index(r, c)]
                font = book.font_list[xf.font_index]
                rgb = rgb_from_index(book, font.colour_index)
                font_colors[font.colour_index] += 1
                if is_greenish(font.colour_index, rgb):
                    row_green = True
                    samples.append((c + 1, str(v).replace("\n", " ")[:40], rgb))
                elif font.colour_index not in (0, 32767, 32753) and rgb not in ((0, 0, 0), None):
                    row_other = True
                    samples.append((c + 1, str(v).replace("\n", " ")[:40], rgb, font.colour_index))
            if row_green:
                green_rows.append((r + 1, samples[:4]))
            elif row_other:
                other_color_rows.append((r + 1, samples[:2]))
            elif any(sh.cell_value(r, c) != "" for c in range(min(sh.ncols, 20))):
                black_rows += 1

        lines.append("\nRow color summary:")
        lines.append(f"  green rows: {len(green_rows)}")
        lines.append(f"  other-color rows: {len(other_color_rows)}")
        lines.append(f"  default/black rows (with data): ~{black_rows}")
        lines.append(f"  top font colour indices: {font_colors.most_common(6)}")
        lines.append("\nGreen row samples (first 15):")
        for rownum, samples in green_rows[:15]:
            parts = [f"C{col} {txt!r} rgb={rgb}" for col, txt, rgb in samples]
            lines.append(f"  R{rownum}: " + " | ".join(parts))
        if other_color_rows[:5]:
            lines.append("\nOther-color row samples (first 5):")
            for rownum, samples in other_color_rows[:5]:
                lines.append(f"  R{rownum}: {samples}")

    text = "\n".join(lines)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(text)


if __name__ == "__main__":
    main()
