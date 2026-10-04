import { Button } from '@vitnode/core/components/ui/button'
import {
  TooltipProvider,
  TooltipWithContent,
} from '@vitnode/core/components/ui/tooltip'
import {
  HeartIcon,
  MessageSquareIcon,
  RepeatIcon,
  ShareIcon,
} from 'lucide-react'

const actions = [
  { icon: HeartIcon, label: 'Like' },
  { icon: MessageSquareIcon, label: 'Reply' },
  { icon: RepeatIcon, label: 'Repost' },
  { icon: ShareIcon, label: 'Share' },
]

const Row = ({ caption }: { caption: string }) => (
  <figure className="flex flex-col items-center gap-2">
    <div className="bg-card flex items-center gap-1 rounded-lg border p-1">
      {actions.map(({ icon: Icon, label }) => (
        <TooltipWithContent key={label} text={label}>
          <Button aria-label={label} size="icon-sm" variant="ghost">
            <Icon />
          </Button>
        </TooltipWithContent>
      ))}
    </div>
    <figcaption className="text-muted-foreground font-mono text-xs">
      {caption}
    </figcaption>
  </figure>
)

export default function TooltipDelayDemo() {
  return (
    <div className="not-prose flex flex-col items-center gap-6 sm:flex-row">
      <Row caption="default: 500ms, then warm" />
      <TooltipProvider delay={0}>
        <Row caption="delay={0}" />
      </TooltipProvider>
    </div>
  )
}
