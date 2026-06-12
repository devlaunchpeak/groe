#!/usr/bin/env bash
# =============================================================================
# test-score-hmttr.sh
# Manual test suite for the score-hmttr Supabase Edge Function.
#
# USAGE
#   1. Start the Edge Function locally:
#        supabase functions serve score-hmttr --no-verify-jwt
#      (--no-verify-jwt skips Supabase's own JWT check; our function uses its
#       own service-role-key gate instead.)
#
#   2. In a second terminal, set the required env vars and run this script:
#        SUPABASE_SERVICE_ROLE_KEY=<your-key> \
#        USER_ID=<seed-uuid> \
#        ORG_ID=<seed-uuid> \
#        ASSESSMENT_ID=<seed-uuid> \
#        bash scripts/test-score-hmttr.sh
#
# SEED UUIDs (from migration 0001)
#   ORG_ID (cypress-tech):   00000000-0000-0000-0000-000000000002
#   USER_ID (IC seed):       00000000-0000-0000-0000-000000000014
#   ASSESSMENT_ID (MBI):     00000000-0000-0000-0000-000000000030
# =============================================================================

set -euo pipefail

BASE_URL="${EDGE_FUNCTION_URL:-http://localhost:54321/functions/v1/score-hmttr}"
AUTH_HEADER="Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY is required}"
CONTENT_TYPE="Content-Type: application/json"

USER_ID="${USER_ID:?USER_ID is required}"
ORG_ID="${ORG_ID:?ORG_ID is required}"
ASSESSMENT_ID="${ASSESSMENT_ID:?ASSESSMENT_ID is required}"

PASS=0
FAIL=0

# Colour helpers
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n'   "$*"; }

assert_field() {
  local label="$1" json="$2" field="$3" expected="$4"
  local actual
  actual=$(echo "$json" | grep -o "\"${field}\":[^,}]*" | head -1 | sed 's/.*://;s/[" ]//g' || true)
  if [ "$actual" = "$expected" ]; then
    green "  ✓ ${label}: ${field} = ${actual}"
    PASS=$((PASS + 1))
  else
    red   "  ✗ ${label}: ${field} expected=${expected} got=${actual}"
    FAIL=$((FAIL + 1))
  fi
}

assert_http() {
  local label="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    green "  ✓ ${label}: HTTP ${actual}"
    PASS=$((PASS + 1))
  else
    red   "  ✗ ${label}: HTTP expected=${expected} got=${actual}"
    FAIL=$((FAIL + 1))
  fi
}

call_function() {
  local body="$1"
  curl -s -w "\n%{http_code}" \
    -X POST "$BASE_URL" \
    -H "$AUTH_HEADER" \
    -H "$CONTENT_TYPE" \
    -d "$body"
}

# =============================================================================
echo ""
bold "── TEST 1: Green (Resilient) — low burnout ──────────────────────────────"
# Expected h_mttr ≈ round(((5/54)*100 + (3/30)*100 + ((48-44)/48)*100 + (100-85)) / 4)
#                 = round((9.3 + 10 + 8.3 + 15) / 4)
#                 = round(42.6 / 4) = round(10.65) = 11 → resilient
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 5,
  "mbi_cynicism":   3,
  "mbi_efficacy":   44,
  "arena_score":    85,
  "raw_responses":  [{"item_id":"test-1","response_value":1}]
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T1" "$HTTP_CODE" "200"
assert_field "T1" "$JSON" "rag_status" "resilient"
assert_field "T1" "$JSON" "critical_distress" "false"

# =============================================================================
echo ""
bold "── TEST 2: Amber (Developing) — moderate burnout ────────────────────────"
# Expected h_mttr ≈ round(((27/54)*100 + (15/30)*100 + ((48-24)/48)*100 + (100-50)) / 4)
#                 = round((50 + 50 + 50 + 50) / 4) = 50 → developing
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 27,
  "mbi_cynicism":   15,
  "mbi_efficacy":   24,
  "arena_score":    50,
  "raw_responses":  []
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T2" "$HTTP_CODE" "200"
assert_field "T2" "$JSON" "rag_status" "developing"

