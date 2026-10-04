import { Button } from '@vitnode/core/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@vitnode/core/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@vitnode/core/components/ui/dropdown-menu'
import {
  DownloadIcon,
  EllipsisIcon,
  FileTextIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

const files = [
  { name: 'forum-rules.pdf', size: '84 KB' },
  { name: 'event-banner.png', size: '1.2 MB' },
  { name: 'members-export.csv', size: '312 KB' },
]

const actions = [
  { icon: PencilIcon, label: 'Rename' },
  { icon: DownloadIcon, label: 'Download' },
]

const runAction = (label: string, name: string) =>
  toast(label, { description: name })

export default function ContextMenuFallbackExample() {
  return (
    <ul className="not-prose bg-card flex w-full max-w-sm flex-col rounded-xl border p-1">
      {files.map(({ name, size }) => (
        <li key={name}>
          <ContextMenu>
            <ContextMenuTrigger className="hover:bg-muted/60 flex items-center gap-3 rounded-lg p-2">
              <FileTextIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {size}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={`Actions for ${name}`}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <EllipsisIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-40">
                  {actions.map(({ icon: Icon, label }) => (
                    <DropdownMenuItem
                      key={label}
                      onClick={() => runAction(label, name)}
                    >
                      <Icon />
                      {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => runAction('Delete', name)}
                    variant="destructive"
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-40">
              {actions.map(({ icon: Icon, label }) => (
                <ContextMenuItem
                  key={label}
                  onClick={() => runAction(label, name)}
                >
                  <Icon />
                  {label}
                </ContextMenuItem>
              ))}
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={() => runAction('Delete', name)}
                variant="destructive"
              >
                <Trash2Icon />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </li>
      ))}
    </ul>
  )
}
