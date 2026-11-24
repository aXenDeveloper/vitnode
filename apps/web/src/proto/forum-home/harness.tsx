import type { ForumSearch } from '@vitnode/forum/pages/forum-links'

// Prototype harness - deleted after the decision. Picker per PICKER.md.
import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { FeedPendingSkeleton } from '@vitnode/core/tanstack/pending'
import React from 'react'

import { Baseline } from './baseline'
import { Cards } from './cards'
import { Density } from './density'
import { Focus } from './focus'
import { Rail } from './rail'

const VARIANTS = [
  { component: Baseline, name: 'Baseline' },
  { component: Rail, name: 'Rail' },
  { component: Cards, name: 'Cards' },
  { component: Density, name: 'Density' },
  { component: Focus, name: 'Focus' },
] as const

/** The feed URL inside the prototype, keeping the picked variant. */
const protoHref = (variant: number, search: ForumSearch) => {
  const params = new URLSearchParams({ v: String(variant + 1) })
  if (search.sort && search.sort !== 'hot') params.set('sort', search.sort)
  if (search.sort === 'top' && search.t) params.set('t', search.t)
  if (search.page && search.page > 1) params.set('page', String(search.page))

  return `/proto/forum-home?${params.toString()}`
}

const PICKER_CSS = `
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}
.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}
.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}
.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}
.proto-picker-item:hover { color: rgba(255, 255, 255, 0.85); }
.proto-picker-item:active { transform: scale(0.97); }
.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}
.proto-picker-item[data-active] { color: #fff; }
.proto-picker[data-position="top"] {
  bottom: auto;
  top: 24px;
}
`

const Picker = ({
  current,
  onSelect,
}: {
  current: number
  onSelect: (index: number) => void
}) => {
  const navRef = React.useRef<HTMLElement>(null)
  const highlightRef = React.useRef<HTMLSpanElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  React.useLayoutEffect(() => {
    const move = () => {
      const item = itemRefs.current[current]
      const highlight = highlightRef.current
      if (!item || !highlight) return
      highlight.style.width = `${item.offsetWidth}px`
      highlight.style.transform = `translateX(${item.offsetLeft}px)`
    }
    move()
    window.addEventListener('resize', move)

    return () => {
      window.removeEventListener('resize', move)
    }
  }, [current])

  React.useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        navRef.current?.setAttribute('data-ready', '')
      }),
    )

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    // The app's bottom bar sits at the bottom center on phones.
    <nav
      aria-label="Prototype variants"
      className="proto-picker"
      data-position="top"
      ref={navRef}
    >
      <span
        aria-hidden="true"
        className="proto-picker-highlight"
        ref={highlightRef}
      />
      {VARIANTS.map((variant, index) => (
        <button
          aria-current={index === current ? 'true' : undefined}
          className="proto-picker-item"
          data-active={index === current ? '' : undefined}
          key={variant.name}
          onClick={() => {
            onSelect(index)
          }}
          ref={(element) => {
            itemRefs.current[index] = element
          }}
          type="button"
        >
          {variant.name}
        </button>
      ))}
    </nav>
  )
}

export const ForumHomeProto = ({
  initial,
  search,
}: {
  initial: number
  search: ForumSearch
}) => {
  const [current, setCurrent] = React.useState(
    initial >= 0 && initial < VARIANTS.length ? initial : 0,
  )

  const select = React.useCallback((index: number) => {
    if (index < 0 || index >= VARIANTS.length) return
    setCurrent(index)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(index + 1))
    window.history.replaceState(window.history.state, '', url)
  }, [])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (
        /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
        target.isContentEditable
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= VARIANTS.length) select(number - 1)
      else if (event.key === 'ArrowRight') {
        select((current + 1) % VARIANTS.length)
      } else if (event.key === 'ArrowLeft') {
        select((current - 1 + VARIANTS.length) % VARIANTS.length)
      }
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [current, select])

  const Variant = VARIANTS[current].component

  return (
    <>
      <style>{PICKER_CSS}</style>
      <RouteMessages
        namespaces={['core.global', '@vitnode/forum.forums', 'core.reactions']}
      >
        <React.Suspense fallback={<FeedPendingSkeleton />}>
          <Variant
            hrefFor={(next) => protoHref(current, next)}
            key={current}
            search={search}
          />
        </React.Suspense>
      </RouteMessages>
      <Picker current={current} onSelect={select} />
    </>
  )
}
