import type {
  DataTableProps,
  DataTableTMin,
} from '@vitnode/core/components/table/data-table-content'
import type { DataTableNavigation } from '@vitnode/core/components/table/navigation'

import { ContentDataTable } from '@vitnode/core/components/table/content'
import { DataTableNavigationProvider } from '@vitnode/core/components/table/navigation'
import React from 'react'

export type { ColumnDef } from '@vitnode/core/components/table/data-table-content'

type LocalData<T extends DataTableTMin> = Pick<
  DataTableProps<T>,
  'edges' | 'pageInfo'
>

export function DataTable<T extends DataTableTMin>({
  resolve,
  ...props
}:
  | (DataTableProps<T> & { resolve?: undefined })
  | (Omit<DataTableProps<T>, 'edges' | 'pageInfo'> & {
      resolve: (params: URLSearchParams) => LocalData<T>
    })) {
  const [search, setSearch] = React.useState('')

  const navigation = React.useMemo<DataTableNavigation>(
    () => ({
      navigate: (nextSearch) => {
        setSearch(nextSearch)
      },
      searchParams: new URLSearchParams(search),
    }),
    [search],
  )

  return (
    <DataTableNavigationProvider value={navigation}>
      {resolve ? (
        <ContentDataTable<T> {...props} {...resolve(navigation.searchParams)} />
      ) : (
        <ContentDataTable<T> {...(props as DataTableProps<T>)} />
      )}
    </DataTableNavigationProvider>
  )
}
