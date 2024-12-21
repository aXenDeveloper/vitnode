import type { DatabaseModuleArgs } from '@/utils/database/database.module';

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, gt, gte, lt, lte, SQL } from 'drizzle-orm';
import { PgTableWithColumns, TableConfig } from 'drizzle-orm/pg-core';
import { PaginationObj } from 'vitnode-shared/utils/pagination.dto';
import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

import coreSchemaDatabase from '../../database';
import { createClientDatabase, DetermineClient } from './client';

@Injectable()
export class InternalDatabaseService<
  T extends Record<string, unknown> = typeof coreSchemaDatabase,
> {
  constructor(
    @Inject('DATABASE_MODULE_OPTIONS')
    private readonly options: DatabaseModuleArgs,
  ) {
    const client = createClientDatabase({
      schemaDatabase: this.options.schemaDatabase,
      config: this.options.config,
    });

    this.db = client.db as DetermineClient<T>;
  }

  public db: DetermineClient<T>;

  protected outputPagination<T>({
    edges,
    total_count,
    cursor,
    last,
    first,
    primaryCursor,
  }: {
    cursor: number | undefined;
    edges: T[];
    first: number | undefined;
    last: number | undefined;
    primaryCursor: string;
    total_count: number;
  }): PaginationObj & {
    edges: T[];
  } {
    let currentEdges: T[] = edges;

    if (last) {
      currentEdges = currentEdges.reverse();
    }

    currentEdges = last
      ? edges.slice(-last - 1).slice(0, last)
      : edges.slice(0, first);

    const edgesCursor: {
      end: number | undefined;
      start: number | undefined;
    } = {
      start: currentEdges.at(0)?.[primaryCursor],
      end: currentEdges.at(-1)?.[primaryCursor],
    };

    if (!first && !last) {
      return {
        edges,
        page_info: {
          total_count,
          count: edges.length,
          has_next_page: false,
          has_previous_page: false,
          start_cursor: edgesCursor.start,
          end_cursor: edgesCursor.end,
        },
      };
    }

    return {
      edges: currentEdges,
      page_info: {
        has_next_page:
          cursor && first
            ? !!edges.at(first)
            : edges.length > currentEdges.length,
        start_cursor: edgesCursor.start,
        end_cursor: edgesCursor.end,
        total_count,
        count: currentEdges.length,
        has_previous_page:
          last && cursor
            ? edges.length > currentEdges.length + 1
            : edgesCursor.start !== undefined && !!cursor,
      },
    };
  }

  async paginationCursor<T extends TableConfig, Y>({
    cursor: cursorId,
    database,
    defaultSortBy,
    first,
    last,
    primaryCursor = 'id',
    sortBy,
    sortDirection,
    where: whereInput,
    query,
  }: {
    cursor: number | undefined;
    database: PgTableWithColumns<T>;
    defaultSortBy: {
      column: keyof T['columns'];
      direction: SortDirectionEnum;
    };
    first: number | undefined;
    last: number | undefined;
    primaryCursor?: keyof T['columns'];
    query: (args: {
      limit?: number;
      orderBy: SQL;
      where?: SQL;
    }) => Promise<Y[]>;
    sortBy?: string;
    sortDirection?: SortDirectionEnum;
    where?: SQL;
  }) {
    const currentSortBy: {
      column: keyof T['columns'];
      direction: SortDirectionEnum;
    } = {
      column: sortBy ?? defaultSortBy.column,
      direction: sortDirection ?? defaultSortBy.direction,
    };

    const fn = last
      ? currentSortBy.direction === SortDirectionEnum.asc
        ? desc
        : asc
      : currentSortBy.direction === SortDirectionEnum.asc
        ? asc
        : desc;
    const orderBy: SQL = fn(database[currentSortBy.column]);

    let where: SQL | undefined;
    if (cursorId) {
      const comparisonFn = last
        ? currentSortBy.direction === SortDirectionEnum.asc
          ? lte
          : gte
        : currentSortBy.direction === SortDirectionEnum.asc
          ? gt
          : lt;
      where = comparisonFn(database[primaryCursor], cursorId);
    }

    const [edges, [total_count]] = await Promise.all([
      query({
        where: whereInput ? and(whereInput, where) : where,
        orderBy,
        limit: first || last ? ((last ? last + 1 : first) ?? 0) + 1 : undefined,
      }),
      this.db.select({ count: count() }).from(database),
    ]);

    return this.outputPagination({
      edges,
      cursor: cursorId,
      last,
      first,
      primaryCursor: primaryCursor.toString(),
      total_count: total_count.count,
    });
  }
}
