import { buildRoute } from "@/builders";
import { setPageCacheTags } from "@/lib/page-cache";
import { SITE_STATUS_PAGE_CACHE_TAG, zodSiteStatus } from "@/lib/site-status";
import { canBypassSiteOffline, loadSiteStatus } from "@/lib/site-status.server";

export const siteStatusRoute = buildRoute({
  allowWhenOffline: true,
  route: {
    method: "get",
    description:
      "Whether the public site is online. While it is offline, also the reason per language, the planned opening time and whether the requesting viewer may still use the site.",
    path: "/status",
    responses: {
      200: {
        content: { "application/json": { schema: zodSiteStatus } },
        description: "Site status",
      },
    },
  },
  handler: async c => {
    const status = await loadSiteStatus(c);
    setPageCacheTags(c, [SITE_STATUS_PAGE_CACHE_TAG]);

    if (!status.offline) {
      return c.json(
        {
          message: [],
          offline: false,
          opensAt: null,
          serverNow: new Date().toISOString(),
          showCountdown: false,
          viewerCanBypass: false,
        },
        200,
      );
    }

    return c.json(
      {
        message: status.message,
        offline: true,
        opensAt: status.opensAt,
        serverNow: new Date().toISOString(),
        showCountdown: status.showCountdown && status.opensAt !== null,
        viewerCanBypass: await canBypassSiteOffline(c),
      },
      200,
    );
  },
});
