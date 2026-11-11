import type { Context } from "hono";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { QueueTaskDefinition } from "@/api/lib/queue";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { buildQueueTask, QueueDeferError } from "@/api/lib/queue";
import { QueueModel } from "@/api/models/queue";
import { altGenerateQueueTask } from "@/api/modules/ai/tasks/alt-generate.task";
import { contentNotificationsQueueTask } from "@/api/modules/content/tasks/content-notifications.task";
import { contentScheduleEffectsQueueTask } from "@/api/modules/content/tasks/content-schedule-effects.task";
import { contentScheduleQueueTask } from "@/api/modules/content/tasks/content-schedule.task";
import { contentSearchDependentsQueueTask } from "@/api/modules/content/tasks/content-search-dependents.task";
import {
  notificationsCleanupTask,
  notificationsEmailTask,
  notificationsFanoutTask,
} from "@/api/modules/notifications/tasks/notifications.task";
import { sendEmailQueueTask } from "@/api/modules/queue/tasks/send-email.task";
import { rebuildSearchIndexTask } from "@/api/modules/search/tasks/rebuild-index.task";
import { core_queue } from "@/database/queue";
import { createTestCache } from "@/tests/cache";
import { createMemoryDb } from "@/tests/memory-db";

import { processQueueTasks } from "./process-queue-tasks";

const NOW = new Date("2026-11-11T10:00:00.000Z");
const SECRET = "s3cret-value";

type AnyTask = QueueTaskDefinition;

const setup = (tasks: AnyTask[], plugin = "@vitnode/blog") => {
  const memory = createMemoryDb();
  const log = {
    debug: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  };
  const values: Record<string, unknown> = {
    cache: createTestCache(),
    core: { queue: tasks.map(task => ({ ...task, module: "test" })) },
    db: memory.db,
    log,
    plugin: { id: plugin },
  };
  const c = {
    get: (key: string) => values[key],
  } as unknown as Context<EnvVitNode>;

  return {
    c,
    drain: async () => {
      await processQueueTasks(c);
    },
    log,
    memory,
    queue: new QueueModel(c),
    rows: () => memory.rows(core_queue),
  };
};

