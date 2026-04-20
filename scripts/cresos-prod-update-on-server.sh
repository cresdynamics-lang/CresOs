#!/usr/bin/env bash
# Run ON the production host from the repo root (e.g. /root/CresOs).
# Usage: bash scripts/cresos-prod-update-on-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[cresos] repo: $ROOT"
git fetch --all
git pull

if command -v docker >/dev/null 2>&1 && test -f docker-compose.yml; then
  echo "[cresos] using Docker Compose (rebuild + restart api/web/db stack)"
  docker compose up --build -d
  docker ps --format "table {{.Names}}\t{{.Status}}"
  echo "[cresos] update finished."
  exit 0
fi

echo "[cresos] no docker-compose.yml or docker — falling back to npm + pm2"
npm install
( cd apps/api && npm install && npm run build )
( cd apps/web && npm install && npm run build )
pm2 list
pm2 restart cresos-api
pm2 restart cresos-web
pm2 save
pm2 list

echo "[cresos] update finished."
