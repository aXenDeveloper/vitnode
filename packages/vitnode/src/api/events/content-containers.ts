import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

const container = {
  containerId: z.number().int(),
  definitionId: z.string(),
  parentId: z.number().int().nullable(),
  pluginId: z.string(),
};

export const contentContainerCreatedEvent = defineEvent({
  pluginId,
  name: "content.container.created",
  payload: z.object(container),
});

export const contentContainerDeletedEvent = defineEvent({
  pluginId,
  name: "content.container.deleted",
  payload: z.object(container),
});

export const contentContainerMovedEvent = defineEvent({
  pluginId,
  name: "content.container.moved",
  payload: z.object({
    ...container,
    fromParentId: z.number().int().nullable(),
    position: z.number().int(),
  }),
});

export const contentContainerUpdatedEvent = defineEvent({
  pluginId,
  name: "content.container.updated",
  payload: z.object({
    ...container,
    changedFields: z.array(z.string()),
  }),
});

/** Every `content.container.*` event core defines. */
export const contentContainerEventDefinitions = [
  contentContainerCreatedEvent,
  contentContainerDeletedEvent,
  contentContainerMovedEvent,
  contentContainerUpdatedEvent,
];
