import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@vitnode/core/components/ui/carousel'

const PLUGINS = [
  { name: 'Blog', installs: '12.4k' },
  { name: 'Search', installs: '9.1k' },
  { name: 'Passkeys', installs: '7.8k' },
  { name: 'Widgets', installs: '6.2k' },
  { name: 'Navigation', installs: '5.5k' },
  { name: 'Content Engine', installs: '4.9k' },
]

export default function CarouselSizesExample() {
  return (
    <Carousel
      aria-label="Popular plugins"
      className="not-prose flex w-full flex-col gap-4"
      opts={{ align: 'start' }}
    >
      <CarouselContent className="-ms-2">
        {PLUGINS.map(({ name, installs }, index) => (
          <CarouselItem
            aria-label={`${index + 1} of ${PLUGINS.length}`}
            className="basis-1/2 ps-2 sm:basis-1/3"
            key={name}
          >
            <div className="bg-card text-card-foreground flex aspect-square flex-col justify-end gap-1 rounded-lg border p-3">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {installs} installs
              </span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex justify-end gap-2">
        <CarouselPrevious className="static" />
        <CarouselNext className="static" />
      </div>
    </Carousel>
  )
}
