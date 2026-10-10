import { z } from "zod";

import { CONTENT_LOCALE_MAX_LENGTH } from "../const";

export const CONTENT_LIVE_CODES = {
  draftInvalid: "CONTENT_DRAFT_INVALID",
  draftScope: "CONTENT_DRAFT_WRONG_SCOPE",
  locked: "CONTENT_FIELD_LOCKED",
  notLocked: "CONTENT_FIELD_NOT_LOCKED",
} as const;

const CONTENT_FIELD_LOCK_ACTIONS = ["acquire", "renew", "release"] as const;

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
  locale: zodLocale,
});

export const zodContentFieldLockResponse = z.object({
  lock: zodContentFieldLock.nullable(),
});

export const zodContentFieldLocked = z.object({
  code: z.literal(CONTENT_LIVE_CODES.locked),
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

export const zodContentDraftRejection = z.object({
  code: z.enum([
    CONTENT_LIVE_CODES.draftInvalid,
    CONTENT_LIVE_CODES.draftScope,
    CONTENT_LIVE_CODES.notLocked,
  ]),
  fields: z.array(z.string()),
});

export type ContentDraftRejection = z.infer<typeof zodContentDraftRejection>;
