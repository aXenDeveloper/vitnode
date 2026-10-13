import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq, getColumns, getColumnTable, inArray } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import type { ResolvedContentContainerContext } from "../containers/server/assignment";
import type { ContentId, ContentIdOf } from "../ids";
import type {
  AnyContentTypeDefinition,
  ContentPublicationStatus,
  ContentPublicCreateInput,
  ContentPublicUpdateBody,
  ContentPublicWriteRecord,
} from "../types";
import type { ContentEditorialOutcome } from "./editorial-service";
import type { ContentModel } from "./model";
import type { ContentPublicWriteActor } from "./public-write-authorization";
import type { ContentDatabase } from "./service";

import { ContentContainerAssignmentError } from "../containers/association";
import { resolveContentContainerAssignment } from "../containers/server/assignment";
import {
  ContentEngineError,
  ContentPublicWriteDenied,
  ContentPublicWriteInputError,
} from "../errors";
import { contentIdKey, requireContentId } from "../ids";
import { isContentReferenceCollection } from "../paths";
import { contentEditorialEffects } from "./editorial-effects";
import { emitContentEvent } from "./emit";
import {
  authorizeContentPublicWrite,
  contentPublicWriteRefusal,
  resolveContentPublicWriteActor,
} from "./public-write-authorization";
import { publicationMethods } from "./publication";
import { contentSearchAdvancedValues, syncContentSearch } from "./search-sync";
import { isContentBaseRowPublic } from "./visibility";

export interface ContentPublicWriteService<TDefinition> {
  create: (
    values: ContentPublicCreateInput<TDefinition>,
  ) => Promise<ContentPublicWriteRecord<TDefinition>>;
  findEditable: (
    id: ContentIdOf<TDefinition>,
  ) => Promise<ContentPublicWriteRecord<TDefinition>>;
  update: (
    id: ContentIdOf<TDefinition>,
    body: ContentPublicUpdateBody<TDefinition>,
  ) => Promise<ContentPublicWriteRecord<TDefinition>>;
}

export interface ContentPublicationPolicyInput {
  actor: ContentPublicWriteActor;
  /**
   * The container the record is being created in, resolved on the server - or
   * `null` for a content type without one. Nothing reads it yet; it is here so
   * a per-container publishing mode can be decided without reshaping the
   * pipeline.
   */
  container: null | ResolvedContentContainerContext;
  definition: AnyContentTypeDefinition;
  operation: "create";
}

export const resolveContentPublicationPolicy = ({
  definition,
}: ContentPublicationPolicyInput): ContentPublicationStatus =>
  definition.publicWrite.create.status;

export const createContentPublicWriteService = <
  TDefinition extends AnyContentTypeDefinition,
