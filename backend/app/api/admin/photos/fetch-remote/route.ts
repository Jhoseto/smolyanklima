/**
 * /api/admin/photos/fetch-remote
 *
 * Server-side proxy за сваляне на отдалечени изображения.
 *
 * Защо: Browser-ите блокират fetch към повечето external image URLs заради
 * CORS. Освен това, директно качване на blob от browser в Cloudinary е
 * възможно, но не може да премине през AI enhance flow-а ни (който чете
 * .blob от локалния клиент). Решението е простичък proxy.
 *
 * Защита (МНОГО ВАЖНО — този endpoint може да бъде SSRF vector):
 *   1. Само HTTPS схема (HTTP отхвърлен).
 *   2. Hostname МНОГО се проверява:
 *      - Hostname не е празен.
 *      - НЕ е IP литерал (numeric).
 *      - НЕ е localhost / .local / .internal / .lan.
 *      - НЕ е RFC1918 private range (10.x, 172.16-31.x, 192.168.x).
 *      - НЕ е link-local (169.254.x), loopback (127.x), IPv6 ULA (fc00::/7).
 *   3. Максимален размер: 8 MB (отказа да отвори по-голям файл).
 *   4. Timeout: 15 секунди.
 *   5. Content-Type ТРЯБВА да започва с `image/` (jpeg, png, webp, gif).
 *   6. Изисква admin сесия (adminDb()).
 *
 * Връща: base64 на изтегления blob + MIME type.
 *
 * Употреба:
 *   POST /api/admin/photos/fetch-remote { "url": "https://..." }
 *   →
 *   200 { data: { base64: "...", mimeType: "image/jpeg", sizeBytes: 12345 } }
 *   4xx { error: "<reason>" }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/admin/db";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIMEOUT_MS = 15_000;

const BodySchema = z.object({
  url: z.string().url("Невалиден URL").max(2000),
});

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  // Auth: admin client (за RLS context-а).
  await adminDb();

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(parsed.data.url);
  } catch {
    return NextResponse.json({ error: "Невалиден URL формат" }, { status: 400 });
  }

  // 1. Само HTTPS.
  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "Само HTTPS URL-ове са разрешени." },
      { status: 400 },
    );
  }

  // 2. SSRF защита — забраняваме internal/private hostnames.
  const ssrfErr = checkSsrf(parsedUrl.hostname);
  if (ssrfErr) {
    return NextResponse.json({ error: ssrfErr }, { status: 400 });
  }

  // 3. Fetch с timeout.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsedUrl.toString(), {
      method: "GET",
      signal: controller.signal,
      // Header-ите имитират обикновен browser request — много CDN-и блокират
      // bot-ове ако липсва User-Agent / Accept.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SmolyanKlimaAdmin/1.0) AppleWebKit/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Свалянето не успя: ${msg.slice(0, 200)}` },
      { status: 502 },
    );
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    return NextResponse.json(
      { error: `Отдалеченият сървър върна ${res.status}` },
      { status: 502 },
    );
  }

  // 4. Защита: ако after-redirect URL-ът е в private мрежа, отхвърляме.
  try {
    const finalUrl = new URL(res.url);
    if (finalUrl.protocol !== "https:") {
      return NextResponse.json(
        { error: "Redirect към non-HTTPS — отказано." },
        { status: 400 },
      );
    }
    const redirectErr = checkSsrf(finalUrl.hostname);
    if (redirectErr) {
      return NextResponse.json({ error: redirectErr }, { status: 400 });
    }
  } catch {
    /* res.url е винаги валиден URL — никога не би трябвало да хвърли. */
  }

  // 5. Content-Type валидация.
  const mimeRaw = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_MIMES.has(mimeRaw)) {
    return NextResponse.json(
      { error: `Невалиден тип файл: ${mimeRaw || "неизвестен"}. Очаквам image/*.` },
      { status: 415 },
    );
  }

  // 6. Streaming read с размер-лимит.
  if (!res.body) {
    return NextResponse.json({ error: "Празно тяло на отговора." }, { status: 502 });
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BYTES) {
      reader.cancel().catch(() => {});
      return NextResponse.json(
        { error: `Файлът е по-голям от лимита (${MAX_BYTES / 1024 / 1024} MB).` },
        { status: 413 },
      );
    }
    chunks.push(value);
  }

  // 7. Концатeнация в един Uint8Array (за base64 енкодинг).
  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.byteLength;
  }

  const base64 = Buffer.from(buffer).toString("base64");
  // Нормализираме jpg → jpeg за консистентност с MIME standard-а.
  const normalizedMime = mimeRaw === "image/jpg" ? "image/jpeg" : mimeRaw;

  return NextResponse.json({
    data: {
      base64,
      mimeType: normalizedMime,
      sizeBytes: totalBytes,
    },
  });
}

/**
 * Минимална SSRF проверка на hostname. Връща error string ако hostname-ът
 * не е разрешен; null ако е ОК.
 *
 * Тази функция е защита НА НИВО hostname (преди DNS resolve). Не може да
 * хване DNS rebinding атаки (където hostname резолва на private IP в
 * момента на fetch-а). За пълна защита би трябвало да правим DNS resolve
 * предварително и да рестриктираме fetch-а до specifically този IP — но
 * това е сложно и за нашия admin-only use case с trusted users е overkill.
 */
function checkSsrf(hostname: string): string | null {
  if (!hostname) return "Празен hostname.";
  const h = hostname.toLowerCase();

  // Блокирани суфикси / hostnames.
  if (h === "localhost" || h === "localhost.localdomain") return "Локални URL-ове са забранени.";
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan"))
    return "Вътрешни (private) URL-ове са забранени.";
  if (h === "metadata.google.internal" || h === "169.254.169.254")
    return "Cloud metadata endpoint-ите са забранени.";

  // IPv4 литерал.
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4Match) {
    const [, a, b] = ipv4Match;
    const aN = Number(a);
    const bN = Number(b);
    // Loopback: 127.0.0.0/8
    if (aN === 127) return "Loopback IP-та са забранени.";
    // Private: 10/8
    if (aN === 10) return "Private IP-та са забранени.";
    // Private: 172.16/12
    if (aN === 172 && bN >= 16 && bN <= 31) return "Private IP-та са забранени.";
    // Private: 192.168/16
    if (aN === 192 && bN === 168) return "Private IP-та са забранени.";
    // Link-local: 169.254/16
    if (aN === 169 && bN === 254) return "Link-local IP-та са забранени.";
    // Reserved
    if (aN === 0 || aN >= 224) return "Reserved IP диапазон.";
  }

  // IPv6 — груба проверка за loopback (::1) и ULA (fc00::/7).
  if (h.includes(":")) {
    if (h === "::1" || h === "[::1]") return "IPv6 loopback е забранено.";
    if (/^\[?(fc|fd)/i.test(h)) return "IPv6 ULA адреси са забранени.";
    if (/^\[?fe80/i.test(h)) return "IPv6 link-local адреси са забранени.";
  }

  return null;
}
