import { Calendar } from '@vitnode/core/components/ui/calendar'
import React from 'react'

export default function CalendarMultipleExample() {
  const [dates, setDates] = React.useState<Date[] | undefined>([])
  const count = dates?.length ?? 0

  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        className="rounded-xl border shadow-xs"
        max={3}
        mode="multiple"
        onSelect={setDates}
        selected={dates}
      />
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm leading-relaxed"
      >
        {count === 3
          ? 'Three days picked. That is the limit.'
          : `Pick up to 3 days (${count} picked).`}
      </p>
    </div>
  )
}
