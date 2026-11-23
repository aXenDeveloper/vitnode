import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import {
  SITE_OG_IMAGE_ACCENT_PATTERN,
  SITE_OG_IMAGE_CATEGORY_MAX,
  SITE_OG_IMAGE_DESCRIPTION_MAX,
  SITE_OG_IMAGE_LAYOUTS,
  SITE_OG_IMAGE_TITLE_MAX,
} from "@/lib/metadata";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  ogImageBaseProps,
  ogImageResponse,
  ogImageVersion,
} from "@/lib/og-image";

const pageText = (value: string | undefined): null | string => {
  const text = value?.replaceAll(/\s+/g, " ").trim() ?? "";

  return text === "" ? null : text;
};

export const siteOgImageRoute = buildRoute({
  route: {
    method: "get",
    description:
      "The site's social card (og:image), used by pages without their own: the page's title and description on the site's card",
    path: "/site",
    request: {
      query: z.object({
        accent: z.string().regex(SITE_OG_IMAGE_ACCENT_PATTERN).optional(),
        category: z.string().max(SITE_OG_IMAGE_CATEGORY_MAX).optional(),
        description: z.string().max(SITE_OG_IMAGE_DESCRIPTION_MAX).optional(),
        layout: z.enum(SITE_OG_IMAGE_LAYOUTS).optional(),
        locale: z.string().max(35).optional(),
        title: z.string().max(SITE_OG_IMAGE_TITLE_MAX).optional(),
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

    const query = c.req.valid("query");
    const base = ogImageBaseProps(c);
    const title = pageText(query.title);
    const category = pageText(query.category);
    const theme =
      query.accent === undefined
        ? base.theme
        : { ...base.theme, accent: query.accent };
    const description =
      pageText(query.description) ??
      (title === null ? (c.get("core").metadata.description ?? null) : null);

    return await ogImageResponse(
      c,
      {
        ...base,
        ...(category === null ? {} : { category }),
        description,
        kind: "site",
        layout: query.layout,
        locale: pageText(query.locale),
        theme,
        title: title ?? base.siteName,
      },
      {
        version: ogImageVersion(c, [
          "site",
          title,
          description,
          query.layout,
          category,
          query.accent,
        ]),
      },
    );
  },
});
