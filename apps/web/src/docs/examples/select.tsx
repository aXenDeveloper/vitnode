import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormSelect } from '@vitnode/core/components/form/fields/select'
import { toast } from 'sonner'
import { z } from 'zod'

export default function SelectExample() {
  const formSchema = z.object({
    visibility: z.enum(['public', 'members', 'staff']).default('public'),
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
              description="Who can read threads in this category."
              label="Visibility"
              labels={[
                { value: 'public', label: 'Everyone' },
                { value: 'members', label: 'Signed-in members' },
                { value: 'staff', label: 'Staff only' },
              ]}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Category updated', {
          description: `Visibility: ${values.visibility}`,
        })
      }}
    />
  )
}
