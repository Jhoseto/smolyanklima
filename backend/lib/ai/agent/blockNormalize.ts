import { AgentBlockSchema, AgentResponseSchema, type AgentBlock } from "@/lib/ai/agent/types";
import { humanizeAgentBlocks } from "@/lib/ai/agent/agentHumanize";

export function extractJsonFromText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  if (objStart >= 0 && (arrStart < 0 || objStart <= arrStart)) {
    const end = text.lastIndexOf("}");
    if (end > objStart) return text.slice(objStart, end + 1);
  }
  if (arrStart >= 0) {
    const end = text.lastIndexOf("]");
    if (end > arrStart) return text.slice(arrStart, end + 1);
  }
  return text.trim();
}

function asString(value: unknown, max = 500): string {
  if (value == null) return "";
  return String(value).slice(0, max);
}

const DISPLAY_STRING_KEYS = ["label", "name", "title", "text", "header", "column", "value"] as const;

/** Extract human-readable text from strings, numbers, or common Gemini object shapes. */
function asDisplayString(value: unknown, max = 500): string {
  if (value == null) return "";
  if (typeof value === "string") return value.slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value).slice(0, max);
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of DISPLAY_STRING_KEYS) {
      const v = o[key];
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
      if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, max);
      if (v && typeof v === "object") {
        const nested = asDisplayString(v, max);
        if (nested && nested !== "[object Object]") return nested;
      }
    }
    for (const v of Object.values(o)) {
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, max);
      if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, max);
    }
  }
  const fallback = asString(value, max);
  return fallback === "[object Object]" ? "" : fallback;
}

function normalizeTableColumns(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, unknown>);
  return null;
}

function normalizeTableRow(row: unknown, columnCount: number): string[] {
  if (Array.isArray(row)) {
    return row.map((cell) => asDisplayString(cell, 500)).slice(0, columnCount);
  }
  if (row && typeof row === "object") {
    const o = row as Record<string, unknown>;
    if (Array.isArray(o.cells)) {
      return o.cells.map((cell) => asDisplayString(cell, 500)).slice(0, columnCount);
    }
    const values = Object.values(o).map((cell) => asDisplayString(cell, 500)).filter(Boolean);
    if (values.length > 0) return values.slice(0, columnCount);
  }
  return [asDisplayString(row, 500)];
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((v) => asDisplayString(v, maxLen));
}

function asNumberArray(value: unknown, maxItems: number): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
}

function blockType(raw: unknown): string {
  if (typeof raw !== "object" || !raw) return "";
  const b = raw as Record<string, unknown>;
  const t = b.type ?? b.block_type ?? b.blockType;
  return typeof t === "string" ? t.toLowerCase().trim() : "";
}

/** Map common Gemini / Chart.js block shapes to our canonical fields before normalize. */
function flattenGeminiBlock(raw: Record<string, unknown>): Record<string, unknown> {
  const type = blockType(raw);
  const out: Record<string, unknown> = { ...raw };

  if (type === "markdown") {
    const md = (typeof raw.text === "string" ? raw.text : null)
      ?? (typeof raw.body === "string" ? raw.body : null)
      ?? (typeof raw.markdown === "string" ? raw.markdown : null);
    if (md && typeof out.content !== "string") out.content = md;
  }

  if (type === "chart") {
    const ct = raw.chartType ?? raw.chart_type ?? raw.kind;
    if (ct) out.chartType = ct;

    const data = raw.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      if (!out.labels && d.labels) out.labels = d.labels;
      if (!out.labels && d.categories) out.labels = d.categories;
      if (!out.datasets && d.datasets) out.datasets = d.datasets;
      if (!out.datasets && d.series) out.datasets = d.series;
      if (!out.datasets && Array.isArray(d.values)) {
        out.values = d.values;
        out.seriesLabel = d.label ?? d.seriesLabel ?? d.datasetLabel;
      }
    }

    // Chart.js-style top-level dataset array
    if (!out.datasets && Array.isArray(raw.dataset)) out.datasets = raw.dataset;
    if (!out.datasets && Array.isArray(raw.dataset) && raw.dataset.length === 1) out.datasets = raw.dataset;
  }

  if (type === "kpi") {
    if (!out.value && raw.metric != null) out.value = raw.metric;
    if (!out.value && raw.number != null) out.value = raw.number;
  }

  if (type === "link") {
    if (!out.href && typeof raw.url === "string") out.href = raw.url;
    if (!out.label && typeof raw.text === "string") out.label = raw.text;
  }

  return out;
}

