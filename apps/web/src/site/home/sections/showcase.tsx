import { lazy, Suspense, useEffect, useRef, useState } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { ScreenFrame } from '#/site/marketing/screen-frame'
import { SCREENS } from '#/site/marketing/screens'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

import { SLIDES } from './showcase-slides'

const ShowcaseCarousel = lazy(async () => ({
  default: (await import('./showcase-carousel')).ShowcaseCarousel,
}))

const ShowcaseStill = () => {
  const [{ caption, screen }] = SLIDES

  return (
    <figure className="flex flex-col gap-4">
      <ScreenFrame screen={SCREENS[screen]} />
      <figcaption className="text-muted-foreground mx-auto max-w-2xl text-center text-sm leading-relaxed text-pretty">
        {caption}
      </figcaption>
    </figure>
  )
}

const useIsNearViewport = <T extends Element>(
  ref: React.RefObject<null | T>,
) => {
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current

    if (!element || isNear) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return

        setIsNear(true)
        observer.disconnect()
      },
      { rootMargin: '600px 0px' },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [isNear, ref])

  return isNear
}

const ShowcaseStage = () => {
  const ref = useRef<HTMLDivElement>(null)
  const isNear = useIsNearViewport(ref)

  return (
    <div ref={ref}>
      {isNear ? (
        <Suspense fallback={<ShowcaseStill />}>
          <ShowcaseCarousel />
        </Suspense>
      ) : (
        <ShowcaseStill />
      )}
    </div>
  )
}

export const ShowcaseSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <MarketingSection id="admincp" labelledBy="showcase-title">
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <SectionHeading
        eyebrow="The real product, not a mockup"
        id="showcase-title"
        title="Meet your community’s control room."
      >
        Every plugin gets a home in the Admin Control Panel: users, roles,
        staff, content, integrations, cron, queues and logs. One place, fewer
        “where do I change this?” messages. Flip through a few real screens.
      </SectionHeading>

      <TextLink
        className="shrink-0"
        href="/docs/dev/plugins/admin"
        LinkComponent={LinkComponent}
      >
        Explore the AdminCP docs
      </TextLink>
    </div>

    <ShowcaseStage />
  </MarketingSection>
)
