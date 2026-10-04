import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import { Label } from '@vitnode/core/components/ui/label'
import { Switch } from '@vitnode/core/components/ui/switch'
import { cn } from 'cn'
import { CircleCheckIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import React from 'react'

export default function MotionReduced() {
  const prefersReducedMotion = useReducedMotion() === true
  const [isSimulated, setIsSimulated] = React.useState(false)
  const [isShown, setIsShown] = React.useState(true)
  const isReduced = isSimulated || prefersReducedMotion

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label>
          <Switch checked={isSimulated} onCheckedChange={setIsSimulated} />
          Simulate reduced motion
        </Label>
        <Badge variant="outline">
          {prefersReducedMotion ? 'Your OS: reduce' : 'Your OS: no preference'}
        </Badge>
      </div>
      <div className="bg-muted/50 flex h-36 items-end overflow-hidden rounded-lg border p-3">
        <div
          aria-hidden={!isShown}
          className={cn(
            'bg-popover text-popover-foreground ease-fluid flex w-full items-center gap-3 rounded-lg border p-3 shadow-md transition-[opacity,translate]',
            isShown ? 'duration-200' : 'opacity-0 duration-150',
            !isShown && !isReduced && 'translate-y-full',
          )}
          inert={!isShown}
        >
          <CircleCheckIcon
            aria-hidden
            className="text-success size-5 shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-medium">Draft saved</span>
            <span className="text-muted-foreground text-xs">
              {isReduced ? 'Crossfade only' : 'Slides back to its edge'}
            </span>
          </div>
        </div>
      </div>
      <Button
        className="self-start"
        onClick={() => setIsShown((value) => !value)}
        size="sm"
        variant="outline"
      >
        {isShown ? 'Hide toast' : 'Show toast'}
      </Button>
    </div>
  )
}
