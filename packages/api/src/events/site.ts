import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

/**
 * The site status was saved in the AdminCP: switched off or on, or its
 * message or opening time changed. Fires after the write has committed.
 */
export const siteStatusUpdatedEvent = defineEvent({
  pluginId,
  name: "site.status.updated",
  payload: z.object({
    offline: z.boolean(),
    /** Whether this save flipped `offline`. */
    switched: z.boolean(),
    opensAt: z.string().nullable(),
    changedById: z.number().int().nullable(),
  }),
});

/** Every `site.*` event core defines. */
export const siteEventDefinitions = [siteStatusUpdatedEvent];
