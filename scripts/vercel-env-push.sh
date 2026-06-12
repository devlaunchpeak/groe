#!/usr/bin/env bash
# Push all GROE environment variables to Vercel.
# Run from the project root: bash scripts/npx --yes vercel@latest-env-push.sh

set -eo pipefail

ENV_FILE=".env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.local not found. Run from the project root." >&2
  exit 1
fi

# Read a single value from .env.local by key name
get_env() {
  local key="$1"
  grep -m1 "^${key}=" "$ENV_FILE" | cut -d'=' -f2-
}

# Push a variable to one or more Vercel environments
push() {
  local key="$1"
  local value="$2"
  shift 2
  local envs=("$@")
  for env in "${envs[@]}"; do
    echo "  → $key ($env)"
    npx --yes vercel@latest env add "$key" "$env" --value "$value" --yes || true
  done
}

echo ""
echo "=== GROE → Vercel environment variable push ==="
echo ""

# ── Supabase ──────────────────────────────────────────────────────────────────
echo "[Supabase]"
push NEXT_PUBLIC_SUPABASE_URL      "$(get_env NEXT_PUBLIC_SUPABASE_URL)"      production preview development
push NEXT_PUBLIC_SUPABASE_ANON_KEY "$(get_env NEXT_PUBLIC_SUPABASE_ANON_KEY)" production preview development
push SUPABASE_SERVICE_ROLE_KEY     "$(get_env SUPABASE_SERVICE_ROLE_KEY)"     production preview development
push SUPABASE_JWT_SECRET           "$(get_env SUPABASE_JWT_SECRET)"           production preview development

# ── WorkOS ────────────────────────────────────────────────────────────────────
echo ""
echo "[WorkOS]"
push WORKOS_API_KEY         "$(get_env WORKOS_API_KEY)"         production preview development
push WORKOS_CLIENT_ID       "$(get_env WORKOS_CLIENT_ID)"       production preview development
push WORKOS_COOKIE_PASSWORD "$(get_env WORKOS_COOKIE_PASSWORD)" production preview development
push WORKOS_WEBHOOK_SECRET  "$(get_env WORKOS_WEBHOOK_SECRET)"  production preview development

# REDIRECT_URI is environment-specific
push WORKOS_REDIRECT_URI "https://app.groe.co/api/auth/callback"                          production
push WORKOS_REDIRECT_URI "https://groe-git-main-launchpeak.npx --yes vercel@latest.app/api/auth/callback"  preview
push WORKOS_REDIRECT_URI "http://localhost:3000/api/auth/callback"                        development

# ── Resend ────────────────────────────────────────────────────────────────────
echo ""
echo "[Resend]"
push RESEND_API_KEY      "$(get_env RESEND_API_KEY)"      production preview development
push RESEND_FROM_ADDRESS "$(get_env RESEND_FROM_ADDRESS)" production preview development

# ── Video (Mux) ───────────────────────────────────────────────────────────────
echo ""
echo "[Video / Mux]"
push MUX_TOKEN_ID   "$(get_env MUX_TOKEN_ID)"   production preview development
push MUX_SECRET_KEY "$(get_env MUX_SECRET_KEY)" production preview development

# ── App URLs — environment-specific ──────────────────────────────────────────
echo ""
echo "[App URLs]"
push NEXT_PUBLIC_APP_URL "https://app.groe.co"                            production
push NEXT_PUBLIC_APP_URL "https://groe-git-main-launchpeak.npx --yes vercel@latest.app"    preview
push NEXT_PUBLIC_APP_URL "http://localhost:3000"                           development

echo ""
echo "=== Done. Verify at: Vercel Dashboard → your project → Settings → Environment Variables ==="
