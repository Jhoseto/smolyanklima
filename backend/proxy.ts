import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const { pathname } = req.nextUrl;
  const supabase = createSupabaseMiddlewareClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If an already-authenticated user lands on /login (e.g. via mobile swipe-back),
  // redirect them straight to /admin so the login form is never shown.
  if (pathname === "/login" || pathname === "/login/") {
    if (user) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return res;
  }

  // Protect admin routes — unauthenticated users go to /login.
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
  matcher: ["/login", "/login/", "/admin/:path*", "/api/admin/:path*"],
};

