#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_env() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

load_env .env
load_env .env.local

QUERY="${1:-}"
REGION="${2:-pl}"
PORT="${PORT:-3000}"

if [[ -z "$QUERY" ]]; then
  echo "Usage: $0 <game> [region]" >&2
  exit 1
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local" >&2
  exit 1
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${PORT} is already in use" >&2
  exit 1
fi

SERVER_PID=""
SERVER_LOG="$(mktemp)"

kill_tree() {
  local pid="$1"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill "$pid" 2>/dev/null || true
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill_tree "$SERVER_PID"
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$SERVER_LOG"
}

trap cleanup EXIT INT TERM

yarn start >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited before it became ready" >&2
    tail -n 40 "$SERVER_LOG" >&2 || true
    exit 1
  fi

  if curl -sS -o /dev/null "http://127.0.0.1:${PORT}/search" 2>/dev/null; then
    ready=1
    break
  fi

  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "Timed out waiting for http://127.0.0.1:${PORT}" >&2
  tail -n 40 "$SERVER_LOG" >&2 || true
  exit 1
fi

RESPONSE="$(
  curl -sS -G "http://127.0.0.1:${PORT}/search" \
    --data-urlencode "q=${QUERY}" \
    --data-urlencode "region=${REGION}"
)"

printf '%s\n' "$RESPONSE"

TEXT="$(
  QUERY="$QUERY" REGION="$REGION" python3 "$ROOT/scripts/format-telegram.py" <<<"$RESPONSE"
)"

TG_RESPONSE="$(
  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${TEXT}" \
    --data-urlencode "parse_mode=HTML" \
    --data-urlencode "disable_web_page_preview=true"
)"

python3 -c '
import json, sys

data = json.loads(sys.stdin.read())
if not data.get("ok"):
    print(data, file=sys.stderr)
    raise SystemExit(1)
' <<<"$TG_RESPONSE"

echo "Sent to Telegram"
