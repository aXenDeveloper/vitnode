import type {
  DataTableProps,
  DataTableTMin,
} from '@vitnode/core/components/table/data-table-content'
import type { DataTableNavigation } from '@vitnode/core/components/table/navigation'

import { ContentDataTable } from '@vitnode/core/components/table/content'
import { DataTableNavigationProvider } from '@vitnode/core/components/table/navigation'
import React from 'react'

export type { ColumnDef } from '@vitnode/core/components/table/data-table-content'

export function DataTable<T extends DataTableTMin>(props: DataTableProps<T>) {
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
      <ContentDataTable<T> {...props} />
    </DataTableNavigationProvider>
  )
}
