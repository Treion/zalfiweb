import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every admin request:
 *  - no session cookie → the login page (a fast, optimistic check; every admin page, server action
 *    and route handler checks the session and role again on the server)
 *  - security headers, and never indexed or cached publicly
 * The storefront is untouched: the matcher only covers /admin and /api/admin.
 */
const PUBLIC_ADMIN = ["/admin/login", "/admin/invite/"];

const HEADERS: Record<string, string> = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPublic = PUBLIC_ADMIN.some((p) => pathname === p || pathname.startsWith(p));

  let res: NextResponse;
  if (isPage && !isPublic && !getSessionCookie(request, { cookiePrefix: "zalfi-admin" })) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname + search);
    res = NextResponse.redirect(login);
  } else {
    res = NextResponse.next();
  }
  for (const [k, v] of Object.entries(HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
