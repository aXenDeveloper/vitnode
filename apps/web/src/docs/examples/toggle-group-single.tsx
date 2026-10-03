import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import React from 'react'

const RANGES = [
  { label: 'Day', value: 'day', visits: '1,284' },
  { label: 'Week', value: 'week', visits: '8,930' },
  { label: 'Month', value: 'month', visits: '36,512' },
] as const

export default function ToggleGroupSingle() {
  const [value, setValue] = React.useState<string[]>(['week'])
  const range = RANGES.find((item) => item.value === value[0]) ?? RANGES[1]

  return (
    <div className="not-prose flex flex-col items-center gap-4">
      <ToggleGroup
        aria-label="Date range"
        onValueChange={(next) => {
          if (next.length > 0) setValue(next)
        }}
        value={value}
        variant="outline"
      >
        {RANGES.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-muted-foreground text-sm leading-relaxed">
        <span className="text-foreground font-medium tabular-nums">
          {range.visits}
        </span>{' '}
        visits this {range.label.toLowerCase()}
      </p>
    </div>
  )
}
