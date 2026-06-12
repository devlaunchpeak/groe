-- =============================================================================
-- 20260612000001_initial_schema.sql
-- GROE Platform — Full initial schema, RLS policies, and seed data
--
-- Rules enforced by this file:
--   4.1  org_id on every user/org table; RLS policies enforce cross-org isolation
--   4.5  audit_log is append-only (triggers prevent UPDATE/DELETE)
--   4.9  critical_distress_flagged column; threshold enforced in Edge Function
--   4.10 org_aggregates view never exposes individual rows
--
-- Order:
--   1. Extensions + enums
--   2. Trigger functions that reference NO tables (safe to define early)
--   3. All table definitions + per-table triggers
--   4. Indexes
--   5. SECURITY DEFINER RLS helper functions (require public.users to exist first)
--   6. Enable RLS on all tables
--   7. RLS policies
--   8. org_aggregates view
--   9. Seed data
-- =============================================================================

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. ENUM TYPES
-- =============================================================================
CREATE TYPE public.user_role AS ENUM (
  'ic',          -- Individual Contributor
  'leader',      -- Leader / Manager
  'org_admin',   -- Org Administrator
  'groe_admin',  -- GROE Platform Administrator
  'groe_viewer'  -- GROE Read-Only Viewer
);

CREATE TYPE public.rag_status AS ENUM (
  'resilient',   -- Green  — recovered / healthy
  'developing',  -- Amber  — moderate burnout risk
  'acute'        -- Red    — high burnout risk
);

CREATE TYPE public.assessment_type AS ENUM (
  'mbi',       -- Maslach Burnout Inventory
  'arena',     -- ARENA resilience assessment (placeholder — OQ-02)
  'check_in'   -- Weekly check-in
);

CREATE TYPE public.lesson_status AS ENUM (
  'not_started',
  'in_progress',
  'completed'
);

-- =============================================================================
-- 3. TRIGGER FUNCTIONS (no table references — safe to create before tables)
-- =============================================================================

-- Shared updated_at stamper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Append-only guard for audit_log (rule 4.5).
-- IMPORTANT: must be used with FOR EACH STATEMENT triggers (not FOR EACH ROW).
-- FOR EACH ROW triggers only fire when ≥1 row matches the WHERE clause, so a
-- DELETE/UPDATE against a non-existent row silently succeeds. FOR EACH STATEMENT
-- fires unconditionally on any DELETE/UPDATE/TRUNCATE attempt.
CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only and cannot be modified';
END;
$$;

-- =============================================================================
-- 4. TABLE DEFINITIONS (FK dependency order) + per-table triggers
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orgs  (tenant root)
-- ---------------------------------------------------------------------------
CREATE TABLE public.orgs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text        NOT NULL,
  slug             text        NOT NULL UNIQUE,
  workos_org_id    text        UNIQUE,               -- WorkOS SSO organization ID
  is_active        boolean     NOT NULL DEFAULT true,
  min_cohort_size  integer     NOT NULL DEFAULT 20,  -- dashboard suppression floor (rule 4.10)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER orgs_updated_at
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- eap_contacts  (FK: orgs — defined before users for optional denorm)
-- ---------------------------------------------------------------------------
CREATE TABLE public.eap_contacts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  title       text,
  phone       text,
  email       text,
  website     text,
  description text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER eap_contacts_updated_at
  BEFORE UPDATE ON public.eap_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- users  (extends auth.users; one row per platform user)
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id                        uuid              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id                    uuid              NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  email                     text              NOT NULL,
  full_name                 text,
  role                      public.user_role  NOT NULL DEFAULT 'ic',
  workos_user_id            text              UNIQUE,
  scim_directory_user_id    text              UNIQUE,   -- WorkOS Directory Sync ID (distinct from workos_user_id)
  is_active                 boolean           NOT NULL DEFAULT true,
  deprovisioned_at          timestamptz,               -- set when SCIM-deprovisioned
  -- Cached scoring state — source of truth is assessment_results
  h_mttr_score              smallint          CHECK (h_mttr_score BETWEEN 0 AND 100),
  rag_status                public.rag_status,
  -- Safety flag (rule 4.9) — threshold: h_mttr_score > 80 (OQ-04 placeholder)
  critical_distress_flagged boolean           NOT NULL DEFAULT false,
  last_assessment_at        timestamptz,
  enrolled_at               timestamptz       NOT NULL DEFAULT now(),
  created_at                timestamptz       NOT NULL DEFAULT now(),
  updated_at                timestamptz       NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_users_scim_directory_user_id
  ON public.users(scim_directory_user_id)
  WHERE scim_directory_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.scim_directory_user_id IS
  'WorkOS Directory Sync user ID (dsync.user.* events). Distinct from workos_user_id (Auth/User Management ID).';

