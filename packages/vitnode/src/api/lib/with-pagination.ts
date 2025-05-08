import { dbClient } from '@/database/client';
import { z } from '@hono/zod-openapi';
import {
  and,
  asc,
  ColumnBaseConfig,
  count,
  desc,
  gt,
  lt,
  Placeholder,
  SQL,
} from 'drizzle-orm';
import {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from 'drizzle-orm/pg-core';

export async function withPagination<
  QueryMin extends Record<string, unknown>,
  T extends TableConfig,
  Primary extends ColumnBaseConfig<'number', string>,
>({
  query,
  table,
  params,
  where: whereFromParams,
  primaryCursor,
  orderBy: orderByFromParams,
}: {
  orderBy: {
    column: PgColumn;
    order: 'asc' | 'desc';
  };
  params: {
    query: {
      cursor?: string;
      first?: string;
      last?: string;
    };
  };
  primaryCursor: PgColumn<Primary>;
  query: (args: {
    limit: number | Placeholder<string, unknown>;
    orderBy: SQL;
    where: SQL | undefined;
  }) => Promise<QueryMin[]>;
  table: Omit<PgTableWithColumns<T>, 'enableRLS'>;
  where?: SQL;
}): Promise<{
  edges: QueryMin[];
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}> {
  // Parse and validate pagination parameters
  const cursor = params.query.cursor
    ? parseInt(params.query.cursor, 10)
    : undefined;
  const first = params.query.first
    ? Math.min(parseInt(params.query.first, 10), 100)
    : undefined;
  const last = params.query.last
    ? Math.min(parseInt(params.query.last, 10), 100)
    : undefined;

  if (first !== undefined && last !== undefined) {
    throw new Error('Cannot specify both first and last');
  }

  if (first !== undefined && first < 0) {
    throw new Error('first must be positive');
  }

  if (last !== undefined && last < 0) {
    throw new Error('last must be positive');
  }

  // Determine sort direction based on pagination parameters
  const isForward = last === undefined;
  const orderFn = isForward
    ? orderByFromParams.order === 'asc'
      ? asc
      : desc
    : orderByFromParams.order === 'asc'
      ? desc
      : asc;

  const orderBy: SQL = orderFn(table[orderByFromParams.column.name]);

  // Build where clause with cursor
  let where: SQL | undefined = whereFromParams;
  if (cursor) {
    const cursorFilter = isForward
      ? orderByFromParams.order === 'asc'
        ? gt
        : lt
      : orderByFromParams.order === 'asc'
        ? lt
        : gt;

    const cursorWhere = cursorFilter(table[primaryCursor.name], cursor);
    where = where ? and(where, cursorWhere) : cursorWhere;
  }

  // Get total count
  const [{ count: totalCount }] = await dbClient
    .select({ count: count() })
    .from(table as PgTable)
    .where(whereFromParams);

  // Fetch one extra item to determine if there are more pages
  const limit = (first ?? last ?? 50) + 1;
  const edges = await query({ limit, where, orderBy });

  // Process results
  const hasMore = edges.length > (first ?? last ?? edges.length);
  const slicedEdges = edges.slice(0, first ?? last ?? edges.length);
  const finalEdges = isForward ? slicedEdges : slicedEdges.reverse();

  // Prepare cursors
  const startCursor: null | number =
    (finalEdges[0]?.[primaryCursor.name] as number) ?? null;

  const endCursor: null | number =
    (finalEdges[finalEdges.length - 1]?.[primaryCursor.name] as number) ?? null;

  return {
    pageInfo: {
      totalCount,
      count: finalEdges.length,
      hasNextPage: isForward ? hasMore : !!cursor,
      hasPreviousPage: isForward ? !!cursor : hasMore,
      startCursor,
      endCursor,
    },
    edges: finalEdges,
  };
}

export const zodPaginationPageInfo = z.object({
  totalCount: z.number(),
  count: z.number(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  startCursor: z.number().nullable(),
  endCursor: z.number().nullable(),
});

export const zodPaginationQuery = z.object({
  cursor: z.string().optional(),
  first: z.string().optional(),
  last: z.string().optional(),
});
