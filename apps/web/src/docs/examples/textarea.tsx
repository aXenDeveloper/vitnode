import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { toast } from 'sonner'
import { z } from 'zod'

export default function TextareaExample() {
  const formSchema = z.object({
    about: z
      .string()
      .min(10, 'Tell people a bit more. At least 10 characters.')
      .max(500)
      .default(''),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'about',
          component: (props) => (
            <AutoFormTextarea
              {...props}
              description="Shown at the top of your community's home page."
              label="About"
              placeholder="A cozy corner for night owls who build things."
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={() => {
        toast.success('About section saved', {
          description: 'Your home page is up to date.',
        })
      }}
    />
  )
}
