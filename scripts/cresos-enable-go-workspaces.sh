#!/usr/bin/env bash
# Enable Go sales/developer workspaces on an existing CresOS droplet.
# Run from the CresOS repo root on the server (usually /root/CresOs).
#
#   export CRESOS_DOMAIN=cresos.cresdynamics.com
#   bash scripts/cresos-enable-go-workspaces.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CRESOS_DOMAIN="${CRESOS_DOMAIN:-cresos.cresdynamics.com}"

echo "[cresos] enabling Go workspaces for https://${CRESOS_DOMAIN}"

if [[ ! -f .env ]]; then
  echo "missing .env — run bootstrap first" >&2
  exit 1
fi

upsert() {
  local key="$1" val="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  else
    echo "${key}=${val}" >> .env
  fi
}

upsert NEXT_PUBLIC_SALES_GO_URL "https://${CRESOS_DOMAIN}/w/sales"
upsert NEXT_PUBLIC_DEVELOPER_GO_URL "https://${CRESOS_DOMAIN}/w/developer"
upsert PUBLIC_WEB_URL "https://${CRESOS_DOMAIN}"
upsert SECURE_COOKIE "true"

# Keep API JWT_SECRET as the shared secret for Go SSO.
if ! grep -q '^JWT_SECRET=' .env; then
  echo "JWT_SECRET missing in .env" >&2
  exit 1
fi

echo "[cresos] rebuilding web + sales-go + developer-go…"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up --build -d web sales-go developer-go api

NGINX_SITE="/etc/nginx/sites-available/cresos.conf"
if [[ -f deploy/nginx/cresos-site.conf ]]; then
  echo "[cresos] updating nginx site…"
  sed "s/YOUR_DOMAIN/${CRESOS_DOMAIN}/g" deploy/nginx/cresos-site.conf | tee "$NGINX_SITE" >/dev/null
  nginx -t
  systemctl reload nginx
fi

echo "[cresos] health checks:"
curl -fsS "http://127.0.0.1:4100/health" && echo
curl -fsS "http://127.0.0.1:4200/health" && echo
curl -fsS "https://${CRESOS_DOMAIN}/w/sales/health" && echo || echo "(public /w/sales/health not ready yet — check nginx)"
curl -fsS "https://${CRESOS_DOMAIN}/w/developer/health" && echo || echo "(public /w/developer/health not ready yet — check nginx)"

echo "[cresos] done. Pure sales/developer logins SSO to /w/sales and /w/developer."
