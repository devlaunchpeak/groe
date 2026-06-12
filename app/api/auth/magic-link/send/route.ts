export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workos } from "@/lib/workos/client";
import {
  MAGIC_PENDING_COOKIE_NAME,
  MAGIC_PENDING_COOKIE_OPTIONS,
  sealMagicPending,
} from "@/lib/workos/session";
import { MagicSendSchema } from "@/lib/validators/auth";
import { logAuditEvent, AuditAction } from "@/lib/audit";

// Fail fast at request time if required env vars are missing/placeholder.
function checkEnv() {
  const key = process.env.WORKOS_API_KEY;
  if (!key || key === "sk_test_placeholder") {
    throw new Error(
      `WORKOS_API_KEY is ${key ? "a placeholder stub" : "not set"}. ` +
        "Set a real WorkOS API key in .env.local."
    );
  }
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (!clientId || clientId === "client_placeholder") {
    throw new Error(
      `WORKOS_CLIENT_ID is ${clientId ? "a placeholder stub" : "not set"}. ` +
        "Set a real WorkOS Client ID in .env.local."
    );
  }
}

export async function POST(request: Request) {
  try {
    checkEnv();

    const body: unknown = await request.json();
    const parsed = MagicSendSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[Magic/send] validation error:", parsed.error.issues);
      return NextResponse.json(
        { message: "Invalid request." },
        { status: 400 }
      );
    }
    const { email } = parsed.data;

    // WorkOS sends a 6-digit OTP to the email address.
    // WorkOS enforces single-use and 15-minute TTL server-side (rule 4.6).
    await workos.userManagement.sendMagicAuthCode({ email });

    // Store the email in a signed, httpOnly cookie so the verify step can read
    // it without it appearing in the URL (rule 4.3 — no PII in URLs).
    const pendingValue = sealMagicPending(email);
    cookies().set(
      MAGIC_PENDING_COOKIE_NAME,
      pendingValue,
      MAGIC_PENDING_COOKIE_OPTIONS
    );

    // Log after the OTP is successfully dispatched. No user ID yet.
    await logAuditEvent({
      action:   AuditAction.AUTH_MAGIC_LINK_SENT,
      request,
      metadata: { email },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    // Extract structured WorkOS error details when available
    if (err instanceof Error) {
      const workosErr = err as Error & {
        status?: number;
        code?: string;
        errors?: unknown[];
        rawData?: unknown;
      };
      console.error("[Magic/send] failed:", {
        message: workosErr.message,
        status: workosErr.status,
        code: workosErr.code,
        errors: workosErr.errors,
        rawData: workosErr.rawData,
      });
    } else {
      console.error("[Magic/send] unknown error:", err);
    }

    // Generic client message — avoids email enumeration
    return NextResponse.json(
      { message: "Could not send sign-in code. Please try again." },
      { status: 400 }
    );
  }
}
