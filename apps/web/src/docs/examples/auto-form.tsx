import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCheckbox } from '@vitnode/core/components/form/fields/checkbox'
import { AutoFormEditor } from '@vitnode/core/components/form/fields/editor'
import { AutoFormInput } from '@vitnode/core/components/form/fields/input'
import { AutoFormSelect } from '@vitnode/core/components/form/fields/select'
import { AutoFormTextarea } from '@vitnode/core/components/form/fields/textarea'
import { InputGroupAddon } from '@vitnode/core/components/ui/input-group'
import { AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

export default function AutoFormExample() {
  const formSchema = z.object({
    username: z
      .string()
      .min(3, 'Usernames need at least 3 characters')
      .default(''),
    email: z
      .email('That does not look like an email address')
      .default('')
      .describe('Only used for notifications. Never shown publicly.'),
    role: z.enum(['member', 'moderator', 'admin']),
    bio: z.string().max(160).optional(),
    welcome: z
      .string()
      .min(1, 'Say hi to the new member')
      .default('<p>Welcome aboard! Start in the Introductions forum.</p>'),
    acceptRules: z.boolean().refine((value) => value, {
      message: 'Members must accept the community rules',
    }),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'username',
          component: (props) => (
            <AutoFormInput {...props} label="Username" placeholder="captain">
              <InputGroupAddon>
                <AtSign />
              </InputGroupAddon>
            </AutoFormInput>
          ),
        },
        {
          id: 'email',
          component: (props) => (
            <AutoFormInput {...props} label="Email" type="email" />
          ),
        },
        {
          id: 'role',
          component: (props) => (
            <AutoFormSelect
              {...props}
              label="Role"
              labels={[
                { value: 'member', label: 'Member' },
                { value: 'moderator', label: 'Moderator' },
                { value: 'admin', label: 'Administrator' },
              ]}
            />
          ),
        },
        {
          id: 'bio',
          component: (props) => (
            <AutoFormTextarea
              {...props}
              description="Shown on the member's profile card."
              label="Bio"
            />
          ),
        },
        {
          id: 'welcome',
          component: (props) => (
            <AutoFormEditor {...props} label="Welcome message" />
          ),
        },
        {
          id: 'acceptRules',
          component: (props) => (
            <AutoFormCheckbox {...props} label="I accept the community rules" />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Member invited', {
          description: `@${values.username} gets an email in a minute.`,
        })
      }}
    />
  )
}
