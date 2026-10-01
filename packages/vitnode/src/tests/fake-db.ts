import { Column, is, Param, SQL, StringChunk, type Table } from "drizzle-orm";

export type FakeRow = Record<string, unknown>;

type Token = Column | Param | string;

interface Condition {
  column: Column;
  operator: string;
  values: unknown[];
}

interface Where {
  conditions: Condition[];
  mode: "and" | "or";
}

const tokensOf = (chunk: unknown): Token[] => {
  if (Array.isArray(chunk)) return chunk.flatMap(tokensOf);
  if (is(chunk, SQL)) return chunk.queryChunks.flatMap(tokensOf);
  if (is(chunk, StringChunk)) {
    const text = chunk.value.join("").trim();

    return text ? [text] : [];
  }
  if (is(chunk, Column) || is(chunk, Param)) return [chunk];

  throw new Error(`fake db cannot read a where chunk: ${String(chunk)}`);
};

const paramsFrom = (tokens: Token[], start: number): unknown[] => {
  const values: unknown[] = [];
  for (const token of tokens.slice(start)) {
    if (!is(token, Param)) break;
    values.push(token.value);
  }

  return values;
};

const whereOf = (where: SQL | undefined): Where => {
  if (!where) return { conditions: [], mode: "and" };

  const tokens = tokensOf(where);
  const hasOr = tokens.includes("or");
  if (hasOr && tokens.includes("and")) {
    throw new Error("fake db cannot mix and with or");
  }

  const conditions = tokens.flatMap((token, index) => {
    const operator = tokens[index + 1];
    if (!is(token, Column) || typeof operator !== "string") return [];

    const values = paramsFrom(tokens, index + 2);

    return values.length > 0 ? [{ column: token, operator, values }] : [];
  });

  return { conditions, mode: hasOr ? "or" : "and" };
};

const keyOf = (table: Table, column: Column): string | undefined =>
  Object.entries(table).find(([, value]) => value === column)?.[0];

const compare = (
  left: unknown,
  operator: string,
  values: unknown[],
): boolean => {
  if (operator === "in") return values.includes(left);
  const [right] = values;
  if (operator === "=") return left === right;
  if (left === null || left === undefined) return false;
  if (operator === ">") return (left as number) > (right as number);
  if (operator === ">=") return (left as number) >= (right as number);
  if (operator === "<") return (left as number) < (right as number);
  if (operator === "<=") return (left as number) <= (right as number);

  throw new Error(`fake db does not support "${operator}"`);
};

const matches = (table: Table, row: FakeRow, { conditions, mode }: Where) => {
  const holds = ({ column, operator, values }: Condition) => {
    const key = keyOf(table, column);
    if (!key) {
      throw new Error("fake db where clause names another table's column");
    }

    return compare(row[key], operator, values);
  };

  return mode === "or" ? conditions.some(holds) : conditions.every(holds);
};

const project = (
  table: Table,
  row: FakeRow,
  fields: Record<string, unknown> | undefined,
): FakeRow =>
  fields
    ? Object.fromEntries(
        Object.entries(fields).map(([alias, field]) => {
          const key = is(field, Column) ? keyOf(table, field) : undefined;

          return [alias, key ? (row[key] ?? null) : null];
        }),
      )
    : { ...row };

export const createFakeDb = (seed: [Table, FakeRow[]][] = []) => {
  const tables = new Map<Table, FakeRow[]>(
    seed.map(([table, rows]) => [table, rows.map(row => ({ ...row }))]),
  );

  const rowsOf = (table: Table): FakeRow[] => {
    const existing = tables.get(table);
    if (existing) return existing;

    const created: FakeRow[] = [];
    tables.set(table, created);

    return created;
  };

  const query = (run: () => FakeRow[]) => ({
    then: async <T>(onFulfilled: (rows: FakeRow[]) => T) =>
      await Promise.resolve(onFulfilled(run())),
  });

  const select = (fields?: Record<string, unknown>) => {
    let table: Table | undefined;
    let where: SQL | undefined;
    let limit = Number.POSITIVE_INFINITY;

    const builder = {
      ...query(() => {
        if (!table) throw new Error("fake db select without from");
        const from = table;

        return rowsOf(from)
          .filter(row => matches(from, row, whereOf(where)))
          .slice(0, limit)
          .map(row => project(from, row, fields));
      }),
      from: (from: Table) => {
        table = from;

        return builder;
      },
      leftJoin: () => builder,
      limit: (count: number) => {
        limit = count;

        return builder;
      },
      where: (condition: SQL | undefined) => {
        where = condition;

        return builder;
      },
    };

    return builder;
  };

  const remove = (table: Table) => {
    let where: SQL | undefined;
    let returning: Record<string, unknown> | undefined;
    let wantsRows = false;

    const builder = {
      ...query(() => {
        const rows = rowsOf(table);
        const conditions = whereOf(where);
        const removed = rows.filter(row => matches(table, row, conditions));
        tables.set(
          table,
          rows.filter(row => !removed.includes(row)),
        );

        return wantsRows
          ? removed.map(row => project(table, row, returning))
          : [];
      }),
      returning: (fields?: Record<string, unknown>) => {
        wantsRows = true;
        returning = fields;

        return builder;
      },
      where: (condition: SQL | undefined) => {
        where = condition;

        return builder;
      },
    };

    return builder;
  };

  const update = (table: Table) => {
    let values: FakeRow = {};
    let where: SQL | undefined;

    const builder = {
      ...query(() => {
        const conditions = whereOf(where);
        for (const row of rowsOf(table)) {
          if (matches(table, row, conditions)) Object.assign(row, values);
        }

        return [];
      }),
      set: (next: FakeRow) => {
        values = next;

        return builder;
      },
      where: (condition: SQL | undefined) => {
        where = condition;

        return builder;
      },
    };

    return builder;
  };

  return {
    db: { delete: remove, select, update },
    rowsOf: (table: Table): FakeRow[] => rowsOf(table),
  };
};
