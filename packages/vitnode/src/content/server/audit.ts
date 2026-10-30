import type { Context } from "hono";

import type { AuditPendingEntry } from "../../api/lib/audit/context";
import type { AuditChanges } from "../../lib/audit/const";
import type { ContentEventAction } from "../events";
import type { ContentId } from "../ids";
import type { ContentActor } from "../revisions";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentDatabase } from "./service";

import { withAuditContext } from "../../api/lib/audit/context";
import { writeAuditLog } from "../../api/lib/audit/write";
import { AUDIT_CORE_PLUGIN_ID } from "../../lib/audit/const";
import { auditDiff } from "../../lib/audit/diff";
import { partitionContentFields } from "../localization";

/**
 * The Content Engine operations that leave an audit entry, named after the
 * content event they correspond to. Delivery events are not audited: a slug
 * change is already part of the `updated` entry that caused it.
 */
export type ContentAuditAction = Exclude<
  ContentEventAction,
  "delivery_redirect_created" | "delivery_slug_changed"
>;

/** The audit action stored for a content operation: `content.updated`. */
export const contentAuditAction = (action: ContentAuditAction): string =>
  `content.${action}`;

/** Revision operations of the shared history, mapped to their audit action. */
export const CONTENT_REVISION_AUDIT_ACTIONS = {
  create: "created",
  delete: "deleted",
  hide: "hidden",
  publish: "published",
  restore: "restored",
  unhide: "unhidden",
  unpublish: "unpublished",
  update: "updated",
} as const satisfies Record<string, ContentAuditAction>;

/** Revision operations of one translation's history, mapped to their audit action. */
export const CONTENT_TRANSLATION_REVISION_AUDIT_ACTIONS = {
  create: "translation_created",
  delete: "translation_deleted",
  publish: "translation_published",
  restore: "translation_restored",
  unpublish: "translation_unpublished",
  update: "translation_updated",
} as const satisfies Record<string, ContentAuditAction>;

/** One Content Engine operation to record, inside the write's transaction. */
export interface ContentAuditWrite {
  action: ContentAuditAction;
  actor: ContentActor;
  /** Canonical field paths the write moved (`seo.title`, `categories`). */
  changedFields?: readonly string[];
  /**
   * Bounded before/after values, for a content type without revisions. An
   * editorial content type leaves this out: its revision holds the values.
   */
  changes?: AuditChanges | null;
  definition: AnyContentTypeDefinition;
  itemId: ContentId;
  /** The record's title at the time of the write, when the row carries one. */
  label?: null | string;
  /** Only for a translation operation. */
  locale?: string;
  metadata?: Record<string, unknown>;
  pluginId: string;
  revisionId?: null | number;
}

/**
 * The plugin a content type belongs to, from the content registry - never
 * from the request. Falls back to the route's plugin for a content type bound
 * outside the registry (tests, custom wiring).
 */
export const contentPluginIdOf = (
  c: Context,
  definition: AnyContentTypeDefinition,
): string =>
  c
    .get("core")
    ?.contentModels?.find(entry => entry.model.definition.id === definition.id)
    ?.pluginId ??
  c.get("plugin")?.id ??
  AUDIT_CORE_PLUGIN_ID;

/** Whether `path` (or the group it belongs to) is one of `excluded`. */
const isExcludedPath = (path: string, excluded: readonly string[]): boolean =>
  excluded.includes(path) || excluded.includes(path.split(".")[0]);

/**
 * The title an entry is labelled with: `admin.titleField` read off the row,
 * when it is a non-empty string on this row. A localized title lives on the
 * translation row, so a base-row write of a localized content type has none.
 */
export const contentAuditLabel = (
  definition: AnyContentTypeDefinition,
  row: null | Record<string, unknown> | undefined,
): null | string => {
  const field = definition.admin.titleField;
  if (!row || field === null) return null;
  const value =
    row[field] ?? (row.values as Record<string, unknown> | undefined)?.[field];

  return typeof value === "string" && value.trim() !== "" ? value : null;
};

/**
 * {@link contentAuditLabel}, falling back to the default translation's title
 * for a localized content type - read with `readDefaultTranslation`, inside the
 * write's transaction (and before a delete, while it still exists).
 */
