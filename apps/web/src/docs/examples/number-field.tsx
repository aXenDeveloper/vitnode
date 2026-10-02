import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
} from '@vitnode/core/components/ui/number-field'
import React from 'react'

export default function NumberFieldExample() {
  const id = React.useId()
  const [coffees, setCoffees] = React.useState<null | number>(2)

  return (
    <div className="not-prose flex w-56 flex-col gap-3">
      <NumberField
        id={id}
        max={8}
        min={0}
        onValueChange={setCoffees}
        value={coffees}
      >
        <NumberFieldScrubArea htmlFor={id} label="Coffees per day" />
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {coffees === 8
          ? 'That is the limit. Your heart says thanks.'
          : `Value: ${coffees ?? 'empty'}`}
      </p>
    </div>
  )
}
