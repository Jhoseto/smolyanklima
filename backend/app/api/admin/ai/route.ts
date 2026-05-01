import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { getEnv } from "@/lib/env";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const RequestSchema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("product_draft"),
    input: z.object({
      name: z.string().min(2).max(240),
      brandName: z.string().max(120).optional(),
      typeName: z.string().max(120).optional(),
      condition: z.enum(["new", "used"]).optional(),
      price: z.number().nonnegative().optional(),
      currentDescription: z.string().max(5000).optional(),
      specs: z.record(z.string(), z.string().or(z.boolean()).or(z.number()).or(z.null())).optional(),
    }),
  }),
  z.object({
    task: z.literal("inquiry_reply"),
    input: z.object({
      customerName: z.string().max(160),
      customerPhone: z.string().max(80).optional().nullable(),
      customerEmail: z.string().max(200).optional().nullable(),
      serviceType: z.string().max(160).optional().nullable(),
      message: z.string().max(5000).optional().nullable(),
    }),
  }),
  z.object({
    task: z.literal("contact_summary"),
    input: z.object({
      contactName: z.string().max(200),
      phone: z.string().max(80).optional().nullable(),
      email: z.string().max(200).optional().nullable(),
      notes: z.string().max(4000).optional().nullable(),
      history: z.array(z.record(z.string(), z.unknown())).max(30).optional(),
    }),
  }),
]);

export async function POST(req: NextRequest) {
  const env = getEnv();
  if (env.AI_ENABLED === false) return NextResponse.json({ error: "AI_DISABLED" }, { status: 403 });
  if (!env.GEMINI_API_KEY) return NextResponse.json({ error: "AI_MISCONFIGURED" }, { status: 503 });

  // Auth guard: adminDb validates the current Supabase user and active admin row.
  await adminDb();

  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST", details: parsed.error.flatten() }, { status: 400 });
  }

  const prompt = buildPrompt(parsed.data);
  const result = await callGemini(env, prompt);

  await logAdminActivity({
    action: `ai.${parsed.data.task}`,
    entityType: "ai",
    details: { task: parsed.data.task, usage: result.usage },
  });

  return NextResponse.json({ data: result.data, usage: result.usage });
}

function buildPrompt(payload: z.infer<typeof RequestSchema>) {
  if (payload.task === "product_draft") {
    return [
      "Ти си асистент за български онлайн магазин за климатици.",
      "Върни САМО валиден JSON без markdown.",
      "Структура:",
      `{"slug":"latin-url-slug","description":"кратко продаващо описание на български до 900 символа","specs":{"coverage_m2":"","cooling_power_kw":"","heating_power_kw":"","energy_class_cool":"","energy_class_heat":"","seer":"","scop":"","wifi":false,"refrigerant":"","warranty_months":""}}`,
      "Не измисляй технически стойности, ако не личат от името или входните данни. Остави празен string за неизвестно.",
      `Вход: ${JSON.stringify(payload.input)}`,
    ].join("\n");
  }

  if (payload.task === "inquiry_reply") {
    return [
      "Ти си админ асистент за магазин за климатици в България.",
      "Върни САМО валиден JSON без markdown.",
      `{"reply":"кратка учтива чернова за отговор на клиента","internalNote":"1-2 изречения вътрешна бележка","priority":"low|medium|high"}`,
      "Не обещавай цени/срокове, ако не са подадени. Насочи към телефонен контакт/оглед при нужда.",
      `Вход: ${JSON.stringify(payload.input)}`,
    ].join("\n");
  }

  return [
    "Ти си CRM асистент за магазин за климатици.",
    "Върни САМО валиден JSON без markdown.",
    `{"summary":"кратко резюме на клиента","nextAction":"конкретно следващо действие"}`,
    "Не измисляй факти извън подадената история.",
    `Вход: ${JSON.stringify(payload.input)}`,
  ].join("\n");
}

async function callGemini(env: ReturnType<typeof getEnv>, prompt: string) {
  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: Math.min(env.AI_MAX_OUTPUT_TOKENS ?? 1600, 2200),
        responseMimeType: "application/json",
      },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gemini upstream error ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }

  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return {
    data,
    usage: {
      promptTokens: body?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: body?.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: body?.usageMetadata?.totalTokenCount ?? 0,
      model,
    },
  };
}
