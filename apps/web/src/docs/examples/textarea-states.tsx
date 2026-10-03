import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@vitnode/core/components/ui/field'
import { Textarea } from '@vitnode/core/components/ui/textarea'
import React from 'react'

export default function TextareaStatesExample() {
  const id = React.useId()

  return (
    <FieldGroup className="not-prose w-full">
      <Field>
        <FieldLabel htmlFor={`${id}-reply`}>Reply</FieldLabel>
        <Textarea
          aria-describedby={`${id}-reply-description`}
          id={`${id}-reply`}
          placeholder="Keep it kind. Type a few lines and watch it grow."
        />
        <FieldDescription id={`${id}-reply-description`}>
          Markdown works here.
        </FieldDescription>
      </Field>

      <Field data-disabled>
        <FieldLabel htmlFor={`${id}-locked`}>Locked thread</FieldLabel>
        <Textarea
          disabled
          id={`${id}-locked`}
          placeholder="A moderator closed this thread."
        />
      </Field>

      <Field data-invalid>
        <FieldLabel htmlFor={`${id}-report`}>Report reason</FieldLabel>
        <Textarea
          aria-describedby={`${id}-report-error`}
          aria-invalid
          defaultValue="spam"
          id={`${id}-report`}
        />
        <FieldError id={`${id}-report-error`}>
          Tell the moderators a bit more. At least 10 characters.
        </FieldError>
      </Field>
    </FieldGroup>
  )
}
