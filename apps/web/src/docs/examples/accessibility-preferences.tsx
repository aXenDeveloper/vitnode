import { Badge } from '@vitnode/core/components/ui/badge'
import React from 'react'

const PREFERENCES = [
  {
    query: '(prefers-reduced-motion: reduce)',
    label: 'Reduced motion',
    on: 'Animations shrink to a fade or stop.',
    off: 'Full motion, springs and all.',
    variant: 'motion-reduce:',
  },
  {
    query: '(prefers-reduced-transparency: reduce)',
    label: 'Reduced transparency',
    on: 'Blurred scrims turn solid.',
    off: 'Frosted glass behind dialogs.',
    variant: 'reduced-transparency:',
  },
  {
    query: '(pointer: coarse)',
    label: 'Coarse pointer',
    on: 'Icon buttons grow a 44px hit area.',
    off: 'Precise pointer, compact targets.',
    variant: 'pointer-coarse:',
  },
] as const

const subscribe = (onChange: () => void) => {
  const lists = PREFERENCES.map((preference) =>
    window.matchMedia(preference.query),
  )
  for (const list of lists) list.addEventListener('change', onChange)

  return () => {
    for (const list of lists) list.removeEventListener('change', onChange)
  }
}

const getSnapshot = () =>
  PREFERENCES.map((preference) =>
    window.matchMedia(preference.query).matches ? '1' : '0',
  ).join('')

const getServerSnapshot = () => ''

export default function AccessibilityPreferences() {
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  return (
    <ul className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
      {PREFERENCES.map((preference, index) => {
        const isOn = snapshot[index] === '1'

        return (
          <li
            className="bg-card flex flex-col gap-2 rounded-lg border p-4"
            key={preference.query}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{preference.label}</span>
              <Badge variant={isOn ? 'default' : 'secondary'}>
                {snapshot === '' ? '…' : isOn ? 'On' : 'Off'}
              </Badge>
            </div>
            <span className="text-muted-foreground text-sm leading-relaxed">
              {isOn ? preference.on : preference.off}
            </span>
            <code className="text-muted-foreground font-mono text-xs">
              {preference.variant}
            </code>
          </li>
        )
      })}
    </ul>
  )
}
