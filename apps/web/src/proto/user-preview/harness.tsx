// Prototype harness - throwaway. Nothing outside src/proto imports this.
import './picker.css'

import { Link } from '@tanstack/react-router'
import { Avatar } from '@vitnode/core/components/avatar'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@vitnode/core/components/ui/hover-card'
import { UserFormat } from '@vitnode/core/components/user-format'
import { UserPreviewSkeleton } from '@vitnode/core/components/user-preview-skeleton'
import { userProfileHref } from '@vitnode/core/components/user-profile-href'
import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { MessageSquareIcon } from 'lucide-react'
import React from 'react'

import type { Variant } from './shared'

import { ambient } from './ambient'
import { centered } from './centered'
import { compact } from './compact'
import { current } from './current'
import { details } from './details'
import { glass } from './glass'
import { group } from './group'
import { idCard } from './id-card'
import { immersive } from './immersive'
import { playful } from './playful'
import { split } from './split'

const VARIANTS: Variant[] = [
  current,
  compact,
  immersive,
  centered,
  split,
  idCard,
  ambient,
  glass,
  group,
  details,
  playful,
]

interface Person {
  avatarColor: string
  name: string
  nameCode: string
  role: { color: null | string; prefix?: null | string }
}

const MAX: Person = {
  avatarColor: 'b45309',
  name: 'Maximilian Alexander von Hohenberg-Lichtenstein',
  nameCode: 'maximilian-von-hohenberg',
  role: { color: 'hsl(122, 80%, 45%)', prefix: 'icon:shield' },
}
const ANA: Person = {
  avatarColor: '0f766e',
  name: 'ana',
  nameCode: 'ana',
  role: { color: null },
}
const TESTER: Person = {
  avatarColor: '2563eb',
  name: 'tester',
  nameCode: 'tester',
  role: { color: 'hsl(0, 100%, 50%)', prefix: 'icon:crown' },
}
const GONE: Person = {
  avatarColor: '64748b',
  name: 'former-member',
  nameCode: 'former-member-renamed',
  role: { color: null },
}

const POSTS = [
  {
    author: MAX,
    body: 'Start with linear switches if you type a lot and game a little. Tactiles are lovely, but the bump gets tiring after a long session, and clicky ones will make you very unpopular in a shared office.',
    when: '2 hours ago',
  },
  {
    author: ANA,
    body: 'Hot-swap board first, then experiment. Cheapest way to find out what you like.',
    when: '1 hour ago',
  },
  {
    author: GONE,
    body: 'Lubing stabilisers made more difference than any switch I tried.',
    when: '45 minutes ago',
  },
  {
    author: TESTER,
    body: 'Pinned the switch tester thread at the top of the board - it has a comparison table.',
    when: '12 minutes ago',
  },
]

