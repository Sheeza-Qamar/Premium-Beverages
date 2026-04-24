import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "erp_session";

const PUBLIC_PATH_PREFIXES = [
  "/auth/sign-in",
  "/auth/first-admin",
  "/client-card",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/first-admin-available",
  "/api/auth/register-first-admin",
  "/api/client-card",
];

function isPublicPage(pathname: string) {
  if (pathname === "/favicon.ico") return true;
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }
    if (!token) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isPublicPage(pathname)) {
    if (
      token &&
      (pathname === "/auth/sign-in" || pathname.startsWith("/auth/sign-in"))
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (token && pathname === "/auth/first-admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
