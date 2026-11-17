import { useLogo } from '@vitnode/core/components/logo-context'
import { RichTextContent } from '@vitnode/core/components/rich-text'
import { SlidingNumber } from '@vitnode/core/components/ui/sliding-number'
import { LogInIcon } from 'lucide-react'

import type { VariantProps } from './harness'

import { useCountdown } from './use-clock'

const twoDigits = new Intl.NumberFormat('en', { minimumIntegerDigits: 2 })

const Colon = () => (
  <span
    aria-hidden="true"
    className="text-muted-foreground/50 -mt-[0.12em] motion-safe:animate-[proto-blink_1s_steps(1)_infinite]"
  >
    :
  </span>
)

const Group = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center gap-2">
    <SlidingNumber formatter={twoDigits} value={value} />
    <span className="text-muted-foreground text-[0.7rem] font-medium tracking-[0.2em] uppercase sm:text-xs">
      {label}
    </span>
  </div>
)

const Clock = ({ opensAt }: { opensAt: string }) => {
  const parts = useCountdown(opensAt)

  if (parts.done) {
    return (
      <p
        className="text-6xl font-semibold tracking-tight text-balance sm:text-8xl"
        role="status"
      >
        Opening soon
      </p>
    )
  }

  return (
    <div
      aria-label={`Opens in ${parts.days} days, ${parts.hours} hours and ${parts.minutes} minutes`}
      className="flex items-start justify-center gap-1 text-[clamp(2.25rem,10vw,8rem)] leading-none font-semibold tracking-tighter tabular-nums sm:gap-3"
      role="timer"
    >
      <div aria-hidden="true" className="contents">
        {parts.days > 0 ? (
          <>
            <Group label="days" value={parts.days} />
            <Colon />
          </>
        ) : null}
        <Group label="hrs" value={parts.hours} />
        <Colon />
        <Group label="min" value={parts.minutes} />
        <Colon />
        <Group label="sec" value={parts.seconds} />
      </div>
    </div>
  )
}

export const ClockVariant = ({ message, opensAt }: VariantProps) => {
  const logo = useLogo()

  return (
    <main className="bg-background text-foreground relative isolate flex min-h-dvh flex-col items-center justify-center gap-12 overflow-hidden px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(color-mix(in_oklch,var(--primary)_22%,transparent)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px]"
      />
      <div className="flex items-center">{logo}</div>

      {opensAt ? (
        <Clock opensAt={opensAt} />
      ) : (
        <p className="text-6xl font-semibold tracking-tight text-balance sm:text-8xl">
          Back soon
        </p>
      )}

      <div className="bg-card text-card-foreground flex w-full max-w-xl flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:p-6">
        <h1 className="text-base font-semibold text-balance">
          We'll be right back
        </h1>
        <RichTextContent
          className="text-muted-foreground text-sm leading-relaxed text-pretty"
          content={message}
        />
      </div>

      <a
        className="text-muted-foreground inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline"
        href="/login"
      >
        <LogInIcon aria-hidden="true" className="size-4" />
        Staff sign in
      </a>
    </main>
  )
}
