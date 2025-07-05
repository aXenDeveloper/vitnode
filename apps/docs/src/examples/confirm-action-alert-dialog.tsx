'use client';

import { ConfirmActionAlertDialog } from '@vitnode/core/components/confirm-action/confirm-action-alert-dialog';
import { Button } from '@vitnode/core/components/ui/button';
import { toast } from 'sonner';

export default function ConfirmActionAlertDialogExample() {
  return (
    <ConfirmActionAlertDialog
      onSubmit={({ onClose }) => {
        toast.success('Category deleted successfully!', {
          description: 'The category has been removed from your list.',
        });
        onClose();
      }}
    >
      <Button variant="destructive">Delete Category</Button>
    </ConfirmActionAlertDialog>
  );
}
