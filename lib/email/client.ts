import { Resend } from "resend";

// Lazily initialized — not created until first getResendClient() call so that
// environment variables are guaranteed to be loaded before the constructor runs.
let _client: Resend | null = null;

export function getResendClient(): Resend {
  if (!_client) {
    _client = new Resend(process.env.RESEND_API_KEY!);
  }
  return _client;
}

// Default: onboarding@resend.dev (Resend's shared sending domain — no verification needed).
// Override with RESEND_FROM_ADDRESS once a custom domain is verified in Resend.
export function getFromAddress(): string {
  return process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";
}
