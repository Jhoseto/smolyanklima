import { AGENT_PERSONA } from "@/lib/ai/agent/agentPersona";
import { DOMAIN_KNOWLEDGE } from "@/lib/ai/agent/domainKnowledge";
import { domainSchemaJson } from "@/lib/ai/agent/domainSchema";
import { compactSupplierListForPrompt, type SupplierRegistryEntry } from "@/lib/ai/agent/supplierRegistry";

export function buildAgentSystemPrompt(suppliers: SupplierRegistryEntry[]): string {
  return [
    AGENT_PERSONA,
    "",
    "--- DOMAIN KNOWLEDGE ---",
    DOMAIN_KNOWLEDGE,
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
    'Финален отговор като JSON: {"blocks":[...]} с type: markdown|table|chart|kpi|link.',
  ].join("\n");
}