COMMENT ON COLUMN public.users.deprovisioned_at IS
  'Timestamp of SCIM deprovisioning. is_active is false whenever this is set.';

-- ---------------------------------------------------------------------------
-- assessments  (definitions / templates; NULL org_id = global template)
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessments (
  id         uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid                    REFERENCES public.orgs(id) ON DELETE CASCADE,
  name       text                    NOT NULL,
  type       public.assessment_type  NOT NULL,
  version    integer                 NOT NULL DEFAULT 1,
  is_active  boolean                 NOT NULL DEFAULT true,
  created_at timestamptz             NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- assessment_items  (individual questions within an assessment)
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessment_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        REFERENCES public.orgs(id) ON DELETE CASCADE,
  assessment_id  uuid        NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_text  text        NOT NULL,
  -- MBI subscales: 'exhaustion' | 'cynicism' | 'efficacy'
  -- ARENA domains: TBD (OQ-02)
  subscale       text,
  item_order     integer     NOT NULL,
  response_type  text        NOT NULL DEFAULT 'likert_7',
  reverse_scored boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- assessment_results  (immutable once written — no UPDATE/DELETE RLS policies)
-- Scoring performed exclusively by the score-hmttr Edge Function (rule 4.2).
-- ---------------------------------------------------------------------------
CREATE TABLE public.assessment_results (
  id                        uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid              NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id                   uuid              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assessment_id             uuid              NOT NULL REFERENCES public.assessments(id),
  -- Raw responses stored for audit trail; never used for client-side scoring
  raw_responses             jsonb             NOT NULL,   -- [{item_id, response_value}]
  -- Subscale scores written by Edge Function
  mbi_exhaustion_raw        smallint,                     -- 0–54  (OQ-01 placeholder)
  mbi_cynicism_raw          smallint,                     -- 0–30  (OQ-01 placeholder)
  mbi_efficacy_raw          smallint,                     -- 0–48  (OQ-01 placeholder)
  arena_score               smallint,                     -- 0–100 (OQ-02 placeholder)
  h_mttr_score              smallint          CHECK (h_mttr_score BETWEEN 0 AND 100),
  rag_status                public.rag_status,
  critical_distress_flagged boolean           NOT NULL DEFAULT false,
  completed_at              timestamptz       NOT NULL DEFAULT now(),
  created_at                timestamptz       NOT NULL DEFAULT now()
  -- No updated_at: intentionally immutable
);

-- ---------------------------------------------------------------------------
-- modules  (learning content units; NULL org_id = global/platform content)
-- ---------------------------------------------------------------------------
CREATE TABLE public.modules (
  id           uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid              REFERENCES public.orgs(id) ON DELETE CASCADE,
  title        text              NOT NULL,
  description  text,
  rag_target   public.rag_status,   -- which RAG cohort this module is prescribed for
  sort_order   integer           NOT NULL DEFAULT 0,
  is_published boolean           NOT NULL DEFAULT false,
  created_at   timestamptz       NOT NULL DEFAULT now(),
  updated_at   timestamptz       NOT NULL DEFAULT now()
);

CREATE TRIGGER modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- lessons  (video lessons within a module)
-- IMPORTANT: video_asset_id is the raw vendor asset ID — it must NEVER be
-- returned to the client directly. The API layer signs it server-side (rule 4.2).
-- ---------------------------------------------------------------------------
CREATE TABLE public.lessons (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        REFERENCES public.orgs(id) ON DELETE CASCADE,
  module_id        uuid        NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  video_asset_id   text,       -- Raw vendor asset ID — server-side only (rule 4.2)
  duration_seconds integer,
  transcript       text,
  sort_order       integer     NOT NULL DEFAULT 0,
  is_published     boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_progress  (per-user lesson completion state)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_progress (
  id           uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid                 NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id      uuid                 NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id    uuid                 NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  module_id    uuid                 NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  status       public.lesson_status NOT NULL DEFAULT 'not_started',
  progress_pct smallint             NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed_at timestamptz,
  created_at   timestamptz          NOT NULL DEFAULT now(),
  updated_at   timestamptz          NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE TRIGGER user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pace_tracking  (weekly engagement metrics per user)
-- ---------------------------------------------------------------------------
CREATE TABLE public.pace_tracking (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start          date        NOT NULL,
  lessons_completed   smallint    NOT NULL DEFAULT 0,
  check_ins_completed smallint    NOT NULL DEFAULT 0,
  minutes_engaged     integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

CREATE TRIGGER pace_tracking_updated_at
  BEFORE UPDATE ON public.pace_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- check_ins  (weekly self-reports; immutable once submitted)
-- ---------------------------------------------------------------------------
CREATE TABLE public.check_ins (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_number   integer     NOT NULL,
  responses     jsonb       NOT NULL,   -- [{question_key, response_value}]
  h_mttr_delta  smallint,               -- signed delta from previous assessment
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
  -- No updated_at: immutable. RLS omits UPDATE/DELETE policies.
);

-- ---------------------------------------------------------------------------
-- coach_assignments  (leader-to-IC pairing within an org)
-- ---------------------------------------------------------------------------
CREATE TABLE public.coach_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  coach_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coach_id, member_id)
);

-- ---------------------------------------------------------------------------
-- audit_log  (APPEND-ONLY — rule 4.5)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        REFERENCES public.orgs(id),    -- nullable: cross-org admin actions
  user_id     uuid        REFERENCES auth.users(id),     -- who performed the action
  action      text        NOT NULL,                       -- typed constant from lib/audit
  target_type text,                                       -- e.g. 'user', 'assessment_result'
  target_id   text,                                       -- ID of the affected record
  metadata    jsonb,                                      -- additional context (sanitized)
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- FOR EACH STATEMENT: fires even when WHERE clause matches zero rows.
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- TRUNCATE bypasses DELETE triggers entirely — needs its own guard.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- =============================================================================
-- 5. INDEXES
-- =============================================================================

CREATE INDEX idx_users_org_id             ON public.users(org_id);
CREATE INDEX idx_users_role               ON public.users(role);
CREATE INDEX idx_users_critical_distress
  ON public.users(org_id) WHERE critical_distress_flagged = true;

CREATE INDEX idx_eap_contacts_org_id      ON public.eap_contacts(org_id);

CREATE INDEX idx_assessment_items_assessment_id
  ON public.assessment_items(assessment_id);

CREATE INDEX idx_assessment_results_user_id
  ON public.assessment_results(user_id);
CREATE INDEX idx_assessment_results_org_id
  ON public.assessment_results(org_id);
CREATE INDEX idx_assessment_results_completed_at
  ON public.assessment_results(completed_at DESC);

CREATE INDEX idx_modules_rag_target       ON public.modules(rag_target);

CREATE INDEX idx_lessons_module_id        ON public.lessons(module_id);

CREATE INDEX idx_user_progress_user_id    ON public.user_progress(user_id);
CREATE INDEX idx_user_progress_org_id     ON public.user_progress(org_id);
CREATE INDEX idx_user_progress_module_id  ON public.user_progress(module_id);

CREATE INDEX idx_pace_tracking_user_id    ON public.pace_tracking(user_id);
CREATE INDEX idx_pace_tracking_org_week   ON public.pace_tracking(org_id, week_start DESC);

CREATE INDEX idx_check_ins_user_id        ON public.check_ins(user_id);
CREATE INDEX idx_check_ins_org_id         ON public.check_ins(org_id);

CREATE INDEX idx_coach_assignments_org_id
  ON public.coach_assignments(org_id);
CREATE INDEX idx_coach_assignments_coach_id
  ON public.coach_assignments(coach_id);
CREATE INDEX idx_coach_assignments_member_id
  ON public.coach_assignments(member_id);

CREATE INDEX idx_audit_log_org_id         ON public.audit_log(org_id);
CREATE INDEX idx_audit_log_user_id        ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_created_at     ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action         ON public.audit_log(action);

-- =============================================================================
-- 6. SECURITY DEFINER RLS HELPER FUNCTIONS
-- Must come AFTER public.users is created because LANGUAGE sql validates
-- table references at function-creation time.
-- =============================================================================

-- Returns the org_id of the currently authenticated user.
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.users WHERE id = auth.uid();
$$;

-- Returns the role of the currently authenticated user.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Returns true for groe_admin OR groe_viewer (read-anywhere privilege).
CREATE OR REPLACE FUNCTION public.is_groe_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('groe_admin', 'groe_viewer')
  );
$$;

-- Returns true for groe_admin only (write privilege).
CREATE OR REPLACE FUNCTION public.is_groe_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'groe_admin'
  );
