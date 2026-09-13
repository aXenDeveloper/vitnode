import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormNumber } from '@vitnode/core/components/form/fields/number'
import { AutoFormSwitch } from '@vitnode/core/components/form/fields/switch'
import { z } from 'zod'

export default function AutoFormNestedFieldsExample() {
  const formSchema = z.object({
    allow_uploads: z.boolean().default(true),
    max_storage: z.number().int().min(1).default(2048),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'allow_uploads',
          component: (props) => (
            <AutoFormSwitch {...props} label="Allow uploads" />
          ),
          children: [
            {
              id: 'max_storage',
              component: (props) => (
                <AutoFormNumber
                  {...props}
                  label="Maximum file size"
                  min={1}
                  unitLabel="kB"
                />
              ),
            },
          ],
        },
      ]}
      formSchema={formSchema}
    />
  )
}
