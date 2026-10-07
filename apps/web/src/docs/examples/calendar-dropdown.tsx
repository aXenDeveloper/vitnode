import { Calendar } from '@vitnode/core/components/ui/calendar'
import React from 'react'

export default function CalendarDropdownExample() {
  const [date, setDate] = React.useState<Date>()
  const [today] = React.useState(() => new Date())

  return (
    <Calendar
      captionLayout="dropdown"
      className="rounded-xl border shadow-xs"
      defaultMonth={new Date(today.getFullYear() - 25, today.getMonth())}
      disabled={{ after: today }}
      endMonth={today}
      mode="single"
      onSelect={setDate}
      selected={date}
      startMonth={new Date(today.getFullYear() - 100, 0)}
    />
  )
}
