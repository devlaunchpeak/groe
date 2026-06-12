# GROE Schema Review — Nirmal Shah

**Date:** June 2026  
**Reviewer:** Nirmal Shah (CTO, LaunchPeak Partners)  
**Prepared by:** Bon Ishimori / Claude Code  
**Status:** Awaiting sign-off before Sprint 2

---

## What you're reviewing

The Postgres schema for the GROE multi-tenant platform (`supabase/migrations/20260612000001_initial_schema.sql`). This is the foundational migration — every subsequent feature builds on top of it.

---

## Tables

| Table | Purpose | Sensitive? |
|---|---|---|
| `orgs` | Tenant root — one row per customer org | No |
| `users` | GROE user profiles; links to `auth.users` | Yes — role, scoring state |
| `assessments` | Assessment definitions/templates | No |
| `assessment_items` | Individual question rows | No |
| `assessment_results` | Raw responses + H-MTTR scores | Yes — health data |
| `modules` | Learning content units | No |
| `lessons` | Video lessons; `video_asset_id` is server-side only | Partial |
| `user_progress` | Per-user lesson completion state | No |
| `pace_tracking` | Weekly engagement metrics | No |
| `check_ins` | Weekly self-report responses | Yes — health data |
| `eap_contacts` | Org-specific Employee Assistance Program contacts | No |
| `coach_assignments` | Leader-to-IC pairing within an org | No |
| `audit_log` | Immutable action log (append-only trigger) | Yes |
| `org_invites` | Pending invite tokens (migration 0005) | Partial |

---

## Security decisions to verify

### 1. Multi-tenancy isolation (Rule 4.1)
Every table has `org_id`. RLS policies enforce strict isolation — a user from Org A cannot query any data from Org B. Two SECURITY DEFINER helper functions drive this:

```sql
-- Returns the org_id of the currently authenticated Supabase user
CREATE FUNCTION public.current_user_org_id() RETURNS uuid ...

-- Returns true if the current user has groe_admin or groe_viewer role
CREATE FUNCTION public.is_groe_staff() RETURNS boolean ...
```

**Question for Nirmal:** We're using WorkOS for auth (not Supabase Auth), so `auth.uid()` in RLS policies is always `null` for authenticated requests. All server-side queries use the **service role key** (bypasses RLS). The RLS policies are still correct and would block any accidental client-side direct queries, but they're not the primary enforcement layer — our API route role checks are. Is this architecture acceptable, or do you want RLS enforced for server-side queries too?

### 2. Auth model — WorkOS + Supabase service role
- WorkOS handles SSO (SAML 2.0), magic link (OTP), and SCIM
- Supabase is used as the database only — not for auth
- Server routes authenticate via WorkOS sealed sessions, then use service role to query DB
- No client-side Supabase queries

**Question for Nirmal:** The `users` table has `id UUID PRIMARY KEY REFERENCES auth.users(id)`. Since we're using WorkOS, we don't create Supabase Auth users in the normal flow — the seed data manually inserts into `auth.users`. For invited users (Prompt 9+), we'll need a strategy: either create a shadow `auth.users` entry, or drop the FK and use `workos_user_id` as the primary identity. What's your preference?

### 3. Audit log append-only (Rule 4.5)
Three `FOR EACH STATEMENT` triggers on `audit_log`:
- `BEFORE UPDATE` — raises exception
- `BEFORE DELETE` — raises exception  
- `BEFORE TRUNCATE` — raises exception

Using `FOR EACH STATEMENT` (not `FOR EACH ROW`) is intentional — `FOR EACH ROW` triggers silently skip when the `WHERE` clause matches zero rows.

### 4. Scoring — server-side only (Rule 4.2)
H-MTTR formula runs in a Supabase Edge Function (`supabase/functions/score-hmttr/`). Formula weights are named constants at the top of the file — swappable without touching logic:

```typescript
const MBI_EXHAUSTION_MAX = 54;  // OQ-01 placeholder
const CRITICAL_DISTRESS_THRESHOLD = 80;  // OQ-04 placeholder
```

### 5. Critical Distress safety gate (Rule 4.9)
- Threshold: `h_mttr_score > 80` (placeholder pending OQ-04 from Steve)
- Enforced in Edge Function — not client-side
- Sets `critical_distress_flagged = true` on `users` row
- `getRedirectPath()` in auth layer always redirects flagged users to `/eap` regardless of role
- EAP page queries only the user's own org's `eap_contacts` row

### 6. Org dashboard suppression (Rule 4.10)
- `org_aggregates` view — never exposes individual rows
- API must check `enrolled_users >= min_cohort_size` (default: 20) before returning any data
- If below threshold, API returns suppression flag + no data

### 7. Video asset IDs (Rule 4.2)
`lessons.video_asset_id` stores the raw Mux/Cloudflare asset ID. Column is never returned in API responses — all video URLs are signed server-side at `/api/video/signed-url` (Prompt 14).

---

## Open questions / placeholders

| ID | Placeholder | Impact |
|---|---|---|
| OQ-01 | H-MTTR formula weights | Scoring correctness |
| OQ-02 | ARENA question set | Assessment content |
| OQ-03 | MBI license + question text | Assessment content |
| OQ-04 | Critical Distress threshold (currently `> 80`) | Safety routing |
| OQ-07 | Assessment retake cadence (currently 30 days) | UX |

---

## What Nirmal needs to approve

- [ ] RLS policy design is acceptable given WorkOS auth model
- [ ] The `auth.users` FK strategy for WorkOS-provisioned users
- [ ] `org_aggregates` view correctly implements dashboard suppression requirement
- [ ] Audit log trigger implementation is sufficient for compliance
- [ ] Critical Distress placeholder threshold (`> 80`) is acceptable to ship with until OQ-04 resolved
- [ ] No PII stored in URLs (rule 4.3) — invite tokens are random hex, not email/org IDs

---

## Files for review

- [`supabase/migrations/20260612000001_initial_schema.sql`](../supabase/migrations/20260612000001_initial_schema.sql) — full schema
- [`supabase/migrations/20260612000005_org_invites.sql`](../supabase/migrations/20260612000005_org_invites.sql) — invite tokens
- [`supabase/functions/score-hmttr/index.ts`](../supabase/functions/score-hmttr/index.ts) — scoring Edge Function
- [`lib/workos/auth.ts`](../lib/workos/auth.ts) — role resolution + login block for deprovisioned users
- [`lib/audit/index.ts`](../lib/audit/index.ts) — audit action constants + logAuditEvent utility
