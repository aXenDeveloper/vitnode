import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

export const aiRunCompletedEvent = defineEvent({
  pluginId,
  name: "ai.run.completed",
  payload: z.object({
    actionKey: z.string(),
    actorType: z.enum(["system", "user"]),
    runId: z.number().int(),
    userId: z.number().int().nullable(),
  }),
});

export const aiRunFailedEvent = defineEvent({
  pluginId,
  name: "ai.run.failed",
  payload: z.object({
    actionKey: z.string(),
    actorType: z.enum(["system", "user"]),
    errorCode: z.string().nullable(),
    runId: z.number().int(),
    userId: z.number().int().nullable(),
  }),
});

/** Every `ai.*` event core defines. */
export const aiEventDefinitions = [aiRunCompletedEvent, aiRunFailedEvent];
