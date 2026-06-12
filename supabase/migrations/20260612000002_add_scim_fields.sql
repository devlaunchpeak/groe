-- =============================================================================
-- 20260612000002_add_scim_fields.sql
-- SCIM columns are now included in 20260612000001_initial_schema.sql.
-- This migration is retained as a no-op to preserve the numbered sequence.
-- =============================================================================

-- No-op: columns already present in migration 0001.
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scim_directory_user_id ...
-- ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deprovisioned_at ...
