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
    task: z.literal("product_dimensions"),
    input: z.object({
      name: z.string().min(2).max(240),
      brandName: z.string().max(120).optional(),
      typeName: z.string().max(120).optional(),
      coolingPowerKw: z.number().nonnegative().optional(),
      heatingPowerKw: z.number().nonnegative().optional(),
    }),
  }),
  // Снимка на етикет на климатик → AI чете етикета + допълва пълна
  // продуктова спецификация по знания за модела. Един комбиниран call:
  // (1) OCR на видимия текст от етикета;
  // (2) lookup на размери/тегло/енергиен клас/SEER-SCOP по {марка, модел};
  // (3) confidence-маркер за всяко поле.
  z.object({
    task: z.literal("product_label_extract"),
    input: z.object({
      /** base64 без data: префикса. Максимум ~3 MB (валидно за inline_data). */
      imageBase64: z.string().min(64).max(5_000_000),
      /** image/jpeg или image/png; webp също се поддържа от Gemini. */
      imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      /** Кое тяло се снима — определя коя серия да се попълни. */
      whichUnit: z.enum(["indoor", "outdoor"]),
      /** Hint от вече попълнени полета (модел/марка) — повишава точността при втора снимка. */
      knownBrand: z.string().max(120).optional().nullable(),
      knownModel: z.string().max(120).optional().nullable(),
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
  // ============================================================
  // PRIVACY-NOTE: При `product_label_extract` идва base64 image.
  // Той СЕ ПОЛЗВА САМО за изграждане на Gemini заявката и НИКЪДЕ
  // не се персистира — нито в Cloudinary, нито в Supabase storage,
  // нито в audit лога. След като функцията върне, garbage-collect-ва
  // се заедно с request body-то. В лога записваме само името на
  // task-а и token usage, без никакви raw данни.
  // ============================================================
  const imagePart =
    parsed.data.task === "product_label_extract"
      ? { mimeType: parsed.data.input.imageMimeType, base64: parsed.data.input.imageBase64 }
      : undefined;
  const result = await callGemini(env, prompt, imagePart);

  await logAdminActivity({
    action: `ai.${parsed.data.task}`,
    entityType: "ai",
    // Внимание: НЕ включваме image base64 или OCR raw text — само метаданни.
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

  if (payload.task === "product_dimensions") {
    return [
      "Ти си експерт по технически спецификации на климатици.",
      "Задачата е: за подадения модел климатик да върнеш ТОЧНИ физически размери и тегло на вътрешния и външния блок, така както са в официалната техническа спецификация (datasheet, brochure, ръководство) на производителя.",
      "",
      "ВАЖНИ ПРАВИЛА:",
      "1. Връщай ТОЧНО числови стойности — не приближения, не диапазони. Размерите са в милиметри (mm), теглото в килограми (kg, до 1 знак след запетаята).",
      "2. ВЪТРЕШЕН БЛОК: за стенен климатик обикновено е плосък и широк → Дължина (ширината по фасадата) > Височина > Ширина (дълбочината). За касетъчен е квадратен (Д ≈ Ш).",
      "3. ВЪНШЕН БЛОК: обикновено Височина е най-голяма за по-мощни модели (1000+ mm), за по-малки — около 540-600 mm. Дълбочината (Ширина) е най-малката страна.",
      "4. Ако НЕ си сигурен в конкретна стойност (модела не ти е известен със сигурност или конфигурацията е променлива), върни null за това поле. По-добре null отколкото грешно число.",
      "5. Ако моделът съществува в множество подварианти (R32 vs R410A, EUR vs JPN), използвай последния европейски (EUR) вариант с R-32.",
      "6. confidence: \"high\" = сигурен от каталога; \"medium\" = от родов модел; \"low\" = предположение; \"none\" = не знаеш.",
      "",
      "Върни САМО валиден JSON без markdown:",
      `{"weight_indoor_kg": <число или null>, "weight_outdoor_kg": <число или null>, "dim_indoor_length_mm": <int или null>, "dim_indoor_width_mm": <int или null>, "dim_indoor_height_mm": <int или null>, "dim_outdoor_length_mm": <int или null>, "dim_outdoor_width_mm": <int или null>, "dim_outdoor_height_mm": <int или null>, "source": "<кратка бележка откъде/как си определил, до 120 знака>", "confidence": "high"|"medium"|"low"|"none"}`,
      "",
      `Вход: ${JSON.stringify(payload.input)}`,
    ].join("\n");
  }

  if (payload.task === "product_label_extract") {
    const { whichUnit, knownBrand, knownModel } = payload.input;
    const unitLabel = whichUnit === "indoor" ? "ВЪТРЕШНОТО тяло" : "ВЪНШНОТО тяло";
    const serialField = whichUnit === "indoor" ? "indoor_unit_serial" : "outdoor_unit_serial";
    const otherSerialField = whichUnit === "indoor" ? "outdoor_unit_serial" : "indoor_unit_serial";
    const hints: string[] = [];
    if (knownBrand) hints.push(`Вече известна марка: ${knownBrand}`);
    if (knownModel) hints.push(`Вече известен модел: ${knownModel}`);
    return [
      "Ти си експерт по техническите спецификации на климатици.",
      `Анализираш снимка на ОРИГИНАЛЕН ЕТИКЕТ от ${unitLabel} на климатик (от завода/производителя).`,
      "",
      "ЗАДАЧАТА Е В ДВЕ ЧАСТИ:",
      "",
      "ЧАСТ 1 — РАЗЧИТАНЕ НА ЕТИКЕТА (само това, което виждаш на снимката):",
      "  • Марка (Daikin, Mitsubishi, Toshiba, Panasonic, Fujitsu, LG, Samsung, Haier, Hisense, Gree, Midea и т.н.).",
      "  • Точен модел (model code, напр. „FTXA50AW“, „MSZ-LN50VG“). Запиши го ТОЧНО както е на етикета (главни/малки букви, цифри, тирета).",
      "  • Сериен номер (Serial No., S/N) — ПЪЛЕН низ от етикета. Често е 8-15 цифри/букви.",
      "  • Хладилен агент (R-32, R-410A, R-290 и т.н.).",
      "  • Количество хладилен агент в грамове (Refrigerant charge, „kg“ или „g“).",
      "  • Електрическо захранване (Voltage, Hz, напр. „220-240V ~ 50Hz“).",
      "  • Година на производство (manufacture date, ако е видна).",
      "  • Cooling/Heating capacity в kW (ако фигурират на етикета).",
      "",
      "ЧАСТ 2 — ПЪЛНА СПЕЦИФИКАЦИЯ ПО МОДЕЛА (от знанията ти, не от снимката):",
      "  Имайки марката + модела, върни ТОЧНИ стойности от каталога/брошурата на производителя:",
      "  • Cooling/Heating power (kW), енергиен клас (cool/heat), SEER, SCOP, гаранция (месеци).",
      "  • Размери (mm) и тегло (kg) — ОТДЕЛНО за вътрешен и външен блок.",
      "  • WiFi (вграден модул) — true/false.",
      "  • Препоръчителна площ (m²), ниво на шум (dB).",
      "",
      "ВАЖНИ ПРАВИЛА:",
      `1. Серийният номер ВИНАГИ върни в полето "${serialField}" (защото снимаме точно ${unitLabel}). НЕ попълвай "${otherSerialField}".`,
      "2. Ако не виждаш или не си сигурен в дадена стойност — върни null (НЕ нула, НЕ празен string).",
      "3. За model code: ако имаш съмнение, добави и алтернативния вариант в \"alt_model_codes\" (array).",
      "4. confidence_label = качеството на разчитането от снимката („high“ = ясни цифри/букви; „medium“ = малко замазани; „low“ = трудно четим; „none“ = не виждаш етикет).",
      "5. confidence_specs = доколко си сигурен в спецификациите от знанията си („high“ = известен модел в каталога; „medium“ = от родов модел/семейство; „low“ = предположение; „none“ = неизвестен).",
      "6. source = откъде си взел спецификациите — кратко (до 120 знака), напр. „Daikin Stylish R32 каталог 2023“.",
      "",
      ...(hints.length > 0 ? [`HINT: ${hints.join("; ")}`, ""] : []),
      "Върни САМО валиден JSON без markdown, със следната структура:",
      `{
  "from_label": {
    "brand_hint": "<string или null>",
    "model_code": "<string или null>",
    "alt_model_codes": ["..."] ,
    "${serialField}": "<string или null>",
    "refrigerant": "<string или null>",
    "refrigerant_amount_g": <number или null>,
    "voltage": "<string или null>",
    "manufacture_year": <number или null>
  },
  "model_specs": {
    "coverage_m2": <number или null>,
    "noise_db": <number или null>,
    "cooling_power_kw": <number или null>,
    "heating_power_kw": <number или null>,
    "energy_class_cool": "<string или null>",
    "energy_class_heat": "<string или null>",
    "seer": <number или null>,
    "scop": <number или null>,
    "warranty_months": <int или null>,
    "wifi": <boolean или null>,
    "weight_indoor_kg": <number или null>,
    "weight_outdoor_kg": <number или null>,
    "dim_indoor_length_mm": <int или null>,
    "dim_indoor_width_mm": <int или null>,
    "dim_indoor_height_mm": <int или null>,
    "dim_outdoor_length_mm": <int или null>,
    "dim_outdoor_width_mm": <int или null>,
    "dim_outdoor_height_mm": <int или null>
  },
  "confidence_label": "high"|"medium"|"low"|"none",
  "confidence_specs": "high"|"medium"|"low"|"none",
  "source": "<кратка бележка до 120 знака>",
  "warnings": ["..."]
}`,
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

async function callGemini(
  env: ReturnType<typeof getEnv>,
  prompt: string,
  image?: { mimeType: string; base64: string },
) {
  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;
  type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
  const parts: Part[] = [{ text: prompt }];
  if (image) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
  }
  // По-висок tokens budget при image задачи — комбинираният JSON е по-голям.
  const baseTokens = image ? 3200 : 1600;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: image ? 0.15 : 0.25,
        maxOutputTokens: Math.min(env.AI_MAX_OUTPUT_TOKENS ?? baseTokens, image ? 4096 : 2200),
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
