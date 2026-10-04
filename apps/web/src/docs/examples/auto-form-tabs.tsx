import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormTabsExample() {
  const formSchema = z.object({
    name: z.string().min(1).default('Night Owls'),
    slug: z.string().min(1).default('night-owls'),
    metaTitle: z
      .string()
      .min(10, 'Search engines like at least 10 characters')
      .default(''),
    metaDescription: z.string().max(160).optional(),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'name',
          component: (props) => <AutoFormInput {...props} label="Name" />,
        },
        {
          id: 'slug',
          component: (props) => <AutoFormInput {...props} label="Slug" />,
        },
        {
          id: 'metaTitle',
          tab: 'seo',
          component: (props) => <AutoFormInput {...props} label="Meta title" />,
        },
        {
          id: 'metaDescription',
          tab: 'seo',
          component: (props) => (
            <AutoFormTextarea {...props} label="Meta description" />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Category saved', { description: values.name })
      }}
      submitButtonProps={{ children: 'Save category' }}
      tabs={[
        { value: 'general', label: 'General' },
        { value: 'seo', label: 'SEO' },
      ]}
    />
  )
}
