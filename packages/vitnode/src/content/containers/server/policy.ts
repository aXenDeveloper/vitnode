import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { eq, inArray } from "drizzle-orm";

import type { ContentId } from "../../ids";
import type { ContentDatabase } from "../../server/service";
import type { AnyContentTypeDefinition } from "../../types";
import type {
  ContentContainerPolicyOverrides,
  EffectiveContentContainerPolicy,
} from "../policies";
import type { AnyContentContainerDefinition } from "../types";
import type { ResolvedContentContainerContext } from "./assignment";

import { resolveStaffPermissions } from "../../../api/lib/check-staff-permission";
import { hasStaffPermission } from "../../../api/lib/staff-permission";
import { core_content_containers } from "../../../database/content-containers";
import {
  ContentContainerAssignmentError,
  contentContainerSourceOf,
} from "../association";
import {
  CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH,
  CONTENT_CONTAINER_TREE_SUFFIX,
} from "../const";
import {
  contentContainerPolicyFallback,
  readContentContainerPolicyOverrides,
  resolveContentContainerPolicy,
} from "../policies";
import { resolveContentContainerAssignment } from "./assignment";

export interface ContentContainerChainEntry {
  definitionId: string;
  id: number;
  parentId: null | number;
  pluginId: string;
  policies: ContentContainerPolicyOverrides;
  slug: string;
}

/**
 * Where a record lives, as the server resolved it - never what a client sent.
 * `chain` is the container followed by its ancestors, nearest first.
 */
export interface ContentRecordContainer {
  chain: ContentContainerChainEntry[];
  container: ResolvedContentContainerContext;
  definition: AnyContentContainerDefinition;
}

const chainSelection = {
  definitionId: core_content_containers.definitionId,
  id: core_content_containers.id,
  parentId: core_content_containers.parentId,
  pluginId: core_content_containers.pluginId,
  policies: core_content_containers.policies,
  slug: core_content_containers.slug,
};

export const loadContentContainerChain = async (
  db: ContentDatabase,
  containerId: number,
): Promise<ContentContainerChainEntry[]> => {
  const chain: ContentContainerChainEntry[] = [];
  const seen = new Set<number>();
  let next: null | number = containerId;

  while (
    next !== null &&
    !seen.has(next) &&
    chain.length < CONTENT_CONTAINER_ABSOLUTE_MAX_DEPTH
  ) {
    seen.add(next);
    const [row] = await db
      .select(chainSelection)
      .from(core_content_containers)
      .where(eq(core_content_containers.id, next))
      .limit(1);
    if (!row) break;

    chain.push({
      ...row,
      policies: readContentContainerPolicyOverrides(row.policies),
    });
    next = row.parentId;
  }

  return chain;
};

const modelOf = (c: Context, contentTypeId: string) =>
  (c.get("core")?.contentModels ?? []).find(
    entry => entry.model.definition.id === contentTypeId,
  )?.model;

/**
 * The container id a related record is filed in, for a content type whose
 * container comes from `field.relation({ container: true })`.
 */
const containerOfRelated = async (
  c: Context,
  db: ContentDatabase,
  definition: AnyContentTypeDefinition,
  relatedId: unknown,
): Promise<null | number> => {
  const source = contentContainerSourceOf(definition);
  if (source?.kind !== "relation" || !source.target) return null;
  if (relatedId === null || relatedId === undefined) return null;

  const target = source.target;
  const targetSource = contentContainerSourceOf(target);
  const model = modelOf(c, target.id);
  if (!model || targetSource?.kind !== "field") {
    throw new ContentContainerAssignmentError({
      code: "CONTAINER_NOT_FOUND",
      contentTypeId: definition.id,
      field: source.name,
    });
  }

  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTable = model.table;
  const [row] = await db
    .select({ value: columns[targetSource.name] })
    .from(table)
    .where(eq(columns.id, relatedId as ContentId))
    .limit(1);
  const value: unknown = row?.value;

  return typeof value === "number" ? value : null;
};

const toContext = async (
  db: ContentDatabase,
  definition: AnyContentContainerDefinition,
  containerId: null | number,
): Promise<ContentRecordContainer | null> => {
  if (containerId === null) return null;
  const chain = await loadContentContainerChain(db, containerId);
  const [self] = chain;
  if (self?.definitionId !== definition.id) return null;

  return {
    chain,
    container: {
      definitionId: self.definitionId,
      id: self.id,
      parentId: self.parentId,
      pluginId: self.pluginId,
      slug: self.slug,
    },
    definition,
  };
};

/**
 * The container a new record would be filed in, from the values being written.
 * A direct container field is validated as an assignment; an inherited one is
 * read from the related record, whatever the payload claims.
 */
