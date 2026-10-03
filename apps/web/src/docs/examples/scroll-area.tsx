import { ScrollArea } from '@vitnode/core/components/ui/scroll-area'

const releases = Array.from({ length: 40 }, (_, index) => ({
  tag: `v1.${Math.floor((40 - index) / 10)}.${(40 - index) % 10}`,
  date: new Date(2026, 8, 28 - index * 4).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
  }),
}))

export default function ScrollAreaDemo() {
  return (
    <ScrollArea className="not-prose bg-card text-card-foreground h-72 w-56 rounded-lg border">
      <div className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">Releases</h3>
        <ul className="flex flex-col divide-y">
          {releases.map(({ tag, date }) => (
            <li
              className="flex items-center justify-between gap-4 py-2 text-sm"
              key={tag}
            >
              <span className="font-mono">{tag}</span>
              <span className="text-muted-foreground text-xs">{date}</span>
            </li>
          ))}
        </ul>
      </div>
    </ScrollArea>
  )
}
