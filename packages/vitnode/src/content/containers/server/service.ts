import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";
import type { z } from "zod";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { ContentDatabase } from "../../server/service";
import type { AnyContentTypeDefinition } from "../../types";
import type {
  ContentContainerPolicy,
  ContentContainerPolicyOverrides,
  EffectiveContentContainerPolicy,
} from "../policies";
import type {
  AnyContentContainerDefinition,
  ContentContainerCreateInput,
  ContentContainerErrorCode,
  ContentContainerMoveInput,
  ContentContainerPublicRecord,
  ContentContainerRecord,
  ContentContainerUpdateInput,
} from "../types";

import { core_content_containers } from "../../../database/content-containers";
import { invalidatePageCacheTags } from "../../../page-cache/store.server";
import { expireContentAccessFamily } from "../../access/server/invalidate";
import { deleteContentAccessRules } from "../../access/server/rules";
import { contentContainerTag } from "../../cache";
import { contentDefinitionOf } from "../../server/model";
import {
  bumpContentContainerGeneration,
  rememberContentContainerTree,
} from "../../server/public-cache";
import { syncContentSearchContainerDependents } from "../../server/search-sync";
import { slugify } from "../../slug";
import {
  contentContainerFieldOf,
  contentContainerSourceOf,
} from "../association";
import {
  CONTENT_CONTAINER_MAX_PER_DEFINITION,
  CONTENT_CONTAINER_SLUG_MAX_LENGTH,
} from "../const";
import { ContentContainerError } from "../errors";
import {
  contentContainerPolicyFallback,
  readContentContainerPolicyOverrides,
  resolveContentContainerPolicy,
  zodContentContainerPolicyOverrides,
} from "../policies";
import {
  contentContainerAncestors,
  contentContainerSubtreeIds,
  orderContentContainers,
  planContentContainerCreate,
  planContentContainerDelete,
  planContentContainerMove,
} from "../tree";

type ContainerRow = typeof core_content_containers.$inferSelect;

export type ContentContainerUsageCheck = (
  tx: ContentDatabase,
  containerIds: readonly number[],
) => Promise<boolean>;

export interface ContentContainerReferencingModel {
  column: PgColumn;
  table: PgTable;
}

export const contentContainerReferencingModels = (
  c: Context,
  definitionId: string,
): ContentContainerReferencingModel[] => {
  const models = c.get("core")?.contentModels ?? [];

  return models.flatMap(({ model }) => {
    const container = contentContainerFieldOf(contentDefinitionOf(model));
    if (container?.field.definition.id !== definitionId) return [];

    const column = (model.columns as Record<string, PgColumn>)[container.name];

    return column ? [{ column, table: model.table }] : [];
  });
};

export const contentContainerUsageFrom =
  (
    models: readonly ContentContainerReferencingModel[],
  ): ContentContainerUsageCheck =>
  async (tx, containerIds) => {
    if (containerIds.length === 0) return false;

    for (const { column, table } of models) {
      const [row] = await tx
        .select({ value: column })
        .from(table)
        .where(inArray(column, [...containerIds]))
        .limit(1);
      if (row) return true;
    }

    return false;
  };

export interface ContentContainerService<
  TDefinition extends AnyContentContainerDefinition,
> {
  ancestors: (id: number) => Promise<ContentContainerRecord<TDefinition>[]>;
  children: (
    parentId: null | number,
  ) => Promise<ContentContainerRecord<TDefinition>[]>;
  create: (
    input: ContentContainerCreateInput<TDefinition>,
  ) => Promise<ContentContainerRecord<TDefinition>>;
  delete: (id: number) => Promise<void>;
  descendantIds: (id: number) => Promise<null | number[]>;
  findById: (id: number) => Promise<ContentContainerRecord<TDefinition> | null>;
  findBySlug: (
    slug: string,
  ) => Promise<ContentContainerRecord<TDefinition> | null>;
  list: () => Promise<ContentContainerRecord<TDefinition>[]>;
  move: (
    id: number,
    input: ContentContainerMoveInput,
  ) => Promise<ContentContainerRecord<TDefinition>>;
  policies: (id: number) => Promise<ContentContainerPolicyReport>;
  toPublic: (
    record: ContentContainerRecord<TDefinition>,
  ) => ContentContainerPublicRecord<TDefinition>;
  update: (
    id: number,
    input: ContentContainerUpdateInput<TDefinition>,
  ) => Promise<ContentContainerRecord<TDefinition>>;
  updatePolicies: (
    id: number,
    overrides: unknown,
  ) => Promise<ContentContainerPolicyReport>;
}

