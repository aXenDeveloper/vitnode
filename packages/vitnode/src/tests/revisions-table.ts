import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";

import type { ContentTranslationRevisionSnapshot } from "@/content/revisions";

const dialect = new PgDialect();

const boundValue = (condition: SQL | undefined, column: string): unknown => {
  if (!condition) return undefined;

  const { params, sql } = dialect.sqlToQuery(condition);
  if (sql.includes(`"core_content_revisions"."${column}" is null`)) return null;

  const match = new RegExp(
    `"core_content_revisions"\\."${column}" = \\$(\\d+)`,
  ).exec(sql);

  return match ? params[Number(match[1]) - 1] : undefined;
};

export interface RevisionWrite {
  changedFields: string[];
  itemId: number;
  languageId: null | number;
  operation: string;
  restoredFromRevisionId: null | number;
  snapshot: ContentTranslationRevisionSnapshot;
  version: number;
}

interface RevisionRow {
  [column: string]: unknown;
  id: number;
  itemId: number;
  languageId: null | number;
  version: number;
}

const inScope = (row: RevisionRow, condition: SQL | undefined): boolean => {
  const id = boundValue(condition, "id");

  return (
    row.itemId === boundValue(condition, "itemId") &&
    row.languageId === boundValue(condition, "languageId") &&
    (id === undefined || row.id === id)
  );
};

export const createTestRevisionsTable = () => {
  const rows: RevisionRow[] = [];
  const written: RevisionWrite[] = [];
  let nextId = 1000;

  const select = () => {
    let condition: SQL | undefined;

    const query = {
      from: () => query,
      leftJoin: () => query,
      limit: async (size: number) =>
        await Promise.resolve(
          rows
            .filter(row => inScope(row, condition))
            .sort((a, b) => b.version - a.version)
            .slice(0, size),
        ),
      orderBy: () => query,
      where: (value: SQL | undefined) => {
        condition = value;

        return query;
      },
    };

    return query;
  };

  const db = {
    insert: () => ({
      values: (values: RevisionWrite) => ({
        returning: async () => {
          nextId += 1;
          written.push(values);
          rows.push({ ...values, id: nextId });

          return await Promise.resolve([{ id: nextId }]);
        },
      }),
    }),
    select,
    transaction: async <T>(body: (tx: unknown) => Promise<T>) => await body(db),
  };

  const seed = (
    row: Partial<RevisionRow> & Pick<RevisionRow, "languageId" | "version">,
  ) => {
    rows.push({
      actorName: null,
      actorType: "staff",
      actorUserId: 1,
      changedFields: [],
      createdAt: new Date(),
      id: 42,
      itemId: 7,
      operation: "update",
      restoredFromRevisionId: null,
      snapshot: null,
      ...row,
    });
  };

  return { db, seed, written };
};
