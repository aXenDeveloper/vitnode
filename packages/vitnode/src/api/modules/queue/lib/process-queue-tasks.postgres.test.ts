import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { EnvVitNode } from "@/api/middlewares/global.middleware";
import type { PostgresTestSchema } from "@/tests/postgres";

import { buildQueueTask, QueueDeferError } from "@/api/lib/queue";
import { QueueModel } from "@/api/models/queue";
import { core_queue } from "@/database/queue";
import { createTestCache } from "@/tests/cache";
import { createPostgresTestSchema, POSTGRES_TEST_URL } from "@/tests/postgres";

import { processQueueTasks } from "./process-queue-tasks";

describe.skipIf(!POSTGRES_TEST_URL)("the queue on PostgreSQL", () => {
  let schema: PostgresTestSchema;
  const handler = vi.fn();

  const notesTask = buildQueueTask({
    pluginId: "@vitnode/notes",
    name: "reindex",
    payload: z.object({ noteId: z.number().int() }),
    handler,
  });
  const deferredHandler = vi.fn();
  const deferredTask = buildQueueTask({
    pluginId: "@vitnode/notes",
    name: "deferred",
    payload: z.object({}),
    handler: deferredHandler,
  });
  const blogTask = buildQueueTask({
    pluginId: "@vitnode/blog",
    name: "reindex",
    payload: z.object({ noteId: z.number().int() }),
    handler: () => undefined,
  });

  const context = () => {
    const values: Record<string, unknown> = {
      cache: createTestCache(),
      core: {
        queue: [notesTask, deferredTask, blogTask].map(task => ({
          ...task,
          module: "test",
        })),
      },
      db: schema.db,
      log: {
        debug: vi.fn().mockResolvedValue(undefined),
        error: vi.fn().mockResolvedValue(undefined),
        warn: vi.fn().mockResolvedValue(undefined),
      },
    };

    return {
      get: (key: string) => values[key],
    } as unknown as Context<EnvVitNode>;
  };

  const rowOf = async (id: null | number) => {
    const [row] = await schema.db
      .select()
      .from(core_queue)
      .where(eq(core_queue.id, id ?? -1));

    return row;
  };

  beforeAll(async () => {
    schema = await createPostgresTestSchema({ prefix: "vitnode_queue" });
  });

  afterAll(async () => {
    await schema.drop();
  });

  it("drops a duplicate only while the first is active, and only within one plugin", async () => {
    const queue = new QueueModel(context());
    const options = { dedupeKey: "note:1" };

    const first = await queue.dispatch(notesTask, { noteId: 1 }, options);
    const duplicate = await queue.dispatch(notesTask, { noteId: 1 }, options);
    const otherPlugin = await queue.dispatch(blogTask, { noteId: 1 }, options);

    expect(first.deduplicated).toBe(false);
    expect(duplicate).toEqual({ deduplicated: true, id: null });
    expect(otherPlugin.deduplicated).toBe(false);

    await processQueueTasks(context(), { lockKey: "queue-test:dedupe" });
    expect((await rowOf(first.id)).status).toBe("completed");

    const again = await queue.dispatch(notesTask, { noteId: 1 }, options);
    expect(again.deduplicated).toBe(false);
  });

  it("gives a deferred task its attempt back", async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000);
    deferredHandler.mockRejectedValueOnce(
      new QueueDeferError(until, "rate limited"),
    );
    const { id } = await new QueueModel(context()).dispatch(deferredTask, {});

    await processQueueTasks(context(), { lockKey: "queue-test:defer" });

    expect(await rowOf(id)).toMatchObject({
      attempts: 0,
      availableAt: until,
      lastError: "rate limited",
      status: "pending",
    });
  });
});