export interface ContentContainerPolicyReport {
  contentTypes: {
    contentTypeId: string;
    effective: ContentContainerPolicy;
    /** What applies once this container's own overrides are taken away. */
    inherited: ContentContainerPolicy;
    pluginId: string;
    sources: EffectiveContentContainerPolicy["sources"];
  }[];
  id: number;
  overrides: ContentContainerPolicyOverrides;
}

/** Content types filed in a container collection, directly or through a relation. */
export const contentTypesInContainer = (
  c: Context,
  definitionId: string,
): { definition: AnyContentTypeDefinition; pluginId: string }[] =>
  (c.get("core")?.contentModels ?? []).flatMap(({ model, pluginId }) => {
    const definition = contentDefinitionOf(model);

    return contentContainerSourceOf(definition)?.container?.id ===
      definitionId && definition.publicWrite.enabled
      ? [{ definition, pluginId }]
      : [];
  });

const zodErrorMessage = (error: z.ZodError): string =>
  error.issues
    .map(issue =>
      issue.path.length > 0
        ? `${issue.path.join(".")}: ${issue.message}`
        : issue.message,
    )
    .join("; ");

export const contentContainerInputRefusal = (
  error: z.ZodError,
): { code: "invalidInput" | "invalidMetadata"; message: string } => ({
  code: error.issues.some(issue => issue.path[0] === "metadata")
    ? "invalidMetadata"
    : "invalidInput",
  message: zodErrorMessage(error),
});

/**
 * The server service for one container collection: list, read, create,
 * update, move and delete containers, and read or change their publishing
 * policies. The AdminCP routes use it, and it emits the
 * `content.container.*` events, so custom code calling it emits the same ones.
 * Server-only.
 *
 * `usage` decides whether a container still holds content before a delete;
 * it defaults to checking every content model that references this collection.
 *
 * @throws {ContentContainerError} With a `code` such as `notFound`,
 * `slugTaken`, `hasContent` or `invalidMetadata`.
 */
export const createContentContainerService = <
  TDefinition extends AnyContentContainerDefinition,
