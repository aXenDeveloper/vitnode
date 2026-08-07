import "server-only";
import crypto from "node:crypto";
import { z } from "zod";

import { CONFIG } from "../../lib/config";
import { CONTENT_LOCALE_MAX_LENGTH } from "../const";
import {
  CONTENT_REVALIDATE_MAX_SKEW_MS,
  CONTENT_REVALIDATE_TIMESTAMP_HEADER,
} from "../server/revalidate-bridge";
import { revalidateContent } from "./revalidate.server";

const zodBody = z.object({
  contentTypeId: z.string().min(1),
  id: z.number().int().positive(),
  isPublic: z.boolean(),
  /**
   * The per-locale share of a localized mutation.
   *
   * Optional, so a Stage 1-4 body is accepted byte for byte and a web app that
   * has not been redeployed keeps working. When present it is what
   * `contentInvalidationTags` reads, and the flat fields above are ignored.
   */
  locales: z
    .array(
      z.object({
        isPublic: z.boolean(),
        locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH),
        slugs: z.array(z.string()),
        wasPublic: z.boolean(),
      }),
    )
    .optional(),
  mode: z.enum(["immediate", "stale-while-revalidate"]),
  slugs: z.array(z.string()),
  wasPublic: z.boolean(),
});

const matches = (provided: string, expected: string): boolean => {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  // `timingSafeEqual` throws on a length mismatch, so the length check is not
  // optional. It leaks the length of a secret and nothing else.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * The web-side half of the background cache bridge.
 *
 * Mount it once per app:
 *
 * ```ts title="src/app/api/vitnode/content/revalidate/route.ts"
 * export { POST } from "@vitnode/core/content/next/revalidate-route";
 * ```
 *
 * It exists because the API process cannot call `next/cache`. When a scheduled
 * publish makes a record public, *something* has to expire the tags in the
 * process that owns the cache - and this is the smallest thing that can.
 *
 * Deliberately narrow. It takes one shape, it calls one function, and the worst
 * a valid request can do is expire a cache tag. It is not an events endpoint
 * and must not grow into one.
 */
export const POST = async (request: Request): Promise<Response> => {
  const secret = CONFIG.cronJobSecret;
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!provided || !matches(provided, secret)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Replaying a revalidation only expires a tag again, so a window is
  // proportionate - a nonce store would be a database table to guard nothing.
  const timestamp = Number(
    request.headers.get(CONTENT_REVALIDATE_TIMESTAMP_HEADER),
  );
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(Date.now() - timestamp) > CONTENT_REVALIDATE_MAX_SKEW_MS
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = zodBody.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { mode, ...input } = parsed.data;

  // `route-handler`, truthfully: `updateTag` throws here, and saying otherwise
  // would turn every background publish into a 500.
  revalidateContent(input, { context: "route-handler", mode });

  return Response.json({ ok: true });
};
