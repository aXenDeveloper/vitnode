import {
  slidingIndicatorTransitionClassName,
  useSlidingIndicator,
} from '@vitnode/core/hooks/use-sliding-indicator'
import { cn } from 'cn'
import React from 'react'

const FILTERS = [
  { label: 'All', count: 128 },
  { label: 'Published', count: 112 },
  { label: 'Drafts', count: 9 },
]

export default function HookUseSlidingIndicatorDemo() {
  const [active, setActive] = React.useState(0)
  const { containerRef, indicatorRef, isReady } =
    useSlidingIndicator<HTMLDivElement>(active)

  return (
    <div className="not-prose flex w-full flex-col items-center gap-4">
      <div
        aria-label="Filter posts"
        className="bg-muted relative flex max-w-full flex-wrap justify-center gap-1 rounded-lg p-1"
        ref={containerRef}
        role="group"
      >
        <span
          aria-hidden
          className={cn(
            'bg-background pointer-events-none absolute top-0 left-0 rounded-md opacity-0 shadow-sm',
            isReady && slidingIndicatorTransitionClassName,
          )}
          ref={indicatorRef}
        />
        {FILTERS.map((filter, index) => (
          <button
            aria-pressed={active === index}
            className={cn(
              'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active === index
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-sliding-indicator-item
            key={filter.label}
            onClick={() => setActive(index)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {FILTERS[active].count} posts
      </p>
    </div>
  )
}
