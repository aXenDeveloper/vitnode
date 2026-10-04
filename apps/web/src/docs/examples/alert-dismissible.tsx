import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@vitnode/core/components/ui/alert'
import { Button } from '@vitnode/core/components/ui/button'
import { RotateCcwIcon, XIcon } from 'lucide-react'
import React from 'react'

export default function AlertDismissible() {
  const [isOpen, setIsOpen] = React.useState(true)

  if (!isOpen) {
    return (
      <div className="not-prose flex justify-center">
        <Button onClick={() => setIsOpen(true)} size="sm" variant="outline">
          <RotateCcwIcon />
          Bring it back
        </Button>
      </div>
    )
  }

  return (
    <Alert className="not-prose" variant="warning">
      <AlertTitle>Maintenance tonight at 22:00</AlertTitle>
      <AlertDescription>
        The forum goes read-only for about 15 minutes.
      </AlertDescription>
      <AlertAction>
        <Button
          aria-label="Dismiss"
          onClick={() => setIsOpen(false)}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  )
}
