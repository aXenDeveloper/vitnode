import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { Translator } from "@/api/models/i18n";
import type {
  NotificationEmailMode,
  NotificationSubject,
} from "@/lib/notifications/types";

import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

/**
 * One inbox item as plain text. Core removes control characters, collapses
 * whitespace and cuts each string at 500 characters; it does not strip HTML.
 */
export interface NotificationPresentation {
  body?: string;
  /**
   * Same-site path the item links to, e.g. `/forum/topics/42`. Absolute URLs
   * and unsafe values are dropped, leaving the item without a link.
   */
  target?: null | string;
  title: string;
}

/** The wording of a notification email, when it differs from `present`. */
export interface NotificationEmailPresentation {
  actionLabel?: string;
  body?: string;
  subject: string;
  title: string;
}

export interface NotificationActorPreview {
  id: number;
  name: string;
}

/** What `present` and `email` receive, once per recipient language. */
export interface NotificationPresentArgs<TData> {
  /** Distinct people across every notification grouped into the item. */
  actorCount: number;
  /** Up to 3 people who caused the item, newest first; in emails, only that event's actor. */
  actors: NotificationActorPreview[];
  /** The stored data, migrated and parsed with the current `schema`. */
  data: TData;
  /** Notifications grouped into the item; always 1 without `grouping` and in emails. */
  eventCount: number;
  locale: string;
  subject: NotificationSubject | null;
  /** Translator for the recipient's language, reading API messages. */
  t: Translator;
}

export interface NotificationAccessArgs<TData> {
  c: Context<EnvVitNode>;
  data: TData;
  subject: NotificationSubject | null;
  userIds: number[];
}

/**
 * Merges notifications of one type for the same member into one inbox item
 * while they share a group key and a fixed UTC time window.
 */
export interface NotificationGroupingConfig<TData> {
  /**
   * The group key; defaults to the subject (no subject means no grouping). A
   * `null` or empty key is never grouped. Cut at 200 characters.
   */
  key?: (args: {
    data: TData;
    subject: NotificationSubject | null;
  }) => null | string;
  /** Window length in minutes, 1 to 10080 (one week). */
  windowMinutes: number;
}

/** One kind of persistent notification. Build it with {@link buildNotificationType}. */
export interface NotificationTypeDefinition<TData = Record<string, unknown>> {
  /**
   * Returns which of `userIds` may see the notification; without it every
   * recipient may. Called in batches on delivery, before each email and when
   * an inbox loads, so answer the whole batch with one query. Return fewer ids
   * for "no access" - a throw fails the delivery batch for a retry.
   */
  access?: (
    args: NotificationAccessArgs<TData>,
  ) => number[] | Promise<number[]>;
  /**
   * Groups types on the preferences page and in inbox filters: 1-50 of
   * `a-z`, `0-9`, `_`, `-`.
   */
  category: string;
  /**
   * What a member gets before choosing; administrators can override it in the
   * AdminCP. `email` other than `"none"` requires `email`.
   */
  defaults: { email: NotificationEmailMode; inApp: boolean };
  /** API message key for a one-line explanation under the label. */
  description?: string;
  /**
   * Enables email. `true` reuses `present`; a function words the email
   * separately.
   */
  email?:
    | ((args: NotificationPresentArgs<TData>) => NotificationEmailPresentation)
    | boolean;
  /** Merges repeat notifications into one inbox item within a time window. Off by default: each publish is its own item. */
  grouping?: NotificationGroupingConfig<TData>;
  /**
   * Dot-separated, plugin-scoped id such as `"forum.topic_reply"`: at least
   * two segments of `a-z`, `0-9`, `_`, `-`, at most 100 characters. Stored
   * notifications refer to it, so never rename it.
   */
  id: string;
  /** API message key for the type name on the preferences page. */
  label: string;
  /** Always delivered to the inbox; members cannot turn it off. */
  mandatory?: boolean;
  /** Upgrades data stored by an older `version` before it is parsed. */
  migrate?: (data: unknown, fromVersion: number) => unknown;
  /**
   * Renders one inbox item in the recipient's language. Runs on the API each
   * time the item is listed or emailed; a throw or empty title shows a "no
   * longer available" placeholder.
   */
  present: (args: NotificationPresentArgs<TData>) => NotificationPresentation;
  /** Validates `data` on publish and whenever stored data is read. */
  schema: z.ZodType<TData>;
  /** The only subject type `publish()` accepts for this type, e.g. `"forum.topic"`. */
  subjectType?: string;
  /** Integer of 1 or more. Increase it when `schema` changes shape, and add `migrate`. */
  version: number;
}

export type AnyNotificationTypeDefinition =
  // oxlint-disable-next-line typescript/no-explicit-any
  NotificationTypeDefinition<any>;

export interface RegisteredNotificationType {
  definition: AnyNotificationTypeDefinition;
  pluginId: string;
}