/** Coerce common Gemini aliases (headers, string numbers) into our block schema. */
export function normalizeAgentBlock(raw: unknown): AgentBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = flattenGeminiBlock(raw as Record<string, unknown>);
  const type = blockType(b);

  if (type === "markdown") {
    const content =
      (typeof b.content === "string" ? b.content : null)
      ?? (typeof b.text === "string" ? b.text : null)
      ?? (typeof b.body === "string" ? b.body : null);
    if (!content) return null;
    return { type: "markdown", content: content.slice(0, 12000) };
  }

  if (type === "table") {
    const columnsRaw = normalizeTableColumns(b.columns)
      ?? normalizeTableColumns(b.headers)
      ?? normalizeTableColumns(b.header);
    if (!columnsRaw || columnsRaw.length === 0) return null;

    const columns = asStringArray(columnsRaw, 20, 120).filter(Boolean);
    if (columns.length === 0) return null;

    const rows = Array.isArray(b.rows)
      ? b.rows.map((row) => normalizeTableRow(row, columns.length))
      : [];

    const links = Array.isArray(b.links)
      ? b.links
          .map((link) => {
            if (!link || typeof link !== "object") return null;
            const l = link as Record<string, unknown>;
            const row = typeof l.row === "number" ? l.row : Number(l.row);
            const href = typeof l.href === "string" ? l.href : "";
            if (!Number.isInteger(row) || row < 0 || !href) return null;
            return { row, href: href.slice(0, 500) };
          })
          .filter((x): x is { row: number; href: string } => x !== null)
      : undefined;

    const title = typeof b.title === "string" ? b.title.trim().slice(0, 200) : undefined;

    return {
      type: "table",
      ...(title ? { title } : {}),
      columns,
      rows: rows.slice(0, 50).map((row) => {
        const padded = [...row];
        while (padded.length < columns.length) padded.push("");
        return padded.slice(0, columns.length);
      }),
      ...(links && links.length > 0 ? { links } : {}),
    };
  }

  if (type === "chart") {
    const chartType = b.chartType ?? b.chart_type ?? b.kind;
    if (chartType !== "bar" && chartType !== "line" && chartType !== "pie" && chartType !== "area") {
      return null;
    }
    const labels = asStringArray(b.labels ?? b.categories, 60, 80);
    const datasetsRaw = Array.isArray(b.datasets) ? b.datasets : Array.isArray(b.series) ? b.series : [];
    let datasets = datasetsRaw.slice(0, 5).map((ds, i) => {
      const d = ds as Record<string, unknown>;
      return {
        label: asDisplayString(d.label ?? d.name, 120) || `Series ${i + 1}`,
        data: asNumberArray(d.data ?? d.values, 60),
      };
    });
    if (datasets.length === 0 && Array.isArray(b.values)) {
      datasets = [
        {
          label: asDisplayString(b.seriesLabel ?? b.datasetLabel, 120) || "Стойност",
          data: asNumberArray(b.values, 60),
        },
      ];
    }
    if (labels.length === 0 || datasets.length === 0 || datasets.every((d) => d.data.length === 0)) return null;
    return {
      type: "chart",
      chartType,
      title: asString(b.title, 200) || "Графика",
      labels,
      datasets,
    };
  }

  if (type === "kpi") {
    const label = asString(b.label ?? b.name, 120);
    const value = asString(b.value ?? b.amount ?? b.metric, 120);
    if (!label || !value) return null;
    const hint = typeof b.hint === "string" ? b.hint.slice(0, 300) : undefined;
    return { type: "kpi", label, value, ...(hint ? { hint } : {}) };
  }

  if (type === "link") {
    const label = asString(b.label ?? b.text, 200);
    const href = asString(b.href ?? b.url, 500);
    if (!label || !href) return null;
    return { type: "link", label, href };
  }

  return null;
}

function extractRawBlocks(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    if (parsed.length > 0 && parsed.every((b) => b && typeof b === "object" && "type" in (b as object))) {
      return parsed;
    }
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const o = parsed as Record<string, unknown>;
  const blocks = o.blocks;
  if (Array.isArray(blocks)) return blocks;
  if (o.content && typeof o.content === "object") {
    const inner = (o.content as Record<string, unknown>).blocks;
    if (Array.isArray(inner)) return inner;
  }
  return [];
}

/** Fix common Gemini JSON issues: trailing commas, smart quotes, literal newlines in strings. */
function repairGeminiJson(text: string): string {
  let s = text.trim();
  s = s.replace(/^\uFEFF/, "");
  s = s.replace(/[""]/g, '"').replace(/['']/g, "'");
  s = s.replace(/,\s*([}\]])/g, "$1");
  return s;
}