$$;

-- =============================================================================
-- 7. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- =============================================================================

ALTER TABLE public.orgs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pace_tracking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eap_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 8. RLS POLICIES
-- Pattern: users see their own org; GROE staff see all orgs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orgs
-- ---------------------------------------------------------------------------
CREATE POLICY orgs_select ON public.orgs
  FOR SELECT USING (
    id = public.current_user_org_id()
    OR public.is_groe_staff()
  );

CREATE POLICY orgs_insert ON public.orgs
  FOR INSERT WITH CHECK (public.is_groe_admin());

CREATE POLICY orgs_update ON public.orgs
  FOR UPDATE
  USING    (public.is_groe_admin())
  WITH CHECK (public.is_groe_admin());
-- No DELETE — orgs are deactivated via is_active, never removed.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- ICs see only themselves; leaders and org_admin see their org; GROE staff see all.
CREATE POLICY users_select ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() IN ('leader', 'org_admin')
    )
    OR public.is_groe_staff()
  );

-- Org Admin can provision users in their org; GROE Admin can provision anywhere.
CREATE POLICY users_insert ON public.users
  FOR INSERT WITH CHECK (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_admin()
  );

-- Users update their own profile; Org Admin updates their org; GROE Admin updates all.
CREATE POLICY users_update ON public.users
  FOR UPDATE
  USING (
    id = auth.uid()
    OR (org_id = public.current_user_org_id() AND public.current_user_role() = 'org_admin')
    OR public.is_groe_admin()
  );
