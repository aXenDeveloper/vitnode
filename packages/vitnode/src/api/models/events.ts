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
  "role.created": {
    roleId: number;
  };
  /**
   * Declared for plugins implementing role deletion - core has no role
   * deletion flow yet and never emits this itself.
   */
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

/** A discriminated union of every registered event envelope. */
export type AnyEventEnvelope = {
  [K in VitNodeEventName]: EventEnvelope<K>;
}[VitNodeEventName];

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
   * delivery happens out-of-band. `failed` - the adapter could not publish the
   * event. For queued and failed events, `delivered`/`failures` do not describe
   * eventual listener execution.
   */
  status: "delivered" | "failed" | "queued";
}

/**
 * A pluggable event transport. The bundled Local adapter dispatches directly
 * to the listeners registered in `c.get("core").events.listeners`; a broker
 * adapter publishes the envelope and returns `status: "queued"`.
 */
export interface EventsAdapter {
  name: string;
  publish: (
    c: Context,
    envelope: AnyEventEnvelope,
  ) => Promise<EventEmitResult>;
}

export class EventsModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private adapter(): EventsAdapter {
    return this.c.get("core").events.adapter;
  }

  /**
   * Emit a typed domain event. Never throws: listener failures are caught,
   * logged to `core_logs`, and reported in the returned result. Emit only
   * AFTER the writes the event describes have committed - after your awaited
   * inserts/updates, and after any enclosing `db.transaction` callback has
   * returned.
   */
  async emit<K extends VitNodeEventName>(
    name: K,
    payload: VitNodeEvents[K],
  ): Promise<EventEmitResult> {
    const admin = this.c.get("admin");
    const user = this.c.get("user");
    const envelope: EventEnvelope<K> = {
      eventId: randomUUID(),
      name,
      payload,
      emittedAt: new Date(),
      pluginId: this.c.get("plugin")?.id ?? "@vitnode/core",
      actor: admin
        ? { type: "admin", id: admin.user.id }
        : user
          ? { type: "user", id: user.id }
          : { type: "system" },
    };
    const adapter = this.adapter();

    try {
      return await adapter.publish(this.c, envelope as AnyEventEnvelope);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.c
        .get("log")
        .error(
          `Events adapter "${adapter.name}" failed to publish "${name}": ${error}`,
        );

      return {
        eventId: envelope.eventId,
        status: "failed",
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
