import {
  Column,
  getColumns,
  getColumnTable,
  getTableName,
  is,
  Param,
  SQL,
  StringChunk,
  Table,
} from "drizzle-orm";

export type MemoryRow = Record<string, unknown>;

type Scope = Map<string, { row: MemoryRow | null; table: Table }>;

const scopeOf = (...entries: [Table, MemoryRow | null][]): Scope =>
  new Map(entries.map(([table, row]) => [getTableName(table), { row, table }]));

type Node =
  | { args: "*" | Node[]; kind: "call"; name: string }
  | { column: Column; kind: "column" }
  | {
      insensitive: boolean;
      kind: "like";
      left: Node;
      negated: boolean;
      right: Node;
    }
  | { item: Node; kind: "cast"; to: string }
  | { item: Node; kind: "isNull"; negated: boolean }
  | { item: Node; kind: "not" }
  | { items: Node[]; kind: "and" | "or" }
  | { kind: "compare"; left: Node; operator: string; right: Node }
  | { kind: "in"; left: Node; negated: boolean; options: Node[] }
  | { kind: "value"; value: unknown };

type Token =
  | { column: Column; kind: "column" }
  | { kind: "value"; value: unknown }
  | { kind: "word"; value: string };

interface OrderTerm {
  descending: boolean;
  node: Node;
  nullsFirst: boolean;
}

interface Join {
  on: SQL | undefined;
  outer: boolean;
  table: Table;
}

const columnsOf = (table: Table): Record<string, Column> => getColumns(table);

const sourceOf = (column: Column): string =>
  getTableName(getColumnTable(column));

const unsupported = (what: string): never => {
  throw new Error(`memory db cannot evaluate ${what}`);
};

const originalNameOf = (table: Table): string => {
  const name: unknown = Reflect.get(table, Symbol.for("drizzle:OriginalName"));
  if (typeof name !== "string")
    return unsupported("a source that is not a table");

  return name;
};

const WORD_PATTERN =
  /\s*(>=|<=|<>|!=|::|[(),*=<>]|'(?:[^']|'')*'|"[^"]*"|\d+(?:\.\d+)?|[A-Za-z_][\w]*)/y;

const tokenizeText = (text: string): Token[] => {
  const tokens: Token[] = [];
  WORD_PATTERN.lastIndex = 0;
  while (WORD_PATTERN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(WORD_PATTERN.lastIndex))) break;
    const start = WORD_PATTERN.lastIndex;
    const match = WORD_PATTERN.exec(text);
    if (!match?.[1]) unsupported(`the SQL text "${text.slice(start)}"`);
    const word = match?.[1] ?? "";
    if (word.startsWith("'")) {
      tokens.push({
        kind: "value",
        value: word.slice(1, -1).replace(/''/g, "'"),
      });
    } else if (word.startsWith('"')) {
      unsupported(`the raw identifier ${word}`);
    } else if (/^\d/.test(word)) {
      tokens.push({ kind: "value", value: Number(word) });
    } else {
      tokens.push({ kind: "word", value: word.toLowerCase() });
    }
  }

  return tokens;
};

const tokenize = (chunk: unknown): Token[] => {
  if (is(chunk, SQL)) return chunk.queryChunks.flatMap(tokenize);
  if (is(chunk, SQL.Aliased)) return tokenize(chunk.sql);
  if (is(chunk, StringChunk)) return tokenizeText(chunk.value.join(""));
  if (is(chunk, Column)) return [{ column: chunk, kind: "column" }];
  if (is(chunk, Param)) return [{ kind: "value", value: chunk.value }];
  if (Array.isArray(chunk)) {
    return [
      { kind: "word", value: "(" },
      ...chunk.flatMap((item: unknown, index) => [
        ...(index > 0 ? [{ kind: "word", value: "," } as const] : []),
        ...tokenize(item),
      ]),
      { kind: "word", value: ")" },
    ];
  }
  if (is(chunk, Table)) unsupported(`a table inside an expression`);
  if (
    chunk === null ||
    ["bigint", "boolean", "number", "string", "undefined"].includes(
      typeof chunk,
    ) ||
    chunk instanceof Date
  ) {
    return [{ kind: "value", value: chunk ?? null }];
  }
  if (typeof chunk === "object" && "getSQL" in chunk) {
    return unsupported("a subquery");
  }

  return [{ kind: "value", value: chunk }];
};

