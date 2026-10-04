import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormSwitch } from '@vitnode/core/components/form/fields/switch'
import { toast } from 'sonner'
import { z } from 'zod'

export default function SwitchExample() {
  const formSchema = z.object({
    maintenance: z.boolean().default(false),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'maintenance',
          component: (props) => (
            <AutoFormSwitch
              {...props}
              description="Only staff can browse the community while it's on."
              label="Maintenance mode"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Settings saved', {
          description: values.maintenance
            ? 'Maintenance mode is on.'
            : 'Your community is open.',
        })
      }}
    />
  )
}
