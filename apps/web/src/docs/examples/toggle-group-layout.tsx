import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import { LayoutGridIcon, ListIcon, RowsIcon } from 'lucide-react'

const VIEWS = [
  { Icon: ListIcon, label: 'List', value: 'list' },
  { Icon: RowsIcon, label: 'Compact', value: 'compact' },
  { Icon: LayoutGridIcon, label: 'Grid', value: 'grid' },
] as const

const ViewItems = () =>
  VIEWS.map(({ Icon, label, value }) => (
    <ToggleGroupItem key={value} value={value}>
      <Icon data-icon="inline-start" />
      {label}
    </ToggleGroupItem>
  ))

export default function ToggleGroupLayout() {
  return (
    <div className="not-prose flex flex-col items-center gap-6 sm:flex-row sm:items-start">
      <div className="flex flex-col items-center gap-2">
        <ToggleGroup
          aria-label="Topic view"
          defaultValue={['list']}
          size="sm"
          spacing={2}
          variant="outline"
        >
          <ViewItems />
        </ToggleGroup>
        <code className="text-muted-foreground font-mono text-xs">
          spacing={'{2}'}
        </code>
      </div>
      <div className="flex flex-col items-center gap-2">
        <ToggleGroup
          aria-label="Topic view"
          defaultValue={['grid']}
          orientation="vertical"
          size="sm"
          variant="outline"
        >
          <ViewItems />
        </ToggleGroup>
        <code className="text-muted-foreground font-mono text-xs">
          orientation=&quot;vertical&quot;
        </code>
      </div>
    </div>
  )
}
