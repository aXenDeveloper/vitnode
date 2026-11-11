import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { QueueTaskInput, QueueTaskPayload } from "@/api/lib/queue";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { bindApiPlugin } from "@/api/lib/bind-api-plugin";
import { buildQueueTask } from "@/api/lib/queue";
import { testManifest } from "@/tests/manifest";

declare const c: Context<EnvVitNode>;

const { buildQueueTask: buildNotesTask } = bindApiPlugin(
  testManifest("@vitnode/notes"),
);

const remindTask = buildNotesTask({
  name: "remind",
  payload: z.object({
    at: z.iso.datetime().transform(value => new Date(value)),
    noteId: z.number().int(),
  }),
  handler: (_c, payload) => {
    expectTypeOf(payload).toEqualTypeOf<{ at: Date; noteId: number }>();
  },
});

describe("typed queue tasks", () => {
  it("dispatches the schema's input and hands the handler its output", () => {
    expectTypeOf<QueueTaskInput<typeof remindTask>>().toEqualTypeOf<{
      at: string;
      noteId: number;
    }>();
    expectTypeOf<QueueTaskPayload<typeof remindTask>>().toEqualTypeOf<{
      at: Date;
      noteId: number;
    }>();
    expectTypeOf(remindTask.pluginId).toEqualTypeOf<"@vitnode/notes">();
    expectTypeOf(remindTask.name).toEqualTypeOf<"remind">();
  });

  it("type-checks the payload at the dispatch", async () => {
    const queue = c.get("queue");

    await queue.dispatch(remindTask, { at: "2026-11-11T10:00:00Z", noteId: 1 });
    await queue.dispatch(
      remindTask,
      // @ts-expect-error - the wire takes an ISO string, not a Date
      { at: new Date(), noteId: 1 },
    );
    await queue.dispatch(
      remindTask,
      // @ts-expect-error - noteId is required
      { at: "2026-11-11T10:00:00Z" },
    );
    await queue.dispatch(
      remindTask,
      // @ts-expect-error - noteId is a number
      { at: "2026-11-11T10:00:00Z", noteId: "1" },
    );
    // @ts-expect-error - the payload is required
    await queue.dispatch(remindTask);
  });

  it("no longer dispatches by name", async () => {
    // @ts-expect-error - dispatch takes a task definition, not { name, payload }
    await c.get("queue").dispatch({ name: "remind", payload: { noteId: 1 } });
    // @ts-expect-error - nor a bare name
    await c.get("queue").dispatch("remind", { noteId: 1 });
  });

  it("requires a JSON object payload schema on every task", () => {
    // @ts-expect-error - a task without a payload schema
    buildNotesTask({ name: "legacy", handler: () => undefined });
    // @ts-expect-error - the unbound builder needs a payload schema too
    buildQueueTask({
      name: "legacy",
      pluginId: "@vitnode/notes",
      handler: () => undefined,
    });
    buildNotesTask({
      name: "dated",
      // @ts-expect-error - a Date does not survive the JSON row
      payload: z.object({ at: z.date() }),
      handler: () => undefined,
    });
    buildNotesTask({
      name: "list",
      // @ts-expect-error - the payload must be an object
      payload: z.array(z.number()),
      handler: () => undefined,
    });
  });
});
