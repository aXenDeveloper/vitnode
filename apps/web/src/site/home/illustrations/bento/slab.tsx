import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'

const TONES = {
  accent: {
    icon: 'text-primary-foreground',
    left: 'fill-primary/85',
    right: 'fill-primary/65',
    top: 'fill-primary',
  },
  plain: {
    icon: 'text-foreground/70',
    left: 'fill-muted stroke-border',
    right: 'fill-border stroke-border',
    top: 'fill-card stroke-border',
  },
} as const

export const Slab = ({
  h,
  Icon,
  t,
  tone = 'plain',
  w,
}: {
  h: number
  Icon?: LucideIcon
  t: number
  tone?: keyof typeof TONES
  w: number
}) => {
  const colors = TONES[tone]

  return (
    <span className="relative block" style={{ height: h + t, width: w }}>
      <svg
        className="absolute inset-0 overflow-visible drop-shadow-md"
        viewBox={`0 0 ${w} ${h + t}`}
      >
        <path
          className={colors.left}
          d={`M0 ${h / 2} L${w / 2} ${h} V${h + t} L0 ${h / 2 + t} Z`}
        />
        <path
          className={colors.right}
          d={`M${w / 2} ${h} L${w} ${h / 2} V${h / 2 + t} L${w / 2} ${h + t} Z`}
        />
        <path
          className={colors.top}
          d={`M0 ${h / 2} L${w / 2} 0 L${w} ${h / 2} L${w / 2} ${h} Z`}
        />
      </svg>
      {Icon ? (
        <span
          className={cn(
            'absolute top-0 left-0 flex items-center justify-center',
            colors.icon,
          )}
          style={{ height: h, width: w }}
        >
          <Icon
            aria-hidden
            className="size-4"
            strokeWidth={1.5}
            style={{ transform: 'scaleY(0.5) rotate(45deg)' }}
          />
        </span>
      ) : null}
    </span>
  )
}
