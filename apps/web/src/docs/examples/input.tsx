import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { toast } from 'sonner'
import { z } from 'zod'

export default function InputExample() {
  const formSchema = z.object({
    username: z
      .string()
      .min(3, 'Usernames need at least 3 characters')
      .default(''),
    email: z.email('That does not look like an email address').default(''),
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
              autoComplete="username"
              description="Unique and public. You can change it once a month."
              label="Username"
            />
          ),
        },
        {
          id: 'email',
          component: (props) => (
            <AutoFormInput
              {...props}
              autoComplete="email"
              description="We only use it for notifications."
              label="Email"
              type="email"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Account created', { description: `@${values.username}` })
      }}
    />
  )
}
