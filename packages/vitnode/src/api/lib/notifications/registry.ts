import type { Context } from "hono";
import type { z } from "zod";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { Translator } from "@/api/models/i18n";
import type {
  NotificationEmailMode,
  NotificationSubject,
} from "@/lib/notifications/types";

import { NOTIFICATION_EMAIL_MODES } from "@/lib/notifications/types";

export interface NotificationPresentation {
  body?: string;
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
  actorCount: number;
  actors: NotificationActorPreview[];
  data: TData;
  eventCount: number;
  locale: string;
  subject: NotificationSubject | null;
  t: Translator;
}

export interface NotificationAccessArgs<TData> {
  c: Context<EnvVitNode>;
  data: TData;
  subject: NotificationSubject | null;
  userIds: number[];
}

export interface NotificationGroupingConfig<TData> {
  key?: (args: {
    data: TData;
    subject: NotificationSubject | null;
  }) => null | string;
  windowMinutes: number;
}

export interface NotificationTypeDefinition<TData = Record<string, unknown>> {
  access?: (
    args: NotificationAccessArgs<TData>,
  ) => number[] | Promise<number[]>;
  category: string;
  defaults: { email: NotificationEmailMode; inApp: boolean };
  description?: string;
  email?:
    | ((args: NotificationPresentArgs<TData>) => NotificationEmailPresentation)
    | boolean;
  grouping?: NotificationGroupingConfig<TData>;
  id: string;
  label: string;
  mandatory?: boolean;
  migrate?: (data: unknown, fromVersion: number) => unknown;
  present: (args: NotificationPresentArgs<TData>) => NotificationPresentation;
  schema: z.ZodType<TData>;
  subjectType?: string;
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

export class NotificationRegistryError extends Error {
  constructor(message: string) {
    super(`[Notifications] ${message}`);
    this.name = "NotificationRegistryError";
  }
}

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
