#!/usr/bin/env bash
# One-time VPS setup for liz.studio: installs cloudflared, builds every app in
# factory.json, runs each as a systemd service, and turns on auto-deploy from
# GitHub. Safe to re-run. Run it from a clone used only for deploying.
# Requires: Ubuntu/Debian, Node.js 20+, and passwordless sudo.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v node >/dev/null || { echo "Install Node.js 20+ first."; exit 1; }

if ! command -v cloudflared >/dev/null; then
  echo "▸ Installing cloudflared"
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
    | sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y -qq cloudflared
fi

node scripts/factory.mjs install all
node scripts/factory.mjs install-autodeploy
node scripts/factory.mjs status

cat <<'NEXT'

Apps are running. To put them on the internet through Cloudflare (once the
domain shows "Active" in the Cloudflare dashboard):

  cloudflared tunnel login                          # opens a link; pick the domain
  cloudflared tunnel create lizstudio
  cloudflared tunnel route dns lizstudio apps-origin.lizstudio.io   # never the bare domain: the Worker owns it
  node scripts/factory.mjs tunnel-config
  sudo cloudflared service install && sudo systemctl restart cloudflared
  cd infra/edge-router && npm ci && npx wrangler login && npx wrangler deploy

NEXT
