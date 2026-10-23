import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "tt_token";

/**
 * Optimistic gate for the gated portals. If there's no session cookie at all,
 * bounce to /login before rendering. Definitive role checks happen server-side
 * in the admin/instructor layouts (this only avoids flashing a protected shell).
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(AUTH_COOKIE);

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/suite/lms/:path*", "/suite/lms/teach/:path*"],
};
