import { lazy, Suspense } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { AnimatedBeamHomeSkeleton } from '#/site/home/animated-beam/animated-beam-home-skeleton'
import { AdminSection } from '#/site/home/sections/admin-panel'
import { CallToActionSection } from '#/site/home/sections/call-to-action'
import { HeroSection } from '#/site/home/sections/hero'
import { PoweringBySection } from '#/site/home/sections/powering-by'

const AnimatedBeamHome = lazy(async () => {
  const { AnimatedBeamHome: Component } =
    await import('#/site/home/animated-beam/animated-beam-home')

  return { default: Component }
})

export const HomeRouteContent = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="container mx-auto">
    <HeroSection
      LinkComponent={LinkComponent}
      visual={
        <Suspense fallback={<AnimatedBeamHomeSkeleton />}>
          <AnimatedBeamHome LinkComponent={LinkComponent} />
        </Suspense>
      }
    />

    <PoweringBySection />
    <AdminSection />
    <CallToActionSection />
  </div>
)
