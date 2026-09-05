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

import { ScreenFrame } from '#/site/marketing/screen-frame'
import { SCREENS } from '#/site/marketing/screens'

import { SLIDES } from './showcase-slides'

export const ShowcaseCarousel = () => {
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
