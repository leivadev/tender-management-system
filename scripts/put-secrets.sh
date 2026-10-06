#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.dev.vars}"
KEYS=(SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY RESEND_API_KEY MAIL_FROM APP_BASE_URL)

[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

worker=$(sed -nE 's/^[[:space:]]*"name":[[:space:]]*"([^"]+)".*/\1/p' wrangler.jsonc | head -1)
domain=$(sed -nE 's/.*"pattern":[[:space:]]*"([^"]+)".*/\1/p' wrangler.jsonc | head -1)

get() {
	local v
	v=$(grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-) || true
	v="${v%\"}"; v="${v#\"}"
	printf '%s' "$v"
}

declare -A values
for key in "${KEYS[@]}"; do
	values[$key]=$(get "$key")
done

[[ -n "$domain" ]] && values[APP_BASE_URL]="${APP_BASE_URL:-https://$domain}"

for key in "${KEYS[@]}"; do
	[[ -n "${values[$key]}" ]] || { echo "$key is empty in $ENV_FILE" >&2; exit 1; }
done

if [[ "${values[SUPABASE_URL]}" =~ (localhost|127\.0\.0\.1) ]]; then
	echo "SUPABASE_URL points to a local instance; use a file with the remote project values." >&2
	exit 1
fi

echo "Worker:        $worker"
echo "APP_BASE_URL:  ${values[APP_BASE_URL]}"
echo "SUPABASE_URL:  ${values[SUPABASE_URL]}"
read -r -p "Upload ${#KEYS[@]} secrets? [y/N] " answer
[[ "$answer" =~ ^[yY]$ ]] || { echo "Aborted."; exit 1; }

for key in "${KEYS[@]}"; do
	printf '%s' "${values[$key]}" | npx wrangler secret put "$key" --name "$worker"
done
