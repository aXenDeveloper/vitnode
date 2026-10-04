import type { Context } from "hono";
import type { ReactElement } from "react";

import { and, eq, lte } from "drizzle-orm";
import { createTranslator } from "use-intl";

import type {
  AnyNotificationTypeDefinition,
  NotificationSubjectDefinition,
} from "@/api/lib/notifications/registry";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { NotificationEmailProps } from "@/emails/notification";

import { createNotificationRegistry } from "@/api/lib/notifications/registry";
import { NotificationsModel } from "@/api/models/notifications";
import { QueueModel } from "@/api/models/queue";
import {
  notificationsCleanupTask,
  notificationsEmailTask,
  notificationsFanoutTask,
} from "@/api/modules/notifications/tasks/notification-tasks";
import { processQueueTasksByIds } from "@/api/modules/queue/helpers/process-queue-tasks";
import { core_files } from "@/database/files";
import { core_languages } from "@/database/languages";
import * as notificationTables from "@/database/notifications";
import { core_queue } from "@/database/queue";
import { core_roles } from "@/database/roles";
import { core_users } from "@/database/users";
import apiMessages from "@/locales/api/en.json";

import { createTestCache } from "./cache";
import { createTestDatabase, type TestDatabaseHandle } from "./postgres";

export interface RealtimeRecord {
  data: { reason: string; revision: number; unread: number };
  userId: number;
}

export interface SentEmailRecord {
  entries: NotificationEmailProps["entries"];
  idempotencyKey?: string;
  subject: string;
  to: string;
}

export interface NotificationsHarness {
  c: Context<EnvVitNode>;
  createUsers: (count: number, language?: string) => Promise<number[]>;
  database: TestDatabaseHandle;
  /** Runs queued tasks until nothing due is left. */
  drainQueue: (now?: Date) => Promise<number>;
  /** A context on its own connection pool, for concurrent work. */
  forkContext: () => Context<EnvVitNode>;
  /** Queries sent through any connection since the harness was created. */
  queryCount: () => number;
  realtime: RealtimeRecord[];
  sentEmails: SentEmailRecord[];
  setEmailFailure: (error: Error | null) => void;
}

const notificationTasks = [
  notificationsFanoutTask,
  notificationsEmailTask,
  notificationsCleanupTask,
].map(task => ({
  ...task,
  module: "notifications",
  pluginId: "@vitnode/core",
}));

export const createNotificationsHarness = async ({
  email = true,
  messages = {},
  subjects = [],
  types,
}: {
  email?: boolean;
  messages?: Record<string, unknown>;
  subjects?: NotificationSubjectDefinition[];
  types: AnyNotificationTypeDefinition[];
}): Promise<NotificationsHarness> => {
  let queries = 0;
  const database = await createTestDatabase(
    {
      core_files,
      core_languages,
      core_queue,
      core_roles,
      core_users,
      ...notificationTables,
    },
    { onQuery: () => (queries += 1) },
  );

  await database.db
    .insert(core_languages)
    .values({ code: "en", name: "English", timezone: "UTC" });
  await database.db
    .insert(core_roles)
    .values({ id: 1, name: "Member", root: false } as never);

  const realtime: RealtimeRecord[] = [];
  const sentEmails: SentEmailRecord[] = [];
  let emailFailure: Error | null = null;
  const registry = createNotificationRegistry(
    types.map(definition => ({ definition, pluginId: "@acme/test" })),
    subjects.map(definition => ({ definition, pluginId: "@acme/test" })),
  );
  const translator = createTranslator({
    locale: "en",
    messages: { ...apiMessages, ...messages },
  });

  const makeContext = (db: TestDatabaseHandle["db"]): Context<EnvVitNode> => {
    const vars = new Map<string, unknown>();
    const c = {
      get: (key: string) => vars.get(key),
      set: (key: string, value: unknown) => vars.set(key, value),
    } as unknown as Context<EnvVitNode>;

    vars.set("db", db);
    vars.set("cache", createTestCache());
    vars.set("user", null);
    vars.set("admin", null);
    vars.set("core", {
      email: email
        ? { adapter: { sendEmail: async () => await Promise.resolve() } }
        : undefined,
      metadata: { title: "Test" },
      notifications: registry,
      queue: notificationTasks,
    });
    vars.set("realtime", {
      broadcast: () => undefined,
      sendToUser: (
        userId: number,
        _channel: unknown,
        data: RealtimeRecord["data"],
      ) => {
        realtime.push({ data, userId });
      },
    });
    vars.set("i18n", {
      getTranslator: async () => await Promise.resolve(translator),
      resolveSupportedLocale: () => "en",
    });
    vars.set("email", {
      build: async (args: {
        content: (props: unknown) => ReactElement<NotificationEmailProps>;
        subject: string;
        to: string;
      }) => {
        const element = args.content({
          i18n: { locale: "en", messages: {} },
          templateProps: {
            metadata: { title: "Test", url: "http://localhost" },
          },
        });

        return await Promise.resolve({
          entries: element.props.entries,
          html: "",
          subject: args.subject,
          text: "",
          to: args.to,
        });
      },
      deliver: async (
        built: Omit<SentEmailRecord, "idempotencyKey">,
        options: { idempotencyKey?: string },
      ) => {
        if (emailFailure) throw emailFailure;
        sentEmails.push({ ...built, idempotencyKey: options.idempotencyKey });

        return await Promise.resolve({ id: `message-${sentEmails.length}` });
      },
    });
    vars.set("log", {
      debug: async () => {},
      error: async () => {},
      info: async () => {},
      warn: async () => {},
    });
    vars.set("queue", new QueueModel(c));
    vars.set("notifications", new NotificationsModel(c));

    return c;
  };

  const c = makeContext(database.db);
  let userSeq = 0;

  return {
    c,
    createUsers: async (count, language = "en") => {
      const rows = await database.db
        .insert(core_users)
        .values(
          Array.from({ length: count }, () => {
            userSeq += 1;

            return {
              avatarColor: "000000",
              email: `user${userSeq}@example.com`,
              ipAddress: "127.0.0.1",
              language,
              name: `User ${userSeq}`,
              nameCode: `user-${userSeq}`,
              roleId: 1,
            };
          }),
        )
        .returning({ id: core_users.id });

      return rows.map(row => row.id);
    },
    database,
    drainQueue: async (now = new Date()) => {
      let runs = 0;
      for (let round = 0; round < 200; round++) {
        const due = await database.db
          .select({ id: core_queue.id })
          .from(core_queue)
          .where(
            and(
              eq(core_queue.status, "pending"),
              lte(core_queue.availableAt, now),
            ),
          );
        if (due.length === 0) break;
        runs += due.length;
        await processQueueTasksByIds(
          c,
          due.map(row => row.id),
        );
      }

      return runs;
    },
    forkContext: () => makeContext(database.connect()),
    queryCount: () => queries,
    realtime,
    sentEmails,
    setEmailFailure: error => {
      emailFailure = error;
    },
  };
};
