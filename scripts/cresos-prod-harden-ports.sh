#!/usr/bin/env bash
# Lock down production so only SSH + HTTP/HTTPS are reachable from the internet.
# App traffic must go through https://YOUR_DOMAIN (Nginx → loopback :3000 / :4000).
#
# Run on the droplet as root:
#   export CRESOS_DOMAIN=cresos.cresdynamics.com
#   bash scripts/cresos-prod-harden-ports.sh
set -euo pipefail

CRESOS_DOMAIN="${CRESOS_DOMAIN:-cresos.cresdynamics.com}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[cresos] run as root (e.g. sudo bash $0)" >&2
  exit 1
fi

echo "[cresos] hardening host firewall (UFW)…"
export DEBIAN_FRONTEND=noninteractive
if ! command -v ufw >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ufw
fi

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp comment 'HTTP (redirect + ACME)'
ufw allow 443/tcp comment 'HTTPS (CresOS via Nginx)'
ufw --force enable
ufw status verbose

echo "[cresos] checking listening sockets (expect only 22, 80, 443 on 0.0.0.0 / ::)…"
if command -v ss >/dev/null 2>&1; then
  PUBLIC_LISTEN="$(ss -tlnH | awk '{print $4}' | grep -E '^(0\.0\.0\.0|\[::\]):' || true)"
else
  PUBLIC_LISTEN="$(netstat -tln 2>/dev/null | awk '/^tcp/ && /0\.0\.0\.0:|:::/ {print $4}' || true)"
fi

BAD=0
while IFS= read -r addr; do
  [[ -z "$addr" ]] && continue
  port="${addr##*:}"
  port="${port%%]*}"
  case "$port" in
    22|80|443) ;;
    *)
      echo "[cresos] WARN: public listener $addr (should be loopback-only or blocked)" >&2
      BAD=1
      ;;
  esac
done <<<"$PUBLIC_LISTEN"

if [[ "$BAD" -eq 1 ]]; then
  echo "[cresos] fix Docker publish targets — use docker-compose.prod.yml (127.0.0.1 only)." >&2
fi

if command -v docker >/dev/null 2>&1 && [[ -f "$ROOT/docker-compose.yml" ]]; then
  echo "[cresos] ensuring stack uses production compose overlay…"
  cd "$ROOT"
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
  echo "[cresos] published ports:"
  docker ps --format 'table {{.Names}}\t{{.Ports}}'
fi

NGINX_TEMPLATE="$ROOT/deploy/nginx/cresos-site.conf"
NGINX_SITE="/etc/nginx/sites-available/cresos.conf"
if [[ -f "$NGINX_TEMPLATE" ]] && command -v nginx >/dev/null 2>&1; then
  echo "[cresos] installing Nginx site (domain-only access)…"
  sed "s/YOUR_DOMAIN/${CRESOS_DOMAIN}/g" "$NGINX_TEMPLATE" >"$NGINX_SITE"
  ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/cresos.conf
  rm -f /etc/nginx/sites-enabled/default || true
  if nginx -t 2>/dev/null; then
    systemctl reload nginx
  else
    echo "[cresos] nginx -t failed — run certbot if TLS paths are missing, then reload." >&2
  fi
fi

echo "[cresos] external port probe (from this host to public IP)…"
PUBLIC_IP="$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || true)"
if [[ -n "$PUBLIC_IP" ]]; then
  for port in 3000 4000 5432; do
    if timeout 2 bash -c "echo >/dev/tcp/${PUBLIC_IP}/${port}" 2>/dev/null; then
      echo "[cresos] FAIL: port $port is reachable on $PUBLIC_IP" >&2
      BAD=1
    else
      echo "[cresos] ok: port $port closed on $PUBLIC_IP"
    fi
  done
fi

echo "[cresos] app URL: https://${CRESOS_DOMAIN}/"
if [[ "$BAD" -eq 1 ]]; then
  exit 1
fi
echo "[cresos] hardening complete."
