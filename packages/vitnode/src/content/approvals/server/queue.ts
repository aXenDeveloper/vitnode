import type { SQL } from "drizzle-orm";
import type { Context } from "hono";

import { and, asc, count, desc, eq, inArray, or } from "drizzle-orm";

import type { ResolvedStaffPermissionSet } from "../../../api/lib/permission-staff";
import type { PublicPerson } from "../../../api/lib/public-people";
import type { AnyContentModel } from "../../server/model";
import type { AnyContentTypeDefinition } from "../../types";
import type { ContentSubmissionKind, ContentSubmissionStatus } from "../const";
import type { ContentSubmissionRow } from "./submissions";

import { loadPublicPeople } from "../../../api/lib/public-people";
import { staffPermissionResources } from "../../../api/lib/staff-permission";
import { core_content_containers } from "../../../database/content-containers";
import { core_content_submissions } from "../../../database/content-submissions";
import {
  CONTENT_PERMISSIONS,
  CONTENT_SEARCH_SLUG_PLACEHOLDER,
} from "../../const";
import { contentContainerSourceOf } from "../../containers/association";
import { expandContentContainerScope } from "../../containers/server/policy";
import { contentContainerAncestors } from "../../containers/tree";
import { parseContentId } from "../../ids";
import { contentDefinitionOf } from "../../server/model";
import { isContentBaseRowPublic } from "../../server/visibility";
import { findSubmissionModel } from "./decide";

export interface ReviewableContentType {
  containerDefinitionId: string;
  definition: AnyContentTypeDefinition;
  model: AnyContentModel;
  pluginId: string;
  /** Container ids the moderator may approve in, or every one. */
  scope: "all" | number[];
}

/** Content types the moderator may approve in, each with the containers covered. */
export const reviewableContentTypes = async (
  c: Context,
  set: ResolvedStaffPermissionSet,
): Promise<ReviewableContentType[]> => {
  const expanded = new Map<string, Promise<"all" | number[]>>();
  const entries = await Promise.all(
    (c.get("core")?.contentModels ?? []).map(async ({ model, pluginId }) => {
      const definition = contentDefinitionOf(model);
      const container = contentContainerSourceOf(definition)?.container;
      if (!definition.publicWrite.enabled || !container?.policies.enabled) {
        return null;
      }

      const resources = staffPermissionResources(
        set,
        {
          module: definition.permissionModule,
          permission: CONTENT_PERMISSIONS.approve,
          plugin: pluginId,
        },
        container.id,
      );
      if (resources === null) return null;

      const key = `${container.id}|${resources === "all" ? "*" : resources.join(",")}`;
      const pending =
        expanded.get(key) ??
        expandContentContainerScope(c.get("db"), container.id, resources);
      expanded.set(key, pending);
      const scope = await pending;
      if (scope !== "all" && scope.length === 0) return null;

      return {
        containerDefinitionId: container.id,
        definition,
        model,
        pluginId,
        scope,
      };
    }),
  );

  return entries.filter(entry => entry !== null);
};

const reviewableCondition = (types: readonly ReviewableContentType[]): SQL => {
  const conditions = types.map(entry =>
    and(
      eq(core_content_submissions.pluginId, entry.pluginId),
      eq(core_content_submissions.contentTypeId, entry.definition.id),
      entry.scope === "all"
        ? undefined
        : inArray(core_content_submissions.containerId, entry.scope),
    ),
  );

  return (
    (conditions.length > 0 ? or(...conditions) : undefined) ??
    eq(core_content_submissions.id, 0)
  );
};

const textOf = (value: unknown): null | string => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value !== "object" || value === null) return null;

  const parts: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node !== "object" || node === null || parts.length > 64) return;
    const { content, text } = node as { content?: unknown; text?: unknown };
    if (typeof text === "string") parts.push(text);
    if (Array.isArray(content)) content.forEach(walk);
  };
  walk(value);
  const joined = parts.join(" ").replace(/\s+/g, " ").trim();

  return joined === "" ? null : joined;
};

/** A one-line title for a queue row: the title field, else the start of the text. */
const titleOf = (
  definition: AnyContentTypeDefinition | null,
  values: Record<string, unknown>,
): null | string => {
  const titleField = definition?.admin.titleField;
  const title = titleField ? textOf(values[titleField]) : null;
  if (title) return title.slice(0, 200);

  for (const [name, value] of Object.entries(values)) {
    const kind = definition?.fields[name]?.kind;
    if (kind !== "richText" && kind !== "textarea" && kind !== "text") continue;
    const text = textOf(value);
    if (text) return text.length > 140 ? `${text.slice(0, 139)}…` : text;
  }

  return null;
};

interface ContainerLabel {
  id: number;
  name: string;
  path: string[];
  slug: string;
}

