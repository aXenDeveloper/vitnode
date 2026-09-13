import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import { Bot, Fingerprint, Gauge, KeyRound, ShieldUser } from 'lucide-react'

import { GatesVisual } from '@/site/home/illustrations/gates'
import { ActionLink, SectionHeading, SURFACE } from '@/site/marketing/shared'

const GUARDS: { Icon: LucideIcon; text: string; title: string }[] = [
  {
    Icon: KeyRound,
    text: 'Google, Discord, Facebook or your own OAuth2 provider. One config line, buttons appear.',
    title: 'Single sign-on',
  },
  {
    Icon: Bot,
    text: 'Cloudflare Turnstile or reCAPTCHA v3 guard sign-up, password reset and any route you mark.',
    title: 'Captcha',
  },
  {
    Icon: Gauge,
    text: 'Brute-force attempts meet a polite 429. Counters share across instances through Redis.',
    title: 'Rate limiting',
  },
  {
    Icon: Fingerprint,
    text: 'HttpOnly cookies, hashed opaque tokens and a separate session for the AdminCP.',
    title: 'Hardened sessions',
  },
  {
    Icon: ShieldUser,
    text: 'Per-plugin, per-action grants for administrators and moderators, enforced on the API and reflected in the UI.',
    title: 'Staff permissions',
  },
]

export const SecuritySection = () => (
  <section
    aria-labelledby="security-title"
    className="mk-section-anchor container mx-auto px-4 py-12 sm:px-6 sm:py-16"
    id="security"
  >
    <div
      className={cn(
        SURFACE.tint,
        'grid items-center gap-10 p-7 sm:p-10 lg:grid-cols-5',
      )}
    >
      <div className="flex justify-center lg:col-span-2">
        <GatesVisual />
      </div>

      <div className="flex flex-col gap-8 lg:col-span-3">
        <SectionHeading
          eyebrow="A warmer welcome. A smarter front door."
          id="security-title"
          title="Let people in. Keep access in check."
        />

        <ul className="grid gap-5 sm:grid-cols-2">
          {GUARDS.map(({ Icon, text, title }) => (
            <li className="flex gap-3" key={title}>
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground font-book text-sm leading-relaxed text-pretty">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <ActionLink
          className="w-fit"
          params={{ _splat: 'dev/advanced/auth' }}
          to="/docs/$"
          variant="outline"
        >
          How sessions and permissions work
        </ActionLink>
      </div>
    </div>
  </section>
)
