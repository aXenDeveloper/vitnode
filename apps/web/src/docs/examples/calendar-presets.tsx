import { Button } from '@vitnode/core/components/ui/button'
import { Calendar, type DateRange } from '@vitnode/core/components/ui/calendar'
import React from 'react'

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

const presetsFor = (today: Date) => [
  { label: 'Today', range: { from: today, to: today } },
  { label: 'Last 7 days', range: { from: addDays(today, -6), to: today } },
  { label: 'Last 30 days', range: { from: addDays(today, -29), to: today } },
  {
    label: 'This month',
    range: {
      from: new Date(today.getFullYear(), today.getMonth(), 1),
      to: today,
    },
  },
  {
    label: 'Last month',
    range: {
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 0),
    },
  },
]

export default function CalendarPresetsExample() {
  const [today] = React.useState(() => startOfDay(new Date()))
  const presets = presetsFor(today)
  const [range, setRange] = React.useState<DateRange | undefined>(
    presets[1].range,
  )
  const [month, setMonth] = React.useState(today)

  return (
    <div className="bg-background flex flex-col rounded-xl border shadow-xs sm:flex-row">
      <div className="flex flex-wrap gap-1 border-b p-3 sm:flex-col sm:border-e sm:border-b-0">
        {presets.map((preset) => (
          <Button
            className="justify-start"
            key={preset.label}
            onClick={() => {
              setRange(preset.range)
              setMonth(preset.range.to)
            }}
            size="sm"
            variant="ghost"
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Calendar
        disabled={{ after: today }}
        mode="range"
        month={month}
        onMonthChange={setMonth}
        onSelect={setRange}
        selected={range}
      />
    </div>
  )
}
