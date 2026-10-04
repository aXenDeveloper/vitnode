import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCheckbox } from '@vitnode/core/components/form/fields/checkbox'
import { toast } from 'sonner'
import { z } from 'zod'

export default function CheckboxExample() {
  const formSchema = z.object({
    acceptRules: z.boolean().refine((value) => value, {
      message: 'You need to accept the rules to join',
    }),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'acceptRules',
          component: (props) => (
            <AutoFormCheckbox
              {...props}
              description="Be kind, stay on topic, no spam."
              label="I accept the community rules"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={() => {
        toast.success('Welcome aboard', {
          description: 'Your account is ready.',
        })
      }}
    />
  )
}
