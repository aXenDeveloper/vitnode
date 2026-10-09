import { Calendar } from '@vitnode/core/components/ui/calendar'
import React from 'react'

export default function CalendarDisabledExample() {
  const [date, setDate] = React.useState<Date>()
  const [today] = React.useState(() => new Date())

  return (
    <Calendar
      className="rounded-xl border shadow-xs"
      disabled={[{ before: today }, { dayOfWeek: [0, 6] }]}
      mode="single"
      onSelect={setDate}
      selected={date}
    />
  )
}
