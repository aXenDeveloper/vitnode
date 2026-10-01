import type { SQL } from "drizzle-orm";

import { PgDialect } from "drizzle-orm/pg-core";

type Row = Record<string, unknown>;

type Operator = "<>" | "=" | "in";

interface Constraint {
  column: string;
  operator: Operator;
  values: unknown[];
}

const dialect = new PgDialect();

const CONSTRAINT_PATTERN =
  /"\w+"\."(\w+)" (=|<>|in) (\$\d+|\((?:\$\d+(?:, )?)+\))/g;

const camelCase = (column: string): string =>
  column.replace(/_(\w)/g, (_match, letter: string) => letter.toUpperCase());

const parseCondition = (
  condition: SQL | undefined,
): { constraints: Constraint[]; mode: "and" | "or" } => {
  if (!condition) return { constraints: [], mode: "and" };

  const { params, sql } = dialect.sqlToQuery(condition);
  const constraints = [...sql.matchAll(CONSTRAINT_PATTERN)].map(
    ([, column = "", operator, operand = ""]) => ({
      column: camelCase(column),
      operator: operator as Operator,
      values: (operand.match(/\$\d+/g) ?? []).map(
        token => params[Number(token.slice(1)) - 1],
      ),
    }),
  );

  return { constraints, mode: sql.includes(" or ") ? "or" : "and" };
};

const satisfies = (row: Row, { column, operator, values }: Constraint) =>
  operator === "<>"
    ? !values.includes(row[column])
    : values.includes(row[column]);

const matches = (row: Row, condition: SQL | undefined): boolean => {
  const { constraints, mode } = parseCondition(condition);
  if (constraints.length === 0) return true;

  return mode === "or"
    ? constraints.some(constraint => satisfies(row, constraint))
    : constraints.every(constraint => satisfies(row, constraint));
};

const thenable = <T>(resolve: () => T) => ({
  then: async <R>(
    onFulfilled: (value: T) => R,
    onRejected?: (reason: unknown) => R,
  ) => await Promise.resolve().then(resolve).then(onFulfilled, onRejected),
});

export const createMemoryDb = (tables: [unknown, Row[]][] = []) => {
  const store = new Map<unknown, Row[]>(
    tables.map(([table, rows]) => [table, rows.map(row => ({ ...row }))]),
  );
  let nextId = 10_000;

  const rowsOf = (table: unknown): Row[] => {
    const existing = store.get(table);
    if (existing) return existing;

    const created: Row[] = [];
    store.set(table, created);

    return created;
  };

  const select = () => {
    let table: unknown;
    let condition: SQL | undefined;
    let size = Number.POSITIVE_INFINITY;

    const query = {
      ...thenable(() =>
        rowsOf(table)
          .filter(row => matches(row, condition))
          .slice(0, size)
          .map(row => ({ ...row })),
      ),
      from: (from: unknown) => {
        table = from;

        return query;
      },
      innerJoin: () => query,
      leftJoin: () => query,
      limit: (limit: number) => {
        size = limit;

        return query;
      },
      orderBy: () => query,
      where: (where: SQL | undefined) => {
        condition = where;

        return query;
      },
    };

    return query;
  };

  const insert = (table: unknown) => ({
    values: (values: Row | Row[]) => {
      const inserted = (Array.isArray(values) ? values : [values]).map(row => ({
        id: nextId++,
        ...row,
      }));
      rowsOf(table).push(...inserted);

      return {
        ...thenable(() => []),
        returning: async () =>
          await Promise.resolve(inserted.map(row => ({ ...row }))),
      };
    },
  });

  const update = (table: unknown) => ({
    set: (values: Row) => ({
      where: (condition: SQL | undefined) => {
        const updated = rowsOf(table).filter(row => matches(row, condition));
        for (const row of updated) Object.assign(row, values);

        return {
          ...thenable(() => []),
          returning: async () =>
            await Promise.resolve(updated.map(row => ({ ...row }))),
        };
      },
    }),
  });

  const remove = (table: unknown) => ({
    where: (condition: SQL | undefined) =>
      thenable(() => {
        const rows = rowsOf(table);
        const kept = rows.filter(row => !matches(row, condition));
        rows.splice(0, rows.length, ...kept);

        return [];
      }),
  });

  const db = {
    delete: remove,
    insert,
    select,
    transaction: async <T>(run: (tx: unknown) => Promise<T>) => await run(db),
    update,
  };

  return {
    db,
    rows: (table: unknown): Row[] => rowsOf(table).map(row => ({ ...row })),
  };
};