export const resolveContentAuditLabel = async (
  definition: AnyContentTypeDefinition,
  row: null | Record<string, unknown> | undefined,
  readDefaultTranslation?: () => Promise<unknown>,
): Promise<null | string> => {
  const own = contentAuditLabel(definition, row);
  if (
    own !== null ||
    !readDefaultTranslation ||
    !definition.audit.enabled ||
    !definition.localization.enabled
  ) {
    return own;
  }

  return contentAuditLabel(
    definition,
    (await readDefaultTranslation()) as null | Record<string, unknown>,
  );
};

const valueAt = (row: Record<string, unknown>, path: string): unknown => {
  let value: unknown = row;
  for (const segment of path.split(".")) {
    if (value === null || typeof value !== "object") return null;
    value = (value as Record<string, unknown>)[segment];
  }

  return value ?? null;
};

/**
 * Bounded before/after values of the scalar paths a plain (revisionless)
 * write moved. Collections are named in `changedFields` only: a list of ids
 * says little that the record itself does not.
 */
export const contentAuditChanges = (
  definition: AnyContentTypeDefinition,
  {
    after,
    before,
    changedFields,
    scope = "shared",
  }: {
    after: Record<string, unknown>;
    before: Record<string, unknown>;
    changedFields: readonly string[];
    /** Which half of the fields the rows hold: the base row's or a translation's. */
    scope?: "localized" | "shared";
  },
): AuditChanges | null => {
  const audit = definition.audit;
  if (!audit.trackChanges) return null;

  const { localizedFields, sharedFields } = partitionContentFields(
    definition.fields,
  );
  const scalars = scope === "localized" ? localizedFields : sharedFields;
  const paths = changedFields.filter(
    path =>
      !isExcludedPath(path, audit.excludeFields) &&
      scalars[path.split(".")[0]] !== undefined,
  );
  if (paths.length === 0) return null;

  return auditDiff({
    after: Object.fromEntries(paths.map(path => [path, valueAt(after, path)])),
    before: Object.fromEntries(
      paths.map(path => [path, valueAt(before, path)]),
    ),
  });
};

/**
 * Writes the audit entry of one Content Engine operation **inside** its
 * transaction, so the entry exists exactly when the write committed. Called by
 * the editorial and translation revision captures and by the plain services -
 * never by a post-commit event listener. A no-op when the content type has
 * `audit: false`.
 */
export const recordContentAudit = async (
  c: Context,
  tx: ContentDatabase,
  {
    action,
    actor,
    changedFields = [],
    changes = null,
    definition,
    itemId,
    label = null,
    locale,
    metadata,
    pluginId,
    revisionId = null,
  }: ContentAuditWrite,
): Promise<void> => {
  const audit = definition.audit;
  if (!audit.enabled) return;

  const fields = audit.trackChanges
    ? changedFields.filter(path => !isExcludedPath(path, audit.excludeFields))
    : [];
  const itemKey = String(itemId);

  await writeAuditLog(
    c,
    {
      action: contentAuditAction(action),
      actor,
      ...(actor.type === "system" ? { area: "system" as const } : {}),
      changes: audit.trackChanges ? changes : null,
      contentTypeId: definition.id,
      metadata: {
        ...(fields.length > 0 ? { changedFields: fields } : {}),
        ...(locale === undefined ? {} : { locale }),
        ...metadata,
      },
      pluginId,
      revisionId,
      target: { id: itemKey, label, type: definition.id },
    },
    tx,
  );
};

const isOwnEntry = (
  entry: AuditPendingEntry,
  definition: AnyContentTypeDefinition,
): boolean => entry.contentTypeId === definition.id;

/**
 * Runs a duplicate so that it leaves one `content.duplicated` entry: the copy's
 * own `created` entry is rewritten (it names the new record and the source),
 * and the copied translations, created as part of the same operation, leave
 * none of their own. Retried slug attempts roll their entry back with their
 * savepoint, so a retry never doubles it.
 */
export const withContentDuplicateAudit = async <TResult>(
  c: Context,
  definition: AnyContentTypeDefinition,
  sourceId: ContentId,
  body: () => Promise<TResult>,
): Promise<TResult> =>
  await withAuditContext(
    c,
    {
      intercept: entry => {
        if (!isOwnEntry(entry, definition)) return entry;
        if (entry.action === contentAuditAction("created")) {
          return {
            ...entry,
            action: contentAuditAction("duplicated"),
            metadata: { ...entry.metadata, sourceId },
          };
        }
        if (entry.action === contentAuditAction("translation_created")) {
          return null;
        }

        return entry;
      },
    },
    body,
  );

