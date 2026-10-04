import React from 'react'

import { useCssVariables } from '../use-css-variables'

const STEPS = [
  { className: 'w-1', step: '1' },
  { className: 'w-2', step: '2' },
  { className: 'w-3', step: '3' },
  { className: 'w-4', step: '4' },
  { className: 'w-6', step: '6' },
  { className: 'w-8', step: '8' },
  { className: 'w-12', step: '12' },
  { className: 'w-16', step: '16' },
  { className: 'w-24', step: '24' },
] as const

const SPACING_VARIABLE = ['spacing'] as const

const ScaleRow = ({ entry }: { entry: (typeof STEPS)[number] }) => {
  const [width, setWidth] = React.useState<number>()

  const barRef = React.useCallback((node: HTMLDivElement | null) => {
    if (node) setWidth(node.getBoundingClientRect().width)
  }, [])

  return (
    <li className="grid grid-cols-[3rem_1fr] items-center gap-3 sm:grid-cols-[3rem_7rem_1fr]">
      <span className="font-mono text-xs">{entry.step}</span>
      <span className="text-muted-foreground hidden font-mono text-xs tabular-nums sm:inline">
        {Number(entry.step) / 4}rem · {width ?? '…'}px
      </span>
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className={`bg-primary h-4 shrink-0 rounded-sm ${entry.className}`}
          ref={barRef}
        />
        <span className="text-muted-foreground font-mono text-xs tabular-nums sm:hidden">
          {width ?? '…'}px
        </span>
      </div>
    </li>
  )
}

export default function SpacingScale() {
  const { spacing } = useCssVariables(SPACING_VARIABLE)

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        1 unit = <code className="font-mono">--spacing</code> ={' '}
        <span className="text-foreground font-mono tabular-nums">
          {spacing || '…'}
        </span>
      </p>
      <ul aria-label="Spacing scale" className="flex flex-col gap-2">
        {STEPS.map((entry) => (
          <ScaleRow entry={entry} key={entry.step} />
        ))}
      </ul>
    </div>
  )
}
