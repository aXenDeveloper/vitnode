import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  buildQueueTask,
  QueuePayloadValidationError,
  QueueTaskRegistrationError,
} from "@/api/lib/queue";

import { QueueModel } from "./queue";

const coreTask = buildQueueTask({
  name: "do-something",
  payload: z.object({}),
  pluginId: "@vitnode/core",
  handler: () => undefined,
});

const scheduledTask = buildQueueTask({
  name: "scheduled",
  payload: z.object({
    at: z.iso.datetime().transform(value => new Date(value)),
    note: z.string().optional(),
  }),
  pluginId: "@vitnode/example",
  handler: () => undefined,
});

const knownTask = buildQueueTask({
  name: "known",
  payload: z.object({}),
  pluginId: "@vitnode/example",
  maxAttempts: 7,
  handler: () => undefined,
});

/** Records what was inserted, and through which handle. */
const harness = ({
  deduplicated = false,
  plugin,
}: { deduplicated?: boolean; plugin?: string } = {}) => {
  const inserts: { handle: string; values: Record<string, unknown> }[] = [];

  const handle = (name: string) => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            inserts.push({ handle: name, values });

            return await Promise.resolve(deduplicated ? [] : [{ id: 1 }]);
          },
        }),
      }),
    }),
  });

  const c = {
    get: (key: string) =>
      key === "db"
        ? handle("request")
        : key === "core"
          ? {
              queue: [coreTask, knownTask, scheduledTask].map(task => ({
                ...task,
                module: "test",
              })),
            }
          : key === "plugin"
            ? plugin
              ? { id: plugin }
              : undefined
            : undefined,
  } as unknown as Context;

  return { c, inserts, tx: handle("transaction") };
};

describe("QueueModel.dispatch", () => {
  it("stamps the task's plugin, not the requesting plugin's", async () => {
    // The case that makes scheduled publication work at all: a plugin's route
    // dispatches a task core owns. The worker resolves handlers by
    // `${pluginId}:${name}`, so the plugin's own id would leave the row
    // unclaimable forever.
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch(coreTask, {});

    expect(inserts[0].values.pluginId).toBe("@vitnode/core");
  });

  it("uses the request handle when no transaction is given", async () => {
    const { c, inserts } = harness();

    await new QueueModel(c).dispatch(coreTask, {});

    expect(inserts[0].handle).toBe("request");
  });

  it("joins a transaction when one is given", async () => {
    // Without this the queue row can commit while the row it points at rolls
    // back, and the task wakes up to find nothing there.
    const { c, inserts, tx } = harness();

    await new QueueModel(c).dispatch(coreTask, {}, { tx: tx as never });

    expect(inserts[0].handle).toBe("transaction");
  });

  it("still reads the registered task's maxAttempts", async () => {
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch(knownTask, {});

    expect(inserts[0].values.maxAttempts).toBe(7);
  });

  it("looks the task up under the plugin that defines it", async () => {
    const { c, inserts } = harness({ plugin: "@vitnode/example" });
    const coreKnown = buildQueueTask({
      name: "known",
      payload: z.object({}),
      pluginId: "@vitnode/core",
      handler: () => undefined,
    });

    await expect(new QueueModel(c).dispatch(coreKnown, {})).rejects.toThrow(
      QueueTaskRegistrationError,
    );
    expect(inserts).toHaveLength(0);
  });

  it("defaults availableAt to now, so a task runs on the next tick", async () => {
    const now = new Date("2026-08-05T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { c, inserts } = harness();
    await new QueueModel(c).dispatch(coreTask, {});

    expect(inserts[0].values.availableAt).toEqual(now);

    vi.useRealTimers();
  });

  it("stores the payload's JSON, not the schema's output", async () => {
    const { c, inserts } = harness();

    await new QueueModel(c).dispatch(scheduledTask, {
      at: "2026-11-11T10:00:00.000Z",
      note: undefined,
    });

    expect(inserts[0].values.payload).toEqual({
      at: "2026-11-11T10:00:00.000Z",
    });
  });

  it.each([
    ["the schema rejects it", { at: "tomorrow" }],
    ["it is not JSON", { at: new Date() }],
  ])("refuses a payload when %s, and enqueues nothing", async (_, payload) => {
    const { c, inserts } = harness();

    const dispatched = new QueueModel(c).dispatch(
      scheduledTask,
      payload as { at: string },
    );

    await expect(dispatched).rejects.toBeInstanceOf(
      QueuePayloadValidationError,
    );
    await expect(dispatched).rejects.toThrow(/invalid payload - payload\.at/);
    expect(inserts).toHaveLength(0);
  });

  it("refuses a different definition registered under the same name", async () => {
    const { c, inserts } = harness();
    const impostor = buildQueueTask({
      name: "known",
      payload: z.object({}),
      pluginId: "@vitnode/example",
      handler: () => undefined,
    });

    await expect(new QueueModel(c).dispatch(impostor, {})).rejects.toThrow(
      QueueTaskRegistrationError,
    );
    expect(inserts).toHaveLength(0);
  });

  it("writes the dispatch options onto the row", async () => {
    const { c, inserts } = harness();
    const availableAt = new Date("2026-12-01T00:00:00.000Z");

    await new QueueModel(c).dispatch(
      knownTask,
      {},
      {
        availableAt,
        dedupeKey: "known:1",
        maxAttempts: 2,
        priority: 5,
        queue: "ai",
      },
    );

    expect(inserts[0].values).toMatchObject({
      availableAt,
      dedupeKey: "known:1",
      maxAttempts: 2,
      name: "known",
      priority: 5,
      queue: "ai",
    });
  });

  it("reports a dispatch the dedupe key dropped", async () => {
    const { c } = harness({ deduplicated: true });

    await expect(
      new QueueModel(c).dispatch(knownTask, {}, { dedupeKey: "known:1" }),
    ).resolves.toEqual({ deduplicated: true, id: null });
  });
});
