import type {
  PgColumn,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { and, asc, count, eq, gt, inArray, isNull, or } from "drizzle-orm";

import type { ContentId } from "../ids";
import type { AnyContentTypeDefinition } from "../types";
import type { ContentModel } from "./model";
import type { ContentDatabase } from "./service";

import { ContentInputError } from "../errors";
import { publicationColumns, publishedCondition } from "./publication";
import { isContentBaseRowPublic } from "./visibility";

export class ContentThreadPlacementError extends ContentInputError {
  constructor({
    contentTypeId,
    field,
    message,
  }: {
    contentTypeId: string;
    field: string;
    message: string;
  }) {
    super(message, { contentTypeId });
    this.name = "ContentThreadPlacementError";
    this.detail = message;
    this.field = field;
  }

  readonly detail: string;
  readonly field: string;
}

interface ThreadTable {
  columns: Record<string, PgColumn>;
  definition: AnyContentTypeDefinition;
  table: PgTableWithColumns<TableConfig>;
}

const keyOf = (value: unknown): null | string =>
  typeof value === "number" ||
  typeof value === "string" ||
  typeof value === "bigint"
    ? String(value)
    : null;

const same = (a: unknown, b: unknown): boolean =>
  keyOf(a) !== null && keyOf(a) === keyOf(b);

/**
 * Keeps a thread a tree: the parent answers in the same root, the record never
 * ends up below itself, and nothing sits deeper than `thread.maxDepth`. Runs on
 * every create and on any update that touches the parent or the root.
 */
export const assertContentThreadPlacement = async (
  tx: ContentDatabase,
  { columns, definition, table }: ThreadTable,
  { id, values }: { id: ContentId | null; values: Record<string, unknown> },
): Promise<void> => {
  const { thread } = definition;
  if (!thread.enabled) return;

  const { maxDepth, parentField, rootField } = thread;
  const touchesParent = Object.hasOwn(values, parentField);
  const touchesRoot = Object.hasOwn(values, rootField);
  if (id !== null && !touchesParent && !touchesRoot) return;

  const refuse = (field: string, message: string): never => {
    throw new ContentThreadPlacementError({
      contentTypeId: definition.id,
      field,
      message,
    });
  };

  const parentColumn = columns[parentField];
  const rootColumn = columns[rootField];
  const select = { id: columns.id, parent: parentColumn, root: rootColumn };

  const [current] =
    id === null
      ? [undefined]
      : await tx.select(select).from(table).where(eq(columns.id, id)).limit(1);

  const parentId = touchesParent ? values[parentField] : current?.parent;
  const rootId = touchesRoot ? values[rootField] : current?.root;

  if (id !== null && touchesRoot && !same(rootId, current?.root)) {
    const [child] = await tx
      .select({ id: columns.id })
      .from(table)
      .where(eq(parentColumn, id))
      .limit(1);
    if (child) {
      refuse(
        rootField,
        "This reply has answers. Move the whole conversation instead of one reply.",
      );
    }
  }

  if (parentId === null || parentId === undefined) return;

  let cursor: unknown = parentId;
  let depth = 1;
  const seen = new Set<string>();
  while (cursor !== null && cursor !== undefined) {
    const key = keyOf(cursor);
    if (key === null || seen.has(key)) {
      refuse(parentField, "The reply chain loops back on itself.");
    }
    seen.add(key ?? "");

    const [row] = await tx
      .select(select)
      .from(table)
      .where(eq(columns.id, cursor as ContentId))
      .limit(1);
    if (!row)
      refuse(parentField, "The reply you are answering does not exist.");
    if (depth === 1 && !same(row?.root, rootId)) {
      refuse(
        parentField,
        "The reply you are answering belongs to another conversation.",
      );
    }
    if (id !== null && same(row?.id, id)) {
      refuse(
        parentField,
        "A reply cannot answer itself or one of its answers.",
      );
    }

    depth += 1;
    if (depth > maxDepth) {
      refuse(
        parentField,
        `Replies nest at most ${maxDepth} levels deep. Answer a reply higher up.`,
      );
    }
    cursor = row?.parent;
  }
};

export interface ContentThreadNode<TRecord> {
  /** How deep the reply sits: 1 for a direct answer to the root. */
  depth: number;
  id: ContentId;
  parentId: ContentId | null;
  /** The public record, or `null` for a removed reply kept so its answers stay in place. */
  record: null | TRecord;
  removed: boolean;
}

export interface ContentThreadPage<TRecord> {
  items: ContentThreadNode<TRecord>[];
  pageInfo: {
    endCursor: null | string;
    hasNextPage: boolean;
    /** Public top-level replies in the whole thread. */
    totalCount: number;
  };
  /** Every public reply in the thread, at any depth. */
  replyCount: number;
  /** Set when a page held more nested replies than one response carries. */
  truncated: boolean;
}

export const CONTENT_THREAD_MAX_NODES = 500;

const encodeCursor = (createdAt: Date, id: ContentId): string =>
  Buffer.from(JSON.stringify([createdAt.toISOString(), id])).toString(
    "base64url",
  );

const decodeCursor = (
  cursor: string | undefined,
): null | { createdAt: Date; id: ContentId } => {
  if (!cursor) return null;
  try {
    const [createdAt, id] = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as [unknown, unknown];
    const date = typeof createdAt === "string" ? new Date(createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    if (typeof id !== "number" && typeof id !== "string") return null;

    return { createdAt: date, id };
  } catch {
    return null;
  }
};

interface NodeRow extends Record<string, unknown> {
  createdAt: Date;
  hiddenAt?: Date | null;
  id: ContentId;
  parent: ContentId | null;
  publishedAt: Date | null;
  status: string;
}

/**
 * Pages a thread oldest first: a page is a run of top-level replies plus every
 * answer below them, flattened depth first. A reply that is not public is left
 * out - unless a public answer sits below it, in which case it is returned as
 * `removed` with no values, so the tree keeps its shape.
 */
export const readContentThread = async <
  TDefinition extends AnyContentTypeDefinition,
  TRecord,
>(
  c: Context,
  model: ContentModel<TDefinition>,
  {
    first,
    after,
    project,
    root,
  }: {
    after?: string;
    first: number;
    /** Public rows for these ids, in any order. */
    project: (ids: ContentId[]) => Promise<Map<string, TRecord>>;
    root: ContentId;
  },
): Promise<ContentThreadPage<TRecord>> => {
  const { definition } = model;
  const { maxDepth, parentField, rootField } = definition.thread;
  const columns = model.columns as Record<string, PgColumn>;
  const table: PgTableWithColumns<TableConfig> = model.table;
  const parentColumn = columns[parentField];
  const rootColumn = columns[rootField];
  const db = c.get("db");
  const published = publicationColumns(definition, columns);
  const publicCondition = publishedCondition(published);

  const nodeSelection = {
    createdAt: columns.createdAt,
    id: columns.id,
    parent: parentColumn,
    publishedAt: columns.publishedAt,
    status: columns.status,
    ...(columns.hiddenAt ? { hiddenAt: columns.hiddenAt } : {}),
  };

  const topLevel = and(eq(rootColumn, root), isNull(parentColumn));
  const after_ = (position: null | { createdAt: Date; id: ContentId }) =>
    position
      ? or(
          gt(columns.createdAt, position.createdAt),
          and(
            eq(columns.createdAt, position.createdAt),
            gt(columns.id, position.id),
          ),
        )
      : undefined;

  /**
   * A top-level reply that is not public earns a place on the page only when
   * something answers it - otherwise it would be pruned and leave a page short,
   * or empty with `hasNextPage` still set. Skipped ones are read past in a few
   * bounded rounds.
   */
  const readTops = async (): Promise<NodeRow[]> => {
    const collected: NodeRow[] = [];
    let position = decodeCursor(after);

    for (let round = 0; round < 5 && collected.length <= first; round++) {
      const batch = (await db
        .select(nodeSelection)
        .from(table)
        .where(and(topLevel, after_(position)))
        .orderBy(asc(columns.createdAt), asc(columns.id))
        .limit(first + 1)) as NodeRow[];
      if (batch.length === 0) break;

      const hidden = batch
        .filter(row => !isContentBaseRowPublic(row))
        .map(row => row.id);
      const answered = new Set(
        hidden.length === 0
          ? []
          : (
              await db
                .select({ parent: parentColumn })
                .from(table)
                .where(inArray(parentColumn, hidden))
            ).map(row => String(row.parent)),
      );
      collected.push(
        ...batch.filter(
          row => isContentBaseRowPublic(row) || answered.has(String(row.id)),
        ),
      );

      const last = batch.at(-1);
      if (!last || batch.length <= first) break;
      position = { createdAt: last.createdAt, id: last.id };
    }

    return collected;
  };

  const [tops, [topTotal], [replyTotal]] = await Promise.all([
    readTops(),
    db
      .select({ value: count() })
      .from(table)
      .where(and(topLevel, publicCondition)),
    db
      .select({ value: count() })
      .from(table)
      .where(and(eq(rootColumn, root), publicCondition)),
  ]);

  const hasNextPage = tops.length > first;
  const page = tops.slice(0, first);

  const nodes = new Map<string, NodeRow>();
  const children = new Map<string, NodeRow[]>();
  for (const row of page) nodes.set(String(row.id), row);

  let frontier = page.map(row => row.id);
  let truncated = false;
  for (let level = 2; level <= maxDepth && frontier.length > 0; level++) {
    if (nodes.size >= CONTENT_THREAD_MAX_NODES) {
      truncated = true;
      break;
    }
    const rows = (await db
      .select(nodeSelection)
      .from(table)
      .where(and(eq(rootColumn, root), inArray(parentColumn, frontier)))
      .orderBy(asc(columns.createdAt), asc(columns.id))
      .limit(CONTENT_THREAD_MAX_NODES - nodes.size + 1)) as NodeRow[];
    if (rows.length > CONTENT_THREAD_MAX_NODES - nodes.size) {
      truncated = true;
      rows.length = CONTENT_THREAD_MAX_NODES - nodes.size;
    }

    for (const row of rows) {
      nodes.set(String(row.id), row);
      const key = String(row.parent);
      children.set(key, [...(children.get(key) ?? []), row]);
    }
    frontier = rows.map(row => row.id);
  }

  const kept = new Set<string>();
  const keep = (row: NodeRow): boolean => {
    let any = false;
    for (const child of children.get(String(row.id)) ?? []) {
      if (keep(child)) any = true;
    }
    if (any || isContentBaseRowPublic(row)) {
      kept.add(String(row.id));

      return true;
    }

    return false;
  };
  for (const row of page) keep(row);

  const records = await project(
    [...kept]
      .map(key => nodes.get(key))
      .filter((row): row is NodeRow => row !== undefined)
      .filter(row => isContentBaseRowPublic(row))
      .map(row => row.id),
  );

  const items: ContentThreadNode<TRecord>[] = [];
  const walk = (row: NodeRow, depth: number): void => {
    const key = String(row.id);
    if (!kept.has(key)) return;
    const record = records.get(key) ?? null;
    items.push({
      depth,
      id: row.id,
      parentId: row.parent,
      record,
      removed: record === null,
    });
    for (const child of children.get(key) ?? []) walk(child, depth + 1);
  };
  for (const row of page) walk(row, 1);

  const last = page.at(-1);

  return {
    items,
    pageInfo: {
      endCursor: last ? encodeCursor(last.createdAt, last.id) : null,
      hasNextPage,
      totalCount: topTotal?.value ?? 0,
    },
    replyCount: replyTotal?.value ?? 0,
    truncated,
  };
};
