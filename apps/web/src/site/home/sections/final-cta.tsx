import { Sparkles } from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { MarketingActions } from '#/site/marketing/shared'

export const FinalCtaSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <section
    aria-labelledby="cta-title"
    className="container mx-auto px-4 pt-4 pb-16 sm:px-6 sm:pb-24"
  >
    <div className="bg-card relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl border px-6 py-16 text-center sm:py-20">
      <div aria-hidden className="mk-dots absolute inset-0 -z-10 opacity-60" />
      <div
        aria-hidden
        className="mk-anim-drift bg-primary/15 absolute -bottom-32 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full blur-3xl"
      />

      <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl">
        <Sparkles aria-hidden className="mk-anim-float size-6" />
      </span>
      <h2
        className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        id="cta-title"
      >
        Your next community starts with a little curiosity.
      </h2>
      <p className="text-muted-foreground max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
        Bring an idea today. Bring your people when it is ready. The framework
        is free, the docs are friendly and the canary is only a little bit
        feathery.
      </p>
      <MarketingActions
        className="justify-center"
        LinkComponent={LinkComponent}
      />
    </div>
  </section>
)
