'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCheckbox } from '@vitnode/core/components/form/fields/checkbox'
import { z } from 'zod'

export default function SwitchExample() {
  const formSchema = z.object({
    acceptTerms: z.boolean().refine((val) => val, {
      message: 'You must accept the terms and conditions',
    }),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'acceptTerms',
          component: (props) => (
            <AutoFormCheckbox
              label="I accept the terms and conditions"
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
