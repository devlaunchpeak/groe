import { createAdminClient } from "@/lib/supabase/server";
import { ROLE_REDIRECT, type UserRole } from "./session";

// ---------------------------------------------------------------------------
// GROE user profile — minimal shape needed for routing + access control
// ---------------------------------------------------------------------------
export interface GroeUser {
  id: string;
  orgId: string;
  role: UserRole;
  isActive: boolean;
  criticalDistressFlagged: boolean;
}

// ---------------------------------------------------------------------------
// Look up a GROE user by WorkOS user ID, falling back to email if the
// workos_user_id has not been synced yet (e.g. manually provisioned users).
// On first login by email match the workos_user_id is written back.
// ---------------------------------------------------------------------------
export async function getGroeUserByWorkosId(
  workosUserId: string,
  email: string
): Promise<GroeUser | null> {
  const db = createAdminClient();

  // Primary lookup: workos_user_id
  let { data } = await db
    .from("users")
    .select("id, org_id, role, is_active, critical_distress_flagged, workos_user_id")
    .eq("workos_user_id", workosUserId)
    .eq("is_active", true)
    .single();

  // Fallback: email (for users provisioned before SSO was linked)
  if (!data) {
    const fallback = await db
      .from("users")
      .select("id, org_id, role, is_active, critical_distress_flagged, workos_user_id")
      .eq("email", email)
      .eq("is_active", true)
      .single();
    data = fallback.data;

    // Sync the WorkOS user ID so subsequent logins use the primary path
    if (data && !data.workos_user_id) {
      await db
        .from("users")
        .update({ workos_user_id: workosUserId })
        .eq("id", data.id);
    }
  }

  if (!data) return null;

  return {
    id: data.id,
    orgId: data.org_id,
    role: data.role as UserRole,
    isActive: data.is_active,
    criticalDistressFlagged: data.critical_distress_flagged,
  };
}

// ---------------------------------------------------------------------------
// Determine the post-login redirect path for a user.
// Critical distress always overrides the role-based path (rule 4.9).
// ---------------------------------------------------------------------------
export function getRedirectPath(groeUser: GroeUser): string {
  if (groeUser.criticalDistressFlagged) return "/eap";
  return ROLE_REDIRECT[groeUser.role] ?? "/dashboard";
}
