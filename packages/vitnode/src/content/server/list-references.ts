import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { eq, inArray } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";
import type { AnyContentModel } from "./model";

import { core_roles } from "../../database/roles";
import { core_users } from "../../database/users";
import { isContentReferenceCollection } from "../paths";
import { contentDefinitionOf } from "./model";

export const zodContentReferenceListItem = z.object({
  color: z.string().optional(),
  label: z.string(),
  role: z
    .object({
      color: z.string().nullable(),
      prefix: z.string().nullable(),
    })
    .optional(),
  value: z.number(),
});

export type ContentReferenceListItem = z.infer<
  typeof zodContentReferenceListItem
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

const idsOf = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((id): id is number => typeof id === "number")
    : [];

const userItems = async (
  c: Context,
  ids: readonly number[],
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
    .where(inArray(core_users.id, [...ids]));

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
  ids: readonly number[],
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

export const withContentReferenceLists = async <TRow extends { id: number }>(
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

      return [field, new Map(items.map(item => [item.value, item]))] as const;
    }),
  );

  return rows.map(row => ({
    ...row,
    references: Object.fromEntries(
      itemsByField.map(([field, items]) => [
        field,
        idsOf(values.get(row.id)?.[field]).flatMap(id => {
          const item = items.get(id);

          return item ? [item] : [];
        }),
      ]),
    ),
  }));
};
