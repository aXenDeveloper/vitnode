import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCombobox } from '@vitnode/core/components/form/fields/combobox'
import { toast } from 'sonner'
import { z } from 'zod'

const categories = [
  { value: 'announcements', label: 'Announcements' },
  { value: 'general', label: 'General discussion' },
  { value: 'plugins', label: 'Plugins & themes' },
  { value: 'support', label: 'Help & support' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'off-topic', label: 'Off-topic' },
]

export default function ComboboxExample() {
  const formSchema = z.object({
    category: z.enum([
      'announcements',
      'general',
      'plugins',
      'support',
      'showcase',
      'off-topic',
    ]),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'category',
          component: (props) => (
            <AutoFormCombobox
              {...props}
              description="Where your thread will be posted."
              label="Category"
              labels={categories}
              placeholder="Search categories..."
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Thread moved', {
          description: `New category: ${values.category}`,
        })
      }}
    />
  )
}