const loadContainerLabels = async (
  c: Context,
  ids: readonly (null | number)[],
): Promise<Map<number, ContainerLabel>> => {
  const wanted = [...new Set(ids.filter(id => id !== null))];
  if (wanted.length === 0) return new Map();

  const owners = await c
    .get("db")
    .select({ definitionId: core_content_containers.definitionId })
    .from(core_content_containers)
    .where(inArray(core_content_containers.id, wanted));
  const definitions = [...new Set(owners.map(row => row.definitionId))];
  if (definitions.length === 0) return new Map();

  const rows = await c
    .get("db")
    .select({
      id: core_content_containers.id,
      name: core_content_containers.name,
      parentId: core_content_containers.parentId,
      position: core_content_containers.position,
      slug: core_content_containers.slug,
    })
    .from(core_content_containers)
    .where(inArray(core_content_containers.definitionId, definitions));

  return new Map(
    rows
      .filter(row => wanted.includes(row.id))
      .map(row => [
        row.id,
        {
          id: row.id,
          name: row.name,
          path: contentContainerAncestors(rows, row.id).map(
            ancestor => ancestor.name,
          ),
          slug: row.slug,
        },
      ]),
  );
};

export interface ContentSubmissionListItem {
  author: null | PublicPerson;
  container: ContainerLabel | null;
  contentTypeId: string;
  createdAt: Date;
  decidedAt: Date | null;
  id: number;
  itemId: string;
  kind: ContentSubmissionKind;
  pluginId: string;
  reason: null | string;
  reviewer: null | PublicPerson;
  status: ContentSubmissionStatus;
  title: null | string;
}

const toListItems = async (
  c: Context,
  rows: readonly ContentSubmissionRow[],
): Promise<ContentSubmissionListItem[]> => {
  const [people, containers] = await Promise.all([
    loadPublicPeople(
      c,
      rows.flatMap(row => [row.authorId, row.reviewerId]),
    ),
    loadContainerLabels(
      c,
      rows.map(row => row.containerId),
    ),
  ]);

  return rows.map(row => {
    const model = findSubmissionModel(c, row);

    return {
      author: row.authorId === null ? null : (people.get(row.authorId) ?? null),
      container:
        row.containerId === null
          ? null
          : (containers.get(row.containerId) ?? null),
      contentTypeId: row.contentTypeId,
      createdAt: row.createdAt,
      decidedAt: row.decidedAt,
      id: row.id,
      itemId: row.itemId,
      kind: row.kind,
      pluginId: row.pluginId,
      reason: row.reason,
      reviewer:
        row.reviewerId === null ? null : (people.get(row.reviewerId) ?? null),
      status: row.status,
      title: titleOf(model ? contentDefinitionOf(model) : null, row.values),
    };
  });
};

export interface ContentSubmissionQueueQuery {
  containerId?: number;
  contentTypeId?: string;
  page: number;
  pageSize: number;
  status: ContentSubmissionStatus;
}

