import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

/**
 * An admin cleaned the queue from the AdminCP Debug Panel. Fires after the
 * tasks are deleted. The hourly retention sweep does not emit it.
 */
export const queueCleanedEvent = defineEvent({
  pluginId,
  name: "queue.cleaned",
  payload: z.object({
    /** `failed` removed failed tasks; `finished` removed completed and failed ones. */
    scope: z.enum(["failed", "finished"]),
    deleted: z.number().int().nonnegative(),
    cleanedById: z.number().int().nullable(),
  }),
});

/** Every `queue.*` event core defines. */
export const queueEventDefinitions = [queueCleanedEvent];
