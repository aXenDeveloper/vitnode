import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@vitnode/core/components/ui/carousel'

const ANNOUNCEMENTS = [
  { title: 'VitNode 1.4 is out', meta: 'Releases · 2 h ago' },
  { title: 'Plugin jam starts Friday', meta: 'Events · Yesterday' },
  { title: 'New moderators wanted', meta: 'Community · 3 days ago' },
  { title: 'Dark mode got darker', meta: 'Design · Last week' },
  { title: 'Docs search is faster', meta: 'Docs · Last week' },
]

export default function CarouselVerticalExample() {
  return (
    <Carousel
      aria-label="Announcements"
      className="not-prose flex w-full max-w-xs flex-col gap-3"
      opts={{ align: 'start' }}
      orientation="vertical"
    >
      <CarouselPrevious className="static self-center" />
      <CarouselContent className="-mt-2 h-48">
        {ANNOUNCEMENTS.map(({ title, meta }, index) => (
          <CarouselItem
            aria-label={`${index + 1} of ${ANNOUNCEMENTS.length}`}
            className="basis-1/2 pt-2"
            key={title}
          >
            <div className="bg-card text-card-foreground flex h-full flex-col justify-center gap-1 rounded-lg border px-4">
              <span className="text-sm font-medium">{title}</span>
              <span className="text-muted-foreground text-xs">{meta}</span>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselNext className="static self-center" />
    </Carousel>
  )
}
