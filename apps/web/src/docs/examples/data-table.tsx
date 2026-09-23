import { Button } from '@vitnode/core/components/ui/button'

import { type ColumnDef, DataTable } from '../preview-data-table'

interface DemoUser {
  email: string
  id: number
  name: string
  role: string
  status: string
}

const columns: ColumnDef<DemoUser>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'status', header: 'Status', align: 'center' },
  {
    id: 'actions',
    header: '',
    align: 'right',
    cell: () => (
      <Button size="sm" variant="outline">
        Edit
      </Button>
    ),
  },
]

export default function DataTableExample() {
  return (
    <DataTable
      columns={columns}
      edges={[
        {
          id: 1,
          name: 'John Doe',
          email: 'jon_doe@mail.com',
          role: 'Admin',
          status: 'Active',
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane_smith@mail.com',
          role: 'Editor',
          status: 'Inactive',
        },
        {
          id: 3,
          name: 'Alice Johnson',
          email: 'alice_johnson@mail.com',
          role: 'Viewer',
          status: 'Active',
        },
        {
          id: 4,
          name: 'Bob Brown',
          email: 'bob_brown@mail.com',
          role: 'Admin',
          status: 'Inactive',
        },
      ]}
      id="users-table"
      order={{
        defaultOrder: {
          column: 'name',
          order: 'asc',
        },
      }}
      pageInfo={{
        count: 1,
        currentPage: 1,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize: 10,
        startCursor: null,
        totalCount: 1,
        totalPages: 1,
      }}
    />
  )
}
