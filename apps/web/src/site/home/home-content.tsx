import { lazy, Suspense } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { AnimatedBeamHomeSkeleton } from '#/site/home/animated-beam/animated-beam-home-skeleton'
import { AdminSection } from '#/site/home/sections/admin-panel'
import { CallToActionSection } from '#/site/home/sections/call-to-action'
import { HeroSection } from '#/site/home/sections/hero'
import { PoweringBySection } from '#/site/home/sections/powering-by'

/**
 * The beam, off the page's critical path.
 *
 * The Next.js page wrapped this in `<Suspense>` around an ordinary import, which
 * renders the fallback for zero milliseconds and defers nothing - the module was
 * in the same chunk as the page either way. `React.lazy` is what makes the
 * boundary real: the beam, its eight `ResizeObserver`-driven paths and the
 * `motion` gradient it animates land in a chunk of their own, requested after
 * the hero has painted, with {@link AnimatedBeamHomeSkeleton} holding its size
 * in the meantime.
 *
 * It is the right thing to defer and the wrong thing to drop: it is the only
 * moving illustration of what the product *is*, it is below the headline rather
 * than above it, and on the server it renders nine static circles because there
 * is nothing to measure - so nothing about the first paint depends on it.
 */
const AnimatedBeamHome = lazy(async () => {
  const { AnimatedBeamHome: Component } =
    await import('#/site/home/animated-beam/animated-beam-home')

  return { default: Component }
})

/**
 * vitnode.com's front page.
 *
 * ## Why this is the application's and not the package's
 *
 * `@vitnode/core` is what every VitNode install ships. This is one website's
 * marketing copy, one website's screenshot of its own AdminCP, and one
 * website's opinion about which six tools deserve a row on its front page - so
 * putting it in the package would hand the VitNode.com homepage to every
 * generated application, which `packages/create-vitnode-app` deliberately does
 * not do: it scaffolds its own "Start Your Journey!" starter page, and Stage 15
 * left that alone.
 *
 * "`apps/web` is thin" is a rule about *infrastructure* - runtime, routing,
 * i18n, auth, caching, the design system - all of which is in the package and
 * none of which is here. A site's own pages are the residue that is left when
 * the infrastructure has been factored out, and a route file three lines long
 * with the page in a module beside it is what thin looks like at this end.
 *
 * The one piece of this page that *is* the package's went there: the mark. See
 * `LogoVitNodeBrand` in `@vitnode/core/components/logo-vitnode`, which the
 * header renders and the beam's centre circle reuses.
 *
 * ## Framework coupling, all of it removed
 *
 * The Next.js page reached `next/image`, `fumadocs-core/link` and, through its
 * sections, `next/link` and `@vitnode/core/lib/navigation` - next-intl's
 * navigation. None of it survived: the screenshot is an `<img>` against a file
 * in `public/`, and every internal link is the injected {@link SiteLinkComponent},
 * named once by the route file above this and nowhere else on the page.
 *
 * ## What it does not do
 *
 * No loader, no query, no namespaces of its own. Every string on it is English
 * in the source, exactly as it was in Next.js - there is no `home` branch in
 * `core/locales`, and inventing Polish marketing copy is not a migration. The
 * shell above it warms what the header reads, and this page adds nothing to
 * that. `MainBreadcrumb` renders nothing here for the same reason the Next.js
 * `@breadcrumb` slot returned `null` at `/`: a breadcrumb whose only entry is
 * "Home" is a row of chrome that says nothing.
 */
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
