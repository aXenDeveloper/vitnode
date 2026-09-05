import type { LucideIcon } from 'lucide-react'

import { Bot, Fingerprint, Gauge, KeyRound, ShieldUser } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { ShieldVisual } from '#/site/home/illustrations/security-hosting'
import { SectionHeading, TextLink } from '#/site/marketing/shared'

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

export const SecuritySection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <section
    aria-labelledby="security-title"
    className="mk-section-anchor container mx-auto px-4 py-12 sm:px-6 sm:py-16"
    id="security"
  >
    <div className="bg-card grid items-center gap-8 rounded-3xl border p-6 sm:p-10 lg:grid-cols-5">
      <div className="flex justify-center lg:col-span-2">
        <ShieldVisual />
      </div>

      <div className="flex flex-col gap-6 lg:col-span-3">
        <SectionHeading
          eyebrow="A warmer welcome. A smarter front door."
          id="security-title"
          title="Let people in. Keep access in check."
        />

        <ul className="grid gap-4 sm:grid-cols-2">
          {GUARDS.map(({ Icon, text, title }) => (
            <li className="flex gap-3" key={title}>
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <TextLink href="/docs/dev/advanced/auth" LinkComponent={LinkComponent}>
          Read how sessions and permissions work
        </TextLink>
      </div>
    </div>
  </section>
)
