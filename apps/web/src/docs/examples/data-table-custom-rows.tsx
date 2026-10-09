import { Switch } from '@vitnode/core/components/ui/switch'
import { cn } from 'cn'
import {
  BookOpenIcon,
  type LucideIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  ShoppingBagIcon,
} from 'lucide-react'
import React from 'react'

import { DataTable } from '../preview-data-table'

interface DemoPlugin {
  description: string
  enabled: boolean
  Icon: LucideIcon
  id: number
  name: string
}

const plugins: DemoPlugin[] = [
  {
    id: 1,
    name: 'Blog',
    description: 'Articles, categories and an RSS feed for your news.',
    enabled: true,
    Icon: NewspaperIcon,
  },
  {
    id: 2,
    name: 'Forum',
    description: 'Threads and replies where members help each other out.',
    enabled: true,
    Icon: MessagesSquareIcon,
  },
  {
    id: 3,
    name: 'Wiki',
    description: 'Pages anyone on the team can edit and link together.',
    enabled: false,
    Icon: BookOpenIcon,
  },
  {
    id: 4,
    name: 'Shop',
    description: 'Sell merch. The rubber ducks will not sell themselves.',
    enabled: true,
    Icon: ShoppingBagIcon,
  },
]

const PluginRow = ({
  defaultEnabled,
  plugin,
}: {
  defaultEnabled: boolean
  plugin: DemoPlugin
}) => {
  const [enabled, setEnabled] = React.useState(defaultEnabled)

  return (
    <div className="not-prose flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          enabled
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <plugin.Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            'font-medium',
            enabled ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {plugin.name}
        </span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {plugin.description}
        </span>
      </div>
      <Switch
        aria-label={`Enable ${plugin.name}`}
        checked={enabled}
        onCheckedChange={setEnabled}
      />
    </div>
  )
}

export default function DataTableCustomRowsExample() {
  return (
    <DataTable
      edges={plugins}
      id="plugins-custom-rows-table"
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
      renderRow={({ row }) => (
        <PluginRow defaultEnabled={row.enabled} plugin={row} />
      )}
    />
  )
}
