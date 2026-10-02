import { Badge } from '@vitnode/core/components/ui/badge'

import { type ColumnDef, DataTable } from '../preview-data-table'

interface LineItem {
  name: string
  price: number
  quantity: number
}

interface DemoOrder {
  customer: string
  id: number
  items: LineItem[]
  number: string
  shipping: number
  status: 'Delivered' | 'Draft' | 'Processing' | 'Refunded'
}

const money = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  style: 'currency',
})

const subtotalOf = (order: DemoOrder) =>
  order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

const statusVariant = {
  Delivered: 'success',
  Draft: 'outline',
  Processing: 'warning',
  Refunded: 'destructive',
} as const

const columns: ColumnDef<DemoOrder>[] = [
  {
    accessorKey: 'number',
    header: 'Order',
    cell: ({ row }) => <span className="font-medium">{row.number}</span>,
  },
  { accessorKey: 'customer', header: 'Customer' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant[row.status]}>{row.status}</Badge>
    ),
  },
  {
    id: 'total',
    header: 'Total',
    align: 'right',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {money.format(subtotalOf(row) + row.shipping)}
      </span>
    ),
  },
]

const edges: DemoOrder[] = [
  {
    id: 1,
    number: '#1042',
    customer: 'John Doe',
    status: 'Delivered',
    shipping: 4.99,
    items: [
      { name: 'Mechanical keyboard', price: 89, quantity: 1 },
      { name: 'Keycap set (Ocean)', price: 24.5, quantity: 2 },
    ],
  },
  {
    id: 2,
    number: '#1043',
    customer: 'Jane Smith',
    status: 'Processing',
    shipping: 0,
    items: [
      { name: 'Standing desk mat', price: 39, quantity: 1 },
      { name: 'Cable organizer', price: 12, quantity: 3 },
      { name: 'Monitor light bar', price: 59, quantity: 1 },
    ],
  },
  {
    id: 3,
    number: '#1044',
    customer: 'Alice Johnson',
    status: 'Draft',
    shipping: 0,
    items: [],
  },
  {
    id: 4,
    number: '#1045',
    customer: 'Bob Brown',
    status: 'Refunded',
    shipping: 7.5,
    items: [
      { name: 'Rubber duck (debugging edition)', price: 9.99, quantity: 4 },
    ],
  },
]

const OrderDetail = ({ order }: { order: DemoOrder }) => {
  const subtotal = subtotalOf(order)

  return (
    <div className="not-prose flex max-w-xl flex-col gap-3 text-sm leading-relaxed">
      <ul
        aria-label={`Line items for order ${order.number}`}
        className="flex flex-col gap-2"
      >
        {order.items.map((item) => (
          <li
            className="flex items-baseline justify-between gap-4"
            key={item.name}
          >
            <span className="text-foreground min-w-0 text-pretty">
              {item.name}
              <span className="text-muted-foreground"> × {item.quantity}</span>
            </span>
            <span className="tabular-nums">
              {money.format(item.price * item.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="border-foreground/10 flex flex-col gap-1 border-t pt-3">
        <div className="text-muted-foreground flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{money.format(subtotal)}</dd>
        </div>
        <div className="text-muted-foreground flex justify-between gap-4">
          <dt>Shipping</dt>
          <dd className="tabular-nums">
            {order.shipping ? money.format(order.shipping) : 'Free'}
          </dd>
        </div>
        <div className="flex justify-between gap-4 font-medium">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {money.format(subtotal + order.shipping)}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default function DataTableExpandableExample() {
  return (
    <DataTable
      columns={columns}
      edges={edges}
      expandable={{
        canExpand: (order) => order.items.length > 0,
        defaultExpanded: [1],
        render: (order) => <OrderDetail order={order} />,
      }}
      id="orders-expandable-table"
      order={{
        defaultOrder: {
          column: 'number',
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
    />
  )
}
