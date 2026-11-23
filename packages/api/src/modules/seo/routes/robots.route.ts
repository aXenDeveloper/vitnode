import { z } from "zod";

import { buildRoute } from "@/builders";
import { renderRobotsTxt } from "@/lib/seo/serve.server";
import { loadSeoSettings } from "@/lib/seo/settings.server";
import { retryAfterSeconds } from "@/lib/site-status";

/** Short, so turning indexing off reaches crawlers within minutes. */
const ROBOTS_CACHE_CONTROL =
  "public, max-age=300, s-maxage=300, stale-while-revalidate=3600";

export const robotsRoute = buildRoute({
  allowWhenOffline: true,
  route: {
    method: "get",
    description:
      "The site's `robots.txt`, generated from the AdminCP SEO settings. While the site is offline it answers `503` with `Retry-After`, which crawlers read as a temporary pause rather than a reason to drop pages.",
    path: "/robots",
    responses: {
      200: {
        content: { "text/plain": { schema: z.string() } },
        description: "robots.txt",
      },
      503: {
        content: { "text/plain": { schema: z.string() } },
        description: "The site is offline",
      },
    },
  },
  handler: async c => {
    const settings = await loadSeoSettings(c);
    const { body, offline, opensAt } = await renderRobotsTxt(c, settings);

    if (offline) {
      const retryAfter = retryAfterSeconds(opensAt);

      return c.text(body, 503, {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        ...(retryAfter === null ? {} : { "Retry-After": String(retryAfter) }),
      });
    }

    return c.text(body, 200, {
      "Cache-Control": ROBOTS_CACHE_CONTROL,
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
  },
});
