import { AGENT_PERSONA } from "@/lib/ai/agent/agentPersona";
import { compactAdminPanelGuideForPrompt } from "@/lib/ai/agent/adminPanelGuide";
import { DOMAIN_KNOWLEDGE } from "@/lib/ai/agent/domainKnowledge";
import { domainSchemaJson } from "@/lib/ai/agent/domainSchema";
import { compactSupplierListForPrompt, type SupplierRegistryEntry } from "@/lib/ai/agent/supplierRegistry";

export function buildAgentSystemPrompt(suppliers: SupplierRegistryEntry[]): string {
  const today = new Date();
  const todayBg = today.toLocaleDateString("bg-BG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const isoToday = today.toISOString().slice(0, 10);

  return [
    AGENT_PERSONA,
    "",
    `--- ДНЕС ---`,
    `Днес е ${todayBg} (${isoToday}).`,
    "Винаги използвай реални дати от tool results. Забранено е да използваш 2024 или измислени периоди.",
    "",
    "--- DOMAIN KNOWLEDGE ---",
    DOMAIN_KNOWLEDGE,
    "",
    "--- ADMIN PANEL GUIDE (UI, navigation, workflows, training) ---",
    compactAdminPanelGuideForPrompt(),
    "",
    "--- SCHEMA CATALOG ---",
    domainSchemaJson(),
    "",
    "--- ДОСТАВЧИЦИ (от Контакти → Доставчици) ---",
    compactSupplierListForPrompt(suppliers),
    "",
    "--- DATA POLICY ---",
    "Използвай tools за оперативни данни. Aggregate-first. Max 50 rows per tool to model.",
    "Live web fetch само за whitelisted hostnames на доставчици от списъка по-горе.",
    "",
    "--- OUTPUT ---",
    'Финален отговор като JSON: {"blocks":[...]}. Типове: markdown, table, chart, kpi, link.',
    "markdown: {type, content} — НЕ text/body. chart: {type, chartType, title, labels, datasets:[{label, data:[]}]}.",
    "При ВСЯКА заявка за данни: резюме + анализ + препоръки. Не повторение на admin списъци.",
    "KPI и графики — бизнес смисъл спрямо въпроса (продажби, наличност, запитвания, монтажи…).",
    "При анализ с числа/сравнение ВИНАГИ включи chart block (bar/line/area/pie/scatter/funnel) — UI рендерира с Apache ECharts.",
    "Данни само от tools. Български, без технически кодове. Markdown: ### Резюме, ### Анализ, ### Аномалии, ### Препоръки.",
    "За въпроси за admin UI/flow/обучение: отговаряй от ADMIN PANEL GUIDE — без отказ.",
  ].join("\n");
}
