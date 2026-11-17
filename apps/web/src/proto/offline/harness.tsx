import type { RichTextDocument } from '@vitnode/core/components/rich-text'

import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import React from 'react'

import type { Scenario } from './data'

import { MESSAGE, opensAtFor, SCENARIOS } from './data'
import './picker.css'
import { CurrentVariant } from './v1-current'
import { EditorialVariant } from './v2-editorial'
import { ClockVariant } from './v3-clock'
import { NoticeVariant } from './v4-notice'

export interface VariantProps {
  message: RichTextDocument
  now: number
  opensAt: null | string
  showCountdown: boolean
}

const VARIANTS = [
  { Component: CurrentVariant, name: 'Current' },
  { Component: EditorialVariant, name: 'Editorial' },
  { Component: ClockVariant, name: 'Clock' },
  { Component: NoticeVariant, name: 'Notice' },
]

const readParam = (key: string) =>
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(key)

const writeParam = (key: string, value: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(null, '', url)
}

const Pill = ({
  active,
  items,
  label,
  onReplay,
  onSelect,
  position,
}: {
  active: number
  items: string[]
  label: string
  onReplay?: () => void
  onSelect: (index: number) => void
  position?: 'top'
}) => {
  const navRef = React.useRef<HTMLElement>(null)
  const highlightRef = React.useRef<HTMLSpanElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const moveHighlight = React.useCallback(() => {
    const el = itemRefs.current[active]
    const highlight = highlightRef.current
    if (!el || !highlight) return
    highlight.style.width = `${el.offsetWidth}px`
    highlight.style.transform = `translateX(${el.offsetLeft}px)`
  }, [active])

  React.useLayoutEffect(moveHighlight, [moveHighlight])

  React.useEffect(() => {
    window.addEventListener('resize', moveHighlight)
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        navRef.current?.setAttribute('data-ready', ''),
      ),
    )

    return () => {
      window.removeEventListener('resize', moveHighlight)
      cancelAnimationFrame(frame)
    }
  }, [moveHighlight])

  return (
    <nav
      aria-label={label}
      className="proto-picker"
      data-position={position}
      ref={navRef}
    >
      <span
        aria-hidden="true"
        className="proto-picker-highlight"
        ref={highlightRef}
      />
      {items.map((name, i) => (
        <button
          aria-current={i === active ? 'true' : undefined}
          className="proto-picker-item"
          data-active={i === active ? '' : undefined}
          key={name}
          onClick={() => onSelect(i)}
          ref={(el) => {
            itemRefs.current[i] = el
          }}
          type="button"
        >
          {name}
        </button>
      ))}
      {onReplay ? (
        <>
          <span aria-hidden="true" className="proto-picker-divider" />
          <button
            aria-label="Replay animation (R)"
            className="proto-picker-item proto-picker-replay"
            onClick={onReplay}
            type="button"
          >
            ↻
          </button>
        </>
      ) : null}
    </nav>
  )
}

export const OfflinePrototype = () => {
  const [variant, setVariant] = React.useState(() =>
    Math.min(
      VARIANTS.length - 1,
      Math.max(0, (Number(readParam('v')) || 1) - 1),
    ),
  )
  const [scenario, setScenario] = React.useState<Scenario>(() => {
    const s = readParam('s')

    return SCENARIOS.some((item) => item.id === s) ? (s as Scenario) : 'soon'
  })
  const [mountKey, setMountKey] = React.useState(0)
  const [now, setNow] = React.useState(() => Date.now())

  const selectVariant = React.useCallback((i: number) => {
    setVariant(i)
    setMountKey((k) => k + 1)
    writeParam('v', String(i + 1))
  }, [])

  const selectScenario = (i: number) => {
    const next = SCENARIOS[i].id
    setScenario(next)
    setNow(Date.now())
    writeParam('s', next)
  }

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
      if (num >= 1 && num <= VARIANTS.length) selectVariant(num - 1)
      else if (e.key === 'ArrowRight')
        selectVariant((variant + 1) % VARIANTS.length)
      else if (e.key === 'ArrowLeft')
        selectVariant((variant - 1 + VARIANTS.length) % VARIANTS.length)
      else if (e.key === 'r' || e.key === 'R') setMountKey((k) => k + 1)
    }
    document.addEventListener('keydown', onKey)

    return () => document.removeEventListener('keydown', onKey)
  }, [selectVariant, variant])

  const { Component } = VARIANTS[variant]

  return (
    <RouteMessages namespaces={['core.site_offline', 'core.global']}>
      <Component
        key={`${mountKey}-${scenario}`}
        message={MESSAGE}
        now={now}
        opensAt={opensAtFor(scenario, now)}
        showCountdown={scenario !== 'date'}
      />
      <Pill
        active={SCENARIOS.findIndex((item) => item.id === scenario)}
        items={SCENARIOS.map((item) => item.label)}
        label="Prototype scenarios"
        onSelect={selectScenario}
        position="top"
      />
      <Pill
        active={variant}
        items={VARIANTS.map((item) => item.name)}
        label="Prototype variants"
        onReplay={() => setMountKey((k) => k + 1)}
        onSelect={selectVariant}
      />
    </RouteMessages>
  )
}
