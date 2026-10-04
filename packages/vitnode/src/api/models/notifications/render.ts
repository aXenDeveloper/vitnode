import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import type {
  NotificationEmailPresentation,
  NotificationPresentation,
  RegisteredNotificationType,
} from "@/api/lib/notifications/registry";
import type { Translator } from "@/api/models/i18n";
import type { NotificationSubject } from "@/lib/notifications/types";

import { parseStoredNotificationData } from "@/api/lib/notifications/registry";
import {
  plainNotificationText,
  safeNotificationTarget,
} from "@/api/lib/notifications/safe";
import { storageUrlOf } from "@/api/lib/storage-url";
import { core_files } from "@/database/files";
import {
  core_notification_events,
  core_notification_receipts,
} from "@/database/notifications";
import { core_users } from "@/database/users";

import type { NotificationsContext } from "./shared";

import { getNotificationRegistry } from "./shared";

export type NotificationEventRow = typeof core_notification_events.$inferSelect;

export interface NotificationActor {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

interface ActorSummary {
  actorCount: number;
  actors: NotificationActor[];
}

const ACTOR_PREVIEW_LIMIT = 3;

export const loadActors = async (
  c: NotificationsContext,
  ids: number[],
): Promise<Map<number, NotificationActor>> => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const rows = await c
    .get("db")
    .select({
      avatarColor: core_users.avatarColor,
      avatarKey: core_files.key,
      id: core_users.id,
      name: core_users.name,
      nameCode: core_users.nameCode,
    })
    .from(core_users)
    .leftJoin(core_files, eq(core_files.id, core_users.avatarId))
    .where(inArray(core_users.id, unique));

  return new Map(
    rows.map(({ avatarKey, ...row }) => [
      row.id,
      { ...row, avatarUrl: storageUrlOf(c, avatarKey) },
    ]),
  );
};

export const loadActorSummaries = async (
  c: NotificationsContext,
  notificationIds: number[],
): Promise<Map<number, ActorSummary>> => {
  if (notificationIds.length === 0) return new Map();

  const rows = await c
    .get("db")
    .select({
      actorId: core_notification_events.actorId,
      notificationId: core_notification_receipts.notificationId,
      seq: sql<number>`max(${core_notification_receipts.seq})`.mapWith(Number),
    })
    .from(core_notification_receipts)
    .innerJoin(
      core_notification_events,
      eq(core_notification_events.id, core_notification_receipts.eventId),
    )
    .where(
      and(
        inArray(core_notification_receipts.notificationId, notificationIds),
        isNotNull(core_notification_events.actorId),
      ),
    )
    .groupBy(
      core_notification_receipts.notificationId,
      core_notification_events.actorId,
    );

  const byItem = new Map<number, { actorId: number; seq: number }[]>();
  for (const row of rows) {
    if (row.notificationId === null || row.actorId === null) continue;
    byItem.set(row.notificationId, [
      ...(byItem.get(row.notificationId) ?? []),
      { actorId: row.actorId, seq: row.seq },
    ]);
  }

  const previewIds = [...byItem.values()].flatMap(list =>
    list
      .sort((a, b) => b.seq - a.seq)
      .slice(0, ACTOR_PREVIEW_LIMIT)
      .map(entry => entry.actorId),
  );
  const actors = await loadActors(c, previewIds);

  return new Map(
    [...byItem].map(([notificationId, list]) => [
      notificationId,
      {
        actorCount: list.length,
        actors: list
          .slice(0, ACTOR_PREVIEW_LIMIT)
          .map(entry => actors.get(entry.actorId))
          .filter(actor => actor !== undefined),
      },
    ]),
  );
};

const subjectOf = (
  row: Pick<NotificationEventRow, "subjectId" | "subjectType">,
): NotificationSubject | null =>
  row.subjectType && row.subjectId
    ? { id: row.subjectId, type: row.subjectType }
    : null;

export const checkNotificationAccess = async ({
  c,
  data,
  event,
  registered,
  userIds,
}: {
  c: NotificationsContext;
  data: unknown;
  event: NotificationEventRow;
  registered: RegisteredNotificationType;
  userIds: number[];
}): Promise<Set<number>> => {
  const { access } = registered.definition;
  if (!access) return new Set(userIds);

  return new Set(await access({ c, data, subject: subjectOf(event), userIds }));
};

interface ResolvedEvent {
  data: unknown;
  registered: RegisteredNotificationType;
}

export const resolveEvent = (
  c: NotificationsContext,
  event: NotificationEventRow,
): null | ResolvedEvent => {
  const registered = getNotificationRegistry(c).get(event.type);
  if (registered?.pluginId !== event.pluginId) return null;

  const data = parseStoredNotificationData(
    registered.definition,
    event.data,
    event.schemaVersion,
  );

  return data === null ? null : { data, registered };
};

interface PresentArgs {
  actors: ActorSummary;
  data: unknown;
  event: NotificationEventRow;
  eventCount: number;
  locale: string;
  registered: RegisteredNotificationType;
  t: Translator;
}

const presentArgs = ({
  actors,
  data,
  event,
  eventCount,
  locale,
  t,
}: PresentArgs) => ({
  actorCount: actors.actorCount,
  actors: actors.actors.map(actor => ({ id: actor.id, name: actor.name })),
  data,
  eventCount,
  locale,
  subject: subjectOf(event),
  t,
});

export const presentNotification = (
  c: NotificationsContext,
  args: PresentArgs,
): (NotificationPresentation & { target: null | string }) | null => {
  try {
    const presented = args.registered.definition.present(presentArgs(args));
    const title = plainNotificationText(presented.title);
    if (!title) return null;

    return {
      body: plainNotificationText(presented.body) || undefined,
      target: safeNotificationTarget(presented.target),
      title,
    };
  } catch (error) {
    void c
      .get("log")
      .error(
        `[Notifications] "${args.registered.definition.id}" failed to render: ${error instanceof Error ? error.message : String(error)}`,
      );

    return null;
  }
};

export const presentNotificationEmail = (
  c: NotificationsContext,
  args: PresentArgs,
): (NotificationEmailPresentation & { target: null | string }) | null => {
  const inApp = presentNotification(c, args);
  if (!inApp) return null;

  const { email } = args.registered.definition;
  if (typeof email !== "function") {
    return {
      body: inApp.body,
      subject: inApp.title,
      target: inApp.target,
      title: inApp.title,
    };
  }

  try {
    const presented = email(presentArgs(args));

    return {
      actionLabel: plainNotificationText(presented.actionLabel) || undefined,
      body: plainNotificationText(presented.body) || undefined,
      subject: plainNotificationText(presented.subject) || inApp.title,
      target: inApp.target,
      title: plainNotificationText(presented.title) || inApp.title,
    };
  } catch {
    return {
      body: inApp.body,
      subject: inApp.title,
      target: inApp.target,
      title: inApp.title,
    };
  }
};

export const createTranslatorCache = (c: NotificationsContext) => {
  const cache = new Map<string, Promise<Translator>>();

  return async (language: null | string | undefined) => {
    const locale = c.get("i18n").resolveSupportedLocale(language ?? undefined);
    let translator = cache.get(locale);
    if (!translator) {
      translator = c.get("i18n").getTranslator(locale);
      cache.set(locale, translator);
    }

    return { locale, t: await translator };
  };
};
