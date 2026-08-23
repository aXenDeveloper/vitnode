import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type { EventListenerConfig } from "../lib/events";

/**
 * Global map of domain events emittable via `c.get("events").emit(...)`. Core
 * events are declared here; plugins extend the map with module augmentation:
 *
 * ```ts
 * declare module "@vitnode/core/api/models/events" {
 *   interface VitNodeEvents {
 *     "blog.post.created": { categoryId: number; postId: number };
 *   }
 * }
 * ```
 *
 * Payloads must stay JSON-serializable - a broker adapter (Redis Streams,
 * NATS, ...) serializes the envelope to move it between processes.
 */
export interface VitNodeEvents {
  "file.uploaded": {
    fileId: number;
    folder: string;
    mimeType: null | string;
    name: string;
    size: number;
    userId: number;
  };
  "role.created": {
    roleId: number;
  };
  "role.deleted": {
    roleId: number;
  };
  "role.updated": {
    roleId: number;
  };
  "user.created": {
    email: string;
    emailVerified: boolean;
    name: string;
    userId: number;
  };
  /**
   * Declared for plugins implementing account deletion - core has no user
   * deletion flow yet and never emits this itself.
   */
  "user.deleted": {
    email: string;
    userId: number;
  };
  "user.updated": {
    email: string;
    name: string;
    userId: number;
  };
}

export type VitNodeEventName = keyof VitNodeEvents;

export interface EventActor {
  id?: number;
  type: "admin" | "system" | "user";
}

export interface EventEnvelope<K extends VitNodeEventName = VitNodeEventName> {
  actor: EventActor;
  emittedAt: Date;
  eventId: string;
  name: K;
  payload: VitNodeEvents[K];
  /** Plugin that emitted the event. */
  pluginId: string;
}

export interface EventEmitFailure {
  error: string;
  /** Listener `name` as declared in `buildEventListener`. */
  listener: string;
  module: string;
  /** Plugin that owns the failing listener. */
  pluginId: string;
}

export interface EventEmitResult {
  /** Listeners that ran successfully before `emit()` resolved. */
  delivered: number;
  eventId: string;
  failures: EventEmitFailure[];
  /**
   * `delivered` - listeners ran in-process before `emit()` resolved (the
   * bundled Local adapter). `queued` - the envelope was handed to a broker and
   * delivery happens out-of-band; `delivered`/`failures` say nothing about the
   * eventual listener runs.
   */
  status: "delivered" | "queued";
}

/**
 * A pluggable event transport. The bundled Local adapter dispatches directly
 * to the listeners registered in `c.get("core").events.listeners`; a broker
 * adapter publishes the envelope and returns `status: "queued"`.
 */
export interface EventsApiPlugin {
  name: string;
  publish: (c: Context, envelope: EventEnvelope) => Promise<EventEmitResult>;
}

export interface EventEmitOptions {
  /**
   * Who owns the *domain event*, when that is not the plugin handling the
   * request.
   *
   * Ownership normally comes from `c.get("plugin")`, which is right for a route:
   * whoever handled the request emitted the event. It is wrong for anything that
   * runs on someone else's behalf. A queue handler is the clear case - core owns
   * the handler, so the context says `@vitnode/core`, but a scheduled
   * `content.example.article.published` is the example plugin's event and always
   * was.
   *
   * Pass it explicitly rather than swapping `c.get("plugin")` for the duration.
   * The context is shared with the logger, the permission checks and every other
   * model on the request; impersonating a plugin inside it would change all of
   * them to fix one field.
   */
  pluginId?: string;
}

export class EventsModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private adapter(): EventsApiPlugin {
    return this.c.get("core").events.adapter;
  }

  /**
   * Emit a typed domain event. Never throws: listener failures are caught,
   * logged to `core_logs`, and reported in the returned result. Emit only
   * AFTER the writes the event describes have committed - after your awaited
   * inserts/updates, and after any enclosing `db.transaction` callback has
   * returned.
   *
   * **Not throwing is the contract, not an oversight.** An interactive mutation
   * has already committed by the time this runs, and a listener that fell over
   * is not a reason to tell the person their save failed. A caller that *does*
   * need delivery to be retried - the scheduled-effects task is the one in
   * core - reads `failures` and decides for itself.
   */
  async emit<K extends VitNodeEventName>(
    name: K,
    payload: VitNodeEvents[K],
    options?: EventEmitOptions,
  ): Promise<EventEmitResult> {
    const admin = this.c.get("admin");
    const user = this.c.get("user");
    const envelope: EventEnvelope<K> = {
      eventId: randomUUID(),
      name,
      payload,
      emittedAt: new Date(),
      pluginId:
        options?.pluginId ?? this.c.get("plugin")?.id ?? "@vitnode/core",
      actor: admin
        ? { type: "admin", id: admin.user.id }
        : user
          ? { type: "user", id: user.id }
          : { type: "system" },
    };
    const adapter = this.adapter();

    try {
      return await adapter.publish(this.c, envelope);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.c
        .get("log")
        .error(
          `Events adapter "${adapter.name}" failed to publish "${name}": ${error}`,
        );

      return {
        eventId: envelope.eventId,
        status: "delivered",
        delivered: 0,
        failures: [
          {
            pluginId: envelope.pluginId,
            module: "adapter",
            listener: adapter.name,
            error,
          },
        ],
      };
    }
  }

  name(): string {
    return this.adapter().name;
  }
}

export type { EventListenerConfig };
