import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@vitnode/core/components/ui/field'
import { Input } from '@vitnode/core/components/ui/input'
import { Textarea } from '@vitnode/core/components/ui/textarea'
import React from 'react'

export default function FieldResponsiveExample() {
  const id = React.useId()

  return (
    <FieldGroup className="not-prose w-full">
      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel htmlFor={`${id}-name`}>Display name</FieldLabel>
          <FieldDescription>Shown next to your posts.</FieldDescription>
        </FieldContent>
        <Input
          className="@md/field-group:max-w-64 @md/field-group:min-w-64"
          defaultValue="Captain Hook"
          id={`${id}-name`}
        />
      </Field>

      <FieldSeparator />

      <Field orientation="responsive">
        <FieldContent>
          <FieldLabel htmlFor={`${id}-bio`}>Bio</FieldLabel>
          <FieldDescription>A sentence or two. No novels.</FieldDescription>
        </FieldContent>
        <Textarea
          className="@md/field-group:max-w-64 @md/field-group:min-w-64"
          id={`${id}-bio`}
          placeholder="I build things and occasionally break them."
        />
      </Field>
    </FieldGroup>
  )
}
