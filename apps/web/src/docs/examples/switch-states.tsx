import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@vitnode/core/components/ui/field'
import { Switch } from '@vitnode/core/components/ui/switch'
import React from 'react'

export default function SwitchStatesExample() {
  const id = React.useId()

  return (
    <FieldGroup className="not-prose w-full">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={`${id}-digest`}>Weekly digest</FieldLabel>
          <FieldDescription>
            Top threads, every Monday morning.
          </FieldDescription>
        </FieldContent>
        <Switch defaultChecked id={`${id}-digest`} />
      </Field>

      <Field orientation="horizontal">
        <FieldLabel htmlFor={`${id}-compact`}>Compact thread list</FieldLabel>
        <Switch id={`${id}-compact`} size="sm" />
      </Field>

      <Field data-disabled orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={`${id}-sso`}>Sign in with SSO</FieldLabel>
          <FieldDescription>Your administrator manages this.</FieldDescription>
        </FieldContent>
        <Switch defaultChecked disabled id={`${id}-sso`} />
      </Field>

      <Field data-invalid orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={`${id}-public`}>Public profile</FieldLabel>
          <FieldError id={`${id}-public-error`}>
            Add an avatar before going public.
          </FieldError>
        </FieldContent>
        <Switch
          aria-describedby={`${id}-public-error`}
          aria-invalid
          id={`${id}-public`}
        />
      </Field>
    </FieldGroup>
  )
}
