import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormColor } from '@vitnode/core/components/form/fields/color'
import { toast } from 'sonner'
import { z } from 'zod'

export default function ColorExample() {
  const formSchema = z.object({
    color: z.string().default('hsl(215, 81%, 52%)'),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'color',
          component: (props) => (
            <AutoFormColor
              {...props}
              allowRemoveColor
              description="Shown next to the category name in the forum list."
              label="Category color"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Category saved', {
          description: `Color: ${values.color || 'theme default'}`,
        })
      }}
    />
  )
}
