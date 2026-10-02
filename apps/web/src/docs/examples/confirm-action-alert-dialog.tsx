import { ConfirmActionAlertDialog } from '@vitnode/core/components/confirm-action/confirm-action-alert-dialog'
import { Button } from '@vitnode/core/components/ui/button'
import { Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

export default function ConfirmActionAlertDialogExample() {
  return (
    <ConfirmActionAlertDialog
      icon={<Trash2Icon />}
      onSubmit={({ onClose }) => {
        toast.success('Category deleted successfully!', {
          description: 'The category has been removed from your list.',
        })
        onClose()
      }}
    >
      <Button variant="destructive">Delete Category</Button>
    </ConfirmActionAlertDialog>
  )
}
