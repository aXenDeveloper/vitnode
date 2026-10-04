import { Button } from '@vitnode/core/components/ui/button'
import { cn } from 'cn'
import { BellIcon } from 'lucide-react'
import React from 'react'

type Phase = 'closed' | 'idle' | 'open'

const Lane = ({
  children,
  label,
  verdict,
}: {
  children: React.ReactNode
  label: string
  verdict: string
}) => (
  <figure className="flex flex-col gap-2">
    <figcaption className="flex items-center justify-between gap-2 text-xs">
      <code className="font-mono font-medium">{label}</code>
      <span className="text-muted-foreground">{verdict}</span>
    </figcaption>
    <div className="bg-muted/50 h-14 overflow-hidden rounded-lg border p-1">
      {children}
    </div>
  </figure>
)

const Panel = ({ className }: { className: string }) => (
  <div
    className={cn(
      'bg-card text-card-foreground flex h-full items-center gap-2 rounded-md border px-3 text-sm shadow-xs',
      className,
    )}
  >
    <BellIcon aria-hidden className="text-primary size-4" />3 new replies
  </div>
)

const keyframeClassName: Record<Phase, string> = {
  closed: 'animate-out fade-out slide-out-to-start fill-mode-forwards',
  idle: 'invisible',
  open: 'animate-in fade-in slide-in-from-start',
}

export default function MotionInterruptible() {
  const [phase, setPhase] = React.useState<Phase>('idle')
  const isOpen = phase === 'open'

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <Lane label="transition" verdict="Reverses mid-flight">
        <Panel
          className={cn(
            'ease-fluid transition-[translate,opacity] duration-700 motion-reduce:duration-0',
            !isOpen && '-translate-x-full opacity-0 rtl:translate-x-full',
          )}
        />
      </Lane>
      <Lane label="@keyframes" verdict="Snaps, then restarts">
        <Panel
          className={cn(
            'ease-fluid duration-700 motion-reduce:duration-0',
            keyframeClassName[phase],
          )}
        />
      </Lane>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={() => setPhase(isOpen ? 'closed' : 'open')}
          size="sm"
          variant="outline"
        >
          {isOpen ? 'Close' : 'Open'}
        </Button>
        <span className="text-muted-foreground text-xs">
          Click twice, fast. Slowed to 700ms.
        </span>
      </div>
    </div>
  )
}
