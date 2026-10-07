import type { DateRangeValue } from '@vitnode/core/components/ui/date-range-picker'

import { DateRangePicker } from '@vitnode/core/components/ui/date-range-picker'
import { Label } from '@vitnode/core/components/ui/label'
import React from 'react'

type Preset = 'last-30-days' | 'last-7-days' | 'this-month'

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const resolve = (preset: Preset): DateRangeValue => {
  const today = startOfDay(new Date())
  const daysAgo = (days: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - days)

  if (preset === 'last-7-days') return { from: daysAgo(6), to: today }
  if (preset === 'last-30-days') return { from: daysAgo(29), to: today }

  return {
    from: new Date(today.getFullYear(), today.getMonth(), 1),
    to: today,
  }
}

const PRESETS = [
  { key: 'last-7-days', label: 'Last 7 days' },
  { key: 'last-30-days', label: 'Last 30 days' },
  { key: 'this-month', label: 'This month' },
] as const

export default function DatePickerRangeExample() {
  const id = React.useId()
  const [preset, setPreset] = React.useState<null | Preset>('last-7-days')
  const [range, setRange] = React.useState(() => resolve('last-7-days'))

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Report dates</Label>
      <DateRangePicker<Preset>
        activePreset={preset}
        align="start"
        disabledDays={{ after: new Date() }}
        endMonth={new Date()}
        id={id}
        onChange={(next) => {
          setPreset(null)
          setRange(next)
        }}
        onPresetSelect={(next) => {
          setPreset(next)
          setRange(resolve(next))
        }}
        presets={PRESETS}
        value={range}
      />
    </div>
  )
}
