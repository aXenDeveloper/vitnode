import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@vitnode/core/components/ui/avatar'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@vitnode/core/components/ui/hover-card'
import { GitBranchIcon } from 'lucide-react'

export default function HoverCardExample() {
  return (
    <HoverCard>
      <HoverCardTrigger
        className="text-primary font-medium underline-offset-4 hover:underline"
        href="https://github.com/aXenDeveloper"
      >
        @axendev
      </HoverCardTrigger>
      <HoverCardContent className="flex gap-3">
        <Avatar size="lg">
          <AvatarImage alt="" src="https://github.com/aXenDeveloper.png" />
          <AvatarFallback>AX</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium">aXenDev</p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            Creator of VitNode. Probably renaming a variable right now.
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <GitBranchIcon aria-hidden className="size-3.5" />
            github.com/aXenDeveloper
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
