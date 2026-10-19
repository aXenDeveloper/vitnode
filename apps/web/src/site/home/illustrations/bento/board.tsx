import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import {
  Braces,
  CalendarClock,
  Database,
  Globe,
  History,
  Languages,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Search,
  Send,
  Users,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import { Fit, ScenePill } from '@/site/home/illustrations/bento/scene'
import { Slab } from '@/site/home/illustrations/bento/slab'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const FEATURES: readonly { Icon: LucideIcon; key: string }[] = [
  { Icon: LayoutDashboard, key: 'admin' },
  { Icon: Braces, key: 'api' },
  { Icon: Database, key: 'database' },
  { Icon: Send, key: 'publishing' },
  { Icon: History, key: 'revisions' },
  { Icon: CalendarClock, key: 'scheduling' },
  { Icon: Languages, key: 'translations' },
  { Icon: Search, key: 'search' },
  { Icon: Users, key: 'live' },
  { Icon: MessageCircle, key: 'comments' },
  { Icon: ListChecks, key: 'approvals' },
  { Icon: Globe, key: 'seo' },
]

const COLS = 4
const ROWS = 3
const DURATIONS = [...FEATURES.map(() => 600), 2800]
const WIDTH = 600
const BASE = { cx: 300, h: 140, t: 16, topY: 64, w: 280 }
const CUBE = { h: 28, t: 13, w: 56 }
const PILL_LEFT_EDGE = 138
const PILL_RIGHT_EDGE = 462
const PILL_TOP = 22
const PILL_STEP = 36

const cellCenter = (i: number, j: number) => {
  const u = (i + 0.5) / COLS
  const v = (j + 0.5) / ROWS

  return {
    x: BASE.cx + (u - v) * (BASE.w / 2),
    y: BASE.topY + (u + v) * (BASE.h / 2),
  }
}

const pillAnchor = (index: number) => {
  const left = index % 2 === 0
  const row = Math.floor(index / 2)

  return {
    left,
    x: left ? PILL_LEFT_EDGE : PILL_RIGHT_EDGE,
    y: PILL_TOP + row * PILL_STEP + (left ? 0 : PILL_STEP / 2),
  }
}

const CELLS = FEATURES.map((feature, index) => {
  const i = index % COLS
  const j = Math.floor(index / COLS)
  const center = cellCenter(i, j)
  const anchor = pillAnchor(index)
  const topY = center.y - CUBE.t
  const midX = (center.x + anchor.x) / 2

  return {
    ...feature,
    anchor,
    center,
    depth: i + j,
    index,
    path: `M${center.x} ${topY} C${midX} ${topY} ${midX} ${anchor.y} ${anchor.x} ${anchor.y}`,
  }
})

const PAINT_ORDER = [...CELLS].sort((a, b) => a.depth - b.depth)

const gridLine = (from: { x: number; y: number }, dx: number) =>
  `M${from.x} ${from.y} l${dx} ${BASE.h / 2}`

export const BoardScene = () => {
  const t = useTranslations('site.home.bento.content.features')
  const { ref, step } = useLoopStep(DURATIONS)

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={236} width={WIDTH}>
        <span
          className="absolute"
          style={{ left: BASE.cx - BASE.w / 2, top: BASE.topY }}
        >
          <Slab h={BASE.h} t={BASE.t} w={BASE.w} />
        </span>
        <svg
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
          fill="none"
        >
          <g className="stroke-border" strokeDasharray="3 4">
            {Array.from({ length: COLS - 1 }, (_, n) => (n + 1) / COLS).map(
              (u) => (
                <path
                  d={gridLine(
                    {
                      x: BASE.cx + u * (BASE.w / 2),
                      y: BASE.topY + u * (BASE.h / 2),
                    },
                    -BASE.w / 2,
                  )}
                  key={`u${u}`}
                />
              ),
            )}
            {Array.from({ length: ROWS - 1 }, (_, n) => (n + 1) / ROWS).map(
              (v) => (
                <path
                  d={gridLine(
                    {
                      x: BASE.cx - v * (BASE.w / 2),
                      y: BASE.topY + v * (BASE.h / 2),
                    },
                    BASE.w / 2,
                  )}
                  key={`v${v}`}
                />
              ),
            )}
          </g>
        </svg>

        {PAINT_ORDER.map(({ center, Icon, index, key }) => {
          const landed = index <= step

          return (
            <span
              className={cn(
                'absolute transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none',
                landed
                  ? 'translate-y-0 opacity-100'
                  : '-translate-y-8 opacity-0',
              )}
              key={key}
              style={{
                left: center.x - CUBE.w / 2,
                top: center.y - CUBE.t - CUBE.h / 2,
              }}
            >
              <Slab
                h={CUBE.h}
                Icon={Icon}
                t={CUBE.t}
                tone={index === 0 ? 'accent' : 'plain'}
                w={CUBE.w}
              />
            </span>
          )
        })}

        <svg
          aria-hidden
          className="absolute inset-0 size-full overflow-visible"
          fill="none"
        >
          {CELLS.map(({ anchor, index, key, path }) => {
            const landed = index <= step

            return (
              <g key={key}>
                <g
                  className={cn(
                    'transition-opacity duration-300',
                    landed ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  <path className="stroke-foreground/20" d={path} />
                  <circle
                    className="fill-foreground/30"
                    cx={anchor.x}
                    cy={anchor.y}
                    r={3}
                  />
                </g>
                {index === step ? (
                  <path
                    className="mk-anim-bento-zap stroke-primary"
                    d={path}
                    pathLength={100}
                    strokeDasharray="10 200"
                    strokeLinecap="round"
                    strokeWidth={2}
                  />
                ) : null}
              </g>
            )
          })}
        </svg>

        {CELLS.map(({ anchor, Icon, index, key }) => {
          const landed = index <= step

          return (
            <ScenePill
              Icon={Icon}
              key={key}
              style={
                anchor.left
                  ? { right: WIDTH - anchor.x, top: anchor.y - 13 }
                  : { left: anchor.x, top: anchor.y - 13 }
              }
            >
              {t(key)}
              <span
                className={cn(
                  'bg-primary size-1.5 rounded-full transition-opacity duration-300',
                  landed ? 'opacity-100' : 'opacity-0',
                )}
              />
            </ScenePill>
          )
        })}
      </Fit>
    </div>
  )
}
