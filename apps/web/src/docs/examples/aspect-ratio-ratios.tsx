import { AspectRatio } from '@vitnode/core/components/ui/aspect-ratio'

const RATIOS = [
  { label: '16 / 9', ratio: 16 / 9, use: 'Videos, banners' },
  { label: '4 / 3', ratio: 4 / 3, use: 'Photos' },
  { label: '1', ratio: 1, use: 'Avatars, thumbnails' },
  { label: '9 / 16', ratio: 9 / 16, use: 'Phone screenshots' },
]

export default function AspectRatioRatiosExample() {
  return (
    <div className="not-prose grid w-full grid-cols-2 items-end gap-4 sm:grid-cols-4">
      {RATIOS.map(({ label, ratio, use }) => (
        <figure className="flex flex-col gap-2" key={label}>
          <AspectRatio
            className="bg-muted flex items-center justify-center rounded-lg border"
            ratio={ratio}
          >
            <span className="text-foreground font-mono text-xs">{label}</span>
          </AspectRatio>
          <figcaption className="text-muted-foreground text-center text-xs leading-relaxed">
            {use}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
