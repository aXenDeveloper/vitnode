import { Badge } from '@vitnode/core/components/ui/badge'

const variants = [
  { variant: 'default', label: 'New' },
  { variant: 'secondary', label: 'Moderator' },
  { variant: 'outline', label: 'Archived' },
  { variant: 'ghost', label: 'Hidden' },
  { variant: 'link', label: 'v2.0' },
  { variant: 'success', label: 'Published' },
  { variant: 'warning', label: 'Pending' },
  { variant: 'destructive', label: 'Banned' },
] as const

export default function BadgeDemo() {
  return (
    <div className="not-prose flex flex-wrap justify-center gap-2">
      {variants.map(({ variant, label }) => (
        <Badge key={variant} variant={variant}>
          {label}
        </Badge>
      ))}
    </div>
  )
}
