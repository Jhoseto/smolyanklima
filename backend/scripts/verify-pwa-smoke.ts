/**
 * Static smoke checks for service_staff PWA essentials.
 * Run: npx tsx scripts/verify-pwa-smoke.ts
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

// Service worker
assert("sw-admin.js exists", existsSync(join(ROOT, "public/admin/sw-admin.js")));
const sw = read("public/admin/sw-admin.js");
assert("SW registers offline fetch handling", /fetch|offline/i.test(sw));

// Offline bootstrap
const offlineBoot = read("app/admin/OfflineBootstrap.tsx");
assert("OfflineBootstrap registers SW", offlineBoot.includes("sw-admin.js"));

// Offline queue for acceptance protocols
assert("offlineFetch module exists", existsSync(join(ROOT, "lib/offline/offlineFetch.ts")));
const wizard = read("app/admin/service/documents/acceptance/ProtocolFormWizard.tsx");
assert("ProtocolFormWizard uses offlineSend", wizard.includes("offlineSend"));

// Push notifications
assert("AdminPushBanner exists", existsSync(join(ROOT, "app/admin/AdminPushBanner.tsx")));
assert("pushClient exists", existsSync(join(ROOT, "app/admin/pushClient.ts")));
const pushClient = read("app/admin/pushClient.ts");
assert("Push client registers SW", pushClient.includes("sw-admin.js"));
assert("Profile push controls exist", existsSync(join(ROOT, "app/admin/profile/ProfilePushNotifications.tsx")));
assert("Push test API exists", existsSync(join(ROOT, "app/api/admin/push/test/route.ts")));
assert("notifyServiceStaffNewEvent in web-push", read("lib/admin-web-push.ts").includes("notifyServiceStaffNewEvent"));
assert("sendTestPushToAdmin in web-push", read("lib/admin-web-push.ts").includes("sendTestPushToAdmin"));

// Mobile nav for service_staff
const nav = read("lib/admin/adminNavConfig.ts");
assert("service_staff mobile nav has Documents", nav.includes('role === "service_staff"') && nav.includes("DOCUMENTS_LINK"));
assert("master_admin mobile nav has Profile", nav.includes("PROFILE_LINK"));

// Empty states for technicians
const planner = read("app/admin/WorkItemsPlanner.tsx");
assert("WorkItemsPlanner empty hint for readOnly", planner.includes("readOnly") && planner.includes("Протоколите са в меню"));

const tasks = read("app/admin/service/tasks/ServiceTasksClient.tsx");
assert("ServiceTasksClient empty state hints office", tasks.includes("офиса"));

// Sync hook
assert("useOfflineQueue hook exists", existsSync(join(ROOT, "lib/hooks/useOfflineQueue.tsx")));
const syncHook = read("lib/hooks/useOfflineQueue.tsx");
assert("useOfflineQueue flushes queue via SW", syncHook.includes("FLUSH_QUEUE"));

console.log("=== PWA smoke (service_staff) ===\n");
for (const c of checks) {
  const mark = c.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}

const failed = checks.filter(c => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
process.exit(failed.length ? 1 : 0);
