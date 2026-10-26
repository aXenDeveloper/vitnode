import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq, getColumns, getColumnTable, inArray } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";

import type { ContentSubmissionRow } from "../approvals/server/submissions";
import type { EffectiveContentContainerPolicy } from "../containers/policies";
import type { ContentRecordContainer } from "../containers/server/policy";
import type { ContentId, ContentIdOf } from "../ids";
import type {
  AnyContentTypeDefinition,
  ContentPublicationStatus,
  ContentPublicCreateInput,
  ContentPublicUpdateBody,
  ContentPublicWriteRecord,
} from "../types";
import type { ContentModel } from "./model";
import type { ContentPublicWriteActor } from "./public-write-authorization";
import type { ContentDatabase } from "./service";

import {
  emitContentApprovalSubmitted,
  findLatestContentSubmission,
  findPendingContentSubmission,
  openContentSubmission,
  refreshContentSubmissionValues,
  toContentApprovalState,
} from "../approvals/server/submissions";
import {
  CONTENT_PERMISSIONS,
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
} from "../const";
import {
  ContentContainerAssignmentError,
  contentContainerSourceOf,
} from "../containers/association";
import {
  canModerateContent,
  effectiveContentPolicy,
  resolveContentRowContainer,
  resolveContentWriteContainer,
} from "../containers/server/policy";
import {
  ContentEngineError,
  ContentPublicWriteDenied,
  ContentPublicWriteInputError,
  ContentVersionConflict,
} from "../errors";
import { contentIdKey, requireContentId } from "../ids";
import { isContentReferenceCollection } from "../paths";
import { canViewHiddenContentRecord } from "./hidden-access";
import {
  authorizeContentPublicWrite,
  contentPublicWriteRefusal,
  resolveContentPublicWriteActor,
} from "./public-write-authorization";
import { publicationMethods } from "./publication";
import { ContentThreadPlacementError } from "./thread";
import { isContentBaseRowPublic } from "./visibility";
import {
  contentEditorialWriteEffects,
  contentPlainWriteEffects,
} from "./write-effects";

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
  c: Context;
  container: ContentRecordContainer | null;
  definition: AnyContentTypeDefinition;
  operation: "create";
  pluginId: string;
}

export interface ContentPublicationDecision {
  /** The record waits for a moderator: it is stored as a draft with a submission. */
  approval: boolean;
  policy: EffectiveContentContainerPolicy | null;
  status: ContentPublicationStatus;
}

/**
 * How a member's new record is published - decided on the server from the
 * container it is filed in, never from the payload.
 *
 * Without container policies it is the content type's own
 * `publicWrite.create.status`. With them, `publish: "approve"` stores a draft
 * and opens a submission, unless the author may approve in that container.
 */
export const resolveContentPublicationPolicy = async ({
  c,
  container,
  definition,
  pluginId,
}: ContentPublicationPolicyInput): Promise<ContentPublicationDecision> => {
  const policy = effectiveContentPolicy(definition, container);
  if (!policy) {
    return {
      approval: false,
      policy: null,
      status: definition.publicWrite.create.status,
    };
  }

  const can = async (permission: string) =>
    await canModerateContent(c, {
      container,
      definition,
      permission,
      pluginId,
    });

  if (
    policy.policy.create === "moderators" &&
    !(await can(CONTENT_PERMISSIONS.edit))
  ) {
    throw new ContentPublicWriteDenied({
      contentTypeId: definition.id,
      issue: CONTENT_PUBLIC_WRITE_ISSUE_CODES.moderatorsOnly,
      reason: "forbidden",
    });
  }

  if (
    policy.policy.publish === "immediate" ||
    (await can(CONTENT_PERMISSIONS.approve))
  ) {
    return { approval: false, policy, status: "published" };
  }

  return { approval: true, policy, status: "draft" };
};

