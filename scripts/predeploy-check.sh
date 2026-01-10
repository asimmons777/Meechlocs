#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WITH_DB=0
SMOKE=0

for arg in "$@"; do
	case "$arg" in
		--with-db)
			WITH_DB=1
			;;
		--smoke)
			SMOKE=1
			;;
		--all)
			WITH_DB=1
			SMOKE=1
			;;
	esac
done

if [ "$WITH_DB" -eq 1 ]; then
	echo "== docker compose up -d"
	cd "$ROOT"
	docker compose up -d

	echo "== wait for mysql"
	for i in {1..30}; do
		if docker compose exec -T db mysqladmin ping -uroot -prootpassword >/dev/null 2>&1; then
			echo "MySQL is up"
			break
		fi
		sleep 2
	done

	if [ -z "${DATABASE_URL:-}" ] && [ -f "$ROOT/apps/api/.env" ]; then
		echo "== load env from apps/api/.env"
		set -a
		source "$ROOT/apps/api/.env"
		set +a
	fi

	if [ -z "${DATABASE_URL:-}" ]; then
		echo "WARN: DATABASE_URL not set; skipping prisma db push + seed"
	else
		echo "== prisma db push"
		cd "$ROOT"
		npx prisma db push --schema=./prisma/schema.prisma

		echo "== seed"
		cd "$ROOT"
		npm run seed
	fi
fi

echo "== install deps"
cd "$ROOT/apps/api"
npm install --no-audit --no-fund
cd "$ROOT/apps/web"
npm install --no-audit --no-fund

echo "== prisma validate"
cd "$ROOT"
if [ -z "${DATABASE_URL:-}" ]; then
	echo "WARN: DATABASE_URL not set; skipping prisma validate"
else
	if command -v npx >/dev/null 2>&1; then
		npx prisma validate --schema=./prisma/schema.prisma
	else
		echo "npx not found" >&2
		exit 1
	fi
fi

echo "== build api"
cd "$ROOT/apps/api"
npm run build

echo "== build web"
cd "$ROOT/apps/web"
npm run build

echo "== env sanity (best-effort)"

if [ -f "$ROOT/apps/api/.env.example" ]; then
	:
else
	echo "WARN: apps/api/.env.example is missing (harder to configure deploy envs)"
fi

if [ -f "$ROOT/apps/web/.env.example" ]; then
	:
else
	echo "WARN: apps/web/.env.example is missing (harder to configure Vercel envs)"
fi

NODE_ENV_VALUE="${NODE_ENV:-}"
CORS_ORIGIN_VALUE="${CORS_ORIGIN:-}"

if [ "$NODE_ENV_VALUE" = "production" ] && [ "$CORS_ORIGIN_VALUE" = "*" ]; then
	echo "WARN: NODE_ENV=production with CORS_ORIGIN='*' is not production-safe. Use a specific origin (or comma-separated origins)."
fi

if [ "${ALLOW_DEMO_CONTENT:-}" = "true" ]; then
	echo "WARN: ALLOW_DEMO_CONTENT=true (demo services/accounts may be visible)."
fi

if [ -n "${STRIPE_SECRET_KEY:-}" ] && [ -z "${STRIPE_WEBHOOK_SECRET:-}" ]; then
	echo "WARN: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing (webhook confirmations/refunds may not work)."
fi

if [ -n "${STRIPE_SECRET_KEY:-}" ] && [ -z "${APP_URL:-}" ]; then
	echo "WARN: STRIPE_SECRET_KEY is set but APP_URL is missing (Checkout success/cancel redirects may be wrong)."
fi

if [ "$NODE_ENV_VALUE" = "production" ]; then
	if [ -z "${SENDGRID_API_KEY:-}" ] || [ -z "${SENDGRID_FROM_EMAIL:-}${SENDGRID_FROM:-}" ]; then
		echo "WARN: NODE_ENV=production but SendGrid vars are missing (email verification + password reset will fail)."
	fi
fi

cleanup() {
	local api_pid=""
	local web_pid=""
	if [ -f "$ROOT/tmp/api-pid" ]; then
		api_pid="$(cat "$ROOT/tmp/api-pid")"
		kill "$api_pid" >/dev/null 2>&1 || true
	fi
	if [ -f "$ROOT/tmp/web-pid" ]; then
		web_pid="$(cat "$ROOT/tmp/web-pid")"
		kill "$web_pid" >/dev/null 2>&1 || true
	fi

	sleep 1

	if [ -n "$api_pid" ] && kill -0 "$api_pid" >/dev/null 2>&1; then
		kill -9 "$api_pid" >/dev/null 2>&1 || true
	fi
	if [ -n "$web_pid" ] && kill -0 "$web_pid" >/dev/null 2>&1; then
		kill -9 "$web_pid" >/dev/null 2>&1 || true
	fi
}

if [ "$SMOKE" -eq 1 ]; then
	if ! command -v jq >/dev/null 2>&1; then
		echo "jq is required for smoke checks (install it or remove --smoke)" >&2
		exit 1
	fi
	if ! command -v curl >/dev/null 2>&1; then
		echo "curl is required for smoke checks" >&2
		exit 1
	fi

	trap cleanup EXIT

	echo "== start dev servers (detached)"
	bash "$ROOT/scripts/run-dev.sh" --detach

	echo "== wait for api health"
	for i in {1..30}; do
		if curl -fsS http://localhost:4000/api/health >/dev/null 2>&1; then
			break
		fi
		sleep 1
	done

	echo "== api health"
	curl -fsS http://localhost:4000/api/health | jq .

	echo "== run e2e"
	bash "$ROOT/scripts/run_e2e.sh"
fi

echo "OK"
