import { z } from "zod";

import { buildRoute } from "@/api/lib/route";
import { getNotificationRegistry } from "@/api/models/notifications/shared";
import {
  getSubscriptionState,
  listSubscriptions,
  setSubscriptionState,
} from "@/api/models/notifications/subscriptions";
import { CONFIG_PLUGIN } from "@/config";

import {
  requireNotificationUser,
  unauthorizedResponse,
  zodSubscriptionState,
} from "../schema";

const zodSubject = z.object({
  subjectId: z.string().min(1).max(100),
  subjectType: z.string().min(1).max(100),
});

export const getSubscriptionRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description:
      "Whether the signed-in user follows or muted one subject, e.g. a blog category.",
    path: "/subscriptions/{subjectType}/{subjectId}",
    request: { params: zodSubject },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ state: zodSubscriptionState }),
          },
        },
        description: "Subscription state",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { subjectId, subjectType } = c.req.valid("param");

    return c.json({
      state: await getSubscriptionState(c, user.id, {
        id: subjectId,
        type: subjectType,
      }),
    });
  },
});

export const setSubscriptionRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "put",
    description:
      "Follow, mute or clear one subject for the signed-in user. Following asks the owning plugin's canFollow first.",
    path: "/subscriptions",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: zodSubject.extend({ state: zodSubscriptionState }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ state: zodSubscriptionState }),
          },
        },
        description: "Saved",
      },
      400: { description: "Unknown subject type" },
      403: { description: "The plugin does not let this user follow it" },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { state, subjectId, subjectType } = c.req.valid("json");

    return c.json({
      state: await setSubscriptionState(
        c,
        user.id,
        { id: subjectId, type: subjectType },
        state,
      ),
    });
  },
});

export const listSubscriptionsRoute = buildRoute({
  pluginId: CONFIG_PLUGIN.pluginId,
  route: {
    method: "get",
    description: "The subjects the signed-in user follows or muted.",
    path: "/subscriptions",
    request: {
      query: z.object({ state: z.enum(["following", "muted"]).optional() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(
                z.object({
                  createdAt: z.date(),
                  /** A readable name, when the owning plugin provides one. */
                  label: z.string().nullable(),
                  state: z.enum(["following", "muted"]),
                  subjectId: z.string(),
                  subjectType: z.string(),
                }),
              ),
            }),
          },
        },
        description: "Subscriptions",
      },
      ...unauthorizedResponse,
    },
  },
  handler: async c => {
    const user = requireNotificationUser(c);
    const { state } = c.req.valid("query");
    const items = await listSubscriptions(c, {
      limit: 200,
      state,
      userId: user.id,
    });

    const registry = getNotificationRegistry(c);
    const locale = c.get("i18n").resolveSupportedLocale(user.language);
    const labels = new Map<string, string>();
    for (const type of new Set(items.map(item => item.subjectType))) {
      const resolve = registry.getSubject(type)?.definition.resolveLabels;
      if (!resolve) continue;
      try {
        const ids = items
          .filter(item => item.subjectType === type)
          .map(item => item.subjectId);
        const resolved = await resolve({ c, ids, locale });
        for (const [id, label] of Object.entries(resolved)) {
          labels.set(`${type}:${id}`, label.slice(0, 200));
        }
      } catch {
        // A plugin failing to name its subjects only costs the pretty label.
      }
    }

    return c.json({
      items: items.map(item => ({
        ...item,
        label: labels.get(`${item.subjectType}:${item.subjectId}`) ?? null,
      })),
    });
  },
});
