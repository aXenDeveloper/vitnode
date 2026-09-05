import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormNullableNumber } from '@vitnode/core/components/form/fields/nullable-number'
import { z } from 'zod'

export default function NullableNumberExample() {
  const formSchema = z.object({
    max_members: z.number().int().min(1).nullable().default(10),
    auto_logout: z.number().int().min(1).nullable().default(null),
  })

  return (
    <AutoForm
      fields={[
        {
          id: 'max_members',
          component: (props) => (
            <AutoFormNullableNumber
              {...props}
              label="Maximum members"
              min={1}
              toggleLabel="Unlimited"
            />
          ),
        },
        {
          id: 'auto_logout',
          component: (props) => (
            <AutoFormNullableNumber
              {...props}
              label="Auto-logout"
              min={1}
              orLabel="or"
              toggleLabel="Never"
              unitLabel="minutes"
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
