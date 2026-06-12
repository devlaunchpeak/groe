import { createHmac, timingSafeEqual } from "crypto";

// Re-export constants for callers that already import from session.ts
export {
  SESSION_COOKIE_NAME,
  MAGIC_PENDING_COOKIE_NAME,
  SSO_STATE_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  MAGIC_PENDING_COOKIE_OPTIONS,
  SSO_STATE_COOKIE_OPTIONS,
  type UserRole,
  ROLE_REDIRECT,
} from "./session-constants";

// ---------------------------------------------------------------------------
// Magic-pending cookie — HMAC-signed, contains the user's email for the
// duration of the code-entry step. 15-minute TTL enforced in the payload.
//
// Structure: base64url(JSON payload) + "." + hex(HMAC-SHA256)
// ---------------------------------------------------------------------------
interface MagicPendingPayload {
  email: string;
  exp: number; // epoch ms
}

function cookiePassword(): string {
  const pw = process.env.WORKOS_COOKIE_PASSWORD;
  if (!pw) throw new Error("WORKOS_COOKIE_PASSWORD is not set");
  return pw;
}

export function sealMagicPending(email: string): string {
  const payload: MagicPendingPayload = {
    email,
    exp: Date.now() + 15 * 60 * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");
  const sig = createHmac("sha256", cookiePassword())
    .update(payloadStr)
    .digest("hex");
  return `${payloadB64}.${sig}`;
}

export function unsealMagicPending(cookieValue: string): string {
  const dotIndex = cookieValue.lastIndexOf(".");
  if (dotIndex === -1) throw new Error("Malformed magic-pending cookie");

  const payloadB64 = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  const payloadStr = Buffer.from(payloadB64, "base64url").toString();

  const expectedSig = createHmac("sha256", cookiePassword())
    .update(payloadStr)
    .digest("hex");

  const sigBuf = Buffer.from(sig, "hex");
  const expectedSigBuf = Buffer.from(expectedSig, "hex");
  if (
    sigBuf.length !== expectedSigBuf.length ||
    !timingSafeEqual(sigBuf, expectedSigBuf)
  ) {
    throw new Error("Invalid magic-pending cookie signature");
  }

  const { email, exp } = JSON.parse(payloadStr) as MagicPendingPayload;
  if (Date.now() > exp) throw new Error("Magic auth session expired (rule 4.6)");

  return email;
}
