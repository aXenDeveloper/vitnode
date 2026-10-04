import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCombobox } from '@vitnode/core/components/form/fields/combobox'
import { z } from 'zod'

const timezones = [
  { group: 'Europe', label: 'London', value: 'europe-london' },
  { group: 'Europe', label: 'Warsaw', value: 'europe-warsaw' },
  { group: 'Europe', label: 'Lisbon', value: 'europe-lisbon' },
  { group: 'Americas', label: 'New York', value: 'america-new-york' },
  { group: 'Americas', label: 'São Paulo', value: 'america-sao-paulo' },
  { group: 'Americas', label: 'Vancouver', value: 'america-vancouver' },
  { group: 'Asia & Pacific', label: 'Tokyo', value: 'asia-tokyo' },
  { group: 'Asia & Pacific', label: 'Singapore', value: 'asia-singapore' },
  { group: 'Asia & Pacific', label: 'Sydney', value: 'australia-sydney' },
]

export default function ComboboxGroupsExample() {
  const formSchema = z.object({
    timezone: z.enum([
      'europe-london',
      'europe-warsaw',
      'europe-lisbon',
      'america-new-york',
      'america-sao-paulo',
      'america-vancouver',
      'asia-tokyo',
      'asia-singapore',
      'australia-sydney',
    ]),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'timezone',
          component: (props) => (
            <AutoFormCombobox
              {...props}
              description="Used for scheduled posts and email digests."
              label="Timezone"
              labels={timezones}
              placeholder="Search cities..."
              showClear
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