/** Escape literal newlines/tabs inside JSON string values so JSON.parse succeeds. */
function escapeLiteralNewlinesInJsonStrings(text: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      out += c;
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\n") {
        out += "\\n";
        continue;
      }
      if (c === "\r") continue;
      if (c === "\t") {
        out += "\\t";
        continue;
      }
    }
    out += c;
  }
  return out;
}

function tryParseJson(text: string): unknown | null {
  const attempts = [
    text,
    repairGeminiJson(text),
    escapeLiteralNewlinesInJsonStrings(text),
    escapeLiteralNewlinesInJsonStrings(repairGeminiJson(text)),
  ];
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      /* next */
    }
  }
  return null;
}

/** Extract complete block objects even from truncated or malformed JSON. */
function extractBlockObjectsFromText(text: string): unknown[] {
  const out: unknown[] = [];
  let searchFrom = 0;

  while (searchFrom < text.length) {
    const typeIdx = text.indexOf('"type"', searchFrom);
    if (typeIdx < 0) break;

    let start = typeIdx;
    while (start > 0 && text[start] !== "{") start--;
    if (text[start] !== "{") {
      searchFrom = typeIdx + 6;
      continue;
    }

    let depth = 0;
    let end = -1;
    let inString = false;
    let escape = false;

    for (let j = start; j < text.length; j++) {
      const c = text[j];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && inString) {
        escape = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === "{") depth++;
      if (c === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end < 0) break;

    const slice = text.slice(start, end + 1);
    const parsed = tryParseJson(slice);
    if (parsed && typeof parsed === "object" && blockType(parsed)) {
      out.push(parsed);
    }
    searchFrom = end + 1;
  }

  return out;
}

function normalizeRawBlocks(rawBlocks: unknown[]): AgentBlock[] {
  return rawBlocks
    .flatMap(expandRawBlock)
    .map(normalizeAgentBlock)
    .filter((b): b is AgentBlock => b !== null)
    .slice(0, 24);
}

function finalizeNormalizedBlocks(normalized: AgentBlock[]): AgentBlock[] {
  if (normalized.length === 0) return [];

  const validated = normalized.filter((b) => AgentBlockSchema.safeParse(b).success);
  if (validated.length > 0) return humanizeAgentBlocks(flattenNestedJsonMarkdown(validated));

  const response = AgentResponseSchema.safeParse({ blocks: normalized });
  if (response.success) return humanizeAgentBlocks(flattenNestedJsonMarkdown(response.data.blocks));

  return humanizeAgentBlocks(flattenNestedJsonMarkdown(normalized));
}

function looksLikeAgentJsonPayload(text: string): boolean {
  const t = text.trim();
  return (t.startsWith("{") || t.startsWith("[")) && t.includes('"blocks"');
}

export function isRawAgentJsonText(text: string): boolean {
  return looksLikeAgentJsonPayload(text);
}

function flattenNestedJsonMarkdown(blocks: AgentBlock[]): AgentBlock[] {
  const out: AgentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "markdown") {
      const t = block.content.trim();
      if (t.startsWith("{") && t.includes('"blocks"')) {
        const inner = parseAgentBlocksFromText(t);
        if (inner.length > 0) {
          out.push(...inner);
          continue;
        }
      }
    }
    out.push(block);
  }
  return out;
}

function expandRawBlock(raw: unknown): unknown[] {
  if (!raw || typeof raw !== "object") return [raw];
  const b = flattenGeminiBlock(raw as Record<string, unknown>);
  if (blockType(b) === "markdown") {
    const md =
      (typeof b.content === "string" ? b.content : null)
      ?? (typeof b.text === "string" ? b.text : null);
    if (md) {
      const t = md.trim();
      if (t.startsWith("{") && t.includes('"blocks"')) {
        try {
          const parsed = tryParseJson(extractJsonFromText(t));
          const inner = parsed ? extractRawBlocks(parsed) : [];
          if (inner.length > 0) return inner;
        } catch {
          /* keep original */
        }
      }
    }
  }
  return [b];
}

