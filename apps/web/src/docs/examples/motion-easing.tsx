import { Button } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { PlayIcon, RotateCcwIcon } from 'lucide-react'
import React from 'react'

const CURVES = [
  { className: 'ease-linear', label: 'linear', verdict: 'Robotic' },
  { className: 'ease-in', label: 'ease-in', verdict: 'Slow to react' },
  {
    className: 'ease-fluid',
    label: 'ease-fluid',
    verdict: 'Instant, then settles',
  },
] as const

export default function MotionEasing() {
  const [isAtEnd, setIsAtEnd] = React.useState(false)

  return (
    <div className="not-prose flex w-full flex-col gap-5">
      <ul className="flex list-none flex-col gap-4 p-0">
        {CURVES.map((curve) => (
          <li className="flex flex-col gap-2 p-0" key={curve.label}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <code className="font-mono font-medium">{curve.label}</code>
              <span className="text-muted-foreground">{curve.verdict}</span>
            </div>
            <div aria-hidden className="bg-muted rounded-full p-1">
              <div
                className={cn(
                  'me-6 transition-[translate] duration-1000 motion-reduce:transition-none',
                  curve.className,
                  isAtEnd && 'translate-x-full rtl:-translate-x-full',
                )}
              >
                <span className="bg-primary block size-6 rounded-full shadow-sm" />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={() => setIsAtEnd((value) => !value)}
          size="sm"
          variant="outline"
        >
          {isAtEnd ? <RotateCcwIcon /> : <PlayIcon />}
          {isAtEnd ? 'Back' : 'Race'}
        </Button>
        <span className="text-muted-foreground text-xs">
          Same 1s duration, slowed down so you can see it
        </span>
      </div>
    </div>
  )
}
