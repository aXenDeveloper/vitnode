import { Badge } from '@vitnode/core/components/ui/badge'

const counters = [
  { variant: 'default', count: '8', label: 'unread messages' },
  { variant: 'destructive', count: '99', label: 'open reports' },
  { variant: 'outline', count: '20+', label: 'drafts' },
] as const

export default function BadgeCounterExample() {
  return (
    <div className="not-prose flex flex-wrap items-center justify-center gap-2">
      {counters.map(({ variant, count, label }) => (
        <Badge className="min-w-5 px-1" key={label} variant={variant}>
          {count}
          <span className="sr-only">{label}</span>
        </Badge>
      ))}
    </div>
  )
}
