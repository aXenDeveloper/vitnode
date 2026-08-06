// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { QueueModel } from "./queue";

/** Records what was inserted, and through which handle. */
const harness = ({ plugin }: { plugin?: string } = {}) => {
  const inserts: { handle: string; values: Record<string, unknown> }[] = [];

  const handle = (name: string) => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          inserts.push({ handle: name, values });

          return await Promise.resolve([{ id: 1 }]);
        },
      }),
    }),
  });

  const c = {
    get: (key: string) =>
      key === "db"
        ? handle("request")
        : key === "core"
          ? { queue: [{ maxAttempts: 7, name: "known", pluginId: plugin }] }
          : key === "plugin"
            ? plugin
              ? { id: plugin }
              : undefined
            : undefined,
  } as unknown as Context;

  return { c, inserts, tx: handle("transaction") };
};

describe("QueueModel.dispatch", () => {
  it("stamps the requesting plugin by default", async () => {
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch({ name: "do-something" });

    expect(inserts[0].values.pluginId).toBe("@vitnode/example");
  });

  it("falls back to core when no plugin is handling the request", async () => {
    const { c, inserts } = harness();

    await new QueueModel(c).dispatch({ name: "do-something" });

    expect(inserts[0].values.pluginId).toBe("@vitnode/core");
  });

  it("stamps an explicit plugin instead", async () => {
    // The case that makes scheduled publication work at all: a plugin's route
    // dispatches a task core owns. The worker resolves handlers by
    // `${pluginId}:${name}`, so the plugin's own id would leave the row
    // unclaimable forever.
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch({
      name: "content-schedule",
      pluginId: "@vitnode/core",
    });

    expect(inserts[0].values.pluginId).toBe("@vitnode/core");
  });

  it("uses the request handle when no transaction is given", async () => {
    const { c, inserts } = harness();

    await new QueueModel(c).dispatch({ name: "do-something" });

    expect(inserts[0].handle).toBe("request");
  });

  it("joins a transaction when one is given", async () => {
    // Without this the queue row can commit while the row it points at rolls
    // back, and the task wakes up to find nothing there.
    const { c, inserts, tx } = harness();

    await new QueueModel(c).dispatch({
      name: "do-something",
      tx: tx as never,
    });

    expect(inserts[0].handle).toBe("transaction");
  });

  it("still reads the registered task's maxAttempts", async () => {
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch({ name: "known" });

    expect(inserts[0].values.maxAttempts).toBe(7);
  });

  it("looks the task up under the plugin it is dispatched for", async () => {
    // `known` is registered under `@vitnode/example`, so dispatching it as core
    // finds no registration and falls back to the default.
    const { c, inserts } = harness({ plugin: "@vitnode/example" });

    await new QueueModel(c).dispatch({
      name: "known",
      pluginId: "@vitnode/core",
    });

    expect(inserts[0].values.maxAttempts).toBe(3);
  });

  it("defaults availableAt to now, so a task runs on the next tick", async () => {
    const now = new Date("2026-08-05T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const { c, inserts } = harness();
    await new QueueModel(c).dispatch({ name: "do-something" });

    expect(inserts[0].values.availableAt).toEqual(now);

    vi.useRealTimers();
  });
});
