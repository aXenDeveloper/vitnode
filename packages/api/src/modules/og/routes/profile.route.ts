import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/builders";
import { contentOgImageCover } from "@/content/server/delivery-og-image";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  ogImageResponse,
} from "@/lib/og-image";
import { UserModel } from "@/models/user";

import { profileCardProps, profileCardVersion } from "../lib/profile-card";

export const profileOgImageRoute = buildRoute({
  route: {
    method: "get",
    description: "A member's social card (og:image) for their public profile",
    path: "/users/{nameCode}",
    request: {
      params: z.object({
        nameCode: z.string().min(1).max(255).openapi({ example: "aXen" }),
      }),
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
      404: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description: "No such member, or social cards are off",
      },
      503: { description: "The renderer failed; retry later" },
    },
  },
  handler: async c => {
    if (!c.get("core").ogImage.enabled) {
      return c.json({ error: "Social cards are off" }, 404);
    }

    const user = await new UserModel().getUserByNameCode({
      c,
      nameCode: c.req.valid("param").nameCode,
    });
    if (!user) return c.json({ error: "User not found" }, 404);

    const props = profileCardProps(c, user);
    const image = user.coverId
      ? await contentOgImageCover(c, user.coverId)
      : undefined;

    return await ogImageResponse(
      c,
      { ...props, ...(image ? { image } : {}) },
      { version: profileCardVersion(c, props, user.coverId) },
    );
  },
});
