// @vitest-environment node
import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";

import type { EventListenerConfig } from "../lib/events";
import type { EventsApiPlugin } from "./events";

import { LocalEventsAdapter } from "../adapters/events/local";
import { EventsModel } from "./events";

const makeCtx = (
  overrides: {
    adapter?: EventsApiPlugin;
    admin?: { user: { id: number } };
    listeners?: EventListenerConfig[];
    plugin?: { id: string };
    user?: { id: number };
  } = {},
): {
  ctx: Context;
  logError: ReturnType<typeof vi.fn>;
} => {
  const logError = vi.fn().mockResolvedValue(undefined);
  const store: Record<string, unknown> = {
    admin: overrides.admin ?? null,
    core: {
      events: {
        adapter: overrides.adapter ?? LocalEventsAdapter(),
        listeners: overrides.listeners ?? [],
      },
    },
    log: { error: logError },
    plugin: overrides.plugin,
    user: overrides.user ?? null,
  };

  return {
    ctx: { get: (k: string) => store[k] } as unknown as Context,
    logError,
  };
};

const makeListener = (
  overrides: Partial<EventListenerConfig> = {},
): EventListenerConfig => ({
  event: "user.created",
  name: "listener",
  module: "users",
  pluginId: "@vitnode/core",
  handler: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const PAYLOAD = {
  userId: 1,
  email: "a@b.com",
  name: "Test",
  emailVerified: true,
};

describe("EventsModel.emit (Local adapter)", () => {
  it("runs only listeners matching the event, sequentially in registry order", async () => {
    const order: string[] = [];
    const first = makeListener({
      name: "first",
      handler: async () => {
        // Resolve on a later tick so a concurrent dispatch would flip the order.
        await new Promise(resolve => setTimeout(resolve, 5));
        order.push("first");
      },
    });
    const second = makeListener({
      name: "second",
      handler: () => {
        order.push("second");
      },
    });
    const other = makeListener({
      name: "other",
      event: "other.event" as EventListenerConfig["event"],
      handler: () => {
        order.push("other");
      },
    });
    const { ctx } = makeCtx({ listeners: [first, other, second] });

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(order).toEqual(["first", "second"]);
    expect(result.delivered).toBe(2);
    expect(result.failures).toEqual([]);
  });

  it("passes payload and envelope to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { ctx } = makeCtx({ listeners: [makeListener({ handler })] });

    await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(handler).toHaveBeenCalledWith(
      ctx,
      PAYLOAD,
      expect.objectContaining({ name: "user.created", payload: PAYLOAD }),
    );
  });

  it("a throwing listener does not stop the remaining listeners", async () => {
    const ran: string[] = [];
    const failing = makeListener({
      name: "failing",
      module: "posts",
      pluginId: "@vitnode/blog",
      handler: () => {
        throw new Error("boom");
      },
    });
    const after = makeListener({
      name: "after",
      handler: () => {
        ran.push("after");
      },
    });
    const { ctx, logError } = makeCtx({ listeners: [failing, after] });

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(ran).toEqual(["after"]);
    expect(result.delivered).toBe(1);
    expect(result.failures).toEqual([
      {
        pluginId: "@vitnode/blog",
        module: "posts",
        listener: "failing",
        error: "boom",
      },
    ]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toContain(
      '"@vitnode/blog:posts:failing"',
    );
  });

  it("resolves even when every listener throws", async () => {
    const listeners = [
      makeListener({
        name: "a",
        handler: () => {
          throw new Error("a failed");
        },
      }),
      makeListener({
        name: "b",
        handler: async () => Promise.reject(new Error("b failed")),
      }),
    ];
    const { ctx } = makeCtx({ listeners });

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(result.delivered).toBe(0);
    expect(result.failures).toHaveLength(2);
    expect(result.status).toBe("delivered");
  });

  it("returns an empty result when no listeners match", async () => {
    const { ctx } = makeCtx();

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(result).toMatchObject({
      delivered: 0,
      failures: [],
      status: "delivered",
    });
    expect(result.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("EventsModel.emit envelope", () => {
  const captureEnvelope = () => {
    const publish = vi.fn().mockResolvedValue({
      eventId: "x",
      status: "delivered",
      delivered: 0,
      failures: [],
    });

    return { adapter: { name: "capture", publish }, publish };
  };

  it("stamps eventId, emittedAt and defaults pluginId to @vitnode/core", async () => {
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter });

    await new EventsModel(ctx).emit("user.created", PAYLOAD);

    const envelope = publish.mock.calls[0][1];
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(envelope.emittedAt).toBeInstanceOf(Date);
    expect(envelope.pluginId).toBe("@vitnode/core");
  });

  it("uses the emitting plugin id from context", async () => {
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter, plugin: { id: "@vitnode/blog" } });

    await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(publish.mock.calls[0][1].pluginId).toBe("@vitnode/blog");
  });

  it("derives the actor: admin wins over user, then user, then system", async () => {
    const { adapter, publish } = captureEnvelope();

    const { ctx: adminCtx } = makeCtx({
      adapter,
      admin: { user: { id: 7 } },
      user: { id: 3 },
    });
    await new EventsModel(adminCtx).emit("user.created", PAYLOAD);
    expect(publish.mock.calls[0][1].actor).toEqual({ type: "admin", id: 7 });

    const { ctx: userCtx } = makeCtx({ adapter, user: { id: 3 } });
    await new EventsModel(userCtx).emit("user.created", PAYLOAD);
    expect(publish.mock.calls[1][1].actor).toEqual({ type: "user", id: 3 });

    const { ctx: systemCtx } = makeCtx({ adapter });
    await new EventsModel(systemCtx).emit("user.created", PAYLOAD);
    expect(publish.mock.calls[2][1].actor).toEqual({ type: "system" });
  });
});

describe("EventsModel adapter seam", () => {
  it("delegates to the configured adapter and passes its result through", async () => {
    const publish = vi.fn().mockResolvedValue({
      eventId: "broker-id",
      status: "queued",
      delivered: 0,
      failures: [],
    });
    const { ctx } = makeCtx({ adapter: { name: "broker", publish } });

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("queued");
  });

  it("never throws when the adapter itself fails; logs and reports it", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("broker down"));
    const { ctx, logError } = makeCtx({
      adapter: { name: "broker", publish },
    });

    const result = await new EventsModel(ctx).emit("user.created", PAYLOAD);

    expect(result.delivered).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].error).toBe("broker down");
    expect(logError).toHaveBeenCalledTimes(1);
  });
});
