import { Badge } from '@vitnode/core/components/ui/badge'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import { ChevronRightIcon } from 'lucide-react'
import React from 'react'

const MODES = {
  logical: {
    badge: 'ms-auto',
    chevron: 'ms-2 rtl:rotate-180',
    row: 'border-s-4 ps-3 pe-2',
  },
  physical: {
    badge: 'ml-auto',
    chevron: 'ml-2',
    row: 'border-l-4 pl-3 pr-2',
  },
} as const

type Mode = keyof typeof MODES

const isMode = (value: unknown): value is Mode =>
  value === 'logical' || value === 'physical'

const Row = ({ dir, mode }: { dir: 'ltr' | 'rtl'; mode: Mode }) => {
  const classes = MODES[mode]
  const isRtl = dir === 'rtl'

  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-muted-foreground font-mono text-xs">
        dir=&quot;{dir}&quot;
      </figcaption>
      <div
        className={`bg-card border-primary flex items-center gap-3 rounded-md border-y border-e py-2 ${classes.row}`}
        dir={dir}
        lang={isRtl ? 'ar' : 'en'}
      >
        <span
          aria-hidden
          className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {isRtl ? 'ل' : 'AL'}
        </span>
        <span className="min-w-0 truncate text-sm font-medium">
          {isRtl ? 'ليلى' : 'Ada Lovelace'}
        </span>
        <div className={`flex shrink-0 items-center ${classes.badge}`}>
          <Badge variant="secondary">{isRtl ? 'مشرف' : 'Admin'}</Badge>
          <ChevronRightIcon
            aria-hidden
            className={`text-muted-foreground size-4 ${classes.chevron}`}
          />
        </div>
      </div>
    </figure>
  )
}

export default function SpacingRtl() {
  const [mode, setMode] = React.useState<Mode>('logical')

  return (
    <div className="not-prose flex w-full flex-col gap-4">
      <ToggleGroup
        aria-label="Property type"
        onValueChange={(next) => {
          const picked: unknown = next[0]
          if (isMode(picked)) setMode(picked)
        }}
        size="sm"
        value={[mode]}
        variant="outline"
      >
        <ToggleGroupItem value="logical">ps- ms- border-s</ToggleGroupItem>
        <ToggleGroupItem value="physical">pl- ml- border-l</ToggleGroupItem>
      </ToggleGroup>
      <Row dir="ltr" mode={mode} />
      <Row dir="rtl" mode={mode} />
    </div>
  )
}
