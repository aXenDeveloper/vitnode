import { cn } from '@vitnode/core/lib/utils'

import type { Screen } from './screens'

import { SCREEN_SIZE } from './screens'

export const ScreenFrame = ({
  className,
  note,
  screen,
}: {
  className?: string
  note?: string
  screen: Screen
}) => (
  <div
    className={cn(
      'bg-card relative min-w-0 overflow-hidden rounded-3xl border shadow-xl',
      className,
    )}
  >
    <div className="bg-muted/60 flex items-center gap-2 border-b px-4 py-3">
      <span aria-hidden className="flex gap-1.5">
        <span className="size-3 rounded-full bg-red-400/80" />
        <span className="size-3 rounded-full bg-amber-400/80" />
        <span className="size-3 rounded-full bg-emerald-400/80" />
      </span>
      <span className="bg-background text-muted-foreground mx-auto min-w-0 truncate rounded-md px-3 py-1 font-mono text-xs">
        {screen.url}
      </span>
    </div>

    <div
      className="w-full"
      style={{ aspectRatio: `${SCREEN_SIZE.width} / ${SCREEN_SIZE.height}` }}
    >
      <img
        alt={screen.alt}
        className="block size-full object-cover object-top dark:hidden"
        decoding="async"
        height={SCREEN_SIZE.height}
        loading="lazy"
        src={screen.light}
        width={SCREEN_SIZE.width}
      />
      <img
        alt={screen.alt}
        className="hidden size-full object-cover object-top dark:block"
        decoding="async"
        height={SCREEN_SIZE.height}
        loading="lazy"
        src={screen.dark}
        width={SCREEN_SIZE.width}
      />
    </div>

    {note ? (
      <span className="bg-background/90 text-muted-foreground absolute right-3 bottom-3 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur">
        {note}
      </span>
    ) : null}
  </div>
)
