-- =============================================================================
-- 20260612000003_audit_append_only_ref.sql
-- Prompt 6 — Audit logging: idempotent re-assert of append-only triggers.
--
-- Adds a table comment and re-creates the prevention function + all three
-- triggers (DELETE, UPDATE, TRUNCATE). Safe to run against a database that
-- already has these objects — DROP IF EXISTS + CREATE is idempotent.
--
-- Root-cause note (for future reference):
--   The original migration used FOR EACH ROW triggers. A FOR EACH ROW trigger
--   on DELETE only fires when ≥1 row matches the WHERE clause. Running
--   DELETE ... WHERE id = '<non-existent-uuid>' matched zero rows, so the
--   trigger never fired and the statement "succeeded" (0 rows deleted).
--   FOR EACH STATEMENT triggers fire unconditionally — that is the correct
--   choice for append-only enforcement.
-- =============================================================================

COMMENT ON TABLE public.audit_log IS
  'Append-only event log. UPDATE, DELETE, and TRUNCATE are blocked by database '
  'triggers (audit_log_no_update, audit_log_no_delete, audit_log_no_truncate). '
  'Use logAuditEvent() from lib/audit/index.ts for all writes. Never skip '
  'audit logging on security-relevant routes (rule 4.5).';

-- Recreate the function with the correct error message.
CREATE OR REPLACE FUNCTION public.audit_log_prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only and cannot be modified';
END;
$$;

-- DROP + CREATE ensures the trigger uses the current function body even if the
-- function was replaced above.

DROP TRIGGER IF EXISTS audit_log_no_update ON public.audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- TRUNCATE bypasses DELETE triggers entirely — needs its own guard.
DROP TRIGGER IF EXISTS audit_log_no_truncate ON public.audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_prevent_mutation();

-- Re-enable triggers in case they were ever disabled.
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_update;
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_delete;
ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_no_truncate;
