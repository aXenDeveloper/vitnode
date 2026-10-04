import { Label } from '@vitnode/core/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vitnode/core/components/ui/number-field'
import React from 'react'

export default function NumberFieldStatesExample() {
  const disabledId = React.useId()
  const readOnlyId = React.useId()

  return (
    <div className="not-prose grid w-full gap-4 sm:grid-cols-2">
      <NumberField defaultValue={3} disabled id={disabledId}>
        <Label htmlFor={disabledId}>Moderators (disabled)</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <NumberField defaultValue={128} id={readOnlyId} readOnly>
        <Label htmlFor={readOnlyId}>Members (read-only)</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  )
}
