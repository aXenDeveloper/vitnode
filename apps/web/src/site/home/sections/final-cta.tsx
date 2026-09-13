import { cn } from 'cn'
import { Sparkles } from 'lucide-react'

import { MarketingActions, SURFACE } from '@/site/marketing/shared'

export const FinalCtaSection = () => (
  <section
    aria-labelledby="cta-title"
    className="container mx-auto px-4 pt-4 pb-16 sm:px-6 sm:pb-24"
  >
    <div
      className={cn(
        SURFACE.dark,
        'relative flex flex-col items-center gap-6 overflow-hidden px-6 py-16 text-center sm:py-20',
      )}
    >
      <div
        aria-hidden
        className="mk-anim-drift bg-primary/25 absolute -bottom-32 left-1/2 -z-10 size-96 -translate-x-1/2 rounded-full blur-3xl"
      />

      <span className="bg-primary/15 text-primary flex size-12 items-center justify-center rounded-2xl">
        <Sparkles aria-hidden className="size-6" />
      </span>
      <h2
        className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl"
        id="cta-title"
      >
        Your next community starts with a little curiosity.
      </h2>
      <p className="text-muted-foreground font-book max-w-xl text-lg leading-relaxed text-pretty">
        Bring an idea today. Bring your people when it is ready. The framework
        is free, the docs are friendly and the canary is only a little bit
        feathery.
      </p>
      <MarketingActions className="justify-center" />
    </div>
  </section>
)
