import { z } from "zod";

import { manifest } from "@/manifest";

import { defineEvent } from "../lib/event-definition";

const pluginId = manifest.id;

export const fileEditorUploadedEvent = defineEvent({
  pluginId,
  name: "file.editor.uploaded",
  payload: z.object({
    fileId: z.number().int(),
    kind: z.enum(["attachment", "image"]),
    userId: z.number().int(),
  }),
});

export const filesAltUpdatedEvent = defineEvent({
  pluginId,
  name: "files.alt.updated",
  payload: z.object({
    fileId: z.number().int(),
    languageCodes: z.array(z.string()),
    origin: z.enum(["ai", "human"]),
  }),
});

/** Every file event core defines. */
export const fileEventDefinitions = [
  fileEditorUploadedEvent,
  filesAltUpdatedEvent,
];
