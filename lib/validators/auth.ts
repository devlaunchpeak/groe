import { z } from "zod";

export const SsoInitSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const MagicSendSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

// WorkOS magic auth sends a 6-digit numeric OTP
export const MagicVerifySchema = z.object({
  code: z
    .string()
    .length(6, "Enter the 6-digit code from your email")
    .regex(/^\d{6}$/, "Code must be 6 digits"),
});

export type SsoInitInput = z.infer<typeof SsoInitSchema>;
export type MagicSendInput = z.infer<typeof MagicSendSchema>;
export type MagicVerifyInput = z.infer<typeof MagicVerifySchema>;
