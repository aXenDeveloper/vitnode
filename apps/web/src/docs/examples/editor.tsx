'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormEditor } from '@vitnode/core/components/form/fields/editor'
import { z } from 'zod'

export default function EditorExample() {
  const formSchema = z.object({
    content: z
      .string()
      .min(1, 'Content is required')
      .default('<p>Write your content here...</p>'),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'content',
          component: (props) => (
            <AutoFormEditor
              description="Rich text content powered by the Editor."
              label="Content"
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
