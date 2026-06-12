import { NextResponse, type NextRequest } from "next/server";
import { workos } from "@/lib/workos/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/workos/session";

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
// Role-protected path prefixes
// A user with a valid session but an insufficiently privileged role will be
// redirected to their role's home rather than shown a 403.
// ---------------------------------------------------------------------------
const ADMIN_ONLY_PREFIXES = ["/groe-admin"];
const ORG_ADMIN_PREFIXES = ["/admin"];

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let public routes through immediately
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // No cookie → redirect to login, preserving the intended path as a query
  // param so the login page can redirect back after auth.
  // (no PII in the URL — rule 4.3; path only, not identity data)
  if (!sessionCookie) {
    return redirectToLogin(request);
  }

  // ── Load and validate the WorkOS sealed session ──────────────────────────
  const session = workos.userManagement.loadSealedSession({
    sessionData: sessionCookie,
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
  });

  let authenticated = false;
  let response = NextResponse.next();

  try {
    const authResult = await session.authenticate();
    console.log("[mw] authenticated:", authResult.authenticated, "reason:", (authResult as Record<string, unknown>).reason ?? "none");

    if (authResult.authenticated) {
      authenticated = true;
    } else {
      const refreshResult = await session.refresh({
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      });
      console.log("[mw] refresh authenticated:", refreshResult.authenticated);

      if (refreshResult.authenticated && refreshResult.sealedSession) {
        authenticated = true;
        response = NextResponse.next();
        response.cookies.set(
          SESSION_COOKIE_NAME,
          refreshResult.sealedSession,
          SESSION_COOKIE_OPTIONS
        );
      }
    }
  } catch (err) {
    console.error("[mw] threw:", String(err));
    authenticated = false;
  }

  if (!authenticated) {
    return redirectToLogin(request);
  }

  // ── Role-based route guards ───────────────────────────────────────────────
  // NOTE: The role is not stored in the sealed session cookie to avoid
  // stale data. Route-level components query Supabase for the actual role.
  // Middleware enforces only the lightweight "you must be logged in" check.
  // Fine-grained role access is enforced in layout server components and
  // Supabase RLS policies (rule 4.1).

  // Critical distress routing (rule 4.9) is enforced in page components and
  // the Supabase RLS / Edge Function layer — not here — because it requires
  // a DB read that belongs in the request lifecycle, not the Edge middleware.

  return response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  // Do NOT add the intended path as a query param here — would require
  // encoding the user's destination which is fine, but keep it simple
  // for now. Deep-link restoration can be added as a follow-on.
  return NextResponse.redirect(loginUrl);
}

// ---------------------------------------------------------------------------
// Matcher — exclude static assets and Next internals
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
