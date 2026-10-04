import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import React from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

const MODES = ['onTouched', 'onChange', 'onSubmit'] as const

type Mode = (typeof MODES)[number]

const formSchema = z.object({
  title: z
    .string()
    .min(5, 'Thread titles need at least 5 characters')
    .default(''),
  tag: z.string().min(2, 'Add a tag so people can find it').default(''),
})

export default function AutoFormValidationExample() {
  const [mode, setMode] = React.useState<Mode>('onTouched')

  return (
    <div className="not-prose flex w-full flex-col gap-6">
      <ToggleGroup
        aria-label="Validation mode"
        onValueChange={(value: string[]) => {
          const next = MODES.find((item) => item === value[0])
          if (next) setMode(next)
        }}
        size="sm"
        value={[mode]}
        variant="outline"
      >
        {MODES.map((item) => (
          <ToggleGroupItem className="font-mono" key={item} value={item}>
            {item}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <AutoForm
        className="w-full"
        fields={[
          {
            id: 'title',
            component: (props) => (
              <AutoFormInput
                {...props}
                label="Thread title"
                placeholder="Show off your setup"
              />
            ),
          },
          {
            id: 'tag',
            component: (props) => (
              <AutoFormInput {...props} label="Tag" placeholder="hardware" />
            ),
          },
        ]}
        formSchema={formSchema}
        key={mode}
        mode={mode}
        onSubmit={(values) => {
          toast.success('Thread posted', { description: values.title })
        }}
        submitButtonProps={{ children: 'Post thread' }}
      />
    </div>
  )
}
