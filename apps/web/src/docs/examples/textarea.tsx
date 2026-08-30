'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { z } from 'zod'

export default function TextareaExample() {
  const formSchema = z.object({
    desc: z.string().min(10, 'Description must be at least 10 characters'),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'desc',
          component: (props) => (
            <AutoFormTextarea
              description="Write a short description of your application."
              label="Description"
              placeholder="My application is..."
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
