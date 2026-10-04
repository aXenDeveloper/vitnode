import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import { Button } from '@vitnode/core/components/ui/button'
import { RotateCcwIcon } from 'lucide-react'
import React from 'react'

const MEMBERS = [
  { initials: 'VN', label: 'Image loaded', src: '/logo_vitnode_icon.svg' },
  { initials: 'GH', label: 'Broken link', src: '/missing-avatar.png' },
  { initials: 'AT', label: 'No image' },
]

export default function AvatarFallbackDemo() {
  const [replays, setReplays] = React.useState(0)

  return (
    <div className="not-prose flex flex-col items-center gap-6">
      <ul className="flex flex-wrap justify-center gap-6" key={replays}>
        {MEMBERS.map((member) => (
          <li className="flex flex-col items-center gap-2" key={member.label}>
            <Avatar size="lg">
              {member.src ? (
                <AvatarImage alt={member.label} src={member.src} />
              ) : null}
              <AvatarFallback>{member.initials}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs">
              {member.label}
            </span>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => setReplays((count) => count + 1)}
        size="sm"
        variant="outline"
      >
        <RotateCcwIcon />
        Reload
      </Button>
    </div>
  )
}
