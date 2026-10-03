import { Toggle } from '@vitnode/core/components/ui/toggle'
import { BellIcon, BellOffIcon } from 'lucide-react'
import React from 'react'

export default function ToggleDemo() {
  const [isWatching, setIsWatching] = React.useState(true)

  return (
    <div className="not-prose flex flex-col items-center gap-3">
      <Toggle
        onPressedChange={setIsWatching}
        pressed={isWatching}
        variant="outline"
      >
        {isWatching ? <BellIcon /> : <BellOffIcon />}
        {isWatching ? 'Watching thread' : 'Watch thread'}
      </Toggle>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {isWatching
          ? 'You will hear about every new reply.'
          : 'Replies will stay quiet.'}
      </p>
    </div>
  )
}
