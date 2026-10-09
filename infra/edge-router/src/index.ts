interface Env {
  ORIGIN_HOST: string;
  APEX_HOST: string;
  ASSETS: Fetcher;
}

const isAppsPath = (path: string) => path === "/apps" || path.startsWith("/apps/");

/**
 * Front door for the whole lizstudio.io zone:
 *   /apps/*            -> factory VPS (through the Cloudflare Tunnel's hostname)
 *   lizstudio.io/...   -> redirect to www (the homepage's canonical host)
 *   everything else    -> the static homepage in ./public
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (isAppsPath(url.pathname)) return proxyToOrigin(request, env);
    if (url.host === env.APEX_HOST) {
      url.host = `www.${env.APEX_HOST}`;
      return Response.redirect(url.toString(), 308);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** Proxies the request to the factory origin, keeping the path (/apps/<name>/...) unchanged. */
async function proxyToOrigin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const publicHost = url.host;
  url.host = env.ORIGIN_HOST;

  const proxied = new Request(url, request);
  proxied.headers.set("X-Forwarded-Host", publicHost);
  const res = await fetch(proxied);

  // An app redirecting with an absolute URL would leak the origin hostname; point it back at the public one.
  const location = res.headers.get("Location");
  if (!location) return res;
  const target = new URL(location, url);
  if (target.host !== env.ORIGIN_HOST) return res;
  target.host = publicHost;
  const rewritten = new Response(res.body, res);
  rewritten.headers.set("Location", target.toString());
  return rewritten;
}
