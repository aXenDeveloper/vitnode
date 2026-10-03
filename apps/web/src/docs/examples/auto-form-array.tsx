import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormArray } from '@vitnode/core/components/form/fields/array'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormArrayExample() {
  const formSchema = z.object({
    links: z
      .array(
        z.object({
          title: z.string().min(1, 'Give the link a name'),
          url: z.url('Links start with https://'),
        }),
      )
      .max(3)
      .default([{ title: 'Discord', url: 'https://discord.gg/vitnode' }]),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'links',
          component: (props) => (
            <AutoFormArray
              {...props}
              addButtonLabel="Add link"
              fields={[
                {
                  id: 'title',
                  className: 'flex-1',
                  component: (subProps) => (
                    <AutoFormInput {...subProps} label="Title" />
                  ),
                },
                {
                  id: 'url',
                  className: 'flex-1',
                  component: (subProps) => (
                    <AutoFormInput {...subProps} label="URL" type="url" />
                  ),
                },
              ]}
              label="Sidebar links"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Sidebar saved', {
          description: `${values.links.length} links`,
        })
      }}
    />
  )
}
