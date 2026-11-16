import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

export const roleCreatedEvent = defineEvent({
  pluginId,
  name: "role.created",
  payload: z.object({ roleId: z.number().int() }),
});

export const roleUpdatedEvent = defineEvent({
  pluginId,
  name: "role.updated",
  payload: z.object({ roleId: z.number().int() }),
});

export const roleDeletedEvent = defineEvent({
  pluginId,
  name: "role.deleted",
  payload: z.object({ roleId: z.number().int() }),
});

/** Every `role.*` event core defines. */
export const roleEventDefinitions = [
  roleCreatedEvent,
  roleUpdatedEvent,
  roleDeletedEvent,
];
