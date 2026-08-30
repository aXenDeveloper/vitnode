'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormRadioGroup } from '@vitnode/core/components/form/fields/radio-group'
import { z } from 'zod'

export default function RadioGroupExample() {
  const formSchema = z.object({
    options: z.enum(['option1', 'option2', 'option3']).default('option1'),
    options_block: z.enum(['option1', 'option2', 'option3']).default('option1'),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'options',
          component: (props) => (
            <AutoFormRadioGroup
              {...props}
              description="By checking this box, you agree to the terms and conditions."
              label="I agree to the terms and conditions"
              labels={[
                {
                  value: 'option1',
                  label: 'Option 1',
                  description: 'This is the description for option 1',
                },
                {
                  value: 'option2',
                  label: 'Option 2',
                },
                {
                  value: 'option3',
                  label: 'Option 3',
                  description: 'This is the description for option 3',
                  disabled: true,
                },
              ]}
            />
          ),
        },
        {
          id: 'options_block',
          component: (props) => (
            <AutoFormRadioGroup
              {...props}
              description="By checking this box, you agree to the terms and conditions."
              label="I agree to the terms and conditions with blocks variant"
              labels={[
                {
                  value: 'option1',
                  label: 'Option 1',
                  description: 'This is the description for option 1',
                },
                {
                  value: 'option2',
                  label: 'Option 2',
                },
                {
                  value: 'option3',
                  label: 'Option 3',
                  description: 'This is the description for option 3',
                  disabled: true,
                },
              ]}
              variant="blocks"
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
