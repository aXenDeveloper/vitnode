import { Card } from '@vitnode/core/components/ui/card'

export const CallToActionSection = () => (
  <section className="py-16">
    <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Start <span className="text-primary">Building</span>
      </h2>

      <p className="text-muted-foreground leading-relaxed text-balance md:text-lg">
        Everything you need for modern web apps, zero config.
      </p>
    </Card>
  </section>
)
