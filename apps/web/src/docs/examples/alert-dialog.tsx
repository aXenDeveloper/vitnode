import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@vitnode/core/components/ui/alert-dialog'
import { Button } from '@vitnode/core/components/ui/button'

export default function AlertDialogExample() {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive">Delete thread</Button>}
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
          <AlertDialogDescription>
            All 42 replies go with it. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive">
            Delete thread
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