const PreviewTrigger = ({
  children,
  decorative,
  defaultOpen,
  nameCode,
  variant,
}: {
  children: React.ReactNode
  decorative?: boolean
  defaultOpen?: boolean
  nameCode: string
  variant: Variant
}) => {
  const [open, setOpen] = React.useState(defaultOpen ?? false)
  const Content = variant.Content

  return (
    <HoverCard onOpenChange={setOpen} open={open}>
      <HoverCardTrigger
        closeDelay={150}
        delay={400}
        render={
          <Link
            aria-hidden={decorative ? true : undefined}
            className="focus-visible:ring-ring/50 inline-flex min-w-0 rounded-sm outline-none focus-visible:ring-3"
            tabIndex={decorative ? -1 : undefined}
            to={userProfileHref(nameCode)}
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className={variant.contentClassName}
        side="bottom"
      >
        {open ? (
          <React.Suspense fallback={<UserPreviewSkeleton />}>
            <RouteMessages namespaces={['core.global', 'core.profile']}>
              <Content nameCode={nameCode} />
            </RouteMessages>
          </React.Suspense>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  )
}

const Thread = ({ variant }: { variant: Variant }) => (
  <main className="container mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-32 sm:p-8 sm:pb-32">
    <header className="flex flex-col gap-2">
      <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <MessageSquareIcon aria-hidden="true" className="size-4" />
        Hardware · Keyboards
      </p>
      <h1 className="text-foreground text-2xl font-semibold text-balance">
        Which switches for a first mechanical keyboard?
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Hover a name or an avatar. The first card opens on load.
      </p>
    </header>

    <ol className="bg-card divide-y rounded-xl border">
      {POSTS.map((post, index) => (
        <li className="flex gap-3 p-4" key={post.author.nameCode}>
          <PreviewTrigger
            decorative
            nameCode={post.author.nameCode}
            variant={variant}
          >
            <Avatar alt="" className="size-10" size={40} user={post.author} />
          </PreviewTrigger>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
              <PreviewTrigger
                defaultOpen={index === 0}
                nameCode={post.author.nameCode}
                variant={variant}
              >
                <UserFormat
                  className="hover:underline"
                  format
                  user={post.author}
                />
              </PreviewTrigger>
              <span className="text-muted-foreground">{post.when}</span>
            </p>
            <p className="text-sm leading-relaxed text-pretty">{post.body}</p>
          </div>
        </li>
      ))}
    </ol>
  </main>
)

const Picker = ({
  current: active,
  onReplay,
  onSelect,
}: {
  current: number
  onReplay: () => void
  onSelect: (index: number) => void
}) => {
  const navRef = React.useRef<HTMLElement>(null)
  const highlightRef = React.useRef<HTMLSpanElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useLayoutEffect(() => {
    const move = () => {
      const el = itemRefs.current[active]
      const highlight = highlightRef.current
      if (!el || !highlight) return
      highlight.style.width = `${el.offsetWidth}px`
      highlight.style.transform = `translateX(${el.offsetLeft}px)`
    }
    move()
    window.addEventListener('resize', move)

    return () => window.removeEventListener('resize', move)
  }, [active])

  React.useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        navRef.current?.setAttribute('data-ready', ''),
      ),
    )

    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <nav aria-label="Prototype variants" className="proto-picker" ref={navRef}>
      <span
        aria-hidden="true"
        className="proto-picker-highlight"
        ref={highlightRef}
      />
      {VARIANTS.map((variant, index) => (
        <button
          aria-current={index === active ? 'true' : undefined}
          className="proto-picker-item"
          data-active={index === active ? '' : undefined}
          key={variant.name}
          onClick={() => onSelect(index)}
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          type="button"
        >
          {variant.name}
        </button>
      ))}
      <span aria-hidden="true" className="proto-picker-divider" />
      <button
        aria-label="Replay animation (R)"
        className="proto-picker-item proto-picker-replay"
        onClick={onReplay}
        type="button"
      >
        ↻
      </button>
    </nav>
  )
}

export const UserPreviewPrototype = ({ initial }: { initial: number }) => {
  const [active, setActive] = React.useState(
    initial >= 0 && initial < VARIANTS.length ? initial : 0,
  )
  const [mountKey, setMountKey] = React.useState(0)

  const select = React.useCallback((index: number) => {
    if (index < 0 || index >= VARIANTS.length) return
    setActive(index)
    setMountKey((key) => key + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(window.history.state, '', url)
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      )
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const num = Number.parseInt(e.key, 10)
      if (num >= 1 && num <= VARIANTS.length) select(num - 1)
      else if (e.key === 'ArrowRight') select((active + 1) % VARIANTS.length)
      else if (e.key === 'ArrowLeft')
        select((active - 1 + VARIANTS.length) % VARIANTS.length)
      else if (e.key === 'r' || e.key === 'R') setMountKey((key) => key + 1)
    }
    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [active, select])

  const variant = VARIANTS[active] ?? current

  return (
    <>
      <Thread key={`${active}-${mountKey}`} variant={variant} />
      <Picker
        current={active}
        onReplay={() => setMountKey((key) => key + 1)}
        onSelect={select}
      />
    </>
  )
}
