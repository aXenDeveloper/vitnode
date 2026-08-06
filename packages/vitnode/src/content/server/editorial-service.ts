import type { SQL } from "drizzle-orm";
import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, eq, ne, sql } from "drizzle-orm";

import type { ContentActor, ContentRevisionOperation } from "../revisions";
import type { ContentSchemas } from "../schemas";
import type {
  AnyContentTypeDefinition,
  ContentCreateInput,
  ContentFieldName,
  ContentSelect,
  ContentUpdateInput,
} from "../types";
import type { ContentRevisionsModel } from "./revisions-model";
import type { ContentSchedulesModel } from "./schedules-model";
import type { ContentDatabase } from "./service";

import { CONTENT_EDITORIAL_FIELDS, CONTENT_PUBLICATION_FIELDS } from "../const";
import {
  ContentEngineError,
  ContentRevisionNotRestorable,
  ContentVersionConflict,
} from "../errors";
import { diffChangedFields, toColumnValues } from "./query";
import {
  contentRevisionSnapshot,
  projectRevisionSnapshot,
} from "./revision-snapshot";
import { createContentRevisionsModel } from "./revisions-model";
import { createContentSchedulesModel } from "./schedules-model";
import { createSlugNormalizer } from "./slugs";

/**
 * Everything the post-commit effects need, and nothing they have to re-read.
 *
 * `previousSlug` is the one field that cannot be recovered after the fact: once
 * the write returns, the old URL is gone, and invalidating the wrong cache tag
 * leaves a moved page resolving at its old address.
 */
export interface ContentEditorialOutcome<TDefinition> {
  /** `false` when nothing moved: no write, no revision, no event, no tags. */
  changed: boolean;
  changedFields: ContentFieldName<TDefinition>[];
  operation: ContentRevisionOperation;
  /** The slug the record answered to *before* this mutation, if it has one. */
  previousSlug: null | string;
  /** Set only by `restore`: the revision the values came from. */
  restoredFromRevisionId: null | number;
  /** `null` on a no-op, since no revision was written. */
  revisionId: null | number;
  row: ContentSelect<TDefinition>;
  version: number;
}

export interface ContentEditorialOptions {
  actor: ContentActor;
  /** Join an existing transaction instead of opening one. */
  tx?: ContentDatabase;
}

export interface ContentEditorialWriteOptions extends ContentEditorialOptions {
  expectedVersion: number;
}

export interface ContentEditorialPublicationOptions extends ContentEditorialOptions {
  /** Enforced when supplied. Publishing overwrites no field values, so it is
   * optional: requiring it would fail the publish button whenever a colleague
   * had fixed a typo, for no protection against a lost update. */
  expectedVersion?: number;
}

