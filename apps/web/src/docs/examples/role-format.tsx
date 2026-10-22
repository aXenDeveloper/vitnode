import { RoleFormat } from '@vitnode/core/components/role-format'

const ROLES = [
  {
    color: '#dc2626',
    id: 1,
    name: [
      { languageCode: 'en', name: 'Administrator' },
      { languageCode: 'pl', name: 'Administrator' },
    ],
    prefix: 'icon:crown',
  },
  {
    color: '#16a34a',
    id: 2,
    name: [{ languageCode: 'en', name: 'Moderator' }],
    prefix: 'icon:shield',
  },
  {
    color: '#2563eb',
    id: 3,
    name: [{ languageCode: 'en', name: 'Designer' }],
    prefix: 'emoji:🎨',
  },
  {
    color: null,
    id: 4,
    name: [{ languageCode: 'en', name: 'Member' }],
  },
]

export default function RoleFormatExample() {
  return (
    <ul className="flex flex-col gap-3 text-sm">
      {ROLES.map((role) => (
        <li className="flex" key={role.id}>
          <RoleFormat role={role} />
        </li>
      ))}
    </ul>
  )
}
