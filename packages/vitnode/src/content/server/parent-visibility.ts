import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, inArray } from "drizzle-orm";

import type { AnyContentTypeDefinition } from "../types";

import { contentSearchContextSource } from "../search";
import { findContentModel } from "./model";
import { publicationColumns, publishedCondition } from "./publication";

const CONTENT_PARENT_KEY = "__vitnodeParent";

interface ContentParentRelation {
  field: string;
  target: AnyContentTypeDefinition;
}

interface ContentParentVisibility {
  selection: Record<string, PgColumn>;
  visible: <TRow extends Record<string, unknown>>(
    rows: TRow[],
    options?: { hiddenParents?: boolean },
  ) => Promise<TRow[]>;
}

const contentParentRelation = (
  definition: AnyContentTypeDefinition,
): ContentParentRelation | null => {
  if (definition.thread.enabled) {
    const descriptor = definition.fields[definition.thread.rootField];
    if (descriptor?.kind === "relation") {
      return {
        field: definition.thread.rootField,
        target: descriptor.target(),
      };
    }
  }

  const source = contentSearchContextSource(definition);

  return source?.kind === "relation"
    ? { field: source.field, target: source.target }
    : null;
};

const isParentReference = (value: unknown): value is number | string =>
  typeof value === "number" || typeof value === "string";

export const createContentParentVisibility = (
  c: Context,
  definition: AnyContentTypeDefinition,
  columns: Record<string, PgColumn>,
): ContentParentVisibility | null => {
  const parent = contentParentRelation(definition);
  if (!parent?.target.publication.enabled) return null;

  const parentModel = findContentModel(
    c.get("core")?.contentModels ?? [],
    parent.target.id,
  )?.model;
  if (!parentModel) {
    throw new Error(
      `Content type "${definition.id}" has parent "${parent.target.id}", which is not registered.`,
    );
  }

  const parentColumns = parentModel.columns as Record<string, PgColumn>;
  const parentId = parentColumns.id;

  return {
    selection: { [CONTENT_PARENT_KEY]: columns[parent.field] },
    visible: async <TRow extends Record<string, unknown>>(
      rows: TRow[],
      options?: { hiddenParents?: boolean },
    ): Promise<TRow[]> => {
      const parentPublication = publicationColumns(
        parent.target,
        parentColumns,
      );
      const ids = [
        ...new Set(
          rows.map(row => row[CONTENT_PARENT_KEY]).filter(isParentReference),
        ),
      ];
      const visibleIds = new Set(
        ids.length === 0
          ? []
          : (
              await c
                .get("db")
                .select({ id: parentId })
                .from(parentModel.table)
                .where(
                  and(
                    inArray(parentId, ids),
                    publishedCondition(
                      options?.hiddenParents
                        ? { ...parentPublication, hiddenAt: undefined }
                        : parentPublication,
                    ),
                  ),
                )
            ).map(row => String(row.id)),
      );

      return rows
        .filter(row => {
          const id = row[CONTENT_PARENT_KEY];

          return isParentReference(id)
            ? visibleIds.has(String(id))
            : id === null || id === undefined;
        })
        .map(row => {
          const { [CONTENT_PARENT_KEY]: _parent, ...rest } = row;

          return rest as TRow;
        });
    },
  };
};

export const contentDependentDefinitions = (
  c: Context,
  definition: AnyContentTypeDefinition,
): AnyContentTypeDefinition[] =>
  (c.get("core")?.contentModels ?? [])
    .map(entry => entry.model.definition as AnyContentTypeDefinition)
    .filter(
      candidate =>
        candidate.publicApi.enabled &&
        contentParentRelation(candidate)?.target.id === definition.id,
    );