/**
 * The service behind a content type's public-write routes, for a plugin's own
 * write route with the same ownership, authorization and effects. Acts as the
 * user session of `c`. `create` and `update` run the same write effects as the
 * generated routes (events, search) after the commit; an owner's edit that
 * needs review becomes a proposal and runs none of them. Server-only.
 *
 * @throws From its methods: `ContentPublicWriteDenied` for an unauthenticated,
 * forbidden or missing request (also `notFound` when `create`/`update` is off,
 * or `create` has no `ownerField`); `ContentPublicWriteInputError` for an
 * invalid relation target or container placement; a `ZodError` for invalid
 * values; `ContentVersionConflict` for a stale `expectedVersion`.
 */
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
  const containerSource = contentContainerSourceOf(definition);

  const readable = [
    ...new Set([...publicWrite.create.fields, ...publicWrite.update.fields]),
  ];
  const collectionFields = readable.filter(name =>
    isContentReferenceCollection(definition.fields[name]),
  );

  const deny = (
    reason: ContentPublicWriteDenied["reason"],
    issue: ContentPublicWriteDenied["issue"] = null,
  ) => new ContentPublicWriteDenied({ contentTypeId, issue, reason });

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
      const rootTarget =
        field === definition.thread.rootField
          ? definition.fields[field]
          : undefined;
      if (rootTarget?.kind === "relation" && !rootTarget.self) {
        const contentTypeId = rootTarget.target().id;
        const hiddenIds = rows
          .filter(
            row =>
              !reachable.has(contentIdKey(row.id as ContentId)) &&
              isContentBaseRowPublic({ ...row, hiddenAt: null }),
          )
          .map(row => row.id as ContentId);
        const viewable = await Promise.all(
          hiddenIds.map(itemId =>
            canViewHiddenContentRecord(c, { contentTypeId, itemId }),
          ),
        );
        hiddenIds.forEach((id, index) => {
          if (viewable[index]) reachable.add(contentIdKey(id));
        });
      }
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

  const asInputError = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      if (
        !(error instanceof ContentContainerAssignmentError) &&
        !(error instanceof ContentThreadPlacementError)
      ) {
        throw error;
      }

      throw new ContentPublicWriteInputError({
        contentTypeId,
        field: error.field,
        message: error.detail,
      });
    }
  };

  const lockSelection = (): Record<string, PgColumn> => ({
    createdAt: columns.createdAt,
    id: columns.id,
    publishedAt: columns.publishedAt,
    status: columns.status,
    updatedAt: columns.updatedAt,
    ...(editorial ? { version: columns.version } : {}),
    ...(ownerField === null ? {} : { [ownerField]: columns[ownerField] }),
    ...(definition.visibility.enabled ? { hiddenAt: columns.hiddenAt } : {}),
    ...(containerSource && columns[containerSource.name]
      ? { [containerSource.name]: columns[containerSource.name] }
      : {}),
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

  const valuesOf = async (
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const id = requireContentId(definition.idStrategy, row.id, contentTypeId);
    const collections =
      collectionFields.length > 0
        ? await model
            .service(c)
            .advancedFields(id as ContentIdOf<TDefinition>, collectionFields)
        : {};

    return Object.fromEntries(
      readable.map(name => [name, collections[name] ?? row[name] ?? null]),
    );
  };

  const toRecord = async (
    row: Record<string, unknown>,
    approval: ContentSubmissionRow | null = null,
  ): Promise<ContentPublicWriteRecord<TDefinition>> => {
    const id = requireContentId(definition.idStrategy, row.id, contentTypeId);
    const slugField = definition.publicApi.slugField;
    const slug = slugField ? row[slugField] : null;

    return {
      approval: approval ? toContentApprovalState(approval) : null,
      id,
      publishedAt: (row.publishedAt as Date | null | undefined) ?? null,
      slug: typeof slug === "string" ? slug : null,
      status: row.status as ContentPublicationStatus,
      values: await valuesOf(row),
      ...(editorial ? { version: row.version as number } : {}),
    } as unknown as ContentPublicWriteRecord<TDefinition>;
  };

  /** The submission an author should see: a pending one, or a rejection nothing replaced. */
  const visibleSubmission = async (
    id: ContentId,
  ): Promise<ContentSubmissionRow | null> => {
    const latest = await findLatestContentSubmission(
      c.get("db"),
      definition,
      id,
    );

    return latest?.status === "pending" || latest?.status === "rejected"
      ? latest
      : null;
  };

  const authorize = async (
    tx: ContentDatabase,
    actor: ContentPublicWriteActor,
    row: null | Record<string, unknown>,
  ) => {
    if (!row) throw deny("notFound");

    const container = await resolveContentRowContainer(c, tx, definition, row);
    const policy = effectiveContentPolicy(definition, container);
    const decision = await authorizeContentPublicWrite(c, {
      action: "update",
      actor,
      container,
      definition,
      pluginId,
      policy,
      row,
    });
    if (!decision.allowed) {
      throw deny(
        contentPublicWriteRefusal(row),
        decision.reason === "editWindowClosed" &&
          contentPublicWriteRefusal(row) === "forbidden"
          ? CONTENT_PUBLIC_WRITE_ISSUE_CODES.editWindowClosed
          : null,
      );
    }

    return { container, policy, row, via: decision.via };
  };

  const canApprove = async (container: ContentRecordContainer | null) =>
    await canModerateContent(c, {
      container,
      definition,
      permission: CONTENT_PERMISSIONS.approve,
      pluginId,
    });

  /**
   * After an applied write to a record that is not public yet: a pending
   * create follows the draft, and a draft in an approval container that has
   * no pending submission is (re)submitted.
   */
  const syncDraftSubmission = async (
    tx: ContentDatabase,
    {
      actor,
      container,
      policy,
      row,
      via,
    }: {
      actor: ContentPublicWriteActor;
      container: ContentRecordContainer | null;
      policy: EffectiveContentContainerPolicy | null;
      row: Record<string, unknown>;
      via: "moderator" | "owner";
    },
  ): Promise<null | { replaced: null | number; row: ContentSubmissionRow }> => {
    if (!policy || row.status === "published") return null;

    const id = row.id as ContentId;
    const pending = await findPendingContentSubmission(tx, definition, id, {
      lock: true,
    });
    if (pending) {
      await refreshContentSubmissionValues(tx, pending.id, await valuesOf(row));

      return null;
    }
    if (via !== "owner" || policy.policy.publish !== "approve") return null;
    if (await canApprove(container)) return null;

    return await openContentSubmission(tx, {
      authorId: actor.userId,
      container,
      definition,
      itemId: id,
      kind: "create",
      pluginId,
      values: await valuesOf(row),
    });
  };

  const announce = async (
    opened: null | { replaced: null | number; row: ContentSubmissionRow },
  ): Promise<void> => {
    if (opened) await emitContentApprovalSubmitted(c, opened);
  };

  return {
    create: async values => {
      if (!publicWrite.create.enabled || ownerField === null) {
        throw deny("notFound");
      }
      const actor = requireActor();
      const parsed = schemas.create.parse(values) as Record<string, unknown>;
      const stamped = { ...parsed, [ownerField]: actor.userId };

      const prepare = async (tx: ContentDatabase) => {
        await assertPublicRelationTargets(tx, parsed);
        const container = await asInputError(
          async () =>
            await resolveContentWriteContainer(c, tx, definition, parsed),
        );
        const decision = await resolveContentPublicationPolicy({
          actor,
          c,
          container,
          definition,
          operation: "create",
          pluginId,
        });

        return { container, decision };
      };

      const submit = async (
        tx: ContentDatabase,
        row: Record<string, unknown>,
        container: ContentRecordContainer | null,
      ) =>
        await openContentSubmission(tx, {
          authorId: actor.userId,
          container,
          definition,
          itemId: row.id as ContentId,
          kind: "create",
          pluginId,
          values: await valuesOf(row),
        });

      if (editorial) {
        const service = editorialService();
        const { created, opened, published } = await c
          .get("db")
          .transaction(async tx => {
            const { container, decision } = await prepare(tx);
            const created = await asInputError(
              async () =>
                await service.create(stamped as never, {
                  actor,
                  tx,
                }),
            );
            const published =
              decision.status === "published"
                ? await service.publish(created.row.id as never, { actor, tx })
                : null;
            const opened = decision.approval
              ? await submit(tx, created.row, container)
              : null;

            return { created, opened, published };
          });

        await contentEditorialWriteEffects(c, model, {
          outcomes: [created, published],
          pluginId,
        });
        await announce(opened);

        return await toRecord(published?.row ?? created.row, opened?.row);
      }

      const service = model.service(c);
      const { opened, row, status } = await c
        .get("db")
        .transaction(async tx => {
          const { container, decision } = await prepare(tx);
          const created = await asInputError(
            async () => await service.create(stamped as never, { tx }),
          );
          if (decision.status !== "published") {
            return {
              opened: decision.approval
                ? await submit(tx, created, container)
                : null,
              row: created,
              status: decision.status,
            };
          }

          const result = await publicationMethods(definition, service).publish(
            created.id as never,
            { tx },
          );

          return {
            opened: null,
            row: result?.row ?? created,
            status: decision.status,
          };
        });

      await contentPlainWriteEffects(c, model, {
        operation: "create",
        pluginId,
        published: status === "published",
        row,
      });
      await announce(opened);

      return await toRecord(row, opened?.row);
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
      await authorize(c.get("db"), actor, row ?? null);

      const full = await model.service(c).findById(id);
      if (!full) throw deny("notFound");

      return await toRecord(full, await visibleSubmission(id));
    },

    update: async (id, body) => {
      if (!publicWrite.update.enabled) throw deny("notFound");
      const actor = requireActor();
      const { expectedVersion, values } = schemas.updateBody.parse(body) as {
        expectedVersion?: number;
        values: Record<string, unknown>;
      };

      /**
       * An owner's edit of a published record in a container that reviews
       * edits becomes a proposal. The live row - and its version - stay as
       * they are until a moderator approves.
       */
      const propose = async (
        tx: ContentDatabase,
        {
          container,
          row,
        }: {
          container: ContentRecordContainer | null;
          row: Record<string, unknown>;
        },
      ) => {
        if (editorial && (expectedVersion ?? 0) !== row.version) {
          throw new ContentVersionConflict({
            contentTypeId,
            currentVersion: row.version as number,
            expectedVersion: expectedVersion ?? 0,
            itemId: id,
          });
        }

        const full = await model.service(c).findById(id);
        if (!full) throw deny("notFound");
        const base = await valuesOf(full);
        const proposed = Object.fromEntries(
          publicWrite.update.fields.map(name => [
            name,
            Object.hasOwn(values, name) ? values[name] : (base[name] ?? null),
          ]),
        );

        const opened = await openContentSubmission(tx, {
          authorId: actor.userId,
          baseUpdatedAt: row.updatedAt as Date,
          baseValues: base,
          baseVersion: editorial ? (row.version as number) : null,
          container,
          definition,
          itemId: id,
          kind: "edit",
          pluginId,
          values: proposed,
        });

        return { full, opened };
      };

      const needsReview = async ({
        container,
        policy,
        row,
        via,
      }: Awaited<ReturnType<typeof authorize>>) =>
        via === "owner" &&
        policy?.policy.edits === "approve" &&
        row.status === "published" &&
        !(await canApprove(container));

      if (editorial) {
        const service = editorialService();
        const result = await c.get("db").transaction(async tx => {
          const access = await authorize(tx, actor, await lockRow(tx, id));
          await assertPublicRelationTargets(tx, values);

          if (await needsReview(access)) {
            return {
              kind: "proposal" as const,
              ...(await propose(tx, access)),
            };
          }

          const outcome = await service.update(id, values as never, {
            actor,
            expectedVersion: expectedVersion ?? 0,
            tx,
          });
          if (!outcome) throw deny("notFound");

          return {
            kind: "applied" as const,
            opened: await syncDraftSubmission(tx, {
              ...access,
              actor,
              row: outcome.row,
            }),
            outcome,
          };
        });

        if (result.kind === "proposal") {
          await announce(result.opened);

          return await toRecord(result.full, result.opened.row);
        }

        await contentEditorialWriteEffects(c, model, {
          outcomes: [result.outcome],
          pluginId,
        });
        await announce(result.opened);

        return await toRecord(result.outcome.row, await visibleSubmission(id));
      }

      const service = model.service(c);
      const result = await c.get("db").transaction(async tx => {
        const access = await authorize(tx, actor, await lockRow(tx, id));
        await assertPublicRelationTargets(tx, values);

        if (await needsReview(access)) {
          return { kind: "proposal" as const, ...(await propose(tx, access)) };
        }

        const updated = await service.update(id, values as never, { tx });
        if (!updated) throw deny("notFound");

        return {
          kind: "applied" as const,
          opened: await syncDraftSubmission(tx, {
            ...access,
            actor,
            row: updated.row,
          }),
          updated,
        };
      });

      if (result.kind === "proposal") {
        await announce(result.opened);

        return await toRecord(result.full, result.opened.row);
      }

      await contentPlainWriteEffects(c, model, {
        changedFields: result.updated.changedFields,
        operation: "update",
        pluginId,
        row: result.updated.row,
      });
      await announce(result.opened);

      return await toRecord(result.updated.row, await visibleSubmission(id));
    },
  };
};