const COMPARISONS = new Set(["!=", "<", "<=", "<>", "=", ">", ">="]);

const parseTokens = (tokens: Token[], source: string) => {
  let position = 0;

  const peek = (offset = 0): Token | undefined => tokens[position + offset];
  const isWord = (value: string, offset = 0) => {
    const token = peek(offset);

    return token?.kind === "word" && token.value === value;
  };
  const expect = (value: string) => {
    if (!isWord(value)) unsupported(`"${source}" (expected "${value}")`);
    position++;
  };

  const parseList = (): Node[] => {
    expect("(");
    const items: Node[] = [];
    while (!isWord(")")) {
      items.push(parseOr());
      if (!isWord(",")) break;
      position++;
    }
    expect(")");

    return items;
  };

  const parsePrimary = (): Node => {
    const token = peek();
    if (!token) return unsupported(`"${source}" (unexpected end)`);
    position++;
    if (token.kind === "column")
      return { column: token.column, kind: "column" };
    if (token.kind === "value") return { kind: "value", value: token.value };
    if (token.value === "(") {
      const inner = parseOr();
      if (isWord(",")) unsupported(`the row comparison in "${source}"`);
      expect(")");

      return inner;
    }
    if (token.value === "true") return { kind: "value", value: true };
    if (token.value === "false") return { kind: "value", value: false };
    if (token.value === "null") return { kind: "value", value: null };
    if (isWord("(")) {
      position++;
      if (isWord("*")) {
        position++;
        expect(")");

        return { args: "*", kind: "call", name: token.value };
      }
      position--;

      return { args: parseList(), kind: "call", name: token.value };
    }

    return unsupported(`"${token.value}" in "${source}"`);
  };

  const parseCast = (): Node => {
    let node = parsePrimary();
    while (isWord("::")) {
      position++;
      const target = peek();
      if (target?.kind !== "word") return unsupported(`a cast in "${source}"`);
      position++;
      node = { item: node, kind: "cast", to: target.value };
    }

    return node;
  };

  const parseComparison = (): Node => {
    const left = parseCast();
    const token = peek();
    if (token?.kind !== "word") return left;

    if (COMPARISONS.has(token.value)) {
      position++;

      return {
        kind: "compare",
        left,
        operator: token.value === "!=" ? "<>" : token.value,
        right: parseCast(),
      };
    }
    if (token.value === "is") {
      position++;
      const negated = isWord("not");
      if (negated) position++;
      expect("null");

      return { item: left, kind: "isNull", negated };
    }
    const negated = token.value === "not";
    const keyword = negated ? peek(1) : token;
    if (keyword?.kind !== "word") return left;
    if (keyword.value === "in") {
      position += negated ? 2 : 1;

      return { kind: "in", left, negated, options: parseList() };
    }
    if (keyword.value === "like" || keyword.value === "ilike") {
      position += negated ? 2 : 1;

      return {
        insensitive: keyword.value === "ilike",
        kind: "like",
        left,
        negated,
        right: parseCast(),
      };
    }

    return left;
  };

  const parseNot = (): Node => {
    if (isWord("not")) {
      position++;

      return { item: parseNot(), kind: "not" };
    }

    return parseComparison();
  };

  const parseJunction = (kind: "and" | "or", parseItem: () => Node): Node => {
    const items = [parseItem()];
    while (isWord(kind)) {
      position++;
      items.push(parseItem());
    }

    return items.length === 1 ? items[0] : { items, kind };
  };

  const parseAnd = () => parseJunction("and", parseNot);
  const parseOr = (): Node => parseJunction("or", parseAnd);

  const parseOrderTerm = (): OrderTerm => {
    const node = parseOr();
    let descending = false;
    if (isWord("asc") || isWord("desc")) {
      descending = isWord("desc");
      position++;
    }
    let nullsFirst = descending;
    if (isWord("nulls")) {
      position++;
      nullsFirst = isWord("first");
      if (!isWord("first") && !isWord("last")) {
        unsupported(`"${source}" (expected first or last)`);
      }
      position++;
    }

    return { descending, node, nullsFirst };
  };

  const finish = <T>(value: T): T => {
    if (position !== tokens.length) {
      unsupported(`"${source}" (trailing tokens)`);
    }

    return value;
  };

  return {
    expression: () => finish(parseOr()),
    order: () => {
      const terms = [parseOrderTerm()];
      while (isWord(",")) {
        position++;
        terms.push(parseOrderTerm());
      }

      return finish(terms);
    },
  };
};

