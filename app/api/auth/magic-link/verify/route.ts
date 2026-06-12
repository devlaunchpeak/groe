import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workos, WORKOS_CLIENT_ID } from "@/lib/workos/client";
import {
  MAGIC_PENDING_COOKIE_NAME,
  MAGIC_PENDING_COOKIE_OPTIONS,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  unsealMagicPending,
} from "@/lib/workos/session";
import { getGroeUserByWorkosId, getRedirectPath } from "@/lib/workos/auth";
import { MagicVerifySchema } from "@/lib/validators/auth";
import { logAuditEvent, AuditAction } from "@/lib/audit";

export async function POST(request: Request) {
  const cookieStore = cookies();

  // ── Read and immediately invalidate the pending email cookie ─────────────
  // Consuming the cookie first prevents a second request from re-using it,
  // adding a server-side single-use guard on top of WorkOS's own enforcement
  // (rule 4.6).
  const pendingCookie = cookieStore.get(MAGIC_PENDING_COOKIE_NAME)?.value;
  cookieStore.delete(MAGIC_PENDING_COOKIE_NAME);

  if (!pendingCookie) {
    return NextResponse.json(
      { message: "Sign-in session expired. Please start again." },
      { status: 401 }
    );
  }

  let email: string;
  try {
    email = unsealMagicPending(pendingCookie);
  } catch (err) {
    console.error("[Magic/verify] invalid pending cookie:", err);
    return NextResponse.json(
      { message: "Sign-in session expired or invalid. Please start again." },
      { status: 401 }
    );
  }

  // ── Validate the submitted OTP code ──────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = MagicVerifySchema.safeParse(body);
  if (!parsed.success) {
    // Restore cookie so the user can retry without restarting the whole flow
    cookieStore.set(MAGIC_PENDING_COOKIE_NAME, pendingCookie, MAGIC_PENDING_COOKIE_OPTIONS);
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid code format." },
      { status: 400 }
    );
  }
  const { code } = parsed.data;

  // ── Verify with WorkOS ────────────────────────────────────────────────────
  // WorkOS enforces single-use and 15-minute TTL on its end (rule 4.6).
  let workosUser: { id: string; email: string };
  let sealed: string;

  try {
    const result = await workos.userManagement.authenticateWithMagicAuth({
      code,
      email,
      clientId: WORKOS_CLIENT_ID,
      session: {
        sealSession: true,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      },
    });
    workosUser = result.user;
    sealed = result.sealedSession!;
  } catch (err) {
    console.error("[Magic/verify] WorkOS verification failed:", err);
    return NextResponse.json(
      { message: "Code is invalid or has expired. Request a new one." },
      { status: 401 }
    );
  }

  // ── Resolve GROE user profile ─────────────────────────────────────────────
  const groeUser = await getGroeUserByWorkosId(workosUser.id, workosUser.email);

  if (!groeUser) {
    return NextResponse.json(
      {
        message:
          "Your account has not been provisioned in GROE. Contact your Org Admin.",
      },
      { status: 403 }
    );
  }

  // ── Set session cookie ────────────────────────────────────────────────────
  cookieStore.set(SESSION_COOKIE_NAME, sealed, SESSION_COOKIE_OPTIONS);

  await logAuditEvent({
    action:   AuditAction.AUTH_LOGIN_MAGIC,
    userId:   groeUser.id,
    orgId:    groeUser.orgId,
    request,
    metadata: { workosUserId: workosUser.id },
  });

  return NextResponse.json({ redirectTo: getRedirectPath(groeUser) });
}
