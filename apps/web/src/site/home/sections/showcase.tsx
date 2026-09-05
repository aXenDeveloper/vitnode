import type { CarouselApi } from '@vitnode/core/components/ui/carousel'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@vitnode/core/components/ui/carousel'
import { cn } from '@vitnode/core/lib/utils'
import { useEffect, useState } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'
import type { ScreenKey } from '#/site/marketing/screens'

import { ScreenFrame } from '#/site/marketing/screen-frame'
import { SCREENS } from '#/site/marketing/screens'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const SLIDES: { caption: string; screen: ScreenKey }[] = [
  {
    caption:
      'A dashboard you rearrange yourself. Plugins bring their own widgets, and yes, that notification widget really pushes a live toast to a member.',
    screen: 'dashboard',
  },
  {
    caption:
      'Every screen here came from one TypeScript definition. Fields, validation, rich text, uploads and a language switch per field, with zero UI code.',
    screen: 'contentEditor',
  },
  {
    caption:
      'AI, WebSockets, Redis, email, storage, cron and queues report their status in one place. Test buttons included, guessing not required.',
    screen: 'integrations',
  },
  {
    caption:
      'Roles with colours, member counts and per-plugin staff permissions. The four defaults are seeded for you; the rest is your call.',
    screen: 'roles',
  },
  {
    caption:
      'The member side is ready too: sign-in, registration, password reset and social login, with captcha waiting in the wings.',
    screen: 'login',
  },
]

const ShowcaseCarousel = () => {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }

    api.on('select', onSelect)

    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  return (
    <div className="flex flex-col gap-6">
      <div
        aria-label="Choose a screen"
        className="flex flex-wrap justify-center gap-2"
        role="group"
      >
        {SLIDES.map(({ screen }, index) => (
          <button
            aria-pressed={index === current}
            className={cn(
              buttonVariants({
                size: 'sm',
                variant: index === current ? 'default' : 'outline',
              }),
              'rounded-full',
            )}
            key={screen}
            onClick={() => api?.scrollTo(index)}
            type="button"
          >
            {SCREENS[screen].title}
          </button>
        ))}
      </div>

      <Carousel
        aria-label="VitNode screens"
        opts={{ align: 'start', loop: true }}
        setApi={setApi}
      >
        <CarouselContent>
          {SLIDES.map(({ caption, screen }) => (
            <CarouselItem key={screen}>
              <figure className="flex flex-col gap-4">
                <ScreenFrame screen={SCREENS[screen]} />
                <figcaption className="text-muted-foreground mx-auto max-w-2xl text-center text-sm leading-relaxed text-pretty">
                  {caption}
                </figcaption>
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="top-1/2 left-3 -translate-y-1/2 sm:left-4" />
        <CarouselNext className="top-1/2 right-3 -translate-y-1/2 sm:right-4" />
      </Carousel>
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

    <ShowcaseCarousel />
  </MarketingSection>
)
