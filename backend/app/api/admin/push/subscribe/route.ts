import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/db";

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** POST — записва/обновява Web Push абонамент за текущия админ. */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = SubscriptionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  const ua = req.headers.get("user-agent") ?? "";

  const { error } = await session.db.from("admin_web_push_subscriptions").upsert(
    {
      admin_user_id: session.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: ua.slice(0, 500),
    },
    { onConflict: "endpoint" },
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const DeleteSchema = z.object({
  endpoint: z.string().url(),
});

/** DELETE — премахва абонамент (напр. при logout). */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = DeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await session.db
    .from("admin_web_push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("admin_user_id", session.userId);

  return NextResponse.json({ ok: true });
}
