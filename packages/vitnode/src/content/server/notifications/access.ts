import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";
import { z } from "zod";

import type { NotificationAccessArgs } from "../../../api/lib/notifications/registry";
import type { EnvVitNode } from "../../../api/middlewares/global.middleware";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentNotificationAccessFilter } from "./define";

import { core_content_submissions } from "../../../database/content-submissions";
import { contentIdFromKey } from "../../ids";
import { contentDefinitionOf, findContentModel } from "../model";
import { isContentBaseRowPublic } from "../visibility";

/**
 * The record ids a content notification's `data` carries so its access can be
 * checked again later. Spread {@link contentNotificationRefs} into a custom
 * type's data to get them.
 */
export interface ContentNotificationRefs {
  contentId: string;
  contentTypeId: string;
  /** The reply being answered, when the notification is about a reply. */
  parentId?: null | string;
  relation?: "comment" | "reply";
  rootId?: null | string;
  submissionId?: number;
}

/**
 * The {@link ContentNotificationRefs} of a custom rule's context, to spread
 * into the data of a type guarded by {@link contentNotificationAccess}.
 */
export const contentNotificationRefs = (context: {
  content: Row;
  contentTypeId: string;
  decision: null | { submissionId: number };
  parent: null | Row;
  root: null | Row;
}): ContentNotificationRefs => ({
  contentId: String(context.content.id),
  contentTypeId: context.contentTypeId,
  parentId: context.parent ? String(context.parent.id) : null,
  rootId: context.root ? String(context.root.id) : null,
  ...(context.decision ? { submissionId: context.decision.submissionId } : {}),
});

const refsSchema = z.object({
  contentId: z.string().min(1),
  contentTypeId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]).optional(),
  parentId: z.string().min(1).nullable().optional(),
  relation: z.enum(["comment", "reply"]).optional(),
  rootId: z.string().min(1).nullable().optional(),
  submissionId: z.number().int().positive().optional(),
});

type Row = Record<string, unknown>;

// An inbox page lists many items about the same few records, and `access` runs
// once per item. A queue worker reuses one context for many tasks, so entries
// live for a second only: long enough for one page, too short to miss a delete.
const ROW_CACHE_MS = 1000;
const rowCache = new WeakMap<
  object,
  Map<string, { at: number; row: Promise<null | Row> }>
>();

/** Reads one record by type and id key, or `null` when it or its model is gone. */
export const readContentNotificationRow = async (
  c: Context<EnvVitNode>,
  contentTypeId: string,
  key: string,
): Promise<null | Row> => {
  const entry = findContentModel(c.get("core").contentModels, contentTypeId);
  if (!entry) return null;
  const { model } = entry;
  const id = contentIdFromKey(contentDefinitionOf(model).idStrategy, key);
  if (id === null) return null;

  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const [row] = (await c
    .get("db")
    .select()
    .from(table)
    .where(eq(columns.id, id))
    .limit(1)) as Row[];

  return row ?? null;
};

const cachedRow = async (
  c: Context<EnvVitNode>,
  contentTypeId: string,
  key: string,
): Promise<null | Row> => {
  let cache = rowCache.get(c);
  if (!cache) {
    cache = new Map();
    rowCache.set(c, cache);
  }
  const cacheKey = `${contentTypeId}:${key}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.at < ROW_CACHE_MS) return await cached.row;

  const row = readContentNotificationRow(c, contentTypeId, key);
  cache.set(cacheKey, { at: now, row });

  return await row;
};

const rootTypeIdOf = (definition: AnyContentTypeDefinition): null | string => {
  if (!definition.thread.enabled) return null;
  const field = definition.fields[definition.thread.rootField];

  return field?.kind === "relation" ? field.target().id : null;
};

/** Whether the thread root a notification points at is still public. */
const isRootPublic = async (
  c: Context<EnvVitNode>,
  definition: AnyContentTypeDefinition,
  rootId: null | string | undefined,
): Promise<boolean> => {
  if (!rootId) return true;
  const rootTypeId = rootTypeIdOf(definition);
  if (!rootTypeId) return true;
  const root = await cachedRow(c, rootTypeId, rootId);

  return root !== null && isContentBaseRowPublic(root);
};

/**
 * Builds a notification type's `access` hook from Content Engine state, for
 * notifications whose `data` carries {@link ContentNotificationRefs}. Core
 * calls it before delivery, before each immediate or digest email and each
 * time an inbox loads, so a member who can no longer see the record stops
 * seeing the notification - its title, body and link included.
 *
 * - `"content"`: the record and its thread root must exist and be public
 *   (published, not hidden, not scheduled in the future); a reply's parent
 *   must still exist.
 * - `"submission"`: only the submission's author, while the submission still
 *   carries that decision and the record exists. An approval also requires
 *   the record to be public; a rejection does not, so the author still hears
 *   about a draft that never went live. The thread root must stay public.
 *
 * `filter` narrows the result further for plugin-specific rules. Content
 * Engine reads are not role-based, so without it every recipient who passes
 * the state checks may see the notification. Server-only.
 *
 * @example
 * ```ts
 * buildNotificationType({
 *   // ...
 *   access: contentNotificationAccess({ content: commentContentType, policy: "content" }),
 * });
 * ```
 */
export const contentNotificationAccess =
  ({
    content,
    filter,
    policy,
  }: {
    /** The content type the notifications are about. */
    content: AnyContentTypeDefinition;
    filter?: ContentNotificationAccessFilter;
    policy: "content" | "submission";
  }) =>
  async ({
    c,
    data,
    userIds,
  }: NotificationAccessArgs<unknown>): Promise<number[]> => {
    if (userIds.length === 0) return [];
    const parsed = refsSchema.safeParse(data);
    if (!parsed.success || parsed.data.contentTypeId !== content.id) return [];
    const refs = parsed.data;

    let allowed = userIds;
    const row = await cachedRow(c, content.id, refs.contentId);
    if (!row) return [];

    if (policy === "content") {
      if (!isContentBaseRowPublic(row)) return [];
      if (refs.relation === "reply" && refs.parentId) {
        if (!(await cachedRow(c, content.id, refs.parentId))) return [];
      }
    } else {
      if (refs.submissionId === undefined) return [];
      const [submission] = await c
        .get("db")
        .select({
          authorId: core_content_submissions.authorId,
          contentTypeId: core_content_submissions.contentTypeId,
          itemId: core_content_submissions.itemId,
          status: core_content_submissions.status,
        })
        .from(core_content_submissions)
        .where(eq(core_content_submissions.id, refs.submissionId))
        .limit(1);
      if (
        !submission ||
        submission.authorId === null ||
        submission.contentTypeId !== content.id ||
        submission.itemId !== refs.contentId ||
        (refs.decision !== undefined && submission.status !== refs.decision)
      ) {
        return [];
      }
      if (submission.status === "approved" && !isContentBaseRowPublic(row)) {
        return [];
      }
      allowed = allowed.filter(id => id === submission.authorId);
    }

    if (allowed.length === 0) return [];
    if (!(await isRootPublic(c, content, refs.rootId))) return [];

    return filter
      ? await filter({
          c,
          contentId: refs.contentId,
          rootId: refs.rootId ?? null,
          userIds: allowed,
        })
      : allowed;
  };
