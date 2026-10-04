import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { Translator } from "@/api/models/i18n";
import type {
  NotificationEmailMode,
  NotificationSubject,
} from "@/lib/notifications/types";

import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

/** Plain text a type renders for one inbox item. Never HTML. */
export interface NotificationPresentation {
  body?: string;
  /**
   * Where clicking the item goes: a path on this site, such as `/blog/hello`.
   * Anything else - another origin, `javascript:`, `//evil.com` - is dropped
   * and the item renders without a link.
   */
  target?: null | string;
  title: string;
}

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

export interface NotificationPresentArgs<TData> {
  /** Distinct actors across every event of the item. */
  actorCount: number;
  /** The most recent distinct actors of the item, newest first (max 3). */
  actors: NotificationActorPreview[];
  data: TData;
  /** Events grouped into the item, 1 when the type is not grouped. */
  eventCount: number;
  locale: string;
  subject: NotificationSubject | null;
  t: Translator;
}

export interface NotificationAccessArgs<TData> {
  c: Context<EnvVitNode>;
  data: TData;
  subject: NotificationSubject | null;
  /** The candidates to check - a bounded batch, never the whole audience. */
  userIds: number[];
}

export interface NotificationGroupingConfig<TData> {
  /**
   * What makes two events "the same thing". Defaults to the subject, and an
   * event without a subject (or a `null` key) is never grouped.
   */
  key?: (args: {
    data: TData;
    subject: NotificationSubject | null;
  }) => null | string;
  /** Events landing in the same window join one inbox item. */
  windowMinutes: number;
}

export interface NotificationTypeDefinition<TData = Record<string, unknown>> {
  /**
   * Returns which of `userIds` may see this notification. Called in bounded
   * batches during fan-out, again before an email goes out, and for every item
   * a user lists - so it should answer for many users with one query.
   */
  access?: (
    args: NotificationAccessArgs<TData>,
  ) => number[] | Promise<number[]>;
  category: string;
  defaults: { email: NotificationEmailMode; inApp: boolean };
  /** Message key of the one-line description shown in preferences. */
  description?: string;
  /**
   * Turns on the email channel. `true` reuses `present` for the email; a
   * function words it separately.
   */
  email?:
    | ((args: NotificationPresentArgs<TData>) => NotificationEmailPresentation)
    | boolean;
  grouping?: NotificationGroupingConfig<TData>;
  /** Plugin-scoped, dot-separated id such as `blog.post_published`. */
  id: string;
  /** Message key of the preference label. */
  label: string;
  /**
   * Account and security messages. Always shown in-app, never muted, and the
   * user cannot opt out of its email default.
   */
  mandatory?: boolean;
  /** Upgrades data stored by an older `version` before it is parsed. */
  migrate?: (data: unknown, fromVersion: number) => unknown;
  present: (args: NotificationPresentArgs<TData>) => NotificationPresentation;
  schema: z.ZodType<TData>;
  /** The subject type this notification is about, e.g. `blog.post`. */
  subjectType?: string;
  /** Bump when `schema` changes shape; see `migrate`. */
  version: number;
}

export type AnyNotificationTypeDefinition =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NotificationTypeDefinition<any>;

export interface RegisteredNotificationType {
  definition: AnyNotificationTypeDefinition;
  pluginId: string;
}

/**
 * Something users can follow or mute, such as a blog category. Following adds
 * a user to the audience whenever a publisher names the subject in
 * `followersOf`; muting silences every notification about it.
 */
export interface NotificationSubjectDefinition {
  /**
   * Whether `userId` may follow subject `id` - typically "can they see it".
   * Not called for mutes and unfollows, which only ever reduce what a user
   * receives.
   */
  canFollow?: (args: {
    c: Context<EnvVitNode>;
    id: string;
    userId: number;
  }) => boolean | Promise<boolean>;
  /** `false` for subjects that can only be muted. */
  followable?: boolean;
  /**
   * Human-readable names for the settings page's follow and mute lists, e.g.
   * category titles. Ids it leaves out show as their raw id.
   */
  resolveLabels?: (args: {
    c: Context<EnvVitNode>;
    ids: string[];
    locale: string;
  }) => Promise<Record<string, string>> | Record<string, string>;
  type: string;
}

export interface RegisteredNotificationSubject {
  definition: NotificationSubjectDefinition;
  pluginId: string;
}

