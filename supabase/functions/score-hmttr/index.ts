import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import type { ScoreHMttrResponse } from "./types.ts";

// =============================================================================
// PLACEHOLDER FORMULA CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
// OQ-01: Replace MBI range constants + FORMULA_WEIGHTS when Steve provides
//        the finalized MBI scoring ranges and formula.
// OQ-02: Replace ARENA_MAX if the scale changes.
// OQ-04: Replace CRITICAL_DISTRESS_THRESHOLD when Steve provides thresholds.
// OQ-06: Populate TOP_STRESS_SIGNALS logic when Steve provides signal rules.
// =============================================================================

// MBI subscale maximums (OQ-01 placeholder)
const MBI_EXHAUSTION_MAX = 54;
const MBI_CYNICISM_MAX   = 30;
const MBI_EFFICACY_MAX   = 48;

// ARENA score maximum (OQ-02 placeholder)
const ARENA_MAX = 100;

// Formula: each component is normalized to 0–100, then averaged (OQ-01 placeholder)
// Replace FORMULA_WEIGHTS with Steve's weighting when confirmed.
const FORMULA_WEIGHTS = {
  exhaustion:  1,
  cynicism:    1,
  efficacy:    1,  // contributes via reverse-score: (MAX - raw) / MAX * 100
  resilience:  1,  // arena contributes via inverse: ARENA_MAX - arena_score
} as const;
const FORMULA_DIVISOR = 4; // sum of weights above

// RAG thresholds (OQ-04 placeholder)
const RAG_GREEN_MAX = 33;   // 0–33  → resilient
const RAG_AMBER_MAX = 66;   // 34–66 → developing
                             // 67–100 → acute

// Critical Distress threshold (OQ-04 placeholder — rule 4.9)
const CRITICAL_DISTRESS_THRESHOLD = 80;

// Top stress signals — OQ-06 placeholder (returns empty until Steve provides logic)
const TOP_STRESS_SIGNALS: string[] = [];

// =============================================================================
// CORS HEADERS
// =============================================================================
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// INPUT VALIDATION (rule 4.7 — Zod on all Edge Function inputs)
// =============================================================================
const ScoreRequestSchema = z.object({
  assessment_id:  z.string().uuid("assessment_id must be a UUID"),
  user_id:        z.string().uuid("user_id must be a UUID"),
  org_id:         z.string().uuid("org_id must be a UUID"),
  mbi_exhaustion: z.number().int().min(0).max(MBI_EXHAUSTION_MAX),
  mbi_cynicism:   z.number().int().min(0).max(MBI_CYNICISM_MAX),
  mbi_efficacy:   z.number().int().min(0).max(MBI_EFFICACY_MAX),
  arena_score:    z.number().int().min(0).max(ARENA_MAX),
  raw_responses:  z
    .array(z.object({ item_id: z.string(), response_value: z.number() }))
    .optional()
    .default([]),
});

type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

// =============================================================================
// SCORING LOGIC (rule 4.2 — server-side only, never in client bundle)
// =============================================================================
function computeHMttr(input: ScoreRequest): number {
  const exhaustionPct = (input.mbi_exhaustion / MBI_EXHAUSTION_MAX) * 100;
  const cynicismPct   = (input.mbi_cynicism   / MBI_CYNICISM_MAX)   * 100;
  // Efficacy is reverse-scored: high efficacy = low burnout contribution
  const efficacyPct   = ((MBI_EFFICACY_MAX - input.mbi_efficacy) / MBI_EFFICACY_MAX) * 100;
  // ARENA is a resilience score: high resilience = low burnout contribution
  const resiliencePct = ARENA_MAX - input.arena_score;

  const weighted =
    exhaustionPct  * FORMULA_WEIGHTS.exhaustion  +
    cynicismPct    * FORMULA_WEIGHTS.cynicism     +
    efficacyPct    * FORMULA_WEIGHTS.efficacy     +
    resiliencePct  * FORMULA_WEIGHTS.resilience;

  return Math.round(weighted / FORMULA_DIVISOR);
}

function computeRag(score: number): "resilient" | "developing" | "acute" {
  if (score <= RAG_GREEN_MAX) return "resilient";
  if (score <= RAG_AMBER_MAX) return "developing";
  return "acute";
}

// =============================================================================
// AUTHORIZATION HELPER
// The Supabase gateway validates the JWT signature before this function runs.
// By the time we get here, any Bearer token is a cryptographically valid JWT.
// We only need to check the `role` claim — service_role tokens come from the
// Next.js API layer (server-side only). Anon/user tokens are rejected.
// =============================================================================
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

