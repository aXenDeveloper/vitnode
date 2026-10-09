import { Button } from '@vitnode/core/components/ui/button'
import { BellIcon } from 'lucide-react'
import React, { startTransition, ViewTransition } from 'react'

export default function ViewTransitionEnterExit() {
  const [isOpen, setIsOpen] = React.useState(true)

  return (
    <div className="not-prose flex w-full flex-col items-center gap-4">
      <div className="flex min-h-16 w-full items-center">
        {isOpen && (
          <ViewTransition enter="vt-slide-up" exit="vt-slide-down">
            <div className="bg-card text-card-foreground flex w-full items-center gap-3 rounded-lg border p-4 text-sm shadow-xs">
              <BellIcon aria-hidden className="text-primary size-4 shrink-0" />
              <p className="leading-relaxed text-pretty">
                3 new replies to your topic
              </p>
            </div>
          </ViewTransition>
        )}
      </div>
      <Button
        onClick={() => {
          startTransition(() => {
            setIsOpen((open) => !open)
          })
        }}
        variant="outline"
      >
        {isOpen ? 'Dismiss' : 'Show notification'}
      </Button>
    </div>
  )
}
