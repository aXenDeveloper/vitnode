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

export const SceneAvatar = ({
  className,
  initial,
}: {
  className: string
  initial: string
}) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-semibold',
      className,
    )}
  >
    {initial}
  </span>
)

export const MEMBER_TONE = {
  kuba: 'bg-amber-400 text-amber-950',
  marta: 'bg-emerald-600 text-white',
  ola: 'bg-primary text-primary-foreground',
} as const

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
