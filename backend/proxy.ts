import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import { isSeoBot } from "@/lib/seo/botDetect";

const STATIC_SEO = new Set(["/robots.txt", "/sitemap.xml", "/rss.xml", "/llms.txt"]);

function isAdminArea(pathname: string): boolean {
  return (
    pathname === "/login"
    || pathname === "/login/"
    || pathname.startsWith("/admin")
    || pathname.startsWith("/api/admin")
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    !isAdminArea(pathname)
    && !pathname.startsWith("/api/")
    && !STATIC_SEO.has(pathname)
    && isSeoBot(req.headers.get("user-agent"))
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/seo-render";
    url.searchParams.set("path", pathname);
    return NextResponse.rewrite(url);
  }

  if (!isAdminArea(pathname)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createSupabaseMiddlewareClient(req, res);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname === "/login" || pathname === "/login/") {
    if (user) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return res;
  }

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|icon|assets/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
