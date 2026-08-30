import type {
  DataTableProps,
  DataTableTMin,
} from '@vitnode/core/components/table/data-table-content'
import type { DataTableNavigation } from '@vitnode/core/components/table/navigation'

import { ContentDataTable } from '@vitnode/core/components/table/content'
import { DataTableNavigationProvider } from '@vitnode/core/components/table/navigation'
import React from 'react'

export type { ColumnDef } from '@vitnode/core/components/table/data-table-content'

/**
 * The data table, wired for a documentation preview.
 *
 * The two table examples used `@vitnode/core/components/table/data-table`, which
 * is the table wired to **Next.js**: it mounts `NextDataTableNavigation`, which
 * reads `next/navigation` and `next-intl`'s locale-aware router. That module
 * cannot exist in this application, and importing it would have been the one
 * thing that made a documentation page drag Next.js into a Next-free build.
 *
 * So the preview supplies the same seam the AdminCP screens supply: a
 * `DataTableNavigation` - "here is the query string, and here is how to change
 * it" - around the shared `ContentDataTable`. The table itself is identical;
 * only the two lines that decide what "sort by this column" means are different,
 * which is exactly the split `components/table/navigation.tsx` exists for.
 *
 * The state is local rather than the URL, and for a demo that is a feature: a
 * reader sorting a table of four fictional users should not have the page they
 * are reading navigate underneath them, and four readers sorting four previews
 * on one page would otherwise fight over one query string.
 */
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
