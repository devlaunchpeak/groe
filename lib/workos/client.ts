import { WorkOS } from "@workos-inc/node";

// Singleton WorkOS client — server-side only.
// Never import this in client components.
export const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
  clientId: process.env.WORKOS_CLIENT_ID!,
});

export const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID!;
