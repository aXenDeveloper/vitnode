import { AutoForm } from '@vitnode/core/components/form/auto-form'
import {
  AutoFormUser,
  type UserOption,
} from '@vitnode/core/components/form/fields/input-users'
import { z } from 'zod'

const formSchema = z.object({
  assigneeId: z.number().nullable().default(1),
})

const MODERATORS: UserOption[] = [
  {
    avatarColor: '2563eb',
    id: 1,
    name: 'Ada Lovelace',
    nameCode: 'ada',
    role: { color: '#dc2626', prefix: 'icon:shield' },
  },
  {
    avatarColor: 'db2777',
    id: 2,
    name: 'Grace Hopper',
    nameCode: 'grace',
    role: { color: '#16a34a' },
  },
  {
    avatarColor: '0891b2',
    id: 3,
    name: 'Alan Turing',
    nameCode: 'alan',
    role: { color: null },
  },
]

export default function UserRolesExample() {
  return (
    <AutoForm
      className="w-full"
      fields={[
        {
          id: 'assigneeId',
          component: (props) => (
            <AutoFormUser
              {...props}
              clearable
              description="Names use each person's role color and prefix."
              label="Assignee"
              placeholder="Unassigned"
              search={async (value) =>
                Promise.resolve(
                  MODERATORS.filter((person) =>
                    person.name.toLowerCase().includes(value.toLowerCase()),
                  ),
                )
              }
              selected={MODERATORS[0]}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
