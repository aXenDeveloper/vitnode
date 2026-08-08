import { z } from "zod";

import {
  CONTENT_CONFLICT_CODES,
  CONTENT_DELIVERY_CODES,
  CONTENT_SCHEDULE_CODES,
  CONTENT_TRANSLATION_CONFLICT_CODES,
  CONTENT_UNPROCESSABLE_CODES,
} from "./const";

export type ContentDeliveryCode =
  (typeof CONTENT_DELIVERY_CODES)[keyof typeof CONTENT_DELIVERY_CODES];

export type ContentConflictCode =
  (typeof CONTENT_CONFLICT_CODES)[keyof typeof CONTENT_CONFLICT_CODES];

export type ContentTranslationConflictCode =
  (typeof CONTENT_TRANSLATION_CONFLICT_CODES)[keyof typeof CONTENT_TRANSLATION_CONFLICT_CODES];

export type ContentUnprocessableCode =
  (typeof CONTENT_UNPROCESSABLE_CODES)[keyof typeof CONTENT_UNPROCESSABLE_CODES];

/**
 * The 409 body an editorial route answers with.
 *
 * A discriminated union so one OpenAPI schema describes the whole status: a
 * generated client branches on `code` rather than parsing English. Only
 * editorial content types answer this way - a Stage 1-3 route keeps the plain
 * text 409 it has always returned, so nothing existing changes shape.
 */
export const zodContentConflict = z.discriminatedUnion("code", [
  z.object({
    code: z.literal(CONTENT_CONFLICT_CODES.version),
    contentTypeId: z.string(),
    currentVersion: z.number().int(),
    expectedVersion: z.number().int(),
    itemId: z.number().int(),
  }),
  z.object({
    code: z.literal(CONTENT_CONFLICT_CODES.unique),
    contentTypeId: z.string(),
    itemId: z.number().int().nullable(),
  }),
]);

export type ContentConflict = z.infer<typeof zodContentConflict>;

/**
 * The 409 body a translation route answers with.
 *
 * Its own union rather than three more members of {@link zodContentConflict}:
 * that one is the contract Stage 4 editorial routes already publish, and every
 * generated client is built from it. A translation route is new, so it can carry
 * a shape that names the locale in every arm - which is the one thing a locale
 * tab strip has to know to point at the right tab.
 */
export const zodContentTranslationConflict = z.discriminatedUnion("code", [
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.version),
    contentTypeId: z.string(),
    currentVersion: z.number().int(),
    expectedVersion: z.number().int(),
    itemId: z.number().int(),
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.defaultRequired),
    contentTypeId: z.string(),
    itemId: z.number().int(),
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.exists),
    contentTypeId: z.string(),
    itemId: z.number().int(),
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.languageDisabled),
    contentTypeId: z.string(),
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.unique),
    contentTypeId: z.string(),
    itemId: z.number().int().nullable(),
    locale: z.string(),
  }),
]);

export type ContentTranslationConflict = z.infer<
  typeof zodContentTranslationConflict
>;

/** Reads a translation conflict out of a response body, or `null`. */
export const parseContentTranslationConflict = (
  body: string | undefined,
): ContentTranslationConflict | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentTranslationConflict.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * The 409 body a write refused by the slug reservation answers with.
 *
 * Its own schema rather than a third member of {@link zodContentConflict}: that
 * union is the contract Stage 4 editorial routes already publish, and widening it
 * would change a response schema every generated client is built from. A route
 * that can hit the reservation declares this one **alongside** it, so a client
 * that only knows the older union still parses the arms it knows.
 *
 * `locale` is `null` for a content type whose slug is shared, and the locale code
 * when the slug is localized - which is exactly the scope the reservation covers.
 * There is deliberately no owning-record id: a 409 on a public-facing address must
 * not become a way to enumerate records the caller cannot read.
 */
export const zodContentDeliveryConflict = z.object({
  code: z.literal(CONTENT_DELIVERY_CODES.slugReserved),
  contentTypeId: z.string(),
  locale: z.string().nullable(),
  slug: z.string(),
});

export type ContentDeliveryConflict = z.infer<
  typeof zodContentDeliveryConflict
>;

/** Reads a delivery conflict out of a response body, or `null`. */
export const parseContentDeliveryConflict = (
  body: string | undefined,
): ContentDeliveryConflict | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentDeliveryConflict.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/** The 422 body a restore answers with when the snapshot no longer fits. */
export const zodContentUnprocessable = z.object({
  code: z.literal(CONTENT_UNPROCESSABLE_CODES.notRestorable),
  contentTypeId: z.string(),
  /**
   * The content type's own field names, and nothing else. Never a Zod issue
   * tree - that names internal paths, and the route's OpenAPI schema already
   * describes the contract.
   */
  fields: z.array(z.string()),
  revisionId: z.number().int(),
});

export type ContentUnprocessable = z.infer<typeof zodContentUnprocessable>;

/**
 * The 400 body a refused schedule answers with.
 *
 * A code rather than prose for the same reason the 409 carries one: the dialog
 * points at the date field for one of these and shows a general error for the
 * other, and it cannot branch on English.
 */
export const zodContentScheduleRejection = z.object({
  code: z.enum([
    CONTENT_SCHEDULE_CODES.inPast,
    CONTENT_SCHEDULE_CODES.order,
    CONTENT_SCHEDULE_CODES.unsupported,
  ]),
  contentTypeId: z.string(),
});

export type ContentScheduleRejection = z.infer<
  typeof zodContentScheduleRejection
>;

/** Reads a schedule rejection out of a response body, or `null`. */
export const parseContentScheduleRejection = (
  body: string | undefined,
): ContentScheduleRejection | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentScheduleRejection.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * Reads a structured error out of a response body.
 *
 * Returns `null` for anything that does not match - a plain-text 409 from a
 * non-editorial route, an HTML error page from a proxy - so a caller can fall
 * back to its generic message instead of throwing on the error path.
 */
export const parseContentConflict = (
  body: string | undefined,
): ContentConflict | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentConflict.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const parseContentUnprocessable = (
  body: string | undefined,
): ContentUnprocessable | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentUnprocessable.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
