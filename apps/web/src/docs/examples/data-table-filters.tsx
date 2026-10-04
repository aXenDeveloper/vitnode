import { Badge } from '@vitnode/core/components/ui/badge'

import { resolveLocalTable } from '../local-table-data'
import { type ColumnDef, DataTable } from '../preview-data-table'
import { type DemoUser, demoUsers } from './data-table-demo-users'

const statusVariant = {
  Active: 'success',
  Banned: 'destructive',
  Invited: 'secondary',
} as const

const columns: ColumnDef<DemoUser>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'role', header: 'Role' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
    ),
  },
]

const defaultOrder = { column: 'name', order: 'asc' } as const

export default function DataTableFiltersExample() {
  return (
    <DataTable
      columns={columns}
      filters={[
        {
          id: 'status',
          label: 'Status',
          options: [
            { value: 'Active', label: 'Active' },
            { value: 'Invited', label: 'Invited' },
            { value: 'Banned', label: 'Banned' },
          ],
        },
        {
          id: 'role',
          label: 'Role',
          options: [
            { value: 'Admin', label: 'Admin' },
            { value: 'Editor', label: 'Editor' },
            { value: 'Viewer', label: 'Viewer' },
          ],
        },
      ]}
      id="docs-filters-table"
      order={{ defaultOrder }}
      resolve={(params) =>
        resolveLocalTable(demoUsers, params, {
          defaultOrder,
          sortBy: { name: (row) => row.name },
          filters: { role: (row) => row.role, status: (row) => row.status },
        })
      }
    />
  )
}
