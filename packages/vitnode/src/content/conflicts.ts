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