const TYPE_ID_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/;
const MAX_TYPE_ID_LENGTH = 100;
const CATEGORY_PATTERN = /^[a-z0-9_-]{1,50}$/;
export const SUBJECT_TYPE_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/;
const MAX_GROUPING_WINDOW_MINUTES = 60 * 24 * 7;

/** Thrown when a notification type is invalid or two plugins register the same id. */
export class NotificationRegistryError extends Error {
  constructor(message: string) {
    super(`[Notifications] ${message}`);
    this.name = "NotificationRegistryError";
  }
}

/**
 * Declares a persistent notification type and checks it when the module loads.
 * Register the returned object in `buildApiPlugin({ notificationTypes })` or
 * `buildModule({ notificationTypes })`, and pass the same object to
 * `c.get("notifications").publish({ type })` so `data` is type-checked.
 *
 * @throws {NotificationRegistryError} For an invalid `id`, `category` or
 * `subjectType`, a `version` below 1, a grouping window outside 1-10080
 * minutes, or `defaults.email` other than `"none"` without `email`.
 *
 * @example
 * ```ts
 * import { buildNotificationType } from "@vitnode/core/api/lib/notifications/registry";
 * import { z } from "zod";
 *
 * export const topicReplyNotification = buildNotificationType({
 *   id: "forum.topic_reply",
 *   version: 1,
 *   schema: z.object({ topicId: z.number(), topicTitle: z.string() }),
 *   category: "content",
 *   label: "@acme/forum.notifications.topic_reply.label",
 *   defaults: { inApp: true, email: "none" },
 *   present: ({ data, t }) => ({
 *     title: t("@acme/forum.notifications.topic_reply.title", {
 *       title: data.topicTitle,
 *     }),
 *     target: `/forum/topics/${data.topicId}`,
 *   }),
 * });
 * ```
 */
export function buildNotificationType<TData>(
  definition: NotificationTypeDefinition<TData>,
): NotificationTypeDefinition<TData> {
  if (
    !TYPE_ID_PATTERN.test(definition.id) ||
    definition.id.length > MAX_TYPE_ID_LENGTH
  ) {
    throw new NotificationRegistryError(
      `Invalid notification type id "${definition.id}". Use a plugin-scoped, dot-separated id such as "blog.comment" (lowercase letters, digits, "_" and "-").`,
    );
  }

  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" needs an integer version of 1 or more.`,
    );
  }

  if (!CATEGORY_PATTERN.test(definition.category)) {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" has an invalid category "${definition.category}".`,
    );
  }

  if (!NOTIFICATION_EMAIL_MODES.includes(definition.defaults.email)) {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" has an unknown default email mode "${definition.defaults.email}".`,
    );
  }

  if (!definition.email && definition.defaults.email !== "none") {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" defaults to "${definition.defaults.email}" email but declares no email presentation. Set "email: true" or default to "none".`,
    );
  }

  if (
    definition.subjectType !== undefined &&
    !SUBJECT_TYPE_PATTERN.test(definition.subjectType)
  ) {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" has an invalid subject type "${definition.subjectType}".`,
    );
  }

  if (definition.grouping) {
    const { windowMinutes } = definition.grouping;
    if (
      !Number.isInteger(windowMinutes) ||
      windowMinutes < 1 ||
      windowMinutes > MAX_GROUPING_WINDOW_MINUTES
    ) {
      throw new NotificationRegistryError(
        `Notification type "${definition.id}" needs a grouping window between 1 and ${MAX_GROUPING_WINDOW_MINUTES} minutes.`,
      );
    }
  }

  return definition;
}

export const validateNotificationTypes = (
  entries: readonly RegisteredNotificationType[],
): void => {
  const seen = new Map<string, string>();

  for (const entry of entries) {
    const owner = seen.get(entry.definition.id);
    if (owner !== undefined) {
      throw new NotificationRegistryError(
        `Duplicate notification type "${entry.definition.id}": registered by both "${owner}" and "${entry.pluginId}".`,
      );
    }

    seen.set(entry.definition.id, entry.pluginId);
  }
};

export interface NotificationRegistry {
  get: (type: string) => RegisteredNotificationType | undefined;
  list: RegisteredNotificationType[];
}

export const createNotificationRegistry = (
  entries: readonly RegisteredNotificationType[],
): NotificationRegistry => {
  validateNotificationTypes(entries);
  const list = [...entries];
  const byId = new Map(list.map(entry => [entry.definition.id, entry]));

  return {
    get: type => byId.get(type),
    list,
  };
};

export const parseStoredNotificationData = (
  definition: AnyNotificationTypeDefinition,
  data: unknown,
  version: number,
): unknown => {
  let value = data;
  if (version !== definition.version) {
    if (!definition.migrate || version > definition.version) return null;
    try {
      value = definition.migrate(data, version);
    } catch {
      return null;
    }
  }

  const parsed = definition.schema.safeParse(value);

  return parsed.success ? parsed.data : null;
};