const render = (chunk: unknown): string =>
  tokenize(chunk)
    .map(token =>
      token.kind === "column"
        ? `${getTableName(getColumnTable(token.column))}.${token.column.name}`
        : token.kind === "value"
          ? JSON.stringify(token.value)
          : token.value,
    )
    .join(" ");

const parseExpression = (chunk: unknown): Node =>
  parseTokens(tokenize(chunk), render(chunk)).expression();

const parseOrder = (chunks: unknown[]): OrderTerm[] =>
  chunks.flatMap(chunk => parseTokens(tokenize(chunk), render(chunk)).order());

const keyOf = (column: Column): string => {
  const entry = Object.entries(columnsOf(getColumnTable(column))).find(
    ([, candidate]) => candidate.name === column.name,
  );

  return entry ? entry[0] : unsupported(`the column ${column.name}`);
};

const comparable = (value: unknown): unknown =>
  value instanceof Date ? value.getTime() : value;

const equal = (left: unknown, right: unknown): boolean => {
  if (typeof left === "object" || typeof right === "object") {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return comparable(left) === comparable(right);
};

const textOf = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (["bigint", "boolean", "number"].includes(typeof value)) {
    return String(value);
  }

  return unsupported(`text of ${JSON.stringify(value)}`);
};

const isMissing = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

const compare = (left: unknown, operator: string, right: unknown) => {
  if (isMissing(left) || isMissing(right)) return null;
  if (operator === "=") return equal(left, right);
  if (operator === "<>") return !equal(left, right);
  const a = comparable(left) as number | string;
  const b = comparable(right) as number | string;
  if (typeof a !== typeof b) {
    return unsupported(`comparing ${typeof a} with ${typeof b}`);
  }
  if (operator === ">") return a > b;
  if (operator === ">=") return a >= b;
  if (operator === "<") return a < b;
  if (operator === "<=") return a <= b;

  return unsupported(`the operator ${operator}`);
};

const likePattern = (pattern: string, insensitive: boolean): RegExp =>
  new RegExp(
    `^${pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".")}$`,
    insensitive ? "is" : "s",
  );

const evaluate = (
  node: Node,
  scope: Scope,
  group: Scope[] | undefined,
): unknown => {
  const of = (child: Node) => evaluate(child, scope, group);

  switch (node.kind) {
    case "and": {
      const values = node.items.map(of);
      if (values.includes(false)) return false;

      return values.some(isMissing) ? null : true;
    }
    case "call":
      return call(node, scope, group);
    case "cast": {
      const value = of(node.item);
      if (isMissing(value)) return null;
      if (node.to === "text") {
        return textOf(value);
      }
      if (["bigint", "int", "integer", "numeric"].includes(node.to)) {
        return Number(value);
      }

      return unsupported(`a cast to ${node.to}`);
    }
    case "column": {
      if (!scope.has(sourceOf(node.column))) {
        return unsupported(
          `${sourceOf(node.column)}.${node.column.name}, which is not in the query`,
        );
      }

      return (
        scope.get(sourceOf(node.column))?.row?.[keyOf(node.column)] ?? null
      );
    }
    case "compare":
      return compare(of(node.left), node.operator, of(node.right));
    case "in": {
      const left = of(node.left);
      if (isMissing(left)) return null;
      const options = node.options.map(of);
      const found = options.some(option => compare(left, "=", option) === true);
      if (found) return !node.negated;

      return options.some(isMissing) ? null : node.negated;
    }
    case "isNull":
      return isMissing(of(node.item)) !== node.negated;
    case "like": {
      const left = of(node.left);
      const right = of(node.right);
      if (isMissing(left) || isMissing(right)) return null;

      return (
        likePattern(textOf(right), node.insensitive).test(textOf(left)) !==
        node.negated
      );
    }
    case "not": {
      const value = of(node.item);

      return isMissing(value) ? null : !value;
    }
    case "or": {
      const values = node.items.map(of);
      if (values.includes(true)) return true;

      return values.some(isMissing) ? null : false;
    }
    case "value":
      return node.value;
  }
};

