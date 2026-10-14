import type { Index } from "drizzle-orm/pg-core";

import { is, SQL, sql } from "drizzle-orm";
import {
  getTableConfig,
  IndexedColumn,
  PgDialect,
  PgTable,
} from "drizzle-orm/pg-core";
import { createJiti } from "jiti";
import {
  existsSync,
  globSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";

import type { QueryRows } from "./migration-state";

import { findDrizzleConfig } from "../project/project";

export interface IndexIdentity {
  name: string;
  schema: string;
}

export interface DeclaredIndex extends IndexIdentity {
  index: Index;
}

const SCHEMA_FILE = /\.[cm]?[jt]sx?$/;

const dialect = new PgDialect();

export const indexKey = ({ name, schema }: IndexIdentity) =>
  `${schema}.${name}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

export const declaredIndexes = (tables: readonly PgTable[]): DeclaredIndex[] =>
  tables.flatMap(table => {
    const { indexes, schema = "public" } = getTableConfig(table);

    return indexes.flatMap(index =>
      index.config.name === undefined
        ? []
        : [{ index, name: index.config.name, schema }],
    );
  });

export const recordedIndexKeys = (snapshot: unknown): Set<string> => {
  const keys = new Set<string>();
  const ddl =
    isRecord(snapshot) && Array.isArray(snapshot.ddl) ? snapshot.ddl : [];

  for (const entity of ddl) {
    if (
      isRecord(entity) &&
      entity.entityType === "indexes" &&
      typeof entity.name === "string"
    ) {
      keys.add(
        indexKey({
          name: entity.name,
          schema: typeof entity.schema === "string" ? entity.schema : "public",
        }),
      );
    }
  }

  return keys;
};

export const findMissingIndexes = <T extends IndexIdentity>({
  declared,
  existing,
  recorded,
}: {
  declared: readonly T[];
  existing: ReadonlySet<string>;
  recorded: ReadonlySet<string>;
}): T[] => [
  ...new Map(
    declared
      .filter(
        index =>
          recorded.has(indexKey(index)) && !existing.has(indexKey(index)),
      )
      .map(index => [indexKey(index), index] as const),
  ).values(),
];

const renderColumn = (column: unknown): SQL => {
  if (is(column, SQL)) return sql`(${column})`;
  if (!is(column, IndexedColumn)) {
    throw new Error("An index column is neither a column nor an expression.");
  }

  const { nulls, opClass, order } = column.indexConfig;
  const descending = order === "desc";

  return sql.join(
    [
      sql.identifier(column.name),
      opClass === undefined ? undefined : sql.raw(opClass),
      descending ? sql.raw("DESC") : undefined,
      nulls === undefined || (!descending && nulls === "last")
        ? undefined
        : sql.raw(`NULLS ${nulls.toUpperCase()}`),
    ].filter(isDefined),
    sql.raw(" "),
  );
};

export const renderCreateIndex = ({ index, name }: DeclaredIndex): string => {
  const {
    columns,
    method = "btree",
    table,
    unique,
    where,
    with: storage = {},
  } = index.config;
  const parameters = Object.entries(storage as Record<string, unknown>);

  const statement = sql.join(
    [
      sql.raw(unique ? "CREATE UNIQUE INDEX" : "CREATE INDEX"),
      sql`IF NOT EXISTS ${sql.identifier(name)} ON ${table}`,
      sql`USING ${sql.raw(method)} (${sql.join(columns.map(renderColumn), sql.raw(", "))})`,
      parameters.length === 0
        ? undefined
        : sql`WITH (${sql.join(
            parameters.map(([key, value]) => sql`${sql.raw(key)} = ${value}`),
            sql.raw(", "),
          )})`,
      where === undefined ? undefined : sql`WHERE ${where}`,
    ].filter(isDefined),
    sql.raw(" "),
  );

  return dialect.sqlToQuery(statement.inlineParams(), "indexes").sql;
};

const latestSnapshot = (migrationsFolder: string): unknown => {
  if (!existsSync(migrationsFolder)) return null;

  const latest = readdirSync(migrationsFolder)
    .map(entry => join(migrationsFolder, entry, "snapshot.json"))
    .filter(file => existsSync(file))
    .sort()
    .at(-1);

  return latest === undefined
    ? null
    : (JSON.parse(readFileSync(latest, "utf8")) as unknown);
};

const schemaFiles = (patterns: readonly string[], root: string): string[] => [
  ...new Set(
    globSync(patterns, { cwd: root })
      .map(match => resolve(root, match))
      .flatMap(path =>
        statSync(path).isDirectory()
          ? readdirSync(path).map(file => join(path, file))
          : [path],
      )
      .filter(file => SCHEMA_FILE.test(file) && statSync(file).isFile()),
  ),
];

const loadSchemaTables = async (root: string): Promise<PgTable[]> => {
  const configPath = findDrizzleConfig(root);
  if (configPath === null) return [];

  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded = await jiti.import<
    Record<string, unknown> & { default?: Record<string, unknown> }
  >(configPath);
  const { schema } = loaded.default ?? loaded;
  const patterns = (Array.isArray(schema) ? schema : [schema]).filter(
    (pattern): pattern is string => typeof pattern === "string",
  );
  const modules = await Promise.all(
    schemaFiles(patterns, root).map(async file =>
      jiti.import<Record<string, unknown>>(file),
    ),
  );

  return [
    ...new Set(
      modules
        .flatMap(module => Object.values(module))
        .filter((value): value is PgTable => is(value, PgTable)),
    ),
  ];
};

export const restoreMissingIndexes = async ({
  log,
  migrationsFolder,
  query,
  root,
}: {
  log: (message: string) => void;
  migrationsFolder: string;
  query: QueryRows;
  root: string;
}): Promise<void> => {
  const recorded = recordedIndexKeys(latestSnapshot(migrationsFolder));
  if (recorded.size === 0) return;

  const declared = declaredIndexes(await loadSchemaTables(root));
  const existing = new Set(
    (await query("SELECT schemaname, indexname FROM pg_indexes")).map(row =>
      indexKey({ name: String(row.indexname), schema: String(row.schemaname) }),
    ),
  );

  for (const missing of findMissingIndexes({ declared, existing, recorded })) {
    await query(renderCreateIndex(missing));
    log(`Restored index ${missing.name}`);
  }
};
