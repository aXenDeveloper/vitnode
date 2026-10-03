import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarGroupItem,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'

const team = [
  { initials: 'AL', name: 'Ada Lovelace' },
  { initials: 'GH', name: 'Grace Hopper' },
  { initials: 'AT', name: 'Alan Turing' },
  { initials: 'KJ', name: 'Katherine Johnson' },
]

export default function AvatarExample() {
  return (
    <div className="not-prose flex flex-col items-center gap-8">
      <div className="flex items-center gap-4">
        <Avatar size="sm">
          <AvatarImage alt="VitNode" src="/logo_vitnode_icon.svg" />
          <AvatarFallback>VN</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarImage alt="VitNode" src="/logo_vitnode_icon.svg" />
          <AvatarFallback>VN</AvatarFallback>
        </Avatar>
        <Avatar size="lg">
          <AvatarImage alt="VitNode" src="/logo_vitnode_icon.svg" />
          <AvatarFallback>VN</AvatarFallback>
          <AvatarBadge className="bg-success" />
        </Avatar>
        <Avatar size="lg">
          <AvatarFallback>AL</AvatarFallback>
        </Avatar>
      </div>

      <AvatarGroup>
        {team.map((person) => (
          <AvatarGroupItem key={person.name} label={person.name}>
            <Avatar size="lg">
              <AvatarFallback>{person.initials}</AvatarFallback>
            </Avatar>
          </AvatarGroupItem>
        ))}
        <AvatarGroupCount>+3</AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}
