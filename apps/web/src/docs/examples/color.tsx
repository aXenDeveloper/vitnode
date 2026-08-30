'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormColor } from '@vitnode/core/components/form/fields/color'
import { z } from 'zod'

export default function ColorExample() {
  const formSchema = z.object({
    color: z.string().default('hsl(240, 80%, 60%)'),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'color',
          component: (props) => (
            <AutoFormColor
              description="Pick a color. The value is stored as an HSL string."
              label="Color"
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        // eslint-disable-next-line no-console
        console.log(values.color)
      }}
    />
  )
}
