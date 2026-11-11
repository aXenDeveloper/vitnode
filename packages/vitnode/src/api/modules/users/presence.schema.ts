import { z } from "@hono/zod-openapi";

const PRESENCE_CACHE_CONTROL = "private, no-store";

/**
 * Presence depends on who is asking and changes every minute, so no browser or
 * shared cache may keep it - an answer for a moderator must never reach a
 * guest.
 */
export const presenceResponseHeaders = {
  "Cache-Control": PRESENCE_CACHE_CONTROL,
} as const;

export const zodUserPresence = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("online"),
      lastSeenAt: z.string(),
      isHidden: z.literal(true).optional(),
    }),
    z.object({
      status: z.literal("offline"),
      lastSeenAt: z.string().nullable(),
      isHidden: z.literal(true).optional(),
    }),
    z.object({ status: z.literal("hidden") }),
  ])
  .openapi("UserPresence", {
    example: { status: "online", lastSeenAt: "2026-10-17T12:00:00.000Z" },
  });

export const zodPresenceUserId = z
  .string()
  .regex(/^[1-9]\d{0,9}$/)
  .refine(id => Number(id) <= 2_147_483_647)
  .openapi({ example: "1" });
