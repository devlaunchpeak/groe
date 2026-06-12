import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workos, WORKOS_CLIENT_ID } from "@/lib/workos/client";
import {
  SSO_STATE_COOKIE_NAME,
  SSO_STATE_COOKIE_OPTIONS,
} from "@/lib/workos/session";
import { SsoInitSchema } from "@/lib/validators/auth";
import { logAuditEvent, AuditAction } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const { email } = SsoInitSchema.parse(body);

    // Generate a random CSRF state token and store it in an httpOnly cookie.
    // The callback handler verifies this value to prevent CSRF attacks.
    const state = crypto.randomUUID();
    cookies().set(SSO_STATE_COOKIE_NAME, state, SSO_STATE_COOKIE_OPTIONS);

    const url = workos.userManagement.getAuthorizationUrl({
      clientId: WORKOS_CLIENT_ID,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      loginHint: email,
      state,
    });

    // Log the SSO initiation. No user ID yet — auth completes in the callback.
    await logAuditEvent({
      action:   AuditAction.AUTH_SSO_INITIATED,
      request,
      metadata: { loginHint: email },
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[SSO] initiation error:", err);
    return NextResponse.json(
      { message: "SSO initiation failed. Please try again." },
      { status: 400 }
    );
  }
}
