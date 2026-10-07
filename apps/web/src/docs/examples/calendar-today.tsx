import { Button } from '@vitnode/core/components/ui/button'
import { Calendar } from '@vitnode/core/components/ui/calendar'
import React from 'react'

export default function CalendarTodayExample() {
  const [today] = React.useState(() => new Date())
  const [date, setDate] = React.useState<Date>()
  const [month, setMonth] = React.useState(today)

  return (
    <div className="bg-background flex flex-col rounded-xl border shadow-xs">
      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        onSelect={setDate}
        selected={date}
      />
      <div className="flex border-t p-3">
        <Button
          className="w-full"
          onClick={() => {
            setDate(today)
            setMonth(today)
          }}
          size="sm"
          variant="outline"
        >
          Today
        </Button>
      </div>
    </div>
  )
}
