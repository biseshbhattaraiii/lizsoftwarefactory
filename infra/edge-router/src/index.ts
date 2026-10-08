interface Env {
  ORIGIN_HOST: string;
}

/** Proxies the request to the factory origin, keeping the path (/apps/<name>/...) unchanged. */
export default {
  async fetch(request, env): Promise<Response> {
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
  },
} satisfies ExportedHandler<Env>;
