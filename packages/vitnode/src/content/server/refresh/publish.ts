import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { ContentEventAction } from "@/content/events";
import type { ContentId } from "@/content/ids";
import type {
  ContentRefreshScope,
  ContentRefreshServerMessage,
  ContentRefreshSignal,
} from "@/content/live/refresh";
import type { AnyContentTypeDefinition } from "@/content/types";

import { parseContentId } from "@/content/ids";
import {
  contentRefreshChannel,
  contentRefreshRoom,
} from "@/content/live/refresh";
import {
  isRealtimePubSubEnabled,
  isWebSocketEnabled,
  realtime,
  wsRegistry,
} from "@/ws/registry";

import type { ContentPublicState } from "../page-cache";

import { findContentModel } from "../model";
import { contentDependentDefinitions } from "../parent-visibility";
import { contentThreadTarget } from "../thread-access";
import { isContentBaseRowPublic } from "../visibility";

/** One committed content change, as `publishContentRefresh` reads it. */
export interface ContentRefreshChange {
  action: ContentEventAction;
  contentId: ContentId;
  definition: AnyContentTypeDefinition;
  /** Whether the record was public before and after; derived from `row` when absent. */
  publicState?: ContentPublicState;
  /**
   * The record after the write - or, for a delete, as it was just before it.
   * A threaded record needs its root and parent to be routed, and a deleted
   * one can no longer be read back, so pass it on every delete.
   */
  row?: null | Record<string, unknown>;
}

/** Actions after which a thread's root may be readable by different people. */
const ROOT_ACCESS_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "deleted",
  "hidden",
  "published",
  "restored",
  "unhidden",
  "unpublished",
]);

/** Actions that can only take a record off the public site. */
const REMOVING_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "deleted",
  "hidden",
  "unpublished",
]);

type RootChangedListener = (room: string) => Promise<void> | void;

const rootChangedListeners = new Set<RootChangedListener>();

/**
 * Runs `listener` with the room of every thread whose root changed in a way
 * that can move access, on this instance. The refresh socket re-checks that
 * room's members with it. Returns an unsubscribe function.
 */
export const onContentRefreshRootChanged = (
  listener: RootChangedListener,
): (() => void) => {
  rootChangedListeners.add(listener);

  return () => {
    rootChangedListeners.delete(listener);
  };
};

const send = (scope: ContentRefreshScope, signal: ContentRefreshSignal) => {
  const room = contentRefreshRoom(scope);
  realtime.toRoom(room, contentRefreshChannel, {
    room,
    signal,
    type: "changed",
  } satisfies ContentRefreshServerMessage);

  return room;
};

/** Without Redis, nobody outside this instance can be listening. */
const hasListeners = (scope: ContentRefreshScope): boolean =>
  isRealtimePubSubEnabled() ||
  wsRegistry.membersOf(contentRefreshRoom(scope)).length > 0;

const publicStateOf = ({
  action,
  publicState,
  row,
}: ContentRefreshChange): ContentPublicState => {
  if (publicState) return publicState;
  // Unknown: assume a record that can only have left the site was on it, and
  // judge everything else by the row. A draft's edit stays unannounced.
  const rowIsPublic = row ? isContentBaseRowPublic(row) : false;

  return {
    isPublic: !REMOVING_ACTIONS.has(action) && rowIsPublic,
    wasPublic: REMOVING_ACTIONS.has(action) || rowIsPublic,
  };
};

const MAX_PARENT_HOPS = 64;

/**
 * Where one threaded record sits: its root and the top-level reply its branch
 * hangs from. Reads the record when `row` lacks the thread columns, then walks
 * up its parents - each one a primary-key read, at most `MAX_PARENT_HOPS`.
 */
