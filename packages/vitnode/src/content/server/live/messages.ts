import { z } from "zod";

import type { ContentLiveClientMessage } from "@/content/live/protocol";

export const CONTENT_LIVE_MAX_UPDATE_BYTES = 2 * 1024 * 1024;

const MAX_BASE64_LENGTH = Math.ceil(CONTENT_LIVE_MAX_UPDATE_BYTES / 3) * 4;

const clientId = z.string().min(1).max(64);
const locale = z.string().min(1).max(35).nullable();
const base64 = z
  .string()
  .max(MAX_BASE64_LENGTH)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/);

const room = z.strictObject({
  contentTypeId: z.string().min(1).max(100),
  itemId: z.number().int().positive(),
});

const doc = z.strictObject({
  contentTypeId: z.string().min(1).max(100),
  field: z.string().min(1).max(100),
  itemId: z.number().int().positive(),
  locale,
});

export const contentLiveClientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ clientId, locale, room, type: z.literal("join") }),
  z.strictObject({
    clientId,
    room,
    type: z.enum(["heartbeat", "leave"]),
  }),
  z.strictObject({
    clientId,
    field: z.string().min(1).max(100).nullable(),
    locale,
    room,
    type: z.literal("focus"),
  }),
  z.strictObject({
    clientId,
    doc,
    stateVector: base64,
    type: z.literal("doc:open"),
  }),
  z.strictObject({
    clientId,
    doc,
    type: z.enum(["doc:awareness", "doc:update"]),
    update: base64,
  }),
  z.strictObject({ clientId, doc, type: z.literal("doc:close") }),
]) satisfies z.ZodType<ContentLiveClientMessage>;

export const clientIdOf = (data: unknown): string => {
  if (typeof data !== "object" || data === null || !("clientId" in data)) {
    return "";
  }
  const { success, data: parsed } = clientId.safeParse(data.clientId);

  return success ? parsed : "";
};

export const decodeContentLiveBytes = (value: string): Uint8Array =>
  new Uint8Array(Buffer.from(value, "base64"));

export const encodeContentLiveBytes = (value: Uint8Array): string =>
  Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString(
    "base64",
  );