export function parseAgentBlocksFromText(text: string): AgentBlock[] {
  const jsonStr = extractJsonFromText(text);

  const parsed = tryParseJson(jsonStr);
  if (parsed) {
    const rawBlocks = extractRawBlocks(parsed);
    if (rawBlocks.length > 0) {
      const normalized = normalizeRawBlocks(rawBlocks);
      const finalized = finalizeNormalizedBlocks(normalized);
      if (finalized.length > 0) return finalized;
    }
  }

  const extracted = extractBlockObjectsFromText(jsonStr);
  if (extracted.length > 0) {
    const normalized = normalizeRawBlocks(extracted);
    const finalized = finalizeNormalizedBlocks(normalized);
    if (finalized.length > 0) return finalized;
  }

  const trimmed = text.trim();
  if (looksLikeAgentJsonPayload(trimmed)) {
    // Never show raw JSON to the user — partial blocks only.
    const partial = finalizeNormalizedBlocks(normalizeRawBlocks(extractBlockObjectsFromText(trimmed)));
    if (partial.length > 0) return partial;
    return humanizeAgentBlocks([
      {
        type: "markdown",
        content:
          "### Резюме\nОтговорът беше частично получен от модела.\n\n### Препоръки\nНатиснете **Regenerate** или задайте по-кратък въпрос.",
      },
    ]);
  }

  if (trimmed.length > 0) {
    return humanizeAgentBlocks([{ type: "markdown", content: trimmed.slice(0, 12000) }]);
  }
  return [];
}

function finalizeParsed(blocks: AgentBlock[]): AgentBlock[] {
  return humanizeAgentBlocks(coerceAgentBlocks(flattenNestedJsonMarkdown(blocks)));
}

function coerceAgentBlocks(blocks: AgentBlock[]): AgentBlock[] {
  return blocks
    .map((block) => normalizeAgentBlock(block))
    .filter((block): block is AgentBlock => block !== null);
}

/** Coerce DB/API shapes into a block array (handles double-wrap and string payloads). */
export function coerceBlocksInput(blocks: unknown): AgentBlock[] {
  if (!blocks) return [];
  if (typeof blocks === "string") return repairAgentBlocks(parseAgentBlocksFromText(blocks));
  if (Array.isArray(blocks)) {
    const normalized = blocks
      .map((b) => normalizeAgentBlock(b))
      .filter((b): b is AgentBlock => b !== null);
    if (normalized.length > 0) return normalized;
    return blocks as AgentBlock[];
  }
  if (typeof blocks === "object") {
    const nested = (blocks as { blocks?: unknown }).blocks;
    if (nested) return coerceBlocksInput(nested);
  }
  return [];
}

/** Fix legacy messages where the whole JSON payload was saved as one markdown block. */
export function repairAgentBlocks(blocks: AgentBlock[] | unknown): AgentBlock[] {
  const input = coerceBlocksInput(blocks);
  if (input.length === 0 && blocks) {
    const asText = typeof blocks === "string" ? blocks : JSON.stringify(blocks);
    if (looksLikeAgentJsonPayload(asText)) {
      const parsed = parseAgentBlocksFromText(asText);
      if (parsed.length > 0) return parsed;
    }
  }
  if (input.length === 0) return [];

  if (input.length === 1 && input[0].type === "markdown" && looksLikeAgentJsonPayload(input[0].content)) {
    const repaired = parseAgentBlocksFromText(input[0].content);
    if (repaired.length > 0 && !repaired.every((b) => b.type === "markdown" && looksLikeAgentJsonPayload(b.content))) {
      return repaired;
    }
  }

  const flattened = flattenNestedJsonMarkdown(input);
  const hasJsonMarkdown = flattened.some(
    (b) => b.type === "markdown" && looksLikeAgentJsonPayload(b.content),
  );
  if (hasJsonMarkdown) {
    const merged: AgentBlock[] = [];
    for (const block of flattened) {
      if (block.type === "markdown" && looksLikeAgentJsonPayload(block.content)) {
        merged.push(...parseAgentBlocksFromText(block.content));
      } else {
        merged.push(block);
      }
    }
    if (merged.length > 0) return finalizeParsed(merged);
  }

  return finalizeParsed(input);
}

export function finalizeAgentBlocks(blocks: AgentBlock[]): AgentBlock[] {
  const repaired = repairAgentBlocks(blocks);
  return repaired.length > 0 ? repaired : finalizeParsed(blocks);
}

/** Parse Gemini JSON/text into blocks; never persist raw JSON as visible markdown. */
export function blocksFromModelText(text: string): AgentBlock[] {
  const parsed = parseAgentBlocksFromText(text);
  const finalized = finalizeAgentBlocks(parsed);
  if (finalized.length > 0) return finalized;

  const trimmed = text.trim();
  if (trimmed.length > 0 && !looksLikeAgentJsonPayload(trimmed)) {
    return finalizeAgentBlocks([{ type: "markdown", content: trimmed.slice(0, 12000) }]);
  }
  return [];
}
