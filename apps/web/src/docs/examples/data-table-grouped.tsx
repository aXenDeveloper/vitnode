import { Badge } from '@vitnode/core/components/ui/badge'

import { type ColumnDef, DataTable } from '../preview-data-table'

interface DemoPlugin {
  category: 'Commerce' | 'Community' | 'Content'
  id: number
  name: string
  status: 'Disabled' | 'Enabled'
  version: string
}

const plugins: DemoPlugin[] = [
  {
    id: 1,
    name: 'Blog',
    category: 'Content',
    version: '2.4.0',
    status: 'Enabled',
  },
  {
    id: 2,
    name: 'Wiki',
    category: 'Content',
    version: '1.1.3',
    status: 'Disabled',
  },
  {
    id: 3,
    name: 'Docs',
    category: 'Content',
    version: '3.0.1',
    status: 'Enabled',
  },
  {
    id: 4,
    name: 'Forum',
    category: 'Community',
    version: '5.2.0',
    status: 'Enabled',
  },
  {
    id: 5,
    name: 'Chat',
    category: 'Community',
    version: '0.9.8',
    status: 'Disabled',
  },
  {
    id: 6,
    name: 'Shop',
    category: 'Commerce',
    version: '1.0.0',
    status: 'Enabled',
  },
]

const columns: ColumnDef<DemoPlugin>[] = [
  {
    accessorKey: 'name',
    header: 'Plugin',
    cell: ({ row }) => <span className="font-medium">{row.name}</span>,
  },
  {
    accessorKey: 'version',
    header: 'Version',
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums">{row.version}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    align: 'right',
    cell: ({ row }) => (
      <Badge variant={row.status === 'Enabled' ? 'success' : 'outline'}>
        {row.status}
      </Badge>
    ),
  },
]

export default function DataTableGroupedExample() {
  return (
    <DataTable
      columns={columns}
      edges={plugins}
      groupBy={{ key: (plugin) => plugin.category }}
      id="plugins-grouped-table"
      order={{ defaultOrder: { column: 'name', order: 'asc' } }}
      pageInfo={{
        count: plugins.length,
        currentPage: 1,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize: 10,
        startCursor: null,
        totalCount: plugins.length,
        totalPages: 1,
      }}
    />
  )
}
