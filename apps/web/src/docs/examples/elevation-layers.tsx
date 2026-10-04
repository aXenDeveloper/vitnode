import { buttonVariants } from '@vitnode/core/components/ui/button'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@vitnode/core/components/ui/toggle-group'
import React from 'react'

import { useCssVariables } from '../use-css-variables'

const LEVELS = [
  {
    id: 'page',
    label: 'Page',
    radius: '-',
    shadow: '-',
    surface: 'background',
  },
  {
    id: 'card',
    label: 'Card',
    radius: 'rounded-xl',
    shadow: 'shadow-xs + ring',
    surface: 'card',
  },
  {
    id: 'menu',
    label: 'Menu',
    radius: 'rounded-lg',
    shadow: 'shadow-lg + ring',
    surface: 'popover',
  },
  {
    id: 'dialog',
    label: 'Dialog',
    radius: 'rounded-xl',
    shadow: 'shadow-xl + scrim',
    surface: 'popover',
  },
] as const

type LevelId = (typeof LEVELS)[number]['id']

const SURFACE_NAMES = ['background', 'card', 'popover'] as const

const readLightness = (value: string | undefined) =>
  value?.match(/oklch\(\s*([\d.]+)/)?.[1] ?? '…'

const highlight = (active: boolean) =>
  active ? 'outline-primary outline-2 outline-offset-2' : ''

export default function ElevationLayers() {
  const [active, setActive] = React.useState<LevelId>('card')
  const surfaces = useCssVariables(SURFACE_NAMES)
  const current = LEVELS.find((level) => level.id === active) ?? LEVELS[0]

  return (
    <div className="flex w-full flex-col gap-4">
      <ToggleGroup
        aria-label="Elevation level"
        className="w-full sm:w-fit"
        onValueChange={(next) => {
          const picked = LEVELS.find((level) => level.id === next[0])
          if (picked) setActive(picked.id)
        }}
        value={[active]}
        variant="outline"
      >
        {LEVELS.map((level) => (
          <ToggleGroupItem className="flex-1" key={level.id} value={level.id}>
            {level.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          className={`bg-background text-foreground flex flex-col gap-3 rounded-lg border p-3 transition-[outline-color] ${highlight(active === 'page')}`}
        >
          <div
            className={`bg-card text-card-foreground ring-foreground/10 flex flex-col gap-3 rounded-xl p-3 shadow-xs ring-1 ${highlight(active === 'card')}`}
          >
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Release notes</span>
              <span className="text-muted-foreground text-xs">
                Updated 2 hours ago
              </span>
            </div>
            <div
              className={`bg-popover text-popover-foreground ring-foreground/10 flex w-36 flex-col self-end rounded-lg p-1 shadow-lg ring-1 ${highlight(active === 'menu')}`}
            >
              <span className="bg-accent text-accent-foreground rounded-sm px-2 py-1.5 text-sm">
                Edit
              </span>
              <span className="rounded-sm px-2 py-1.5 text-sm">Duplicate</span>
            </div>
          </div>
        </div>

        <div className="bg-background flex rounded-lg border p-3">
          <div className="flex flex-1 items-center justify-center rounded-md bg-black/30 p-4 dark:bg-black/60">
            <div
              className={`bg-popover text-popover-foreground flex w-full max-w-56 flex-col gap-3 rounded-xl border p-4 shadow-xl ${highlight(active === 'dialog')}`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">Delete post?</span>
                <span className="text-muted-foreground text-xs">
                  This can&apos;t be undone.
                </span>
              </div>
              <div className="flex justify-end gap-2">
                <span
                  className={buttonVariants({ size: 'sm', variant: 'outline' })}
                >
                  Cancel
                </span>
                <span
                  className={buttonVariants({
                    size: 'sm',
                    variant: 'destructive',
                  })}
                >
                  Delete
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <dl
        aria-live="polite"
        className="bg-card m-0! grid grid-cols-3 gap-2 rounded-lg border p-3 font-mono text-xs"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground m-0! font-sans">Surface</dt>
          <dd className="m-0! ps-0! wrap-anywhere">
            bg-{current.surface}
            <span className="text-muted-foreground block tabular-nums">
              L {readLightness(surfaces[current.surface])}
            </span>
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground m-0! font-sans">Radius</dt>
          <dd className="m-0! ps-0! wrap-anywhere">{current.radius}</dd>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="text-muted-foreground m-0! font-sans">Shadow</dt>
          <dd className="m-0! ps-0! text-pretty">{current.shadow}</dd>
        </div>
      </dl>
    </div>
  )
}
