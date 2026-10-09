import { DatePicker } from '@vitnode/core/components/ui/date-picker'
import { Label } from '@vitnode/core/components/ui/label'
import React from 'react'

export default function DatePickerExample() {
  const id = React.useId()
  const [date, setDate] = React.useState<Date>()

  return (
    <div className="flex w-72 flex-col gap-2">
      <Label htmlFor={id}>Event date</Label>
      <DatePicker allowClear id={id} onChange={setDate} value={date} />
    </div>
  )
}
