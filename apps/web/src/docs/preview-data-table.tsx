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

function ResolvedDataTable<T extends DataTableTMin>({
  resolve,
  searchParams,
  ...props
}: Omit<DataTableProps<T>, 'edges' | 'pageInfo'> & {
  resolve: (params: URLSearchParams) => LocalData<T>
  searchParams: URLSearchParams
}) {
  return <ContentDataTable<T> {...props} {...resolve(searchParams)} />
}

export function DataTable<T extends DataTableTMin>(
  props:
    | (DataTableProps<T> & { resolve?: undefined })
    | (Omit<DataTableProps<T>, 'edges' | 'pageInfo'> & {
        resolve: (params: URLSearchParams) => LocalData<T>
      }),
) {
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
      {props.resolve ? (
        <ResolvedDataTable<T>
          {...props}
          searchParams={navigation.searchParams}
        />
      ) : (
        <ContentDataTable<T> {...props} />
      )}
    </DataTableNavigationProvider>
  )
}
