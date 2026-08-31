import { Card } from '@vitnode/core/components/ui/card'

/**
 * The closing card, migrated word for word.
 *
 * Nothing in it named a framework, so nothing in it needed updating - and it is
 * the one section of this page where that is worth saying out loud, because the
 * temptation in a migration is to touch what is already correct.
 */
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
