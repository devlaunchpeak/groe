import { cookies } from "next/headers";
import { workos } from "@/lib/workos/client";
import { SESSION_COOKIE_NAME } from "@/lib/workos/session";
import { getGroeUserByWorkosId, type GroeUser } from "@/lib/workos/auth";

// ---------------------------------------------------------------------------
// getSessionUser — resolves the current WorkOS session into a GroeUser.
// Returns null if there is no valid session or the user is not in our DB.
// Use in server components and Route Handlers (never in client components).
// ---------------------------------------------------------------------------
export async function getSessionUser(): Promise<GroeUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    const auth = await session.authenticate();
    if (!auth.authenticated) return null;

    return getGroeUserByWorkosId(auth.user.id, auth.user.email);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// requireRole — like getSessionUser but throws a Response if the user is
// missing or doesn't have one of the required roles. Use in Route Handlers.
// ---------------------------------------------------------------------------
export async function requireRole(
  ...roles: GroeUser["role"][]
): Promise<GroeUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return user;
}
