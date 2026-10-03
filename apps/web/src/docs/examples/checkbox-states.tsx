import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@vitnode/core/components/ui/field'
import React from 'react'

export default function CheckboxStatesExample() {
  const id = React.useId()

  return (
    <FieldGroup className="not-prose w-full">
      <Field orientation="horizontal">
        <Checkbox defaultChecked id={`${id}-pin`} />
        <FieldLabel htmlFor={`${id}-pin`}>Pin this thread</FieldLabel>
      </Field>

      <Field orientation="horizontal">
        <Checkbox id={`${id}-notify`} />
        <FieldContent>
          <FieldLabel htmlFor={`${id}-notify`}>Notify followers</FieldLabel>
          <FieldDescription>
            Sends one email to everyone following this forum.
          </FieldDescription>
        </FieldContent>
      </Field>

      <Field orientation="horizontal">
        <Checkbox id={`${id}-all`} indeterminate />
        <FieldLabel htmlFor={`${id}-all`}>Select all 24 reports</FieldLabel>
      </Field>

      <Field data-disabled orientation="horizontal">
        <Checkbox disabled id={`${id}-lock`} />
        <FieldLabel htmlFor={`${id}-lock`}>
          Lock replies (moderators only)
        </FieldLabel>
      </Field>

      <Field data-invalid orientation="horizontal">
        <Checkbox
          aria-describedby={`${id}-rules-error`}
          aria-invalid
          id={`${id}-rules`}
        />
        <FieldContent>
          <FieldLabel htmlFor={`${id}-rules`}>
            I have read the community rules
          </FieldLabel>
          <FieldError id={`${id}-rules-error`}>
            Tick this one to post.
          </FieldError>
        </FieldContent>
      </Field>
    </FieldGroup>
  )
}
