import type { Context } from "hono";

import { OG_IMAGE_MIME_TYPE } from "@/og-image";

import type { OgImageRequest } from "./generate";

import {
  generateOgImage,
  OgImageInputError,
  OgImagesDisabledError,
} from "./generate";

/**
 * Five minutes, for anyone. Short on purpose: an image of a page that later
 * goes private stays in shared caches (a CDN, a social network) until this
 * runs out, and no authorization check can reach a copy already out there.
 */
export const OG_IMAGE_PUBLIC_CACHE_CONTROL = "public, max-age=300";

/** For previews and anything else only one signed-in person may see. */
export const OG_IMAGE_PRIVATE_CACHE_CONTROL = "private, no-store";

const etagMatches = (header: string | undefined, etag: string): boolean =>
  header !== undefined &&
  header
    .split(",")
    .map(part => part.trim().replace(/^W\//, ""))
    .some(part => part === etag || part === "*");

/**
 * Answers a Hono request with a generated card: `200 image/png` with an
 * `ETag`, or `304` when the client already holds it. `404` while `ogImages`
 * is off and `400` for input the generator refuses, both as JSON.
 *
 * Use it in a plugin's own route, after the route checked that the page is
 * public. Pass `cacheControl: OG_IMAGE_PRIVATE_CACHE_CONTROL` for anything
 * that is not.
 *
 * Server-only.
 *
 * @throws {OgImageTemplateNotFoundError} For an unregistered `template` - a
 * configuration bug, so it surfaces as a `500`.
 *
 * @example
 * ```ts
 * import { ogImageResponse } from "@vitnode/core/og-image/server";
 *
 * handler: async c => {
 *   const product = await findPublicProduct(c, c.req.valid("param").id);
 *   if (!product) return c.json({ error: "Not found" }, 404);
 *
 *   return await ogImageResponse(c, {
 *     title: product.name,
 *     description: product.summary,
 *     cover: product.imageId ? { fileId: product.imageId } : null,
 *     identity: ["product", product.id],
 *   });
 * },
 * ```
 */
export const ogImageResponse = async (
  c: Context,
  request: OgImageRequest,
  {
    cacheControl = OG_IMAGE_PUBLIC_CACHE_CONTROL,
  }: { cacheControl?: string } = {},
): Promise<Response> => {
  let result: Awaited<ReturnType<typeof generateOgImage>>;
  try {
    result = await generateOgImage(c, request);
  } catch (error) {
    if (error instanceof OgImagesDisabledError) {
      return c.json({ error: "Not found" }, 404, {
        "Cache-Control": "no-store",
      });
    }
    if (error instanceof OgImageInputError) {
      return c.json({ error: error.message }, 400, {
        "Cache-Control": "no-store",
      });
    }

    throw error;
  }

  const headers = {
    "Cache-Control": cacheControl,
    ETag: result.etag,
    "X-VitNode-OG-Cache": result.fromCache ? "hit" : "miss",
  };

  if (etagMatches(c.req.header("if-none-match"), result.etag)) {
    return c.body(null, 304, headers);
  }

  return c.body(
    result.png.buffer.slice(
      result.png.byteOffset,
      result.png.byteOffset + result.png.byteLength,
    ) as ArrayBuffer,
    200,
    {
      ...headers,
      "Content-Length": String(result.png.byteLength),
      "Content-Type": OG_IMAGE_MIME_TYPE,
    },
  );
};
