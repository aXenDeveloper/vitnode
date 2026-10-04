import type { CarouselApi } from '@vitnode/core/components/ui/carousel'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@vitnode/core/components/ui/carousel'
import { cn } from 'cn'
import { useEffect, useState } from 'react'

import adminContentCreateDark from '@/site/home/assets/admin-content-create-dark-800.webp'
import adminContentCreateLight from '@/site/home/assets/admin-content-create-light-800.webp'
import adminDashboardDark from '@/site/home/assets/admin-dashboard-dark-800.webp'
import adminDashboardLight from '@/site/home/assets/admin-dashboard-light-800.webp'
import adminIntegrationsDark from '@/site/home/assets/admin-integrations-dark-800.webp'
import adminIntegrationsLight from '@/site/home/assets/admin-integrations-light-800.webp'
import adminRolesDark from '@/site/home/assets/admin-roles-dark-800.webp'
import adminRolesLight from '@/site/home/assets/admin-roles-light-800.webp'
import publicLoginDark from '@/site/home/assets/public-login-dark-800.webp'
import publicLoginLight from '@/site/home/assets/public-login-light-800.webp'

const SLIDES = [
  { title: 'Dashboard', light: adminDashboardLight, dark: adminDashboardDark },
  {
    title: 'Content editor',
    light: adminContentCreateLight,
    dark: adminContentCreateDark,
  },
  {
    title: 'Integrations',
    light: adminIntegrationsLight,
    dark: adminIntegrationsDark,
  },
  { title: 'Roles', light: adminRolesLight, dark: adminRolesDark },
  { title: 'Sign in', light: publicLoginLight, dark: publicLoginDark },
]

export default function CarouselExample() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!api) return

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }

    api.on('select', onSelect)
    api.on('reInit', onSelect)

    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api])

  return (
    <Carousel
      aria-label="VitNode screenshots"
      className="not-prose flex w-full flex-col gap-4"
      opts={{ loop: true }}
      setApi={setApi}
    >
      <CarouselContent>
        {SLIDES.map(({ title, light, dark }, index) => (
          <CarouselItem
            aria-label={`${index + 1} of ${SLIDES.length}`}
            key={title}
          >
            <figure className="flex flex-col gap-2">
              <div className="bg-muted aspect-video overflow-hidden rounded-lg border">
                <img
                  alt={`VitNode ${title} screen`}
                  className="size-full object-cover object-top dark:hidden"
                  decoding="async"
                  loading="lazy"
                  src={light}
                />
                <img
                  alt={`VitNode ${title} screen`}
                  className="hidden size-full object-cover object-top dark:block"
                  decoding="async"
                  loading="lazy"
                  src={dark}
                />
              </div>
              <figcaption className="text-muted-foreground text-center text-sm leading-relaxed">
                {title}
              </figcaption>
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>

      <div className="flex items-center justify-between gap-4">
        <CarouselPrevious className="static" />
        <div className="flex items-center gap-1">
          {SLIDES.map(({ title }, index) => (
            <button
              aria-current={index === current}
              aria-label={`Go to slide ${index + 1}: ${title}`}
              className="focus-visible:ring-ring/50 flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3"
              key={title}
              onClick={() => api?.scrollTo(index)}
              type="button"
            >
              <span
                className={cn(
                  'h-2 rounded-full transition-all motion-reduce:transition-none',
                  index === current
                    ? 'bg-primary w-4'
                    : 'bg-muted-foreground/40 w-2',
                )}
              />
            </button>
          ))}
        </div>
        <CarouselNext className="static" />
      </div>
    </Carousel>
  )
}
