export interface StubQuery {
  kind: "delete" | "insert" | "select" | "update";
  selection?: Record<string, unknown>;
  table: unknown;
  values?: unknown;
}

export const createQueryStub = (answer: (query: StubQuery) => unknown[]) => {
  const executed: StubQuery[] = [];

  const builder = (query: StubQuery) => {
    const chain = {
      from: (table: unknown) => {
        query.table = table;

        return chain;
      },
      groupBy: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      limit: () => chain,
      offset: () => chain,
      orderBy: () => chain,
      returning: () => chain,
      set: (values: unknown) => {
        query.values = values;

        return chain;
      },
      then: async <T>(
        onFulfilled: (rows: unknown[]) => T,
        onRejected?: (reason: unknown) => T,
      ) => {
        executed.push(query);

        return await new Promise<unknown[]>(resolve => {
          resolve(answer(query));
        }).then(onFulfilled, onRejected);
      },
      values: (values: unknown) => {
        query.values = values;

        return chain;
      },
      where: () => chain,
    };

    return chain;
  };

  const write = (kind: StubQuery["kind"]) => (table: unknown) =>
    builder({ kind, table });
  const read = (selection?: Record<string, unknown>) =>
    builder({ kind: "select", selection, table: undefined });

  const db = {
    delete: write("delete"),
    insert: write("insert"),
    select: read,
    selectDistinct: read,
    update: write("update"),
  };

  return { db, executed };
};
