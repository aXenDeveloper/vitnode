import { Button } from '@vitnode/core/components/ui/button'
import { Calendar } from '@vitnode/core/components/ui/calendar'
import { ScrollArea } from '@vitnode/core/components/ui/scroll-area'
import React from 'react'

const SLOTS = Array.from({ length: 17 }, (_, index) => {
  const minutes = 9 * 60 + index * 30

  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

export default function CalendarAppointmentExample() {
  const [today] = React.useState(() => new Date())
  const [date, setDate] = React.useState<Date | undefined>(today)
  const [time, setTime] = React.useState<string>()

  return (
    <div className="bg-background flex flex-col rounded-xl border shadow-xs">
      <div className="flex flex-col sm:flex-row">
        <Calendar
          disabled={[{ before: today }, { dayOfWeek: [0, 6] }]}
          mode="single"
          onSelect={(next) => {
            setDate(next)
            setTime(undefined)
          }}
          selected={date}
        />
        <ScrollArea className="h-72 border-t sm:w-32 sm:border-s sm:border-t-0">
          <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-1">
            {SLOTS.map((slot) => (
              <Button
                aria-pressed={time === slot}
                disabled={!date}
                key={slot}
                onClick={() => setTime(slot)}
                size="sm"
                variant={time === slot ? 'default' : 'outline'}
              >
                {slot}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
      <p
        aria-live="polite"
        className="text-muted-foreground border-t p-3 text-sm leading-relaxed text-pretty"
      >
        {date && time
          ? `Booked for ${date.toLocaleDateString(undefined, { dateStyle: 'full' })} at ${time}.`
          : 'Pick a day, then a time.'}
      </p>
    </div>
  )
}
