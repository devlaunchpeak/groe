import { createBrowserClient } from "@supabase/ssr";

// Browser (client component) Supabase client — uses anon key only.
// Never used for sensitive data fetching (rule 4.8).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
