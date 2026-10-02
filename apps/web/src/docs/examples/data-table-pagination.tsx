import { resolveLocalTable } from '../local-table-data'
import { type ColumnDef, DataTable } from '../preview-data-table'
import { type DemoUser, demoUsers } from './data-table-demo-users'

const columns: ColumnDef<DemoUser>[] = [
  { accessorKey: 'id', header: '#' },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
]

const defaultOrder = { column: 'id', order: 'asc' } as const

export default function DataTablePaginationExample() {
  return (
    <DataTable
      columns={columns}
      id="docs-pagination-table"
      order={{ columns: ['id', 'name'], defaultOrder }}
      resolve={(params) =>
        resolveLocalTable(demoUsers, params, {
          defaultOrder,
          sortBy: { id: (row) => row.id, name: (row) => row.name },
        })
      }
    />
  )
}
