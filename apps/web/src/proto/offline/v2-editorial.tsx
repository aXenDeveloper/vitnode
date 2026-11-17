import { useLogo } from '@vitnode/core/components/logo-context'
import { RichTextContent } from '@vitnode/core/components/rich-text'
import { SlidingNumber } from '@vitnode/core/components/ui/sliding-number'
import { LogInIcon } from 'lucide-react'

import type { VariantProps } from './harness'

import { useCountdown } from './use-clock'

const UNITS = [
  ['days', 'days'],
  ['hours', 'hours'],
  ['minutes', 'minutes'],
  ['seconds', 'seconds'],
] as const

const twoDigits = new Intl.NumberFormat('en', { minimumIntegerDigits: 2 })

const RuledCountdown = ({ opensAt }: { opensAt: string }) => {
  const parts = useCountdown(opensAt)
  const opens = new Intl.DateTimeFormat('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(opensAt))

  if (parts.done) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Planned for {opens}
        </p>
        <p className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Opening soon.
        </p>
        <p className="text-muted-foreground max-w-xs text-sm leading-relaxed text-pretty">
          The team is doing final checks. This page reloads by itself when we're
          back.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        Back on {opens}
      </p>
      <dl
        aria-label={`Opens in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`}
        className="flex flex-col"
        role="timer"
      >
        {UNITS.map(([key, label]) => (
          <div
            aria-hidden="true"
            className="flex items-center justify-between gap-6 border-t py-3 last:border-b"
            key={key}
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd>
              <SlidingNumber
                className="text-4xl font-semibold tracking-tight sm:text-5xl"
                formatter={twoDigits}
                value={parts[key]}
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export const EditorialVariant = ({ message, opensAt }: VariantProps) => {
  const logo = useLogo()

  return (
    <div className="bg-background text-foreground flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-8">
        <div className="flex items-center">{logo}</div>
        <a
          className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline"
          href="/login"
        >
          <LogInIcon aria-hidden="true" className="size-4" />
          Staff sign in
        </a>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-center gap-12 px-4 pb-16 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-20">
        <div className="flex flex-col gap-6">
          <p className="text-primary text-xs font-semibold tracking-wider uppercase">
            Scheduled maintenance
          </p>
          <h1 className="text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-7xl">
            We'll be right back.
          </h1>
          <RichTextContent
            className="text-muted-foreground max-w-[60ch] text-lg leading-relaxed text-pretty"
            content={message}
          />
        </div>

        {opensAt ? (
          <aside className="self-end lg:pb-2">
            <RuledCountdown opensAt={opensAt} />
          </aside>
        ) : null}
      </main>
    </div>
  )
}