>({
  c,
  model,
  pluginId,
}: {
  c: Context;
  model: ContentModel<TDefinition>;
  pluginId: string;
}): ContentPublicWriteService<TDefinition> => {
  const { definition } = model;
  const { publicWrite } = definition;
  const contentTypeId = definition.id;
  const editorial = definition.editorial.enabled;
  const ownerField = publicWrite.ownerField;
  const schemas = model.schemas.publicWrite;
  const table: PgTableWithColumns<TableConfig> = model.table;
  const columns = model.columns as Record<string, PgColumn>;

  const readable = [
    ...new Set([...publicWrite.create.fields, ...publicWrite.update.fields]),
  ];
  const collectionFields = readable.filter(name =>
    isContentReferenceCollection(definition.fields[name]),
  );

  const deny = (reason: ContentPublicWriteDenied["reason"]) =>
    new ContentPublicWriteDenied({ contentTypeId, reason });

  const requireActor = (): ContentPublicWriteActor => {
    const actor = resolveContentPublicWriteActor(c);
    if (!actor) throw deny("unauthenticated");

    return actor;
  };

  const editorialService = () => {
    const build = model.editorialService;
    if (!build) {
      throw new ContentEngineError(
        "This content type has no editorial workflow.",
        {
          contentTypeId,
        },
      );
    }

    return build(c, { pluginId });
  };

  const relationTargets = new Map<string, null | PgColumn>();
  const relationTargetOf = (field: string): null | PgColumn => {
    const cached = relationTargets.get(field);
    if (cached !== undefined) return cached;

    const fieldValue = definition.fields[field];
    const junction = model.advancedTables.junctions[field];
    const own = columns[field] as PgColumn | undefined;
    const references = getTableConfig(
      (isContentReferenceCollection(fieldValue) ? junction : table) as never,
    ).foreignKeys.map(foreignKey => foreignKey.reference());
    const reference = references.find(candidate =>
      candidate.columns.some(column =>
        isContentReferenceCollection(fieldValue)
          ? column.name === "relatedItemId"
          : column === own || column.name === own?.name,
      ),
    );
    const resolved = reference?.foreignColumns[0] ?? null;
    relationTargets.set(field, resolved);

    return resolved;
  };

  const assertPublicRelationTargets = async (
    tx: ContentDatabase,
    values: Record<string, unknown>,
  ): Promise<void> => {
    for (const [field, value] of Object.entries(values)) {
      if (definition.fields[field]?.kind !== "relation") continue;

      const ids = (
        Array.isArray(value)
          ? value
          : value === null || value === undefined
            ? []
            : [value]
      ) as ContentId[];
      if (ids.length === 0) continue;

      const target = relationTargetOf(field);
      if (!target) {
        throw new ContentEngineError(
          `The relation "${field}" has no foreign key to check its targets against.`,
          { contentTypeId },
        );
      }
      const targetTable = getColumnTable(target);
      const targetColumns = getColumns(targetTable) as Record<string, PgColumn>;

      const rows: Record<string, unknown>[] = await tx
        .select({
          id: target,
          publishedAt: targetColumns.publishedAt,
          status: targetColumns.status,
          ...(targetColumns.hiddenAt
            ? { hiddenAt: targetColumns.hiddenAt }
            : {}),
        })
        .from(targetTable)
        .where(inArray(target, ids));

      const reachable = new Set(
        rows
          .filter(row => isContentBaseRowPublic(row))
          .map(row => contentIdKey(row.id as ContentId)),
      );
      if (ids.every(id => reachable.has(contentIdKey(id)))) continue;

      throw new ContentPublicWriteInputError({
        contentTypeId,
        field,
        message:
          ids.length === 1
            ? "The selected record is not available."
            : "One of the selected records is not available.",
      });
    }
  };

  const resolveContainer = async (
    tx: ContentDatabase,
    values: Record<string, unknown>,
  ): Promise<null | ResolvedContentContainerContext> => {
    try {
      return (
        (await resolveContentContainerAssignment(tx, definition, values)) ??
        null
      );
    } catch (error) {
      if (!(error instanceof ContentContainerAssignmentError)) throw error;

      throw new ContentPublicWriteInputError({
        contentTypeId,
        field: error.field,
        message: error.detail,
      });
    }
  };

  const lockSelection = (): Record<string, PgColumn> => ({
    id: columns.id,
    publishedAt: columns.publishedAt,
    status: columns.status,
    ...(ownerField === null ? {} : { [ownerField]: columns[ownerField] }),
    ...(definition.visibility.enabled ? { hiddenAt: columns.hiddenAt } : {}),
  });

  const lockRow = async (
    tx: ContentDatabase,
    id: ContentId,
  ): Promise<null | Record<string, unknown>> => {
    const [row] = await tx
      .select(lockSelection())
      .from(table)
      .where(eq(columns.id, id))
      .limit(1)
      .for("update");

    return row ?? null;
  };

  const toRecord = async (
    row: Record<string, unknown>,
  ): Promise<ContentPublicWriteRecord<TDefinition>> => {
    const id = requireContentId(definition.idStrategy, row.id, contentTypeId);
    const collections =
      collectionFields.length > 0
        ? await model
            .service(c)
            .advancedFields(id as ContentIdOf<TDefinition>, collectionFields)
        : {};
    const slugField = definition.publicApi.slugField;
    const slug = slugField ? row[slugField] : null;

    return {
      id,
      publishedAt: (row.publishedAt as Date | null | undefined) ?? null,
      slug: typeof slug === "string" ? slug : null,
      status: row.status as ContentPublicationStatus,
      values: Object.fromEntries(
        readable.map(name => [name, collections[name] ?? row[name] ?? null]),
      ),
      ...(editorial ? { version: row.version as number } : {}),
    } as unknown as ContentPublicWriteRecord<TDefinition>;
  };

  const authorize = async (
    actor: ContentPublicWriteActor,
    row: null | Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    if (!row) throw deny("notFound");

    const decision = await authorizeContentPublicWrite(c, {
      action: "update",
      actor,
      definition,
      pluginId,
      row,
    });
    if (!decision.allowed) throw deny(contentPublicWriteRefusal(row));

    return row;
  };

  const plainEffects = async (
    operation: "create" | "update",
    row: Record<string, unknown>,
    {
      changedFields = [],
      published = false,
    }: { changedFields?: string[]; published?: boolean } = {},
  ): Promise<void> => {
    const id = row.id as ContentId;

    if (operation === "create") {
      await emitContentEvent(
        c,
        definition,
        "created",
        { contentId: id },
        { pluginId },
      );
      if (published && row.publishedAt instanceof Date) {
        await emitContentEvent(
          c,
          definition,
          "published",
          { contentId: id, publishedAt: row.publishedAt },
          { pluginId },
        );
      }
    } else if (changedFields.length > 0) {
      await emitContentEvent(
        c,
        definition,
        "updated",
        { changedFields, contentId: id },
        { pluginId },
      );
    }

    await syncContentSearch(c, definition, {
      advanced: await contentSearchAdvancedValues(
        c,
        model,
        requireContentId(definition.idStrategy, id, contentTypeId),
      ),
      ...(operation === "update" ? { changedFields } : {}),
      operation,
      pluginId,
      row,
    });
  };

  const editorialEffects = async (
    outcomes: (ContentEditorialOutcome<TDefinition> | null)[],
  ): Promise<void> => {
    for (const outcome of outcomes) {
      if (!outcome) continue;
      await contentEditorialEffects(c, definition, outcome, {
        model,
        pluginId,
      });
    }
  };

  return {
    create: async values => {
      if (!publicWrite.create.enabled || ownerField === null) {
        throw deny("notFound");
      }
      const actor = requireActor();
      const parsed = schemas.create.parse(values) as Record<string, unknown>;
      const stamped = { ...parsed, [ownerField]: actor.userId };

      // Resolved inside the write's transaction: the id is client-supplied, so
      // the container is read back and checked against the content type's
      // collection before anything is inserted, and the policy decides the
      // status with the real container in hand.
      const prepare = async (tx: ContentDatabase) => {
        await assertPublicRelationTargets(tx, parsed);
        const container = await resolveContainer(tx, parsed);

        return resolveContentPublicationPolicy({
          actor,
          container,
          definition,
          operation: "create",
        });
      };

      if (editorial) {
        const service = editorialService();
        const { created, published } = await c
          .get("db")
          .transaction(async tx => {
            const status = await prepare(tx);
            const created = await service.create(stamped as never, {
              actor,
              tx,
            });
            const published =
              status === "published"
                ? await service.publish(created.row.id as never, { actor, tx })
                : null;

            return { created, published };
          });

        await editorialEffects([created, published]);

        return await toRecord(published?.row ?? created.row);
      }

      const service = model.service(c);
      const { row, status } = await c.get("db").transaction(async tx => {
        const status = await prepare(tx);
        const created = await service.create(stamped as never, { tx });
        if (status !== "published") return { row: created, status };

        const result = await publicationMethods(definition, service).publish(
          created.id as never,
          { tx },
        );

        return { row: result?.row ?? created, status };
      });

      await plainEffects("create", row, {
        published: status === "published",
      });

      return await toRecord(row);
    },

    findEditable: async id => {
      if (!publicWrite.update.enabled) throw deny("notFound");
      const actor = requireActor();

      const [row] = await c
        .get("db")
        .select(lockSelection())
        .from(table)
        .where(eq(columns.id, id))
        .limit(1);
      await authorize(actor, row ?? null);

      const full = await model.service(c).findById(id);
      if (!full) throw deny("notFound");

      return await toRecord(full);
    },

    update: async (id, body) => {
      if (!publicWrite.update.enabled) throw deny("notFound");
      const actor = requireActor();
      const { expectedVersion, values } = schemas.updateBody.parse(body) as {
        expectedVersion?: number;
        values: Record<string, unknown>;
      };

      if (editorial) {
        const service = editorialService();
        const outcome = await c.get("db").transaction(async tx => {
          await authorize(actor, await lockRow(tx, id));
          await assertPublicRelationTargets(tx, values);

          return await service.update(id, values as never, {
            actor,
            expectedVersion: expectedVersion ?? 0,
            tx,
          });
        });
        if (!outcome) throw deny("notFound");

        await editorialEffects([outcome]);

        return await toRecord(outcome.row);
      }

      const service = model.service(c);
      const result = await c.get("db").transaction(async tx => {
        await authorize(actor, await lockRow(tx, id));
        await assertPublicRelationTargets(tx, values);

        return await service.update(id, values as never, { tx });
      });
      if (!result) throw deny("notFound");

      await plainEffects("update", result.row, {
        changedFields: result.changedFields,
      });

      return await toRecord(result.row);
    },
  };
};
