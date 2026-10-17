import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import {
  CalendarDays,
  CornerDownLeft,
  FileText,
  MessageCircle,
  MessagesSquare,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useTranslations } from 'use-intl'

import { Fit } from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const SUGGESTIONS: readonly { Icon: LucideIcon; key: string; score: number }[] =
  [
    { Icon: FileText, key: 'recap', score: 0.92 },
    { Icon: MessagesSquare, key: 'photos', score: 0.81 },
    { Icon: ShieldCheck, key: 'moderators', score: 0.64 },
    { Icon: Users, key: 'rules', score: 0.58 },
    { Icon: CalendarDays, key: 'events', score: 0.41 },
    { Icon: MessageCircle, key: 'library', score: 0.33 },
  ]

const DURATIONS = [800, 500, 900, 450, 450, 800, 420, 2600] as const
const TAB_STEP = 6
const ACCEPT_STEP = 7
const VISIBLE_ROWS = 5
const ROW_STRIDE = 34
const LIST_PADDING = 12

export const SuggestScene = () => {
  const t = useTranslations('site.home.bento.search')
  const { ref, step } = useLoopStep(DURATIONS)
  const queries = t('queries').split('|')
  const query = queries[Math.min(step, queries.length - 1)] ?? ''
  const pressing = step === TAB_STEP
  const accepted = step === ACCEPT_STEP
  const selected = step >= TAB_STEP
  const labelled = SUGGESTIONS.map((suggestion) => ({
    ...suggestion,
    label: t(`suggestions.${suggestion.key}`),
  }))
  const matchesFor = (value: string) =>
    labelled.filter(({ label }) =>
      label.toLowerCase().startsWith(value.toLowerCase()),
    )
  const matches = matchesFor(query)
  const previous = matchesFor(queries[Math.max(step - 1, 0)] ?? '')
  const top = matches[0]
  const ghost = top ? top.label.slice(query.length).toLowerCase() : ''
  const listHeight =
    Math.max(Math.min(matches.length, VISIBLE_ROWS), 1) * ROW_STRIDE +
    LIST_PADDING

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={360}>
        <span className="bg-card absolute inset-x-3 top-2 flex flex-col overflow-hidden rounded-2xl border shadow-lg">
          <span className="flex h-11 items-center gap-2.5 border-b px-3.5 text-sm">
            <Search aria-hidden className="text-muted-foreground size-4" />
            <span className="flex min-w-0 flex-1 items-center truncate">
              <span className="font-medium">{query}</span>
              {accepted ? null : (
                <span className="relative h-4 w-0">
                  <span className="mk-anim-blink bg-foreground absolute inset-y-0 left-0 w-px" />
                </span>
              )}
              <span
                className={cn(
                  'transition-colors duration-200',
                  accepted
                    ? 'text-foreground font-medium'
                    : 'text-muted-foreground/60',
                )}
              >
                {ghost}
              </span>
            </span>
            <kbd
              className={cn(
                'rounded-md border border-b-2 px-1.5 py-0.5 font-mono text-xs transition-[transform,background-color,color,border-color] duration-150',
                pressing
                  ? 'bg-primary text-primary-foreground border-primary translate-y-px border-b'
                  : accepted
                    ? 'text-muted-foreground'
                    : 'bg-card text-foreground',
              )}
            >
              {t('tab')}
            </kbd>
          </span>
          <span
            className="relative overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
            style={{ height: listHeight }}
          >
            {labelled.map(({ Icon, key, label, score }) => {
              const rank = matches.findIndex((item) => item.key === key)
              const shown = rank !== -1 && rank < VISIBLE_ROWS
              const previousRank = previous.findIndex(
                (item) => item.key === key,
              )
              const slot = shown
                ? rank
                : previousRank === -1
                  ? VISIBLE_ROWS
                  : previousRank
              const active = selected && rank === 0

              return (
                <span
                  className={cn(
                    'absolute inset-x-1.5 top-1.5 flex h-8 items-center gap-2.5 rounded-lg px-2 text-xs transition-[transform,opacity,background-color] duration-300 ease-out motion-reduce:transition-none',
                    active ? 'bg-primary/10' : 'bg-transparent',
                  )}
                  key={key}
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: `translateY(${slot * ROW_STRIDE}px) scale(${shown ? 1 : 0.97})`,
                  }}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      'size-3.5 shrink-0',
                      active ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="flex-1 truncate">
                    <span className="text-foreground font-semibold">
                      {label.slice(0, query.length)}
                    </span>
                    <span className="text-muted-foreground">
                      {label.slice(query.length)}
                    </span>
                  </span>
                  <span className="bg-muted h-1 w-12 overflow-hidden rounded-full">
                    <span
                      className="bg-foreground/40 block h-full rounded-full"
                      style={{ width: `${score * 100}%` }}
                    />
                  </span>
                  <CornerDownLeft
                    aria-hidden
                    className={cn(
                      'size-3.5 transition-opacity duration-200',
                      active ? 'text-primary opacity-100' : 'opacity-0',
                    )}
                  />
                </span>
              )
            })}
          </span>
        </span>
      </Fit>
    </div>
  )
}
