import { PageTitle } from '@vitnode/core/components/ui/page-title'
import { RouteMessages } from '@vitnode/core/tanstack/i18n'
import { SETTINGS_NAMESPACES, SETTINGS_NAV_ITEMS } from '@vitnode/core/tanstack/settings'
import { SettingsNavContent } from '@vitnode/core/views/auth/settings/nav-content'
import { SETTINGS_ROW, SETTINGS_ROW_LABEL, SettingsGroup } from '@vitnode/core/views/auth/settings/settings-group'
import React from 'react'

import { Breakdown } from './breakdown'
import { Current } from './current'
import { DailyLimits } from './daily-limits'
import { type ProtoUsage, SCENARIOS, type ScenarioKey } from './data'
import { Stats } from './stats'
import { Statement } from './statement'

const VARIANTS: { Component: React.ComponentType<{ usage: ProtoUsage }>; name: string }[] = [
  { Component: Current, name: 'Current' },
  { Component: Breakdown, name: 'Breakdown' },
  { Component: DailyLimits, name: 'Daily limits' },
  { Component: Stats, name: 'Stats' },
  { Component: Statement, name: 'Statement' },
]

const PICKER_CSS = `
.proto-picker{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:rgba(10,10,10,.82);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 8px 24px rgba(0,0,0,.24),0 2px 6px rgba(0,0,0,.12);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:13px;line-height:1;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none}
.proto-picker-highlight{position:absolute;top:4px;left:0;height:28px;border-radius:999px;background:rgba(255,255,255,.12);will-change:transform}
.proto-picker[data-ready] .proto-picker-highlight{transition:transform 250ms cubic-bezier(.23,1,.32,1),width 250ms cubic-bezier(.23,1,.32,1)}
@media (prefers-reduced-motion:reduce){.proto-picker[data-ready] .proto-picker-highlight{transition:none}}
.proto-picker-item{position:relative;display:flex;align-items:center;height:28px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.55);font:inherit;cursor:pointer;transition:color 150ms ease-out}
.proto-picker-item:hover{color:rgba(255,255,255,.85)}
.proto-picker-item:active{transform:scale(.97)}
.proto-picker-item:focus-visible{outline:2px solid rgba(255,255,255,.4);outline-offset:2px}
.proto-picker-item[data-active]{color:#fff}
.proto-scenario{position:fixed;top:88px;right:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:4px 4px 4px 12px;border-radius:999px;background:rgba(10,10,10,.82);color:rgba(255,255,255,.55);font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.proto-scenario select{height:28px;border:0;border-radius:999px;padding:0 8px;background:rgba(255,255,255,.12);color:#fff;font:inherit}
`

const readParam = (key: string) =>
  typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get(key)

const writeParam = (key: string, value: string) => {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}

const Picker = ({ active, onChange }: { active: number; onChange: (index: number) => void }) => {
  const navRef = React.useRef<HTMLElement>(null)
  const highlightRef = React.useRef<HTMLSpanElement>(null)
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [ready, setReady] = React.useState(false)

  React.useLayoutEffect(() => {
    const move = () => {
      const item = itemRefs.current[active]
      const highlight = highlightRef.current
      if (!item || !highlight) return
      highlight.style.width = `${item.offsetWidth}px`
      highlight.style.transform = `translateX(${item.offsetLeft}px)`
    }
    move()
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [active])

  React.useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))
    return () => cancelAnimationFrame(frame)
  }, [])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const num = Number.parseInt(event.key, 10)
      if (num >= 1 && num <= VARIANTS.length) onChange(num - 1)
      else if (event.key === 'ArrowRight') onChange((active + 1) % VARIANTS.length)
      else if (event.key === 'ArrowLeft') onChange((active - 1 + VARIANTS.length) % VARIANTS.length)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active, onChange])

  return (
    <nav aria-label="Prototype variants" className="proto-picker" data-ready={ready ? '' : undefined} ref={navRef}>
      <span aria-hidden="true" className="proto-picker-highlight" ref={highlightRef} />
      {VARIANTS.map((variant, index) => (
        <button
          aria-current={index === active ? 'true' : undefined}
          className="proto-picker-item"
          data-active={index === active ? '' : undefined}
          key={variant.name}
          onClick={() => onChange(index)}
          ref={element => {
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

const ContextGroups = () => (
  <SettingsGroup title="Account">
    <li className={SETTINGS_ROW}>
      <span className={SETTINGS_ROW_LABEL}>Nickname</span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-end text-sm">Maximilian Wojciechowski-Hartmann</span>
    </li>
    <li className={SETTINGS_ROW}>
      <span className={SETTINGS_ROW_LABEL}>Email</span>
      <span className="text-muted-foreground min-w-0 flex-1 text-end text-sm wrap-anywhere">
        maximilian.wojciechowski-hartmann@example.com
      </span>
    </li>
    <li className={SETTINGS_ROW}>
      <span className={SETTINGS_ROW_LABEL}>Role</span>
      <span className="min-w-0 flex-1 text-end text-sm text-primary font-medium">Administrator</span>
    </li>
  </SettingsGroup>
)

export const AiUnlimitedProto = () => {
  const [active, setActive] = React.useState(0)
  const [scenario, setScenario] = React.useState<ScenarioKey>('heavy')

  React.useEffect(() => {
    const v = Number.parseInt(readParam('v') ?? '1', 10)
    if (v >= 1 && v <= VARIANTS.length) setActive(v - 1)
    const s = readParam('s')
    if (s && s in SCENARIOS) setScenario(s as ScenarioKey)
  }, [])

  const change = React.useCallback((index: number) => {
    setActive(index)
    writeParam('v', String(index + 1))
  }, [])

  const { Component } = VARIANTS[active]

  return (
    <RouteMessages namespaces={SETTINGS_NAMESPACES}>
      <style>{PICKER_CSS}</style>
      <div className="container mx-auto flex flex-col gap-6 px-4 pb-32">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-10">
          <aside className="md:sticky md:top-24 md:w-64 md:shrink-0">
            <SettingsNavContent items={SETTINGS_NAV_ITEMS} pathname="/settings" />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <PageTitle className="mb-0" desc="Your profile and account details." h1="Overview" subtitle="Settings" />
            <ContextGroups />
            <Component key={`${active}-${scenario}`} usage={SCENARIOS[scenario].usage} />
          </div>
        </div>
      </div>
      <label className="proto-scenario">
        Data
        <select
          onChange={event => {
            setScenario(event.target.value as ScenarioKey)
            writeParam('s', event.target.value)
          }}
          value={scenario}
        >
          {Object.entries(SCENARIOS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </label>
      <Picker active={active} onChange={change} />
    </RouteMessages>
  )
}
