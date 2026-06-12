import { z } from "zod";

export const ProvisionOrgSchema = z.object({
  orgName: z
    .string()
    .min(2, "Organisation name must be at least 2 characters")
    .max(100),
  orgSlug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens"),
  adminEmail: z.string().email("Must be a valid email address"),
  adminFullName: z.string().min(2, "Full name is required").max(100),
});

export type ProvisionOrgInput = z.infer<typeof ProvisionOrgSchema>;
