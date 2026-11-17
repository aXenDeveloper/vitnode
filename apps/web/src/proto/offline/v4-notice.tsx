import { useLogo } from '@vitnode/core/components/logo-context'
import { RichTextContent } from '@vitnode/core/components/rich-text'
import { SlidingNumber } from '@vitnode/core/components/ui/sliding-number'
import { CalendarClockIcon } from 'lucide-react'

import type { VariantProps } from './harness'

import { useCountdown } from './use-clock'

const twoDigits = new Intl.NumberFormat('en', { minimumIntegerDigits: 2 })

const Unit = ({ suffix, value }: { suffix: string; value: number }) => (
  <span className="inline-flex items-baseline">
    <SlidingNumber formatter={twoDigits} value={value} />
    <span className="text-muted-foreground ms-0.5 text-sm font-medium">
      {suffix}
    </span>
  </span>
)

const formatOpens = (opensAt: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(opensAt))

/** Opening time set, countdown turned off: the date alone. */
const ExpectedBack = ({ opensAt }: { opensAt: string }) => (
  <div className="bg-muted/60 flex items-center gap-3 rounded-xl px-4 py-3">
    <CalendarClockIcon
      aria-hidden="true"
      className="text-muted-foreground size-5 shrink-0"
    />
    <div className="flex flex-col gap-0.5">
      <p className="text-muted-foreground text-xs font-medium">Expected back</p>
      <p className="text-base font-semibold">
        <time dateTime={opensAt}>{formatOpens(opensAt)}</time>
      </p>
    </div>
  </div>
)

const InlineCountdown = ({ opensAt }: { opensAt: string }) => {
  const parts = useCountdown(opensAt)
  const opens = formatOpens(opensAt)

  return (
    <div className="bg-muted/60 flex flex-col gap-1 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      {parts.done ? (
        <p className="text-base font-semibold" role="status">
          Opening soon
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground text-xs font-medium">Back in</p>
          <p
            aria-label={`Back in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`}
            className="flex flex-wrap items-baseline gap-x-2 text-xl font-semibold tabular-nums"
            role="timer"
          >
            <span aria-hidden="true" className="contents">
              {parts.days > 0 ? <Unit suffix="d" value={parts.days} /> : null}
              <Unit suffix="h" value={parts.hours} />
              <Unit suffix="m" value={parts.minutes} />
              <Unit suffix="s" value={parts.seconds} />
            </span>
          </p>
        </div>
      )}
      <p className="text-muted-foreground inline-flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap">
        <CalendarClockIcon aria-hidden="true" className="size-4" />
        {opens}
      </p>
    </div>
  )
}

export const NoticeVariant = ({
  message,
  opensAt,
  showCountdown,
}: VariantProps) => {
  const logo = useLogo()

  return (
    <main className="bg-muted/40 text-foreground flex min-h-dvh items-center justify-center px-4 py-12">
      <article className="bg-card text-card-foreground flex w-full max-w-lg flex-col gap-6 rounded-2xl border p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_rgb(0_0_0/0.04),0_16px_40px_rgb(0_0_0/0.06)] motion-safe:animate-[proto-rise_320ms_cubic-bezier(0.32,0.72,0,1)] sm:p-8">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center [&_svg]:h-7 [&_svg]:w-auto">
            {logo}
          </div>
          <span className="bg-warn/10 text-warn inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="bg-warn absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping" />
              <span className="bg-warn relative inline-flex size-2 rounded-full" />
            </span>
            Maintenance
          </span>
        </header>

        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            We'll be right back
          </h1>
          <RichTextContent
            className="text-muted-foreground text-base leading-relaxed text-pretty"
            content={message}
          />
        </div>

        {opensAt && showCountdown ? (
          <InlineCountdown opensAt={opensAt} />
        ) : null}
        {opensAt && !showCountdown ? <ExpectedBack opensAt={opensAt} /> : null}
      </article>
    </main>
  )
}
