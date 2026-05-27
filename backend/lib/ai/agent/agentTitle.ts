import type { SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";
import { callGeminiAgent, extractTextFromParts, getCandidateParts } from "@/lib/ai/agent/geminiAgentClient";

export async function generateConversationTitle(userMessage: string): Promise<string> {
  const fallback = userMessage.trim().slice(0, 60) || "Нов разговор";
  try {
    const env = getEnv();
    if (!env.GEMINI_API_KEY || env.AI_ENABLED === false) return fallback;

    const { body } = await callGeminiAgent(
      env,
      [
        {
          role: "user",
          parts: [
            {
              text: `Генерирай кратко заглавие (макс 8 думи, български) за admin чат. Само заглавието, без кавички.\n\nВъпрос: ${userMessage.slice(0, 500)}`,
            },
          ],
        },
      ],
      { withTools: false, timeoutMs: 15000 },
    );
    const text = extractTextFromParts(getCandidateParts(body)).replace(/^["'«»]+|["'«»]+$/g, "").trim();
    return text.slice(0, 80) || fallback;
  } catch {
    return fallback;
  }
}

export async function loadCatalogSyncRow(db: SupabaseClient) {
  const { data } = await db.from("product_catalog_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}
