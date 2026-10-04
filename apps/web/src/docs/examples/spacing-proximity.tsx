import { Input } from '@vitnode/core/components/ui/input'
import { Label } from '@vitnode/core/components/ui/label'
import { CheckIcon, XIcon } from 'lucide-react'
import React from 'react'

const SECTIONS = [
  {
    description: 'Shown next to your posts.',
    fields: [
      { label: 'Display name', value: 'Ada Lovelace' },
      { label: 'Username', value: 'ada' },
    ],
    title: 'Profile',
  },
  {
    description: 'Where we send the important stuff.',
    fields: [{ label: 'Email', value: 'ada@vitnode.com' }],
    title: 'Contact',
  },
] as const

const SPACING = {
  good: { field: 'gap-2', form: 'gap-8', heading: 'gap-1', section: 'gap-4' },
  bad: { field: 'gap-4', form: 'gap-4', heading: 'gap-4', section: 'gap-4' },
} as const

const SettingsForm = ({ good }: { good: boolean }) => {
  const id = React.useId()
  const spacing = good ? SPACING.good : SPACING.bad

  return (
    <div className={`flex flex-col ${spacing.form}`}>
      {SECTIONS.map((section) => (
        <section
          className={`flex flex-col ${spacing.section}`}
          key={section.title}
        >
          <div className={`flex flex-col ${spacing.heading}`}>
            <h4 className="text-sm font-semibold">{section.title}</h4>
            <p className="text-muted-foreground text-xs">
              {section.description}
            </p>
          </div>
          {section.fields.map((field) => {
            const fieldId = `${id}-${field.label}`

            return (
              <div
                className={`flex flex-col ${spacing.field}`}
                key={field.label}
              >
                <Label htmlFor={fieldId}>{field.label}</Label>
                <Input defaultValue={field.value} id={fieldId} readOnly />
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}

const Example = ({ caption, good }: { caption: string; good: boolean }) => (
  <figure className="bg-card flex flex-col gap-4 rounded-lg border p-4">
    <span
      className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-success' : 'text-destructive'}`}
    >
      {good ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <XIcon className="size-3.5" />
      )}
      {good ? 'Do' : "Don't"}
    </span>
    <SettingsForm good={good} />
    <figcaption className="text-muted-foreground text-xs leading-relaxed">
      {caption}
    </figcaption>
  </figure>
)

export default function SpacingProximity() {
  return (
    <div className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Example
        caption="gap-1 → gap-2 → gap-4 → gap-8. Related things huddle, sections breathe."
        good
      />
      <Example
        caption="gap-4 everywhere. Which label belongs to which input? Nobody knows."
        good={false}
      />
    </div>
  )
}
