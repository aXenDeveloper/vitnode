import { ConfirmActionAlertDialog } from '@vitnode/core/components/confirm-action/confirm-action-alert-dialog'
import { Button } from '@vitnode/core/components/ui/button'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

export default function ConfirmActionAlertDialogExample() {
  return (
    <ConfirmActionAlertDialog
      description="Its 12 threads move to Uncategorized."
      icon={<Trash2Icon />}
      onSubmit={({ onClose }) => {
        toast.success('Category deleted', {
          description: 'General discussion is gone.',
        })
        onClose()
      }}
      textSubmit="Delete"
      title="Delete General discussion?"
    >
      <Button variant="destructive">Delete category</Button>
    </ConfirmActionAlertDialog>
  )
}
