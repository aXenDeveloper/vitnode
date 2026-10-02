import { Button } from '@vitnode/core/components/ui/button'
import { RotateCcw } from 'lucide-react'
import React from 'react'

const variants = [
  { className: 'shimmer', label: 'shimmer' },
  {
    className: 'shimmer shimmer-color-success',
    label: 'shimmer-color-success',
  },
  {
    className: 'shimmer shimmer-duration-1000',
    label: 'shimmer-duration-1000',
  },
  { className: 'shimmer shimmer-spread-24', label: 'shimmer-spread-24' },
  { className: 'shimmer shimmer-angle-45', label: 'shimmer-angle-45' },
  { className: 'shimmer shimmer-reverse', label: 'shimmer-reverse' },
]

export default function ShimmerVariantsExample() {
  const [replays, setReplays] = React.useState(0)

  return (
    <div className="not-prose bg-card text-card-foreground flex w-full flex-col gap-6 rounded-xl border p-4 sm:p-6">
      <ul className="grid gap-4 sm:grid-cols-2">
        {variants.map((variant) => (
          <li className="flex flex-col gap-1" key={variant.label}>
            <span
              className={`${variant.className} text-muted-foreground text-sm`}
            >
              Generating response...
            </span>
            <code className="text-foreground font-mono text-xs">
              {variant.label}
            </code>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
        <div className="flex flex-col gap-1">
          <span
            className="shimmer shimmer-once shimmer-duration-1100 text-muted-foreground text-sm"
            key={replays}
          >
            Response generated.
          </span>
          <code className="text-foreground font-mono text-xs">
            shimmer-once
          </code>
        </div>
        <Button
          onClick={() => {
            setReplays((count) => count + 1)
          }}
          size="sm"
          variant="outline"
        >
          <RotateCcw />
          Replay
        </Button>
      </div>
    </div>
  )
}
