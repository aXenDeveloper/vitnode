import type { Context } from "hono";

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { EventDefinition } from "../lib/event-definition";
import type { EventListenerConfig } from "../lib/events";
import type { EventsApiPlugin } from "./events";

import { LocalEventsAdapter } from "../adapters/events/local";
import { moderationSanctionAppliedEvent } from "../events/moderation";
import { userCreatedEvent } from "../events/users";
import {
  defineEvent,
  EventDefinitionError,
  EventPayloadValidationError,
} from "../lib/event-definition";
import { buildEventListener } from "../lib/events";
import { EventsModel } from "./events";

const makeCtx = (
  overrides: {
    adapter?: EventsApiPlugin;
    admin?: { user: { id: number } };
    definitions?: Map<string, EventDefinition>;
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
        definitions: overrides.definitions,
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
  definition: userCreatedEvent,
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
    const otherEvent = defineEvent({
      pluginId: "@vitnode/core",
      name: "other.event",
      payload: z.object({}),
    });
    const other = makeListener({
      name: "other",
      definition: otherEvent,
      event: otherEvent.name,
      handler: () => {
        order.push("other");
      },
    });
    const { ctx } = makeCtx({ listeners: [first, other, second] });

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    expect(order).toEqual(["first", "second"]);
    expect(result.delivered).toBe(2);
    expect(result.failures).toEqual([]);
  });

  it("passes payload and envelope to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const { ctx } = makeCtx({ listeners: [makeListener({ handler })] });

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

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

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

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

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    expect(result.delivered).toBe(0);
    expect(result.failures).toHaveLength(2);
    expect(result.status).toBe("delivered");
  });

  it("returns an empty result when no listeners match", async () => {
    const { ctx } = makeCtx();

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

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

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    const envelope = publish.mock.calls[0][1];
    expect(envelope.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(envelope.emittedAt).toBeInstanceOf(Date);
    expect(envelope.pluginId).toBe("@vitnode/core");
  });

  it("uses the emitting plugin id from context", async () => {
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter, plugin: { id: "@vitnode/blog" } });

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    expect(publish.mock.calls[0][1].pluginId).toBe("@vitnode/blog");
  });

  it("an explicit owner wins over the context plugin", async () => {
    // The queue case: core owns the handler, so the context says core, but the
    // domain event belongs to whoever owns the thing it happened to.
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter, plugin: { id: "@vitnode/core" } });

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD, {
      pluginId: "@vitnode/example",
    });

    expect(publish.mock.calls[0][1].pluginId).toBe("@vitnode/example");
  });

  it("an omitted override changes nothing for existing callers", async () => {
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter, plugin: { id: "@vitnode/blog" } });

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD, {});

    expect(publish.mock.calls[0][1].pluginId).toBe("@vitnode/blog");
  });

  it("does not impersonate the plugin on the shared context", async () => {
    // Overriding by swapping `c.get("plugin")` would change the logger, the
    // permission checks and every other model on the request to fix one field.
    const { adapter, publish } = captureEnvelope();
    const { ctx } = makeCtx({ adapter, plugin: { id: "@vitnode/core" } });

    await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD, {
      pluginId: "@vitnode/example",
    });

    expect(publish.mock.calls[0][1].pluginId).toBe("@vitnode/example");
    expect(ctx.get("plugin").id).toBe("@vitnode/core");
  });

  it("derives the actor: admin wins over user, then user, then system", async () => {
    const { adapter, publish } = captureEnvelope();

    const { ctx: adminCtx } = makeCtx({
      adapter,
      admin: { user: { id: 7 } },
      user: { id: 3 },
    });
    await new EventsModel(adminCtx).emit(userCreatedEvent, PAYLOAD);
    expect(publish.mock.calls[0][1].actor).toEqual({ type: "admin", id: 7 });

    const { ctx: userCtx } = makeCtx({ adapter, user: { id: 3 } });
    await new EventsModel(userCtx).emit(userCreatedEvent, PAYLOAD);
    expect(publish.mock.calls[1][1].actor).toEqual({ type: "user", id: 3 });

    const { ctx: systemCtx } = makeCtx({ adapter });
    await new EventsModel(systemCtx).emit(userCreatedEvent, PAYLOAD);
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

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("queued");
  });

  it("never throws when the adapter itself fails; logs and reports it", async () => {
    const publish = vi.fn().mockRejectedValue(new Error("broker down"));
    const { ctx, logError } = makeCtx({
      adapter: { name: "broker", publish },
    });

    const result = await new EventsModel(ctx).emit(userCreatedEvent, PAYLOAD);

    expect(result.delivered).toBe(0);
    expect(result.failures).toEqual([
      {
        error: "broker down",
        listener: "broker",
        module: "adapter",
        pluginId: "@vitnode/core",
      },
    ]);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

describe("EventsModel.emit validation", () => {
  const SECRET = "s3cret@example.com";

  it("rejects an invalid payload before the adapter or any listener sees it", async () => {
    const handler = vi.fn();
    const publish = vi.fn();
    const { ctx } = makeCtx({
      adapter: { name: "capture", publish },
      listeners: [makeListener({ handler })],
    });

    const emitted = new EventsModel(ctx).emit(userCreatedEvent, {
      ...PAYLOAD,
      email: SECRET,
      userId: SECRET,
    } as unknown as typeof PAYLOAD);

    await expect(emitted).rejects.toBeInstanceOf(EventPayloadValidationError);
    await expect(emitted).rejects.not.toThrow(SECRET);
    expect(publish).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the schema once and hands its output to the adapter and listeners", async () => {
    const transform = vi.fn((points: number) => points * 10);
    const scored = defineEvent({
      pluginId: "@vitnode/core",
      name: "test.scored",
      payload: z.object({ points: z.number().transform(transform) }),
    });
    const received: unknown[] = [];
    const listener = (name: string) => ({
      ...buildEventListener({
        event: scored,
        name,
        handler: (_c, payload, envelope) => {
          received.push(payload, envelope.payload);
        },
      }),
      module: "test",
      pluginId: "@vitnode/core",
    });
    const { ctx } = makeCtx({ listeners: [listener("a"), listener("b")] });

    await new EventsModel(ctx).emit(scored, { points: 2 });

    expect(transform).toHaveBeenCalledTimes(1);
    expect(received).toEqual([
      { points: 20 },
      { points: 20 },
      { points: 20 },
      { points: 20 },
    ]);
  });

  it("delivers to a listener another plugin registered for this plugin's event", async () => {
    const noteArchived = defineEvent({
      pluginId: "@vitnode/notes",
      name: "notes.note.archived",
      payload: z.object({ noteId: z.number().int() }),
    });
    const handler = vi.fn();
    const { ctx } = makeCtx({
      definitions: new Map([[noteArchived.name, noteArchived]]),
      listeners: [
        {
          ...buildEventListener({
            event: noteArchived,
            name: "reindex",
            handler,
          }),
          module: "search",
          pluginId: "@vitnode/search",
        },
      ],
      plugin: { id: "@vitnode/notes" },
    });

    const result = await new EventsModel(ctx).emit(noteArchived, { noteId: 4 });

    expect(result).toMatchObject({ delivered: 1, failures: [] });
    expect(handler).toHaveBeenCalledWith(
      ctx,
      { noteId: 4 },
      expect.objectContaining({ pluginId: "@vitnode/notes" }),
    );
  });

  it("refuses a definition that differs from the one registered under its name", async () => {
    const rival = defineEvent({
      pluginId: "@vitnode/core",
      name: userCreatedEvent.name,
      payload: z.object({}),
    });
    const handler = vi.fn();
    const { ctx } = makeCtx({
      definitions: new Map([[userCreatedEvent.name, userCreatedEvent]]),
      listeners: [makeListener({ handler })],
    });

    await expect(new EventsModel(ctx).emit(rival, {})).rejects.toBeInstanceOf(
      EventDefinitionError,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("sends a date as an ISO string and delivers it as a Date", async () => {
    const handler = vi.fn();
    const { ctx } = makeCtx({
      listeners: [
        makeListener({
          definition: moderationSanctionAppliedEvent,
          event: moderationSanctionAppliedEvent.name,
          handler,
        }),
      ],
    });
    const sanction = {
      sanctionId: 1,
      source: "manual",
      thresholdId: null,
      type: "suspension",
      userId: 2,
      warningId: null,
    } as const;

    await new EventsModel(ctx).emit(moderationSanctionAppliedEvent, {
      ...sanction,
      endsAt: "2026-12-01T00:00:00.000Z",
    });
    const rejected = new EventsModel(ctx).emit(moderationSanctionAppliedEvent, {
      ...sanction,
      endsAt: new Date() as unknown as string,
    });

    expect(handler.mock.calls[0][1]).toEqual({
      ...sanction,
      endsAt: new Date("2026-12-01T00:00:00.000Z"),
    });
    await expect(rejected).rejects.toThrow(/payload\.endsAt is a Date/);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
