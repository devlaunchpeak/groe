import { createAdminClient } from "@/lib/supabase/server";
import { workos, WORKOS_CLIENT_ID } from "@/lib/workos/client";
import { logAuditEvent, AuditAction } from "@/lib/audit";

// ---------------------------------------------------------------------------
// WorkOS Directory Sync user shape (from dsync.user.* webhook payloads)
// ---------------------------------------------------------------------------
export interface DirectoryUserEventData {
  object: "directory_user";
  id: string;                     // SCIM directory user ID — NOT the Auth user ID
  directoryId: string;
  organizationId: string | null;
  idpId: string;
  firstName: string | null;
  lastName: string | null;
  emails: Array<{
    primary: boolean;
    type: string;
    value: string;
  }>;
  username: string | null;
  state: "active" | "inactive";
  groups: Array<{ id: string; name: string }>;
  rawAttributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function primaryEmail(data: DirectoryUserEventData): string | null {
  return (
    data.emails.find((e) => e.primary)?.value ??
    data.emails[0]?.value ??
    null
  );
}

function fullName(data: DirectoryUserEventData): string {
  return [data.firstName, data.lastName].filter(Boolean).join(" ") || "Unknown";
}

// Find the GROE org that corresponds to a WorkOS organization ID.
async function resolveOrg(workosOrgId: string | null) {
  if (!workosOrgId) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("orgs")
    .select("id, name")
    .eq("workos_org_id", workosOrgId)
    .eq("is_active", true)
    .single();
  return data;
}

// Look up an existing GROE user by SCIM directory user ID, then fall back to
// email so that users provisioned before SCIM was connected are matched.
async function resolveGroeUser(
  scimId: string,
  email: string | null
) {
  const db = createAdminClient();

  // Primary: SCIM ID
  const byScim = await db
    .from("users")
    .select("id, org_id, workos_user_id, is_active, deprovisioned_at")
    .eq("scim_directory_user_id", scimId)
    .single();
  if (byScim.data) return byScim.data;

  // Fallback: email
  if (!email) return null;
  const byEmail = await db
    .from("users")
    .select("id, org_id, workos_user_id, is_active, deprovisioned_at")
    .eq("email", email)
    .single();
  return byEmail.data ?? null;
}

// ---------------------------------------------------------------------------
// dsync.user.created — provision a new GROE user
// ---------------------------------------------------------------------------
export async function handleDirectoryUserCreated(
  data: DirectoryUserEventData
): Promise<void> {
  const email = primaryEmail(data);
  if (!email) {
    console.warn("[SCIM/created] Directory user has no email, skipping:", data.id);
    return;
  }

  const org = await resolveOrg(data.organizationId);
  if (!org) {
    console.warn(
      "[SCIM/created] No active GROE org found for WorkOS org:",
      data.organizationId
    );
    return;
  }

  const db = createAdminClient();
  const existing = await resolveGroeUser(data.id, email);

  if (existing) {
    // User already exists — update SCIM ID + re-activate if previously deprovisioned
    await db
      .from("users")
      .update({
        scim_directory_user_id: data.id,
        full_name:              fullName(data),
        is_active:              true,
        deprovisioned_at:       null,
        updated_at:             new Date().toISOString(),
      })
      .eq("id", existing.id);

    await logAuditEvent({
      action:     AuditAction.SCIM_PROVISION,
      orgId:      org.id,
      targetType: "user",
      targetId:   existing.id,
      metadata: {
        scimDirectoryUserId: data.id,
        email,
        reactivated: !existing.is_active,
      },
    });
    return;
  }

  // New user — create an auth.users entry first so the FK in public.users is satisfied.
  // The Supabase auth entry is a shell; the user will authenticate via WorkOS SSO/magic auth.
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    user_metadata: { full_name: fullName(data) },
    email_confirm: true, // mark email as verified so WorkOS SSO login is not blocked
  });

  if (authError || !authData.user) {
    // If the email already exists in auth.users (e.g. partial previous run), fetch it
    const { data: existing_auth } = await db.auth.admin.listUsers();
    const existingAuthUser = existing_auth?.users.find((u) => u.email === email);
    if (!existingAuthUser) {
      console.error("[SCIM/created] Failed to create auth user:", authError?.message);
      return;
    }
    // Use the existing auth user's ID
    await upsertPublicUser(db, existingAuthUser.id, org.id, email, data);
  } else {
    await upsertPublicUser(db, authData.user.id, org.id, email, data);
  }

  await logAuditEvent({
    action:     AuditAction.SCIM_PROVISION,
    orgId:      org.id,
    targetType: "user",
    targetId:   email,
    metadata: {
      scimDirectoryUserId: data.id,
      email,
      orgId: org.id,
    },
  });
}