const call = (
  node: Extract<Node, { kind: "call" }>,
  scope: Scope,
  group: Scope[] | undefined,
): unknown => {
  if (node.name === "count") {
    if (!group) return unsupported("count() outside an aggregate query");
    if (node.args === "*") return group.length;
    const [argument] = node.args;
    if (!argument || node.args.length > 1) return unsupported("count()");

    return group.filter(
      member => !isMissing(evaluate(argument, member, undefined)),
    ).length;
  }
  if (node.args === "*") return unsupported(`${node.name}(*)`);
  const args = node.args.map(argument => evaluate(argument, scope, group));
  if (node.name === "now" && args.length === 0) return new Date();
  if (node.name === "lower") {
    return isMissing(args[0]) ? null : textOf(args[0]).toLowerCase();
  }
  if (node.name === "coalesce") {
    return args.find(value => !isMissing(value)) ?? null;
  }

  return unsupported(`the function ${node.name}()`);
};

const isAggregate = (node: Node): boolean => {
  switch (node.kind) {
    case "and":
    case "or":
      return node.items.some(isAggregate);
    case "call":
      return (
        node.name === "count" ||
        (node.args !== "*" && node.args.some(isAggregate))
      );
    case "cast":
    case "not":
      return isAggregate(node.item);
    case "compare":
    case "like":
      return isAggregate(node.left) || isAggregate(node.right);
    case "in":
      return isAggregate(node.left) || node.options.some(isAggregate);
    case "isNull":
      return isAggregate(node.item);
    default:
      return false;
  }
};

const holds = (condition: SQL | undefined, scope: Scope): boolean =>
  condition === undefined ||
  evaluate(parseExpression(condition), scope, undefined) === true;

const fullRow = (table: Table, row: MemoryRow | null | undefined) =>
  row
    ? Object.fromEntries(
        Object.keys(columnsOf(table)).map(key => [key, row[key] ?? null]),
      )
    : null;

type Fields = Record<string, unknown>;

const fieldNodes = new WeakMap<object, Node>();

const nodeOf = (field: SQL | SQL.Aliased): Node => {
  const cached = fieldNodes.get(field);
  if (cached) return cached;
  const node = parseExpression(field);
  fieldNodes.set(field, node);

  return node;
};

const fieldsAggregate = (fields: Fields): boolean =>
  Object.values(fields).some(field =>
    is(field, SQL) || is(field, SQL.Aliased)
      ? isAggregate(nodeOf(field))
      : !is(field, Column) &&
        !is(field, Table) &&
        typeof field === "object" &&
        field !== null &&
        fieldsAggregate(field as Fields),
  );

const project = (
  fields: Fields,
  scope: Scope,
  group: Scope[] | undefined,
): MemoryRow =>
  Object.fromEntries(
    Object.entries(fields).map(([alias, field]) => {
      if (is(field, Column)) {
        return [
          alias,
          evaluate({ column: field, kind: "column" }, scope, group),
        ];
      }
      if (is(field, Table)) {
        return [alias, fullRow(field, scope.get(getTableName(field))?.row)];
      }
      if (is(field, SQL) || is(field, SQL.Aliased)) {
        return [alias, evaluate(nodeOf(field), scope, group)];
      }
      if (typeof field === "object" && field !== null) {
        return [alias, project(field as Fields, scope, group)];
      }

      return unsupported(`the selected field ${alias}`);
    }),
  );

