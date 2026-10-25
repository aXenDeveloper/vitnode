import { z } from "@hono/zod-openapi";

import { buildRoute } from "@/api/builders";
import {
  OG_IMAGE_DESCRIPTION_MAX_LENGTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_MIME_TYPE,
  OG_IMAGE_TEMPLATE_ID_PATTERN,
  OG_IMAGE_TITLE_MAX_LENGTH,
  OG_IMAGE_WIDTH,
} from "@/og-image";
import { ogImageTemplateSummaries } from "@/og-image/server/config";
import {
  OG_IMAGE_PRIVATE_CACHE_CONTROL,
  ogImageResponse,
} from "@/og-image/server/response";

/** Largest cover the preview form accepts, in bytes. */
export const OG_IMAGE_PREVIEW_COVER_MAX_BYTES = 5 * 1024 * 1024;

const SEO_VIEW = { module: "seo", permission: "can_view" } as const;

export const ogImagesSeoAdminRoute = buildRoute({
  adminStaffPermission: SEO_VIEW,
  route: {
    method: "get",
    description:
      "The Open Graph image templates registered in vitnode.api.config.ts, without their code (Admin only).",
    path: "/og-images",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              coverMaxBytes: z.number().int(),
              defaultLocale: z.string(),
              // `false` while the API config has no `ogImages` block.
              enabled: z.boolean(),
              height: z.number().int(),
              locales: z.array(
                z.object({ code: z.string(), name: z.string() }),
              ),
              templates: z.array(
                z.object({
                  id: z.string(),
                  isDefault: z.boolean(),
                  label: z.string().nullable(),
                  version: z.string(),
                }),
              ),
              width: z.number().int(),
            }),
          },
        },
        description: "Templates and the languages a preview may use",
      },
    },
  },
  handler: c => {
    const { i18n, ogImages } = c.get("core");

    return c.json(
      {
        coverMaxBytes: OG_IMAGE_PREVIEW_COVER_MAX_BYTES,
        defaultLocale: i18n.defaultLocale,
        enabled: ogImages !== null,
        height: OG_IMAGE_HEIGHT,
        locales: i18n.locales.map(({ code, name }) => ({ code, name })),
        templates: ogImages ? ogImageTemplateSummaries(ogImages) : [],
        width: OG_IMAGE_WIDTH,
      },
      200,
      { "Cache-Control": OG_IMAGE_PRIVATE_CACHE_CONTROL },
    );
  },
});

export const previewOgImageSeoAdminRoute = buildRoute({
  adminStaffPermission: SEO_VIEW,
  route: {
    method: "post",
    description:
      "Render a temporary Open Graph image with a registered template. Nothing is stored (Admin only).",
    path: "/og-images/preview",
    request: {
      body: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: z.object({
              cover: z
                .instanceof(File)
                .optional()
                .openapi({ format: "binary", type: "string" }),
              description: z
                .string()
                .max(OG_IMAGE_DESCRIPTION_MAX_LENGTH)
                .optional(),
              locale: z.string().max(35).optional(),
              template: z.string().regex(OG_IMAGE_TEMPLATE_ID_PATTERN),
              title: z.string().trim().min(1).max(OG_IMAGE_TITLE_MAX_LENGTH),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          [OG_IMAGE_MIME_TYPE]: {
            schema: z.string().openapi({ format: "binary", type: "string" }),
          },
        },
        description: "The rendered image, never cached",
      },
      400: {
        content: {
          "application/json": { schema: z.object({ error: z.string() }) },
        },
        description:
          "Unknown template or language, a cover that is too large or not an image, or invalid text",
      },
      404: { description: "Open Graph images are off" },
    },
  },
  handler: async c => {
    const { cover, description, locale, template, title } = c.req.valid("form");
    const { i18n, ogImages } = c.get("core");
    const invalid = (error: string) =>
      c.json({ error }, 400, {
        "Cache-Control": OG_IMAGE_PRIVATE_CACHE_CONTROL,
      });

    if (!ogImages) {
      return c.json({ error: "Open Graph images are off." }, 404, {
        "Cache-Control": OG_IMAGE_PRIVATE_CACHE_CONTROL,
      });
    }
    // Checked before rendering: an unknown id is a 400 for this form, while
    // for a configured content type it is a configuration bug.
    if (!ogImages.templates.has(template)) {
      return invalid(`Unknown template "${template}".`);
    }
    if (locale && !i18n.locales.some(entry => entry.code === locale)) {
      return invalid(`Unknown language "${locale}".`);
    }
    if (cover && cover.size > OG_IMAGE_PREVIEW_COVER_MAX_BYTES) {
      return invalid("The cover is larger than 5 MB.");
    }

    return await ogImageResponse(
      c,
      {
        cover:
          cover && cover.size > 0
            ? { bytes: new Uint8Array(await cover.arrayBuffer()) }
            : null,
        description,
        identity: ["admin-preview"],
        locale,
        template,
        title,
      },
      { cacheControl: OG_IMAGE_PRIVATE_CACHE_CONTROL },
    );
  },
});
