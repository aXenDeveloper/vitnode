import { Button } from '@vitnode/core/components/ui/button'
import { LockIcon, SendIcon } from 'lucide-react'

export default function ButtonDisabled() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <Button disabled variant="outline">
        <SendIcon />
        No reason given
      </Button>
      <Button
        disabled
        disabledTooltip="You need the Publish permission"
        variant="outline"
      >
        <LockIcon />
        Publish
      </Button>
    </div>
  )
}