const sortScopes = (
  scopes: Scope[],
  terms: OrderTerm[],
  valueOf: (node: Node, scope: Scope) => unknown,
): Scope[] =>
  scopes
    .map(scope => ({
      keys: terms.map(term => comparable(valueOf(term.node, scope))),
      scope,
    }))
    .sort((a, b) => {
      for (const [index, term] of terms.entries()) {
        const left = a.keys[index];
        const right = b.keys[index];
        if (isMissing(left) && isMissing(right)) continue;
        if (isMissing(left)) return term.nullsFirst ? -1 : 1;
        if (isMissing(right)) return term.nullsFirst ? 1 : -1;
        if (left === right) continue;
        const ascending = (left as number) < (right as number) ? -1 : 1;

        return term.descending ? -ascending : ascending;
      }

      return 0;
    })
    .map(({ scope }) => scope);

const isSerial = (column: Column) =>
  column.columnType.includes("Serial") ||
  column.generatedIdentity !== undefined;

const uniqueViolation = (table: Table, key: string) =>
  Object.assign(
    new Error(
      `duplicate key value violates unique constraint on ${getTableName(table)}.${key}`,
    ),
    { code: "23505" },
  );

type ConflictPolicy =
  | { action: "nothing"; target: Column[] | undefined }
  | {
      action: "update";
      set: MemoryRow;
      target: Column[];
      where: SQL | undefined;
    };

class Rollback extends Error {
  constructor() {
    super("Rollback");
  }
}

