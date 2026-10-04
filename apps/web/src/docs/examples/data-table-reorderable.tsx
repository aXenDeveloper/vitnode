import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import { toast } from 'sonner'

import { type ColumnDef, DataTable } from '../preview-data-table'

interface BacklogItem {
  estimate: number
  id: number
  notes: string
  priority: 'High' | 'Low' | 'Medium'
  title: string
}

const priorityVariant = {
  High: 'destructive',
  Medium: 'warning',
  Low: 'outline',
} as const

const columns: ColumnDef<BacklogItem>[] = [
  {
    accessorKey: 'title',
    header: 'Task',
    cell: ({ row }) => <span className="font-medium">{row.title}</span>,
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    cell: ({ row }) => (
      <Badge variant={priorityVariant[row.priority]}>{row.priority}</Badge>
    ),
  },
  {
    accessorKey: 'estimate',
    header: 'Estimate',
    align: 'right',
    cell: ({ row }) => <span className="tabular-nums">{row.estimate} pt</span>,
  },
  {
    id: 'actions',
    header: '',
    align: 'right',
    cell: ({ row }) => (
      <Button
        onClick={() => toast.info(`Editing "${row.title}"`)}
        size="sm"
        variant="outline"
      >
        Edit
      </Button>
    ),
  },
]

const edges: BacklogItem[] = [
  {
    id: 1,
    title: 'Fix the login redirect loop',
    priority: 'High',
    estimate: 3,
    notes: 'Happens only after a password reset. Reproduced on Safari 18.',
  },
  {
    id: 2,
    title: 'Dark mode for the invoice PDF',
    priority: 'Medium',
    estimate: 5,
    notes: 'Accountants asked nicely. Twice.',
  },
  {
    id: 3,
    title: 'Rename "Misc" to something useful',
    priority: 'Low',
    estimate: 1,
    notes: 'Ideas so far: "Other", "Everything else", "The drawer".',
  },
  {
    id: 4,
    title: 'Add CSV export to reports',
    priority: 'Medium',
    estimate: 8,
    notes: 'Respect the active filters, and keep the column order.',
  },
]

const saveOrder = async (ids: number[]) => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  toast.success('Order saved', {
    description: `New order: ${ids.join(', ')}`,
  })
}

export default function DataTableReorderableExample() {
  return (
    <DataTable
      columns={columns}
      edges={edges}
      expandable={{
        render: (item) => (
          <p className="text-muted-foreground m-0 text-sm leading-relaxed text-pretty">
            {item.notes}
          </p>
        ),
      }}
      id="backlog-reorderable-table"
      order={{
        defaultOrder: {
          column: 'id',
          order: 'asc',
        },
      }}
      pageInfo={{
        count: edges.length,
        currentPage: 1,
        endCursor: null,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize: 10,
        startCursor: null,
        totalCount: edges.length,
        totalPages: 1,
      }}
      reorderable={{
        getRowLabel: (item) => item.title,
        onReorder: saveOrder,
      }}
    />
  )
}
