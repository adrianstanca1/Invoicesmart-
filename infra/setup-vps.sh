#!/usr/bin/env bash
# One-shot VPS bootstrap for Invoicesmart.
#
# The DEFAULT_* values below match the live production deployment.
# Override any of them with environment variables, e.g.:
#   sudo DOMAIN=staging.example.com EMAIL=you@example.com bash infra/setup-vps.sh
#
# Usage (run as root or via sudo on the VPS):
#   curl -fsSL https://raw.githubusercontent.com/adrianstanca1/Invoicesmart-/main/infra/setup-vps.sh | sudo bash
#
# What it does:
#   1. Installs nginx, certbot, curl, rsync
#   2. Creates a non-login 'deploy' user with sudo NOPASSWD on nginx reload only
#   3. Installs Ollama, binds it to 127.0.0.1:11434, enables the systemd service
#   4. Pulls $OLLAMA_MODEL
#   5. Drops the nginx site (SPA + reverse-proxy for /ollama/)
#   6. Issues a Let's Encrypt cert with certbot --nginx
#
# After this completes, add the deploy user's SSH key (see DEPLOY_KEY_PUB env var
# below) and trigger the GitHub Action to upload dist/.

set -euo pipefail

DEFAULT_DOMAIN="invoicesmart.cortexbuildpro.com"
DEFAULT_EMAIL="admin@cortexbuildpro.com"
DEFAULT_OLLAMA_MODEL="llama3.2-vision:11b"

DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"
EMAIL="${EMAIL:-$DEFAULT_EMAIL}"
OLLAMA_MODEL="${OLLAMA_MODEL:-$DEFAULT_OLLAMA_MODEL}"
DEPLOY_KEY_PUB="${DEPLOY_KEY_PUB:-}"
WEB_ROOT="/var/www/invoicesmart"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root (sudo)." >&2
  exit 1
fi

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx curl rsync ca-certificates

echo "==> Ensuring 'deploy' user exists"
if ! id -u deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

if [[ -n "$DEPLOY_KEY_PUB" ]]; then
  if ! grep -qF "$DEPLOY_KEY_PUB" /home/deploy/.ssh/authorized_keys 2>/dev/null; then
    echo "$DEPLOY_KEY_PUB" >> /home/deploy/.ssh/authorized_keys
    echo "    Added DEPLOY_KEY_PUB to /home/deploy/.ssh/authorized_keys"
  fi
fi

echo "==> Granting deploy minimal sudo (nginx reload + test only)"
cat > /etc/sudoers.d/deploy <<'EOF'
deploy ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx, /bin/systemctl restart nginx, /usr/sbin/nginx -t
EOF
chmod 440 /etc/sudoers.d/deploy

echo "==> Creating web root at $WEB_ROOT"
install -d -o deploy -g deploy -m 755 "$WEB_ROOT"
if [[ ! -f "$WEB_ROOT/index.html" ]]; then
  cat > "$WEB_ROOT/index.html" <<HTML
<!doctype html><meta charset=utf-8>
<title>Invoicesmart - awaiting deploy</title>
<p>Server is ready. Push to <code>main</code> to deploy the app.</p>
HTML
  chown deploy:deploy "$WEB_ROOT/index.html"
fi

echo "==> Installing Ollama (if missing)"
if ! command -v ollama >/dev/null 2>&1; then
  curl -fsSL https://ollama.com/install.sh | sh
fi

echo "==> Binding Ollama to 127.0.0.1 only"
mkdir -p /etc/systemd/system/ollama.service.d
cat > /etc/systemd/system/ollama.service.d/override.conf <<'EOF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11434"
EOF
systemctl daemon-reload
systemctl enable --now ollama
# Give Ollama a moment to come up.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "==> Pulling Ollama model: $OLLAMA_MODEL"
ollama pull "$OLLAMA_MODEL"

echo "==> Installing nginx site for $DOMAIN"
NGX_SRC="$SCRIPT_DIR/nginx.conf.template"
if [[ ! -f "$NGX_SRC" ]]; then
  NGX_SRC="$(mktemp)"
  curl -fsSL "https://raw.githubusercontent.com/adrianstanca1/Invoicesmart-/main/infra/nginx.conf.template" -o "$NGX_SRC"
fi
NGX_DST="/etc/nginx/sites-available/invoicesmart"
sed "s/__DOMAIN__/${DOMAIN}/g" "$NGX_SRC" > "$NGX_DST"
ln -sf "$NGX_DST" /etc/nginx/sites-enabled/invoicesmart
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> Requesting Let's Encrypt certificate for $DOMAIN"
certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN" --redirect

echo
echo "==> Done."
echo "Open https://$DOMAIN once your GitHub Action has uploaded dist/."
echo "Test the LLM proxy:  curl -fsS https://$DOMAIN/ollama/api/tags"
