import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import { QueueModel } from "./queue";

const makeCtx = (
  overrides: {
    plugin?: { id: string };
    queue?: { maxAttempts?: number; name: string; pluginId: string }[];
  } = {},
): {
  ctx: Context;
  values: ReturnType<typeof vi.fn>;
} => {
  const values = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  });
  const store: Record<string, unknown> = {
    db: { insert: vi.fn().mockReturnValue({ values }) },
    core: { queue: overrides.queue ?? [] },
    plugin: overrides.plugin,
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    values,
  };
};

describe("QueueModel.dispatch", () => {
  it("uses the explicit maxAttempts when provided", async () => {
    const { ctx, values } = makeCtx({
      queue: [{ name: "job", pluginId: "@vitnode/core", maxAttempts: 5 }],
    });

    await new QueueModel(ctx).dispatch({ name: "job", maxAttempts: 7 });

    expect(values.mock.calls[0][0]).toMatchObject({ maxAttempts: 7 });
  });

  it("falls back to the registered task maxAttempts", async () => {
    const { ctx, values } = makeCtx({
      queue: [{ name: "job", pluginId: "@vitnode/core", maxAttempts: 5 }],
    });

    await new QueueModel(ctx).dispatch({ name: "job" });

    expect(values.mock.calls[0][0]).toMatchObject({ maxAttempts: 5 });
  });

  it("defaults to 3 when the registered task has no maxAttempts", async () => {
    const { ctx, values } = makeCtx({
      queue: [{ name: "job", pluginId: "@vitnode/core" }],
    });

    await new QueueModel(ctx).dispatch({ name: "job" });

    expect(values.mock.calls[0][0]).toMatchObject({ maxAttempts: 3 });
  });

  it("defaults to 3 when the task is not registered", async () => {
    const { ctx, values } = makeCtx({ queue: [] });

    await new QueueModel(ctx).dispatch({ name: "job" });

    expect(values.mock.calls[0][0]).toMatchObject({ maxAttempts: 3 });
  });

  it("scopes the task lookup by pluginId", async () => {
    const { ctx, values } = makeCtx({
      plugin: { id: "@vitnode/blog" },
      queue: [
        { name: "job", pluginId: "@vitnode/core", maxAttempts: 5 },
        { name: "job", pluginId: "@vitnode/blog", maxAttempts: 9 },
      ],
    });

    await new QueueModel(ctx).dispatch({ name: "job" });

    expect(values.mock.calls[0][0]).toMatchObject({
      pluginId: "@vitnode/blog",
      maxAttempts: 9,
    });
  });
});
