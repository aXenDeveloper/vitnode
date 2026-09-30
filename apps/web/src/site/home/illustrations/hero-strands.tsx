import { cn } from 'cn'

const STRANDS = Array.from({ length: 22 }, (_, index) => {
  const t = index / 21

  return `M-60 ${250 + t * 70} C 380 ${40 + t * 170}, 1040 ${440 - t * 150}, 1500 ${170 + t * 90}`
})

const PULSES = [3, 9, 14, 19]

const timing = (delay: number, duration: number): React.CSSProperties => ({
  animationDelay: `${delay}s`,
  animationDuration: `${duration}s`,
})

export const HeroStrands = ({ className }: { className?: string }) => (
  <svg
    aria-hidden
    className={cn(
      'pointer-events-none absolute inset-x-0 -z-10 w-full',
      className,
    )}
    fill="none"
    preserveAspectRatio="none"
    style={{
      maskComposite: 'intersect',
      maskImage:
        'linear-gradient(to bottom, transparent, black 35%), linear-gradient(to right, transparent 25%, black 60%)',
      WebkitMaskComposite: 'source-in',
    }}
    viewBox="0 0 1440 480"
  >
    <defs>
      <linearGradient id="hero-strand" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
        <stop offset="0.3" stopColor="var(--primary)" stopOpacity="0.55" />
        <stop
          offset="0.65"
          stopColor="var(--color-sky-400)"
          stopOpacity="0.5"
        />
        <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
      </linearGradient>
    </defs>

    <g className="mk-anim-sway" style={timing(0, 14)}>
      {STRANDS.filter((_, index) => index % 2 === 0).map((d) => (
        <path d={d} key={d} stroke="url(#hero-strand)" strokeWidth={1} />
      ))}
    </g>
    <g className="mk-anim-sway" style={timing(-6, 18)}>
      {STRANDS.filter((_, index) => index % 2 === 1).map((d) => (
        <path d={d} key={d} stroke="url(#hero-strand)" strokeWidth={1} />
      ))}
    </g>
    {PULSES.map((index, order) => (
      <path
        className="mk-anim-flow"
        d={STRANDS[index]}
        key={index}
        pathLength={1}
        stroke="var(--color-sky-300)"
        strokeLinecap="round"
        strokeWidth={1.6}
        style={timing(-order * 1.3, 5 + order)}
      />
    ))}
  </svg>
)
