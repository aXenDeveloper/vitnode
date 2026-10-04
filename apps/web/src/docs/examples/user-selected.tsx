import { AutoForm } from '@vitnode/core/components/form/auto-form'
import {
  AutoFormUser,
  type UserOption,
} from '@vitnode/core/components/form/fields/input-users'
import { toast } from 'sonner'
import { z } from 'zod'

const formSchema = z.object({
  reviewerId: z.number().nullable().default(7),
})

const PEOPLE: UserOption[] = [
  {
    avatarColor: '3b82f6',
    id: 7,
    name: 'Margaret Hamilton',
    nameCode: 'maggie',
  },
  { avatarColor: 'f97316', id: 8, name: 'Linus Torvalds', nameCode: 'linus' },
]

export default function UserSelectedExample() {
  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'reviewerId',
          component: (props) => (
            <AutoFormUser
              {...props}
              clearable
              description="Opens on the saved reviewer. Clear it to unassign."
              label="Reviewer"
              placeholder="Nobody yet"
              search={async (value) =>
                Promise.resolve(
                  PEOPLE.filter((person) =>
                    person.name.toLowerCase().includes(value.toLowerCase()),
                  ),
                )
              }
              selected={{ id: 7, name: 'Margaret Hamilton' }}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={(values) => {
        toast.success('Review assigned', {
          description: values.reviewerId
            ? `Reviewer id: ${values.reviewerId}`
            : 'Nobody is reviewing this one.',
        })
      }}
    />
  )
}
