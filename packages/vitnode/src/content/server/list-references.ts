import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { core_roles } from "../../database/roles";
import { core_users } from "../../database/users";
import { contentIdKey, contentRelationStrategy } from "../ids";
import { isContentReferenceCollection } from "../paths";
import { contentDefinitionOf } from "./model";

const zodReferenceListItemOf = <TValue extends z.ZodType>(value: TValue) =>
  z.object({
    color: z.string().optional(),
    label: z.string(),
    role: z
      .object({
        color: z.string().nullable(),
        prefix: z.string().nullable(),
      })
      .optional(),
    value,
  });

/** One label in a list cell. `value` is the target's id - a number for a user or a serial target. */
export const zodContentReferenceListItem = zodReferenceListItemOf(z.number());

/** {@link zodContentReferenceListItem} for a list whose targets include a `uuid` or `bigint` content type. */
export const zodContentReferenceListItemAnyId = zodReferenceListItemOf(
  z.union([z.number(), z.string()]),
);

export type ContentReferenceListItem = z.infer<
  typeof zodContentReferenceListItemAnyId
>;

export const contentReferenceListColumns = (
  definition: AnyContentTypeDefinition,
): string[] =>
  definition.admin.list.columns.filter(name => {
    const fieldValue = definition.fields[name];

    return (
      fieldValue !== undefined &&
      isContentReferenceCollection(fieldValue) &&
      (fieldValue.kind === "relation" || fieldValue.kind === "user")
    );
  });

/**
 * Whether every column `contentReferenceListColumns` names points at numeric
 * ids - users and serial targets - so the list response keeps its old schema.
 */
export const contentReferenceListIdsAreNumeric = (
  definition: AnyContentTypeDefinition,
): boolean =>
  contentReferenceListColumns(definition).every(name => {
    const fieldValue = definition.fields[name];

    return (
      fieldValue.kind !== "relation" ||
      contentRelationStrategy(definition, fieldValue) === "serial"
    );
  });

/** The loaded ids of one collection, as the store returned them. */
const idsOf = (value: unknown): ContentId[] =>
  Array.isArray(value)
    ? value.filter(
        (id): id is ContentId =>
          typeof id === "number" || typeof id === "string",
      )
    : [];

const userItems = async (
  c: Context,
  ids: readonly ContentId[],
): Promise<ContentReferenceListItem[]> => {
  if (ids.length === 0) return [];

  const rows = await c
    .get("db")
    .select({
      color: core_roles.color,
      label: core_users.name,
      prefix: core_roles.prefix,
      value: core_users.id,
    })
    .from(core_users)
    .leftJoin(core_roles, eq(core_roles.id, core_users.roleId))
    .where(
      inArray(
        core_users.id,
        ids.filter((id): id is number => typeof id === "number"),
      ),
    );

  return rows.map(({ color, label, prefix, value }) => ({
    label,
    role: { color, prefix },
    value,
  }));
};

const relationItems = async (
  c: Context,
  model: AnyContentModel,
  field: string,
  ids: readonly ContentId[],
): Promise<ContentReferenceListItem[]> => {
  const options = await model
    .service(c)
    .options(field as never, undefined, ids);

  return options.map(({ color, label, value }) => ({
    ...(color === undefined ? {} : { color }),
    label,
    value,
  }));
};

export const withContentReferenceLists = async <TRow extends { id: ContentId }>(
  c: Context,
  model: AnyContentModel,
  rows: readonly TRow[],
): Promise<
  (TRow & { references?: Record<string, ContentReferenceListItem[]> })[]
> => {
  const definition = contentDefinitionOf(model);
  const fields = contentReferenceListColumns(definition);
  if (fields.length === 0 || rows.length === 0) return [...rows];

  const values = await model.advanced.loadMany(
    rows.map(row => row.id),
    c.get("db"),
    fields,
  );

  const itemsByField = await Promise.all(
    fields.map(async field => {
      const ids = [
        ...new Set(rows.flatMap(row => idsOf(values.get(row.id)?.[field]))),
      ];
      const items =
        definition.fields[field]?.kind === "user"
          ? await userItems(c, ids)
          : await relationItems(c, model, field, ids);

      return [
        field,
        new Map(items.map(item => [contentIdKey(item.value), item])),
      ] as const;
    }),
  );

  return rows.map(row => ({
    ...row,
    references: Object.fromEntries(
      itemsByField.map(([field, items]) => [
        field,
        idsOf(values.get(row.id)?.[field]).flatMap(id => {
          const item = items.get(contentIdKey(id));

          return item ? [item] : [];
        }),
      ]),
    ),
  }));
};
