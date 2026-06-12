-- =============================================================================
-- 20260612000005_org_invites.sql
-- Org invite tokens — used by GROE Admin provisioning flow (Prompt 8) and
-- Org Admin user enrollment (Prompt 9).
--
-- Design:
--   - Tokens are random 32-byte hex strings — not PII, safe in URLs (rule 4.3)
--   - accepted_at is set server-side via service role when a user accepts
--   - No UPDATE/DELETE RLS policies — row state changes via service role only
-- =============================================================================

CREATE TABLE public.org_invites (
  id              uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid             NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email           text             NOT NULL,
  role            public.user_role NOT NULL DEFAULT 'org_admin',
  invited_by_id   uuid             REFERENCES public.users(id) ON DELETE SET NULL,
  -- Random 32-byte token — only value exposed in the accept-invite URL
  token           text             NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz      NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz,     -- set by service role when the user completes onboarding
  created_at      timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_invites_token    ON public.org_invites(token);
CREATE INDEX idx_org_invites_org_id   ON public.org_invites(org_id);
CREATE INDEX idx_org_invites_email    ON public.org_invites(email);

ALTER TABLE public.org_invites ENABLE ROW LEVEL SECURITY;

-- GROE Admin can see all invites; Org Admin sees their own org's invites.
CREATE POLICY org_invites_select ON public.org_invites
  FOR SELECT USING (
    public.is_groe_staff()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
  );

-- Only GROE Admin can create invites (Org Admin invite flow is Prompt 9).
CREATE POLICY org_invites_insert ON public.org_invites
  FOR INSERT WITH CHECK (public.is_groe_admin());

-- No UPDATE/DELETE RLS — acceptance and expiry are handled via service role.
