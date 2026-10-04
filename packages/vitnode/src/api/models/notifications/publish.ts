import { and, eq } from "drizzle-orm";

import type {
  AnyNotificationTypeDefinition,
  NotificationTypeDefinition,
} from "@/api/lib/notifications/registry";
import type { NotificationSubject } from "@/lib/notifications/types";

import { SUBJECT_TYPE_PATTERN } from "@/api/lib/notifications/registry";
import { core_notification_events } from "@/database/notifications";

import type { NotificationsContext, NotificationsDb } from "./shared";

import {
  getNotificationRegistry,
  NOTIFICATIONS_PLUGIN_ID,
  QUEUE_NOTIFICATIONS_FANOUT,
} from "./shared";

const MAX_EXPLICIT_RECIPIENTS = 100_000;

export interface PublishNotificationArgs<TData> {
  actorId?: null | number;
  allowSelf?: boolean;
  data: NoInfer<TData>;
  idempotencyKey: string;
  recipients?: readonly number[];
  subject?: NotificationSubject;
  tx?: NotificationsDb;
  type: NotificationTypeDefinition<TData> | string;
}

export interface PublishNotificationResult {
  duplicate: boolean;
  eventId: number;
}

export class NotificationPublishError extends Error {
  constructor(message: string) {
    super(`[Notifications] ${message}`);
    this.name = "NotificationPublishError";
  }
}

const normalizeSubject = (
  subject: NotificationSubject,
): { id: string; type: string } => {
  const id = String(subject.id);
  if (!SUBJECT_TYPE_PATTERN.test(subject.type) || subject.type.length > 100) {
    throw new NotificationPublishError(
      `Invalid subject type "${subject.type}".`,
    );
  }
  if (id.length === 0 || id.length > 100) {
    throw new NotificationPublishError(`Invalid subject id "${id}".`);
  }

  return { id, type: subject.type };
};

const resolveGroupKey = (
  definition: AnyNotificationTypeDefinition,
  data: unknown,
  subject: null | { id: string; type: string },
): null | string => {
  if (!definition.grouping) return null;
  const key = definition.grouping.key
    ? definition.grouping.key({ data, subject })
    : subject
      ? `${subject.type}:${subject.id}`
      : null;

  return key ? key.slice(0, 200) : null;
};

export const publishNotification = async <TData>(
  c: NotificationsContext,
  args: PublishNotificationArgs<TData>,
  onQueued: (queueId: number) => void,
): Promise<PublishNotificationResult> => {
  const typeId = typeof args.type === "string" ? args.type : args.type.id;
  const registered = getNotificationRegistry(c).get(typeId);
  if (!registered) {
    throw new NotificationPublishError(
      `Notification type "${typeId}" is not registered. Add it to a plugin's "notificationTypes".`,
    );
  }
  if (typeof args.type !== "string" && args.type !== registered.definition) {
    throw new NotificationPublishError(
      `Notification type "${typeId}" was published with a definition other than the registered one.`,
    );
  }

  const { definition, pluginId } = registered;
  const parsed = definition.schema.safeParse(args.data);
  if (!parsed.success) {
    throw new NotificationPublishError(
      `Invalid data for "${typeId}": ${parsed.error.issues
        .map(issue => `${issue.path.join(".") || "(root)"} ${issue.message}`)
        .join("; ")}`,
    );
  }

  const idempotencyKey = args.idempotencyKey.trim();
  if (idempotencyKey.length === 0 || idempotencyKey.length > 255) {
    throw new NotificationPublishError(
      "idempotencyKey must be 1-255 characters.",
    );
  }

  const subject = args.subject ? normalizeSubject(args.subject) : null;
  if (
    subject &&
    definition.subjectType &&
    subject.type !== definition.subjectType
  ) {
    throw new NotificationPublishError(
      `"${typeId}" is about "${definition.subjectType}" subjects, not "${subject.type}".`,
    );
  }

  const actorId =
    args.actorId === undefined
      ? (c.get("admin")?.user.id ?? c.get("user")?.id ?? null)
      : args.actorId;

  const recipientIds = [
    ...new Set(
      (args.recipients ?? []).filter(
        id =>
          Number.isInteger(id) &&
          id > 0 &&
          (args.allowSelf === true || id !== actorId),
      ),
    ),
  ].sort((a, b) => a - b);

  if (recipientIds.length > MAX_EXPLICIT_RECIPIENTS) {
    throw new NotificationPublishError(
      `At most ${MAX_EXPLICIT_RECIPIENTS} recipients per event.`,
    );
  }

  const db = args.tx ?? c.get("db");
  const hasAudience = recipientIds.length > 0;
  const now = new Date();

  const [created] = await db
    .insert(core_notification_events)
    .values({
      actorId,
      allowSelf: args.allowSelf ?? false,
      completedAt: hasAudience ? null : now,
      createdAt: now,
      data: parsed.data as Record<string, unknown>,
      groupKey: resolveGroupKey(definition, parsed.data, subject),
      idempotencyKey,
      pluginId,
      recipientIds,
      schemaVersion: definition.version,
      status: hasAudience ? "pending" : "completed",
      subjectId: subject?.id ?? null,
      subjectType: subject?.type ?? null,
      type: typeId,
    })
    .onConflictDoNothing({
      target: [
        core_notification_events.pluginId,
        core_notification_events.type,
        core_notification_events.idempotencyKey,
      ],
    })
    .returning({ id: core_notification_events.id });

  if (!created) {
    const [existing] = await db
      .select({ id: core_notification_events.id })
      .from(core_notification_events)
      .where(
        and(
          eq(core_notification_events.pluginId, pluginId),
          eq(core_notification_events.type, typeId),
          eq(core_notification_events.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotificationPublishError(
        `Event "${typeId}" with key "${idempotencyKey}" is being published concurrently.`,
      );
    }

    return { duplicate: true, eventId: existing.id };
  }

  if (hasAudience) {
    const queued = await c.get("queue").dispatch({
      name: QUEUE_NOTIFICATIONS_FANOUT,
      payload: { eventId: created.id },
      pluginId: NOTIFICATIONS_PLUGIN_ID,
      priority: 10,
      tx: db,
    });
    onQueued(queued.id);
  }

  return { duplicate: false, eventId: created.id };
};
