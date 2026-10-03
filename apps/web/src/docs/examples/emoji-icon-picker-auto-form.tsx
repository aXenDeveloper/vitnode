import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormEmojiIcon } from '@vitnode/core/components/form/fields/emoji-icon'
import { EMOJI_ICON_MAX_LENGTH } from '@vitnode/core/lib/emoji-icon'
import { toast } from 'sonner'
import { z } from 'zod'

export default function EmojiIconPickerAutoFormExample() {
  const formSchema = z.object({
    prefix: z
      .string()
      .max(EMOJI_ICON_MAX_LENGTH)
      .default('icon:shield-check')
      .describe('Shown in front of the name of every member of this role.'),
  })

  return (
    <AutoForm
      fields={[
        {
          component: (props) => (
            <AutoFormEmojiIcon allowRemove label="Prefix" {...props} />
          ),
          id: 'prefix',
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Prefix saved', {
          description: values.prefix || 'No prefix',
        })
      }}
    />
  )
}
