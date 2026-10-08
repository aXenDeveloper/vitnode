import { z } from "zod";

import { CONTENT_LOCALE_MAX_LENGTH } from "../const";

/**
 * The HTTP half of live editing: field locks and the shared draft. The socket
 * carries the same facts as `locks` and `draft` messages, and a tab without a
 * socket polls these routes instead.
 */

export const CONTENT_LIVE_CODES = {
  draftInvalid: "CONTENT_DRAFT_INVALID",
  draftScope: "CONTENT_DRAFT_WRONG_SCOPE",
  locked: "CONTENT_FIELD_LOCKED",
  notLocked: "CONTENT_FIELD_NOT_LOCKED",
} as const;

export const CONTENT_FIELD_LOCK_ACTIONS = [
  "acquire",
  "renew",
  "release",
] as const;

export type ContentFieldLockAction =
  (typeof CONTENT_FIELD_LOCK_ACTIONS)[number];

const zodLocale = z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).nullable();

export const zodContentFieldLock = z.object({
  expiresAt: z.string(),
  field: z.string(),
  locale: z.string().nullable(),
  user: z.object({ id: z.number(), name: z.string() }),
});

export const zodContentFieldLockList = z.object({
  locks: z.array(zodContentFieldLock),
});

export const zodContentFieldLockRequest = z.strictObject({
  action: z.enum(CONTENT_FIELD_LOCK_ACTIONS),
  field: z.string().min(1).max(100),
  /** `null` for a shared field, a language code for a localized one. */
  locale: zodLocale,
});

export const zodContentFieldLockResponse = z.object({
  /** `null` once released. */
  lock: zodContentFieldLock.nullable(),
});

export const zodContentFieldLocked = z.object({
  code: z.literal(CONTENT_LIVE_CODES.locked),
  /** Who holds it, or `null` when a renew found no lock of the caller's. */
  lock: zodContentFieldLock.nullable(),
});

export const zodContentDraft = z.object({
  baseVersion: z.number(),
  updatedAt: z.string(),
  updatedBy: z.object({ id: z.number(), name: z.string() }).nullable(),
  values: z.record(z.string(), z.unknown()),
});

export type ContentDraft = z.infer<typeof zodContentDraft>;

export const zodContentDrafts = z.object({
  shared: zodContentDraft.nullable(),
  translations: z.record(z.string(), zodContentDraft),
});

export type ContentDrafts = z.infer<typeof zodContentDrafts>;

export const zodContentDraftWrite = z.strictObject({
  locale: zodLocale,
  values: z
    .record(z.string(), z.unknown())
    .refine(values => Object.keys(values).length > 0, {
      message: "Provide at least one field.",
    }),
});

export const zodContentDraftWritten = z.object({ updatedAt: z.string() });

/** Fields a draft write was refused for, and why. */
export const zodContentDraftRejection = z.object({
  code: z.enum([
    CONTENT_LIVE_CODES.draftInvalid,
    CONTENT_LIVE_CODES.draftScope,
    CONTENT_LIVE_CODES.notLocked,
  ]),
  fields: z.array(z.string()),
});

export type ContentDraftRejection = z.infer<typeof zodContentDraftRejection>;
