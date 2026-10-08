# liz.studio software factory

liz.studio is an AI software factory, run by agents, that builds software for people. This repo holds its experimental apps and the scripts that host them on a single VPS behind Cloudflare.

Each app lives under `apps/<name>` and is served at **`https://lizstudio.au/apps/<name>`**. When an app is ready, it graduates to a live product.

| App | Path | Status |
| --- | --- | --- |
| [Stickies](apps/stickies): collaborative sticky notes that stay on top of your screen | `/apps/stickies` | experimental |

## How it fits together

```
lizstudio.au/*        ─▶ homepage (hosted elsewhere, untouched)
lizstudio.au/apps/*   ─▶ edge-router Worker ─▶ apps-origin.lizstudio.au ─tunnel─▶ VPS 127.0.0.1:<port> (systemd: liz-<app>)
```

- **`factory.json`** is the single source of truth: each app's directory, URL path, and port.
- **`scripts/factory.mjs`** builds an app with its path as the Next.js `basePath`, installs it as a systemd service (`liz-<name>`), and generates the Cloudflare Tunnel routing rules.
- **`infra/edge-router`** is a small Cloudflare Worker on the route `lizstudio.au/apps*`. It forwards those requests to the tunnel, so the homepage keeps running wherever it's hosted.
- **Cloudflare Tunnel** provides HTTPS without opening any ports on the VPS. It serves only `apps-origin.lizstudio.au` and routes each `/apps/<name>` path to the matching local port.

## Set up a VPS

Requires Ubuntu or Debian, Node.js 20+, and passwordless sudo.

```bash
git clone https://github.com/biseshbhattaraiii/lizsoftwarefactory.git ~/liz-deploy
cd ~/liz-deploy
./scripts/setup-vps.sh
```

This installs `cloudflared`, builds and starts every app, and turns on auto-deploy. Once `lizstudio.au` shows **Active** in the Cloudflare dashboard, connect the tunnel (one time only):

```bash
cloudflared tunnel login                       # opens a link: pick lizstudio.au
cloudflared tunnel create lizstudio
cloudflared tunnel route dns lizstudio apps-origin.lizstudio.au   # NOT the bare domain: that's the homepage
node scripts/factory.mjs tunnel-config         # writes /etc/cloudflared/config.yml
sudo cloudflared service install && sudo systemctl restart cloudflared

# Route lizstudio.au/apps* to the tunnel
cd infra/edge-router && npm ci && npx wrangler login && npx wrangler deploy
```

Before the nameserver switch, make sure Cloudflare's DNS has the homepage's records (Cloudflare copies most of them when you add the site). Otherwise the homepage goes down.

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
