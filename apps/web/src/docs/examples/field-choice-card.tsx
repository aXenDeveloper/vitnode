import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@vitnode/core/components/ui/field'
import {
  RadioGroup,
  RadioGroupItem,
} from '@vitnode/core/components/ui/radio-group'
import React from 'react'

const plans = [
  {
    value: 'hobby',
    title: 'Hobby',
    description: 'Free forever. Perfect for side quests.',
  },
  {
    value: 'team',
    title: 'Team',
    description: 'Shared workspaces and roles for up to 20 people.',
  },
  {
    value: 'enterprise',
    title: 'Enterprise',
    description: 'Single sign-on, audit logs and a very patient support team.',
    disabled: true,
  },
]

export default function FieldChoiceCardExample() {
  const id = React.useId()

  return (
    <FieldSet className="not-prose w-full">
      <FieldLegend variant="label">Plan</FieldLegend>
      <FieldDescription>You can switch plans at any time.</FieldDescription>

      <RadioGroup defaultValue="team">
        {plans.map((plan) => (
          <FieldLabel htmlFor={`${id}-${plan.value}`} key={plan.value}>
            <Field data-disabled={plan.disabled} orientation="horizontal">
              <FieldContent>
                <FieldTitle>{plan.title}</FieldTitle>
                <FieldDescription>{plan.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                disabled={plan.disabled}
                id={`${id}-${plan.value}`}
                value={plan.value}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
    </FieldSet>
  )
}
