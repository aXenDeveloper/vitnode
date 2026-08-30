'use client'

import { AutoForm } from '@vitnode/core/components/form/auto-form'
import {
  AutoFormUser,
  type UserOption,
} from '@vitnode/core/components/form/fields/input-users'
import { z } from 'zod'

const formSchema = z.object({
  authorId: z.number(),
})

const PEOPLE: UserOption[] = [
  { avatarColor: '3b82f6', id: 1, name: 'Ada Lovelace', nameCode: 'ada' },
  { avatarColor: 'ef4444', id: 2, name: 'Grace Hopper', nameCode: 'grace' },
  { avatarColor: '22c55e', id: 3, name: 'Alan Turing', nameCode: 'alan' },
]

export default function UserExample() {
  return (
    <AutoForm
      fields={[
        {
          id: 'authorId',
          component: (props) => (
            <AutoFormUser
              {...props}
              description="Search by name, pick one person."
              label="Author"
              placeholder="Select an author"
              search={async (value) =>
                Promise.resolve(
                  PEOPLE.filter((person) =>
                    person.name.toLowerCase().includes(value.toLowerCase()),
                  ),
                )
              }
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  )
}
