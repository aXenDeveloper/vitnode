import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { core_mentions } from "@/database/mentions";
import { buildNotificationType } from "@/lib/notifications/registry";

import { findMentionTarget } from "./targets";

/**
 * Sent to a member `@mentioned` in rich text, once the target is public and
 * they can read it. Every mention is its own inbox item; removing a mention
 * retracts its notification.
 */
export const mentionNotification = buildNotificationType({
  id: "core.mention",
  version: 1,
  schema: z.object({
    mentionId: z.number().int(),
    pluginId: z.string(),
    rootId: z.string().nullable(),
    targetId: z.string(),
    targetType: z.string(),
    title: z.string(),
    url: z.string().nullable(),
  }),
  category: "social",
  label: "core.notifications.types.mention.label",
  description: "core.notifications.types.mention.description",
  defaults: { email: "immediate", inApp: true },
  email: true,
  // The mention must still be in the text, and the target readable now.
  access: async ({ c, data, userIds }) => {
    if (userIds.length === 0) return [];
    const target = findMentionTarget(c.get("core").mentions, {
      pluginId: data.pluginId,
      type: data.targetType,
    });
    if (!target) return [];

    const rows = await c
      .get("db")
      .select({ userId: core_mentions.userId })
      .from(core_mentions)
      .where(
        and(
          eq(core_mentions.id, data.mentionId),
          inArray(core_mentions.userId, userIds),
        ),
      );
    if (rows.length === 0) return [];

    return await target.definition.access({
      c,
      id: data.targetId,
      rootId: data.rootId,
      userIds: rows.map(row => row.userId),
    });
  },
  present: ({ actorCount, actors, data, t }) => {
    const values = {
      count: Math.max(actorCount, 1),
      name: actors[0]?.name ?? t("core.notifications.someone"),
    };

    return {
      target: data.url,
      title: data.title
        ? t("core.notifications.types.mention.title_in", {
            ...values,
            title: data.title,
          })
        : t("core.notifications.types.mention.title", values),
    };
  },
});
