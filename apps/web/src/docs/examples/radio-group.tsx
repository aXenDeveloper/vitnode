import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormRadioGroup } from '@vitnode/core/components/form/fields/radio-group'
import { toast } from 'sonner'
import { z } from 'zod'

export default function RadioGroupExample() {
  const formSchema = z.object({
    sort: z.enum(['latest', 'top', 'unanswered']).default('latest'),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'sort',
          component: (props) => (
            <AutoFormRadioGroup
              {...props}
              description="How threads are ordered when members open the forum."
              label="Default sort"
              labels={[
                {
                  value: 'latest',
                  label: 'Latest activity',
                  description: 'Threads with new replies float to the top.',
                },
                { value: 'top', label: 'Most liked' },
                {
                  value: 'unanswered',
                  label: 'Unanswered first',
                  description: 'Available once the Q&A plugin is installed.',
                  disabled: true,
                },
              ]}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Forum sort saved', { description: values.sort })
      }}
    />
  )
}
