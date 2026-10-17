import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'

export const Fit = ({
  children,
  height,
  width,
}: {
  children: React.ReactNode
  height: number
  width: number
}) => (
  <div
    className="@container relative w-full select-none"
    style={{ aspectRatio: `${width} / ${height}`, maxWidth: width }}
  >
    <div
      className="absolute top-0 left-0 origin-top-left"
      style={{
        height,
        transform: `scale(tan(atan2(100cqw, ${width}px)))`,
        width,
      }}
    >
      {children}
    </div>
  </div>
)

export const ScenePill = ({
  children,
  className,
  Icon,
  style,
}: {
  children: React.ReactNode
  className?: string
  Icon?: LucideIcon
  style?: React.CSSProperties
}) => (
  <span
    className={cn(
      'bg-card text-foreground absolute flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-sm',
      className,
    )}
    style={style}
  >
    {Icon ? (
      <Icon aria-hidden className="text-muted-foreground size-3.5" />
    ) : null}
    {children}
  </span>
)

export const SceneBackdrop = () => (
  <span aria-hidden className="absolute inset-0 -z-10">
    <span
      className="absolute inset-0"
      style={{
        backgroundImage:
          'radial-gradient(color-mix(in oklab, var(--foreground) 14%, transparent) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
        maskImage:
          'radial-gradient(ellipse 60% 60% at 50% 55%, #000 10%, transparent 75%)',
      }}
    />
    <span
      className="absolute inset-0"
      style={{
        background:
          'radial-gradient(circle 120px at 50% 55%, color-mix(in oklab, var(--foreground) 6%, transparent), transparent)',
      }}
    />
  </span>
)

export const GridTexture = ({
  className,
  size,
}: {
  className?: string
  size: number
}) => (
  <span
    aria-hidden
    className={cn('absolute rounded-xl', className)}
    style={{
      backgroundImage:
        'linear-gradient(to right, color-mix(in oklab, var(--foreground) 10%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 10%, transparent) 1px, transparent 1px)',
      backgroundSize: `${size}px ${size}px`,
    }}
  />
)