export const listContentSubmissions = async (
  c: Context,
  set: ResolvedStaffPermissionSet,
  {
    containerId,
    contentTypeId,
    page,
    pageSize,
    status,
  }: ContentSubmissionQueueQuery,
): Promise<{ items: ContentSubmissionListItem[]; total: number }> => {
  const types = await reviewableContentTypes(c, set);
  const where = and(
    reviewableCondition(types),
    eq(core_content_submissions.status, status),
    contentTypeId === undefined
      ? undefined
      : eq(core_content_submissions.contentTypeId, contentTypeId),
    containerId === undefined
      ? undefined
      : eq(core_content_submissions.containerId, containerId),
  );
  const order =
    status === "pending"
      ? [
          asc(core_content_submissions.createdAt),
          asc(core_content_submissions.id),
        ]
      : [
          desc(core_content_submissions.decidedAt),
          desc(core_content_submissions.id),
        ];

  const [[total], rows] = await Promise.all([
    c
      .get("db")
      .select({ value: count() })
      .from(core_content_submissions)
      .where(where),
    c
      .get("db")
      .select()
      .from(core_content_submissions)
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { items: await toListItems(c, rows), total: total?.value ?? 0 };
};

/** Whether this moderator may see (and decide) one submission. */
export const canReviewSubmission = (
  types: readonly ReviewableContentType[],
  row: Pick<ContentSubmissionRow, "containerId" | "contentTypeId" | "pluginId">,
): boolean =>
  types.some(
    entry =>
      entry.pluginId === row.pluginId &&
      entry.definition.id === row.contentTypeId &&
      (entry.scope === "all" ||
        (row.containerId !== null && entry.scope.includes(row.containerId))),
  );

export interface ContentSubmissionField {
  kind: string;
  name: string;
}

export interface ContentSubmissionDetail extends ContentSubmissionListItem {
  baseValues: null | Record<string, unknown>;
  /** The record as it is now - what readers see, for comparison. */
  current: null | Record<string, unknown>;
  fields: ContentSubmissionField[];
  history: ContentSubmissionListItem[];
  record: {
    exists: boolean;
    public: boolean;
    slug: null | string;
    url: null | string;
  };
  values: Record<string, unknown>;
}

export const showContentSubmission = async (
  c: Context,
  row: ContentSubmissionRow,
): Promise<ContentSubmissionDetail> => {
  const model = findSubmissionModel(c, row);
  const definition = model ? contentDefinitionOf(model) : null;
  const itemId = definition
    ? parseContentId(definition.idStrategy, row.itemId)
    : null;
  const live =
    model && itemId !== null
      ? ((await model.service(c).findById(itemId)) as null | Record<
          string,
          unknown
        >)
      : null;

  const readable = definition
    ? [
        ...new Set([
          ...definition.publicWrite.create.fields,
          ...definition.publicWrite.update.fields,
        ]),
      ]
    : Object.keys(row.values);
  const collections =
    live && model && itemId !== null
      ? await model.service(c).advancedFields(
          itemId,
          readable.filter(name => {
            const field = definition?.fields[name];

            return (
              (field?.kind === "relation" || field?.kind === "file") &&
              field.multiple
            );
          }),
        )
      : {};
  const current = live
    ? Object.fromEntries(
        readable.map(name => [name, collections[name] ?? live[name] ?? null]),
      )
    : null;

  const slugField = definition?.publicApi.slugField;
  const slug =
    live && slugField && typeof live[slugField] === "string"
      ? live[slugField]
      : null;
  const isPublic = live ? isContentBaseRowPublic(live) : false;
  const template =
    definition?.search.enabled === true ? definition.search.pathTemplate : "";
  const url =
    isPublic && slug && template
      ? template.replaceAll(
          CONTENT_SEARCH_SLUG_PLACEHOLDER,
          encodeURIComponent(slug),
        )
      : null;

  const historyRows = await c
    .get("db")
    .select()
    .from(core_content_submissions)
    .where(
      and(
        eq(core_content_submissions.contentTypeId, row.contentTypeId),
        eq(core_content_submissions.itemId, row.itemId),
      ),
    )
    .orderBy(
      desc(core_content_submissions.createdAt),
      desc(core_content_submissions.id),
    )
    .limit(20);

  const [self] = await toListItems(c, [row]);
  const history = await toListItems(
    c,
    historyRows.filter(entry => entry.id !== row.id),
  );

  return {
    ...self,
    baseValues: row.baseValues,
    current,
    fields: readable.map(name => ({
      kind: definition?.fields[name]?.kind ?? "text",
      name,
    })),
    history,
    record: { exists: live !== null, public: isPublic, slug, url },
    values: row.values,
  };
};

export const findContentSubmission = async (
  c: Context,
  id: number,
): Promise<ContentSubmissionRow | null> => {
  const [row] = await c
    .get("db")
    .select()
    .from(core_content_submissions)
    .where(eq(core_content_submissions.id, id))
    .limit(1);

  return row ?? null;
};

export const listAuthorContentSubmissions = async (
  c: Context,
  authorId: number,
  {
    page,
    pageSize,
    pluginId,
  }: { page: number; pageSize: number; pluginId?: string },
): Promise<{ items: ContentSubmissionListItem[]; total: number }> => {
  const where = and(
    eq(core_content_submissions.authorId, authorId),
    inArray(core_content_submissions.status, [
      "pending",
      "approved",
      "rejected",
    ]),
    // In SQL rather than after the page is cut, so a plugin's own page of the
    // list is a full page and its total counts only its submissions.
    pluginId === undefined
      ? undefined
      : eq(core_content_submissions.pluginId, pluginId),
  );
  const [[total], rows] = await Promise.all([
    c
      .get("db")
      .select({ value: count() })
      .from(core_content_submissions)
      .where(where),
    c
      .get("db")
      .select()
      .from(core_content_submissions)
      .where(where)
      .orderBy(
        desc(core_content_submissions.createdAt),
        desc(core_content_submissions.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  return { items: await toListItems(c, rows), total: total?.value ?? 0 };
};

/** Filter options for the queue: the content types and containers in scope. */
export const contentSubmissionFilters = async (
  c: Context,
  set: ResolvedStaffPermissionSet,
): Promise<{
  containers: {
    definitionId: string;
    depth: number;
    id: number;
    name: string;
  }[];
  contentTypes: { id: string; pluginId: string }[];
}> => {
  const types = await reviewableContentTypes(c, set);
  const definitions = [
    ...new Set(types.map(entry => entry.containerDefinitionId)),
  ];
  const rows =
    definitions.length === 0
      ? []
      : await c
          .get("db")
          .select({
            definitionId: core_content_containers.definitionId,
            id: core_content_containers.id,
            name: core_content_containers.name,
            parentId: core_content_containers.parentId,
            position: core_content_containers.position,
          })
          .from(core_content_containers)
          .where(inArray(core_content_containers.definitionId, definitions))
          .orderBy(
            asc(core_content_containers.position),
            asc(core_content_containers.id),
          );

  const covered = (definitionId: string, id: number) =>
    types.some(
      entry =>
        entry.containerDefinitionId === definitionId &&
        (entry.scope === "all" || entry.scope.includes(id)),
    );

  return {
    containers: rows
      .filter(row => covered(row.definitionId, row.id))
      .map(row => ({
        definitionId: row.definitionId,
        depth: contentContainerAncestors(rows, row.id).length + 1,
        id: row.id,
        name: row.name,
      })),
    contentTypes: types.map(entry => ({
      id: entry.definition.id,
      pluginId: entry.pluginId,
    })),
  };
};
