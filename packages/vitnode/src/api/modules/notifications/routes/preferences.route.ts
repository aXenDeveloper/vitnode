import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "@/api/models/notifications/preferences";
import { CONFIG_PLUGIN } from "@/config";

import {
  requireNotificationUser,
  unauthorizedResponse,
  zodNotificationEmailMode,
} from "../schema";

const zodPreferences = z.object({
  digestHour: z.number(),
  digestWeekday: z.number(),
  timeZone: z.string().nullable(),
  types: z.array(
    z.object({
      category: z.string(),
      categoryLabel: z.string(),
      description: z.string().nullable(),
      emailModes: z.array(zodNotificationEmailMode),
      id: z.string(),
      label: z.string(),
      mandatory: z.boolean(),
      pluginId: z.string(),
      value: z.object({ email: zodNotificationEmailMode, inApp: z.boolean() }),
    }),
  ),
});

export const getNotificationPreferencesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Every notification type the installation offers, with the channels it may use and what the user currently receives.",
    path: "/preferences",
    responses: {
      200: {
        content: { "application/json": { schema: zodPreferences } },
        description: "Notification preferences",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);

    return c.json(
      await getNotificationPreferences(c, {
        language: user.language,
        userId: user.id,
      }),
    );
  },
});

export const zodUpdateNotificationPreferences = z.object({
  digestHour: z.number().int().min(0).max(23).optional(),
  digestWeekday: z.number().int().min(0).max(6).optional(),
  timeZone: z.string().max(64).nullable().optional(),
  types: z
    .record(
      z.string().max(100),
      z.object({
        email: zodNotificationEmailMode.optional(),
        inApp: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const updateNotificationPreferencesRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Save notification preferences, digest schedule and time zone.",
    path: "/preferences",
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: zodUpdateNotificationPreferences },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: z.object({ success: z.boolean() }) },
        },
        description: "Saved",
      },
      400: {
        description: "A type, mode or time zone this site does not offer",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    await updateNotificationPreferences(c, user.id, c.req.valid("json"));

    return c.json({ success: true });
  },
});
