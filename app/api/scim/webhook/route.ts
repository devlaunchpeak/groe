import { NextResponse } from "next/server";
import { workos } from "@/lib/workos/client";
import {
  handleDirectoryUserCreated,
  handleDirectoryUserUpdated,
  handleDirectoryUserDeleted,
  type DirectoryUserEventData,
} from "@/lib/scim/handlers";

// WorkOS retries failed webhooks with exponential back-off for up to 3 days.
// Always return 200 once the signature is verified — handler errors are
// logged internally and must not cause WorkOS to retry a partially-applied event.

export async function POST(request: Request) {
  // ── 1. Read the raw body before any parsing — required for HMAC verification
  const rawBody = await request.text();
  const sigHeader = request.headers.get("workos-signature");

  if (!sigHeader) {
    return NextResponse.json(
      { error: "Missing workos-signature header" },
      { status: 400 }
    );
  }

  if (!process.env.WORKOS_WEBHOOK_SECRET) {
    console.error("[SCIM] WORKOS_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // ── 2. Verify the WorkOS HMAC-SHA256 signature
  // verifyHeader throws SignatureVerificationException on any failure.
  // We use verifyHeader (not constructEvent) because constructEvent passes the
  // raw body string to deserializeEvent which expects a parsed object — a
  // known SDK issue that causes a 500 for unrecognized event types.
  try {
    await workos.webhooks.verifyHeader({
      payload:    rawBody,
      sigHeader,
      secret:     process.env.WORKOS_WEBHOOK_SECRET,
      tolerance:  180_000, // 3 minutes in ms — WorkOS default
    });
  } catch (err) {
    console.error("[SCIM] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  // ── 3. Parse the body now that the signature is confirmed
  let event: { event: string; data: unknown; id: string };
  try {
    event = JSON.parse(rawBody) as { event: string; data: unknown; id: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── 4. Dispatch to the appropriate handler
  console.info(`[SCIM] Received event: ${event.event} (id: ${event.id})`);

  try {
    switch (event.event) {
      case "dsync.user.created":
        await handleDirectoryUserCreated(event.data as DirectoryUserEventData);
        break;

      case "dsync.user.updated":
        await handleDirectoryUserUpdated(event.data as DirectoryUserEventData);
        break;

      case "dsync.user.deleted":
        await handleDirectoryUserDeleted(event.data as DirectoryUserEventData);
        break;

      case "dsync.group.created":
      case "dsync.group.updated":
      case "dsync.group.deleted":
      case "dsync.group.user.added":
      case "dsync.group.user.removed":
        // Group events are not used in Phase 1 — acknowledged silently
        break;

      default:
        console.info(`[SCIM] Unhandled event type: ${event.event}`);
        break;
    }
  } catch (err) {
    // Log the error but return 200 so WorkOS does not retry the webhook.
    // Investigate via Supabase audit_log or application logs.
    console.error(`[SCIM] Handler error for ${event.event}:`, err);
  }

  return NextResponse.json({ received: true });
}
