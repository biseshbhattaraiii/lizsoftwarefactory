# liz.studio software factory

liz.studio is an AI software factory, run by agents, that builds software for people. This repo holds its experimental apps and the scripts that host them on a single VPS behind Cloudflare.

Each app lives under `apps/<name>` and is served at **`https://lizstudio.au/apps/<name>`**. When an app is ready, it graduates to a live product.

| App | Path | Status |
| --- | --- | --- |
| [Stickies](apps/stickies): collaborative sticky notes that stay on top of your screen | `/apps/stickies` | experimental |

## How it fits together

```
browser ──https──▶ Cloudflare ──tunnel──▶ cloudflared (VPS) ──▶ 127.0.0.1:<port>  (systemd: liz-<app>)
```

- **`factory.json`** is the single source of truth: each app's directory, URL path, and port.
- **`scripts/factory.mjs`** builds an app with its path as the Next.js `basePath`, installs it as a systemd service (`liz-<name>`), and generates the Cloudflare Tunnel routing rules.
- **Cloudflare Tunnel** provides HTTPS without opening any ports on the VPS. It routes `lizstudio.au/apps/<name>` to the matching local port.

## Set up a VPS

Requires Ubuntu or Debian, Node.js 20+, and sudo.

```bash
git clone https://github.com/biseshbhattaraiii/lizsoftwarefactory.git
cd lizsoftwarefactory
./scripts/setup-vps.sh
```

This installs `cloudflared`, then builds and starts every app. Once `lizstudio.au` shows **Active** in the Cloudflare dashboard, connect the tunnel (one time only):

```bash
cloudflared tunnel login                       # opens a link: pick lizstudio.au
cloudflared tunnel create lizstudio
cloudflared tunnel route dns lizstudio lizstudio.au
node scripts/factory.mjs tunnel-config         # writes /etc/cloudflared/config.yml
sudo cloudflared service install && sudo systemctl restart cloudflared
```

## Day to day

```bash
node scripts/factory.mjs status               # what's running, and where
node scripts/factory.mjs deploy stickies      # git pull, rebuild, restart one app
node scripts/factory.mjs deploy all
```

## Add an app

1. Put it in `apps/<name>`. Next.js apps should read `BASE_PATH` in `next.config.ts` (see `apps/stickies/next.config.ts`).
2. Add an entry to `factory.json` with an unused port.
3. Run `node scripts/factory.mjs install <name>`, then `node scripts/factory.mjs tunnel-config` and `sudo systemctl restart cloudflared`.

## Secrets

None are committed. Per-app secrets go in `apps/<name>/.env.local` on the server (gitignored). Tunnel credentials stay in `~/.cloudflared/`.
