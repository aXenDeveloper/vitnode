import type { z } from "zod";

import type { JsonWireObjectCheck } from "./json-wire";

/**
 * A schema-defined event: its name, owning plugin and payload schema, as
 * `defineEvent` returns it. Emit it with `c.get("events").emit(event, payload)`
 * and listen with `buildEventListener({ event, name, handler })`.
 */
export interface EventDefinition<
  Plugin extends string = string,
  Name extends string = string,
  Schema extends z.ZodType = z.ZodType,
> {
  readonly name: Name;
  readonly payload: Schema;
  readonly pluginId: Plugin;
}

/** What `emit(event, payload)` accepts: the schema's input. */
export type EventInput<Event extends EventDefinition> = z.input<
  Event["payload"]
>;

/**
 * What listeners receive: the schema's output. Use it to bridge a defined
 * event into `VitNodeEvents`, so string-named listeners see the same type.
 */
export type EventPayload<Event extends EventDefinition> = z.output<
  Event["payload"]
>;

/** What {@link defineEvent} takes. */
export interface EventDefinitionOptions<
  Plugin extends string,
  Name extends string,
  Schema extends z.ZodType,
> {
  /** The event name listeners match on, e.g. `"blog.post.deleted"`. Prefix it with your plugin. */
  name: Name;
  /**
   * Validates every emit before any listener runs; listeners get its output.
   * Its input must be a JSON object, so an external adapter can carry it.
   */
  payload: JsonWireObjectCheck<Schema> & Schema;
  /** The owning plugin's id. `bindApiPlugin(manifest).defineEvent` fills it in. */
  pluginId: Plugin;
}

const EVENT_NAME = /^[A-Za-z0-9][\w.:/@-]{0,199}$/;

/**
 * Thrown by `emit(event, payload)` when the payload is not JSON or the schema
 * rejects it. No listener ran and nothing reached the adapter. The message
 * names paths and issue codes, never values.
 */
export class EventPayloadValidationError extends Error {
  constructor(event: string, reason: string) {
    super(`Event "${event}" was not emitted: invalid payload - ${reason}`);
    this.name = "EventPayloadValidationError";
    this.event = event;
    this.reason = reason;
  }

  readonly event: string;
  readonly reason: string;
}

/**
 * Thrown when two different definitions claim one event name, when a plugin
 * registers another plugin's definition in `buildApiPlugin({ eventDefinitions })`,
 * or by `defineEvent` for an invalid name.
 */
export class EventDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventDefinitionError";
  }
}

/**
 * Declares an event with a payload schema. Emits are validated before any
 * listener runs, and listeners receive the schema's output.
 *
 * Use the plugin-bound `defineEvent` from your `src/api/builders.ts`, which
 * fills in `pluginId`. Keep definitions in their own file, free of handlers
 * and database code, so other plugins can import them to listen. Server-side.
 *
 * @throws {EventDefinitionError} For an invalid name.
 *
 * @example
 * ```ts
 * // src/api/events.ts
 * import { z } from "zod";
 *
 * import { defineEvent } from "@/api/builders";
 *
 * export const noteArchivedEvent = defineEvent({
 *   name: "site-notes.note.archived",
 *   payload: z.object({ noteId: z.number().int().positive() }),
 * });
 *
 * // in a route:
 * await c.get("events").emit(noteArchivedEvent, { noteId: 3 });
 * ```
 */
export const defineEvent = <
  const Plugin extends string,
  const Name extends string,
  Schema extends z.ZodType,
>({
  name,
  payload,
  pluginId,
}: EventDefinitionOptions<Plugin, Name, Schema>): EventDefinition<
  Plugin,
  Name,
  Schema
> => {
  if (!EVENT_NAME.test(name)) {
    throw new EventDefinitionError(
      `Event "${name}" of "${pluginId}": the name may use letters, digits and . _ - : / @, up to 200 characters.`,
    );
  }

  return Object.freeze({ name, payload, pluginId });
};

/** Whether a value is an event definition rather than an event name. */
export const isEventDefinition = (value: unknown): value is EventDefinition =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { name?: unknown }).name === "string" &&
  typeof (value as { pluginId?: unknown }).pluginId === "string" &&
  typeof (value as { payload?: { safeParseAsync?: unknown } }).payload
    ?.safeParseAsync === "function";

/**
 * Collects the event definitions an installation knows - registered with
 * `buildApiPlugin({ eventDefinitions })` or referenced by a typed listener -
 * keyed by name, without running anything. Two different definitions for one
 * name, or a plugin registering another plugin's definition, throw.
 *
 * @throws {EventDefinitionError}
 */
export const collectEventDefinitions = (
  plugins: readonly {
    eventDefinitions?: readonly EventDefinition[];
    events?: readonly { definition?: EventDefinition }[];
    pluginId: string;
  }[],
): Map<string, EventDefinition> => {
  const byName = new Map<string, EventDefinition>();
  const add = (definition: EventDefinition, where: string) => {
    const previous = byName.get(definition.name);
    if (previous === undefined) {
      byName.set(definition.name, definition);

      return;
    }
    if (
      previous.payload !== definition.payload ||
      previous.pluginId !== definition.pluginId
    ) {
      throw new EventDefinitionError(
        `Two different definitions claim the event "${definition.name}" (from "${previous.pluginId}" and "${definition.pluginId}", the second ${where}). Import the owning plugin's definition instead of defining it again, or rename one.`,
      );
    }
  };

  for (const plugin of plugins) {
    for (const definition of plugin.eventDefinitions ?? []) {
      if (definition.pluginId !== plugin.pluginId) {
        throw new EventDefinitionError(
          `Plugin "${plugin.pluginId}" registers the event "${definition.name}", which "${definition.pluginId}" defines. Register a definition only in its own plugin; listen to it with buildEventListener instead.`,
        );
      }
      add(definition, `registered by "${plugin.pluginId}"`);
    }
  }
  for (const plugin of plugins) {
    for (const listener of plugin.events ?? []) {
      if (listener.definition) {
        add(listener.definition, `used by a listener of "${plugin.pluginId}"`);
      }
    }
  }

  return byName;
};
