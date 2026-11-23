import "@tanstack/react-start/server-only";

import { fetcher } from "@/tanstack/fetcher/server";

const RELAYED_HEADERS = [
  "cache-control",
  "content-type",
  "retry-after",
  "x-content-type-options",
] as const;

const relay = (response: Response): Response => {
  const headers = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = response.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  return new Response(response.body, { headers, status: response.status });
};

const unavailable = (): Response =>
  new Response("Service Unavailable", {
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "retry-after": "60",
    },
    status: 503,
  });

const safely = async (load: () => Promise<Response>): Promise<Response> => {
  try {
    return relay(await load());
  } catch {
    // A crawler that gets a 5xx retries later and keeps what it has indexed.
    return unavailable();
  }
};

/**
 * `GET /robots.txt`: the file the API generates from the AdminCP SEO
 * settings, with its status and cache headers. Server-only.
 *
 * @example
 * // src/routes/robots[.]txt.ts
 * import { createFileRoute } from "@tanstack/react-router";
 * import { robotsTxtHandler } from "@vitnode/core/tanstack/seo/server";
 *
 * export const Route = createFileRoute("/robots.txt")({
 *   server: { handlers: { GET: robotsTxtHandler } },
 * });
 */
export const robotsTxtHandler = async (): Promise<Response> =>
  await safely(
    async () =>
      await fetcher({
        method: "get",
        module: "seo",
        path: "/robots",
        plugin: "@vitnode/core",
      }),
  );

/** `GET /sitemap.xml`: the sitemap index. Server-only. */
export const sitemapIndexHandler = async (): Promise<Response> =>
  await safely(
    async () =>
      await fetcher({
        method: "get",
        module: "seo",
        path: "/sitemap",
        plugin: "@vitnode/core",
      }),
  );

/** `GET /sitemaps/{file}`: one sub-sitemap, e.g. `blog_post-1.xml`. Server-only. */
export const sitemapFileHandler = async ({
  params,
}: {
  params: { file: string };
}): Promise<Response> =>
  await safely(
    async () =>
      await fetcher({
        args: { params: { file: params.file } },
        method: "get",
        module: "seo",
        path: "/sitemaps/{file}",
        plugin: "@vitnode/core",
      }),
  );
