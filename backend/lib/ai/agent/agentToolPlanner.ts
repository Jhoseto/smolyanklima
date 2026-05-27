import type { getEnv } from "@/lib/env";
import type { AutoToolPlan } from "@/lib/ai/agent/agentAutoTools";
import { prefetchToolKey } from "@/lib/ai/agent/agentAutoTools";
import { getAgentFunctionDeclarations } from "@/lib/ai/agent/agentTools";

const PLANNER_ALLOWED = new Set([
  "get_dashboard_summary",
  "query_products",
  "query_work_items",
  "query_inquiries",
  "query_contacts",
  "aggregate_sales",
  "aggregate_inventory",
  "query_activity_logs",
  "query_ratings_summary",
  "query_suppliers",
  "query_supplier_orders",
  "query_accessories",
  "query_articles",
  "query_live_chats",
  "query_service_protocols",
  "query_email_outbox",
  "query_staff",
  "query_settings",
  "query_newsletter",
  "get_supplier_sync_status",
  "lookup_product_at_supplier",
]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function toolCatalogForPlanner(env: ReturnType<typeof getEnv>): string {
  return getAgentFunctionDeclarations(env)
    .filter((t) => PLANNER_ALLOWED.has(t.name))
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");
}

export function shouldUseGeminiToolPlanner(
  env: ReturnType<typeof getEnv>,
  regexPlans: AutoToolPlan[],
): boolean {
  if (env.AI_AGENT_GEMINI_TOOL_PLANNER === false) return false;
  if (regexPlans.length === 0) return true;
  if (regexPlans.length === 1 && regexPlans[0].name === "get_dashboard_summary") return true;
  return false;
}

export function mergeToolPlans(base: AutoToolPlan[], extra: AutoToolPlan[], max: number): AutoToolPlan[] {
  const seen = new Set<string>();
  const out: AutoToolPlan[] = [];
  for (const plan of [...base, ...extra]) {
    const key = prefetchToolKey(plan.name, plan.args);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(plan);
    if (out.length >= max) break;
  }
  return out;
}

/** Gemini Flash picks tools when regex heuristics are weak. */
export async function geminiPlanTools(
  env: ReturnType<typeof getEnv>,
  message: string,
  signal?: AbortSignal,
): Promise<AutoToolPlan[]> {
  if (!env.GEMINI_API_KEY) return [];

  const model = env.GEMINI_AGENT_MODEL ?? env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const prompt = [
    "Избери 1–4 admin tools за въпроса. Върни САМО JSON: {\"tools\":[{\"name\":\"...\",\"args\":{}}]}",
    "args: from/to ISO (YYYY-MM-DD), limit, status, eventCode, aggregate, q — само когато са нужни.",
    `Днес: ${todayIso()}. Типичен период седмица: from=${isoDaysAgo(7)}, to=${todayIso()}.`,
    "",
    "Tools:",
    toolCatalogForPlanner(env),
    "",
    `Въпрос: ${message.slice(0, 600)}`,
  ].join("\n");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  signal?.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return [];

    const parts = (body.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0]
      ?.content?.parts;
    const text = parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) return [];

    const parsed = JSON.parse(text) as { tools?: Array<{ name?: string; args?: Record<string, unknown> }> };
    const tools = parsed.tools ?? [];
    const out: AutoToolPlan[] = [];
    for (const entry of tools) {
      const name = String(entry.name ?? "").trim();
      if (!PLANNER_ALLOWED.has(name)) continue;
      out.push({ name, args: entry.args && typeof entry.args === "object" ? entry.args : {} });
      if (out.length >= 4) break;
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", () => controller.abort());
  }
}
