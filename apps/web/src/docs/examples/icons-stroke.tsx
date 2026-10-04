import { HeartIcon, MessageCircleIcon, SettingsIcon } from 'lucide-react'

const STROKES = [
  { label: 'strokeWidth={1.5}', strokeWidth: 1.5, text: 'font-normal' },
  { label: 'strokeWidth={2} default', strokeWidth: 2, text: 'font-medium' },
  { label: 'strokeWidth={2.5}', strokeWidth: 2.5, text: 'font-semibold' },
] as const

export default function IconsStroke() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
      {STROKES.map((stroke) => (
        <figure
          className={`bg-card flex flex-col gap-3 rounded-lg border p-4 ${stroke.strokeWidth === 2 ? 'border-primary' : ''}`}
          key={stroke.label}
        >
          <figcaption className="text-muted-foreground font-mono text-xs">
            {stroke.label}
          </figcaption>
          <div className="flex items-center gap-3">
            <HeartIcon className="size-6" strokeWidth={stroke.strokeWidth} />
            <MessageCircleIcon
              className="size-6"
              strokeWidth={stroke.strokeWidth}
            />
            <SettingsIcon className="size-6" strokeWidth={stroke.strokeWidth} />
          </div>
          <span className={`flex items-center gap-1.5 text-sm ${stroke.text}`}>
            <MessageCircleIcon
              className="size-4"
              strokeWidth={stroke.strokeWidth}
            />
            12 replies
          </span>
        </figure>
      ))}
    </div>
  )
}
