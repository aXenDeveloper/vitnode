import { Calendar, type DateRange } from '@vitnode/core/components/ui/calendar'
import React from 'react'

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

export default function CalendarRangeExample() {
  const [today] = React.useState(() => new Date())
  const [range, setRange] = React.useState<DateRange | undefined>(() => ({
    from: addDays(today, 3),
    to: addDays(today, 9),
  }))

  return (
    <Calendar
      className="rounded-xl border shadow-xs"
      defaultMonth={range?.from}
      mode="range"
      numberOfMonths={2}
      onSelect={setRange}
      selected={range}
    />
  )
}
