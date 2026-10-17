import { Image, Layers, Sparkles } from 'lucide-react'
import { useTranslations } from 'use-intl'

import {
  Fit,
  GridTexture,
  ScenePill,
} from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

type Point = readonly [number, number]

const TRACES: readonly {
  delay: number
  dot: Point
  points: readonly Point[]
}[] = [
  {
    delay: 0,
    dot: [160, 10],
    points: [
      [160, 78],
      [160, 10],
    ],
  },
  {
    delay: 0.9,
    dot: [100, 56],
    points: [
      [130, 78],
      [130, 56],
      [100, 56],
    ],
  },
  {
    delay: 0.4,
    dot: [268, 42],
    points: [
      [204, 94],
      [226, 94],
      [226, 42],
      [268, 42],
    ],
  },
  {
    delay: 1.4,
    dot: [46, 122],
    points: [
      [116, 122],
      [46, 122],
    ],
  },
  {
    delay: 0.2,
    dot: [274, 122],
    points: [
      [204, 122],
      [274, 122],
    ],
  },
  {
    delay: 1.8,
    dot: [52, 200],
    points: [
      [116, 150],
      [94, 150],
      [94, 200],
      [52, 200],
    ],
  },
  {
    delay: 1.1,
    dot: [238, 228],
    points: [
      [204, 188],
      [238, 188],
      [238, 228],
    ],
  },
]

const toPath = (points: readonly Point[]) => {
  const d = points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ')
  const length = points.reduce((sum, [x, y], index) => {
    const previous = points[index - 1]

    return previous
      ? sum + Math.abs(x - previous[0]) + Math.abs(y - previous[1])
      : sum
  }, 0)

  return { d, length }
}

const PATHS = TRACES.map((trace) => ({ ...trace, ...toPath(trace.points) }))

const BUDGET = [57, 55, 52, 54, 56] as const
const DURATIONS = BUDGET.map(() => 1600)

export const AiChipScene = () => {
  const t = useTranslations('site.home.bento.ai')
  const { ref, step } = useLoopStep(DURATIONS)

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={236} width={330}>
        <svg
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
          fill="none"
        >
          <path className="stroke-foreground/20" d="M82 12 V32" />
          <circle className="fill-foreground/30" cx={82} cy={12} r={3} />
          {PATHS.map(({ d, delay, dot, length }) => (
            <g key={d}>
              <path className="stroke-foreground/20" d={d} />
              <circle
                className="fill-foreground/30"
                cx={dot[0]}
                cy={dot[1]}
                r={3}
              />
              <path
                className="mk-anim-bento-trace stroke-primary"
                d={d}
                strokeDasharray="16 2000"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                style={
                  {
                    '--dur': `${2.4 + length / 120}s`,
                    '--len': length,
                    animationDelay: `${delay}s`,
                  } as React.CSSProperties
                }
              />
            </g>
          ))}
        </svg>

        <span
          className="bg-card absolute flex size-22 items-center justify-center rounded-3xl border shadow-lg"
          style={{ left: 116, top: 78 }}
        >
          <GridTexture className="inset-2" size={9} />
          <span className="bg-primary text-primary-foreground shadow-primary/30 relative flex size-10 items-center justify-center rounded-xl shadow-md">
            <Sparkles aria-hidden className="size-5" strokeWidth={1.75} />
          </span>
        </span>

        <ScenePill
          className="py-1.5"
          Icon={Layers}
          style={{ left: 18, top: 30 }}
        >
          {t('provider')}
        </ScenePill>
        <ScenePill
          className="mk-anim-bento-bob py-1.5"
          Icon={Image}
          style={{ left: 232, top: 62 }}
        >
          {t('alt')}
        </ScenePill>
        <ScenePill className="py-1.5" style={{ left: 110, top: 178 }}>
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
            <span className="relative size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="tabular-nums">
            {t('budget', { percent: BUDGET[step] ?? BUDGET[0] })}
          </span>
        </ScenePill>
      </Fit>
    </div>
  )
}
