import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { buildRoute } from "@/api/builders";
import { OG_IMAGE_ASSET_MAX_BYTES } from "@/og-image/assets.server";
import { listOgImageTemplates } from "@/og-image/config";
import { OG_IMAGE_NO_STORE, prepareOgImage } from "@/og-image/render.server";
import { OG_IMAGE_TYPE } from "@/og-image/types";

const SEO_VIEW = { module: "seo", permission: "can_view" } as const;

const PREVIEW_COVER_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const listOgImageTemplatesAdminRoute = buildRoute({
  adminStaffPermission: SEO_VIEW,
  route: {
    method: "get",
    description:
      "The Open Graph templates registered in `ogImages`, for the AdminCP preview. Read-only.",
    path: "/og-images",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              defaultTemplate: z.string().nullable(),
              enabled: z.boolean(),
              locales: z.array(
                z.object({ code: z.string(), name: z.string() }),
              ),
              templates: z.array(
                z.object({
                  id: z.string(),
                  isDefault: z.boolean(),
                  version: z.string(),
                }),
              ),
            }),
          },
        },
        description: "Registered templates and the languages to preview in",
      },
    },
  },
  handler: c => {
    const config = c.get("core").ogImages;
    const locales = c
      .get("core")
      .i18n.locales.filter(locale => locale.enabled !== false)
      .map(({ code, name }) => ({ code, name }));

    return c.json(
      {
        defaultTemplate: config?.defaultTemplate ?? null,
        enabled: config !== null,
        locales,
        templates: config ? listOgImageTemplates(config) : [],
      },
      200,
      { "Cache-Control": OG_IMAGE_NO_STORE },
    );
  },
});

export const previewOgImageAdminRoute = buildRoute({
  adminStaffPermission: SEO_VIEW,
  route: {
    method: "post",
    description:
      "Draws one Open Graph image from temporary input with the same generator public images use. Nothing is stored or cached.",
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
              description: z.string().max(2000).optional(),
              locale: z.string().max(35).optional(),
              template: z.string().min(1).max(64),
              title: z.string().min(1).max(500),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "image/png": {
            schema: z.string().openapi({ format: "binary", type: "string" }),
          },
        },
        description: "A 1200 × 630 PNG, never cached",
      },
      400: { description: "Unknown template or an unusable cover file" },
      404: { description: "Open Graph images are not configured" },
    },
  },
  handler: async c => {
    const { cover, description, locale, template, title } = c.req.valid("form");

    let coverBytes: null | Uint8Array = null;
    if (cover && cover.size > 0) {
      if (
        cover.size > OG_IMAGE_ASSET_MAX_BYTES ||
        !PREVIEW_COVER_TYPES.has(cover.type)
      ) {
        throw new HTTPException(400, {
          message: "The cover must be a JPEG, PNG, WebP or AVIF up to 5 MB.",
        });
      }
      coverBytes = new Uint8Array(await cover.arrayBuffer());
    }

    const prepared = prepareOgImage(
      c,
      {
        cover: coverBytes ? { bytes: coverBytes } : null,
        description: description ?? null,
        locale: locale ?? null,
        template,
        title,
      },
      { identity: ["admin-preview"], strictTemplate: true },
    );
    const data = await prepared.render();

    return new Response(data as Uint8Array<ArrayBuffer>, {
      headers: {
        "Cache-Control": OG_IMAGE_NO_STORE,
        "Content-Length": String(data.byteLength),
        "Content-Type": OG_IMAGE_TYPE,
        "X-Content-Type-Options": "nosniff",
      },
      status: 200,
    });
  },
});