const threadLocation = async (
  c: Context,
  definition: AnyContentTypeDefinition,
  contentId: ContentId,
  row: null | Record<string, unknown> | undefined,
): Promise<null | { branchId: ContentId; rootId: ContentId }> => {
  const target = contentThreadTarget(definition);
  const model = findContentModel(
    c.get("core")?.contentModels ?? [],
    definition.id,
  )?.model;
  if (!target || !model) return null;

  const { parentField, rootField } = definition.thread;
  const table: PgTable = model.table;
  const columns = model.columns as Record<string, PgColumn>;
  const db = c.get("db");
  const read = async (id: unknown) => {
    const [found] = await db
      .select({ parent: columns[parentField], root: columns[rootField] })
      .from(table)
      .where(eq(columns.id, id as never))
      .limit(1);

    return found as undefined | { parent: unknown; root: unknown };
  };

  const own =
    row && Object.hasOwn(row, rootField) && Object.hasOwn(row, parentField)
      ? { parent: row[parentField], root: row[rootField] }
      : await read(contentId);
  if (!own) return null;

  const rootId = parseContentId(target.idStrategy, own.root);
  if (
    rootId === null ||
    !hasListeners({ contentTypeId: definition.id, kind: "thread", rootId })
  ) {
    return null;
  }

  let branchId: ContentId = contentId;
  let parent = own.parent;
  for (let hop = 0; parent !== null && parent !== undefined; hop++) {
    const parentId = parseContentId(definition.idStrategy, parent);
    if (parentId === null || hop >= MAX_PARENT_HOPS) return null;
    branchId = parentId;
    parent = (await read(parentId))?.parent;
  }

  return { branchId, rootId };
};

/**
 * Announces one committed content change to the live refresh rooms that show
 * it, over the shared WebSocket (and Redis, across instances):
 *
 * - every change to the content type's AdminCP list room, as `list`;
 * - a change that was or is public, for a threaded type, to its thread's
 *   room, as `branch` with the top-level branch it sits in;
 * - a change that can move who reads a record, to the thread rooms hanging
 *   off it, as `thread` - and this instance re-checks those rooms' members.
 *
 * A signal names no values, no author and no private record: a branch id is
 * only sent when that branch was or is on the public thread. Call it after the
 * transaction committed and the caches were expired, so a receiver that reads
 * again gets the new state; `emitContentEvent` does, for every write that goes
 * through it. Best effort - never throws, and nothing is replayed to a client
 * that was not connected. Server-only.
 */
export const publishContentRefresh = async (
  c: Context,
  change: ContentRefreshChange,
): Promise<void> => {
  if (!isWebSocketEnabled()) return;

  try {
    const { action, contentId, definition, row } = change;
    send({ contentTypeId: definition.id, kind: "admin" }, { kind: "list" });

    const state = publicStateOf(change);
    const touchesPublic = state.wasPublic || state.isPublic;

    if (definition.thread.enabled && touchesPublic) {
      const location = await threadLocation(c, definition, contentId, row);
      if (location) {
        send(
          {
            contentTypeId: definition.id,
            kind: "thread",
            rootId: location.rootId,
          },
          {
            branchId: location.branchId,
            kind: "branch",
            ...(state.wasPublic && !state.isPublic
              ? { removedId: contentId }
              : {}),
          },
        );
      }
    }

    if (
      touchesPublic &&
      (ROOT_ACCESS_ACTIONS.has(action) || state.wasPublic !== state.isPublic)
    ) {
      for (const dependent of contentDependentDefinitions(c, definition)) {
        if (contentThreadTarget(dependent)?.id !== definition.id) continue;
        const scope: ContentRefreshScope = {
          contentTypeId: dependent.id,
          kind: "thread",
          rootId: contentId,
        };
        if (!hasListeners(scope)) continue;
        const room = send(scope, { kind: "thread" });
        await Promise.all(
          [...rootChangedListeners].map(async listener => listener(room)),
        );
      }
    }
  } catch (error) {
    // The write has committed; a missed hint costs freshness, never data.
    try {
      await c
        .get("log")
        .error(
          `[content-refresh] ${change.definition.id}: live signal failed: ${error instanceof Error ? error.message : String(error)}`,
        );
    } catch {
      // oxlint-disable-next-line no-console
      console.error("[VitNode] Content live refresh signal failed:", error);
    }
  }
};
