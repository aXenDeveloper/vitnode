import { Calendar } from '@vitnode/core/components/ui/calendar'
import React from 'react'

export default function CalendarWeekNumbersExample() {
  const [date, setDate] = React.useState<Date | undefined>(() => new Date())

  return (
    <Calendar
      className="rounded-xl border shadow-xs"
      mode="single"
      onSelect={setDate}
      selected={date}
      showWeekNumber
    />
  )
}
