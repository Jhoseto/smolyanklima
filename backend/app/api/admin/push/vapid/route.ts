import { NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/db";
import { getVapidPublicKey } from "@/lib/admin-web-push";

/**
 * GET — публичен VAPID ключ за текущия админ (нужен за PushManager.subscribe).
 * Не е тайна; private key остава само на сървъра.
 */
export async function GET() {
  try {
    await adminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ configured: false, publicKey: null });
  }
  return NextResponse.json({ configured: true, publicKey });
}
