import { Button } from '@vitnode/core/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vitnode/core/components/ui/dropdown-menu'
import {
  EllipsisIcon,
  FlagIcon,
  LinkIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

export default function DropdownMenuActionsExample() {
  return (
    <article className="not-prose bg-card flex w-full max-w-sm items-start gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="text-sm font-medium text-balance">
          Welcome to the community!
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          Say hi, share what you&apos;re building and read the rules.
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button aria-label="Post actions" size="icon-sm" variant="ghost">
              <EllipsisIcon />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem>
            <PencilIcon />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem>
            <PinIcon />
            Pin to top
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.success('Link copied')}>
            <LinkIcon />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <FlagIcon />
            Report
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  )
}
