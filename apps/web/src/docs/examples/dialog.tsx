import { Button } from '@vitnode/core/components/ui/button'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@vitnode/core/components/ui/dialog'
import { Input } from '@vitnode/core/components/ui/input'
import { Share2Icon } from 'lucide-react'

const shareLink = 'https://vitnode.com/docs/ui/dialog'

export default function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Share2Icon />
            Share
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share this page</DialogTitle>
          <DialogDescription>
            Anyone with the link can read it - no account needed. Spread the
            word!
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Page link"
            className="flex-1"
            readOnly
            value={shareLink}
          />
          <CopyButton aria-label="Copy link" content={shareLink} />
        </div>
        <DialogFooter>
          <DialogClose render={<Button>Done</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
