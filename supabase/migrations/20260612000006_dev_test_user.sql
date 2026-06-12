-- =============================================================================
-- Migration 0006: Dev test user for bon@launchpeak.ai
-- =============================================================================
-- Adds a real email address to the GROE database so the magic link flow can
-- resolve to a valid GROE account during M1 browser testing.
--
-- Auth flow on first login:
--   1. WorkOS creates/finds the WorkOS user for bon@launchpeak.ai
--   2. getGroeUserByWorkosId() falls back to email lookup (workos_user_id = null)
--   3. Finds this row → creates session → writes back workos_user_id
-- =============================================================================

-- auth.users stub (required by FK on public.users.id)
INSERT INTO auth.users (
  id, email, email_confirmed_at, created_at, updated_at,
  raw_user_meta_data, is_super_admin, role
) VALUES (
  '00000000-0000-0000-0000-000000000015',
  'bon@launchpeak.ai',
  now(), now(), now(),
  '{"full_name":"Bon Ishimori (Dev)"}',
  false, 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- GROE user profile — groe_admin so login redirects to /groe-admin
INSERT INTO public.users (id, org_id, email, full_name, role)
VALUES (
  '00000000-0000-0000-0000-000000000015',
  '00000000-0000-0000-0000-000000000001',  -- GROE Internal org
  'bon@launchpeak.ai',
  'Bon Ishimori (Dev)',
  'groe_admin'
) ON CONFLICT (id) DO NOTHING;
