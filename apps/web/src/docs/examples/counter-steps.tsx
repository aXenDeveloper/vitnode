import { Counter } from '@vitnode/core/components/ui/counter'
import React from 'react'

const rows = [
  {
    hint: 'step 5, max 12',
    label: 'Seats',
    props: { defaultValue: 5, max: 12, min: 0, step: 5 },
  },
  {
    hint: 'step 0.5',
    label: 'Hours',
    props: { defaultValue: 1.5, min: 0, step: 0.5 },
  },
  {
    hint: 'disabled',
    label: 'Admins',
    props: { defaultValue: 2, disabled: true },
  },
]

export default function CounterStepsExample() {
  const id = React.useId()

  return (
    <ul className="not-prose flex w-full flex-col divide-y rounded-lg border">
      {rows.map((row) => (
        <li
          className="flex items-center justify-between gap-4 p-3"
          key={row.label}
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium" id={`${id}-${row.label}`}>
              {row.label}
            </span>
            <span className="text-muted-foreground font-mono text-xs">
              {row.hint}
            </span>
          </div>
          <Counter aria-labelledby={`${id}-${row.label}`} {...row.props} />
        </li>
      ))}
    </ul>
  )
}
