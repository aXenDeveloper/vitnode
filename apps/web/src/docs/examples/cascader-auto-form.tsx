import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCascader } from '@vitnode/core/components/form/fields/cascader'
import { toast } from 'sonner'
import { z } from 'zod'

import { locations } from './cascader-options'

export default function CascaderAutoFormExample() {
  const formSchema = z.object({
    office: z.string({ error: 'Pick an office to continue' }),
    backupOffice: z.string().optional(),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'office',
          component: (props) => (
            <AutoFormCascader
              {...props}
              description="Where you'll be working most days."
              label="Office"
              options={locations}
              searchable
            />
          ),
        },
        {
          id: 'backupOffice',
          component: (props) => (
            <AutoFormCascader
              {...props}
              label="Backup office"
              options={locations}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Offices saved', {
          description: [values.office, values.backupOffice]
            .filter(Boolean)
            .join(' + '),
        })
      }}
    />
  )
}
