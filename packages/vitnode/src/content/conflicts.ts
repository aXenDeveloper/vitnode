import { z } from "zod";

import {
  CONTENT_CONFLICT_CODES,
  CONTENT_DELIVERY_CODES,
  CONTENT_DUPLICATE_CODES,
  CONTENT_INVALID_INPUT_CODE,
  CONTENT_PUBLIC_WRITE_CODES,
  CONTENT_SCHEDULE_CODES,
  CONTENT_TRANSLATION_CONFLICT_CODES,
  CONTENT_UNPROCESSABLE_CODES,
} from "./const";
import { contentAnyIdSchema } from "./ids";

export type ContentDeliveryCode =
  (typeof CONTENT_DELIVERY_CODES)[keyof typeof CONTENT_DELIVERY_CODES];

export type ContentConflictCode =
  (typeof CONTENT_CONFLICT_CODES)[keyof typeof CONTENT_CONFLICT_CODES];

export type ContentTranslationConflictCode =
  (typeof CONTENT_TRANSLATION_CONFLICT_CODES)[keyof typeof CONTENT_TRANSLATION_CONFLICT_CODES];

export type ContentUnprocessableCode =
  (typeof CONTENT_UNPROCESSABLE_CODES)[keyof typeof CONTENT_UNPROCESSABLE_CODES];

/**
 * The JSON body of a `409` from a content write, AdminCP or public:
 * `CONTENT_VERSION_CONFLICT` when `expectedVersion` no longer matches the
 * record (nothing was written; `currentVersion` is the stored one), or
 * `CONTENT_UNIQUE_CONFLICT` when a unique field, such as a derived slug, is
 * taken.
 */
export const zodContentConflict = z.discriminatedUnion("code", [
  z.object({
    code: z.literal(CONTENT_CONFLICT_CODES.version),
    contentTypeId: z.string(),
    currentVersion: z.number().int(),
    expectedVersion: z.number().int(),
    itemId: contentAnyIdSchema,
  }),
  z.object({
    code: z.literal(CONTENT_CONFLICT_CODES.unique),
    contentTypeId: z.string(),
    itemId: contentAnyIdSchema.nullable(),
  }),
]);

/** A parsed `409` body. See {@link zodContentConflict}. */
export type ContentConflict = z.infer<typeof zodContentConflict>;

export const zodContentTranslationConflict = z.discriminatedUnion("code", [
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.version),
    contentTypeId: z.string(),
    currentVersion: z.number().int(),
    expectedVersion: z.number().int(),
    itemId: contentAnyIdSchema,
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.defaultRequired),
    contentTypeId: z.string(),
    itemId: contentAnyIdSchema,
    locale: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_TRANSLATION_CONFLICT_CODES.exists),
    contentTypeId: z.string(),
    itemId: contentAnyIdSchema,
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
    itemId: contentAnyIdSchema.nullable(),
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

  fields: z.array(z.string()),
  revisionId: z.number().int(),
});

export type ContentUnprocessable = z.infer<typeof zodContentUnprocessable>;

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
 * Reads a `409` body from its raw text, as `response.text()` returns it, and
 * returns `null` for an empty or unrelated body. A typed `fetcher` call can
 * read `code` from `await res.json()` directly instead.
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

export const zodContentInvalidInput = z.object({
  code: z.literal(CONTENT_INVALID_INPUT_CODE),
  contentTypeId: z.string(),
  issues: z.array(
    z.object({
      code: z.string(),
      field: z.string().nullable(),
      locale: z.string().nullable(),
    }),
  ),
});

export type ContentInvalidInput = z.infer<typeof zodContentInvalidInput>;

export type ContentInputIssue = ContentInvalidInput["issues"][number];

export const parseContentInvalidInput = (
  body: string | undefined,
): ContentInvalidInput | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentInvalidInput.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const zodContentDuplicateRejection = z.discriminatedUnion("code", [
  z.object({
    code: z.literal(CONTENT_DUPLICATE_CODES.slugConflict),
    contentTypeId: z.string(),
    field: z.string(),
    locale: z.string().nullable(),
    slug: z.string(),
  }),
  z.object({
    code: z.literal(CONTENT_DUPLICATE_CODES.uniqueRequired),
    contentTypeId: z.string(),
    fields: z.array(z.string()),
  }),
]);

export type ContentDuplicateRejection = z.infer<
  typeof zodContentDuplicateRejection
>;

export const parseContentDuplicateRejection = (
  body: string | undefined,
): ContentDuplicateRejection | null => {
  if (body === undefined || body === "") return null;

  try {
    const parsed = zodContentDuplicateRejection.safeParse(JSON.parse(body));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * The JSON body a public write route answers with on `400`, `401`, `403` and
 * `404`. Each issue's `code` is stable - a Zod code such as `too_small`, or one
 * of `CONTENT_PUBLIC_WRITE_ISSUE_CODES` - so translate by it; `message` is
 * English developer text. `field` is `null` for an issue about the whole
 * request.
 */
export const zodContentPublicWriteRejection = z.object({
  code: z.enum([
    CONTENT_PUBLIC_WRITE_CODES.forbidden,
    CONTENT_PUBLIC_WRITE_CODES.invalidInput,
    CONTENT_PUBLIC_WRITE_CODES.notFound,
    CONTENT_PUBLIC_WRITE_CODES.unauthenticated,
  ]),
  contentTypeId: z.string(),
  issues: z.array(
    z.object({
      code: z.string(),
      field: z.string().nullable(),
      message: z.string(),
    }),
  ),
});

/**
 * The JSON body of a refused public write: `code` (one of the
 * `CONTENT_PUBLIC_WRITE_CODES`), the content type and the field `issues`.
 */
export type ContentPublicWriteRejection = z.infer<
  typeof zodContentPublicWriteRejection
>;

/**
 * Reads a refused public write's body. Takes the already-parsed JSON (not a
 * string) and returns `null` for any other shape - a `409`, the rate
 * limiter's `429` or a captcha failure. Pure; runs anywhere.
 *
 * @example
 * ```ts
 * import { parseContentPublicWriteRejection } from "@vitnode/core/content";
 *
 * const rejection = parseContentPublicWriteRejection(
 *   await res.json().catch(() => null),
 * );
 * for (const issue of rejection?.issues ?? []) {
 *   if (issue.field) setFormFieldError(form, issue.field, t(issue.code));
 * }
 * ```
 */
export const parseContentPublicWriteRejection = (
  body: unknown,
): ContentPublicWriteRejection | null => {
  const parsed = zodContentPublicWriteRejection.safeParse(body);

  return parsed.success ? parsed.data : null;
};
