import {
  AutoForm,
  setFormFieldError,
} from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { toast } from 'sonner'
import { z } from 'zod'

const TAKEN = new Set(['admin', 'captain', 'moderator'])

export default function AutoFormServerErrorExample() {
  const formSchema = z.object({
    username: z.string().min(3).default('captain'),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'username',
          component: (props) => (
            <AutoFormInput
              {...props}
              description="Try admin, moderator or captain."
              label="Username"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values, form) => {
        if (TAKEN.has(values.username.toLowerCase())) {
          setFormFieldError(form, 'username', 'That username is taken')

          return
        }

        toast.success('Username changed', {
          description: `@${values.username}`,
        })
      }}
    />
  )
}
