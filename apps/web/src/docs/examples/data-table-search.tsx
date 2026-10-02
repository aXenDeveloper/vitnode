import { Badge } from '@vitnode/core/components/ui/badge'

import { resolveLocalTable } from '../local-table-data'
import { type ColumnDef, DataTable } from '../preview-data-table'
import { type DemoUser, demoUsers } from './data-table-demo-users'

const columns: ColumnDef<DemoUser>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ row }) => <Badge variant="outline">{row.role}</Badge>,
  },
]

const defaultOrder = { column: 'name', order: 'asc' } as const

export default function DataTableSearchExample() {
  return (
    <DataTable
      columns={columns}
      id="docs-search-table"
      order={{ columns: ['name'], defaultOrder }}
      resolve={(params) =>
        resolveLocalTable(demoUsers, params, {
          defaultOrder,
          searchIn: (row) => `${row.name} ${row.email}`,
        })
      }
      search
      searchPlaceholder="Search users... try 'hopper'"
    />
  )
}