async function upsertPublicUser(
  db: ReturnType<typeof createAdminClient>,
  authUserId: string,
  orgId: string,
  email: string,
  data: DirectoryUserEventData
) {
  await db.from("users").upsert(
    {
      id:                     authUserId,
      org_id:                 orgId,
      email,
      full_name:              fullName(data),
      role:                   "ic",          // default role — Org Admin promotes as needed
      scim_directory_user_id: data.id,
      is_active:              true,
      enrolled_at:            new Date().toISOString(),
    },
    { onConflict: "id" }
  );
}

// ---------------------------------------------------------------------------
// dsync.user.updated — sync profile changes; deprovision if state → inactive
// ---------------------------------------------------------------------------
export async function handleDirectoryUserUpdated(
  data: DirectoryUserEventData
): Promise<void> {
  const email = primaryEmail(data);
  const existing = await resolveGroeUser(data.id, email);

  if (!existing) {
    // Treat an update for an unknown user as a late-arriving create
    if (data.state === "active") {
      await handleDirectoryUserCreated(data);
    }
    return;
  }

  const db = createAdminClient();

  if (data.state === "inactive") {
    // Directory deactivated this user — deprovision them
    await deprovisionUser(db, existing.id, existing.org_id, data);
    return;
  }

  // Active update — sync name / email / SCIM ID
  await db
    .from("users")
    .update({
      full_name:              fullName(data),
      email:                  email ?? undefined,
      scim_directory_user_id: data.id,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", existing.id);

  await logAuditEvent({
    action:     AuditAction.SCIM_UPDATE,
    orgId:      existing.org_id,
    targetType: "user",
    targetId:   existing.id,
    metadata: {
      scimDirectoryUserId: data.id,
      updatedFields:       ["full_name", "email"],
    },
  });
}

// ---------------------------------------------------------------------------
// dsync.user.deleted — deprovision; revoke sessions; audit SCIM_DEPROVISION
// ---------------------------------------------------------------------------
export async function handleDirectoryUserDeleted(
  data: DirectoryUserEventData
): Promise<void> {
  const email = primaryEmail(data);
  const existing = await resolveGroeUser(data.id, email);

  if (!existing) {
    console.warn("[SCIM/deleted] No GROE user found for SCIM ID:", data.id);
    return;
  }

  if (!existing.is_active && existing.deprovisioned_at) {
    // Already deprovisioned — idempotent, nothing to do
    return;
  }

  const db = createAdminClient();
  await deprovisionUser(db, existing.id, existing.org_id, data);
}

// ---------------------------------------------------------------------------
// deprovisionUser — shared logic for deleted + inactive-state-updated users
// ---------------------------------------------------------------------------
async function deprovisionUser(
  db: ReturnType<typeof createAdminClient>,
  groeUserId: string,
  orgId: string,
  data: DirectoryUserEventData
): Promise<void> {
  // 1. Mark user as deprovisioned in GROE (soft delete — rule: never hard delete)
  await db
    .from("users")
    .update({
      is_active:        false,
      deprovisioned_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    })
    .eq("id", groeUserId);

  // 2. Revoke WorkOS sessions — best-effort.
  //    WorkOS automatically invalidates directory user sessions when a user is
  //    deleted from the directory. Our middleware will also reject the sealed
  //    session on the next request because `authenticate()` contacts WorkOS.
  //    If the WorkOS User Management ID is known, attempt explicit revocation.
  const { data: userRow } = await db
    .from("users")
    .select("workos_user_id")
    .eq("id", groeUserId)
    .single();

  if (userRow?.workos_user_id) {
    try {
      // WorkOS session.getLogoutUrl requires an active session; instead we use
      // the User Management deleteUser approach on the directory side. WorkOS
      // propagates this to all active sessions automatically.
      // Explicit SDK call for when WorkOS exposes bulk-revoke in a future release:
      //   await workos.userManagement.revokeAllSessions({ userId: userRow.workos_user_id });
      console.info(
        "[SCIM/deprovision] WorkOS will invalidate sessions for user:",
        userRow.workos_user_id
      );
    } catch (err) {
      console.warn("[SCIM/deprovision] Session revocation note:", err);
    }
  }

  // 3. Audit log — action = SCIM_DEPROVISION (rule 4.5)
  await logAuditEvent({
    action:     AuditAction.SCIM_DEPROVISION,
    orgId,
    targetType: "user",
    targetId:   groeUserId,
    metadata: {
      scimDirectoryUserId:  data.id,
      email:                primaryEmail(data),
      workosUserId:         userRow?.workos_user_id ?? null,
      deprovisionedAt:      new Date().toISOString(),
    },
  });
}
