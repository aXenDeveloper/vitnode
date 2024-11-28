import { SortDirectionEnum } from 'vitnode-shared/utils/pagination.enum';

export interface SearchParamsPagination {
  cursor?: string;
  first?: string;
  last?: string;
  search?: string;
  sortBy?: string;
  sortDirection?: string;
}

export async function getPaginationTool({
  defaultPageSize = 10,
  searchParams: searchParamsPromise,
  sortEnum,
}: {
  defaultPageSize?: 10 | 20 | 30 | 40 | 50;
  search?: boolean;
  searchParams: Promise<SearchParamsPagination>;
  sortEnum?: Record<string, unknown>;
}): Promise<{
  cursor?: number;
  first: number;
  last: number;
  sortBy?: never;
  sortDirection?: SortDirectionEnum;
}> {
  const searchParams = await searchParamsPromise;

  const sortBy = getGetSortByParamsAPI({
    constEnum: sortEnum,
    searchParams,
  });
  const pagination = {
    first: Number(searchParams?.last ?? 0)
      ? null
      : Number(searchParams?.first ?? 0),
    last: Number(searchParams?.last ?? 0),
    cursor: Number(searchParams?.cursor) || undefined,
    search: searchParams?.search ?? '',
    sortBy: sortBy?.column,
    sortDirection: sortBy?.direction,
  };

  return {
    ...pagination,
    first: pagination.first ? pagination.first : defaultPageSize,
  };
}

function getGetSortByParamsAPI({
  constEnum,
  searchParams,
}: {
  constEnum?: Record<string, unknown>;
  searchParams: Pick<SearchParamsPagination, 'sortBy' | 'sortDirection'>;
}):
  | undefined
  | {
      column?: never;
      direction?: SortDirectionEnum;
    } {
  const sort = {
    by: searchParams?.sortBy?.toLowerCase(),
    direction: searchParams?.sortDirection?.toLowerCase(),
  };

  if (
    !constEnum ||
    !sort.by ||
    !sort.direction ||
    !(sort.by in constEnum) ||
    !(sort.direction in SortDirectionEnum)
  ) {
    return;
  }

  return {
    column: sort.by as never,
    direction:
      sort.direction === 'asc' ? SortDirectionEnum.asc : SortDirectionEnum.desc,
  };
}

export const emptyPagination = ({
  first,
}: {
  first: 10 | 20 | 30 | 40 | 50;
}) => {
  return {
    first,
    last: 0,
    cursor: null,
    search: '',
    sortBy: null,
  };
};
