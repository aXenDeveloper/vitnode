import type { TableOrder } from '@vitnode/core/components/table/url-state'

import {
  MIN_TABLE_SEARCH_LENGTH,
  readTableFilter,
  readTableOrder,
  readTablePage,
  readTablePageSize,
  readTableSearch,
} from '@vitnode/core/components/table/url-state'

interface LocalTableOptions<T> {
  defaultOrder?: TableOrder
  filters?: Record<string, (row: T) => string>
  searchIn?: (row: T) => string
  sortBy?: Record<string, (row: T) => number | string>
}

const compare = (a: number | string, b: number | string) =>
  typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b))

export const resolveLocalTable = <T extends { id: number }>(
  rows: readonly T[],
  params: URLSearchParams,
  {
    defaultOrder,
    filters = {},
    searchIn,
    sortBy = {},
  }: LocalTableOptions<T> = {},
) => {
  const term = readTableSearch(params).trim().toLowerCase()
  let result = [...rows]

  if (searchIn && term.length >= MIN_TABLE_SEARCH_LENGTH) {
    result = result.filter((row) => searchIn(row).toLowerCase().includes(term))
  }

  for (const [id, read] of Object.entries(filters)) {
    const values = readTableFilter(params, id)
    if (values.length) {
      result = result.filter((row) => values.includes(read(row)))
    }
  }

  if (defaultOrder) {
    const { column, order } = readTableOrder(params, defaultOrder)
    const read = sortBy[column]
    const direction = order === 'asc' ? 1 : -1

    if (read) {
      result.sort((a, b) => compare(read(a), read(b)) * direction)
    }
  }

  const pageSize = readTablePageSize(params)
  const totalCount = result.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(readTablePage(params), totalPages)
  const edges = result.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  return {
    edges,
    pageInfo: {
      count: edges.length,
      currentPage,
      endCursor: null,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      pageSize,
      startCursor: null,
      totalCount,
      totalPages,
    },
  }
}
