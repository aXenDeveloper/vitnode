import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { EventDefinition } from "./event-definition";

import {
  collectEventDefinitions,
  defineEvent,
  EventDefinitionError,
} from "./event-definition";
import { buildEventListener } from "./events";

const noteArchived = defineEvent({
  pluginId: "@vitnode/notes",
  name: "notes.note.archived",
  payload: z.object({ noteId: z.number().int() }),
});

const listenerOf = (event: EventDefinition) =>
  buildEventListener({ event, name: "listener", handler: () => undefined });

describe("defineEvent", () => {
  it.each(["", " notes.archived", "notes archived", "x".repeat(201)])(
    "refuses the name %j",
    name => {
      expect(() =>
        defineEvent({
          pluginId: "@vitnode/notes",
          name,
          payload: z.object({}),
        }),
      ).toThrow(EventDefinitionError);
    },
  );
});

describe("collectEventDefinitions", () => {
  it("collects a definition once, however many times it is registered or listened to", () => {
    const definitions = collectEventDefinitions([
      {
        eventDefinitions: [noteArchived, noteArchived],
        events: [listenerOf(noteArchived)],
        pluginId: "@vitnode/notes",
      },
    ]);

    expect([...definitions]).toEqual([["notes.note.archived", noteArchived]]);
  });

  it("lets another plugin listen to a definition it does not own", () => {
    const definitions = collectEventDefinitions([
      { eventDefinitions: [noteArchived], pluginId: "@vitnode/notes" },
      { events: [listenerOf(noteArchived)], pluginId: "@vitnode/search" },
    ]);

    expect(definitions.get("notes.note.archived")).toBe(noteArchived);
  });

  it("refuses a plugin registering another plugin's definition", () => {
    expect(() =>
      collectEventDefinitions([
        { eventDefinitions: [noteArchived], pluginId: "@vitnode/search" },
      ]),
    ).toThrow(EventDefinitionError);
  });

  it.each([
    [
      "a second plugin",
      defineEvent({
        pluginId: "@vitnode/search",
        name: "notes.note.archived",
        payload: noteArchived.payload,
      }),
      "@vitnode/search",
    ],
    [
      "a different schema",
      defineEvent({
        pluginId: "@vitnode/notes",
        name: "notes.note.archived",
        payload: z.object({ noteId: z.string() }),
      }),
      "@vitnode/notes",
    ],
  ])(
    "refuses one name claimed by %s, registered or only listened to",
    (_, rival, owner) => {
      expect(() =>
        collectEventDefinitions([
          { eventDefinitions: [noteArchived], pluginId: "@vitnode/notes" },
          { eventDefinitions: [rival], pluginId: owner },
        ]),
      ).toThrow(EventDefinitionError);
      expect(() =>
        collectEventDefinitions([
          { eventDefinitions: [noteArchived], pluginId: "@vitnode/notes" },
          { events: [listenerOf(rival)], pluginId: "@vitnode/other" },
        ]),
      ).toThrow(
        /Two different definitions claim the event "notes\.note\.archived"/,
      );
    },
  );
});
