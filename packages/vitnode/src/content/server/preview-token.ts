import { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";

import { signPayload, verifySignedPayload } from "../../lib/api/signed-token";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PREVIEW_TOKEN_VERSION,
} from "../const";

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
  /**
   * The locale this token previews, for a **translation** preview.
   *
   * Absent on a base preview, which is what every token minted before Stage 5B
   * is - so old links keep working and mean exactly what they meant. Present, it
   * binds the token to one language: a `pl` token used on the English tab is
   * refused rather than falling back, because a preview whose language could
   * shift under it is not a preview of anything.
   */
  l: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
  /** `core_languages.id`, so the reader needs no second lookup. */
  lid: z.number().int().positive().optional(),
  p: z.string().min(1),
  r: z.number().int().nonnegative(),
  t: z.string().min(1),
  /**
   * The **translation** revision this token freezes.
   *
   * Present exactly when `l` is. Together with `r` - the shared revision - it is
   * what makes the frozen guarantee whole: Option A of the two models, where the
   * token names both halves. `0` means the translation had no revision to freeze,
   * which the reader treats the same way `r: 0` is treated for the base row.
   */
  tr: z.number().int().nonnegative().optional(),
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
  languageId,
  locale,
  now = new Date(),
  pluginId,
  revisionId,
  secret,
  translationRevisionId,
  version,
}: {
  definition: AnyContentTypeDefinition;
  itemId: number;
  /** Required with `locale`: `core_languages.id` for that locale. */
  languageId?: number;
  /**
   * The locale to freeze, for a translation preview. Omit for a base preview.
   *
   * Supplying it makes the token mean something narrower, not something wider: it
   * previews *that* language, and only that language.
   */
  locale?: string;
  now?: Date;
  pluginId: string;
  /** The **shared** revision. `0` when the record has none to freeze. */
  revisionId: number;
  secret: string;
  /** The **translation** revision. `0` when the locale has none to freeze. */
  translationRevisionId?: number;
  version: number;
}): ContentPreviewToken => {
  const expiresAt = new Date(
    now.getTime() + definition.editorial.preview.expiresInMinutes * 60_000,
  );

  const payload: ContentPreviewTokenPayload = {
    aud: "content-preview",
    exp: Math.floor(expiresAt.getTime() / 1000),
    i: itemId,
    // Absent unless this is a translation preview, so a base token is byte-for-byte
    // the token Stage 4 minted and nothing existing changes shape.
    ...(locale === undefined
      ? {}
      : { l: locale, lid: languageId, tr: translationRevisionId ?? 0 }),
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
  locale,
  now = new Date(),
  pluginId,
  secret,
  token,
}: {
  definition: AnyContentTypeDefinition;
  /**
   * The locale the reader is serving, when it is serving one.
   *
   * Checked case-insensitively against the token's own `l`, and **never** relaxed:
   * a token minted for `pl` used to read `en` is refused, and a token with no
   * locale at all used on a locale-scoped read is refused too. There is no
   * fallback here on purpose - falling back would silently hand a reviewer a
   * different language from the one whose link they were sent.
   */
  locale?: string;
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

  // Both directions are failures, and both answer the same 404 the caller uses
  // for a forged signature: a locale mismatch is a token being used for something
  // it was not minted for, which is exactly what the audience check catches one
  // level up.
  const wanted = locale?.trim().toLowerCase();
  const minted = payload.l?.trim().toLowerCase();
  if (wanted !== minted) return null;

  return payload;
};
