import { Button } from '@vitnode/core/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@vitnode/core/components/ui/input-group'
import { Kbd, KbdGroup } from '@vitnode/core/components/ui/kbd'
import { TooltipWithContent } from '@vitnode/core/components/ui/tooltip'
import { SaveIcon, SearchIcon } from 'lucide-react'
import React from 'react'

const subscribeToNothing = () => () => {}

const useIsApple = () =>
  React.useSyncExternalStore(
    subscribeToNothing,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent),
    () => true,
  )

const modifierKeys = [
  { symbol: '⌘', name: 'Command' },
  { symbol: '⇧', name: 'Shift' },
  { symbol: '⌥', name: 'Option' },
  { symbol: '⌃', name: 'Control' },
]

const ModifierKey = () => {
  const isApple = useIsApple()

  if (isApple) {
    return (
      <Kbd>
        <span aria-hidden="true">⌘</span>
        <span className="sr-only">Command</span>
      </Kbd>
    )
  }

  return <Kbd>Ctrl</Kbd>
}

export default function KbdExample() {
  return (
    <div className="not-prose flex w-full max-w-sm flex-col items-center gap-6">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {modifierKeys.map(({ symbol, name }) => (
          <Kbd key={name} title={name}>
            <span aria-hidden="true">{symbol}</span>
            <span className="sr-only">{name}</span>
          </Kbd>
        ))}
        <Kbd>Esc</Kbd>
        <Kbd>Enter</Kbd>
      </div>

      <p className="text-muted-foreground flex flex-wrap items-center justify-center gap-2 text-sm leading-relaxed text-pretty">
        Open search with
        <KbdGroup>
          <ModifierKey />
          <Kbd>K</Kbd>
        </KbdGroup>
        or copy with
        <KbdGroup>
          <ModifierKey />
          <span aria-hidden="true">+</span>
          <Kbd>C</Kbd>
        </KbdGroup>
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="sm" variant="outline">
          Accept
          <Kbd>Enter</Kbd>
        </Button>
        <TooltipWithContent
          text={
            <>
              Save changes
              <KbdGroup>
                <ModifierKey />
                <Kbd>S</Kbd>
              </KbdGroup>
            </>
          }
        >
          <Button aria-label="Save" size="icon-sm" variant="outline">
            <SaveIcon />
          </Button>
        </TooltipWithContent>
      </div>

      <InputGroup>
        <InputGroupInput aria-label="Search" placeholder="Search..." />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <KbdGroup>
            <ModifierKey />
            <Kbd>K</Kbd>
          </KbdGroup>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
