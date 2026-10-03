import { Button } from '@vitnode/core/components/ui/button'
import { Label } from '@vitnode/core/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover'
import { Switch } from '@vitnode/core/components/ui/switch'
import { cn } from 'cn'
import { CheckIcon, XIcon } from 'lucide-react'
import React from 'react'

const SLOW_MOTION =
  'duration-500 data-ending-style:scale-50 data-ending-style:duration-300 data-starting-style:scale-50'

const Lane = ({
  className,
  good,
  isSlow,
  label,
  trigger,
}: {
  className?: string
  good: boolean
  isSlow: boolean
  label: string
  trigger: string
}) => (
  <figure className="bg-card flex flex-col items-center gap-3 rounded-lg border p-4">
    <span
      className={cn(
        'flex items-center gap-1 text-xs font-medium',
        good ? 'text-success' : 'text-destructive',
      )}
    >
      {good ? (
        <CheckIcon aria-hidden className="size-3.5" />
      ) : (
        <XIcon aria-hidden className="size-3.5" />
      )}
      {good ? 'Do' : "Don't"}
    </span>
    <Popover>
      <PopoverTrigger render={<Button variant="outline">{trigger}</Button>} />
      <PopoverContent
        align="start"
        className={cn('w-56', isSlow && SLOW_MOTION, className)}
      >
        <PopoverHeader>
          <PopoverTitle>Share draft</PopoverTitle>
          <PopoverDescription>
            {good
              ? 'Grew right out of the button you pressed.'
              : 'Appeared out of thin air. Spooky.'}
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
    <figcaption className="text-muted-foreground text-center font-mono text-xs break-all">
      {label}
    </figcaption>
  </figure>
)

export default function MotionOrigin() {
  const [isSlow, setIsSlow] = React.useState(true)

  return (
    <div className="not-prose flex w-full flex-col items-center gap-5">
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Lane
          good
          isSlow={isSlow}
          label="origin-(--transform-origin)"
          trigger="From trigger"
        />
        <Lane
          className="origin-center"
          good={false}
          isSlow={isSlow}
          label="origin-center"
          trigger="From center"
        />
      </div>
      <Label>
        <Switch checked={isSlow} onCheckedChange={setIsSlow} />
        Slow motion
      </Label>
    </div>
  )
}
