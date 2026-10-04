import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@vitnode/core/components/ui/field'
import { Input } from '@vitnode/core/components/ui/input'
import React from 'react'

export default function InputStatesExample() {
  const id = React.useId()

  return (
    <FieldGroup className="not-prose w-full">
      <Field>
        <FieldLabel htmlFor={`${id}-name`}>Display name</FieldLabel>
        <Input
          aria-describedby={`${id}-name-description`}
          autoComplete="nickname"
          id={`${id}-name`}
          placeholder="Captain Hook"
        />
        <FieldDescription id={`${id}-name-description`}>
          Shown next to your posts.
        </FieldDescription>
      </Field>

      <Field data-invalid>
        <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
        <Input
          aria-describedby={`${id}-email-error`}
          aria-invalid
          defaultValue="captain@"
          id={`${id}-email`}
          type="email"
        />
        <FieldError id={`${id}-email-error`}>
          That does not look like an email address yet.
        </FieldError>
      </Field>

      <Field data-disabled>
        <FieldLabel htmlFor={`${id}-id`}>Member ID</FieldLabel>
        <Input defaultValue="4815162342" disabled id={`${id}-id`} />
      </Field>

      <Field>
        <FieldLabel htmlFor={`${id}-avatar`}>Avatar</FieldLabel>
        <Input accept="image/*" id={`${id}-avatar`} type="file" />
      </Field>
    </FieldGroup>
  )
}
