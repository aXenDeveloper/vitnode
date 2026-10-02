import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@vitnode/core/components/ui/context-menu'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  MousePointerClickIcon,
  RotateCwIcon,
  Trash2Icon,
} from 'lucide-react'
import React from 'react'

export default function ContextMenuExample() {
  const [showBookmarks, setShowBookmarks] = React.useState(true)
  const [showFullUrls, setShowFullUrls] = React.useState(false)
  const [person, setPerson] = React.useState('pedro')

  return (
    <ContextMenu>
      <ContextMenuTrigger className="border-muted-foreground/30 bg-muted/40 text-muted-foreground flex h-40 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center">
        <MousePointerClickIcon aria-hidden="true" className="size-6" />
        <span className="text-foreground text-sm font-medium text-balance">
          Right-click here
        </span>
        <span className="text-xs leading-relaxed text-pretty">
          On a touch device, long-press instead.
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuGroup>
          <ContextMenuItem>
            <ArrowLeftIcon />
            Back
            <ContextMenuShortcut>⌘[</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem disabled>
            <ArrowRightIcon />
            Forward
            <ContextMenuShortcut>⌘]</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <RotateCwIcon />
            Reload
            <ContextMenuShortcut>⌘R</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger inset>More tools</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem>
                Save page as...
                <ContextMenuShortcut>⇧⌘S</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem>Create shortcut...</ContextMenuItem>
              <ContextMenuItem>Name window...</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem>Developer tools</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuCheckboxItem
            checked={showBookmarks}
            inset
            onCheckedChange={setShowBookmarks}
          >
            Show bookmarks bar
          </ContextMenuCheckboxItem>
          <ContextMenuCheckboxItem
            checked={showFullUrls}
            inset
            onCheckedChange={setShowFullUrls}
          >
            Show full URLs
          </ContextMenuCheckboxItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuLabel inset>People</ContextMenuLabel>
        <ContextMenuRadioGroup onValueChange={setPerson} value={person}>
          <ContextMenuRadioItem inset value="pedro">
            Pedro Duarte
          </ContextMenuRadioItem>
          <ContextMenuRadioItem inset value="colm">
            Colm Tuite
          </ContextMenuRadioItem>
        </ContextMenuRadioGroup>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">
          <Trash2Icon />
          Delete
          <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
