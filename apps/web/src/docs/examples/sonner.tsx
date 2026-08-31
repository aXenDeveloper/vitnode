'use client'

import { Button } from '@vitnode/core/components/ui/button'
import { toast } from 'sonner'

export default function SonnerDemo() {
  return (
    <Button
      onClick={() =>
        toast('Event has been created', {
          description: 'Sunday, December 03, 2023 at 9:00 AM',
          action: {
            label: 'Undo',
            // eslint-disable-next-line no-console
            onClick: () => console.log('Undo'),
          },
        })
      }
      variant="outline"
    >
      Show Toast
    </Button>
  )
}
