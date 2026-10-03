import { Button } from '@vitnode/core/components/ui/button'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { Input } from '@vitnode/core/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@vitnode/core/components/ui/popover'
import { Share2Icon } from 'lucide-react'

const inviteLink = 'https://community.example.com/invite/7Hq2x'

export default function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline">
            <Share2Icon />
            Invite
          </Button>
        }
      />
      <PopoverContent>
        <PopoverHeader>
          <PopoverTitle>Invite friends</PopoverTitle>
          <PopoverDescription>
            The link works for 7 days and up to 10 sign-ups.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex items-center gap-2">
          <Input aria-label="Invite link" readOnly value={inviteLink} />
          <CopyButton aria-label="Copy invite link" content={inviteLink} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
