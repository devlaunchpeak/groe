// =============================================================================
// score-hmttr Edge Function — shared type definitions
// These types are mirrored in lib/scoring/types.ts for use in Next.js routes.
// =============================================================================

export interface ScoreHMttrRequest {
  /** UUID of the assessment definition used (from public.assessments) */
  assessment_id: string;
  /** GROE user ID — resolved from WorkOS session by the calling API route */
  user_id: string;
  /** Org ID — resolved from public.users by the calling API route */
  org_id: string;
  /** MBI Exhaustion subscale raw score (0–54) — OQ-01 placeholder range */
  mbi_exhaustion: number;
  /** MBI Cynicism subscale raw score (0–30) — OQ-01 placeholder range */
  mbi_cynicism: number;
  /** MBI Efficacy subscale raw score (0–48) — OQ-01 placeholder range */
  mbi_efficacy: number;
  /** ARENA resilience score (0–100) — OQ-02 placeholder */
  arena_score: number;
  /** Raw item-level responses — stored for audit trail, never scored client-side */
  raw_responses?: Array<{ item_id: string; response_value: number }>;
}

export interface MbiSubscores {
  exhaustion_raw: number;
  cynicism_raw: number;
  efficacy_raw: number;
  /** Exhaustion expressed as 0–100 percentage for display */
  exhaustion_pct: number;
  /** Cynicism expressed as 0–100 percentage for display */
  cynicism_pct: number;
  /** Efficacy burnout contribution as 0–100 percentage (reverse-scored) */
  efficacy_pct: number;
}

export interface ScoreHMttrResponse {
  /** UUID of the newly created assessment_results row */
  result_id: string;
  /** Composite H-MTTR score (0–100). 0 = maximally resilient, 100 = acute burnout. */
  h_mttr_score: number;
  /** RAG traffic-light status */
  rag_status: "resilient" | "developing" | "acute";
  /** True when h_mttr_score > CRITICAL_DISTRESS_THRESHOLD (OQ-04 placeholder: 80) */
  critical_distress: boolean;
  mbi_subscores: MbiSubscores;
  /** Top contributing stress signals — OQ-06 placeholder, always [] until Steve provides logic */
  top_stress_signals: string[];
  completed_at: string; // ISO 8601
}
