import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workos, WORKOS_CLIENT_ID } from "@/lib/workos/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SSO_STATE_COOKIE_NAME,
} from "@/lib/workos/session";
import { getGroeUserByWorkosId, getRedirectPath } from "@/lib/workos/auth";
import { logAuditEvent, AuditAction } from "@/lib/audit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // ── CSRF state check ────────────────────────────────────────────────────
  const cookieStore = cookies();
  const storedState = cookieStore.get(SSO_STATE_COOKIE_NAME)?.value;
  cookieStore.delete(SSO_STATE_COOKIE_NAME); // consume immediately

  if (!storedState || storedState !== returnedState) {
    console.error("[Callback] CSRF state mismatch");
    return NextResponse.redirect(`${baseUrl}/login?error=session_invalid`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);
  }

  // ── Exchange code for sealed session ─────────────────────────────────────
  let workosUser: { id: string; email: string };
  let sealed: string;

  try {
    const result = await workos.userManagement.authenticateWithCode({
      code,
      clientId: WORKOS_CLIENT_ID,
      session: {
        sealSession: true,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      },
    });
    workosUser = result.user;
    sealed = result.sealedSession!;
  } catch (err) {
    console.error("[Callback] WorkOS code exchange failed:", err);
    return NextResponse.redirect(`${baseUrl}/login?error=auth_failed`);
  }

  // ── Resolve GROE user profile ─────────────────────────────────────────────
  const groeUser = await getGroeUserByWorkosId(workosUser.id, workosUser.email);

  if (!groeUser) {
    console.warn("[Callback] No GROE user found for WorkOS ID:", workosUser.id);
    return NextResponse.redirect(`${baseUrl}/login?error=not_provisioned`);
  }

  // ── Set session cookie and redirect ──────────────────────────────────────
  const response = NextResponse.redirect(
    `${baseUrl}${getRedirectPath(groeUser)}`
  );
  response.cookies.set(SESSION_COOKIE_NAME, sealed, SESSION_COOKIE_OPTIONS);

  await logAuditEvent({
    action:     AuditAction.AUTH_LOGIN_SSO,
    userId:     groeUser.id,
    orgId:      groeUser.orgId,
    request,
    metadata:   { workosUserId: workosUser.id },
  });

  return response;
}
