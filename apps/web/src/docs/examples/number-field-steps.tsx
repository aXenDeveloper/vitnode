import { Kbd } from '@vitnode/core/components/ui/kbd'
import { Label } from '@vitnode/core/components/ui/label'
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@vitnode/core/components/ui/number-field'
import React from 'react'

export default function NumberFieldStepsExample() {
  const id = React.useId()
  const hintId = React.useId()

  return (
    <div className="not-prose flex w-64 flex-col gap-3">
      <NumberField
        defaultValue={25}
        id={id}
        largeStep={50}
        max={500}
        min={0}
        snapOnStep
        step={5}
      >
        <Label htmlFor={id}>Upload limit (MB)</Label>
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput aria-describedby={hintId} />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
      <p
        className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm leading-relaxed"
        id={hintId}
      >
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> moves 5, hold <Kbd>Shift</Kbd> for 50.
      </p>
    </div>
  )
}
