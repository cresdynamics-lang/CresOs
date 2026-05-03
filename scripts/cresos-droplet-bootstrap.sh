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

echo "[cresos] building and starting stack…"
docker compose up --build -d

NGINX_SITE="/etc/nginx/sites-available/cresos.conf"
echo "[cresos] writing nginx site → $NGINX_SITE"
cat >"$NGINX_SITE" <<EOF
map \$http_upgrade \$connection_upgrade {
  default upgrade;
  ''      close;
}

server {
  listen 80;
  listen [::]:80;
  server_name ${CRESOS_DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/html;
  }

  # API + WebSocket (client uses https://domain/api/... and wss://domain/api/...)
  location /api/ {
    proxy_pass http://127.0.0.1:4000/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 86400;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/cresos.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

echo "[cresos] obtaining TLS certificate (requires DNS A/AAAA for ${CRESOS_DOMAIN} → this host)…"
if certbot --nginx -d "$CRESOS_DOMAIN" --non-interactive --agree-tos -m "$CRESOS_CERT_EMAIL" --redirect; then
  echo "[cresos] TLS certificate installed."
else
  echo "[cresos] certbot failed (usually DNS not pointed yet). HTTP reverse proxy is still active; re-run:"
  echo "        certbot --nginx -d \"$CRESOS_DOMAIN\" --non-interactive --agree-tos -m \"$CRESOS_CERT_EMAIL\" --redirect"
fi

echo "[cresos] done. Checks:"
curl -fsS "http://127.0.0.1:4000/health" && echo
curl -fsS "http://127.0.0.1:4000/health/ready" && echo
docker ps --format 'table {{.Names}}\t{{.Status}}'
