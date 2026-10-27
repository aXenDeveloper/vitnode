import { SharePopover } from '@vitnode/core/components/share-popover'
import { Button } from '@vitnode/core/components/ui/button'
import { Card } from '@vitnode/core/components/ui/card'
import { Share2Icon } from 'lucide-react'

export default function SharePopoverExample() {
  return (
    <Card className="not-prose flex w-full items-center justify-center p-8">
      <SharePopover
        description="Share Popover docs"
        title="Share Popover - VitNode"
        url="/docs/ui/share-popover"
      >
        <Button variant="outline">
          <Share2Icon aria-hidden="true" />
          Share
        </Button>
      </SharePopover>
    </Card>
  )
}