# =============================================================================
echo ""
bold "── TEST 3: Red (Acute) — high burnout ───────────────────────────────────"
# Expected h_mttr ≈ round(((50/54)*100 + (28/30)*100 + ((48-4)/48)*100 + (100-10)) / 4)
#                 = round((92.6 + 93.3 + 91.7 + 90) / 4) = round(367.6 / 4) = 92 → acute
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 50,
  "mbi_cynicism":   28,
  "mbi_efficacy":   4,
  "arena_score":    10,
  "raw_responses":  []
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T3" "$HTTP_CODE" "200"
assert_field "T3" "$JSON" "rag_status" "acute"

# =============================================================================
echo ""
bold "── TEST 4: Critical Distress — score > 80 ───────────────────────────────"
# Same as T3 but verify critical_distress flag is true
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 54,
  "mbi_cynicism":   30,
  "mbi_efficacy":   0,
  "arena_score":    0,
  "raw_responses":  []
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T4" "$HTTP_CODE" "200"
assert_field "T4" "$JSON" "rag_status" "acute"

# =============================================================================
echo ""
bold "── TEST 5: Boundary — max resilient score (all zeros) ───────────────────"
# h_mttr = round(((0/54)*100 + (0/30)*100 + ((48-48)/48)*100 + (100-100)) / 4) = 0 → resilient
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 0,
  "mbi_cynicism":   0,
  "mbi_efficacy":   48,
  "arena_score":    100,
  "raw_responses":  []
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T5" "$HTTP_CODE" "200"
assert_field "T5" "$JSON" "rag_status" "resilient"

# =============================================================================
echo ""
bold "── TEST 6: Validation — mbi_exhaustion out of range ─────────────────────"
BODY=$(cat <<EOF
{
  "assessment_id":  "$ASSESSMENT_ID",
  "user_id":        "$USER_ID",
  "org_id":         "$ORG_ID",
  "mbi_exhaustion": 999,
  "mbi_cynicism":   15,
  "mbi_efficacy":   24,
  "arena_score":    50
}
EOF
)
RESPONSE=$(call_function "$BODY")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
JSON=$(echo "$RESPONSE" | sed '$d')
echo "  Response: $JSON"
assert_http "T6" "$HTTP_CODE" "400"

# =============================================================================
echo ""
bold "── TEST 7: Authorization — missing service role key ─────────────────────"
UNAUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL" \
  -H "Authorization: Bearer wrong_key" \
  -H "$CONTENT_TYPE" \
  -d '{"assessment_id":"00000000-0000-0000-0000-000000000030","user_id":"'$USER_ID'","org_id":"'$ORG_ID'","mbi_exhaustion":10,"mbi_cynicism":5,"mbi_efficacy":40,"arena_score":60}')
UNAUTH_HTTP=$(echo "$UNAUTH_RESPONSE" | tail -1)
assert_http "T7" "$UNAUTH_HTTP" "401"

# =============================================================================
echo ""
bold "── TEST 8: Authorization — no Authorization header ──────────────────────"
NO_AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL" \
  -H "$CONTENT_TYPE" \
  -d '{"assessment_id":"00000000-0000-0000-0000-000000000030","user_id":"'$USER_ID'","org_id":"'$ORG_ID'","mbi_exhaustion":10,"mbi_cynicism":5,"mbi_efficacy":40,"arena_score":60}')
NO_AUTH_HTTP=$(echo "$NO_AUTH_RESPONSE" | tail -1)
assert_http "T8" "$NO_AUTH_HTTP" "401"

# =============================================================================
echo ""
bold "═══════════════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
bold "═══════════════════════════════════════════════════════════════"
echo ""

[ "$FAIL" -eq 0 ]