export function buildNotificationSubject(
  definition: NotificationSubjectDefinition,
): NotificationSubjectDefinition {
  if (
    !SUBJECT_TYPE_PATTERN.test(definition.type) ||
    definition.type.length > 100
  ) {
    throw new NotificationRegistryError(
      `Invalid notification subject type "${definition.type}".`,
    );
  }

  return definition;
}

export type NotificationDataOf<T> =
  T extends NotificationTypeDefinition<infer D> ? D : never;

const TYPE_ID_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/;
export const SUBJECT_TYPE_PATTERN = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/;
const MAX_GROUPING_WINDOW_MINUTES = 60 * 24 * 7;

export class NotificationRegistryError extends Error {
  constructor(message: string) {
    super(`[Notifications] ${message}`);
    this.name = "NotificationRegistryError";
  }
}

/**
 * Declares a notification type. The returned object is both what a plugin
 * registers and what it passes to `publish`, so `data` is type-checked against
 * the schema at every call site.
 *
 * @example
 * ```ts
 * export const commentNotification = buildNotificationType({
 *   id: "blog.comment",
 *   version: 1,
 *   schema: z.object({ postId: z.number(), title: z.string() }),
 *   category: "social",
 *   label: "@vitnode/blog.notifications.comment.label",
 *   defaults: { inApp: true, email: "daily" },
 *   present: ({ data, t }) => ({
 *     title: t("@vitnode/blog.notifications.comment.title", { title: data.title }),
 *     target: `/blog/${data.postId}`,
 *   }),
 * });
 * ```
 */
export function buildNotificationType<TData>(
  definition: NotificationTypeDefinition<TData>,
): NotificationTypeDefinition<TData> {
  if (!TYPE_ID_PATTERN.test(definition.id) || definition.id.length > 100) {
    throw new NotificationRegistryError(
      `Invalid notification type id "${definition.id}". Use a plugin-scoped, dot-separated id such as "blog.comment" (lowercase letters, digits, "_" and "-").`,
    );
  }

  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new NotificationRegistryError(
      `Notification type "${definition.id}" needs an integer version of 1 or more.`,
    );
  }

  if (!/^[a-z0-9_-]{1,50}$/.test(definition.category)) {
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

/** Refuses the same type id registered twice, by one plugin or by two. */
export const validateNotificationTypes = (
  entries: readonly RegisteredNotificationType[],
): RegisteredNotificationType[] => {
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

  return [...entries];
};

export const notificationTypeKey = (pluginId: string, type: string): string =>
  `${pluginId}:${type}`;

export interface NotificationRegistry {
  get: (type: string) => RegisteredNotificationType | undefined;
  getSubject: (type: string) => RegisteredNotificationSubject | undefined;
  list: RegisteredNotificationType[];
  subjects: RegisteredNotificationSubject[];
}

/**
 * Builds the installation-wide registry. A type's `subjectType` that no plugin
 * declared becomes a mute-only subject, so anything a notification is about
 * can always be muted.
 */
export const createNotificationRegistry = (
  entries: readonly RegisteredNotificationType[],
  subjects: readonly RegisteredNotificationSubject[] = [],
): NotificationRegistry => {
  const list = validateNotificationTypes(entries);
  const byId = new Map(list.map(entry => [entry.definition.id, entry]));

  const bySubject = new Map<string, RegisteredNotificationSubject>();
  for (const subject of subjects) {
    const owner = bySubject.get(subject.definition.type);
    if (owner) {
      throw new NotificationRegistryError(
        `Duplicate notification subject "${subject.definition.type}": registered by both "${owner.pluginId}" and "${subject.pluginId}".`,
      );
    }
    bySubject.set(subject.definition.type, subject);
  }
  for (const entry of list) {
    const type = entry.definition.subjectType;
    if (type && !bySubject.has(type)) {
      bySubject.set(type, {
        definition: { followable: false, type },
        pluginId: entry.pluginId,
      });
    }
  }

  return {
    get: type => byId.get(type),
    getSubject: type => bySubject.get(type),
    list,
    subjects: [...bySubject.values()],
  };
};

/**
 * Parses stored event data with the type's current schema, upgrading it first
 * when it was written by an older version. `null` means the data can no longer
 * be shown - the inbox renders an "unavailable" placeholder instead.
 */
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
