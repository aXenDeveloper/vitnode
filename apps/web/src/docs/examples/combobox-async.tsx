import { AutoForm } from '@vitnode/core/components/form/auto-form'
import { AutoFormCombobox } from '@vitnode/core/components/form/fields/combobox'
import { Avatar, AvatarFallback } from '@vitnode/core/components/ui/avatar'
import { toast } from 'sonner'
import { z } from 'zod'

const MEMBERS = [
  { value: '1', label: 'Ada Lovelace' },
  { value: '2', label: 'Grace Hopper' },
  { value: '3', label: 'Linus Torvalds' },
  { value: '4', label: 'Margaret Hamilton' },
  { value: '5', label: 'Tim Berners-Lee' },
  { value: '6', label: 'Katherine Johnson' },
]

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)

const searchMembers = async ({ search }: { search: string }) => {
  await new Promise((resolve) => {
    setTimeout(resolve, 600)
  })
  const needle = search.trim().toLowerCase()

  return MEMBERS.filter((member) => member.label.toLowerCase().includes(needle))
}

export default function ComboboxAsyncExample() {
  const formSchema = z.object({
    moderators: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .min(1, 'Pick at least one moderator')
      .default([]),
  })

  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'moderators',
          component: (props) => (
            <AutoFormCombobox
              {...props}
              description="Results load from the server as you type."
              fetchData={searchMembers}
              id="moderators"
              label="Moderators"
              multiple
              queryKey={['docs', 'combobox-members']}
              renderItem={(item) => (
                <span className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initialsOf(item.label)}</AvatarFallback>
                  </Avatar>
                  {item.label}
                </span>
              )}
              searchPlaceholder="Find a member..."
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Moderators assigned', {
          description: values.moderators
            .map((member) => member.label)
            .join(', '),
        })
      }}
    />
  )
}
