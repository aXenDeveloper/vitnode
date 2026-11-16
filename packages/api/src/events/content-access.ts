import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

export const contentAccessUpdatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "content.access.updated",
  payload: z.object({
    /** The actions whose rule this scope now sets, inherits or changed. */
    changedActions: z.array(z.string()),
    /** The container collection or scope content type id. */
    family: z.string(),
    pluginId: z.string(),
    scopeId: z.string(),
    userId: z.number().int().nullable(),
  }),
});

/** Every `content.access.*` event core defines. */
export const contentAccessEventDefinitions = [contentAccessUpdatedEvent];
