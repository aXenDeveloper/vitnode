import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  ogImageBaseProps,
  ogImageResponse,
  ogImageVersion,
} from "@/lib/og-image";

export const siteOgImageRoute = buildRoute({
  route: {
    method: "get",
    description:
      "The site's social card (og:image), used by pages without their own",
    path: "/site",
    request: {
      query: z.object({
        /** The card's version; a matching one is cached for a year. */
        v: z.string().max(32).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          [OG_IMAGE_TYPE]: {
            schema: z.string().openapi({ format: "binary", type: "string" }),
          },
        },
        description: `A ${OG_IMAGE_WIDTH} × ${OG_IMAGE_HEIGHT} PNG`,
      },
      404: { description: "Social cards are off" },
      503: { description: "The renderer failed; retry later" },
    },
  },
  handler: async c => {
    if (!c.get("core").ogImage.enabled) {
      return c.json({ error: "Social cards are off" }, 404);
    }

    const base = ogImageBaseProps(c);

    return await ogImageResponse(
      c,
      {
        ...base,
        description: c.get("core").metadata.description ?? null,
        kind: "site",
        locale: null,
        title: base.siteName,
      },
      {
        version: ogImageVersion(c, [
          "site",
          c.get("core").metadata.description,
        ]),
      },
    );
  },
});
