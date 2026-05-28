#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: BACKEND_URL=https://<your-backend> FRONTEND_ORIGIN=https://<your-frontend> bash scripts/deploy-diagnostics.sh

Required:
  BACKEND_URL       Public URL of the deployed backend (example: https://zerodayguardian-backend.onrender.com)
  FRONTEND_ORIGIN   Public origin of the deployed frontend (example: https://zerodayguardian-delta.vercel.app)

Optional:
  DIAGNOSTIC_EMAIL  Email address used for send-otp test (default: test@example.com)
EOF
  exit 1
}

if [[ -z "${BACKEND_URL:-}" || -z "${FRONTEND_ORIGIN:-}" ]]; then
  usage
fi

DIAGNOSTIC_EMAIL=${DIAGNOSTIC_EMAIL:-test@example.com}
COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

echo "=== Dispatching deploy diagnostics ==="
echo "BACKEND_URL=${BACKEND_URL}"
echo "FRONTEND_ORIGIN=${FRONTEND_ORIGIN}"
echo "DIAGNOSTIC_EMAIL=${DIAGNOSTIC_EMAIL}"

echo
 echo "--- /api/health ---"
curl -i --fail --silent --show-error "${BACKEND_URL%/}/api/health" || true

echo
 echo "--- /api/auth/providers ---"
curl -i --fail --silent --show-error -c "$COOKIE_FILE" "${BACKEND_URL%/}/api/auth/providers" || true

echo
 echo "--- /api/auth/csrf ---"
curl -i --fail --silent --show-error -b "$COOKIE_FILE" -c "$COOKIE_FILE" "${BACKEND_URL%/}/api/auth/csrf" || true

echo
 echo "--- /api/ping with Origin header ---"
curl -i --fail --silent --show-error -H "Origin: ${FRONTEND_ORIGIN}" "${BACKEND_URL%/}/api/ping" || true

echo
 echo "--- /api/auth/send-otp ---"
curl -i --fail --silent --show-error -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${DIAGNOSTIC_EMAIL}\"}" \
  "${BACKEND_URL%/}/api/auth/send-otp" || true

echo
 echo "Diagnostics complete. If the auth calls fail, paste the relevant response JSON and any error codes here."
