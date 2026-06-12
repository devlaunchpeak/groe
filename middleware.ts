import { NextResponse, type NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Inlined to avoid @/ path alias imports which Vercel Edge bundler rejects
// ---------------------------------------------------------------------------
const SESSION_COOKIE_NAME = "groe_session";

// ---------------------------------------------------------------------------
// Public paths — never require a session
// ---------------------------------------------------------------------------
const PUBLIC_PREFIXES = [
  "/login",
  "/magic-link",
  "/sso",
  "/api/auth/",
  "/api/scim/",   // WorkOS webhook — auth is via HMAC signature, not session cookie
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Middleware (Edge-compatible — cookie presence check only)
//
// Full session validation (WorkOS JWT verification) happens in server layouts
// and API route handlers which run in Node.js. Doing it here would require
// importing @workos-inc/node which is not Edge-runtime compatible.
//
// Security: the session cookie is httpOnly+secure, so a client cannot forge
// it. API routes and server layouts enforce the actual auth boundary.
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// ---------------------------------------------------------------------------
// Matcher — exclude static assets and Next internals
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
