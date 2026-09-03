import { z } from "zod";

import type { AnyContentTypeDefinition } from "../types";

import { signPayload, verifySignedPayload } from "../../lib/api/signed-token";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PREVIEW_TOKEN_VERSION,
} from "../const";

export const zodContentPreviewTokenPayload = z.object({
  /** Rejects a token minted for anything else that ever shares this secret. */
  aud: z.literal("content-preview"),
  /** Epoch **seconds**, not milliseconds. */
  exp: z.number().int().positive(),
  i: z.number().int().positive(),

  l: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
  /** `core_languages.id`, so the reader needs no second lookup. */
  lid: z.number().int().positive().optional(),
  p: z.string().min(1),
  r: z.number().int().nonnegative(),
  t: z.string().min(1),

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

export const verifyContentPreviewToken = ({
  definition,
  locale,
  now = new Date(),
  pluginId,
  secret,
  token,
}: {
  definition: AnyContentTypeDefinition;

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