-- No DELETE — users are deactivated via is_active.

-- ---------------------------------------------------------------------------
-- assessments
-- ---------------------------------------------------------------------------
CREATE POLICY assessments_select ON public.assessments
  FOR SELECT USING (
    org_id IS NULL                               -- global template, visible to all
    OR org_id = public.current_user_org_id()
    OR public.is_groe_staff()
  );

CREATE POLICY assessments_insert ON public.assessments
  FOR INSERT WITH CHECK (public.is_groe_admin());

CREATE POLICY assessments_update ON public.assessments
  FOR UPDATE USING (public.is_groe_admin());

CREATE POLICY assessments_delete ON public.assessments
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- assessment_items
-- ---------------------------------------------------------------------------
CREATE POLICY assessment_items_select ON public.assessment_items
  FOR SELECT USING (
    org_id IS NULL
    OR org_id = public.current_user_org_id()
    OR public.is_groe_staff()
  );

CREATE POLICY assessment_items_insert ON public.assessment_items
  FOR INSERT WITH CHECK (public.is_groe_admin());

CREATE POLICY assessment_items_update ON public.assessment_items
  FOR UPDATE USING (public.is_groe_admin());

CREATE POLICY assessment_items_delete ON public.assessment_items
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- assessment_results  (intentionally immutable — no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------
-- Users see their own results; Org Admin sees their org's results; GROE staff see all.
-- Leaders do NOT have direct row access — they query org_aggregates (rule 4.10).
CREATE POLICY assessment_results_select ON public.assessment_results
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_staff()
  );

