import { Badge } from '@vitnode/core/components/ui/badge'
import { useIntersectionObserver } from '@vitnode/core/hooks/use-intersection-observer'
import { cn } from 'cn'
import { ArrowDownIcon, PartyPopperIcon } from 'lucide-react'
import React from 'react'

const THREADS = [
  'Welcome to the community!',
  'How do I reset my password?',
  'Dark mode looks great',
  'Plugin ideas for 2026',
  'Weekly showcase thread',
  'Server moved to a new host',
]

export default function HookUseIntersectionObserverDemo() {
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  const [target, setTarget] = React.useState<HTMLDivElement | null>(null)
  const entry = useIntersectionObserver(target, { root, threshold: 0.6 })
  const isVisible = entry?.isIntersecting === true

  return (
    <div className="not-prose flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Latest threads</span>
        <Badge aria-live="polite" variant={isVisible ? 'success' : 'outline'}>
          {isVisible ? 'Caught up' : 'Scroll down'}
        </Badge>
      </div>
      <div
        aria-label="Latest threads"
        className="bg-card flex h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-3"
        ref={setRoot}
        role="region"
        tabIndex={0}
      >
        {THREADS.map((thread) => (
          <div
            className="bg-muted/60 text-foreground rounded-md px-3 py-2 text-sm"
            key={thread}
          >
            {thread}
          </div>
        ))}
        <div
          className={cn(
            'ease-fluid flex items-center gap-2 rounded-md border border-dashed px-3 py-4 text-sm transition-opacity duration-300 motion-reduce:transition-none',
            isVisible ? 'opacity-100' : 'opacity-40',
          )}
          ref={setTarget}
        >
          {isVisible ? (
            <PartyPopperIcon aria-hidden className="text-success size-4" />
          ) : (
            <ArrowDownIcon aria-hidden className="size-4" />
          )}
          You have read everything. Go touch some grass.
        </div>
      </div>
    </div>
  )
}
