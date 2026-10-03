import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { AutoFormSelect } from '@vitnode/core/components/form/fields/select'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormConditionalExample() {
  const formSchema = z.object({
    visibility: z.enum(['public', 'members', 'password']).default('public'),
    password: z.string().optional(),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'visibility',
          component: (props) => (
            <AutoFormSelect
              {...props}
              label="Who can read this forum?"
              labels={[
                { value: 'public', label: 'Everyone' },
                { value: 'members', label: 'Signed-in members' },
                { value: 'password', label: 'Anyone with the password' },
              ]}
            />
          ),
        },
        {
          id: 'password',
          hidden: (values) => values.visibility !== 'password',
          component: (props) => (
            <AutoFormInput {...props} label="Forum password" type="password" />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Forum updated', { description: values.visibility })
      }}
    />
  )
}
