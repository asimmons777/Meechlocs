#!/usr/bin/env bash
set -euo pipefail

DETACH=0
for arg in "$@"; do
	case "$arg" in
		--detach|--detached)
			DETACH=1
			;;
	esac
done

echo "Starting API (apps/api) in background..."
cd "$(dirname "$0")/.."
mkdir -p tmp
ROOT="$PWD"
pushd apps/api > /dev/null
npm install --no-audit --no-fund || true
if [ "$DETACH" -eq 1 ]; then
	npm run dev > "$ROOT/tmp/api.dev.log" 2>&1 &
else
	npm run dev &
fi
API_PID=$!
popd > /dev/null

echo "$API_PID" > tmp/api-pid

echo "Starting web (apps/web) in background..."
pushd apps/web > /dev/null
npm install --no-audit --no-fund || true
if [ "$DETACH" -eq 1 ]; then
	npm run dev > "$ROOT/tmp/web.dev.log" 2>&1 &
else
	npm run dev &
fi
WEB_PID=$!
popd > /dev/null

echo "$WEB_PID" > tmp/web-pid

echo "API PID: $API_PID  WEB PID: $WEB_PID"
echo "To stop: kill $API_PID $WEB_PID"
echo "(PIDs also saved to tmp/api-pid and tmp/web-pid)"

if [ "$DETACH" -eq 1 ]; then
	echo "Detached." 
	exit 0
fi

echo "Keep this terminal open (attached mode)."
wait
