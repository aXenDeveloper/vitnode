import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { AutoFormSwitch } from '@vitnode/core/components/form/fields/switch'
import { Badge } from '@vitnode/core/components/ui/badge'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormTipExample() {
  const formSchema = z.object({
    slug: z
      .string()
      .regex(
        /^[a-z\d]+(?:-[a-z\d]+)*$/,
        'Use lowercase letters, numbers and dashes',
      )
      .default('general-chat'),
    slowMode: z.boolean().default(false),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'slug',
          component: (props) => (
            <AutoFormInput
              {...props}
              description="Shown in the forum's address."
              label="Slug"
              labelRight={<Badge variant="secondary">Public</Badge>}
              tip="Changing the slug later breaks every link already shared, so pick one you can live with. Old bookmarks will not follow along."
            />
          ),
        },
        {
          id: 'slowMode',
          component: (props) => (
            <AutoFormSwitch
              {...props}
              description="Members wait 30 seconds between posts."
              label="Slow mode"
              tip="Handy when a thread catches fire. Moderators and admins are never slowed down."
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Forum saved', { description: `/${values.slug}` })
      }}
    />
  )
}
