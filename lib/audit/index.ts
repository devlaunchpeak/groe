import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// TYPED ACTION CONSTANTS
// Convention: domain.subdomain.verb — all lowercase, dot-separated.
// Always use these constants; never pass raw strings to logAuditEvent.
// =============================================================================
export const AuditAction = {
  // ── Authentication ──────────────────────────────────────────────────────────
  /** Enterprise SSO (SAML/OIDC) sign-in completed */
  AUTH_LOGIN_SSO:               "auth.login.sso",
  /** Magic-link OTP sign-in completed */
  AUTH_LOGIN_MAGIC:             "auth.login.magic",
  /** User session ended */
  AUTH_LOGOUT:                  "auth.logout",
  /** Magic-link OTP code was dispatched to an email address */
  AUTH_MAGIC_LINK_SENT:         "auth.magic_link.sent",
  /** SSO authorization URL generated — user redirected to IdP */
  AUTH_SSO_INITIATED:           "auth.sso.initiated",

  // ── SCIM user provisioning ──────────────────────────────────────────────────
  /** WorkOS directory sync created/re-activated a user */
  SCIM_PROVISION:               "scim.provision",
  /** WorkOS directory sync deactivated a user (soft-delete, rule 4.5) */
  SCIM_DEPROVISION:             "scim.deprovision",
  /** WorkOS directory sync updated a user's profile */
  SCIM_UPDATE:                  "scim.update",

  // ── Org + user administration ────────────────────────────────────────────────
  /** GROE Admin created a new org */
  ORG_CREATED:                  "admin.org.created",
  /** Invite email dispatched to an Org Admin or IC */
  ORG_INVITE_SENT:              "admin.invite.sent",
  /** Invite accepted — user completed onboarding */
  ORG_INVITE_ACCEPTED:          "admin.invite.accepted",

  // ── Assessments ─────────────────────────────────────────────────────────────
  /** User submitted raw assessment responses */
  SUBMIT_ASSESSMENT:            "assessment.submitted",
  /** Edge Function computed H-MTTR score and wrote assessment_results row */
  SCORE_COMPUTED:               "assessment.scored",
  /** H-MTTR score exceeded Critical Distress threshold (OQ-04, rule 4.9) */
  CRITICAL_DISTRESS_TRIGGERED:  "assessment.critical_distress",

  // ── EAP ─────────────────────────────────────────────────────────────────────
  /** User viewed the EAP contact page (rule 4.9) */
  EAP_VIEWED:                   "eap.viewed",

  // ── Learning ─────────────────────────────────────────────────────────────────
  /** User started a learning module */
  MODULE_STARTED:               "learning.module.started",
  /** User completed a lesson */
  LESSON_COMPLETED:             "learning.lesson.completed",

  // ── Check-ins ────────────────────────────────────────────────────────────────
  /** User submitted a weekly check-in */
  CHECKIN_LOGGED:               "checkin.logged",

  // ── Content management ───────────────────────────────────────────────────────
  /** GROE Admin uploaded new video/lesson content */
  CONTENT_UPLOADED:             "content.uploaded",
  /** GROE Admin edited existing content */
  CONTENT_UPDATED:              "content.updated",

  // ── Destructive admin actions ────────────────────────────────────────────────
  /** GROE Admin soft-deleted a user record */
  USER_DELETED:                 "admin.user.deleted",
  /** GROE Admin soft-deleted an org record */
  ORG_DELETED:                  "admin.org.deleted",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// =============================================================================
// INPUT TYPE
// =============================================================================
export interface AuditEventInput {
  /** Use an AuditAction constant — do not pass ad-hoc strings */
  action: AuditActionType | (string & Record<never, never>);
  /** GROE user ID of the actor. Null for webhook/system events. */
  userId?: string | null;
  /** Org ID of the actor or the resource being acted on */
  orgId?: string | null;
  /** Type of the primary resource affected, e.g. "user", "assessment_result" */
  targetType?: string;
  /** ID of the primary resource affected */
  targetId?: string;
  /** Arbitrary structured context — keep it sanitized (no secrets, no PII beyond IDs) */
  metadata?: Record<string, unknown>;
  /**
   * Pass the Next.js Request object to extract IP and User-Agent automatically.
   * Explicit ipAddress / userAgent fields take precedence when both are provided.
   */
  request?: Request;
  /** Override extracted IP (use when Request is unavailable) */
  ipAddress?: string;
  /** Override extracted User-Agent */
  userAgent?: string;
}

// =============================================================================
// PRIVATE HELPERS
// =============================================================================

function extractIp(request: Request): string | null {
  // x-forwarded-for can be a comma-separated list; first entry is the client IP.
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

function extractUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  return ua ? ua.slice(0, 500) : null; // truncate to avoid DB bloat
}

// =============================================================================
// logAuditEvent
//
// Inserts one row into the append-only audit_log table (rule 4.5).
//
// The database-level append-only guarantee is enforced by PostgreSQL triggers
// defined in migration 20260612000001_initial_schema.sql:
//   - audit_log_no_update: BEFORE UPDATE → RAISE EXCEPTION
//   - audit_log_no_delete: BEFORE DELETE → RAISE EXCEPTION
// This function is the application-layer call point; the trigger is the
// hard guarantee. Both layers are required (rule 4.5).
//
// NEVER throws — a logging failure must not break the caller's primary flow.
// =============================================================================
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const ipAddress = event.ipAddress ?? (event.request ? extractIp(event.request)       : null);
    const userAgent = event.userAgent ?? (event.request ? extractUserAgent(event.request) : null);

    const db = createAdminClient();
    const { error } = await db.from("audit_log").insert({
      org_id:      event.orgId      ?? null,
      user_id:     event.userId     ?? null,
      action:      event.action,
      target_type: event.targetType ?? null,
      target_id:   event.targetId   ?? null,
      metadata:    event.metadata   ?? {},
      ip_address:  ipAddress,
      user_agent:  userAgent,
    });

    if (error) {
      console.error("[Audit] insert failed — action:", event.action, "—", error.message);
    }
  } catch (err) {
    console.error("[Audit] logAuditEvent threw unexpectedly:", err);
  }
}
