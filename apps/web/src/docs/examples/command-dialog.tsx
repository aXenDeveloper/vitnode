import { Button } from '@vitnode/core/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@vitnode/core/components/ui/command'
import { Kbd, KbdGroup } from '@vitnode/core/components/ui/kbd'
import {
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MoonIcon,
  SearchIcon,
  UserPlusIcon,
} from 'lucide-react'
import React from 'react'
import { toast } from 'sonner'

const subscribeToNothing = () => () => {}

const useIsApple = () =>
  React.useSyncExternalStore(
    subscribeToNothing,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => true,
  )

const actions = [
  {
    group: 'Navigation',
    items: [
      { label: 'Dashboard', icon: LayoutDashboardIcon },
      { label: 'Documentation', icon: FileTextIcon },
    ],
  },
  {
    group: 'Actions',
    items: [
      { label: 'Invite a teammate', icon: UserPlusIcon },
      { label: 'Toggle dark mode', icon: MoonIcon },
      { label: 'Sign out', icon: LogOutIcon },
    ],
  },
]

export default function CommandDialogExample() {
  const [open, setOpen] = React.useState(false)
  const isApple = useIsApple()

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'j') return
      if (!event.metaKey && !event.ctrlKey) return
      if (event.altKey || event.shiftKey || event.defaultPrevented) return

      event.preventDefault()
      setOpen((prev) => !prev)
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const runAction = (label: string) => {
    setOpen(false)
    toast(label, { description: 'Pretend something impressive just happened.' })
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        variant="outline"
      >
        <SearchIcon />
        Open command palette
      </Button>
      <p className="not-prose text-muted-foreground flex items-center gap-2 text-sm leading-relaxed">
        or press
        <KbdGroup>
          <Kbd>{isApple ? '⌘' : 'Ctrl'}</Kbd>
          <Kbd>J</Kbd>
        </KbdGroup>
      </p>

      <CommandDialog onOpenChange={setOpen} open={open}>
        <Command>
          <CommandInput placeholder="What do you need?" />
          <CommandList>
            <CommandEmpty>Nothing here. Try fewer letters?</CommandEmpty>
            {actions.map(({ group, items }, index) => (
              <React.Fragment key={group}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {items.map(({ label, icon: Icon }) => (
                    <CommandItem key={label} onSelect={() => runAction(label)}>
                      <Icon />
                      <span>{label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  )
}
