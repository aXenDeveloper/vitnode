import { UserFormat } from '@vitnode/core/components/user-format'

const MEMBERS = [
  {
    name: 'Ada Lovelace',
    nameCode: 'ada',
    role: { color: '#dc2626', prefix: 'icon:crown' },
  },
  {
    name: 'Grace Hopper',
    nameCode: 'grace',
    role: { color: '#16a34a', prefix: 'icon:shield' },
  },
  { name: 'Alan Turing', nameCode: 'alan', role: { color: null } },
]

export default function UserFormatExample() {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {MEMBERS.map((member) => (
        <li className="flex items-center gap-3" key={member.nameCode}>
          <UserFormat format link user={member} />
          <span className="text-muted-foreground">
            /users/{member.nameCode}
          </span>
        </li>
      ))}
    </ul>
  )
}
