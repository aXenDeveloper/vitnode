/**
 * drizzle-kit's `--explain --output json` result, as far as VitNode reads it.
 *
 * This is drizzle-kit's structured output, not its terminal text - nothing
 * here parses a human-readable log.
 */
export type ExplainResult =
  | { error?: { message?: string }; status: "error" }
  | { statements?: DrizzleStatement[]; status: "ok" }
  | { status: "missing_hints"; unresolved: MissingHint[] }
  | { status: "no_changes" };

export interface DrizzleStatement {
  [field: string]: unknown;
  type: string;
}

export interface MissingHint {
  entity?: unknown;
  kind?: string;
  reason?: string;
  type: string;
}

/** The last JSON object a drizzle-kit `--output json` run printed. */
export const parseDrizzleJson = (output: string): ExplainResult | null => {
  const lines = output.trim().split(/\r?\n/).reverse();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && "status" in parsed) {
        return parsed as ExplainResult;
      }
    } catch {
      // Not the result line - keep looking.
    }
  }

  return null;
};

export interface StatementSummary {
  /** What kind of object: table, column, index, foreign key... */
  kind: string;
  /** The object's name, with its table when it belongs to one. */
  name: string;
  sign: "+" | "-" | "~";
}

const KIND_NAMES: Record<string, string> = {
  check: "check constraint",
  fk: "foreign key",
  pk: "primary key",
  unique: "unique constraint",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const qualified = (entity: Record<string, unknown>): string => {
  const name = typeof entity.name === "string" ? entity.name : "";
  const table = typeof entity.table === "string" ? entity.table : null;
  const schema =
    typeof entity.schema === "string" && entity.schema !== "public"
      ? `${entity.schema}.`
      : "";

  return table === null || table === name
    ? `${schema}${name}`
    : `${schema}${table}.${name}`;
};

/**
 * One line per statement: `+ table notifications`, `~ column users.email`.
 *
 * Read from the statement's `type` (`create_table`, `drop_column`, ...) and
 * the first object in it that has a `name` - drizzle-kit's own vocabulary, so
 * a statement type VitNode has never seen still gets a sensible line instead
 * of being dropped.
 */
export const summarizeStatement = (
  statement: DrizzleStatement,
): StatementSummary => {
  const [verb = "", ...rest] = statement.type.split("_");
  const sign =
    verb === "create" || verb === "add"
      ? "+"
      : verb === "drop" || verb === "delete"
        ? "-"
        : "~";
  const kindKey = rest.join("_");
  const kind = KIND_NAMES[kindKey] ?? rest.join(" ");

  const { from, to } = statement;
  if (isRecord(from) && isRecord(to)) {
    return { kind, name: `${qualified(from)} → ${qualified(to)}`, sign };
  }

  const entity = Object.entries(statement).find(
    ([key, value]) =>
      key !== "type" && isRecord(value) && typeof value.name === "string",
  )?.[1] as Record<string, unknown> | undefined;

  return {
    kind,
    name:
      entity === undefined
        ? typeof statement.key === "string"
          ? statement.key.replaceAll('"', "")
          : ""
        : qualified(entity),
    sign,
  };
};

/** `["public", "users", "email"]` → `users.email`. */
export const formatHintEntity = (entity: unknown): string =>
  Array.isArray(entity)
    ? entity
        .filter((part, index) => !(index === 0 && part === "public"))
        .join(".")
    : String(entity);

export const isDataLossHint = (hint: MissingHint) =>
  hint.type === "confirm_data_loss";
