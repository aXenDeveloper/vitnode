import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

export const pageLayoutUpdatedEvent = defineEvent({
  pluginId: manifest.id,
  name: "core.page-layout.updated",
  payload: z.object({
    changedZones: z.array(z.string()),
    pageId: z.string(),
  }),
});

/** Every editable page event core defines. */
export const pageEventDefinitions = [pageLayoutUpdatedEvent];
