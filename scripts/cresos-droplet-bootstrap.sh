#!/usr/bin/env bash
# Run as root on a fresh Ubuntu droplet (e.g. via DigitalOcean web console).
# Installs Docker + Nginx + Certbot, clones CresOs, wires reverse proxy for
# https://YOUR_DOMAIN with API under /api/ (matches NEXT_PUBLIC_API_URL).
#
# Usage:
#   export CRESOS_DOMAIN=cresos.cresdynamics.com
#   export CRESOS_CERT_EMAIL=info@cresdynamics.com   # for Let's Encrypt
#   bash scripts/cresos-droplet-bootstrap.sh
#
# Before running: point DNS A/AAAA for $CRESOS_DOMAIN to this server's public IP.
set -euo pipefail

CRESOS_DOMAIN="${CRESOS_DOMAIN:-cresos.cresdynamics.com}"
CRESOS_CERT_EMAIL="${CRESOS_CERT_EMAIL:-admin@localhost}"
CRESOS_REPO="${CRESOS_REPO:-https://github.com/cresdynamics-lang/CresOs.git}"
CRESOS_ROOT="${CRESOS_ROOT:-/root/CresOs}"

export DEBIAN_FRONTEND=noninteractive

echo "[cresos] domain=$CRESOS_DOMAIN repo=$CRESOS_REPO root=$CRESOS_ROOT"

apt-get update -y
apt-get install -y ca-certificates curl git nginx ufw

if ! command -v docker >/dev/null 2>&1; then
  echo "[cresos] installing Docker Engine…"
  curl -fsSL https://get.docker.com | sh
fi

if ! dpkg -l certbot python3-certbot-nginx >/dev/null 2>&1; then
  apt-get install -y certbot python3-certbot-nginx
fi

ufw --force reset || true
ufw default deny incoming || true
ufw default allow outgoing || true
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

if [[ ! -d "$CRESOS_ROOT/.git" ]]; then
  echo "[cresos] cloning…"
  mkdir -p "$(dirname "$CRESOS_ROOT")"
  git clone "$CRESOS_REPO" "$CRESOS_ROOT"
else
  echo "[cresos] updating existing clone…"
  cd "$CRESOS_ROOT"
  git fetch --all
  git pull --ff-only
fi

cd "$CRESOS_ROOT"

if [[ ! -f .env ]]; then
  echo "[cresos] creating minimal .env (add GROQ_*, MAIL_*, RESEND_* as needed after boot)."
  umask 077
  cat >.env <<ENVEOF
DATABASE_URL=postgresql://cresos:cresos@db:5432/cresos
JWT_SECRET=$(openssl rand -hex 32)
NEXT_PUBLIC_API_URL=https://${CRESOS_DOMAIN}/api
ENVEOF
fi

# Ensure compose picks up API URL for the Next.js build and runtime.
if grep -q '^NEXT_PUBLIC_API_URL=' .env; then
  sed -i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=https://${CRESOS_DOMAIN}/api|" .env
else
  echo "NEXT_PUBLIC_API_URL=https://${CRESOS_DOMAIN}/api" >> .env
fi

# DB URL for in-compose Postgres service name `db`
if grep -q '^DATABASE_URL=' .env; then
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://cresos:cresos@db:5432/cresos|' .env
else
  echo "DATABASE_URL=postgresql://cresos:cresos@db:5432/cresos" >> .env
fi

if grep -q '^JWT_SECRET=' .env && grep -qE '^JWT_SECRET=(dev-secret|local-docker-jwt-secret-change-me)$' .env; then
  echo "[cresos] replacing weak JWT_SECRET…"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
fi

echo "[cresos] building and starting stack (production overlay — loopback ports only)…"
COMPOSE_FILES="-f docker-compose.yml"
if [[ -f docker-compose.prod.yml ]]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
fi
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up --build -d

NGINX_SITE="/etc/nginx/sites-available/cresos.conf"
NGINX_HTTP_TEMPLATE="$CRESOS_ROOT/deploy/nginx/cresos-site-http.conf"
echo "[cresos] writing nginx site → $NGINX_SITE"
if [[ -f "$NGINX_HTTP_TEMPLATE" ]]; then
  sed "s/YOUR_DOMAIN/${CRESOS_DOMAIN}/g" "$NGINX_HTTP_TEMPLATE" >"$NGINX_SITE"
else
  echo "[cresos] missing $NGINX_HTTP_TEMPLATE" >&2
  exit 1
fi

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/cresos.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

echo "[cresos] obtaining TLS certificate (requires DNS A/AAAA for ${CRESOS_DOMAIN} → this host)…"
if certbot certonly --webroot -w /var/www/html -d "$CRESOS_DOMAIN" --non-interactive --agree-tos -m "$CRESOS_CERT_EMAIL"; then
  echo "[cresos] TLS certificate installed."
  NGINX_TLS_TEMPLATE="$CRESOS_ROOT/deploy/nginx/cresos-site.conf"
  if [[ -f "$NGINX_TLS_TEMPLATE" ]]; then
    sed "s/YOUR_DOMAIN/${CRESOS_DOMAIN}/g" "$NGINX_TLS_TEMPLATE" >"$NGINX_SITE"
    nginx -t
    systemctl reload nginx
  fi
else
  echo "[cresos] certbot failed (usually DNS not pointed yet). HTTP reverse proxy is still active; re-run:"
  echo "        certbot certonly --webroot -w /var/www/html -d \"$CRESOS_DOMAIN\" --non-interactive --agree-tos -m \"$CRESOS_CERT_EMAIL\""
  echo "        sed \"s/YOUR_DOMAIN/${CRESOS_DOMAIN}/g\" deploy/nginx/cresos-site.conf | sudo tee /etc/nginx/sites-available/cresos.conf"
  echo "        sudo nginx -t && sudo systemctl reload nginx"
fi

if [[ -f "$CRESOS_ROOT/scripts/cresos-prod-harden-ports.sh" ]]; then
  CRESOS_DOMAIN="$CRESOS_DOMAIN" bash "$CRESOS_ROOT/scripts/cresos-prod-harden-ports.sh"
fi

echo "[cresos] done. Checks:"
curl -fsS "http://127.0.0.1:4000/health" && echo
curl -fsS "http://127.0.0.1:4000/health/ready" && echo
docker ps --format 'table {{.Names}}\t{{.Status}}'
