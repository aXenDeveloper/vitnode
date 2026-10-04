import React from 'react'

const SCALE = [
  {
    className: 'text-6xl font-semibold',
    label: 'text-6xl',
    sample: 'Hi there',
  },
  { className: 'text-5xl font-semibold', label: 'text-5xl', sample: 'Welcome' },
  {
    className: 'text-4xl font-semibold',
    label: 'text-4xl',
    sample: 'Dashboard',
  },
  {
    className: 'text-3xl font-semibold',
    label: 'text-3xl',
    sample: 'Community',
  },
  {
    className: 'text-2xl font-semibold',
    label: 'text-2xl',
    sample: 'Settings',
  },
  {
    className: 'text-xl font-medium',
    label: 'text-xl',
    sample: 'Team members',
  },
  {
    className: 'text-lg font-medium',
    label: 'text-lg',
    sample: 'Notifications',
  },
  {
    className: 'text-base',
    label: 'text-base',
    sample: 'Your changes were saved.',
  },
  { className: 'text-sm', label: 'text-sm', sample: 'Show archived posts' },
  { className: 'text-xs', label: 'text-xs', sample: 'Updated 2 hours ago' },
] as const

const formatTracking = (letterSpacing: string, fontSize: number) => {
  const px = Number.parseFloat(letterSpacing)
  if (!Number.isFinite(px) || px === 0) return '0'
  const em = Math.round((px / fontSize) * 1000) / 1000

  return `${em > 0 ? '+' : ''}${em}em`
}

const measure = (node: HTMLElement) => {
  const styles = getComputedStyle(node)
  const fontSize = Number.parseFloat(styles.fontSize)

  return `${fontSize}px · ${formatTracking(styles.letterSpacing, fontSize)}`
}

const ScaleRow = ({ entry }: { entry: (typeof SCALE)[number] }) => {
  const [metrics, setMetrics] = React.useState('')

  const sampleRef = React.useCallback((node: HTMLSpanElement | null) => {
    if (node) setMetrics(measure(node))
  }, [])

  return (
    <li className="flex flex-col gap-1 border-b py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4">
      <div className="flex shrink-0 gap-2 font-mono text-xs sm:w-40 sm:flex-col sm:gap-0">
        <span>{entry.label}</span>
        <span className="text-muted-foreground tabular-nums">{metrics}</span>
      </div>
      <span className={`min-w-0 truncate ${entry.className}`} ref={sampleRef}>
        {entry.sample}
      </span>
    </li>
  )
}

export default function TypographyScale() {
  return (
    <ul className="not-prose flex w-full flex-col">
      {SCALE.map((entry) => (
        <ScaleRow entry={entry} key={entry.label} />
      ))}
    </ul>
  )
}
