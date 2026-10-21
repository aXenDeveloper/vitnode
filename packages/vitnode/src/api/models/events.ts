import type { Context } from "hono";

import { randomUUID } from "node:crypto";

import type { SsoProfileField } from "@/lib/sso-profile";

import type { EventListenerConfig } from "../lib/events";

export interface ContentContainerEventPayload {
  containerId: number;
  definitionId: string;
  parentId: null | number;
  pluginId: string;
}

export interface ContentApprovalEventPayload {
  authorId: null | number;
  containerId: null | number;
  contentId: string;
  contentTypeId: string;
  kind: "create" | "edit";
  pluginId: string;
  submissionId: number;
}

/**
 * Every server-side event, mapped to its payload. Emitting and listening are
 * type-checked against this map.
 *
 * A plugin adds its own events by augmenting the interface:
 *
 * @example
 * ```ts
 * declare module "@vitnode/core/api/models/events" {
 *   interface VitNodeEvents {
 *     "blog.post.created": { categoryId: number; postId: number };
 *   }
 * }
 * ```
 */
export interface VitNodeEvents {
  "ai.run.completed": {
    actionKey: string;
    actorType: "system" | "user";
    runId: number;
    userId: null | number;
  };
  "ai.run.failed": {
    actionKey: string;
    actorType: "system" | "user";
    errorCode: null | string;
    runId: number;
    userId: null | number;
  };
  "content.approval.approved": ContentApprovalEventPayload & {
    reviewerId: number;
  };
  "content.approval.rejected": ContentApprovalEventPayload & {
    reason: null | string;
    reviewerId: number;
  };
  "content.approval.submitted": ContentApprovalEventPayload & {
    /** Id of the pending proposal this one replaced, if any. */
    replacedSubmissionId: null | number;
  };
  "content.container.created": ContentContainerEventPayload;
  "content.container.deleted": ContentContainerEventPayload;
  "content.container.moved": ContentContainerEventPayload & {
    fromParentId: null | number;
    position: number;
  };
  "content.container.updated": ContentContainerEventPayload & {
    changedFields: string[];
  };
  "core.page-layout.updated": {
    changedZones: string[];
    pageId: string;
  };
  "file.editor.uploaded": {
    fileId: number;
    kind: "attachment" | "image";
    userId: number;
  };
  "files.alt.updated": {
    fileId: number;
    languageCodes: string[];
    origin: "ai" | "human";
  };
  "moderation.report.action": {
    action: "hide" | "unhide";
    pluginId: string;
    reportId: number;
    targetId: string;
    targetType: string;
  };
  "moderation.report.assigned": {
    assigneeId: null | number;
    previousAssigneeId: null | number;
    reportId: number;
  };
  "moderation.report.created": {
    pluginId: string;
    reason: string;
    reportId: number;
    targetId: string;
    targetType: string;
  };
  "moderation.report.note_deleted": {
    noteId: number;
    reportId: number;
  };
  "moderation.report.note_updated": {
    noteId: number;
    reportId: number;
  };
  "moderation.report.reopened": {
    reportId: number;
  };
  "moderation.report.resolved": {
    reportId: number;
    resolution: string;
  };
  "moderation.report_reason.created": {
    code: string;
    reasonId: number;
  };
  "moderation.report_reason.deleted": {
    code: string;
    reasonId: number;
  };
  "moderation.report_reason.reordered": {
    reasonIds: number[];
  };
  "moderation.report_reason.updated": {
    code: string;
    reasonId: number;
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
  "user.email.verified": {
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

/**
 * Who caused an event, resolved from the emitting request: the admin on an
 * AdminCP route, else the signed-in user, else `system` (cron, queue tasks,
 * guests).
 */
export interface EventActor {
  id?: number;
  type: "admin" | "system" | "user";
}

/** An emitted event with its metadata, passed to listeners and adapters. */
export interface EventEnvelope<K extends VitNodeEventName = VitNodeEventName> {
  /** Who caused the event. */
  actor: EventActor;
  /** When `emit()` was called. */
  emittedAt: Date;
  /** A random UUID, unique per emit; also returned in the result. */
  eventId: string;
  /** The event name, e.g. `"role.created"`. */
  name: K;
  /** The event's data, typed by its {@link VitNodeEvents} entry. */
  payload: VitNodeEvents[K];
  /** Plugin that emitted the event. */
  pluginId: string;
}

/** One listener (or the adapter itself) that failed to handle an event. */
export interface EventEmitFailure {
  /** The thrown error's message. */
  error: string;
  /** Listener `name` as declared in `buildEventListener`. */
  listener: string;
  module: string;
  /** Plugin that owns the failing listener. */
  pluginId: string;
}

/** What `emit()` reports back about delivery. */
export interface EventEmitResult {
  /** Listeners that ran successfully before `emit()` resolved. */
  delivered: number;
  /** The emitted envelope's id. */
  eventId: string;
  /** Listeners that threw. When the adapter itself throws, one entry with `module: "adapter"`. */
  failures: EventEmitFailure[];

  /** `delivered` when listeners ran before `emit()` resolved (the local adapter); `queued` when an adapter hands the event off. */
  status: "delivered" | "queued";
}

/**
 * Transport for events, set as `events.adapter` in the API config. Defaults to
 * the in-process local adapter, which runs matching listeners sequentially
 * inside the emitting request.
 *
 * A custom adapter may deliver elsewhere and report `status: "queued"`.
 * Throwing from `publish` is caught by `emit()`, logged, and reported as a
 * failure.
 */
export interface EventsApiPlugin {
  /** Shown in logs and returned by `c.get("events").name()`, e.g. `"local"`. */
  name: string;
  /** Delivers one event to its listeners (read them from `c.get("core").events.listeners`) or hands it off. */
  publish: (c: Context, envelope: EventEnvelope) => Promise<EventEmitResult>;
}

export interface EventEmitOptions {
  /**
   * Plugin recorded as the emitter. Defaults to the plugin of the current
   * route, then `@vitnode/core`.
   */
  pluginId?: string;
}

/** Server-side events API, available as `c.get("events")` in API handlers. */
export class EventsModel {
  constructor(c: Context) {
    this.c = c;
  }

  protected readonly c: Context;

  private adapter(): EventsApiPlugin {
    return this.c.get("core").events.adapter;
  }

  /**
   * Publishes an event to its listeners through the configured adapter.
   *
   * Never throws: listener and adapter errors are logged and returned in
   * `failures`. With the local adapter the promise resolves after every
   * listener has finished, so await it when listeners must run before the
   * response, and keep listeners fast.
   *
   * @example
   * ```ts
   * await c.get("events").emit("role.created", { roleId: role.id });
   * ```
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

  /** Name of the configured adapter, e.g. `"local"`. */
  name(): string {
    return this.adapter().name;
  }
}

export type { EventListenerConfig };
