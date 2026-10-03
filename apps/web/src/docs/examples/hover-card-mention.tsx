import { Avatar, AvatarFallback } from '@vitnode/core/components/ui/avatar'
import { Badge } from '@vitnode/core/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@vitnode/core/components/ui/hover-card'
import { MessageSquareIcon } from 'lucide-react'

const linkClassName =
  'text-primary font-medium underline-offset-4 hover:underline'

export default function HoverCardMentionExample() {
  return (
    <div className="not-prose text-muted-foreground max-w-sm text-sm leading-relaxed text-pretty">
      Thanks{' '}
      <HoverCard>
        <HoverCardTrigger
          className={linkClassName}
          closeDelay={100}
          delay={200}
          href="#maya-chen"
        >
          @maya
        </HoverCardTrigger>
        <HoverCardContent className="flex items-center gap-3" side="top">
          <Avatar size="lg">
            <AvatarFallback>MC</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-medium">Maya Chen</p>
            <Badge variant="secondary">Lead moderator</Badge>
          </div>
        </HoverCardContent>
      </HoverCard>
      , that fixed it! For anyone else stuck, the full answer is in{' '}
      <HoverCard>
        <HoverCardTrigger className={linkClassName} href="#thread-1234">
          Login fails after password reset
        </HoverCardTrigger>
        <HoverCardContent className="flex w-72 flex-col gap-2">
          <Badge variant="success">Solved</Badge>
          <p className="text-foreground text-sm font-medium text-balance">
            Login fails after password reset
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <MessageSquareIcon aria-hidden className="size-3.5" />
            14 replies · last one 2 hours ago
          </p>
        </HoverCardContent>
      </HoverCard>
      .
    </div>
  )
}
