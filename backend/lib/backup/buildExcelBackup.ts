/** Excel XML Spreadsheet 2003 — без външен пакет xlsx. Отваря се в Excel като .xml */
import type { BackupExportResult } from "./exportPublicTables";
import type { BusinessExcelExport } from "./exportBusinessExcelData";

const EXCEL_SHEET_NAME_MAX = 31;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeSheetName(table: string): string {
  const cleaned = table.replace(/[\\/?*[\]:]/g, "_").slice(0, EXCEL_SHEET_NAME_MAX);
  return cleaned || "sheet";
}

function cellXml(value: unknown): string {
  if (value === null || value === undefined) {
    return '<Cell><Data ss:Type="String"></Data></Cell>';
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="String">${value ? "TRUE" : "FALSE"}</Data></Cell>`;
  }
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (text.length > 32_000) text = `${text.slice(0, 32_000)}…`;
  return `<Cell><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
}

function worksheetXml(
  name: string,
  rows: Record<string, unknown>[],
  columnOrder?: readonly string[],
): string {
  const columns =
    columnOrder && columnOrder.length > 0
      ? [...columnOrder]
      : (() => {
          const keys = new Set<string>();
          for (const row of rows) {
            for (const key of Object.keys(row)) keys.add(key);
          }
          return [...keys];
        })();

  const header =
    columns.length > 0
      ? `<Row>${columns.map((c) => cellXml(c)).join("")}</Row>`
      : `<Row>${cellXml("(няма колони)")}</Row>`;

  const body =
    rows.length > 0
      ? rows.map((row) => `<Row>${columns.map((c) => cellXml(row[c])).join("")}</Row>`).join("")
      : `<Row>${cellXml("(няма редове)")}</Row>`;

  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${header}${body}</Table></Worksheet>`;
}

function buildWorkbookXml(sheetParts: string[]): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
${sheetParts.join("\n")}
</Workbook>`;
  return Buffer.from(`\uFEFF${xml}`, "utf-8");
}

/** Продажби + налична стока (за офис). */
export function buildBusinessExcelBuffer(data: BusinessExcelExport): Buffer {
  const manifestRows = [
    { поле: "формат", стойност: "smolyanklima-business-xml" },
    { поле: "експортиран на", стойност: data.exportedAt },
    { поле: "продажби", стойност: data.sales.length },
    { поле: "налична стока", стойност: data.stock.length },
    { поле: "филтър стока", стойност: "stock_status = in_stock" },
  ];

  return buildWorkbookXml([
    worksheetXml("_обобщение", manifestRows),
    worksheetXml("Продажби", data.sales, data.saleColumns),
    worksheetXml("Налична_стока", data.stock, data.stockColumns),
  ]);
}

/** Пълен DB backup — всички таблици (само при нужда от технически архив). */
export function buildFullDatabaseExcelBuffer(result: BackupExportResult): Buffer {
  const usedNames = new Set<string>();
  const sheets: string[] = [];

  const manifestRows = [
    { поле: "формат", стойност: "smolyanklima-full-xml" },
    { поле: "експортиран на", стойност: result.exportedAt },
    { поле: "брой таблици", стойност: result.names.length },
    ...result.names.map((t) => ({
      поле: `редове: ${t}`,
      стойност: result.tableErrors[t] ? `грешка: ${result.tableErrors[t]}` : (result.data[t]?.length ?? 0),
    })),
  ];
  sheets.push(worksheetXml("_обобщение", manifestRows));

  for (const table of result.names) {
    if (result.tableErrors[table]) continue;
    const baseName = sanitizeSheetName(table);
    let sheetName = baseName;
    let n = 1;
    while (usedNames.has(sheetName)) {
      const suffix = `_${n}`;
      sheetName = `${baseName.slice(0, EXCEL_SHEET_NAME_MAX - suffix.length)}${suffix}`;
      n++;
    }
    usedNames.add(sheetName);
    sheets.push(worksheetXml(sheetName, result.data[table] ?? []));
  }

  return buildWorkbookXml(sheets);
}
