import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq } from "drizzle-orm";

import type { RichTextNode } from "../../content/rich-text/document";
import type { EnvVitNode } from "../../middlewares/global.middleware";
import type { ContentEventAction } from "../events";
import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { deleteMentions, syncMentions } from "../../lib/mentions/sync";
import { contentMentionsQueueTask } from "../../modules/content/tasks/content-mentions.task";
import { contentIdKey } from "../ids";
import { contentMentionFields } from "./mention-target";
import { contentDefinitionOf, findContentModel } from "./model";
import { readContentNotificationRow } from "./notifications/access";
import { contentNotificationText } from "./notifications/define";
import {
  contentNotificationActorId,
  contentNotificationRegistryOf,
} from "./notifications/intents";
import { contentReactionTarget } from "./reaction-target";
import { readTranslationRow } from "./report-target";
import { toAuthorIds } from "./search-document";
import { isContentBaseRowPublic } from "./visibility";

type Row = Record<string, unknown>;

/** Writes that can add, remove or reveal mentions. */
const SYNCING_ACTIONS: ReadonlySet<ContentEventAction> = new Set([
  "created",
  "published",
  "translation_created",
  "translation_published",
  "translation_restored",
  "translation_updated",
  "unhidden",
  "updated",
]);

const mentionsChanged = (
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: object,
): boolean => {
  if (action !== "updated") return true;
  if (!("changedFields" in payload) || !Array.isArray(payload.changedFields)) {
    return true;
  }
  const fields = new Set(contentMentionFields(definition));

  return (payload.changedFields as unknown[]).some(
    field => typeof field === "string" && fields.has(field),
  );
};

/** Whether a write can add, remove or reveal mentions of a type with mention fields. */
const writeMayMention = (
  definition: AnyContentTypeDefinition,
  action: ContentEventAction,
  payload: object,
): boolean =>
  contentMentionFields(definition).length > 0 &&
  (action === "deleted" ||
    (SYNCING_ACTIONS.has(action) &&
      mentionsChanged(definition, action, payload)));

/**
 * Queues a record's mentions for syncing after a committed content write -
 * `emitContentEvent` calls it for every write. A no-op for types without
 * mention fields and for writes that cannot change them (hiding or
 * unpublishing only hides the notifications, through their access check).
 * Never throws: the write already committed.
 */
export const queueContentMentions = async (
  c: Context,
  {
    action,
    contentId,
    definition,
    payload,
    pluginId,
  }: {
    action: ContentEventAction;
    contentId: ContentId;
    definition: AnyContentTypeDefinition;
    payload: object;
    pluginId: string;
  },
): Promise<void> => {
  if (!writeMayMention(definition, action, payload)) return;

  try {
    const queued = await c.get("queue").dispatch(contentMentionsQueueTask, {
      actorId: contentNotificationActorId(c),
      contentTypeId: definition.id,
      deleted: action === "deleted",
      itemId: contentIdKey(contentId),
      pluginId,
    });
    if (queued.id !== null) {
      (
        c.get("notifications") as
          | undefined
          | { processAfterResponse?: (queueId: number) => void }
      )?.processAfterResponse?.(queued.id);
    }
  } catch (error) {
    await c
      .get("log")
      ?.error(
        `[mentions] ${definition.id}: mentions of ${contentIdKey(contentId)} were not queued (${error instanceof Error ? error.message : String(error)}).`,
      );
  }
};

const firstUserId = (value: unknown): null | number =>
  toAuthorIds(value).at(0) ?? null;

/** The member who wrote the record: the search author, or the public write owner. */
const authorOf = (
  definition: AnyContentTypeDefinition,
  row: Row,
): null | number => {
  const field =
    definition.search.authorField ?? definition.publicWrite.ownerField;

  return field ? firstUserId(row[field]) : null;
};

/** The published translations' rich text of the localized mention fields. */
const translationDocuments = async (
  c: Context,
  model: AnyContentModel,
  fields: readonly string[],
  itemId: unknown,
): Promise<RichTextNode[]> => {
  const table = model.translationTable as null | PgTable;
  const columns = model.translationColumns as null | Record<string, PgColumn>;
  const tableColumns = table as unknown as null | Record<string, PgColumn>;
  if (!table || !columns || !tableColumns?.itemId) return [];

  const localized = fields.filter(field => columns[field]);
  if (localized.length === 0) return [];

  const rows = (await c
    .get("db")
    .select()
    .from(table)
    .where(eq(tableColumns.itemId, itemId))) as Row[];

  return rows
    .filter(
      row =>
        !("publishedAt" in row) ||
        (row.publishedAt !== null &&
          new Date(row.publishedAt as Date | string) <= new Date()),
    )
    .flatMap(row =>
      localized.map(field => row[field] as RichTextNode | undefined),
    )
    .filter((doc): doc is RichTextNode => !!doc && typeof doc === "object");
};