export interface ContentEditorialService<TDefinition> {
  create: (
    values: ContentCreateInput<TDefinition>,
    options: ContentEditorialOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition>>;
  /**
   * Removes a record, and refuses if it moved since the caller read it.
   *
   * `expectedVersion` is required for the same reason `update` requires it: a
   * delete is the widest possible overwrite. Somebody looking at v4 in a stale
   * table must not be able to remove the v5 a colleague just wrote, and "are
   * you sure?" cannot ask about a change the person has not seen.
   */
  delete: (
    id: number,
    options: ContentEditorialWriteOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  publish: (
    id: number,
    options: ContentEditorialPublicationOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  restore: (
    id: number,
    revisionId: number,
    options: ContentEditorialWriteOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  /** Revision reads. Writes go through the mutations above. */
  revisions: ContentRevisionsModel;
  /**
   * Scheduled transitions, or `undefined` without `editorial.scheduling`.
   *
   * `undefined` rather than a throwing stub, matching `publicService` and
   * `editorialService` themselves - the check reads naturally in code that does
   * not know which content type it was handed.
   */
  schedules: ContentSchedulesModel | undefined;
  unpublish: (
    id: number,
    options: ContentEditorialPublicationOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
  update: (
    id: number,
    values: ContentUpdateInput<TDefinition>,
    options: ContentEditorialWriteOptions,
  ) => Promise<ContentEditorialOutcome<TDefinition> | null>;
}

/**
 * The transactional half of the Content Engine.
 *
 * Everything here holds one rule: **the content write, the version increment
 * and the revision insert are one transaction, and nothing else is in it.** No
 * event, no search call, no cache API, no HTTP - those all run after the commit,
 * because a rolled-back transaction cannot un-send them.
 *
 * A caller that already owns a transaction passes `tx` and this joins it. A
 * caller that does not gets one opened here, which is what makes
 * `service.update(...)` atomic by default rather than only when someone
 * remembered.
 */
export const createContentEditorialService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  columns,
  definition,
  pluginId,
  schemas,
  table,
}: {
  c: Context;
  columns: Record<string, PgColumn>;
  definition: TDefinition;
  pluginId: string;
  schemas: ContentSchemas<TDefinition>;
  table: PgTableWithColumns<TableConfig>;
}): ContentEditorialService<TDefinition> => {
  if (!definition.editorial.enabled) {
    throw new ContentEngineError(
      "The editorial service needs `editorial: { enabled: true }` on the content type.",
      { contentTypeId: definition.id },
    );
  }

  const contentTypeId = definition.id;
  const fields = definition.fields;
  const fieldNames = Object.keys(fields) as ContentFieldName<TDefinition>[];
  const primaryCursor = columns.id;
  const versionColumn = columns.version;
  const publication = definition.publication.enabled;
  const slugField = definition.publicApi.enabled
    ? definition.publicApi.slugField
    : null;

  const ownColumnNames = [
    "id",
    "createdAt",
    "updatedAt",
    ...(publication ? CONTENT_PUBLICATION_FIELDS : []),
    ...CONTENT_EDITORIAL_FIELDS,
    ...fieldNames,
  ];
  const ownSelection = (): Record<string, PgColumn> =>
    Object.fromEntries(ownColumnNames.map(name => [name, columns[name]]));

  const revisions = createContentRevisionsModel({ c, definition, pluginId });
  const schedules = definition.editorial.scheduling.enabled
    ? createContentSchedulesModel({ c, definition, pluginId })
    : undefined;
  const { withCreateSlugs, withUpdateSlugs } = createSlugNormalizer(
    contentTypeId,
    fields,
  );

  const toRow = (row: Record<string, unknown>): ContentSelect<TDefinition> =>
    row as ContentSelect<TDefinition>;

  const versionOf = (row: Record<string, unknown>): number =>
    typeof row.version === "number" ? row.version : 1;

  const slugOf = (row: null | Record<string, unknown>): null | string => {
    if (!row || slugField === null) return null;
    const value = row[slugField];

    return typeof value === "string" ? value : null;
  };

  const readOne = async (
    id: number,
    database: ContentDatabase,
  ): Promise<null | Record<string, unknown>> => {
    const [row] = await database
      .select(ownSelection())
      .from(table)
      .where(eq(primaryCursor, id))
      .limit(1);

    return row ?? null;
  };

  /** Runs `body` in the caller's transaction, or in one opened for it. */
  const transact = async <TResult>(
    options: ContentEditorialOptions,
    body: (tx: ContentDatabase) => Promise<TResult>,
  ): Promise<TResult> => {
    if (options.tx) return await body(options.tx);

    return await c.get("db").transaction(async tx => await body(tx));
  };

  const capture = async (
    tx: ContentDatabase,
    {
      actor,
      changedFields,
      operation,
      restoredFromRevisionId,
      row,
      version,
    }: {
      actor: ContentActor;
      changedFields: readonly string[];
      operation: ContentRevisionOperation;
      restoredFromRevisionId?: number;
      row: Record<string, unknown>;
      version: number;
    },
  ): Promise<number> =>
    await revisions.capture(tx, {
      actor,
      changedFields,
      itemId: typeof row.id === "number" ? row.id : 0,
      operation,
      restoredFromRevisionId,
      // Stamped with the version the record now holds, which for a delete is the
      // one it would have had - see `remove` below.
      snapshot: contentRevisionSnapshot(definition, { ...row, version }),
      version,
    });

  /**
   * The conditional write every editorial mutation goes through.
   *
   * `WHERE id = $id AND version = $expected` is the whole locking mechanism:
   * two editors racing produce one `UPDATE` that matches and one that does not,
   * with no read-then-write window in between. The follow-up `SELECT` runs only
   * when nothing matched, to tell a deleted record (404) from a moved one (409)
   * - the same shape `transition` in the plain service already uses.
   */
  const guardedWrite = async (
    tx: ContentDatabase,
    id: number,
    expectedVersion: number,
    values: Record<string, unknown>,
  ): Promise<null | Record<string, unknown>> => {
    const [row] = await tx
      .update(table)
      .set({ ...values, version: sql`${versionColumn} + 1` })
      .where(and(eq(primaryCursor, id), eq(versionColumn, expectedVersion)))
      .returning(ownSelection());

    if (row) return row;

    const [current] = await tx
      .select({ version: versionColumn })
      .from(table)
      .where(eq(primaryCursor, id))
      .limit(1);

    if (!current) return null;

    throw new ContentVersionConflict({
      contentTypeId,
      currentVersion: versionOf(current),
      expectedVersion,
      itemId: id,
    });
  };

  /**
   * Publish and unpublish, which guard on the *state* rather than the version.
   *
   * The state guard is what makes them idempotent, and idempotency is what makes
   * a retried queue task harmless. An `expectedVersion`, when supplied, is
   * `AND`ed on top rather than replacing it.
   */
  const transition = async (
    id: number,
    options: ContentEditorialPublicationOptions,
    operation: "publish" | "unpublish",
    values: Record<string, unknown>,
    guard: SQL,
  ): Promise<ContentEditorialOutcome<TDefinition> | null> =>
    await transact(options, async tx => {
      const conditions = [eq(primaryCursor, id), guard];
      if (options.expectedVersion !== undefined) {
        conditions.push(eq(versionColumn, options.expectedVersion));
      }

      const [row] = await tx
        .update(table)
        .set({ ...values, version: sql`${versionColumn} + 1` })
        .where(and(...conditions))
        .returning(ownSelection());

      if (!row) {
        const current = await readOne(id, tx);
        if (!current) return null;

        // Nothing matched but the record exists: either it was already in the
        // requested state, or the version moved. Only the second is an error.
        if (
          options.expectedVersion !== undefined &&
          versionOf(current) !== options.expectedVersion
        ) {
          throw new ContentVersionConflict({
            contentTypeId,
            currentVersion: versionOf(current),
            expectedVersion: options.expectedVersion,
            itemId: id,
          });
        }

        return {
          changed: false,
          changedFields: [],
          operation,
          previousSlug: slugOf(current),
          restoredFromRevisionId: null,
          revisionId: null,
          row: toRow(current),
          version: versionOf(current),
        };
      }

      const version = versionOf(row);
      const revisionId = await capture(tx, {
        actor: options.actor,
        changedFields: [],
        operation,
        row,
        version,
      });

      return {
        changed: true,
        changedFields: [],
        operation,
        previousSlug: slugOf(row),
        restoredFromRevisionId: null,
        revisionId,
        row: toRow(row),
        version,
      };
    });

  return {
    create: async (values, options) =>
      await transact(options, async tx => {
        const parsed = schemas.create.parse(values) as Record<string, unknown>;

        const [row] = await tx
          .insert(table)
          .values(toColumnValues(fields, withCreateSlugs(parsed)))
          .returning(ownSelection());

        const version = versionOf(row);
        const revisionId = await capture(tx, {
          actor: options.actor,
          // Everything is new, so every field "changed" - which is what the
          // history should say about a create.
          changedFields: fieldNames,
          operation: "create",
          row,
          version,
        });

        return {
          changed: true,
          changedFields: fieldNames,
          operation: "create",
          previousSlug: null,
          restoredFromRevisionId: null,
          revisionId,
          row: toRow(row),
          version,
        };
      }),

    delete: async (id, options) =>
      await transact(options, async tx => {
        // Same guard as `guardedWrite`, in a `DELETE` - the version has to be
        // part of the statement that removes the row, not checked before it.
        const [row] = await tx
          .delete(table)
          .where(
            and(
              eq(primaryCursor, id),
              eq(versionColumn, options.expectedVersion),
            ),
          )
          .returning(ownSelection());

        if (!row) {
          const [current] = await tx
            .select({ version: versionColumn })
            .from(table)
            .where(eq(primaryCursor, id))
            .limit(1);

          // Gone already is a 404 and not a conflict: the caller wanted the
          // record removed, and it is.
          if (!current) return null;

          throw new ContentVersionConflict({
            contentTypeId,
            currentVersion: versionOf(current),
            expectedVersion: options.expectedVersion,
            itemId: id,
          });
        }

        // The row is gone, so no version survives to hold this one. Recording
        // `version + 1` keeps the per-record history strictly increasing and
        // keeps the unique index meaningful - the alternative collides with the
        // revision that last wrote this version.
        const version = versionOf(row) + 1;
        const revisionId = await capture(tx, {
          actor: options.actor,
          changedFields: [],
          operation: "delete",
          row,
          version,
        });

        return {
          changed: true,
          changedFields: [],
          operation: "delete",
          previousSlug: slugOf(row),
          restoredFromRevisionId: null,
          revisionId,
          row: toRow(row),
          version,
        };
      }),

    publish: async (id, options) =>
      await transition(
        id,
        options,
        "publish",
        {
          // COALESCE, so a republish keeps the original date. `publishedAt` is
          // the first-published timestamp and is never rewritten.
          publishedAt: sql`coalesce(${columns.publishedAt}, now())`,
          status: "published",
        },
        ne(columns.status, "published"),
      ),

    restore: async (id, revisionId, options) =>
      await transact(options, async tx => {
        const revision = await revisions.findById(id, revisionId, tx);
        if (!revision) return null;

        const current = await readOne(id, tx);
        if (!current) return null;

        // Currently declared fields only. A field the content type has since
        // dropped is ignored; one added since is absent, so the record keeps
        // what it has.
        const projected = projectRevisionSnapshot(
          definition,
          revision.snapshot,
        );

        const parsed = schemas.update.safeParse(projected);
        if (!parsed.success) {
          throw new ContentRevisionNotRestorable({
            contentTypeId,
            // Field names only - never the issue tree, which names internal
            // paths and is already described by the route's OpenAPI schema.
            fields: [
              ...new Set(
                parsed.error.issues
                  .map(issue => String(issue.path[0] ?? ""))
                  .filter(name => name !== ""),
              ),
            ],
            revisionId,
          });
        }

        const patch = withUpdateSlugs(parsed.data);
        const changedFields = diffChangedFields(fieldNames, current, patch);

        if (changedFields.length === 0) {
          return {
            changed: false,
            changedFields,
            operation: "restore" as const,
            previousSlug: slugOf(current),
            // Nothing was restored, so nothing was restored *from*.
            restoredFromRevisionId: null,
            revisionId: null,
            row: toRow(current),
            version: versionOf(current),
          };
        }

        const row = await guardedWrite(
          tx,
          id,
          options.expectedVersion,
          toColumnValues(
            fields,
            Object.fromEntries(changedFields.map(key => [key, patch[key]])),
          ),
        );
        if (!row) return null;

        const version = versionOf(row);
        const newRevisionId = await capture(tx, {
          actor: options.actor,
          changedFields,
          operation: "restore",
          restoredFromRevisionId: revisionId,
          row,
          version,
        });

        return {
          changed: true,
          changedFields,
          operation: "restore" as const,
          previousSlug: slugOf(current),
          restoredFromRevisionId: revisionId,
          revisionId: newRevisionId,
          row: toRow(row),
          version,
        };
      }),

    revisions,

    schedules,

    unpublish: async (id, options) =>
      await transition(
        id,
        options,
        "unpublish",
        { status: "draft" },
        eq(columns.status, "published"),
      ),

    update: async (id, values, options) =>
      await transact(options, async tx => {
        // Parsed before the row is read, so an invalid payload never costs a
        // query. Slugs are normalised before the diff, so re-sending the stored
        // slug in a different case counts as no change.
        const patch = withUpdateSlugs(schemas.update.parse(values));

        const current = await readOne(id, tx);
        if (!current) return null;

        const changedFields = diffChangedFields(fieldNames, current, patch);

        // A no-op is still a *successful* write from the caller's point of view,
        // but it must not bump the version or leave a revision: an editor who
        // pressed save twice has not created two versions of anything. The stale
        // `expectedVersion` is deliberately not checked here - there is nothing
        // to overwrite, so there is nothing to conflict about.
        if (changedFields.length === 0) {
          return {
            changed: false,
            changedFields,
            operation: "update" as const,
            previousSlug: slugOf(current),
            restoredFromRevisionId: null,
            revisionId: null,
            row: toRow(current),
            version: versionOf(current),
          };
        }

        const row = await guardedWrite(
          tx,
          id,
          options.expectedVersion,
          toColumnValues(
            fields,
            Object.fromEntries(changedFields.map(key => [key, patch[key]])),
          ),
        );
        if (!row) return null;

        const version = versionOf(row);
        const revisionId = await capture(tx, {
          actor: options.actor,
          changedFields,
          operation: "update",
          row,
          version,
        });

        return {
          changed: true,
          changedFields,
          operation: "update" as const,
          previousSlug: slugOf(current),
          restoredFromRevisionId: null,
          revisionId,
          row: toRow(row),
          version,
        };
      }),
  };
};