// =============================================================================
// JSON RESPONSE HELPERS
// =============================================================================
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function jsonOk(body: ScoreHMttrResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// =============================================================================
// MAIN HANDLER
// =============================================================================
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonError("Method not allowed", 405);
  }

  // ── Authorization ───────────────────────────────────────────────────────────
  if (!isAuthorized(req)) {
    return jsonError("Unauthorized", 401);
  }

  // ── Parse + validate body (rule 4.7) ────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = ScoreRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", issues: parsed.error.issues }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
  const input = parsed.data;

  // ── Supabase admin client (service role — bypasses RLS for trusted writes) ──
  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Verify user_id + org_id exist and are consistent (rule 4.1) ─────────────
  // The calling Next.js route already validated the WorkOS session; this is
  // a defense-in-depth check against tampered request bodies.
  const { data: groeUser, error: userLookupError } = await db
    .from("users")
    .select("id, org_id, is_active")
    .eq("id", input.user_id)
    .eq("org_id", input.org_id)
    .single();

  if (userLookupError || !groeUser) {
    console.error("[score-hmttr] user lookup failed:", userLookupError);
    return jsonError("User not found", 403);
  }

  if (!groeUser.is_active) {
    return jsonError("Account is deactivated", 403);
  }

  // ── Compute H-MTTR and RAG (rule 4.2 — never runs client-side) ─────────────
  const hMttrScore       = computeHMttr(input);
  const ragStatus        = computeRag(hMttrScore);
  const criticalDistress = hMttrScore > CRITICAL_DISTRESS_THRESHOLD;

  const mbiSubscores = {
    exhaustion_raw:  input.mbi_exhaustion,
    cynicism_raw:    input.mbi_cynicism,
    efficacy_raw:    input.mbi_efficacy,
    exhaustion_pct:  Math.round((input.mbi_exhaustion / MBI_EXHAUSTION_MAX) * 100),
    cynicism_pct:    Math.round((input.mbi_cynicism   / MBI_CYNICISM_MAX)   * 100),
    efficacy_pct:    Math.round(((MBI_EFFICACY_MAX - input.mbi_efficacy) / MBI_EFFICACY_MAX) * 100),
  };

  // ── Write to assessment_results (immutable insert — rule 4.5) ───────────────
  const { data: resultRow, error: insertError } = await db
    .from("assessment_results")
    .insert({
      org_id:                    input.org_id,
      user_id:                   input.user_id,
      assessment_id:             input.assessment_id,
      raw_responses:             input.raw_responses,
      mbi_exhaustion_raw:        input.mbi_exhaustion,
      mbi_cynicism_raw:          input.mbi_cynicism,
      mbi_efficacy_raw:          input.mbi_efficacy,
      arena_score:               input.arena_score,
      h_mttr_score:              hMttrScore,
      rag_status:                ragStatus,
      critical_distress_flagged: criticalDistress,
      completed_at:              new Date().toISOString(),
    })
    .select("id, completed_at")
    .single();

  if (insertError || !resultRow) {
    console.error("[score-hmttr] insert failed:", insertError);
    return jsonError("Failed to save assessment result", 500);
  }

  // ── Update cached score on users row ────────────────────────────────────────
  // Non-fatal: assessment_results is the source of truth. Cache is convenience.
  const { error: updateError } = await db
    .from("users")
    .update({
      h_mttr_score:              hMttrScore,
      rag_status:                ragStatus,
      critical_distress_flagged: criticalDistress,
      last_assessment_at:        resultRow.completed_at,
    })
    .eq("id", input.user_id);

  if (updateError) {
    console.warn("[score-hmttr] user cache update failed (non-fatal):", updateError);
  }

  // ── Audit log (rule 4.5) ─────────────────────────────────────────────────────
  const { error: auditError } = await db.from("audit_log").insert({
    org_id:      input.org_id,
    user_id:     input.user_id,
    action:      "assessment.scored",
    target_type: "assessment_result",
    target_id:   resultRow.id,
    metadata: {
      h_mttr_score:      hMttrScore,
      rag_status:        ragStatus,
      critical_distress: criticalDistress,
      assessment_id:     input.assessment_id,
    },
  });

  if (auditError) {
    console.warn("[score-hmttr] audit log insert failed (non-fatal):", auditError);
  }

  // ── Return result (formula weights never exposed to caller — rule 4.2) ───────
  return jsonOk({
    result_id:           resultRow.id,
    h_mttr_score:        hMttrScore,
    rag_status:          ragStatus,
    critical_distress:   criticalDistress,
    mbi_subscores:       mbiSubscores,
    top_stress_signals:  TOP_STRESS_SIGNALS, // OQ-06 placeholder
    completed_at:        resultRow.completed_at,
  });
});