>(
  c: Context,
  {
    definition,
    pluginId,
    usage,
  }: {
    definition: TDefinition;
    pluginId: string;
    usage?: ContentContainerUsageCheck;
  },
): ContentContainerService<TDefinition> => {
  const definitionId = definition.id;
  const fieldNames = Object.keys(definition.fields);
  const rules = {
    hierarchy: definition.hierarchy.enabled,
    maxDepth: definition.hierarchy.maxDepth,
    mode: definition.ordering.mode,
  };
  const inUse =
    usage ??
    contentContainerUsageFrom(
      contentContainerReferencingModels(c, definitionId),
    );

  const refuse = (code: ContentContainerErrorCode, message?: string): never => {
    throw new ContentContainerError({ code, definitionId, message });
  };

  const readAll = async (db: ContentDatabase): Promise<ContainerRow[]> =>
    await db
      .select()
      .from(core_content_containers)
      .where(eq(core_content_containers.definitionId, definitionId));

  /**
   * Only what a subtree walk needs, cached per collection: a public list filtered
   * by container asks for this on every request, and the full rows carry every
   * container's metadata JSON for nothing.
   */
  const readTree = async (): Promise<
    { id: number; parentId: null | number }[]
  > =>
    await rememberContentContainerTree(
      c,
      definitionId,
      async () =>
        await c
          .get("db")
          .select({
            id: core_content_containers.id,
            parentId: core_content_containers.parentId,
          })
          .from(core_content_containers)
          .where(eq(core_content_containers.definitionId, definitionId)),
    );

  const lock = async (tx: ContentDatabase): Promise<void> => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`core_content_containers:${definitionId}`}))`,
    );
  };

  const toRecord = (
    row: ContainerRow,
    depth: number,
  ): ContentContainerRecord<TDefinition> =>
    ({
      createdAt: row.createdAt,
      depth,
      id: row.id,
      metadata: Object.fromEntries(
        fieldNames.map(name => [name, row.metadata[name] ?? null]),
      ),
      name: row.name,
      parentId: row.parentId,
      position: row.position,
      slug: row.slug,
      updatedAt: row.updatedAt,
    }) as ContentContainerRecord<TDefinition>;

  const ordered = (rows: readonly ContainerRow[]) =>
    orderContentContainers(rows, definition.ordering.mode).map(row =>
      toRecord(row, row.depth),
    );

  const recordOf = (
    rows: readonly ContainerRow[],
    id: number,
  ): ContentContainerRecord<TDefinition> | null =>
    ordered(rows).find(record => record.id === id) ?? null;

  const parseMetadata = (
    schema: z.ZodType,
    value: unknown,
  ): Record<string, unknown> => {
    const parsed = schema.safeParse(value ?? {});
    if (!parsed.success) {
      return refuse("invalidMetadata", zodErrorMessage(parsed.error));
    }

    return parsed.data as Record<string, unknown>;
  };

  const normalizeSlug = (value: string): string => {
    const slug = slugify(value, CONTENT_CONTAINER_SLUG_MAX_LENGTH);
    if (slug === "") return refuse("slugEmpty");

    return slug;
  };

  const resolveSlug = (
    rows: readonly ContainerRow[],
    {
      explicit,
      from,
      self,
    }: { explicit?: string; from: string; self?: number },
  ): string => {
    const taken = new Set(
      rows.filter(row => row.id !== self).map(row => row.slug),
    );

    if (explicit !== undefined) {
      const slug = normalizeSlug(explicit);
      if (taken.has(slug)) refuse("slugTaken");

      return slug;
    }

    const base =
      slugify(from, CONTENT_CONTAINER_SLUG_MAX_LENGTH) || "container";
    let candidate = base;
    for (let suffix = 2; taken.has(candidate); suffix++) {
      const tail = `-${suffix}`;
      candidate = `${base.slice(0, CONTENT_CONTAINER_SLUG_MAX_LENGTH - tail.length)}${tail}`;
    }

    return candidate;
  };

  const applyPlacements = async (
    tx: ContentDatabase,
    placements: readonly {
      id: number;
      parentId: null | number;
      position: number;
    }[],
  ): Promise<void> => {
    for (const placement of placements) {
      await tx
        .update(core_content_containers)
        .set({
          parentId: placement.parentId,
          position: placement.position,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(core_content_containers.id, placement.id),
            eq(core_content_containers.definitionId, definitionId),
          ),
        );
    }
  };

  const expire = async (mode: "hard" | "soft"): Promise<void> => {
    await bumpContentContainerGeneration(c, definitionId);
    await invalidatePageCacheTags([contentContainerTag(definitionId)], {
      mode,
    });
    // A move or a delete changes who may read the subtree, so everything the
    // collection's access rules decided goes too.
    if (definition.access.enabled) {
      await expireContentAccessFamily(c, {
        id: definitionId,
        kind: "container",
      });
    }
  };

  const emit = async <
    TName extends
      | "content.container.created"
      | "content.container.deleted"
      | "content.container.moved"
      | "content.container.updated",
  >(
    name: TName,
    payload: Record<string, unknown>,
  ): Promise<void> => {
    await c
      .get("events")
      .emit(name, { definitionId, pluginId, ...payload } as never);
  };

  const parseInput = <TSchema extends z.ZodType>(
    schema: TSchema,
    input: unknown,
  ): z.infer<TSchema> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const { code, message } = contentContainerInputRefusal(parsed.error);

      return refuse(code, message);
    }

    return parsed.data;
  };

  const policyReport = (
    rows: readonly ContainerRow[],
    id: number,
  ): ContentContainerPolicyReport => {
    const byId = new Map(rows.map(row => [row.id, row]));
    const self = byId.get(id) ?? refuse("notFound");
    const chain = [self, ...contentContainerAncestors(rows, id).reverse()].map(
      row => ({
        id: row.id,
        policies: readContentContainerPolicyOverrides(row.policies),
      }),
    );

    return {
      contentTypes: contentTypesInContainer(c, definitionId).map(
        ({ definition: contentType, pluginId: owner }) => {
          const input = {
            contentTypeId: contentType.id,
            fallback: contentContainerPolicyFallback(contentType),
            policies: definition.policies,
          };
          const { policy, sources } = resolveContentContainerPolicy({
            ...input,
            chain,
          });

          return {
            contentTypeId: contentType.id,
            effective: policy,
            inherited: resolveContentContainerPolicy({
              ...input,
              chain: chain.slice(1),
            }).policy,
            pluginId: owner,
            sources,
          };
        },
      ),
      id,
      overrides: chain[0]?.policies ?? {},
    };
  };

  return {
    ancestors: async id => {
      const rows = await readAll(c.get("db"));
      const records = new Map(ordered(rows).map(record => [record.id, record]));

      return contentContainerAncestors(rows, id).flatMap(row => {
        const record = records.get(row.id);

        return record ? [record] : [];
      });
    },

    children: async parentId =>
      ordered(await readAll(c.get("db"))).filter(
        record => record.parentId === parentId,
      ),

    create: async input => {
      const values = parseInput(definition.schemas.create, input) as {
        metadata?: Record<string, unknown>;
        name: string;
        parentId?: null | number;
        position?: number;
        slug?: string;
      };
      const metadata = parseMetadata(
        definition.schemas.metadata,
        values.metadata,
      );
      const parentId = values.parentId ?? null;

      const created = await c.get("db").transaction(async tx => {
        await lock(tx);
        const rows = await readAll(tx);
        if (rows.length >= CONTENT_CONTAINER_MAX_PER_DEFINITION) {
          refuse("limitReached");
        }

        const plan = planContentContainerCreate(
          rows,
          { parentId, position: values.position },
          rules,
        );
        if (!plan.ok) return refuse(plan.code);

        const slug = resolveSlug(rows, {
          explicit: values.slug,
          from: values.name,
        });

        await applyPlacements(tx, plan.shifted);
        const [row] = await tx
          .insert(core_content_containers)
          .values({
            definitionId,
            metadata,
            name: values.name,
            parentId,
            pluginId,
            position: plan.position,
            slug,
          })
          .returning();

        return recordOf([...rows, row], row.id) ?? refuse("notFound");
      });

      await expire("soft");
      await emit("content.container.created", {
        containerId: created.id,
        parentId: created.parentId,
      });

      return created;
    },

    delete: async id => {
      const removed = await c.get("db").transaction(async tx => {
        await lock(tx);
        const rows = await readAll(tx);
        const plan = planContentContainerDelete(rows, id);
        if (!plan.ok) return refuse(plan.code);
        if (await inUse(tx, [id])) refuse("hasContent");

        const row =
          rows.find(candidate => candidate.id === id) ?? refuse("notFound");
        await tx
          .delete(core_content_containers)
          .where(
            and(
              eq(core_content_containers.id, id),
              eq(core_content_containers.definitionId, definitionId),
            ),
          );
        await deleteContentAccessRules(tx, definitionId, [String(id)]);
        await applyPlacements(tx, plan.shifted);

        return row;
      });

      await expire("hard");
      await emit("content.container.deleted", {
        containerId: removed.id,
        parentId: removed.parentId,
      });
    },

    descendantIds: async id => {
      const rows = await readTree();
      if (!rows.some(row => row.id === id)) return null;

      return [...contentContainerSubtreeIds(rows, id)];
    },

    findById: async id => {
      if (!Number.isSafeInteger(id) || id <= 0) return null;
      const rows = await readAll(c.get("db"));

      return recordOf(rows, id);
    },

    findBySlug: async slug => {
      const rows = await readAll(c.get("db"));
      const row = rows.find(candidate => candidate.slug === slug);

      return row ? recordOf(rows, row.id) : null;
    },

    list: async () => ordered(await readAll(c.get("db"))),

    move: async (id, input) => {
      const { parentId, position } = parseInput(
        definition.schemas.move,
        input,
      ) as unknown as ContentContainerMoveInput;

      const { changed, from, moved } = await c
        .get("db")
        .transaction(async tx => {
          await lock(tx);
          const rows = await readAll(tx);
          const plan = planContentContainerMove(
            rows,
            { id, parentId, position },
            rules,
          );
          if (!plan.ok) return refuse(plan.code);

          const before = rows.find(row => row.id === id) ?? refuse("notFound");
          await applyPlacements(tx, plan.placements);
          const placed = new Map(plan.placements.map(item => [item.id, item]));
          const after = rows.map(row => {
            const placement = placed.get(row.id);

            return placement ? { ...row, ...placement } : row;
          });

          return {
            changed: plan.placements.length > 0,
            from: before.parentId,
            moved: recordOf(after, id) ?? refuse("notFound"),
          };
        });

      if (!changed) return moved;

      await expire("soft");
      await emit("content.container.moved", {
        containerId: moved.id,
        fromParentId: from,
        parentId: moved.parentId,
        position: moved.position,
      });

      return moved;
    },

    toPublic: record =>
      ({
        depth: record.depth,
        id: record.id,
        metadata: Object.fromEntries(
          definition.publicApi.fields.map(name => [
            name,
            (record.metadata as Record<string, unknown>)[name] ?? null,
          ]),
        ),
        name: record.name,
        parentId: record.parentId,
        position: record.position,
        slug: record.slug,
      }) as ContentContainerPublicRecord<TDefinition>,

    policies: async id => {
      if (!definition.policies.enabled) return refuse("invalidPolicy");

      return policyReport(await readAll(c.get("db")), id);
    },

    updatePolicies: async (id, input) => {
      if (!definition.policies.enabled) return refuse("invalidPolicy");

      const parsed = zodContentContainerPolicyOverrides.safeParse(input);
      if (!parsed.success) {
        return refuse("invalidPolicy", zodErrorMessage(parsed.error));
      }
      const allowed = new Set(
        contentTypesInContainer(c, definitionId).map(
          entry => entry.definition.id,
        ),
      );
      const stranger = Object.keys(parsed.data).find(key => !allowed.has(key));
      if (stranger !== undefined) {
        return refuse(
          "invalidPolicy",
          `"${stranger}" is not a content type filed in this collection.`,
        );
      }
      const overrides = Object.fromEntries(
        Object.entries(readContentContainerPolicyOverrides(parsed.data)).filter(
          ([, value]) => Object.keys(value).length > 0,
        ),
      );

      const { changed, report } = await c.get("db").transaction(async tx => {
        await lock(tx);
        const rows = await readAll(tx);
        const row = rows.find(candidate => candidate.id === id);
        if (!row) return refuse("notFound");

        const changed =
          JSON.stringify(readContentContainerPolicyOverrides(row.policies)) !==
          JSON.stringify(overrides);
        if (changed) {
          await tx
            .update(core_content_containers)
            .set({ policies: overrides, updatedAt: new Date() })
            .where(
              and(
                eq(core_content_containers.id, id),
                eq(core_content_containers.definitionId, definitionId),
              ),
            );
        }

        return {
          changed,
          report: policyReport(
            rows.map(candidate =>
              candidate.id === id
                ? { ...candidate, policies: overrides }
                : candidate,
            ),
            id,
          ),
        };
      });

      if (changed) {
        await expire("soft");
        const record = await c
          .get("db")
          .select({ parentId: core_content_containers.parentId })
          .from(core_content_containers)
          .where(eq(core_content_containers.id, id))
          .limit(1);
        await emit("content.container.updated", {
          changedFields: ["policies"],
          containerId: id,
          parentId: record[0]?.parentId ?? null,
        });
      }

      return report;
    },

    update: async (id, input) => {
      const values = parseInput(definition.schemas.update, input) as {
        metadata?: Record<string, unknown>;
        name?: string;
        slug?: string;
      };
      const patch =
        values.metadata === undefined
          ? undefined
          : parseMetadata(definition.schemas.metadataPatch, values.metadata);

      const { changedFields, record, slugChanged } = await c
        .get("db")
        .transaction(async tx => {
          await lock(tx);
          const rows = await readAll(tx);
          const row = rows.find(candidate => candidate.id === id);
          if (!row) return refuse("notFound");

          const slug =
            values.slug === undefined
              ? row.slug
              : resolveSlug(rows, {
                  explicit: values.slug,
                  from: row.name,
                  self: id,
                });
          const metadata = patch
            ? parseMetadata(definition.schemas.metadata, {
                ...Object.fromEntries(
                  Object.entries(row.metadata).filter(([key]) =>
                    Object.hasOwn(definition.fields, key),
                  ),
                ),
                ...patch,
              })
            : row.metadata;
          const name = values.name ?? row.name;

          const changed = [
            ...(name === row.name ? [] : ["name"]),
            ...(slug === row.slug ? [] : ["slug"]),
            ...Object.keys(patch ?? {}).filter(
              key =>
                JSON.stringify(row.metadata[key] ?? null) !==
                JSON.stringify(metadata[key] ?? null),
            ),
          ];

          const [updated] =
            changed.length === 0
              ? [row]
              : await tx
                  .update(core_content_containers)
                  .set({ metadata, name, slug, updatedAt: new Date() })
                  .where(
                    and(
                      eq(core_content_containers.id, id),
                      eq(core_content_containers.definitionId, definitionId),
                    ),
                  )
                  .returning();

          return {
            changedFields: changed,
            record:
              recordOf(
                rows.map(candidate =>
                  candidate.id === id ? updated : candidate,
                ),
                id,
              ) ?? refuse("notFound"),
            slugChanged: slug !== row.slug,
          };
        });

      if (changedFields.length > 0) {
        await expire(slugChanged ? "hard" : "soft");
        await emit("content.container.updated", {
          changedFields,
          containerId: record.id,
          parentId: record.parentId,
        });
      }

      if (changedFields.includes("name") || changedFields.includes("slug")) {
        await syncContentSearchContainerDependents(c, {
          container: record,
          containerType: definitionId,
        });
      }

      return record;
    },
  };
};