describe("processQueueTasks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hands the handler the schema's output of the stored JSON, transformed once", async () => {
    const handler = vi.fn();
    const task = buildQueueTask({
      pluginId: "@vitnode/notes",
      name: "remind",
      payload: z.object({
        at: z.iso.datetime().transform(value => new Date(value)),
        score: z.number().transform(score => score * 10),
      }),
      handler,
    });
    const { drain, queue, rows } = setup([task], "@vitnode/blog");

    await queue.dispatch(task, { at: NOW.toISOString(), score: 2 });
    expect(rows()[0]).toMatchObject({
      payload: { at: NOW.toISOString(), score: 2 },
      pluginId: "@vitnode/notes",
    });

    await drain();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toEqual({ at: NOW, score: 20 });
    expect(rows()[0]).toMatchObject({
      attempts: 1,
      completedAt: NOW,
      lastError: null,
      status: "completed",
    });
  });

  it("fails a stored payload the schema rejects at once, without a retry or its value", async () => {
    const handler = vi.fn();
    const { drain, memory, rows } = setup([
      { ...altGenerateQueueTask, handler },
    ]);
    await memory.db.insert(core_queue).values({
      maxAttempts: 3,
      name: altGenerateQueueTask.name,
      payload: { fileId: SECRET },
      pluginId: "@vitnode/core",
    });

    await drain();
    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    await drain();

    expect(handler).not.toHaveBeenCalled();
    expect(rows()[0]).toMatchObject({
      attempts: 1,
      completedAt: NOW,
      lastError:
        "Invalid payload: payload.fileId: invalid_type (expected number)",
      payload: { fileId: SECRET },
      status: "failed",
    });
  });

  it("retries a throwing handler with backoff, then fails it at maxAttempts", async () => {
    const task = buildQueueTask({
      pluginId: "@vitnode/notes",
      name: "flaky",
      payload: z.object({}),
      maxAttempts: 2,
      handler: () => {
        throw new Error("upstream down");
      },
    });
    const { drain, queue, rows } = setup([task]);
    await queue.dispatch(task, {});

    await drain();
    expect(rows()[0]).toMatchObject({
      attempts: 1,
      availableAt: new Date(NOW.getTime() + 10_000),
      lastError: "upstream down",
      status: "pending",
    });

    await drain();
    expect(rows()[0].attempts).toBe(1);

    const retryAt = new Date(NOW.getTime() + 10_000);
    vi.setSystemTime(retryAt);
    await drain();
    expect(rows()[0]).toMatchObject({
      attempts: 2,
      completedAt: retryAt,
      lastError: "upstream down",
      status: "failed",
    });
  });

  it("defers a task without using up an attempt", async () => {
    const until = new Date(NOW.getTime() + 5 * 60 * 1000);
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new QueueDeferError(until, "rate limited"))
      .mockResolvedValueOnce(undefined);
    const task = buildQueueTask({
      pluginId: "@vitnode/notes",
      name: "deferred",
      payload: z.object({}),
      handler,
    });
    const { drain, queue, rows } = setup([task]);
    await queue.dispatch(task, {});

    await drain();
    expect(rows()[0]).toMatchObject({
      attempts: 0,
      availableAt: until,
      completedAt: null,
      lastError: "rate limited",
      status: "pending",
    });

    vi.setSystemTime(until);
    await drain();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(rows()[0]).toMatchObject({ attempts: 1, status: "completed" });
  });

  it("retries a row whose task is not registered", async () => {
    const { drain, memory, rows } = setup([]);
    await memory.db.insert(core_queue).values({
      name: "gone",
      pluginId: "@vitnode/notes",
    });

    await drain();

    expect(rows()[0]).toMatchObject({
      attempts: 1,
      lastError: 'No handler registered for queue task "@vitnode/notes:gone"',
      status: "pending",
    });
  });

  it("enqueues nothing when the transaction it was dispatched in rolls back", async () => {
    const task = buildQueueTask({
      pluginId: "@vitnode/notes",
      name: "after-write",
      payload: z.object({}),
      handler: () => undefined,
    });
    const { memory, queue, rows } = setup([task]);

    await expect(
      memory.db.transaction(async tx => {
        await queue.dispatch(task, {}, { tx: tx as never });
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");
    expect(rows()).toHaveLength(0);

    await memory.db.transaction(async tx => {
      await queue.dispatch(task, {}, { tx: tx as never });
    });
    expect(rows()).toHaveLength(1);
  });
});

describe("rows stored before typed queue tasks", () => {
  const intent = {
    actorId: 1,
    contentTypeId: "blog.post",
    itemId: "12",
    ruleIds: ["first-publication"],
    trigger: "firstPublication",
    v: 1,
  };

  it.each<[AnyTask, Record<string, unknown>]>([
    [altGenerateQueueTask, { fileId: 5 }],
    [rebuildSearchIndexTask, {}],
    [rebuildSearchIndexTask, { itemType: "blog.post" }],
    [
      sendEmailQueueTask,
      { html: "<p>Hi</p>", subject: "Hi", text: "Hi", to: "a@b.com" },
    ],
    [notificationsFanoutTask, { eventId: 9 }],
    [notificationsEmailTask, {}],
    [notificationsCleanupTask, {}],
    [contentNotificationsQueueTask, intent],
    [
      contentNotificationsQueueTask,
      {
        ...intent,
        decision: "approved",
        submissionId: 3,
        trigger: "moderationDecision",
      },
    ],
    [
      contentNotificationsQueueTask,
      { contentTypeId: "blog.post", itemId: "12", trigger: "deleted", v: 1 },
    ],
    [contentScheduleQueueTask, { generation: 2, scheduleId: 7 }],
    [
      contentScheduleEffectsQueueTask,
      {
        changedFields: [],
        contentTypeId: "blog.post",
        itemId: 12,
        operation: "publish",
        pluginId: "@vitnode/blog",
        previousSlug: null,
        revisionId: 4,
        row: { id: 12, publishedAt: NOW.toISOString(), tags: ["a"] },
        scheduleId: 7,
        scheduledBy: null,
        version: 3,
        wasPublic: false,
      },
    ],
    [
      contentSearchDependentsQueueTask,
      {
        after: 40,
        contentTypeId: "blog.post",
        dependentTypeId: "blog.comment",
        field: "post",
        itemId: 12,
      },
    ],
  ])("%# runs %s", async (task, payload) => {
    const handler = vi.fn();
    const { drain, memory, rows } = setup([{ ...task, handler }]);
    await memory.db.insert(core_queue).values({
      name: task.name,
      payload,
      pluginId: task.pluginId,
    });

    await drain();

    expect(rows()[0]).toMatchObject({ lastError: null, status: "completed" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