/**
 * Runs the translation cascade of a record publish or unpublish and holds back
 * the per-language entries it would write, so the caller can fold them into
 * the record's own entry (`metadata.locales`) - or write them after all when
 * the record itself did not move.
 */
export const collectContentTranslationAudit = async <TResult>(
  c: Context,
  definition: AnyContentTypeDefinition,
  body: () => Promise<TResult>,
): Promise<{ entries: AuditPendingEntry[]; result: TResult }> => {
  const entries: AuditPendingEntry[] = [];
  const result = await withAuditContext(
    c,
    {
      intercept: entry => {
        if (
          !isOwnEntry(entry, definition) ||
          !entry.action.startsWith("content.translation_")
        ) {
          return entry;
        }
        entries.push(entry);

        return null;
      },
    },
    body,
  );

  return { entries, result };
};

/** Writes entries {@link collectContentTranslationAudit} held back. */
export const writeContentAuditEntries = async (
  c: Context,
  tx: ContentDatabase,
  entries: readonly AuditPendingEntry[],
): Promise<void> => {
  for (const entry of entries) await writeAuditLog(c, entry, tx);
};

/** The locales held-back translation entries name, for the folded entry. */
export const contentAuditLocales = (
  entries: readonly AuditPendingEntry[],
): string[] =>
  entries
    .map(entry => entry.metadata.locale)
    .filter((locale): locale is string => typeof locale === "string");

/**
 * Runs one localized AdminCP save - the base row and any number of its
 * translations, in `tx` - and writes its audit entries at the end of it:
 *
 * - a **create** leaves one `content.created` entry, labelled with the default
 *   translation's title and listing the languages it was created in;
 * - an **update** leaves an entry per part that moved (the shared fields, each
 *   language), each labelled with the record's title even when only the
 *   translation carries it.
 */
export const withContentSaveAudit = async <TResult>(
  c: Context,
  definition: AnyContentTypeDefinition,
  tx: ContentDatabase,
  kind: "create" | "update",
  body: () => Promise<TResult>,
): Promise<TResult> => {
  const held: AuditPendingEntry[] = [];
  const result = await withAuditContext(
    c,
    {
      intercept: entry => {
        if (!isOwnEntry(entry, definition)) return entry;
        held.push(entry);

        return null;
      },
    },
    body,
  );

  const defaultLocale = definition.localization.enabled
    ? definition.localization.defaultLocale
    : null;
  const translations = held.filter(
    entry => entry.metadata.locale !== undefined,
  );
  // The title as the save left it: the default translation's, when this save
  // wrote one - a shared-field entry read the title before the translations
  // moved.
  const label =
    translations.find(entry => entry.metadata.locale === defaultLocale)?.target
      .label ??
    held.find(entry => entry.target.label !== null)?.target.label ??
    null;
  const labelled = (entry: AuditPendingEntry): AuditPendingEntry => ({
    ...entry,
    target: {
      ...entry.target,
      label:
        entry.metadata.locale === undefined
          ? (label ?? entry.target.label)
          : (entry.target.label ?? label),
    },
  });

  const created = held.find(
    entry => entry.action === contentAuditAction("created"),
  );
  if (kind === "create" && created) {
    const folded = translations.filter(
      entry => entry.action === contentAuditAction("translation_created"),
    );
    const changedFields = [
      ...new Set(
        [created, ...folded].flatMap(entry =>
          Array.isArray(entry.metadata.changedFields)
            ? (entry.metadata.changedFields as unknown[])
            : [],
        ),
      ),
    ];
    await writeAuditLog(
      c,
      labelled({
        ...created,
        metadata: {
          ...created.metadata,
          ...(changedFields.length > 0 ? { changedFields } : {}),
          locales: contentAuditLocales(folded),
        },
      }),
      tx,
    );
    await writeContentAuditEntries(
      c,
      tx,
      held
        .filter(entry => entry !== created && !folded.includes(entry))
        .map(labelled),
    );

    return result;
  }

  await writeContentAuditEntries(c, tx, held.map(labelled));

  return result;
};
