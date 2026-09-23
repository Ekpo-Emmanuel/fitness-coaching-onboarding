import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/login", "/signup"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);

  if (pathname === "/coach/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (PUBLIC_EXACT.has(pathname)) {
    if (sessionCookie) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionCookie) {
    if (
      pathname.startsWith("/api/forms") ||
      pathname.startsWith("/api/submissions") ||
      pathname.startsWith("/api/integrations") ||
      pathname.startsWith("/api/clients") ||
      pathname.startsWith("/api/workspace")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next({
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/dashboard",
    "/dashboard/:path*",
    "/settings",
    "/settings/:path*",
    "/onboarding",
    "/forms",
    "/forms/:path*",
    "/clients",
    "/clients/:path*",
    "/coach/:path*",
    "/api/forms/:path*",
    "/api/submissions/:path*",
    "/api/integrations/:path*",
    "/api/clients/:path*",
    "/api/workspace/:path*",
  ],
};
