-- =============================================================================
-- 20260612000004_fix_audit_triggers.sql
-- Fix: replace FOR EACH ROW audit_log triggers with FOR EACH STATEMENT.
--
-- BUG: FOR EACH ROW DELETE/UPDATE triggers do not fire when the WHERE clause
-- matches zero rows. DELETE ... WHERE id = '<uuid that does not exist>' would
-- "succeed" (0 rows deleted) without the trigger ever firing.
--
-- FIX: FOR EACH STATEMENT triggers fire unconditionally on any DELETE, UPDATE,
-- or TRUNCATE statement against audit_log, regardless of row count.
--
-- RUN THIS in Supabase Studio → SQL Editor to fix your live instance.
-- =============================================================================

-- Step 1: Replace the trigger function with the correct error message.
CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only and cannot be modified';
END;
$$;

-- Step 2: Drop old row-level triggers and replace with statement-level.
DROP TRIGGER IF EXISTS audit_log_no_update   ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_delete   ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_no_truncate ON public.audit_log;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- TRUNCATE is not covered by DELETE triggers — add explicit guard.
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- Step 3: Ensure all three triggers are enabled.
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_update;
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_delete;
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_truncate;

-- =============================================================================
-- VERIFICATION — run these after the migration to confirm the fix.
-- Each should produce: ERROR: audit_log is append-only and cannot be modified
-- =============================================================================
-- DO $$
-- BEGIN
--   -- Test 1: DELETE against a non-existent row (the original failing case)
--   DELETE FROM public.audit_log WHERE id = '00000000-0000-0000-0000-000000000001';
-- EXCEPTION
--   WHEN others THEN
--     RAISE NOTICE 'DELETE test PASSED: %', SQLERRM;
-- END;
-- $$;
--
-- DO $$
-- BEGIN
--   -- Test 2: UPDATE against a non-existent row
--   UPDATE public.audit_log SET action = 'tampered' WHERE id = '00000000-0000-0000-0000-000000000001';
-- EXCEPTION
--   WHEN others THEN
--     RAISE NOTICE 'UPDATE test PASSED: %', SQLERRM;
-- END;
-- $$;
-- =============================================================================
