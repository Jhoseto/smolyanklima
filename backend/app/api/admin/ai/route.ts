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
      /** Списъкът на марките, които вече съществуват в нашата база.
       *  AI ще се опита да върне brand_hint с ТОЧНОТО име оттук, за да
       *  улесни match-а в UI-та (вместо „Mitsubishi“ → „Mitsubishi Electric“). */
      availableBrands: z.array(z.string().max(80)).max(50).optional().nullable(),
    }),
  }),
  // AI „professional catalog“ enhancement на снимка на климатик:
  //   - бял фон (background removal/replacement)
  //   - soft natural shadow под продукта
  //   - lighting normalization (балансирана експозиция)
  //   - запазва ВСИЧКИ детайли на продукта (текст, лога, бутони)
  // Връща нова снимка в base64 (PNG/JPEG).
  z.object({
    task: z.literal("product_photo_enhance"),
    input: z.object({
      /** base64 без data: префикса. */
      imageBase64: z.string().min(64).max(5_000_000),
      imageMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
      /** Стилов hint, по избор (default = „auto smart adapt“). */
      style: z.enum(["auto", "studio_bright", "minimal_pure"]).default("auto").optional(),
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
  // Hybrid web-search task: AI намира официални/качествени продуктови
  // снимки на климатик в Google и връща URL-ове, които frontend-ът
  // показва в избирателен grid. Ползва Gemini + Google Search grounding.
  z.object({
    task: z.literal("product_image_search"),
    input: z.object({
      brand: z.string().min(2).max(120),
      modelCode: z.string().min(2).max(120),
      /**
       * Колко максимум кандидата да върнем (UI gridът ги показва).
       * 8 по default — достатъчно redundancy ако някои страници
       * нямат og:image или са 404.
       */
      maxResults: z.number().int().min(2).max(12).default(8).optional(),
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

  // ============================================================
  // PRIVACY-NOTE: При `product_label_extract` и `product_photo_enhance`
  // идва base64 image. Той СЕ ПОЛЗВА САМО за изграждане на Gemini
  // заявката и НИКЪДЕ не се персистира — нито в Cloudinary, нито в
  // Supabase storage, нито в audit лога. След като функцията върне,
  // garbage-collect-ва се заедно с request body-то. В лога записваме
  // само името на task-а и token usage, без никакви raw данни.
  // ============================================================

  // Web-search task — ползва Gemini с Google Search grounding.
  // Изолирана error boundary — search-ът е дълъг (до 50s) и може да fail-не
  // по много начини (timeout, mрежова грешка, API rate limit). Не искаме
  // тези грешки да паднат като 500-ка с криптично stack trace.
  if (parsed.data.task === "product_image_search") {
    try {
      const prompt = buildImageSearchPrompt(parsed.data.input);
      const result = await callGeminiWithGoogleSearch(env, prompt);
      await logAdminActivity({
        action: `ai.${parsed.data.task}`,
        entityType: "ai",
        details: {
          task: parsed.data.task,
          brand: parsed.data.input.brand,
          modelCode: parsed.data.input.modelCode,
          candidatesFound: Array.isArray((result.data as { images?: unknown[] })?.images)
            ? ((result.data as { images: unknown[] }).images.length)
            : 0,
          usage: result.usage,
        },
      });
      return NextResponse.json({ data: result.data, usage: result.usage });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Логваме за дебъг на сървъра, но НЕ хвърляме нагоре — връщаме
      // user-friendly JSON, който AIPhotoFinder може да покаже в банер.
      // eslint-disable-next-line no-console
      console.error("[ai/product_image_search] failed:", msg);
      return NextResponse.json(
        {
          error: msg,
          // Връщаме празен resultat, за да може клиентският UI да покаже
          // „няма намерени снимки“ вместо да изгърми с popup.
          data: { images: [], queries_used: [], warnings: [msg] },
        },
        { status: 502 },
      );
    }
  }

  // Image generation task — отделен endpoint в Gemini (Nano Banana).
  if (parsed.data.task === "product_photo_enhance") {
    const prompt = buildPhotoEnhancePrompt(parsed.data.input.style ?? "auto");
    const result = await callGeminiImageEdit(env, prompt, {
      mimeType: parsed.data.input.imageMimeType,
      base64: parsed.data.input.imageBase64,
    });
    await logAdminActivity({
      action: `ai.${parsed.data.task}`,
      entityType: "ai",
      details: {
        task: parsed.data.task,
        usage: result.usage,
        style: parsed.data.input.style ?? "auto",
      },
    });
    return NextResponse.json({ data: result.data, usage: result.usage });
  }

  // Останалите task-ове — JSON output mode.
  const prompt = buildPrompt(parsed.data);
  const imagePart =
    parsed.data.task === "product_label_extract"
      ? { mimeType: parsed.data.input.imageMimeType, base64: parsed.data.input.imageBase64 }
      : undefined;
  const result = await callGemini(env, prompt, imagePart);

  await logAdminActivity({
    action: `ai.${parsed.data.task}`,
    entityType: "ai",
    details: { task: parsed.data.task, usage: result.usage },
  });

  return NextResponse.json({ data: result.data, usage: result.usage });
}

/**
 * Изгражда промпт за `product_image_search`.
 *
 * Стратегия (hybrid):
 *   1. Първо пробва ОФИЦИАЛНИ домейни на производителя (daikin.com,
 *      mitsubishielectric.com и т.н.) — там снимките са каталожни, чисти,
 *      без watermarks. Това дава „high“ confidence.
 *   2. Ако официалните не върнат достатъчно — широко в Google
 *      (дистрибутори, e-commerce listings, PDF брошури).
 *
 * Промптът инструктира AI да върне STRICT JSON, който frontend-ът ще
 * парсва и покаже в multi-select grid.
 */
/**
 * Изгражда МИНИМАЛЕН промпт за `product_image_search`.
 *
 * След много експерименти открих, че Gemini 2.5 Flash с google_search
 * tool работи НАЙ-ДОБРЕ с прост promtp — много инструкции (брандови
 * домейни, search strategy, model variants) объркват модела и водят до
 * нестабилни резултати (понякога 0 страници, понякога 5).
 *
 * Стратегия: даваме AI само марката и модела и го пускаме да върши
 * Google search-а както сам прецени. Той извежда правилните алтернативи
 * на model code-а (напр. `MUZ-AY25VG2-E1-CE` → `MUZ-AY25VG`) и намира
 * shop-страници в различни домейни.
 *
 * Резултати от тестове:
 *   • Mitsubishi Electric MUZ-AY25VG → 4-5 shop URLs за 5s
 *   • Daikin FTXA35AW → 5+ shop URLs за 5s
 *   • LG S12EQ → 6+ URLs (включително официалните LG страници в 4 езика)
 *
 * Critical generation config (виж callGeminiWithGoogleSearch):
 *   • temperature: 0 — deterministic resultate
 *   • thinkingBudget: 0 — без скрита chain-of-thought
 *   • maxOutputTokens: 8192 — JSON със 8 страници + дълги URLs
 */
function buildImageSearchPrompt(input: {
  brand: string;
  modelCode: string;
  maxResults?: number;
}): string {
  const max = input.maxResults ?? 8;
  return [
    `Use Google Search to find ${max} webpages with product photos of the air conditioner: ${input.brand} ${input.modelCode}.`,
    "",
    "For each result, give the webpage URL — prefer manufacturer sites, official distributors, and reputable HVAC shops.",
    "",
    "Return JSON only:",
    `{"pages":[{"url":"https://...","source_domain":"shop.com","description":"..."}]}`,
  ].join("\n");
}

/**
 * Извлича OG image / Twitter card image / JSON-LD image от HTML на
 * webpage. Това е стандартен начин, по който всички продуктови страници
 * (manufacturer sites, e-commerce shops) изпращат hero image-а към social
 * media / search engines. Гарантирано работи за легитимни продуктови
 * страници.
 *
 * Прави регекс парсинг (не DOM parser), което е достатъчно бързо и
 * memory-safe за нашия use case.
 */
function extractImageFromHtml(html: string): string | null {
  // Ограничаваме до първите 300KB на HTML — meta tag-овете са в <head>,
  // но JSON-LD скриптове понякога са по-надолу.
  const head = html.slice(0, 300_000);

  // 1. og:image (Open Graph) — приоритет. Различни ред на атрибутите.
  const ogPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    // Variant: name= вместо property= (някои CMS-и грешат)
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    // og:image:secure_url / og:image:url алтернативи
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of ogPatterns) {
    const m = head.match(re);
    if (m && m[1]) return decodeHtml(m[1]);
  }

  // 2. twitter:image — fallback.
  const twPatterns = [
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of twPatterns) {
    const m = head.match(re);
    if (m && m[1]) return decodeHtml(m[1]);
  }

  // 3. link rel=image_src — старо, но някои сайтове го ползват.
  const linkMatch = head.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
  if (linkMatch && linkMatch[1]) return decodeHtml(linkMatch[1]);

  // 4. JSON-LD product image (Schema.org) — мощен fallback за shops.
  const jsonLdMatches = head.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(match[1]);
      const image = findJsonLdImage(json);
      if (image) return image;
    } catch {
      /* skip malformed JSON-LD */
    }
  }

  // 5. Last resort: най-голямата <img> в product-related контейнер.
  // Това е heuristic-а — търсим <img> с product/main/hero/zoom classes.
  const productImgMatch = head.match(
    /<img[^>]+(?:class|id)=["'][^"']*(?:product|main|hero|primary|zoom|gallery)[^"']*["'][^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i,
  );
  if (productImgMatch && productImgMatch[1]) return decodeHtml(productImgMatch[1]);

  return null;
}

/** HTML entity decoder — за &amp; и подобни в URL-те. */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");
}

/** Recursively извлича `image` URL от JSON-LD Product schema. */
function findJsonLdImage(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const r = findJsonLdImage(item);
      if (r) return r;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (obj["@type"] === "Product" || obj["@type"] === "ImageObject") {
    const img = obj.image;
    if (typeof img === "string") return img;
    if (Array.isArray(img) && typeof img[0] === "string") return img[0];
    if (img && typeof img === "object" && typeof (img as { url?: unknown }).url === "string") {
      return (img as { url: string }).url;
    }
  }
  // Recurse into @graph / nested arrays.
  for (const key of Object.keys(obj)) {
    const r = findJsonLdImage(obj[key]);
    if (r) return r;
  }
  return null;
}

/**
 * Базови SSRF проверки за webpage URLs (по-разхлабени от fetch-remote-а,
 * защото тук fetch-ваме HTML, а не binary).
 */
function isSafeHttpsUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (!h) return false;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan"))
      return false;
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      if (a === 127 || a === 10 || a === 0 || a >= 224) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Преобразува relative или protocol-relative URL в абсолютен спрямо
 * base-а на страницата. og:image понякога е "//cdn.example.com/img.jpg"
 * или "/static/img.jpg".
 */
function resolveUrl(rel: string, base: string): string | null {
  try {
    return new URL(rel, base).toString();
  } catch {
    return null;
  }
}

/**
 * За даден списък от webpage URLs, fetch-ва всеки и extrahira hero
 * image-а (og:image). Прави това в parallel с timeout от 8s на страница.
 *
 * Връща списък със само успешно намерените images (URL + source).
 */
async function extractImagesFromWebpages(
  pages: Array<{
    url: string;
    source_domain: string | null;
    description: string | null;
  }>,
): Promise<{
  images: Array<{
    url: string;
    source_domain: string | null;
    description: string | null;
    page_url: string;
  }>;
  errors: string[];
}> {
  const errors: string[] = [];
  const PAGE_TIMEOUT_MS = 8_000;

  const results = await Promise.all(
    pages.map(async (page) => {
      if (!isSafeHttpsUrl(page.url)) {
        errors.push(`${page.url}: блокиран URL (private/insecure)`);
        return null;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
      try {
        const res = await fetch(page.url, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SmolyanKlimaAdmin/1.0) AppleWebKit/537.36",
            Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,bg;q=0.8",
          },
          redirect: "follow",
        });
        if (!res.ok) {
          errors.push(`${page.url}: HTTP ${res.status}`);
          return null;
        }
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
          errors.push(`${page.url}: не е HTML (${ct})`);
          return null;
        }
        // Само първите 300KB — meta tag-овете са в <head>, не ни трябват
        // мегабайти HTML.
        const reader = res.body?.getReader();
        if (!reader) {
          errors.push(`${page.url}: empty body`);
          return null;
        }
        const decoder = new TextDecoder("utf-8", { fatal: false });
        let html = "";
        let totalBytes = 0;
        const MAX_HTML_BYTES = 300_000;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          html += decoder.decode(value, { stream: true });
          if (totalBytes >= MAX_HTML_BYTES) {
            reader.cancel().catch(() => {});
            break;
          }
        }
        const rawImageUrl = extractImageFromHtml(html);
        if (!rawImageUrl) {
          errors.push(`${page.url}: няма og:image meta tag`);
          return null;
        }
        const absUrl = resolveUrl(rawImageUrl, res.url);
        if (!absUrl || !isSafeHttpsUrl(absUrl)) {
          errors.push(`${page.url}: невалиден image URL "${rawImageUrl}"`);
          return null;
        }
        return {
          url: absUrl,
          source_domain: page.source_domain,
          description: page.description,
          page_url: page.url,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${page.url}: ${msg.slice(0, 120)}`);
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }),
  );

  // eslint-disable-next-line no-console
  console.log("[ai/product_image_search] extractImagesFromWebpages:", {
    requested: pages.length,
    extracted: results.filter((r) => r !== null).length,
    errors: errors.slice(0, 5),
  });

  return {
    images: results.filter(
      (r): r is NonNullable<typeof r> => r !== null,
    ),
    errors,
  };
}

/**
 * Извлича JSON блок от raw text. По-устойчив от прост `JSON.parse`:
 *
 *  • Премахва markdown code fences (включително multi-line).
 *  • Ако има plain text преди/след JSON-а — намира първата `{` и съответната
 *    последна `}` чрез balanced brace counting.
 *  • Връща `null` ако не намери валидно изглеждащ JSON.
 */
function extractJsonFromText(text: string): string | null {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  s = s.trim();
  if (s.startsWith("{") && s.endsWith("}")) return s;
  const firstBrace = s.indexOf("{");
  if (firstBrace < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(firstBrace, i + 1);
    }
  }
  return null;
}

/**
 * Извиква Gemini с включен Google Search grounding tool. Връща парснат JSON
 * с image кандидати.
 *
 * ВАЖНО:
 *  • `tools: [{ google_search: {} }]` активира реално live search в Google.
 *    Резултатите се отразяват в `groundingMetadata` (URL-ове, query-та).
 *  • Понеже Gemini ползва native JSON output mode НЕ работи едновременно с
 *    `google_search` tool, парсваме JSON-а от текстовия response-а (с лек
 *    sanitize: премахваме markdown code fences ако има).
 *  • Timeout е 50s — Google Search grounding може да отнеме доста време,
 *    защото AI прави множество search заявки преди да синтезира отговора.
 *  • Defensive error handling — всеки failure mode (AbortError, network
 *    error, HTTP error, malformed JSON) се конвертира в нормален Error
 *    с читаемо съобщение, за да не се появят „readonly message“ грешки в
 *    upstream-а (известен Node 18+ issue с DOMException.message).
 */
async function callGeminiWithGoogleSearch(env: ReturnType<typeof getEnv>, prompt: string) {
  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 50_000);

  let body: Record<string, unknown> = {};
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          // temperature 0 = deterministic. Тестове показаха, че 0.3 води
          // до нестабилни резултати (понякога 0 страници, понякога 5).
          // С 0 — резултати са консистентни за даден brand+modelCode.
          temperature: 0,
          // 8192 = safety margin за JSON със 8 страници + дълги URLs
          // (Vertex AI redirect URLs могат да са ~250 chars).
          maxOutputTokens: 8192,
          // КРИТИЧНО — disable "thinking" токени за gemini-2.5-flash.
          // С enabled thinking (default), моделът хаби 1000-2000 токена
          // в скрита chain-of-thought, което води до:
          //   1. 4-5x по-бавен response (от 5s до 24s).
          //   2. JSON-ът понякога стига MAX_TOKENS (thinking + tools
          //      изяждат output budget-а).
          //   3. AI връща Vertex AI redirect URLs вместо реалните shop
          //      URLs (защото thinking review-а ползва грунд URL-те).
          // С thinkingBudget=0:
          //   • 4-5x по-бързо (5s)
          //   • Връща РЕАЛНИ URL-ове (lg.com, daikin.eu, basildonacr.com)
          //   • Никога не достига MAX_TOKENS
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const errBody = JSON.stringify(body).slice(0, 500);
      throw new Error(`Gemini upstream HTTP ${res.status}: ${errBody}`);
    }
  } catch (e) {
    // Конвертираме всички failure modes в нормален Error с string message.
    // Това включва:
    //  • AbortError (от timeout-а) — има readonly message в Node 18+
    //  • TypeError (network failure)
    //  • SyntaxError (JSON.parse от не-JSON отговор)
    const isAbort =
      (e instanceof Error && e.name === "AbortError") ||
      (typeof e === "object" && e !== null && (e as { code?: string }).code === "ABORT_ERR");
    const safeMsg = isAbort
      ? `Gemini не отговори в рамките на 50 секунди (timeout). Опитай отново или с по-кратък query.`
      : e instanceof Error
        ? e.message
        : String(e);
    throw new Error(safeMsg);
  } finally {
    clearTimeout(timeoutId);
  }

  // Извличаме text-а от response-а.
  const candidates = (body?.candidates ?? []) as Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
    };
    finishReason?: string;
  }>;
  const rawText = candidates[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const finishReason = candidates[0]?.finishReason ?? "UNKNOWN";
  const webQueries = candidates[0]?.groundingMetadata?.webSearchQueries ?? [];
  const groundingChunks = candidates[0]?.groundingMetadata?.groundingChunks ?? [];

  // DEBUG LOGGING — В server logs пишем точно какво Gemini е върнал.
  // Когато потребителят се оплаче от „няма снимки“, тук е първото място
  // където дебъгваме (rawText показва какво AI е „мислил“).
  const promptFeedback = (body as { promptFeedback?: unknown }).promptFeedback ?? null;
  const safetyRatings = (candidates[0] as { safetyRatings?: unknown })?.safetyRatings ?? null;
  // eslint-disable-next-line no-console
  console.log("[ai/product_image_search] Gemini response:", {
    model,
    finishReason,
    webQueries,
    groundingChunksCount: groundingChunks.length,
    rawTextLength: rawText.length,
    rawTextPreview: rawText.slice(0, 500),
    promptFeedback,
    safetyRatings,
  });

  // Sanitize: понякога моделът връща JSON wrapped в ```json … ``` въпреки
  // изричната инструкция. Премахваме всякакви markdown fences, дори когато
  // не са в началото/края (понякога има въведение преди JSON-а).
  const cleaned = extractJsonFromText(rawText);

  let parsed: {
    pages?: Array<Record<string, unknown>>;
    images?: Array<Record<string, unknown>>; // backward compat
    queries_used?: string[];
    warnings?: string[];
  } = {};
  let parseError: string | null = null;
  if (cleaned) {
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.warn("[ai/product_image_search] JSON parse error:", parseError, {
        cleanedPreview: cleaned.slice(0, 300),
      });
    }
  } else {
    parseError = "AI не върна разпознаваем JSON";
  }

  // ВАЖНО: Новият prompt пита AI за `pages` (webpage URLs), не `images`.
  // Но за backward compat приемаме и `images` ако моделът върне старата схема.
  const rawPages = Array.isArray(parsed.pages)
    ? parsed.pages
    : Array.isArray(parsed.images)
      ? parsed.images
      : [];

  // Парсваме AI отговора в minimal shape — само това, което реално
  // ползваме надолу.
  let candidatePages: Array<{
    url: string;
    source_domain: string | null;
    description: string | null;
  }> = rawPages
    .filter((p) => typeof (p as { url?: unknown }).url === "string")
    .map((p) => {
      const obj = p as {
        url: string;
        source_domain?: unknown;
        description?: unknown;
      };
      let domain: string | null =
        typeof obj.source_domain === "string" ? obj.source_domain : null;
      if (!domain) {
        try {
          domain = new URL(obj.url).hostname;
        } catch {
          /* invalid url — ще се отхвърли по-долу */
        }
      }
      return {
        url: String(obj.url),
        source_domain: domain,
        description: typeof obj.description === "string" ? obj.description : null,
      };
    })
    .filter((p) => /^https?:\/\//i.test(p.url));

  if (candidatePages.length === 0 && groundingChunks.length > 0) {
    // Fallback — ако AI „забрави“ да върне JSON, ползваме директно
    // grounding URLs (тях ги виждаме сигурно).
    candidatePages = groundingChunks
      .map((c) => c.web?.uri)
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//i.test(u))
      .slice(0, 6)
      .map((url) => {
        let domain: string | null = null;
        try {
          domain = new URL(url).hostname;
        } catch {
          /* skip */
        }
        return { url, source_domain: domain, description: null };
      });
    // eslint-disable-next-line no-console
    console.log("[ai/product_image_search] Fallback: using groundingChunks URLs", {
      count: candidatePages.length,
    });
  }

  // Сега fetch-ваме всяка страница и извличаме og:image meta tag-а.
  const { images: extractedImages, errors: extractErrors } =
    candidatePages.length > 0
      ? await extractImagesFromWebpages(candidatePages)
      : { images: [], errors: [] };

  // Dedup по URL — понякога различни магазини сочат към една и съща CDN
  // снимка на производителя.
  const seen = new Set<string>();
  const validImages = extractedImages.filter((im) => {
    if (seen.has(im.url)) return false;
    seen.add(im.url);
    return true;
  });

  const usageMeta = (body?.usageMetadata ?? {}) as {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };

  // Изграждаме warnings list — добавяме contextual info при empty.
  const aggregatedWarnings: string[] = [];
  if (Array.isArray(parsed.warnings)) aggregatedWarnings.push(...parsed.warnings);
  if (validImages.length === 0) {
    if (parseError) {
      aggregatedWarnings.push(`AI отговорът не беше валиден JSON: ${parseError}`);
    } else if (candidatePages.length === 0) {
      aggregatedWarnings.push(
        "AI не намери продуктови страници за този модел. Опитай с друга марка/модел или провери правописа.",
      );
    } else {
      aggregatedWarnings.push(
        `AI намери ${candidatePages.length} страници, но никоя нямаше og:image meta tag (нестандартни сайтове).`,
      );
      if (extractErrors.length > 0) {
        aggregatedWarnings.push(`Детайли: ${extractErrors.slice(0, 3).join(" · ")}`);
      }
    }
    if (webQueries.length > 0) {
      aggregatedWarnings.push(`Google търсения: ${webQueries.slice(0, 3).join(" · ")}`);
    }
  }

  return {
    data: {
      images: validImages,
      queries_used: Array.isArray(parsed.queries_used) ? parsed.queries_used : webQueries,
      warnings: aggregatedWarnings,
      grounding_chunks: groundingChunks
        .map((c) => ({ uri: c.web?.uri ?? null, title: c.web?.title ?? null }))
        .filter((c) => c.uri),
    },
    usage: {
      promptTokens: usageMeta.promptTokenCount ?? 0,
      completionTokens: usageMeta.candidatesTokenCount ?? 0,
      totalTokens: usageMeta.totalTokenCount ?? 0,
      model,
    },
  };
}

/**
 * Изгражда промпт за `product_photo_enhance`. Запазва продукта без
 * модификации и центрира го на чисто бял фон с естествена сянка.
 */
function buildPhotoEnhancePrompt(style: "auto" | "studio_bright" | "minimal_pure"): string {
  const styleHint =
    style === "studio_bright"
      ? "Use bright studio lighting with crisp highlights."
      : style === "minimal_pure"
        ? "Use soft, minimal lighting with very low contrast and a clean look."
        : "Adapt the lighting and framing smartly to whatever looks best for THIS specific air conditioner photo (natural balance).";

  return [
    "You are a professional product photographer specializing in e-commerce catalog images for air conditioners and HVAC equipment.",
    "",
    "TASK: Transform the provided photo of an air conditioner into a professional product catalog image.",
    "",
    "MUST DO:",
    "  • Replace the background with a pure white (#FFFFFF) seamless background.",
    "  • Center the product in the frame, with a small consistent margin around it.",
    "  • Add a soft, natural drop shadow below the product to ground it (subtle, photorealistic — never harsh).",
    "  • Balance the lighting so highlights and shadows on the product itself look even and neutral.",
    "  • Output a single, clean product photograph suitable for an e-commerce catalog hero image.",
    "",
    "CRITICAL — DO NOT DO:",
    "  • DO NOT modify, redesign, retouch or 're-imagine' the product itself.",
    "  • Preserve EVERY visual detail of the air conditioner: every label, logo, brand text, model name, button, LED indicator, vent louver, grille texture, color, and surface finish must remain pixel-faithful to the original.",
    "  • DO NOT change the perspective or angle of the product.",
    "  • DO NOT add reflections, watermarks, text overlays, or any other elements.",
    "  • DO NOT crop the product itself — only the surrounding background.",
    "",
    `STYLE: ${styleHint}`,
    "",
    "Return ONLY the resulting image — no text, no JSON, no description.",
  ].join("\n");
}

/**
 * Извиква Gemini image generation endpoint (Nano Banana).
 * Връща base64 на новата снимка.
 */
async function callGeminiImageEdit(
  env: ReturnType<typeof getEnv>,
  prompt: string,
  image: { mimeType: string; base64: string },
) {
  // Image generation/editing моделът е отделен. Default-ваме на 2.5 Flash Image
  // (Nano Banana), който е най-евтиния real-time editing вариант от Gemini.
  // При нужда може да се override-не от env (GEMINI_IMAGE_MODEL).
  const model = env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const url = `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY!)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          ],
        },
      ],
      generationConfig: {
        // Image generation models изискват responseModalities: ["IMAGE"]
        // (или ["IMAGE","TEXT"]). Тук искаме само изображение.
        responseModalities: ["IMAGE"],
        // Температура за editing задачи трябва да е ниска — за стабилност.
        temperature: 0.2,
      },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Gemini image upstream error ${res.status}: ${JSON.stringify(body).slice(0, 500)}`,
    );
  }

  // Извличаме image part-а от response-а.
  const parts: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> =
    body?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) {
    throw new Error("Gemini не върна изображение в отговора.");
  }

  return {
    data: {
      imageBase64: imgPart.inlineData.data,
      imageMimeType: imgPart.inlineData.mimeType ?? "image/png",
    },
    usage: {
      promptTokens: body?.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: body?.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: body?.usageMetadata?.totalTokenCount ?? 0,
      model,
    },
  };
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
    const { whichUnit, knownBrand, knownModel, availableBrands } = payload.input;
    const unitLabel = whichUnit === "indoor" ? "ВЪТРЕШНОТО тяло" : "ВЪНШНОТО тяло";
    const serialField = whichUnit === "indoor" ? "indoor_unit_serial" : "outdoor_unit_serial";
    const otherSerialField = whichUnit === "indoor" ? "outdoor_unit_serial" : "indoor_unit_serial";
    const hints: string[] = [];
    if (knownBrand) hints.push(`Вече известна марка: ${knownBrand}`);
    if (knownModel) hints.push(`Вече известен модел: ${knownModel}`);
    const brandsList = (availableBrands ?? []).filter(Boolean);
    return [
      "Ти си експерт по техническите спецификации на климатици.",
      `Анализираш снимка на ОРИГИНАЛЕН ЕТИКЕТ от ${unitLabel} на климатик (от завода/производителя).`,
      "",
      "ЗАДАЧАТА Е В ДВЕ ЧАСТИ:",
      "",
      "ЧАСТ 1 — РАЗЧИТАНЕ НА ЕТИКЕТА (само това, което виждаш на снимката):",
      "  • Марка (Daikin, Mitsubishi Electric, Mitsubishi Heavy, Toshiba, Panasonic, Fujitsu, LG, Samsung, Haier, Hisense, Gree, Midea и т.н.).",
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
      "🔥 КРИТИЧНО ВАЖНО ЗА МАРКАТА (brand_hint):",
      "  • Марката Е ЗАДЪЛЖИТЕЛНА — ВИНАГИ върни brand_hint, освен ако снимката е напълно неразпознаваема.",
      "  • Ако НЕ виждаш марка на самия етикет, ИЗПОЛЗВАЙ MODEL CODE за разпознаване:",
      "      — FTXA*, FTXM*, FTKM*, ATXA*, ATXM*, RXM*, RXA*, ARXM*, 2MXM*, 3MXM* → Daikin",
      "      — MSZ-*, MUZ-*, MFZ-*, MUFZ-*, PKA-*, PUMY-*, SLZ-*, MSY-* → Mitsubishi Electric",
      "      — SRK-*, SRC-*, SCM-*, FDC-*, FDT-*, SRR-* → Mitsubishi Heavy",
      "      — ASYG*, AOYG*, ASYA*, AOYA* → Fujitsu",
      "      — RAS-*, RAV-*, MMK-*, MMY-* → Toshiba",
      "      — CS-*, CU-*, KIT-* → Panasonic",
      "      — SAC-*, AS*, AC*, MS*, MU* (LG style) → LG",
      "      — AR*-* (AR09/AR12 и т.н.) → Samsung",
      "      — GWH*-* → Gree",
      "      — MSAG*, MSAFA*, MSAB* → Midea",
      "      — AS-*, AUS-* → Hisense",
      "      — 1U/2U/4U/AS35/AS25-NRJ* → Haier",
      "  • Ако и моделът не помага, върни най-вероятното предположение и забележка в warnings.",
      ...(brandsList.length > 0
        ? [
            "",
            `📋 МАРКИ В СИСТЕМАТА: [${brandsList.join(", ")}]`,
            "  ⚠ Върни brand_hint с ТОЧНОТО име от този списък ако марката съответства (case-sensitive).",
            "  ⚠ Напр. ако виждаш „Mitsubishi“ — провери дали в списъка е „Mitsubishi Electric“ или „Mitsubishi Heavy“ и избери според model code.",
            "  ⚠ Ако марката НЕ е в списъка, върни оригиналното име от етикета (UI ще покаже warning).",
          ]
        : []),
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
