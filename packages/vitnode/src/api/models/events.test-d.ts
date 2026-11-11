import type { Context } from "hono";

import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";

import type { moderationSanctionAppliedEvent } from "@/api/events/moderation";
import type { EventInput, EventPayload } from "@/api/lib/event-definition";
import type { EnvVitNode } from "@/api/middlewares/global.middleware";

import { roleCreatedEvent } from "@/api/events/roles";
import { bindApiPlugin } from "@/api/lib/bind-api-plugin";
import { buildEventListener } from "@/api/lib/events";
import { testManifest } from "@/tests/manifest";

declare const c: Context<EnvVitNode>;

const { defineEvent } = bindApiPlugin(testManifest("@vitnode/notes"));

const noteArchivedEvent = defineEvent({
  name: "notes.note.archived",
  payload: z.object({
    archivedAt: z.iso.datetime().transform(value => new Date(value)),
    noteId: z.number().int(),
  }),
});

describe("schema-defined events", () => {
  it("emits the schema's input and delivers its output", () => {
    expectTypeOf<EventInput<typeof noteArchivedEvent>>().toEqualTypeOf<{
      archivedAt: string;
      noteId: number;
    }>();
    expectTypeOf<EventPayload<typeof noteArchivedEvent>>().toEqualTypeOf<{
      archivedAt: Date;
      noteId: number;
    }>();
    expectTypeOf<
      EventInput<typeof moderationSanctionAppliedEvent>["endsAt"]
    >().toEqualTypeOf<null | string>();
    expectTypeOf<
      EventPayload<typeof moderationSanctionAppliedEvent>["endsAt"]
    >().toEqualTypeOf<Date | null>();
  });

  it("type-checks the payload at the emit", async () => {
    const events = c.get("events");

    await events.emit(noteArchivedEvent, {
      archivedAt: "2026-11-11T10:00:00Z",
      noteId: 1,
    });
    await events.emit(noteArchivedEvent, {
      // @ts-expect-error - the wire takes an ISO string, not a Date
      archivedAt: new Date(),
      noteId: 1,
    });
    // @ts-expect-error - noteId is required
    await events.emit(noteArchivedEvent, {
      archivedAt: "2026-11-11T10:00:00Z",
    });
  });

  it("no longer emits or listens by name", async () => {
    // @ts-expect-error - emit takes a definition, not an event name
    await c.get("events").emit("role.created", { roleId: 1 });
    buildEventListener({
      // @ts-expect-error - a listener takes a definition, not an event name
      event: "role.created",
      name: "by-name",
      handler: () => undefined,
    });
  });

  it("types a listener from the definition's output", () => {
    buildEventListener({
      event: noteArchivedEvent,
      name: "typed",
      handler: (_c, payload, envelope) => {
        expectTypeOf(payload).toEqualTypeOf<{
          archivedAt: Date;
          noteId: number;
        }>();
        expectTypeOf(envelope.payload).toEqualTypeOf(payload);
      },
    });
    buildEventListener({
      event: roleCreatedEvent,
      name: "wrong-field",
      handler: (_c, payload) => {
        // @ts-expect-error - role.created carries no noteId
        void payload.noteId;
      },
    });
  });

  it("requires a JSON object payload schema", () => {
    defineEvent({
      name: "notes.note.dated",
      // @ts-expect-error - a Date does not survive an external adapter
      payload: z.object({ at: z.date() }),
    });
  });
});
