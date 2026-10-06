export interface LocalMigration {
  folderMillis: number;
  hash: string;
  name: string;
}

export interface AppliedMigration {
  createdAt: null | number;
  hash: string;
  /** `null` in a journal written before drizzle recorded names. */
  name: null | string;
}

export interface MigrationState {
  applied: LocalMigration[];
  /** Recorded as applied, but no longer on disk. */
  missingLocally: string[];
  /** Applied, but the file on disk has changed since. */
  modified: string[];
  pending: LocalMigration[];
}

/**
 * Which local migrations the database has, and which it does not.
 *
 * The same rule `drizzle-orm`'s migrator applies - a migration is pending when
 * no journal row carries its folder name - so `db status` and `db migrate`
 * can never disagree about what is pending. Two things the migrator does not
 * check are reported on top: an applied migration whose file has since been
 * edited (its hash no longer matches) and a journal row with no file at all.
 *
 * A journal from before drizzle stored names is matched the way drizzle's own
 * upgrade does it: by timestamp, then by hash.
 */
export const computeMigrationState = (
  local: readonly LocalMigration[],
  journal: readonly AppliedMigration[],
): MigrationState => {
  const byName = new Map<string, AppliedMigration>();

  for (const row of journal) {
    const name =
      row.name ??
      local.find(
        migration =>
          migration.folderMillis === row.createdAt ||
          migration.hash === row.hash,
      )?.name ??
      null;
    if (name !== null) byName.set(name, row);
  }

  const localNames = new Set(local.map(migration => migration.name));

  return {
    applied: local.filter(migration => byName.has(migration.name)),
    missingLocally: [...byName.keys()].filter(name => !localNames.has(name)),
    modified: local
      .filter(migration => {
        const row = byName.get(migration.name);

        return row !== undefined && row.hash !== migration.hash;
      })
      .map(migration => migration.name),
    pending: local.filter(migration => !byName.has(migration.name)),
  };
};

/** A query runner - the app's Drizzle database, or a fake in tests. */
export type QueryRows = (query: string) => Promise<Record<string, unknown>[]>;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * The migrations journal, read without writing anything.
 *
 * `migrate()` is not usable for this: it creates the journal's schema and
 * table, and may upgrade an old table in place. Status must not change the
 * database it reports on, so this only reads - and an absent journal simply
 * means nothing has been applied yet.
 */
export const readJournal = async (
  query: QueryRows,
  { schema, table }: { schema: string; table: string },
): Promise<AppliedMigration[]> => {
  if (!IDENTIFIER.test(schema) || !IDENTIFIER.test(table)) {
    throw new Error(`Invalid migrations table "${schema}"."${table}".`);
  }

  const columns = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}'`,
  );
  if (columns.length === 0) return [];

  const hasName = columns.some(column => column.column_name === "name");
  const rows = await query(
    `SELECT hash, created_at${hasName ? ", name" : ""} FROM "${schema}"."${table}" ORDER BY id`,
  );

  return rows.map(row => ({
    createdAt:
      row.created_at === null || row.created_at === undefined
        ? null
        : Number(row.created_at),
    hash: String(row.hash),
    name: hasName && typeof row.name === "string" ? row.name : null,
  }));
};