export const createMemoryDb = (seed: [Table, readonly object[]][] = []) => {
  const store = new Map<string, MemoryRow[]>(
    seed.map(([table, rows]) => [
      originalNameOf(table),
      rows.map(row => Object.fromEntries(Object.entries(row))),
    ]),
  );

  const rowsOf = (table: Table): MemoryRow[] => {
    if (!is(table, Table)) return unsupported("a source that is not a table");
    const name = originalNameOf(table);
    const existing = store.get(name);
    if (existing) return existing;
    const created: MemoryRow[] = [];
    store.set(name, created);

    return created;
  };

  type Undo = () => void;

  const nextSerial = (table: Table, key: string): number =>
    rowsOf(table).reduce(
      (highest, row) =>
        typeof row[key] === "number" ? Math.max(highest, row[key]) : highest,
      0,
    ) + 1;

  const defaultOf = (table: Table, key: string, column: Column): unknown => {
    if (column.defaultFn) return column.defaultFn();
    if (column.onUpdateFn) return column.onUpdateFn();
    if (column.default !== undefined) {
      return is(column.default, SQL)
        ? evaluate(parseExpression(column.default), scopeOf(), undefined)
        : structuredClone(column.default);
    }
    if (isSerial(column)) return nextSerial(table, key);

    return null;
  };

  const buildRow = (table: Table, values: MemoryRow): MemoryRow => {
    const unknownKey = Object.keys(values).find(
      key => !(key in columnsOf(table)),
    );
    if (unknownKey)
      unsupported(`the column ${unknownKey} on ${getTableName(table)}`);

    return Object.fromEntries(
      Object.entries(columnsOf(table)).map(([key, column]) => {
        const given = values[key];
        const value =
          given === undefined
            ? defaultOf(table, key, column)
            : is(given, SQL)
              ? evaluate(parseExpression(given), scopeOf(), undefined)
              : given;
        if (isMissing(value) && column.notNull) {
          throw Object.assign(
            new Error(
              `null value in column ${getTableName(table)}.${key} violates not-null constraint`,
            ),
            { code: "23502" },
          );
        }

        return [key, value];
      }),
    );
  };

  const uniqueKeys = (table: Table): string[] =>
    Object.entries(columnsOf(table))
      .filter(([, column]) => column.primary || column.isUnique)
      .map(([key]) => key);

  const conflictOf = (
    table: Table,
    row: MemoryRow,
    keys: string[],
    ignore?: MemoryRow,
  ): MemoryRow | undefined =>
    rowsOf(table).find(
      existing =>
        existing !== ignore &&
        keys.length > 0 &&
        keys.every(
          key => !isMissing(row[key]) && equal(existing[key], row[key]),
        ),
    );

  const firstUniqueConflict = (
    table: Table,
    row: MemoryRow,
    ignore?: MemoryRow,
  ): string | undefined =>
    uniqueKeys(table).find(key => conflictOf(table, row, [key], ignore));

  const applySet = (
    table: Table,
    row: MemoryRow,
    values: MemoryRow,
    extra?: [Table, MemoryRow][],
  ): MemoryRow => {
    const scope = scopeOf([table, row], ...(extra ?? []));
    const next = { ...row };
    for (const [key, column] of Object.entries(columnsOf(table))) {
      const given = values[key];
      if (given !== undefined) {
        next[key] = is(given, SQL)
          ? evaluate(parseExpression(given), scope, undefined)
          : given;
      } else if (column.onUpdateFn) {
        next[key] = column.onUpdateFn();
      }
    }
    const unknownKey = Object.keys(values).find(
      key => !(key in columnsOf(table)),
    );
    if (unknownKey)
      unsupported(`the column ${unknownKey} on ${getTableName(table)}`);

    return next;
  };

  const returningOf = (
    table: Table,
    rows: MemoryRow[],
    fields: Fields | undefined,
  ): MemoryRow[] =>
    rows.map(row =>
      fields
        ? project(fields, scopeOf([table, row]), undefined)
        : (fullRow(table, row) ?? {}),
    );

  const thenable = <T>(run: () => T) => ({
    execute: async () => await Promise.resolve().then(run),
    then: async <R1 = T, R2 = never>(
      onFulfilled?: (value: T) => PromiseLike<R1> | R1,
      onRejected?: (reason: unknown) => PromiseLike<R2> | R2,
    ) => await Promise.resolve().then(run).then(onFulfilled, onRejected),
  });

  const locks = new Map<string, Promise<void>>();

  const acquireLock = async (key: string): Promise<() => void> => {
    const previous = locks.get(key) ?? Promise.resolve();
    let release = () => {};
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    locks.set(
      key,
      previous.then(async () => {
        await held;
      }),
    );
    await previous;

    return release;
  };

  const createSession = (undo: undefined | Undo[]) => {
    const record = (action: Undo) => {
      undo?.push(action);
    };

    const select = (fields?: Fields, distinct = false) => {
      let source: Table | undefined;
      const joins: Join[] = [];
      let condition: SQL | undefined;
      let grouping: unknown[] = [];
      let ordering: unknown[] = [];
      let size = Number.POSITIVE_INFINITY;
      let skip = 0;

      const run = (): MemoryRow[] => {
        if (!source) return unsupported("a select without from");
        const from = source;
        let scopes: Scope[] = rowsOf(from).map(row => scopeOf([from, row]));
        for (const join of joins) {
          scopes = scopes.flatMap(scope => {
            const matched = rowsOf(join.table)
              .map(row => new Map([...scope, ...scopeOf([join.table, row])]))
              .filter(candidate => holds(join.on, candidate));
            if (matched.length > 0 || !join.outer) return matched;

            return [new Map([...scope, ...scopeOf([join.table, null])])];
          });
        }
        scopes = scopes.filter(scope => holds(condition, scope));

        const groupNodes = grouping.map(parseExpression);
        const aggregated =
          groupNodes.length > 0 || (fields ? fieldsAggregate(fields) : false);
        const orderTerms = parseOrder(ordering);

        if (aggregated) {
          if (!fields) return unsupported("an aggregate select without fields");
          const groups = new Map<string, Scope[]>();
          for (const scope of scopes) {
            const key = JSON.stringify(
              groupNodes.map(node =>
                comparable(evaluate(node, scope, undefined)),
              ),
            );
            groups.set(key, [...(groups.get(key) ?? []), scope]);
          }
          if (groupNodes.length === 0 && groups.size === 0) groups.set("", []);
          const representatives = [...groups.values()].map(members => ({
            members,
            scope: members[0] ?? scopeOf(),
          }));
          const byScope = new Map(
            representatives.map(entry => [entry.scope, entry.members]),
          );
          const sorted = sortScopes(
            representatives.map(entry => entry.scope),
            orderTerms,
            (node, scope) => evaluate(node, scope, byScope.get(scope)),
          );

          return sorted
            .map(scope => project(fields, scope, byScope.get(scope)))
            .slice(skip, skip + size);
        }

        const sorted = sortScopes(scopes, orderTerms, (node, scope) =>
          evaluate(node, scope, undefined),
        );
        const projected = sorted.map(scope =>
          fields
            ? project(fields, scope, undefined)
            : joins.length === 0
              ? (fullRow(from, scope.get(getTableName(from))?.row) ?? {})
              : Object.fromEntries(
                  [...scope].map(([name, { row, table }]) => [
                    name,
                    fullRow(table, row),
                  ]),
                ),
        );
        const unique = distinct
          ? [
              ...new Map(
                projected.map(row => [JSON.stringify(row), row]),
              ).values(),
            ]
          : projected;

        return unique.slice(skip, skip + size);
      };

      const query = {
        ...thenable(run),
        from: (from: Table) => {
          source = from;

          return query;
        },
        groupBy: (...columns: unknown[]) => {
          grouping = columns;

          return query;
        },
        innerJoin: (table: Table, on: SQL | undefined) => {
          joins.push({ on, outer: false, table });

          return query;
        },
        leftJoin: (table: Table, on: SQL | undefined) => {
          joins.push({ on, outer: true, table });

          return query;
        },
        limit: (limit: number) => {
          size = limit;

          return query;
        },
        offset: (offset: number) => {
          skip = offset;

          return query;
        },
        orderBy: (...terms: unknown[]) => {
          ordering = terms.filter(term => term !== undefined);

          return query;
        },
        where: (where: SQL | undefined) => {
          condition = where;

          return query;
        },
      };

      return query;
    };

    const insert = (table: Table) => ({
      values: (values: MemoryRow | MemoryRow[]) => {
        let policy: ConflictPolicy | undefined;
        let returning: Fields | undefined;
        let wantsRows = false;

        const run = (): MemoryRow[] => {
          const rows = rowsOf(table);
          const affected: MemoryRow[] = [];
          for (const value of Array.isArray(values) ? values : [values]) {
            const row = buildRow(table, value);
            const targetKeys = policy?.target?.map(keyOf);
            const conflicting = targetKeys
              ? conflictOf(table, row, targetKeys)
              : policy
                ? uniqueKeys(table)
                    .map(key => conflictOf(table, row, [key]))
                    .find(Boolean)
                : undefined;
            if (conflicting && policy?.action === "nothing") continue;
            if (conflicting && policy?.action === "update") {
              if (!holds(policy.where, scopeOf([table, conflicting]))) {
                continue;
              }
              const before = { ...conflicting };
              Object.assign(
                conflicting,
                applySet(table, conflicting, policy.set),
              );
              record(() => {
                Object.keys(conflicting).forEach(key => {
                  delete conflicting[key];
                });
                Object.assign(conflicting, before);
              });
              affected.push(conflicting);
              continue;
            }
            const violated = firstUniqueConflict(table, row);
            if (violated) throw uniqueViolation(table, violated);
            rows.push(row);
            record(() => {
              const index = rows.indexOf(row);
              if (index !== -1) rows.splice(index, 1);
            });
            affected.push(row);
          }

          return wantsRows ? returningOf(table, affected, returning) : [];
        };

        const query = {
          ...thenable(run),
          onConflictDoNothing: (config?: { target?: Column | Column[] }) => {
            policy = {
              action: "nothing",
              target:
                config?.target === undefined
                  ? undefined
                  : [config.target].flat(),
            };

            return query;
          },
          onConflictDoUpdate: (config: {
            set: MemoryRow;
            target: Column | Column[];
            targetWhere?: SQL;
            where?: SQL;
          }) => {
            if (config.targetWhere)
              unsupported("onConflictDoUpdate targetWhere");
            policy = {
              action: "update",
              set: config.set,
              target: [config.target].flat(),
              where: config.where,
            };

            return query;
          },
          returning: (fields?: Fields) => {
            wantsRows = true;
            returning = fields;

            return query;
          },
        };

        return query;
      },
    });

    const update = (table: Table) => ({
      set: (values: MemoryRow) => {
        let condition: SQL | undefined;
        let returning: Fields | undefined;
        let wantsRows = false;

        const run = (): MemoryRow[] => {
          const matched = rowsOf(table).filter(row =>
            holds(condition, scopeOf([table, row])),
          );
          const changes = matched.map(row => ({
            next: applySet(table, row, values),
            row,
          }));
          for (const { next, row } of changes) {
            const violated = uniqueKeys(table).find(
              key =>
                !equal(next[key], row[key]) &&
                conflictOf(table, next, [key], row),
            );
            if (violated) throw uniqueViolation(table, violated);
          }
          for (const { next, row } of changes) {
            const before = { ...row };
            Object.assign(row, next);
            record(() => {
              Object.keys(row).forEach(key => {
                delete row[key];
              });
              Object.assign(row, before);
            });
          }

          return wantsRows ? returningOf(table, matched, returning) : [];
        };

        const query = {
          ...thenable(run),
          returning: (fields?: Fields) => {
            wantsRows = true;
            returning = fields;

            return query;
          },
          where: (where: SQL | undefined) => {
            condition = where;

            return query;
          },
        };

        return query;
      },
    });

    const remove = (table: Table) => {
      let condition: SQL | undefined;
      let returning: Fields | undefined;
      let wantsRows = false;

      const run = (): MemoryRow[] => {
        const rows = rowsOf(table);
        const removed = rows.filter(row =>
          holds(condition, scopeOf([table, row])),
        );
        const kept = rows.filter(row => !removed.includes(row));
        const before = [...rows];
        rows.splice(0, rows.length, ...kept);
        record(() => {
          rows.splice(0, rows.length, ...before);
        });

        return wantsRows ? returningOf(table, removed, returning) : [];
      };

      const query = {
        ...thenable(run),
        returning: (fields?: Fields) => {
          wantsRows = true;
          returning = fields;

          return query;
        },
        where: (where: SQL | undefined) => {
          condition = where;

          return query;
        },
      };

      return query;
    };

    return { insert, remove, select, update };
  };

  const advisoryLockKey = (query: SQL): string | undefined => {
    const tokens = tokenize(query);
    const [first, second] = tokens;
    const named =
      first?.kind === "word" &&
      first.value === "select" &&
      second?.kind === "word" &&
      second.value === "pg_advisory_xact_lock";
    if (!named) return undefined;

    return JSON.stringify(
      tokens.flatMap(token => (token.kind === "value" ? [token.value] : [])),
    );
  };

  interface Frame {
    releases: (() => void)[];
    undo: Undo[];
  }

  const transaction = async <T>(
    run: (tx: unknown) => Promise<T>,
    parent: Frame | undefined,
  ): Promise<T> => {
    const undo: Undo[] = [];
    const releases = parent?.releases ?? [];
    const tx = {
      ...facade(undo),
      execute: async (query: SQL) => {
        const key = advisoryLockKey(query);
        if (key === undefined) return unsupported(`execute "${render(query)}"`);
        releases.push(await acquireLock(key));

        return [];
      },
      rollback: () => {
        throw new Rollback();
      },
      transaction: async <R>(nested: (inner: unknown) => Promise<R>) =>
        await transaction(nested, { releases, undo }),
    };

    try {
      const result = await run(tx);
      parent?.undo.push(...undo);

      return result;
    } catch (error) {
      for (const action of undo.reverse()) action();
      throw error;
    } finally {
      if (!parent) for (const release of releases) release();
    }
  };

  const facade = (undo: undefined | Undo[]) => {
    const session = createSession(undo);

    return {
      delete: session.remove,
      insert: session.insert,
      select: (fields?: Fields) => session.select(fields),
      selectDistinct: (fields?: Fields) => session.select(fields, true),
      update: session.update,
    };
  };

  const db = {
    ...facade(undefined),
    execute: async (query: SQL) => {
      if (advisoryLockKey(query) === undefined) {
        return unsupported(`execute "${render(query)}"`);
      }

      return await Promise.resolve([]);
    },
    transaction: async <T>(run: (tx: unknown) => Promise<T>) =>
      await transaction(run, undefined),
  };

  return {
    db,
    rows: (table: Table): MemoryRow[] => rowsOf(table).map(row => ({ ...row })),
  };
};
