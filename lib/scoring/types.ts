// =============================================================================
// Scoring types — Next.js side
// Mirror of supabase/functions/score-hmttr/types.ts.
// Used by the /api/assessment/submit route that calls the Edge Function.
// =============================================================================

export interface ScoreHMttrRequest {
  assessment_id:  string;
  user_id:        string;
  org_id:         string;
  mbi_exhaustion: number;
  mbi_cynicism:   number;
  mbi_efficacy:   number;
  arena_score:    number;
  raw_responses?: Array<{ item_id: string; response_value: number }>;
}

export interface MbiSubscores {
  exhaustion_raw: number;
  cynicism_raw:   number;
  efficacy_raw:   number;
  exhaustion_pct: number;
  cynicism_pct:   number;
  efficacy_pct:   number;
}

export interface ScoreHMttrResponse {
  result_id:          string;
  h_mttr_score:       number;
  rag_status:         "resilient" | "developing" | "acute";
  critical_distress:  boolean;
  mbi_subscores:      MbiSubscores;
  top_stress_signals: string[];
  completed_at:       string;
}
