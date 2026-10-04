import { Avatar } from '@vitnode/core/components/avatar'

const USERS = [
  { avatarColor: 'fde047', name: 'Yuki Tanaka', nameCode: 'yuki' },
  { avatarColor: '22c55e', name: 'Grace Hopper', nameCode: 'grace' },
  { avatarColor: '1e3a8a', name: 'Alan Turing', nameCode: 'alan' },
  { avatarColor: 'e11d48', name: 'Rosa Parks', nameCode: 'rosa' },
]

export default function AvatarLetter() {
  return (
    <ul className="not-prose flex flex-wrap justify-center gap-6">
      {USERS.map((user) => (
        <li className="flex flex-col items-center gap-2" key={user.nameCode}>
          <Avatar size={48} user={user} />
          <code className="text-muted-foreground font-mono text-xs">
            #{user.avatarColor}
          </code>
        </li>
      ))}
    </ul>
  )
}
