import { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";

import { signPayload, verifySignedPayload } from "../../lib/api/signed-token";
import { CONTENT_PREVIEW_TOKEN_VERSION } from "../const";

/**
 * What a preview link carries, in short keys because it travels in a URL.
 *
 * `r` is the load-bearing one: a token is bound to **one revision**, so a
 * reviewer sees the state the editor was looking at when they shared the link,
 * not whatever the record has drifted to since. `0` means the record had no
 * revision yet - a row that predates its content type opting into `editorial` -
 * and the live row is read instead.
 *
 * `ver` is the row version at issue time. Nothing branches on it; it is there
 * so a support conversation about "which version did they see" has an answer
 * even after the revision was pruned.
 */
export const zodContentPreviewTokenPayload = z.object({
  /** Rejects a token minted for anything else that ever shares this secret. */
  aud: z.literal("content-preview"),
  /** Epoch **seconds**, not milliseconds. */
  exp: z.number().int().positive(),
  i: z.number().int().positive(),
  p: z.string().min(1),
  r: z.number().int().nonnegative(),
  t: z.string().min(1),
  v: z.literal(CONTENT_PREVIEW_TOKEN_VERSION),
  ver: z.number().int().positive(),
});

export type ContentPreviewTokenPayload = z.infer<
  typeof zodContentPreviewTokenPayload
>;

export interface ContentPreviewToken {
  expiresAt: Date;
  token: string;
}

/**
 * Mints a preview link for one revision of one record.
 *
 * The expiry is absolute and has **no leeway** on the way back in. Web and API
 * already need agreeing clocks for sessions to work at all, and slack on an
 * expiry only ever weakens it.
 */
export const createContentPreviewToken = ({
  definition,
  itemId,
  now = new Date(),
  pluginId,
  revisionId,
  secret,
  version,
}: {
  definition: AnyContentTypeDefinition;
  itemId: number;
  now?: Date;
  pluginId: string;
  /** `0` when the record has no revision to freeze. */
  revisionId: number;
  secret: string;
  version: number;
}): ContentPreviewToken => {
  const expiresAt = new Date(
    now.getTime() + definition.editorial.preview.expiresInMinutes * 60_000,
  );

  const payload: ContentPreviewTokenPayload = {
    aud: "content-preview",
    exp: Math.floor(expiresAt.getTime() / 1000),
    i: itemId,
    p: pluginId,
    r: revisionId,
    t: definition.id,
    v: CONTENT_PREVIEW_TOKEN_VERSION,
    ver: version,
  };

  return { expiresAt, token: signPayload(secret, payload) };
};

/**
 * Reads a preview link back, or returns `null`.
 *
 * One return value for every failure - bad signature, wrong secret, expired,
 * truncated, minted for another plugin, another content type, or another
 * record. The caller answers 404 for all of them, because a 401 or a 403 would
 * confirm that the record exists, which is the single thing a draft URL must
 * never do.
 *
 * The plugin and content type are checked here rather than trusted from the
 * payload: the route knows which definition it is serving, and a token is only
 * valid for *that* one. Without this, one signed token would work on every
 * preview route in the install.
 */
export const verifyContentPreviewToken = ({
  definition,
  now = new Date(),
  pluginId,
  secret,
  token,
}: {
  definition: AnyContentTypeDefinition;
  now?: Date;
  pluginId: string;
  secret: string;
  token: string;
}): ContentPreviewTokenPayload | null => {
  const payload = verifySignedPayload(
    secret,
    token,
    zodContentPreviewTokenPayload,
  );
  if (!payload) return null;

  if (payload.p !== pluginId) return null;
  if (payload.t !== definition.id) return null;
  if (payload.exp * 1000 <= now.getTime()) return null;

  return payload;
};
