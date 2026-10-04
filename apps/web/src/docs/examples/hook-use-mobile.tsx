import { Badge } from '@vitnode/core/components/ui/badge'
import { useIsMobile } from '@vitnode/core/hooks/use-mobile'
import { MonitorIcon, SmartphoneIcon } from 'lucide-react'

export default function HookUseMobileDemo() {
  const isMobile = useIsMobile()
  const Icon = isMobile ? SmartphoneIcon : MonitorIcon

  return (
    <div className="not-prose flex w-full flex-col items-center gap-4 text-center">
      <div className="bg-muted text-foreground flex size-16 items-center justify-center rounded-full">
        <Icon aria-hidden className="size-8" />
      </div>
      <div className="flex items-center gap-2">
        <code className="text-sm">useIsMobile()</code>
        <Badge variant={isMobile ? 'default' : 'secondary'}>
          {String(isMobile)}
        </Badge>
      </div>
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm leading-relaxed text-balance"
      >
        {isMobile
          ? 'Post actions open in a drawer.'
          : 'Post actions open in a dropdown. Narrow the window below 768px.'}
      </p>
    </div>
  )
}
