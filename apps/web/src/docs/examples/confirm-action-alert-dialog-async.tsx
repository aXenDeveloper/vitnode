import { ConfirmActionAlertDialog } from '@vitnode/core/components/confirm-action/confirm-action-alert-dialog'
import { Button } from '@vitnode/core/components/ui/button'
import React from 'react'
import { toast } from 'sonner'

const wait = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export default function ConfirmActionAlertDialogAsyncExample() {
  const attemptsRef = React.useRef(0)

  return (
    <ConfirmActionAlertDialog
      description="The first try fails on purpose, so you can see the dialog stay open. The second one works."
      onSubmit={async ({ onClose }) => {
        await wait(1500)
        attemptsRef.current += 1

        if (attemptsRef.current % 2 === 1) {
          toast.error('Could not empty the trash', {
            description: 'The server took a coffee break. Try again.',
          })

          return
        }

        toast.success('Trash emptied', {
          description: '18 posts are gone for good.',
        })
        onClose()
      }}
      textSubmit="Empty trash"
      title="Empty the trash?"
    >
      <Button variant="outline">Empty trash</Button>
    </ConfirmActionAlertDialog>
  )
}
