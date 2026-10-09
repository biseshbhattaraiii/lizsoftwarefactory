# liz.studio software factory

liz.studio is an AI software factory, run by agents, that builds software for people. This repo holds its experimental apps and the scripts that host them on a single VPS behind Cloudflare.

Each app lives under `apps/<name>` and is served at **`https://lizstudio.io/apps/<name>`**. When an app is ready, it graduates to a live product.

| App | Path | Status |
| --- | --- | --- |
| [Stickies](apps/stickies): collaborative sticky notes that stay on top of your screen | `/apps/stickies` | experimental |

## How it fits together

```
www.lizstudio.io/*    ─▶ edge-router Worker ─▶ static homepage (infra/edge-router/public)
lizstudio.io/*        ─▶ edge-router Worker ─▶ 308 redirect to www
lizstudio.io/apps/*   ─▶ edge-router Worker ─▶ apps-origin.lizstudio.io ─tunnel─▶ VPS 127.0.0.1:<port> (systemd: liz-<app>)
```

- **`factory.json`** is the single source of truth: each app's directory, URL path, and port.
- **`scripts/factory.mjs`** builds an app with its path as the Next.js `basePath`, installs it as a systemd service (`liz-<name>`), and generates the Cloudflare Tunnel routing rules.
- **`infra/edge-router`** is the Cloudflare Worker in front of the whole domain. It serves the homepage from `public/` as static assets and forwards `/apps/*` to the tunnel. Edit `public/index.html` to change the homepage.
- **Cloudflare Tunnel** provides HTTPS without opening any ports on the VPS. It serves only `apps-origin.lizstudio.io` and routes each `/apps/<name>` path to the matching local port.

## Set up a VPS

Requires Ubuntu or Debian, Node.js 20+, and passwordless sudo.

```bash
git clone https://github.com/biseshbhattaraiii/lizsoftwarefactory.git ~/liz-deploy
cd ~/liz-deploy
./scripts/setup-vps.sh
```

This installs `cloudflared`, builds and starts every app, and turns on auto-deploy. Once `lizstudio.io` shows **Active** in the Cloudflare dashboard, connect the tunnel (one time only):

```bash
cloudflared tunnel login                       # opens a link: pick lizstudio.io
cloudflared tunnel create lizstudio
cloudflared tunnel route dns lizstudio apps-origin.lizstudio.io   # NOT the bare domain: the Worker owns it
node scripts/factory.mjs tunnel-config         # writes /etc/cloudflared/config.yml
sudo cloudflared service install && sudo systemctl restart cloudflared

# Homepage + route lizstudio.io/apps* to the tunnel
cd infra/edge-router && npm ci && npx wrangler login && npx wrangler deploy
```

`lizstudio.io` and `www` are proxied placeholder records (`AAAA 100::`) so the Worker routes fire. Keep the Zoho MX/SPF/DKIM records when editing DNS, or email breaks.

## Push to deploy

Push to `main`, and it's live within a couple of minutes. Nothing else to run.

| What changed | Who deploys it | How |
| --- | --- | --- |
| `apps/<name>/**` | the VPS | `liz-autodeploy.timer` checks GitHub every minute, pulls, then rebuilds and restarts only the apps whose folders changed |
| `factory.json` | the VPS | redeploys every app and refreshes the tunnel routes |
| `infra/edge-router/**` | Cloudflare | Workers Builds (Cloudflare's Git integration, like Pages) runs `npx wrangler deploy` |

The repo is public, so the VPS pulls with no credentials, and GitHub holds no secrets. Deploy from a clone used only for deploying (e.g. `~/liz-deploy`), and do development in another clone.

**Connect the Worker to Cloudflare (once):** Cloudflare dashboard → Workers & Pages → Create → Import a repository → `lizsoftwarefactory`. Then set:
- Root directory: `infra/edge-router`
- Deploy command: `npx wrangler deploy`
- Build watch paths: include `infra/edge-router/*`, so app pushes don't redeploy the Worker

## Day to day

```bash
node scripts/factory.mjs status                     # what's running, and the deployed commit
journalctl -u liz-autodeploy -n 50                  # recent auto-deploys and any build errors
node scripts/factory.mjs deploy stickies            # manual: pull, rebuild, restart one app
```

## Add an app

1. Put it in `apps/<name>`. Next.js apps should read `BASE_PATH` in `next.config.ts` (see `apps/stickies/next.config.ts`).
2. Add an entry to `factory.json` with an unused port.
3. Run `node scripts/factory.mjs install <name>`, then `node scripts/factory.mjs tunnel-config` and `sudo systemctl restart cloudflared`. The Worker already covers every `/apps/*` path, so it doesn't need redeploying.

## Secrets

None are committed. Per-app secrets go in `apps/<name>/.env.local` on the server (gitignored). Tunnel credentials stay in `~/.cloudflared/`.
