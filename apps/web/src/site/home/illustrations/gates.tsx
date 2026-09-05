import type { LucideIcon } from 'lucide-react'

import { Bot, Check, Gauge, Lock, ShieldUser, X } from 'lucide-react'

interface Gate {
  Icon: LucideIcon
  label: string
  sub: string
}

const GATES: Gate[] = [
  { Icon: Bot, label: 'Bot check', sub: 'Turnstile · reCAPTCHA' },
  { Icon: Gauge, label: 'Rate limit', sub: '429 after the budget' },
  { Icon: Lock, label: 'Session', sub: 'HttpOnly · hashed' },
  { Icon: ShieldUser, label: 'Permissions', sub: 'role · staff · plugin' },
]

const GATE_TOP = 56
const GATE_STEP = 66
const GATE_HEIGHT = 48
const MEMBER_LANE = 56
const BOT_LANE = 96
const MEMBER_CYCLE = 6
const TRACK = { end: 322, start: 14 }

const gateY = (index: number) => GATE_TOP + index * GATE_STEP

const gateCenter = (index: number) => gateY(index) + GATE_HEIGHT / 2

const memberDelay = (index: number) => {
  const arrival =
    (MEMBER_CYCLE * (gateCenter(index) - TRACK.start)) /
    (TRACK.end - TRACK.start)
  const turnOn = MEMBER_CYCLE * 0.24

  return `${arrival - turnOn - MEMBER_CYCLE}s`
}

export const GatesVisual = () => (
  <svg
    aria-hidden
    className="h-auto w-full max-w-xs"
    fill="none"
    viewBox="0 0 320 330"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line
      className="stroke-border"
      strokeDasharray="4 6"
      strokeWidth={2}
      x1={MEMBER_LANE}
      x2={MEMBER_LANE}
      y1={TRACK.start}
      y2={TRACK.end}
    />
    <line
      className="stroke-border"
      strokeDasharray="4 6"
      strokeWidth={2}
      x1={BOT_LANE}
      x2={BOT_LANE}
      y1={TRACK.start}
      y2={gateY(0)}
    />

    {GATES.map(({ Icon, label, sub }, index) => {
      const y = gateY(index)

      return (
        <g key={label}>
          <rect
            className="fill-card stroke-border drop-shadow-md"
            height={GATE_HEIGHT}
            rx={14}
            strokeWidth={1.5}
            width={272}
            x={24}
            y={y}
          />
          <rect
            className="fill-primary/10"
            height={32}
            rx={10}
            width={32}
            x={116}
            y={y + 8}
          />
          <Icon
            className="text-primary"
            height={16}
            strokeWidth={2}
            width={16}
            x={124}
            y={y + 16}
          />
          <text
            className="fill-foreground text-xs font-semibold"
            x={156}
            y={y + 20}
          >
            {label}
          </text>
          <text className="fill-muted-foreground text-xs" x={156} y={y + 36}>
            {sub}
          </text>
          <g
            className="mk-anim-gate"
            style={{ animationDelay: memberDelay(index) }}
          >
            <circle
              className="fill-emerald-500/15"
              cx={MEMBER_LANE}
              cy={y + GATE_HEIGHT / 2}
              r={11}
            />
            <Check
              className="text-emerald-600 dark:text-emerald-400"
              height={12}
              strokeWidth={3}
              width={12}
              x={MEMBER_LANE - 6}
              y={y + GATE_HEIGHT / 2 - 6}
            />
          </g>
        </g>
      )
    })}

    <g className="mk-anim-bot-block">
      <circle
        className="fill-red-500/15"
        cx={BOT_LANE}
        cy={gateCenter(0)}
        r={11}
      />
      <X
        className="text-red-500"
        height={12}
        strokeWidth={3}
        width={12}
        x={BOT_LANE - 6}
        y={gateCenter(0) - 6}
      />
    </g>

    <circle
      className="mk-anim-travel fill-emerald-500 drop-shadow-md"
      r={7}
      style={{
        animationDuration: `${MEMBER_CYCLE}s`,
        animationTimingFunction: 'linear',
        offsetPath: `path('M${MEMBER_LANE} ${TRACK.start} L${MEMBER_LANE} ${TRACK.end}')`,
      }}
    />

    <g
      className="mk-anim-bot-bounce"
      style={{ transformOrigin: `${BOT_LANE}px ${gateY(0)}px` }}
    >
      <circle
        className="fill-red-500 drop-shadow-md"
        cx={BOT_LANE}
        cy={gateY(0) - 10}
        r={7}
      />
      <Bot
        className="text-white"
        height={9}
        strokeWidth={2.5}
        width={9}
        x={BOT_LANE - 4.5}
        y={gateY(0) - 14.5}
      />
    </g>

    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={MEMBER_LANE}
      y={GATE_TOP - 32}
    >
      member
    </text>
    <text
      className="fill-muted-foreground text-xs"
      textAnchor="middle"
      x={BOT_LANE}
      y={GATE_TOP - 32}
    >
      bot
    </text>
  </svg>
)
