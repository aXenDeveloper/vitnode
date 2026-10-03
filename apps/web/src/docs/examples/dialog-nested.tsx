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
import { Avatar, AvatarFallback } from '@vitnode/core/components/ui/avatar'
import { Button } from '@vitnode/core/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@vitnode/core/components/ui/dialog'
import { ShieldIcon } from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

const initialModerators = [
  { id: 1, name: 'Maya Chen', role: 'Lead moderator' },
  { id: 2, name: 'Tom Becker', role: 'Moderator' },
  { id: 3, name: 'Aisha Khan', role: 'Moderator' },
]

export default function DialogNestedDemo() {
  const [moderators, setModerators] = React.useState(initialModerators)

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <ShieldIcon />
            Manage moderators
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Moderators</DialogTitle>
          <DialogDescription>
            People who can edit, move and delete posts in this category.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-3">
          {moderators.map((moderator) => (
            <li className="flex items-center gap-3" key={moderator.id}>
              <Avatar>
                <AvatarFallback>{moderator.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {moderator.name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {moderator.role}
                </span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button size="sm" variant="ghost">
                      Remove
                    </Button>
                  }
                />
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Remove {moderator.name}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      They keep their account, but lose moderator tools.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        setModerators((current) =>
                          current.filter(({ id }) => id !== moderator.id),
                        )
                        toast.success('Moderator removed', {
                          description: moderator.name,
                        })
                      }}
                      variant="destructive"
                    >
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </li>
          ))}
          {moderators.length === 0 && (
            <li className="text-muted-foreground text-sm">
              Nobody left. The trolls are celebrating.
            </li>
          )}
        </ul>
        <DialogFooter showCloseButton>
          <Button
            onClick={() => setModerators(initialModerators)}
            variant="ghost"
          >
            Reset list
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
