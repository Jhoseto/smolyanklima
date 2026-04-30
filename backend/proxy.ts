import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function proxy(req: NextRequest) {
  // Only protect admin routes (matchers below).
  const res = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = req.nextUrl.clone();
    nextUrl.pathname = "/login";
    nextUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(nextUrl);
  }

  const { data: adminUser, error } = await supabase
    .from("admin_users")
    .select("id,is_active,role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !adminUser || !adminUser.is_active) {
    const nextUrl = req.nextUrl.clone();
    nextUrl.pathname = "/login";
    nextUrl.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    nextUrl.searchParams.set("reason", "not_admin");
    return NextResponse.redirect(nextUrl);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

