import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCombobox } from '@vitnode/core/components/form/fields/combobox'
import { toast } from 'sonner'
import { z } from 'zod'

const topics = [
  { value: 'news', label: 'News' },
  { value: 'guides', label: 'Guides' },
  { value: 'releases', label: 'Releases' },
  { value: 'plugins', label: 'Plugins' },
  { value: 'community', label: 'Community' },
]

export default function ComboboxMultipleExample() {
  const formSchema = z.object({
    topics: z
      .array(z.enum(['news', 'guides', 'releases', 'plugins', 'community']))
      .min(1, 'Pick at least one topic'),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'topics',
          component: (props) => (
            <AutoFormCombobox
              {...props}
              description="Pick as many topics as you like - only the first three show up."
              label="Topics"
              labels={topics}
              maxVisibleChips={3}
              multiple
              placeholder="Search topics..."
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Topics saved', {
          description: values.topics.join(', '),
        })
      }}
    />
  )
}
