import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/db";
import { sendTestPushToAdmin } from "@/lib/admin-web-push";

/** POST — изпраща тестово Web Push до текущия админ. */
export async function POST() {
  let session;
  try {
    session = await adminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendTestPushToAdmin(session.userId);
    if (result.sent === 0) {
      return NextResponse.json(
        { error: "Няма активен абонамент. Включете известията и опитайте отново." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Push failed";
    if (msg === "VAPID_NOT_CONFIGURED") {
      return NextResponse.json({ error: "Push не е конфигуриран на сървъра." }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
