import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workos } from "@/lib/workos/client";
import {
  SESSION_COOKIE_NAME,
  MAGIC_PENDING_COOKIE_NAME,
  SSO_STATE_COOKIE_NAME,
} from "@/lib/workos/session";
import { logAuditEvent, AuditAction } from "@/lib/audit";
import { getGroeUserByWorkosId } from "@/lib/workos/auth";

export async function GET(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  let workosLogoutUrl: string | null = null;

  if (sessionCookie) {
    try {
      const session = workos.userManagement.loadSealedSession({
        sessionData: sessionCookie,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      });

      const auth = await session.authenticate();

      if (auth.authenticated) {
        // Audit the logout before invalidating
        const groeUser = await getGroeUserByWorkosId(auth.user.id, auth.user.email);
        if (groeUser) {
          await logAuditEvent({
            action:   AuditAction.AUTH_LOGOUT,
            userId:   groeUser.id,
            orgId:    groeUser.orgId,
            request,
          });
        }

        // Get WorkOS server-side logout URL (revokes the server session)
        workosLogoutUrl = await session.getLogoutUrl({
          returnTo: `${baseUrl}/login`,
        });
      }
    } catch {
      // Corrupt or expired session — continue to clear cookies
    }
  }

  // Clear all auth cookies regardless
  const response = NextResponse.redirect(
    workosLogoutUrl ?? `${baseUrl}/login`
  );
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(MAGIC_PENDING_COOKIE_NAME);
  response.cookies.delete(SSO_STATE_COOKIE_NAME);

  return response;
}
