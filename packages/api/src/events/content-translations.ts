import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const target = {
  contentTypeId: z.string(),
  field: z.string(),
  recordId: z.string(),
  targetLocale: z.string(),
};

/** A new machine translation was stored and is now served to readers. */
export const contentTranslationCompletedEvent = defineEvent({
  pluginId: manifest.id,
  name: "content.translation.completed",
  payload: z.object({
    ...target,
    /** Milliseconds from the first request for this version to the stored result. */
    latencyMs: z.number().int().nonnegative(),
    runId: z.number().int().nullable(),
  }),
});

/** A queued translation ended without a result: skipped, refused or failed. */
export const contentTranslationFailedEvent = defineEvent({
  pluginId: manifest.id,
  name: "content.translation.failed",
  payload: z.object({
    ...target,
    /** A reason code such as `not_found`, `stale`, `budget` or an AI error code. */
    reason: z.string(),
    /** `true` when the job will try again later. */
    retrying: z.boolean(),
  }),
});

/**
 * One lookup or request was answered: how many fields were served from saved
 * translations, newly queued, already pending or skipped. Counts only, never
 * text.
 */
export const contentTranslationServedEvent = defineEvent({
  pluginId: manifest.id,
  name: "content.translation.served",
  payload: z.object({
    locale: z.string(),
    mode: z.enum(["lookup", "automatic", "manual"]),
    pending: z.number().int().nonnegative(),
    queued: z.number().int().nonnegative(),
    ready: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  }),
});

/** Every `content.translation.*` event core defines. */
export const contentTranslationEventDefinitions = [
  contentTranslationCompletedEvent,
  contentTranslationFailedEvent,
  contentTranslationServedEvent,
];