export const resolveContentWriteContainer = async (
  c: Context,
  db: ContentDatabase,
  definition: AnyContentTypeDefinition,
  values: Record<string, unknown>,
): Promise<ContentRecordContainer | null> => {
  const source = contentContainerSourceOf(definition);
  if (!source?.container) return null;

  if (source.kind === "field") {
    const assigned = await resolveContentContainerAssignment(
      db,
      definition,
      values,
    );

    return assigned ? await toContext(db, source.container, assigned.id) : null;
  }

  return await toContext(
    db,
    source.container,
    await containerOfRelated(c, db, definition, values[source.name]),
  );
};

/** The container an existing row is filed in. */
export const resolveContentRowContainer = async (
  c: Context,
  db: ContentDatabase,
  definition: AnyContentTypeDefinition,
  row: Record<string, unknown>,
): Promise<ContentRecordContainer | null> => {
  const source = contentContainerSourceOf(definition);
  if (!source?.container) return null;

  if (source.kind === "field") {
    const value = row[source.name];

    return await toContext(
      db,
      source.container,
      typeof value === "number" ? value : null,
    );
  }

  return await toContext(
    db,
    source.container,
    await containerOfRelated(c, db, definition, row[source.name]),
  );
};

/** `null` when the record's container collection has no policies. */
export const effectiveContentPolicy = (
  definition: AnyContentTypeDefinition,
  container: ContentRecordContainer | null,
): EffectiveContentContainerPolicy | null => {
  if (!container?.definition.policies.enabled) return null;

  return resolveContentContainerPolicy({
    chain: container.chain,
    contentTypeId: definition.id,
    fallback: contentContainerPolicyFallback(definition),
    policies: container.definition.policies,
  });
};

/**
 * Resource ids that cover a container: the container itself, its own subtree
 * and the subtree of every ancestor. A bare id never reaches a descendant.
 */
export const contentContainerScopeResources = (
  chain: readonly Pick<ContentContainerChainEntry, "id">[],
): string[] => {
  const [self, ...ancestors] = chain;
  if (!self) return [];

  return [
    String(self.id),
    `${self.id}${CONTENT_CONTAINER_TREE_SUFFIX}`,
    ...ancestors.map(entry => `${entry.id}${CONTENT_CONTAINER_TREE_SUFFIX}`),
  ];
};

/**
 * Whether the signed-in user holds a moderator permission of a content type for
 * the record's container. Content types without container policies keep the
 * unscoped check they always had.
 */
export const canModerateContent = async (
  c: Context,
  {
    container,
    definition,
    permission,
    pluginId,
  }: {
    container: ContentRecordContainer | null;
    definition: AnyContentTypeDefinition;
    permission: string;
    pluginId: string;
  },
): Promise<boolean> => {
  const user = c.get("user");
  if (!user) return false;

  const set = await resolveStaffPermissions(c, { type: "moderator", user });
  const check = {
    module: definition.permissionModule,
    permission,
    plugin: pluginId,
  };

  if (!container?.definition.policies.enabled) {
    return hasStaffPermission(set, check);
  }

  return contentContainerScopeResources(container.chain).some(id =>
    hasStaffPermission(set, {
      ...check,
      resource: { family: container.definition.id, id },
    }),
  );
};

/** Container ids (of one collection) a set of resource ids covers. */
export const expandContentContainerScope = async (
  db: ContentDatabase,
  definitionId: string,
  resources: "all" | readonly string[],
): Promise<"all" | number[]> => {
  if (resources === "all") return "all";

  const direct = new Set<number>();
  const roots = new Set<number>();
  for (const resource of resources) {
    const tree = resource.endsWith(CONTENT_CONTAINER_TREE_SUFFIX);
    const id = Number(
      tree
        ? resource.slice(0, -CONTENT_CONTAINER_TREE_SUFFIX.length)
        : resource,
    );
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    (tree ? roots : direct).add(id);
  }
  if (roots.size === 0) return [...direct].sort((a, b) => a - b);

  const rows = await db
    .select({
      id: core_content_containers.id,
      parentId: core_content_containers.parentId,
    })
    .from(core_content_containers)
    .where(eq(core_content_containers.definitionId, definitionId));
  const children = new Map<number, number[]>();
  for (const row of rows) {
    if (row.parentId === null) continue;
    children.set(row.parentId, [...(children.get(row.parentId) ?? []), row.id]);
  }

  const covered = new Set(direct);
  const visited = new Set<number>();
  const known = new Set(rows.map(row => row.id));
  const queue = [...roots].filter(id => known.has(id));
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    covered.add(id);
    queue.push(...(children.get(id) ?? []));
  }

  return [...covered].sort((a, b) => a - b);
};

export const contentContainerIdsExist = async (
  db: ContentDatabase,
  ids: readonly number[],
): Promise<Set<number>> => {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: core_content_containers.id })
    .from(core_content_containers)
    .where(inArray(core_content_containers.id, [...ids]));

  return new Set(rows.map(row => row.id));
};
