/**
 * Static smoke checks for finalize → PDF → share flow.
 * Run: npx tsx scripts/verify-protocol-finalize-flow.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname ?? __dirname, "..");

function read(rel: string): string {
  const p = join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return readFileSync(p, "utf8");
}

const checks: { name: string; ok: boolean; detail?: string }[] = [];

function assert(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// Share utility
const shareLib = read("lib/protocol-pdf-share.ts");
assert("protocol-pdf-share exports fetchProtocolPdfBlob", shareLib.includes("export async function fetchProtocolPdfBlob"));
assert("protocol-pdf-share exports shareProtocolPdf", shareLib.includes("export async function shareProtocolPdf"));
assert("share uses navigator.share with files only", shareLib.includes("navigator.share({ files: [file] })"));

// PDF with photos
const pdfLib = read("lib/protocol-pdf.tsx");
assert("protocol-pdf renders photo_urls", pdfLib.includes("photo_urls"));
assert("protocol-pdf has photos page title", pdfLib.includes("Снимки от монтажа"));

// Wizard finalize view
const finalView = read("app/admin/service/documents/acceptance/ProtocolPdfFinalView.tsx");
assert("ProtocolPdfFinalView uses shareProtocolPdf", finalView.includes("shareProtocolPdf"));
assert("ProtocolPdfFinalView has Сподели PDF button", finalView.includes("Сподели PDF"));

// Preview for signed protocols
const preview = read("app/admin/service/documents/acceptance/ProtocolPreview.tsx");
assert("ProtocolPreview imports shareProtocolPdf", preview.includes("shareProtocolPdf"));
assert("ProtocolPreview has Сподели button", preview.includes("Сподели"));

// PDF API route
assert("PDF API route exists", existsSync(join(ROOT, "app/api/admin/service/protocols/[id]/pdf/route.ts")));

// Wizard finalize + photos step
const wizard = read("app/admin/service/documents/acceptance/ProtocolFormWizard.tsx");
assert("ProtocolFormWizard shows ProtocolPdfFinalView", wizard.includes("ProtocolPdfFinalView"));
assert("ProtocolFormWizard has finalize action", /Финализирай/.test(wizard));
assert("ProtocolFormWizard supports photo_urls", wizard.includes("photo_urls"));

// Migration 0091
assert("Migration 0091 file exists", existsSync(join(ROOT, "supabase/migrations/0091_service_protocols_photos.sql")));
const mig = read("supabase/migrations/0091_service_protocols_photos.sql");
assert("Migration 0091 adds photo_urls column", mig.includes("photo_urls"));

console.log("=== Protocol finalize flow smoke ===\n");
for (const c of checks) {
  const mark = c.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

const failed = checks.filter(c => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
