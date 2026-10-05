import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type { NavigationLocation } from "@/lib/navigation";
import type { SsoProfileField } from "@/lib/sso-profile";

import type { EventListenerConfig } from "../lib/events";

export interface VitNodeEvents {
  "core.page-layout.updated": {
    changedZones: string[];
    pageId: string;
  };
  "navigation.created": {
    navigationId: number;
  };
  "navigation.deleted": {
    navigationId: number;
  };
  "navigation.reordered": {
    items: { children: number[]; id: number }[];
    location: NavigationLocation;
  };
  "navigation.updated": {
    navigationId: number;
  };
  "notifications.deleted_all": {
    items: number;
  };
  "notifications.emails_cancelled": {
    count: number;
  };
  "notifications.paused": Record<string, never>;
  "notifications.preferences_reset": {
    members: number;
  };
  "notifications.preferences_updated": {
    typeIds: string[];
    userId: number;
  };
  "notifications.read_all": {
    items: number;
    members: number;
  };
  "notifications.resumed": {
    requeuedEvents: number;
  };
  "notifications.type.updated": {
    typeId: string;
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
  "user.avatar.updated": {
    fileId: null | number;
    userId: number;
  };
  "user.cover.updated": {
    fileId: null | number;
    userId: number;
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
  "user.passkey.created": {
    passkeyId: number;
    userId: number;
  };
  "user.passkey.deleted": {
    passkeyId: number;
    userId: number;
  };
  "user.passkey.updated": {
    name: string;
    passkeyId: number;
    userId: number;
  };
  "user.password.updated": {
    userId: number;
  };
  "user.sessions.revoked": {
    deviceId: null | number;
    sessions: number;
    userId: number;
  };
  "user.sso.linked": {
    email: string;
    providerId: string;
    userId: number;
  };
  "user.sso.preferences_updated": {
    sources: Partial<Record<SsoProfileField, null | string>>;
    sync: Record<string, boolean>;
    userId: number;
  };
  "user.sso.profile_synced": {
    fields: SsoProfileField[];
    providerId: string;
    trigger: "import" | "sign_in" | "sync";
    userId: number;
  };
  "user.sso.unlinked": {
    providerId: string;
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

  status: "delivered" | "queued";
}

export interface EventsApiPlugin {
  name: string;
  publish: (c: Context, envelope: EventEnvelope) => Promise<EventEmitResult>;
}

export interface EventEmitOptions {
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
