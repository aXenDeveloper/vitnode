import {
  Calendar,
  CalendarDayButton,
} from '@vitnode/core/components/ui/calendar'
import React from 'react'

const priceFor = (date: Date) => ([0, 5, 6].includes(date.getDay()) ? 129 : 89)

const PricedDayButton = ({
  children,
  ...props
}: React.ComponentProps<typeof CalendarDayButton>) => (
  <CalendarDayButton {...props}>
    {children}
    {!props.modifiers.disabled && <span>${priceFor(props.day.date)}</span>}
  </CalendarDayButton>
)

export default function CalendarPricingExample() {
  const [date, setDate] = React.useState<Date>()
  const [today] = React.useState(() => new Date())

  return (
    <Calendar
      className="rounded-xl border shadow-xs [--cell-size:--spacing(11)]"
      components={{ DayButton: PricedDayButton }}
      disabled={{ before: today }}
      mode="single"
      onSelect={setDate}
      selected={date}
      showOutsideDays={false}
    />
  )
}
