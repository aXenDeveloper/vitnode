import { cn } from 'cn'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  PanelLeft,
  Plus,
  RotateCw,
  Share,
} from 'lucide-react'

import type { Screen } from './screens'

import { ScreenShot } from './screen-frame'

const TRAFFIC_LIGHTS = [
  'bg-red-400 ring-red-500/40',
  'bg-amber-400 ring-amber-500/40',
  'bg-emerald-400 ring-emerald-500/40',
]

const ToolbarIcon = ({ Icon }: { Icon: React.ElementType }) => (
  <Icon className="text-muted-foreground/70 size-4" strokeWidth={1.75} />
)

export const SafariFrame = ({
  className,
  priority = false,
  screen,
}: {
  className?: string
  priority?: boolean
  screen: Screen
}) => (
  <div
    className={cn(
      'bg-card relative min-w-0 overflow-hidden rounded-2xl border shadow-xl sm:rounded-3xl',
      className,
    )}
  >
    <div className="bg-muted/70 flex items-center gap-3 border-b px-3 py-2.5 sm:px-4">
      <div aria-hidden className="flex flex-1 items-center gap-4">
        <span className="flex gap-1.5">
          {TRAFFIC_LIGHTS.map((light) => (
            <span
              className={cn('size-3 rounded-full ring-1 ring-inset', light)}
              key={light}
            />
          ))}
        </span>
        <span className="flex items-center gap-3 max-sm:hidden">
          <ToolbarIcon Icon={PanelLeft} />
          <span className="flex items-center gap-1">
            <ToolbarIcon Icon={ChevronLeft} />
            <ToolbarIcon Icon={ChevronRight} />
          </span>
        </span>
      </div>

      <div className="bg-background/80 text-muted-foreground flex h-8 w-full max-w-md min-w-0 items-center gap-2 rounded-lg px-3 shadow-xs">
        <Lock aria-hidden className="size-3 shrink-0" strokeWidth={2.25} />
        <span className="min-w-0 flex-1 truncate text-center font-mono text-xs">
          {screen.url}
        </span>
        <RotateCw
          aria-hidden
          className="size-3 shrink-0 max-sm:hidden"
          strokeWidth={2.25}
        />
      </div>

      <div
        aria-hidden
        className="flex flex-1 items-center justify-end gap-4 max-sm:hidden"
      >
        <ToolbarIcon Icon={Share} />
        <ToolbarIcon Icon={Plus} />
        <ToolbarIcon Icon={Copy} />
      </div>
    </div>

    <ScreenShot priority={priority} screen={screen} />
  </div>
)