-- Service role (Edge Function) inserts results; users cannot INSERT directly.
-- The score-hmttr Edge Function uses the service role key which bypasses RLS.
-- This policy blocks accidental direct INSERT from client-authenticated requests.
CREATE POLICY assessment_results_insert ON public.assessment_results
  FOR INSERT WITH CHECK (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- modules
-- ---------------------------------------------------------------------------
CREATE POLICY modules_select ON public.modules
  FOR SELECT USING (
    (
      is_published = true
      AND (org_id IS NULL OR org_id = public.current_user_org_id())
    )
    OR public.is_groe_staff()
  );

CREATE POLICY modules_insert ON public.modules
  FOR INSERT WITH CHECK (public.is_groe_admin());

CREATE POLICY modules_update ON public.modules
  FOR UPDATE USING (public.is_groe_admin());

CREATE POLICY modules_delete ON public.modules
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- lessons
-- NOTE: video_asset_id is readable server-side but the API layer MUST strip
-- it before returning lesson data to the client (rule 4.2).
-- ---------------------------------------------------------------------------
CREATE POLICY lessons_select ON public.lessons
  FOR SELECT USING (
    (
      is_published = true
      AND (org_id IS NULL OR org_id = public.current_user_org_id())
    )
    OR public.is_groe_staff()
  );

CREATE POLICY lessons_insert ON public.lessons
  FOR INSERT WITH CHECK (public.is_groe_admin());

CREATE POLICY lessons_update ON public.lessons
  FOR UPDATE USING (public.is_groe_admin());

CREATE POLICY lessons_delete ON public.lessons
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- user_progress
-- ---------------------------------------------------------------------------
CREATE POLICY user_progress_select ON public.user_progress
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() IN ('leader', 'org_admin')
    )
    OR public.is_groe_staff()
  );

CREATE POLICY user_progress_insert ON public.user_progress
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_groe_admin()
  );

CREATE POLICY user_progress_update ON public.user_progress
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.is_groe_admin()
  );

-- ---------------------------------------------------------------------------
-- pace_tracking
-- ---------------------------------------------------------------------------
CREATE POLICY pace_tracking_select ON public.pace_tracking
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() IN ('leader', 'org_admin')
    )
    OR public.is_groe_staff()
  );

CREATE POLICY pace_tracking_insert ON public.pace_tracking
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_groe_admin()
  );

CREATE POLICY pace_tracking_update ON public.pace_tracking
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.is_groe_admin()
  );

-- ---------------------------------------------------------------------------
-- check_ins  (intentionally immutable — no UPDATE/DELETE policies)
-- ---------------------------------------------------------------------------
CREATE POLICY check_ins_select ON public.check_ins
  FOR SELECT USING (
    user_id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_staff()
  );

CREATE POLICY check_ins_insert ON public.check_ins
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_groe_admin()
  );

