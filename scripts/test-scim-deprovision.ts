/**
 * test-scim-deprovision.ts
 *
 * Simulates a WorkOS dsync.user.deleted webhook to test the SCIM deprovision
 * handler end-to-end without requiring ngrok or a real IdP.
 *
 * Usage:
 *   npx ts-node --skip-project scripts/test-scim-deprovision.ts
 *
 * The dev server must be running on localhost:3000.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const BASE_URL  = "http://localhost:3000";
const ENDPOINT  = `${BASE_URL}/api/scim/webhook`;
const SECRET    = process.env.WORKOS_WEBHOOK_SECRET!;
const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SECRET || !SUPA_URL || !SUPA_KEY) {
  console.error("Missing required env vars — check .env.local");
  process.exit(1);
}

const db = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Test user constants ──────────────────────────────────────────────────────
// We use the existing IC seed user from migration 0001 as the test subject.
// The script temporarily sets a scim_directory_user_id on that user, fires
// the delete event, and then checks the outcome.

const TEST_USER_ID      = "00000000-0000-0000-0000-000000000014"; // IC seed user
const TEST_SCIM_ID      = "scim-test-" + Date.now();             // unique per run
const TEST_ORG_ID       = "00000000-0000-0000-0000-000000000002"; // cypress-tech org
const TEST_EMAIL        = "ic@cypress-tech.dev";

// ── WorkOS webhook signature (mirrors constructEvent logic) ──────────────────
function signPayload(rawBody: string): string {
  // WorkOS SDK: timestamp in ms, payload double-JSON-stringified before HMAC
  // Source: node_modules/@workos-inc/node/lib/common/crypto/signature-provider.js
  const timestamp = Date.now(); // milliseconds — SDK compares against Date.now()
  const signed    = `${timestamp}.${JSON.stringify(rawBody)}`; // SDK calls JSON.stringify(payload) on the raw string
  const sig       = crypto.createHmac("sha256", SECRET).update(signed).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function pass(msg: string) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function fail(msg: string) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); }
function bold(msg: string) { console.log(`\x1b[1m${msg}\x1b[0m`); }

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main test ────────────────────────────────────────────────────────────────
async function main() {
  let passed = 0;
  let failed = 0;

  // ── SETUP: stamp the test SCIM ID onto the seed user ──────────────────────
  bold("\n── Setup: linking SCIM ID to IC seed user ───────────────────────────");
  const { error: setupErr } = await db
    .from("users")
    .update({ scim_directory_user_id: TEST_SCIM_ID, is_active: true, deprovisioned_at: null })
    .eq("id", TEST_USER_ID);

  if (setupErr) {
    fail(`Could not set up test user: ${setupErr.message}`);
    process.exit(1);
  }
  pass(`Set scim_directory_user_id = ${TEST_SCIM_ID} on user ${TEST_USER_ID}`);

  // ── TEST 1: dsync.user.deleted fires 200 and deprovisions user ────────────
  bold("\n── TEST 1: dsync.user.deleted → user deprovisioned ─────────────────");

  const payload = JSON.stringify({
    id:    "evt_" + Date.now(),
    event: "dsync.user.deleted",
    data: {
      object:         "directory_user",
      id:             TEST_SCIM_ID,
      directoryId:    "directory_test_001",
      organizationId: null,
      idpId:          "idp-001",
      firstName:      "IC",
      lastName:       "User (Seed)",
      emails:         [{ primary: true, type: "work", value: TEST_EMAIL }],
      username:       TEST_EMAIL,
      state:          "inactive",
      groups:         [],
      rawAttributes:  {},
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    },
  });

  const sigHeader = signPayload(payload);

  const res = await fetch(ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":     "application/json",
      "workos-signature": sigHeader,
    },
    body: payload,
  });

  if (res.status === 200) {
    pass(`Webhook returned HTTP 200`);
    passed++;
  } else {
    const body = await res.text();
    fail(`Webhook returned HTTP ${res.status}: ${body}`);
    failed++;
  }

  // Give the handler a moment to finish DB writes
  await sleep(500);

  // ── Verify DB state ────────────────────────────────────────────────────────
  const { data: user } = await db
    .from("users")
    .select("is_active, deprovisioned_at")
    .eq("id", TEST_USER_ID)
    .single();

  if (user?.is_active === false) {
    pass("users.is_active = false");
    passed++;
  } else {
    fail(`users.is_active = ${user?.is_active} (expected false)`);
    failed++;
  }

  if (user?.deprovisioned_at) {
    pass(`users.deprovisioned_at = ${user.deprovisioned_at}`);
    passed++;
  } else {
    fail("users.deprovisioned_at is null (expected a timestamp)");
    failed++;
  }

  // ── Verify audit log ───────────────────────────────────────────────────────
  const { data: auditRows } = await db
    .from("audit_log")
    .select("action, metadata")
    .eq("target_id", TEST_USER_ID)
    .eq("action", "scim.deprovision")
    .order("created_at", { ascending: false })
    .limit(1);

  if (auditRows && auditRows.length > 0) {
    pass(`audit_log has scim.deprovision entry`);
    passed++;
  } else {
    fail("No scim.deprovision entry found in audit_log");
    failed++;
  }

  // ── TEST 2: Idempotency — sending the same event again is a no-op ─────────
  bold("\n── TEST 2: idempotent re-delivery ───────────────────────────────────");

  const res2 = await fetch(ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":     "application/json",
      "workos-signature": signPayload(payload),
    },
    body: payload,
  });

  if (res2.status === 200) {
    pass("Second delivery also returns 200 (idempotent)");
    passed++;
  } else {
    fail(`Second delivery returned ${res2.status}`);
    failed++;
  }

  // ── TEST 3: Bad signature → 401 ───────────────────────────────────────────
  bold("\n── TEST 3: invalid signature → 401 ─────────────────────────────────");

  const res3 = await fetch(ENDPOINT, {
    method:  "POST",
    headers: {
      "Content-Type":     "application/json",
      "workos-signature": "t=9999999999,v1=badsignature",
    },
    body: payload,
  });

  if (res3.status === 401) {
    pass("Invalid signature returns 401");
    passed++;
  } else {
    fail(`Expected 401 but got ${res3.status}`);
    failed++;
  }

  // ── TEST 4: Missing signature header → 400 ───────────────────────────────
  bold("\n── TEST 4: missing signature header → 400 ──────────────────────────");

  const res4 = await fetch(ENDPOINT, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });

  if (res4.status === 400) {
    pass("Missing signature header returns 400");
    passed++;
  } else {
    fail(`Expected 400 but got ${res4.status}`);
    failed++;
  }

  // ── TEARDOWN: restore seed user ───────────────────────────────────────────
  bold("\n── Teardown: restoring IC seed user to active ───────────────────────");
  await db
    .from("users")
    .update({ is_active: true, deprovisioned_at: null, scim_directory_user_id: null })
    .eq("id", TEST_USER_ID);
  pass("IC seed user restored");

  // ── Summary ───────────────────────────────────────────────────────────────
  bold("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  bold("═══════════════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
