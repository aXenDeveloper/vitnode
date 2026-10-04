import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormRadioGroup } from '@vitnode/core/components/form/fields/radio-group'
import { toast } from 'sonner'
import { z } from 'zod'

export default function RadioGroupBlocksExample() {
  const formSchema = z.object({
    registration: z.enum(['open', 'approval', 'invite']).default('approval'),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'registration',
          component: (props) => (
            <AutoFormRadioGroup
              {...props}
              label="Registration"
              labels={[
                {
                  value: 'open',
                  label: 'Open',
                  description: 'Anyone can join right away.',
                },
                {
                  value: 'approval',
                  label: 'Approval required',
                  description: 'A moderator reviews every new account.',
                },
                {
                  value: 'invite',
                  label: 'Invite only',
                  description:
                    'Members need an invite link from a staff member.',
                  disabled: true,
                },
              ]}
              variant="blocks"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Registration updated', {
          description: values.registration,
        })
      }}
    />
  )
}
