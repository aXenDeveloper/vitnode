import { Checkbox } from '@vitnode/core/components/ui/checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from '@vitnode/core/components/ui/field'
import { Input } from '@vitnode/core/components/ui/input'
import { Switch } from '@vitnode/core/components/ui/switch'
import React from 'react'

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/

export default function FieldExample() {
  const id = React.useId()
  const [backupEmail, setBackupEmail] = React.useState('captain@')
  const isEmailInvalid = !EMAIL_PATTERN.test(backupEmail)

  return (
    <FieldSet className="not-prose w-full">
      <FieldLegend>Notifications</FieldLegend>
      <FieldDescription>
        Pick how loudly we should knock on your door.
      </FieldDescription>

      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-digest`}>Weekly digest</FieldLabel>
            <FieldDescription>
              A short recap of everything you missed, every Monday.
            </FieldDescription>
          </FieldContent>
          <Switch defaultChecked id={`${id}-digest`} />
        </Field>

        <Field orientation="horizontal">
          <Checkbox defaultChecked id={`${id}-mentions`} />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-mentions`}>Mentions</FieldLabel>
            <FieldDescription>
              Ping me when someone writes my name with an @ in front.
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field orientation="horizontal">
          <Checkbox id={`${id}-marketing`} />
          <FieldLabel htmlFor={`${id}-marketing`}>
            Product news, at most once a month
          </FieldLabel>
        </Field>

        <FieldSeparator />

        <Field data-invalid={isEmailInvalid}>
          <FieldLabel htmlFor={`${id}-backup-email`}>Backup email</FieldLabel>
          <Input
            aria-describedby={
              isEmailInvalid
                ? `${id}-backup-email-description ${id}-backup-email-error`
                : `${id}-backup-email-description`
            }
            aria-invalid={isEmailInvalid}
            id={`${id}-backup-email`}
            onChange={(event) => {
              setBackupEmail(event.target.value)
            }}
            type="email"
            value={backupEmail}
          />
          <FieldDescription id={`${id}-backup-email-description`}>
            Only used when your main inbox goes missing.
          </FieldDescription>
          {isEmailInvalid && (
            <FieldError id={`${id}-backup-email-error`}>
              That does not look like an email address yet.
            </FieldError>
          )}
        </Field>
      </FieldGroup>
    </FieldSet>
  )
}
