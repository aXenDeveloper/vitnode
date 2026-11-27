import type { LucideIcon } from 'lucide-react'

import { Kbd } from '@vitnode/core/components/ui/kbd'
import { cn } from 'cn'
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CornerDownLeft,
  FileText,
  MessageCircle,
  MessagesSquare,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'use-intl'

import { Fit } from '@/site/home/illustrations/bento/scene'
import { useLoopStep } from '@/site/home/illustrations/bento/use-loop-step'

const SUGGESTIONS: readonly { day: number; Icon: LucideIcon; key: string }[] = [
  { day: 12, Icon: FileText, key: 'recap' },
  { day: 9, Icon: MessagesSquare, key: 'photos' },
  { day: 4, Icon: ShieldCheck, key: 'moderators' },
  { day: 21, Icon: Users, key: 'rules' },
  { day: 17, Icon: CalendarDays, key: 'events' },
  { day: 2, Icon: MessageCircle, key: 'library' },
]

const DURATIONS = [800, 500, 900, 450, 450, 800, 420, 2600] as const
const OPEN_STEP = 6
const ACCEPT_STEP = 7
const VISIBLE_ROWS = 3
const ROW_STRIDE = 34

export const SearchDialogScene = () => {
  const t = useTranslations('site.home.bento.search')
  const format = useFormatter()
  const { ref, step } = useLoopStep(DURATIONS)
  const queries = t('queries').split('|')
  const queryAt = (index: number) =>
    queries[Math.min(Math.max(index, 0), queries.length - 1)]
  const query = queryAt(step)
  const pressing = step === OPEN_STEP
  const accepted = step === ACCEPT_STEP
  const labelled = SUGGESTIONS.map((suggestion) => ({
    ...suggestion,
    label: t(`suggestions.${suggestion.key}`),
  }))
  const matchesFor = (value: string) =>
    labelled.filter(({ label }) =>
      label.toLowerCase().startsWith(value.toLowerCase()),
    )
  const matches = matchesFor(query)
  const previous = matchesFor(queryAt(step - 1))
  const top = matches[0]
  const ghost = top ? top.label.slice(query.length).toLowerCase() : ''

  return (
    <div className="flex w-full justify-center" ref={ref}>
      <Fit height={232} width={360}>
        <span className="bg-card absolute inset-x-3 top-2 flex flex-col overflow-hidden rounded-xl border shadow-lg">
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
          </span>
          <span className="text-muted-foreground px-3.5 pt-2.5 pb-1 text-xs font-medium">
            {t('group')}
          </span>
          <span
            className="relative overflow-hidden"
            style={{ height: VISIBLE_ROWS * ROW_STRIDE + 6 }}
          >
            {labelled.map(({ day, Icon, key, label }) => {
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
              const active = rank === 0

              return (
                <span
                  className={cn(
                    'absolute inset-x-1.5 top-0 flex h-8 items-center gap-2.5 rounded-lg px-2 text-xs transition-[transform,opacity,background-color] duration-300 ease-out motion-reduce:transition-none',
                    active ? 'bg-muted' : 'bg-transparent',
                  )}
                  key={key}
                  style={{
                    opacity: shown ? 1 : 0,
                    transform: `translateY(${slot * ROW_STRIDE}px) scale(${shown ? 1 : 0.97})`,
                  }}
                >
                  <Icon
                    aria-hidden
                    className="text-muted-foreground size-3.5 shrink-0"
                  />
                  <span className="flex-1 truncate font-medium">
                    <mark className="bg-warn/25 text-foreground rounded-sm">
                      {label.slice(0, query.length)}
                    </mark>
                    {label.slice(query.length)}
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {format.dateTime(new Date(Date.UTC(2026, 9, day)), {
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </span>
                </span>
              )
            })}
          </span>
          <span className="bg-muted/40 text-muted-foreground flex h-8 items-center gap-3 border-t px-3 text-xs">
            <span className="flex items-center gap-1">
              <Kbd>
                <ArrowUp aria-hidden />
              </Kbd>
              <Kbd>
                <ArrowDown aria-hidden />
              </Kbd>
              {t('navigate')}
            </span>
            <span className="flex items-center gap-1">
              <Kbd
                className={cn(
                  'transition-[transform,background-color,color,border-color] duration-150 ease-out motion-reduce:transition-none',
                  pressing &&
                    'bg-primary text-primary-foreground border-primary scale-96',
                )}
              >
                <CornerDownLeft aria-hidden />
              </Kbd>
              {t('open')}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>{t('esc')}</Kbd>
              {t('close')}
            </span>
          </span>
        </span>
      </Fit>
    </div>
  )
}