/** Title and link for the notification, from the thread rule or the record itself. */
const describe = async (
  c: Context<EnvVitNode>,
  {
    content,
    model,
    parent,
    pluginId,
    root,
  }: {
    content: Row;
    model: AnyContentModel;
    parent: null | Row;
    pluginId: string;
    root: null | Row;
  },
): Promise<{
  exclude: number[];
  title: string;
  url: null | string;
}> => {
  const definition = contentDefinitionOf(model);
  const thread = contentNotificationRegistryOf(c)
    ?.rulesFor(definition.id, "firstPublication")
    .map(entry => entry.rule)
    .find(rule => rule.kind === "threadReply");

  if (thread && thread.kind === "threadReply" && root) {
    // The thread rule already tells these members about the reply.
    const exclude = [
      thread.parentAuthor && parent
        ? firstUserId(parent[thread.authorField])
        : null,
      thread.rootAuthorField ? firstUserId(root[thread.rootAuthorField]) : null,
    ].filter((id): id is number => id !== null);

    return {
      exclude,
      title: contentNotificationText(
        thread.title
          ? thread.title({ content, root })
          : await rootTitleOf(c, rootDefinitionOf(definition), root),
      ),
      url: thread.target({ content, parent, root }),
    };
  }

  const preview = (
    await contentReactionTarget(model, pluginId).preview?.(c, {
      ids: [String(content.id)],
    })
  )?.get(String(content.id));

  return {
    exclude: [],
    title: contentNotificationText(preview?.title),
    url: preview?.url ?? null,
  };
};

const rootTitleOf = async (
  c: Context<EnvVitNode>,
  rootDefinition: AnyContentTypeDefinition | null,
  root: Row,
): Promise<unknown> => {
  const titleField = rootDefinition?.admin.titleField;
  if (!rootDefinition || !titleField) return "";
  if (root[titleField] !== undefined) return root[titleField];
  if (!rootDefinition.localization.enabled) return "";

  const entry = findContentModel(
    c.get("core").contentModels,
    rootDefinition.id,
  );
  const itemId = root.id;
  if (!entry || (typeof itemId !== "number" && typeof itemId !== "string")) {
    return "";
  }
  const translation = await readTranslationRow(c, c.get("db"), entry.model, {
    itemId,
    locale: rootDefinition.localization.defaultLocale,
  });

  return translation?.[titleField] ?? "";
};

const rootDefinitionOf = (
  definition: AnyContentTypeDefinition,
): AnyContentTypeDefinition | null => {
  if (!definition.thread.enabled) return null;
  const field = definition.fields[definition.thread.rootField];

  return field?.kind === "relation" ? field.target() : null;
};

const keyOf = (value: unknown): null | string =>
  typeof value === "number" || typeof value === "string" ? String(value) : null;

/**
 * Syncs one record's stored mentions with its current text - the
 * `content-mentions` queue task. A record that is not public notifies
 * nobody yet; its next publication syncs again. Server-only.
 */
export const processContentMentions = async (
  c: Context<EnvVitNode>,
  {
    actorId,
    contentTypeId,
    deleted,
    itemId,
    pluginId,
  }: {
    actorId: null | number;
    contentTypeId: string;
    deleted: boolean;
    itemId: string;
    pluginId: string;
  },
): Promise<void> => {
  const entry = findContentModel(c.get("core").contentModels, contentTypeId);
  const content = deleted
    ? null
    : await readContentNotificationRow(c, contentTypeId, itemId);
  if (!entry || !content) {
    await deleteMentions({
      c,
      id: itemId,
      pluginId: entry?.pluginId ?? pluginId,
      targetType: contentTypeId,
    });

    return;
  }
  if (!isContentBaseRowPublic(content)) return;

  const { model } = entry;
  const definition = contentDefinitionOf(model);
  const fields = contentMentionFields(definition);
  const documents = [
    ...fields.map(field => content[field] as RichTextNode | undefined),
    ...(await translationDocuments(c, model, fields, content.id)),
  ];

  const rootDefinition = rootDefinitionOf(definition);
  const rootId = definition.thread.enabled
    ? keyOf(content[definition.thread.rootField])
    : null;
  const parentId = definition.thread.enabled
    ? keyOf(content[definition.thread.parentField])
    : null;
  const [root, parent] = await Promise.all([
    rootDefinition && rootId
      ? readContentNotificationRow(c, rootDefinition.id, rootId)
      : null,
    parentId ? readContentNotificationRow(c, definition.id, parentId) : null,
  ]);
  const { exclude, title, url } = await describe(c, {
    content,
    model,
    parent,
    pluginId: entry.pluginId,
    root,
  });

  await syncMentions({
    actorId: authorOf(definition, content) ?? actorId,
    c,
    documents,
    exclude,
    id: itemId,
    pluginId: entry.pluginId,
    rootId,
    target: definition.id,
    title,
    url,
  });
};
