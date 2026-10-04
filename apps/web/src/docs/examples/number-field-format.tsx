import { Label } from '@vitnode/core/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vitnode/core/components/ui/number-field'
import React from 'react'

export default function NumberFieldFormatExample() {
  const priceId = React.useId()
  const discountId = React.useId()

  return (
    <div className="not-prose grid w-full gap-4 sm:grid-cols-2">
      <NumberField
        defaultValue={19.99}
        format={{ currency: 'USD', style: 'currency' }}
        id={priceId}
        largeStep={10}
        min={0}
        step={0.5}
      >
        <Label htmlFor={priceId}>Price</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <NumberField
        defaultValue={0.15}
        format={{ style: 'percent' }}
        id={discountId}
        largeStep={0.1}
        max={1}
        min={0}
        step={0.01}
      >
        <Label htmlFor={discountId}>Discount</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  )
}