-- ---------------------------------------------------------------------------
-- eap_contacts  (rule 4.9: users ONLY see their own org's EAP contact)
-- ---------------------------------------------------------------------------
CREATE POLICY eap_contacts_select ON public.eap_contacts
  FOR SELECT USING (
    org_id = public.current_user_org_id()
    OR public.is_groe_staff()
  );

CREATE POLICY eap_contacts_insert ON public.eap_contacts
  FOR INSERT WITH CHECK (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_admin()
  );

CREATE POLICY eap_contacts_update ON public.eap_contacts
  FOR UPDATE USING (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_admin()
  );

CREATE POLICY eap_contacts_delete ON public.eap_contacts
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- coach_assignments
-- ---------------------------------------------------------------------------
-- Coaches see their own assignments; members see who their coach is;
-- Org Admin sees their org; GROE staff see all.
CREATE POLICY coach_assignments_select ON public.coach_assignments
  FOR SELECT USING (
    coach_id  = auth.uid()
    OR member_id = auth.uid()
    OR (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_staff()
  );

CREATE POLICY coach_assignments_insert ON public.coach_assignments
  FOR INSERT WITH CHECK (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_admin()
  );

CREATE POLICY coach_assignments_update ON public.coach_assignments
  FOR UPDATE USING (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_admin()
  );

CREATE POLICY coach_assignments_delete ON public.coach_assignments
  FOR DELETE USING (public.is_groe_admin());

-- ---------------------------------------------------------------------------
-- audit_log  (rule 4.5)
-- Regular users have no SELECT access. Org Admin reads their org logs.
-- INSERT allowed for all authenticated users via logAuditEvent() utility.
-- UPDATE/DELETE blocked by triggers (defined above).
-- ---------------------------------------------------------------------------
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (
    (
      org_id = public.current_user_org_id()
      AND public.current_user_role() = 'org_admin'
    )
    OR public.is_groe_staff()
  );

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 9. VIEW: org_aggregates
-- Rule 4.10: never exposes individual-level rows.
-- The API layer MUST check enrolled_users >= min_cohort_size before
-- returning any data from this view.
-- =============================================================================
CREATE OR REPLACE VIEW public.org_aggregates
WITH (security_invoker = true)
AS
SELECT
  o.id                                                          AS org_id,
  o.name                                                        AS org_name,
  o.min_cohort_size,
  COUNT(DISTINCT u.id)                                          AS enrolled_users,
  COUNT(DISTINCT u.id) FILTER (WHERE u.is_active = true)        AS active_users,
  ROUND(AVG(u.h_mttr_score))::smallint                          AS avg_h_mttr_score,
  COUNT(u.id) FILTER (WHERE u.rag_status = 'resilient')         AS count_resilient,
  COUNT(u.id) FILTER (WHERE u.rag_status = 'developing')        AS count_developing,
  COUNT(u.id) FILTER (WHERE u.rag_status = 'acute')             AS count_acute,
  COUNT(u.id) FILTER (WHERE u.critical_distress_flagged = true) AS count_critical_distress
FROM public.orgs o
LEFT JOIN public.users u ON u.org_id = o.id
GROUP BY o.id, o.name, o.min_cohort_size;

-- =============================================================================
-- 10. SEED DATA
-- Two orgs, one user per role (five total).
-- Fixed UUIDs for local-dev reproducibility.
-- Auth users have no password hash — authenticate via magic link in dev.
-- =============================================================================

-- Orgs -----------------------------------------------------------------------
INSERT INTO public.orgs (id, name, slug, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001',
   'Green Shoe Consulting (Internal)', 'groe-internal', true),
  ('00000000-0000-0000-0000-000000000002',
   'Cypress Technology Group',          'cypress-tech',  true);

-- auth.users (Supabase auth layer) -------------------------------------------
INSERT INTO auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, is_super_admin, role
) VALUES
  ('00000000-0000-0000-0000-000000000010',
   'admin@groe-internal.dev',
   now(), now(), now(),
   '{"full_name":"GROE Admin (Seed)"}',  false, 'authenticated'),

  ('00000000-0000-0000-0000-000000000011',
   'viewer@groe-internal.dev',
   now(), now(), now(),
   '{"full_name":"GROE Viewer (Seed)"}', false, 'authenticated'),

  ('00000000-0000-0000-0000-000000000012',
   'orgadmin@cypress-tech.dev',
   now(), now(), now(),
   '{"full_name":"Org Admin (Seed)"}',   false, 'authenticated'),

  ('00000000-0000-0000-0000-000000000013',
   'leader@cypress-tech.dev',
   now(), now(), now(),
   '{"full_name":"Leader (Seed)"}',      false, 'authenticated'),

  ('00000000-0000-0000-0000-000000000014',
   'ic@cypress-tech.dev',
   now(), now(), now(),
   '{"full_name":"IC User (Seed)"}',     false, 'authenticated');

-- public.users (GROE profiles) -----------------------------------------------
INSERT INTO public.users (id, org_id, email, full_name, role) VALUES
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'admin@groe-internal.dev',   'GROE Admin (Seed)',  'groe_admin'),

  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'viewer@groe-internal.dev',  'GROE Viewer (Seed)', 'groe_viewer'),

  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000002',
   'orgadmin@cypress-tech.dev', 'Org Admin (Seed)',   'org_admin'),

  ('00000000-0000-0000-0000-000000000013',
   '00000000-0000-0000-0000-000000000002',
   'leader@cypress-tech.dev',   'Leader (Seed)',      'leader'),

  ('00000000-0000-0000-0000-000000000014',
   '00000000-0000-0000-0000-000000000002',
   'ic@cypress-tech.dev',       'IC User (Seed)',     'ic');

-- EAP contact for test org ---------------------------------------------------
INSERT INTO public.eap_contacts
  (id, org_id, name, title, phone, email, description, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000002',
  'Cypress EAP Services',
  'Employee Assistance Program',
  '1-800-555-0199',
  'eap@cypress-tech.dev',
  'Confidential counseling and support — available 24/7.',
  true
);

-- Assessment templates (global — org_id IS NULL) -----------------------------
INSERT INTO public.assessments (id, org_id, name, type, version, is_active) VALUES
  ('00000000-0000-0000-0000-000000000030',
   NULL,
   'MBI-General Survey (Placeholder — pending OQ-03 license)',
   'mbi', 1, true),

  ('00000000-0000-0000-0000-000000000031',
   NULL,
   'ARENA Resilience Assessment (Placeholder — pending OQ-02)',
   'arena', 1, true);
