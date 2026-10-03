import { Button } from '@vitnode/core/components/ui/button'
import { Slider } from '@vitnode/core/components/ui/slider'
import React from 'react'

import { useCssVariables } from '../use-css-variables'

const SCALE = [
  { className: 'rounded-sm', factor: '0.6', usage: 'Menu items, tags' },
  { className: 'rounded-md', factor: '0.8', usage: 'Buttons, inputs' },
  { className: 'rounded-lg', factor: '1', usage: 'Menus, selects' },
  { className: 'rounded-xl', factor: '1.4', usage: 'Cards, dialogs' },
  { className: 'rounded-2xl', factor: '1.8', usage: 'Big panels' },
  { className: 'rounded-3xl', factor: '2.2', usage: 'Hero media' },
  { className: 'rounded-4xl', factor: '2.6', usage: 'Showcase blocks' },
] as const

const RADIUS_NAMES = ['radius'] as const

const formatPx = (value: string) => {
  const px = Number.parseFloat(value)
  if (!Number.isFinite(px)) return '…'

  return `${Math.round(px * 10) / 10}px`
}

const ScaleRow = ({ entry }: { entry: (typeof SCALE)[number] }) => {
  const [radius, setRadius] = React.useState('')

  const tileRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) setRadius(formatPx(getComputedStyle(node).borderTopLeftRadius))
  }, [])

  return (
    <li className="bg-card m-0 flex items-center gap-3 rounded-lg border p-2">
      <div
        aria-hidden
        className={`bg-primary/10 border-primary/40 size-12 shrink-0 border-t-2 border-l-2 ${entry.className}`}
        ref={tileRef}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-xs">{entry.className}</span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          ×{entry.factor} · {radius}
        </span>
      </div>
      <span className="text-muted-foreground hidden text-xs sm:inline">
        {entry.usage}
      </span>
    </li>
  )
}

export default function ElevationRadiusScale() {
  const labelId = React.useId()
  const themeValues = useCssVariables(RADIUS_NAMES)
  const themeRem = Number.parseFloat(themeValues.radius ?? '') || 0.75
  const [base, setBase] = React.useState<null | number>(null)
  const current = base ?? themeRem

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs whitespace-nowrap" id={labelId}>
            --radius: <span className="tabular-nums">{current}rem</span>
          </span>
          <Button
            disabled={base === null}
            onClick={() => setBase(null)}
            size="sm"
            variant="outline"
          >
            Reset
          </Button>
        </div>
        <Slider
          aria-labelledby={labelId}
          max={1.5}
          min={0}
          onValueChange={(next) => {
            const picked = Array.isArray(next) ? next[0] : next
            if (typeof picked === 'number') setBase(picked)
          }}
          step={0.125}
          value={[current]}
        />
      </div>
      <ul
        className="m-0 grid list-none grid-cols-1 gap-2 ps-0 sm:grid-cols-2"
        style={{ '--radius': `${current}rem` } as React.CSSProperties}
      >
        {SCALE.map((entry) => (
          <ScaleRow entry={entry} key={`${entry.className}-${current}`} />
        ))}
      </ul>
    </div>
  )
}
