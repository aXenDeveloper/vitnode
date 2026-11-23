import { z } from "zod";

import { buildRoute } from "@/builders";
import { renderSitemapFile, renderSitemapIndex } from "@/lib/seo/serve.server";
import { SEO_CACHE_CONTROL } from "@/lib/seo/sitemap";
import { loadSiteStatus } from "@/lib/site-status.server";

const XML = "application/xml; charset=utf-8";

const xmlResponses = {
  200: {
    content: { "application/xml": { schema: z.string() } },
    description: "Sitemap XML",
  },
  404: { description: "Sitemaps are off, or there is no such file" },
  503: { description: "The site is offline" },
} as const;

const notFound = () =>
  new Response("Not Found", {
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    status: 404,
  });

const offline = () =>
  new Response("Service Unavailable", {
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
    status: 503,
  });

const xml = (body: string) =>
  new Response(body, {
    headers: {
      "Cache-Control": SEO_CACHE_CONTROL,
      "Content-Type": XML,
      "X-Content-Type-Options": "nosniff",
    },
    status: 200,
  });

export const sitemapIndexRoute = buildRoute({
  allowWhenOffline: true,
  route: {
    method: "get",
    description:
      "The sitemap index: one file per page of every enabled sitemap source.",
    path: "/sitemap",
    responses: xmlResponses,
  },
  handler: async c => {
    if ((await loadSiteStatus(c)).offline) return offline();
    const body = await renderSitemapIndex(c);

    return body === null ? notFound() : xml(body);
  },
});

export const sitemapFileRoute = buildRoute({
  allowWhenOffline: true,
  route: {
    method: "get",
    description:
      "One sitemap file, `{sourceId}-{page}.xml` with 1-indexed pages.",
    path: "/sitemaps/{file}",
    request: {
      params: z.object({ file: z.string().max(128) }),
    },
    responses: xmlResponses,
  },
  handler: async c => {
    if ((await loadSiteStatus(c)).offline) return offline();
    const { file } = c.req.valid("param");
    const body = await renderSitemapFile(c, file);

    return body === null ? notFound() : xml(body);
  },
});
