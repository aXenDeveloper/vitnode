import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@vitnode/core/components/ui/alert-dialog'
import { Button } from '@vitnode/core/components/ui/button'
import { LogOutIcon, UserXIcon } from 'lucide-react'

export default function AlertDialogMediaExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-3">
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="outline">
              <LogOutIcon />
              Sign out everywhere
            </Button>
          }
        />
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <LogOutIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              You stay signed in here. Everywhere else needs a fresh login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Sign out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="destructive">
              <UserXIcon />
              Ban member
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20">
              <UserXIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Ban Tom Becker?</AlertDialogTitle>
            <AlertDialogDescription>
              Tom can&apos;t post, reply or send messages until you lift the
              ban. Existing posts stay visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive">
              Ban member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
