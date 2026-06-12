import * as React from "react";
import { getResendClient, getFromAddress } from "./client";

// =============================================================================
// sendEmail — thin wrapper around the Resend SDK.
//
// Never throws. Caller receives a typed result and can choose to surface
// or silently log failures without breaking the primary request flow.
// All templates live in /emails and are rendered by React Email before
// being passed here.
// =============================================================================

export interface SendEmailOptions {
  /** Recipient email address or array of addresses */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** Pre-rendered React Email template element, e.g. <MagicLinkEmail {...props} /> */
  react: React.ReactElement;
  /** Optional reply-to address */
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  /** Resend message ID — useful for delivery tracking */
  messageId?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const { data, error } = await getResendClient().emails.send({
      from:     getFromAddress(),
      to:       Array.isArray(options.to) ? options.to : [options.to],
      subject:  options.subject,
      react:    options.react,
      ...(options.replyTo ? { reply_to: options.replyTo } : {}),
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return {
        success: false,
        error: typeof error === "object" && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error),
      };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("[Email] sendEmail threw unexpectedly:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
