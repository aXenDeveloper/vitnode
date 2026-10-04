import { Slider } from '@vitnode/core/components/ui/slider'
import { CheckIcon, XIcon } from 'lucide-react'
import React from 'react'

const OUTER_RADIUS = 'calc(var(--radius) * 1.8)'

const Verdict = ({ good }: { good: boolean }) => (
  <span
    className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-success' : 'text-destructive'}`}
  >
    {good ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
    {good ? 'Do' : "Don't"}
  </span>
)

const Nested = ({
  caption,
  good,
  innerRadius,
  padding,
}: {
  caption: string
  good: boolean
  innerRadius: string
  padding: number
}) => (
  <figure className="bg-card m-0! flex flex-col gap-3 rounded-lg border p-3">
    <Verdict good={good} />
    <div
      aria-hidden
      className="bg-muted border"
      style={{ borderRadius: OUTER_RADIUS, padding: `${padding}px` }}
    >
      <div
        className="bg-primary/15 border-primary/40 flex h-24 items-end border p-3"
        style={{ borderRadius: innerRadius }}
      >
        <span className="bg-background h-2 w-16 rounded-full" />
      </div>
    </div>
    <figcaption className="m-0! text-muted-foreground font-mono text-xs leading-relaxed">
      {caption}
    </figcaption>
  </figure>
)

export default function ElevationConcentric() {
  const labelId = React.useId()
  const [padding, setPadding] = React.useState(12)
  const [outerPx, setOuterPx] = React.useState(0)

  const probeRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node)
      setOuterPx(Number.parseFloat(getComputedStyle(node).borderTopLeftRadius))
  }, [])

  const outer = Math.round(outerPx * 10) / 10
  const inner = Math.max(0, Math.round((outerPx - padding) * 10) / 10)

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        aria-hidden
        className="hidden"
        ref={probeRef}
        style={{ borderRadius: OUTER_RADIUS }}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="font-mono text-xs whitespace-nowrap" id={labelId}>
          padding: <span className="tabular-nums">{padding}px</span>
        </span>
        <Slider
          aria-labelledby={labelId}
          className="flex-1"
          max={24}
          min={0}
          onValueChange={(next) => {
            const picked = Array.isArray(next) ? next[0] : next
            if (typeof picked === 'number') setPadding(picked)
          }}
          step={2}
          value={[padding]}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Nested
          caption={`inner = ${outer} − ${padding} = ${inner}px`}
          good
          innerRadius={`max(0px, calc(${OUTER_RADIUS} - ${padding}px))`}
          padding={padding}
        />
        <Nested
          caption={`inner = outer = ${outer}px`}
          good={false}
          innerRadius={OUTER_RADIUS}
          padding={padding}
        />
      </div>
    </div>
  )
}
