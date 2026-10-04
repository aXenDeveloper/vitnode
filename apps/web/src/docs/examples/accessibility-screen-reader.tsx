import { Badge } from '@vitnode/core/components/ui/badge'
import { Button } from '@vitnode/core/components/ui/button'
import { Toggle } from '@vitnode/core/components/ui/toggle'
import { BellIcon, BellOffIcon, Trash2Icon, Volume2Icon } from 'lucide-react'
import React from 'react'

const IMPLICIT_ROLES: Record<string, string> = {
  A: 'link',
  BUTTON: 'button',
}

const accessibleName = (element: Element): string => {
  const label = element.getAttribute('aria-label')
  if (label) return label

  return [...element.childNodes]
    .map((node) => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
      if (
        node instanceof Element &&
        node.getAttribute('aria-hidden') !== 'true'
      ) {
        return accessibleName(node)
      }

      return ''
    })
    .join('')
}

const describe = (element: Element | null) => {
  if (!element) return ''
  const pressed = element.getAttribute('aria-pressed')
  const role =
    element.getAttribute('role') ??
    (pressed === null ? IMPLICIT_ROLES[element.tagName] : 'toggle button') ??
    'group'
  const name = accessibleName(element).replaceAll(/\s+/g, ' ').trim()
  const state =
    pressed === null ? '' : pressed === 'true' ? ', pressed' : ', not pressed'

  return `${role}, ${name}${state}`
}

const Row = ({
  children,
  label,
}: {
  children: React.ReactNode
  label: string
}) => {
  const [spoken, setSpoken] = React.useState('')

  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const update = () => setSpoken(describe(node.firstElementChild))
    const frame = requestAnimationFrame(update)
    const observer = new MutationObserver(update)
    observer.observe(node, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <li className="grid grid-cols-1 items-center gap-2 border-b py-3 last:border-b-0 sm:grid-cols-2 sm:gap-4">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground w-24 shrink-0 text-xs">
          {label}
        </span>
        <div className="flex min-w-0" ref={ref}>
          {children}
        </div>
      </div>
      <p className="text-muted-foreground flex min-w-0 items-start gap-2 text-sm leading-relaxed">
        <Volume2Icon aria-hidden className="mt-1 size-4 shrink-0" />
        <span className="text-foreground font-mono text-xs leading-relaxed text-pretty">
          “{spoken}”
        </span>
      </p>
    </li>
  )
}

export default function AccessibilityScreenReader() {
  const [unread, setUnread] = React.useState(3)
  const [isMuted, setIsMuted] = React.useState(false)

  return (
    <div className="not-prose flex w-full flex-col gap-2">
      <div className="text-muted-foreground hidden grid-cols-2 gap-4 text-xs font-medium sm:grid">
        <span>What you see</span>
        <span>What a screen reader hears</span>
      </div>
      <ul className="flex flex-col">
        <Row label="Icon only">
          <Button aria-label="Delete post" size="icon" variant="outline">
            <Trash2Icon />
          </Button>
        </Row>
        <Row label="Count badge">
          <Button
            onClick={() => setUnread((count) => (count === 0 ? 3 : 0))}
            variant="outline"
          >
            <BellIcon />
            Inbox{' '}
            <Badge variant={unread === 0 ? 'secondary' : 'default'}>
              {unread}
              <span className="sr-only"> unread</span>
            </Badge>
          </Button>
        </Row>
        <Row label="Toggle">
          <Toggle
            aria-label="Mute notifications"
            onPressedChange={setIsMuted}
            pressed={isMuted}
            variant="outline"
          >
            {isMuted ? <BellOffIcon /> : <BellIcon />}
          </Toggle>
        </Row>
        <Row label="Vague link">
          <a
            className="text-primary text-sm font-medium underline underline-offset-4"
            href="/docs/ui/kbd"
          >
            Read more
            <span className="sr-only"> about keyboard shortcuts</span>
          </a>
        </Row>
      </ul>
    </div>
  )
}
